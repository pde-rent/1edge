import { ethers } from 'ethers';
import axios from 'axios';
import { getLimitOrderV4Domain, LimitOrderContract, TakerTraits, AmountMode } from '@1inch/limit-order-sdk';
import { priceCache } from './priceCache';
import { getConfig } from './config';
import { logger } from '../utils/logger';
import { PairSymbol } from '../../common/types';

// --- Configuration ---
const MAKER_ADDRESSES = [
    '0xfeb52d099ade0b5902690f20dfe88c78f81329d6',
];
const CHAIN_ID = 56; // BSC Mainnet
const ONEINCH_API_BASE_URL = 'https://api.1inch.dev/orderbook/v4.0';
const API_KEY = process.env.ONE_INCH_API_KEY;
const KEEPER_PK = process.env.KEEPER_PK;
const PRICE_THRESHOLD_PERCENT = 1; // Fill if order price is within 1% of spot price
const CHECK_INTERVAL_MS = 60000; // Check for orders every 60 seconds

interface TokenInfo {
    symbol: string;
    decimals: number;
    address: string;
}

export class TakerBot {
    private provider: ethers.JsonRpcProvider;
    private keeper: ethers.Wallet;
    private interval: NodeJS.Timeout | null = null;
    private limitOrderProtocolAddress: string;
    private limitOrderContract: any;
    private tokenInfo: Map<string, TokenInfo> = new Map();

    constructor() {
        if (!KEEPER_PK) {
            throw new Error("KEEPER_PK environment variable is not set.");
        }
        if (!API_KEY) {
            logger.warn("ONE_INCH_API_KEY environment variable is not set. API calls may fail.");
        }

        const config = getConfig();
        this.provider = new ethers.JsonRpcProvider(config.networks[CHAIN_ID].rpcUrl);
        this.keeper = new ethers.Wallet(KEEPER_PK, this.provider);

        const domain = getLimitOrderV4Domain(CHAIN_ID);
        this.limitOrderProtocolAddress = domain.verifyingContract;
        this.limitOrderContract = new (LimitOrderContract as any)(this.limitOrderProtocolAddress, CHAIN_ID, this.provider);

        this.loadTokenInfo();
        logger.info('Taker Bot initialized.');
        logger.info(`Bot Address: ${this.getBotAddress()}`);
    }

    public getBotAddress(): string {
        return this.keeper.address;
    }

    private loadTokenInfo() {
        const config = getConfig();
        const tokenMapping = config.tokenMapping;
        for (const symbol in tokenMapping) {
            const tokenData = tokenMapping[symbol];
            if (tokenData[CHAIN_ID]) {
                const address = tokenData[CHAIN_ID].toLowerCase();
                this.tokenInfo.set(address, {
                    symbol,
                    decimals: Number(tokenData.decimals) || 18, // Default to 18 if not specified
                    address: tokenData[CHAIN_ID]
                });
            }
        }
        logger.info(`Loaded ${this.tokenInfo.size} tokens for chain ${CHAIN_ID}.`);
    }

    public async start() {
        logger.info('Starting Taker Bot...');
        // await priceCache.connect(); // Not needed for just printing
        await this.checkAndFillOrders(); // Run once and exit
    }

    public async startContinuous() {
        logger.info('Starting Taker Bot in continuous mode...');
        // await priceCache.connect(); // Not needed for just printing
        this.interval = setInterval(() => this.checkAndFillOrders(), CHECK_INTERVAL_MS);
        this.checkAndFillOrders(); // Run once immediately on start
    }

    public stop() {
        logger.info('Stopping Taker Bot...');
        if (this.interval) {
            clearInterval(this.interval);
        }
        // priceCache.disconnect();
    }

    private async checkAndFillOrders() {
        logger.info('Running order check cycle...');
        try {
            for (const address of MAKER_ADDRESSES) {
                await this.processMaker(address);
            }
        } catch (error) {
            logger.error('Error in Taker Bot check cycle', { error });
        }
    }

    private async processMaker(makerAddress: string) {
        logger.info(`Fetching orders for maker: ${makerAddress}`);
        const orders = await this.getOrdersFromApi(makerAddress);

        if (orders.length === 0) {
            logger.info(`No active orders found for ${makerAddress}.`);
            return;
        }

        console.log(`Found ${orders.length} active orders for ${makerAddress}:`);
        console.log(JSON.stringify(orders, null, 2));
    }

    private async getOrdersFromApi(address: string): Promise<any[]> {
        const url = `${ONEINCH_API_BASE_URL}/${CHAIN_ID}/address/${address}`;
        try {
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                params: { statuses: '1' } // 1 = active, 2 = temporarily invalid, 3 = cancelled
            });
            return response.data;
        } catch (error: any) {
            logger.error(`Failed to fetch orders for ${address}: ${error.message}`);
            return [];
        }
    }

    private async evaluateOrder(orderData: any) {
        // This function is no longer called in the modified flow, but kept for reference
        const { makerAsset, takerAsset, makingAmount, takingAmount, extension } = orderData.data;
        const orderHash = orderData.orderHash;

        const makerToken = this.tokenInfo.get(makerAsset.toLowerCase());
        const takerToken = this.tokenInfo.get(takerAsset.toLowerCase());

        if (!makerToken || !takerToken) {
            logger.warn(`Skipping order ${orderHash}: Unknown token.`);
            return;
        }

        // Don't process orders with complex extensions for now
        if (extension !== '0x') {
            logger.info(`Skipping order ${orderHash}: Complex extensions are not supported.`);
            return;
        }

        const ticker = `agg:spot:${makerToken.symbol}${takerToken.symbol}` as PairSymbol;
        const reverseTicker = `agg:spot:${takerToken.symbol}${makerToken.symbol}` as PairSymbol;

        let spotPrice: number | undefined;
        const priceData = priceCache.getPrice(ticker);

        if (priceData?.mid) {
            spotPrice = priceData.mid;
        } else {
            const reversePriceData = priceCache.getPrice(reverseTicker);
            if (reversePriceData?.mid) {
                spotPrice = 1 / reversePriceData.mid;
            }
        }

        if (spotPrice === undefined) {
            logger.warn(`Skipping order ${orderHash}: No spot price for ${ticker} or ${reverseTicker}.`);
            return;
        }

        const orderPrice = parseFloat(ethers.formatUnits(takingAmount, takerToken.decimals)) /
            parseFloat(ethers.formatUnits(makingAmount, makerToken.decimals));

        const priceDifference = Math.abs(orderPrice - spotPrice) / spotPrice * 100;

        logger.info(`Evaluating order ${orderHash}: Order Price=${orderPrice.toFixed(6)}, Spot Price=${spotPrice.toFixed(6)}, Diff=${priceDifference.toFixed(2)}%`);

        if (priceDifference <= PRICE_THRESHOLD_PERCENT) {
            logger.info(`Price for order ${orderHash} is within ${PRICE_THRESHOLD_PERCENT}% threshold. Attempting to fill.`);
            await this.fillOrder(orderData);
        }
    }

    private async fillOrder(orderData: any) {
        const orderHash = orderData.orderHash;
        try {
            const order = {
                salt: orderData.data.salt,
                maker: orderData.data.maker,
                receiver: orderData.data.receiver,
                makerAsset: orderData.data.makerAsset,
                takerAsset: orderData.data.takerAsset,
                makingAmount: orderData.data.makingAmount,
                takingAmount: orderData.data.takingAmount,
                makerTraits: orderData.data.makerTraits,
            };

            const signature = orderData.signature;
            const fillAmount = orderData.remainingMakerAmount;

            // Threshold: we are willing to spend at most `takingAmount` for `makingAmount`
            const thresholdAmount = this.limitOrderContract.calculateTakingAmount(fillAmount, order.makingAmount, order.takingAmount);

            // Note: This part has TypeScript issues but is commented out for dry run
            /*
            const takerTraits = TakerTraits.default()
                .setAmountMode(AmountMode.maker)
                .setAmountThreshold(thresholdAmount);

            const calldata = this.limitOrderContract.getFillOrderArgsCalldata(
                order,
                signature,
                takerTraits,
                fillAmount,
            );
            */

            // --- TRANSACTION SENDING COMMENTED OUT ---
            /*
            const tx = await this.keeper.sendTransaction({
                to: this.limitOrderProtocolAddress,
                data: calldata,
                gasLimit: 250000 // Set a reasonable gas limit
            });

            logger.info(`Submitted fill transaction for order ${orderHash}: ${tx.hash}`);
            const receipt = await tx.wait();
            logger.info(`Transaction for order ${orderHash} confirmed in block ${receipt?.blockNumber}`);
            */
            logger.info(`[DRY RUN] Would have filled order ${orderHash}`);


        } catch (error: any) {
            logger.error(`Failed to fill order ${orderHash}: ${error.message}`);
        }
    }
}
