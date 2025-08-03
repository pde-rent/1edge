#!/usr/bin/env bun

import { TakerBot } from '../back/services/takerBot';

async function main() {
    console.log('🤖 Starting TakerBot...');

    // Debug: Check environment variables
    console.log('Environment check:');
    console.log('KEEPER_PK:', process.env.KEEPER_PK ? '✅ Set' : '❌ Not set');
    console.log('ONE_INCH_API_KEY:', process.env.ONE_INCH_API_KEY ? '✅ Set' : '❌ Not set');
    console.log('ONEINCH_API_KEY:', process.env.ONEINCH_API_KEY ? '✅ Set' : '❌ Not set');

    // Check if required environment variables are set
    if (!process.env.KEEPER_PK) {
        console.error('❌ KEEPER_PK environment variable is not set.');
        console.log('Please set it in your .env file or export it:');
        console.log('export KEEPER_PK=your_private_key_here');
        process.exit(1);
    }

    if (!process.env.ONE_INCH_API_KEY && !process.env.ONEINCH_API_KEY) {
        console.warn('⚠️  Neither ONE_INCH_API_KEY nor ONEINCH_API_KEY environment variable is set.');
        console.warn('API calls may fail without it.');
    }

    try {
        const bot = new TakerBot();
        console.log(`Bot address: ${bot.getBotAddress()}`);

        // Run once and fetch orders
        console.log('� Fetching active orders...');
        await bot.start();

        console.log('✅ Order check completed.');

    } catch (error) {
        console.error('❌ Failed to run TakerBot:', error);
        process.exit(1);
    }
}

main().catch(console.error);
