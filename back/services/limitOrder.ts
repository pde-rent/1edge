import {
  LimitOrder,
  MakerTraits,
  Address,
  randBigInt,
  Sdk,
  FetchProviderConnector as SDKFetchProviderConnector,
} from "@1inch/limit-order-sdk";
import { ethers, Wallet } from "ethers";
import { logger } from "@back/utils/logger";
import { OneInchLimitOrderParams, SubmitOrderResult } from "@common/types";
import deployments from "../../deployments.json";

// Constants
const UINT_40_MAX = (1n << 40n) - 1n;


// Helper function to convert common type to SDK Address types
function convertToCreateOrderParams(params: OneInchLimitOrderParams): {
  makerAsset: any;
  takerAsset: any;
  makingAmount: bigint;
  takingAmount: bigint;
  maker: any;
  receiver?: any;
  salt?: bigint;
  expirationMs?: number;
  nonce?: bigint;
  partialFillsEnabled?: boolean;
} {
  // Convert expiry days to milliseconds if provided
  let expirationMs = params.expirationMs;
  if (params.expiry && !expirationMs) {
    // params.expiry is in days from frontend
    expirationMs = Date.now() + (params.expiry * 24 * 60 * 60 * 1000);
  }

  return {
    makerAsset: new Address(params.makerAsset),
    takerAsset: new Address(params.takerAsset),
    makingAmount: typeof params.makingAmount === 'string' ? BigInt(params.makingAmount) : params.makingAmount,
    takingAmount: typeof params.takingAmount === 'string' ? BigInt(params.takingAmount) : params.takingAmount,
    maker: new Address(params.maker),
    receiver: params.receiver ? new Address(params.receiver) : undefined,
    salt: params.salt ? (typeof params.salt === 'string' ? BigInt(params.salt) : params.salt) : undefined,
    expirationMs: expirationMs,
    nonce: params.nonce ? (typeof params.nonce === 'string' ? BigInt(params.nonce) : params.nonce) : undefined,
    partialFillsEnabled: params.partialFillsEnabled,
  };
}


/**
 * 1inch Limit Order Service
 */
export class LimitOrderService {
  private sdk: any;
  private delegateProxy?: ethers.Contract;
  private keeper?: Wallet;
  private chainId: number;

  constructor(
    authKey: string,
    chainId: number,
    keeper?: Wallet,
    provider?: ethers.Provider,
  ) {
    this.chainId = chainId;
    this.keeper = keeper;

    // Initialize 1inch SDK
    this.sdk = new (Sdk as any)({
      authKey: authKey!,
      networkId: chainId,
      httpConnector: new (SDKFetchProviderConnector as any)(),
    });

    // Setup DelegateProxy contract if keeper and provider available
    if (keeper && provider) {
      const proxyAddress = (deployments.deployments as any)[chainId.toString()]?.proxy;
      if (proxyAddress) {
        this.delegateProxy = new ethers.Contract(
          proxyAddress,
          deployments.abi,
          keeper,
        );
      }
    }
  }

  /**
   * Create a 1inch limit order with proper maker traits
   */
  async createOrder(params: OneInchLimitOrderParams): Promise<any> {
    const convertedParams = convertToCreateOrderParams(params);

    // Build maker traits exactly like working code
    const nonce = convertedParams.nonce || randBigInt(UINT_40_MAX);
    
    // Set expiration - default to 1 hour from now if not provided
    const expirationMs = convertedParams.expirationMs || (Date.now() + 3600000); // 1 hour default
    const expiration = BigInt(Math.floor(expirationMs / 1000));
    
    let makerTraits = (MakerTraits as any).default()
      .allowPartialFills()    // Required by API for non-RFQ orders
      .allowMultipleFills()   // Required by API for non-RFQ orders
      .withExpiration(expiration)
      .withNonce(nonce);
    
    // For DelegateProxy orders, always use DelegateProxy as maker
    const delegateProxyAddress = this.delegateProxy?.target;
    const finalMaker = delegateProxyAddress 
      ? new Address(delegateProxyAddress.toString())
      : convertedParams.maker;

    // Enable pre/post interactions when using DelegateProxy
    if (delegateProxyAddress) {
      makerTraits = makerTraits
        .enablePreInteraction()   // Required for DelegateProxy JIT fund pulling
        .enablePostInteraction(); // Enable post interactions for DelegateProxy
      
      logger.info(`🔗 DelegateProxy maker traits configured`, {
        delegateProxyAddress: delegateProxyAddress.toString(),
        preInteractionEnabled: true,
        postInteractionEnabled: true
      });
    }

    // Create the order exactly like working code
    let order: any;
    try {
      // Try to create order with SDK (gets proper extension from API)
      order = await this.sdk.createOrder({
        makerAsset: convertedParams.makerAsset,
        takerAsset: convertedParams.takerAsset,
        makingAmount: convertedParams.makingAmount,
        takingAmount: convertedParams.takingAmount,
        maker: finalMaker,
        receiver: convertedParams.receiver || convertedParams.maker,
      }, makerTraits);
      
    } catch (sdkError: any) {
      
      // Fallback: create basic order without extension (exactly like working test)
      order = new (LimitOrder as any)({
        makerAsset: convertedParams.makerAsset,
        takerAsset: convertedParams.takerAsset,
        makingAmount: convertedParams.makingAmount,
        takingAmount: convertedParams.takingAmount,
        maker: finalMaker,
        receiver: convertedParams.receiver || convertedParams.maker,
      }, makerTraits);
    }

    return order;
  }

  /**
   * Sign an order using DelegateProxy-compatible signature
   */
  async signOrder(order: any, signerWallet: Wallet): Promise<string> {
    const typedData = order.getTypedData();
    return signerWallet.signTypedData(
      typedData.domain,
      { Order: typedData.types.Order },
      typedData.message,
    );
  }

  /**
   * Create order on DelegateProxy contract (required for ERC-1271 validation)
   */
  async createOrderOnDelegateProxy(
    order: any,
    userAddress: string,
  ): Promise<string> {
    if (!this.delegateProxy || !this.keeper) {
      throw new Error("DelegateProxy contract or keeper not configured");
    }

    const contractOrder = {
      salt: order.salt,
      maker: BigInt(order.maker.toString()),
      receiver: BigInt(order.receiver.toString()),
      makerAsset: BigInt(order.makerAsset.toString()),
      takerAsset: BigInt(order.takerAsset.toString()),
      makingAmount: order.makingAmount,
      takingAmount: order.takingAmount,
      makerTraits: order.makerTraits.asBigInt(),
    };

    const createTx = await this.delegateProxy.create1inchOrder(contractOrder, userAddress);
    await createTx.wait();
    return createTx.hash;
  }

  /**
   * Submit order to 1inch API
   */
  async submitOrderToAPI(
    order: any,
    signature: string,
  ): Promise<SubmitOrderResult> {
    const orderHash = order.getOrderHash(this.chainId);
    
    logger.info(`🔄 Submitting order to 1inch API`, {
      orderHash,
      chainId: this.chainId,
      makerAsset: order.makerAsset.toString(),
      takerAsset: order.takerAsset.toString(),
      makingAmount: order.makingAmount.toString(),
      takingAmount: order.takingAmount.toString(),
      maker: order.maker.toString(),
      receiver: order.receiver.toString(),
      salt: order.salt.toString(),
      signatureLength: signature.length
    });

    try {
      const apiResponse = await this.sdk.submitOrder(order, signature);
      logger.info(`✅ Order successfully submitted to 1inch API`, { orderHash });
      return { orderHash, signature, apiResponse, success: true };
    } catch (error: any) {
      logger.error(`❌ Failed to submit order to 1inch API`, { 
        orderHash, 
        error: error.message,
        stack: error.stack 
      });
      return { orderHash, signature, success: false, error: error.message };
    }
  }

  /**
   * Complete order creation and submission workflow
   */
  async createAndSubmitOrder(
    params: OneInchLimitOrderParams,
    userAddress: string,
    signerWallet?: Wallet,
  ): Promise<SubmitOrderResult> {
    const order = await this.createOrder(params);
    const orderHash = order.getOrderHash(this.chainId);
    
    logger.info(`📋 Creating 1inch limit order`, {
      orderHash,
      shortHash: `${orderHash.slice(0, 10)}...`,
      userAddress,
      usingDelegateProxy: !!this.delegateProxy
    });

    if (this.delegateProxy) {
      logger.info(`🔗 Creating order on DelegateProxy contract`, { orderHash });
      await this.createOrderOnDelegateProxy(order, userAddress);
    }

    const signature = this.delegateProxy 
      ? '0x' + '00'.repeat(65) // ERC1271 dummy signature
      : await this.signOrder(order, signerWallet || this.keeper!);

    const result = await this.submitOrderToAPI(order, signature);
    
    if (result.success) {
      logger.info(`✅ 1inch order submission successful`, { 
        orderHash,
        shortHash: `${orderHash.slice(0, 10)}...`
      });
    } else {
      logger.error(`❌ 1inch order submission failed`, { 
        orderHash,
        shortHash: `${orderHash.slice(0, 10)}...`,
        error: result.error
      });
    }
    
    return result;
  }
}

/**
 * Helper function to create a LimitOrderService instance
 */
export function createLimitOrderService(
  authKey: string,
  chainId: number,
  keeper?: Wallet,
  provider?: ethers.Provider,
): LimitOrderService {
  return new LimitOrderService(authKey, chainId, keeper, provider);
}

/**
 * Helper function for quick order creation (similar to the SDK example)
 */
export async function createQuickOrder(
  authKey: string,
  chainId: number,
  makerWallet: Wallet,
  provider: ethers.Provider,
  params: {
    makerAssetAddress: string;
    takerAssetAddress: string;
    makingAmount: bigint;
    takingAmount: bigint;
    receiverAddress?: string;
    expirationDays?: number; // Changed from expirationMinutes to expirationDays
  },
): Promise<SubmitOrderResult> {
  const service = createLimitOrderService(authKey, chainId, makerWallet, provider);

  const orderParams: OneInchLimitOrderParams = {
    makerAsset: params.makerAssetAddress,
    takerAsset: params.takerAssetAddress,
    makingAmount: params.makingAmount,
    takingAmount: params.takingAmount,
    maker: makerWallet.address,
    receiver: params.receiverAddress,
    expirationMs: params.expirationDays ? Date.now() + (params.expirationDays * 24 * 60 * 60 * 1000) : undefined, // Convert days to milliseconds
  };

  return service.createAndSubmitOrder(orderParams, makerWallet.address, makerWallet);
}