#!/usr/bin/env bun

/**
 * Test script for OHLC storage and retrieval system
 * Tests both cache and database operations
 */

import { initOHLCStorage, getOHLCStorage, OHLCTimeframe } from "../back/services/ohlcStorage";
import { logger } from "../back/utils/logger";
import type { Symbol } from "../common/types";

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
}

class OHLCTester {
  private results: TestResult[] = [];
  private testSymbol: Symbol = "binance:spot:BTCUSDT";

  async runAllTests(): Promise<void> {
    logger.info("Starting OHLC system tests...");
    
    // Initialize OHLC storage
    initOHLCStorage("./data/test-ohlc");
    await getOHLCStorage().initialize();

    // Run test suite
    await this.testPriceUpdates();
    await this.testCacheOperations();
    await this.testDatabaseOperations();
    await this.testAPIEndpoints();
    await this.testDataStatistics();
    
    // Cleanup
    await getOHLCStorage().shutdown();
    
    // Report results
    this.reportResults();
  }

  private async testPriceUpdates(): Promise<void> {
    await this.runTest("Price Updates Processing", async () => {
      const storage = getOHLCStorage();
      const basePrice = 45000;
      const timestamp = Date.now();
      
      // Send a series of price updates
      for (let i = 0; i < 10; i++) {
        const price = basePrice + (Math.random() - 0.5) * 100; // Random price movement
        const volume = Math.random() * 1000;
        await storage.processPriceUpdate(this.testSymbol, price, volume);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between updates
      }
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    });
  }

  private async testCacheOperations(): Promise<void> {
    await this.runTest("Cache Operations (5s candles)", async () => {
      const storage = getOHLCStorage();
      
      // Generate some 5-second candles
      const now = Date.now();
      for (let i = 0; i < 20; i++) {
        const price = 45000 + Math.sin(i / 5) * 500; // Sine wave price pattern
        const volume = 100 + Math.random() * 50;
        await storage.processPriceUpdate(this.testSymbol, price, volume);
        await new Promise(resolve => setTimeout(resolve, 250)); // Fast updates to create multiple candles
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retrieve 5s candles from cache
      const candles5s = await storage.getCandles(
        this.testSymbol,
        OHLCTimeframe.S5,
        now - 60000, // Last minute
        undefined,
        50
      );
      
      if (candles5s.length === 0) {
        throw new Error("No 5s candles found in cache");
      }
      
      logger.info(`Retrieved ${candles5s.length} 5s candles from cache`);
      
      // Verify cache functionality
      const candles20s = await storage.getCandles(
        this.testSymbol,
        OHLCTimeframe.S20,
        now - 60000,
        undefined,
        20
      );
      
      logger.info(`Retrieved ${candles20s.length} 20s candles from cache`);
    });
  }

  private async testDatabaseOperations(): Promise<void> {
    await this.runTest("Database Operations (1m candles)", async () => {
      const storage = getOHLCStorage();
      
      // Generate price updates over several minutes
      const startTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
      let currentTime = startTime;
      
      while (currentTime < Date.now()) {
        const price = 45000 + Math.sin(currentTime / 60000) * 1000; // Price varies over time
        const volume = 50 + Math.random() * 100;
        
        // Simulate price update at specific time
        await storage.processPriceUpdate(this.testSymbol, price, volume);
        currentTime += 30000; // 30 second intervals
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
      }
      
      // Wait for database writes to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retrieve 1m candles from database
      const candles1m = await storage.getCandles(
        this.testSymbol,
        OHLCTimeframe.M1,
        startTime,
        undefined,
        10
      );
      
      if (candles1m.length === 0) {
        throw new Error("No 1m candles found in database");
      }
      
      logger.info(`Retrieved ${candles1m.length} 1m candles from database`);
      
      // Verify candle structure
      const candle = candles1m[0];
      if (!candle.timestamp || !candle.open || !candle.high || !candle.low || !candle.close) {
        throw new Error("Invalid candle structure");
      }
      
      // Verify OHLC logic
      if (candle.high < candle.open || candle.high < candle.close ||
          candle.low > candle.open || candle.low > candle.close) {
        throw new Error("Invalid OHLC values");
      }
    });
  }

  private async testAPIEndpoints(): Promise<void> {
    await this.runTest("API Endpoints", async () => {
      const baseUrl = "http://localhost:40005";
      
      // Test OHLC data endpoint
      const ohlcResponse = await fetch(
        `${baseUrl}/ohlc/${encodeURIComponent(this.testSymbol)}?timeframe=60&limit=10`
      );
      
      if (!ohlcResponse.ok) {
        throw new Error(`OHLC API returned ${ohlcResponse.status}: ${await ohlcResponse.text()}`);
      }
      
      const ohlcData = await ohlcResponse.json();
      if (!ohlcData.success) {
        throw new Error(`OHLC API error: ${ohlcData.error}`);
      }
      
      logger.info(`API returned ${ohlcData.data.count} candles`);
      
      // Test statistics endpoint
      const statsResponse = await fetch(
        `${baseUrl}/ohlc-stats/${encodeURIComponent(this.testSymbol)}`
      );
      
      if (!statsResponse.ok) {
        throw new Error(`Stats API returned ${statsResponse.status}: ${await statsResponse.text()}`);
      }
      
      const statsData = await statsResponse.json();
      if (!statsData.success) {
        throw new Error(`Stats API error: ${statsData.error}`);
      }
      
      logger.info("Statistics:", JSON.stringify(statsData.data.statistics, null, 2));
    });
  }

  private async testDataStatistics(): Promise<void> {
    await this.runTest("Data Statistics", async () => {
      const storage = getOHLCStorage();
      const stats = await storage.getDataStats(this.testSymbol);
      
      logger.info("OHLC Statistics:", JSON.stringify(stats, null, 2));
      
      // Verify statistics structure
      if (!stats["60"] && !stats["5_cache"]) {
        throw new Error("No statistics data found");
      }
    });
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      this.results.push({
        name,
        success: true,
        duration: Date.now() - startTime
      });
      logger.info(`✅ ${name} - PASSED (${Date.now() - startTime}ms)`);
    } catch (error: any) {
      this.results.push({
        name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });
      logger.error(`❌ ${name} - FAILED: ${error.message} (${Date.now() - startTime}ms)`);
    }
  }

  private reportResults(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log("\n" + "=".repeat(60));
    console.log("OHLC SYSTEM TEST RESULTS");
    console.log("=".repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log("\nFAILED TESTS:");
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`- ${r.name}: ${r.error}`);
        });
    }
    
    console.log("\nDETAILED RESULTS:");
    this.results.forEach(r => {
      const status = r.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${r.name} (${r.duration}ms)`);
    });
    
    console.log("=".repeat(60));
  }
}

// Run tests if this script is executed directly
if (import.meta.main) {
  const tester = new OHLCTester();
  
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Test suite failed:", error);
      process.exit(1);
    });
}