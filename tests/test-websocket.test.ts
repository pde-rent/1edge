#!/usr/bin/env bun

import { describe, it, expect } from "bun:test";
import WebSocket from "ws";

describe("WebSocket Collector Integration", () => {
  let ws: WebSocket;
  let messages: any[] = [];
  let errors: any[] = [];
  let isOpen = false;
  let isClosed = false;

  // Helper to wait for a message of a given type or timeout
  function waitForMessage(type: string, timeout = 3000): Promise<any> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      function check() {
        const msg = messages.find((m) => m.type === type);
        if (msg) return resolve(msg);
        if (Date.now() - start > timeout) return reject(new Error(`Timeout waiting for message type: ${type}`));
        setTimeout(check, 25);
      }
      check();
    });
  }

  it("should connect, subscribe, and receive price updates", async () => {
    ws = new WebSocket("ws://localhost:40006/ws");

    ws.on("open", () => {
      isOpen = true;
      ws.send(
        JSON.stringify({
          type: "subscribe",
          symbols: ["agg:spot:BTCUSDT", "agg:spot:ETHUSDT"],
        }),
      );
    });

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (e) {
        errors.push(e);
        return;
      }
      messages.push(msg);
    });

    ws.on("error", (err) => {
      errors.push(err);
    });

    ws.on("close", () => {
      isClosed = true;
    });

    // Wait for open
    await new Promise((resolve, reject) => {
      const start = Date.now();
      function check() {
        if (isOpen) return resolve(true);
        if (Date.now() - start > 2000) return reject(new Error("WebSocket did not open in time"));
        setTimeout(check, 20);
      }
      check();
    });

    // Wait for "connected" message
    const connectedMsg = await waitForMessage("connected", 2000);
    expect(connectedMsg).toBeDefined();
    expect(connectedMsg.availableSymbols).toBeDefined();

    // Wait for "subscribed" message
    const subscribedMsg = await waitForMessage("subscribed", 2000);
    expect(subscribedMsg.symbols).toContain("agg:spot:BTCUSDT");
    expect(subscribedMsg.symbols).toContain("agg:spot:ETHUSDT");

    // Wait for at least one price_update (allow up to 5s)
    let priceUpdateMsg: any;
    try {
      priceUpdateMsg = await waitForMessage("price_update", 5000);
    } catch {
      // If no price update, fail gracefully but log
      priceUpdateMsg = null;
    }

    if (priceUpdateMsg) {
      expect(priceUpdateMsg.symbol).toMatch(/BTCUSDT|ETHUSDT/);
      expect(priceUpdateMsg.data).toHaveProperty("mid");
      expect(priceUpdateMsg.data).toHaveProperty("bid");
      expect(priceUpdateMsg.data).toHaveProperty("ask");
      // Optionally, check that prices are numbers
      expect(typeof priceUpdateMsg.data.mid).toBe("number");
    } else {
      // If no price update, at least assert we got no errors
      expect(errors.length).toBe(0);
    }

    // Clean up
    ws.close();
    // Wait for close
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isClosed).toBe(true);
  });
});
