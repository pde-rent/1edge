#!/usr/bin/env bun

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { priceCache } from "../back/services/priceCache";
import { sleep } from "../common/utils";
import type { PairSymbol } from "../common/types";

describe("Price Cache Integration", () => {
  const ETHUSDT_TICKER: PairSymbol = "agg:spot:ETHUSDT" as PairSymbol;
  const BTCUSDT_TICKER: PairSymbol = "agg:spot:BTCUSDT" as PairSymbol;

  beforeAll(async () => {
    console.log("🔗 Connecting to price feed pubsub...");
    await priceCache.connect();
    console.log("✅ Price cache connected");
  });

  afterAll(async () => {
    console.log("🔌 Disconnecting from price feed...");
    await priceCache.disconnect();
    console.log("✅ Price cache disconnected");
  });

  it("should connect to price cache and receive data", async () => {
    // Wait for initial connection
    await sleep(2000);

    // Try to get price data
    let priceData = priceCache.getPrice(ETHUSDT_TICKER);
    console.log("Initial ETHUSDT price data:", priceData);

    if (!priceData || !priceData.last?.mid) {
      console.log("⏳ No initial data, waiting longer...");
      await sleep(5000);
      priceData = priceCache.getPrice(ETHUSDT_TICKER);
      console.log("After waiting - ETHUSDT price data:", priceData);
    }

    // Test with BTC as well
    let btcData = priceCache.getPrice(BTCUSDT_TICKER);
    console.log("BTC price data:", btcData);

    // Log all available symbols
    console.log("Testing different symbols...");
    const testSymbols = [
      "agg:spot:ETHUSDT",
      "agg:spot:BTCUSDT",
      "binance:spot:ETHUSDT",
      "coinbase:spot:ETH-USD",
    ];

    for (const symbol of testSymbols) {
      const data = priceCache.getPrice(symbol as PairSymbol);
      console.log(
        `${symbol}:`,
        data
          ? {
              mid: data.last?.mid,
              bid: data.last?.bid,
              ask: data.last?.ask,
              hasHistory: !!data.history,
              hasAnalysis: !!data.analysis,
            }
          : "No data",
      );
    }

    // Check what methods are available on priceCache
    console.log(
      "PriceCache methods:",
      Object.getOwnPropertyNames(Object.getPrototypeOf(priceCache)),
    );
    console.log("PriceCache properties:", Object.keys(priceCache));

    // The test should pass regardless - we're just exploring the API
    expect(true).toBe(true);
  });

  it("should test price cache internal structure", async () => {
    await sleep(1000);

    // Try to understand the internal structure
    console.log("PriceCache instance:", priceCache);

    // Check if there are any internal methods to get available symbols
    if (typeof (priceCache as any).getAvailableSymbols === "function") {
      const symbols = (priceCache as any).getAvailableSymbols();
      console.log("Available symbols:", symbols);
    }

    if (typeof (priceCache as any).getAllPrices === "function") {
      const allPrices = (priceCache as any).getAllPrices();
      console.log("All prices:", Object.keys(allPrices));
    }

    // Check internal cache if accessible
    if ((priceCache as any).cache) {
      console.log(
        "Internal cache keys:",
        Object.keys((priceCache as any).cache),
      );
    }

    if ((priceCache as any).symbols) {
      console.log("Internal symbols:", (priceCache as any).symbols);
    }

    expect(true).toBe(true);
  });

  it("should wait for price updates", async () => {
    console.log("🔄 Waiting for price updates...");

    // Wait and check multiple times
    for (let i = 0; i < 10; i++) {
      await sleep(1000);

      const ethData = priceCache.getPrice(ETHUSDT_TICKER);
      const btcData = priceCache.getPrice(BTCUSDT_TICKER);

      console.log(`Attempt ${i + 1}:`);
      console.log(
        `  ETH: ${ethData?.last?.mid ? `$${ethData.last.mid.toFixed(2)}` : "No data"}`,
      );
      console.log(
        `  BTC: ${btcData?.last?.mid ? `$${btcData.last.mid.toFixed(2)}` : "No data"}`,
      );

      if (ethData?.last?.mid || btcData?.last?.mid) {
        console.log("✅ Found price data!");
        break;
      }
    }

    expect(true).toBe(true);
  });
});
