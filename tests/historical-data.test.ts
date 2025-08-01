#!/usr/bin/env bun

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { getOHLCStorage, initOHLCStorage } from "@back/services/ohlcStorage";
import { getConfig } from "@back/services/config";
import { rm, mkdir } from "fs/promises";
import type { Symbol } from "@common/types";

describe("Historical Data Retrieval", () => {
  const TEST_DATA_DIR = "./test-data/ohlc";
  
  beforeAll(async () => {
    // Clean up test data directory
    try {
      await rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, ignore
    }
    
    // Create test data directory
    await mkdir(TEST_DATA_DIR, { recursive: true });
    
    // Initialize OHLC storage with test directory
    await initOHLCStorage(TEST_DATA_DIR);
  });

  afterAll(async () => {
    // Clean up test data directory
    try {
      await rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it("should automatically retrieve historical data for all configured symbols on startup", async () => {
    const storage = getOHLCStorage();
    
    // Get symbols from collector configuration (the actual symbols the system uses)
    const config = getConfig();
    const tickerConfigs = config.services?.collector?.tickers || {};
    
    // Extract Binance symbols from the aggregate configurations
    const binanceSymbols: Symbol[] = [];
    for (const [aggregateSymbol, tickerConfig] of Object.entries(tickerConfigs)) {
      const sources = (tickerConfig as any).sources || {};
      for (const sourceSymbol of Object.keys(sources)) {
        if (sourceSymbol.startsWith('binance:spot:')) {
          binanceSymbols.push(sourceSymbol as Symbol);
        }
      }
    }
    
    expect(binanceSymbols.length).toBeGreaterThan(0);
    console.log(`✅ Found ${binanceSymbols.length} Binance symbols in configuration`);
    
    // Run data sanity check (this simulates collector startup)
    await storage.runDataSanityCheck(binanceSymbols);
    
    // Verify that historical data was retrieved for at least one symbol
    const testSymbol = binanceSymbols[0];
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Get 1-minute data
    const candlesM1 = await storage.getCandles(testSymbol, 60, sevenDaysAgo, now, 50);
    expect(candlesM1.length).toBeGreaterThan(0);
    
    // Verify basic candle structure and data integrity
    const firstCandle = candlesM1[0];
    expect(firstCandle).toHaveProperty("timestamp");
    expect(firstCandle).toHaveProperty("open");
    expect(firstCandle).toHaveProperty("high");
    expect(firstCandle).toHaveProperty("low");
    expect(firstCandle).toHaveProperty("close");
    expect(firstCandle).toHaveProperty("volume");
    
    // Verify OHLC relationships
    for (const candle of candlesM1) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
      expect(candle.volume).toBeGreaterThanOrEqual(0);
    }
    
    console.log(`✅ Historical data retrieval successful for ${testSymbol}`);
    console.log(`   Retrieved ${candlesM1.length} 1-minute candles`);
    console.log(`   Date range: ${new Date(firstCandle.timestamp).toISOString()} to ${new Date(candlesM1[candlesM1.length-1].timestamp).toISOString()}`);
  }, 120000); // 120 second timeout for 5 symbols (each takes ~13s)

  it("should automatically construct higher timeframes from 1-minute data", async () => {
    const storage = getOHLCStorage();
    
    // Get the first configured Binance symbol
    const config = getConfig();
    const tickerConfigs = config.services?.collector?.tickers || {};
    const binanceSymbols: Symbol[] = [];
    for (const [aggregateSymbol, tickerConfig] of Object.entries(tickerConfigs)) {
      const sources = (tickerConfig as any).sources || {};
      for (const sourceSymbol of Object.keys(sources)) {
        if (sourceSymbol.startsWith('binance:spot:')) {
          binanceSymbols.push(sourceSymbol as Symbol);
        }
      }
    }
    
    const testSymbol = binanceSymbols[0];
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Get 5-minute and 30-minute data (should be automatically constructed)
    const candlesM5 = await storage.getCandles(testSymbol, 300, sevenDaysAgo, now, 20);
    const candlesM30 = await storage.getCandles(testSymbol, 1800, sevenDaysAgo, now, 20);
    
    expect(candlesM5.length).toBeGreaterThan(0);
    expect(candlesM30.length).toBeGreaterThan(0);
    
    // Verify OHLC relationships for constructed candles
    for (const candle of candlesM5) {
      expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close));
      expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close));
    }
    
    console.log(`✅ Higher timeframes constructed: 5m: ${candlesM5.length}, 30m: ${candlesM30.length} candles`);
  }, 15000);

  it("should verify data completeness and statistics", async () => {
    const storage = getOHLCStorage();
    
    // Get the first configured Binance symbol
    const config = getConfig();
    const tickerConfigs = config.services?.collector?.tickers || {};
    const binanceSymbols: Symbol[] = [];
    for (const [aggregateSymbol, tickerConfig] of Object.entries(tickerConfigs)) {
      const sources = (tickerConfig as any).sources || {};
      for (const sourceSymbol of Object.keys(sources)) {
        if (sourceSymbol.startsWith('binance:spot:')) {
          binanceSymbols.push(sourceSymbol as Symbol);
        }
      }
    }
    
    const testSymbol = binanceSymbols[0];
    
    // Get statistics to verify data completeness
    const stats = await storage.getDataStats(testSymbol);
    expect(stats).toBeDefined();
    
    // Check that we have substantial historical data (~14 days worth)
    const oneMinStats = stats["60s"];
    expect(oneMinStats.count).toBeGreaterThan(10000); // At least ~7 days
    expect(oneMinStats.count).toBeLessThan(25000); // But not more than ~17 days
    
    // Verify database schema
    expect(stats).toHaveProperty("60s"); // 1 minute
    expect(stats).toHaveProperty("300s"); // 5 minutes  
    expect(stats).toHaveProperty("1800s"); // 30 minutes
    
    console.log(`✅ Data completeness verified for ${testSymbol}:`);
    console.log(`   1m: ${oneMinStats.count} candles (≈${(oneMinStats.count/1440).toFixed(1)} days)`);
    console.log(`   5m: ${stats["300s"]?.count || 0} candles`);
    console.log(`   30m: ${stats["1800s"]?.count || 0} candles`);
  }, 15000);
});