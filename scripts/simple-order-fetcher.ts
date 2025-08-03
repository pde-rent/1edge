import axios from 'axios';

// --- Configuration ---
const MAKER_ADDRESSES = [
    '0xfeb52d099ade0b5902690f20dfe88c78f81329d6',
    '0x337c0b993f52f6b0c754b4102cc3d04c4d0414b1',
];
const CHAIN_ID = 56; // BSC Mainnet
const ONEINCH_API_BASE_URL = 'https://api.1inch.dev/orderbook/v4.0';
const API_KEY = process.env.ONE_INCH_API_KEY;

async function fetchOrders(address: string): Promise<any[]> {
    const url = `${ONEINCH_API_BASE_URL}/${CHAIN_ID}/address/${address}`;
    console.log(`🔍 Fetching orders from: ${url}`);
    console.log(`🔑 API Key: ${API_KEY ? 'Set (' + API_KEY.length + ' chars)' : 'Not set'}`);

    try {
        // Try different status parameters
        const statusOptions = [
            { params: { statuses: '1' }, name: 'active' },
            { params: { statuses: '2' }, name: 'filled' },
            { params: { statuses: '3' }, name: 'cancelled' },
            { params: {}, name: 'all' }
        ];

        for (const option of statusOptions) {
            console.log(`\n🔄 Checking ${option.name} orders...`);

            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
                ...option
            });

            console.log(`📊 Status: ${response.status}`);

            let orders = [];
            if (Array.isArray(response.data)) {
                orders = response.data;
            } else if (response.data?.orders) {
                orders = response.data.orders;
            } else if (response.data?.data) {
                orders = response.data.data;
            }

            console.log(`📊 Found ${orders.length} ${option.name} orders`);

            if (orders.length > 0) {
                console.log(`✅ Returning ${orders.length} ${option.name} orders`);
                return orders;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return [];

    } catch (error: any) {
        console.error(`❌ Error fetching orders:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        return [];
    }
}

async function main() {
    console.log('🤖 Simple Order Fetcher for BSC Chain');
    console.log(`🔗 Chain ID: ${CHAIN_ID}`);
    console.log(`📋 Checking ${MAKER_ADDRESSES.length} addresses...`);

    for (const address of MAKER_ADDRESSES) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📍 Address: ${address}`);
        console.log('='.repeat(80));

        const orders = await fetchOrders(address);

        if (orders.length > 0) {
            console.log(`\n🎉 Found ${orders.length} orders!`);
            console.log(JSON.stringify(orders, null, 2));
        } else {
            console.log(`\n😔 No orders found for this address`);
        }

        // Delay between addresses to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Finished checking all addresses');
}

main().catch(console.error);
