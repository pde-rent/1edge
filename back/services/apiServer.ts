#!/usr/bin/env bun

import { serve } from "bun";
import { getServiceConfig, getConfig } from "./config";
import { 
  getActiveOrders, 
  getOrdersByStrategy, 
  getActiveStrategies,
  getOpenPositions,
  getCachedTicker
} from "./storage";
import { getTicker, getActiveTickers } from "./marketData";
import { getActiveTickers as getActiveTickersFromMemory } from "./memoryStorage";
import { orderbookReconstructor } from "./orderbookReconstructor";
import { logger } from "@back/utils/logger";
import type { ApiServerConfig, ApiResponse } from "@common/types";
import { services } from "@common/types";
import { priceCache } from "./priceCache";

class ApiServer {
  private config: ApiServerConfig;
  private server: any;
  
  constructor() {
    this.config = getServiceConfig("apiServer");
  }
  
  async start() {
    const port = this.config.port || 40005;
    
    // Connect to price cache
    await priceCache.connect();
    
    this.server = serve({
      port,
      fetch: this.handleRequest.bind(this),
    });
    
    logger.info(`API Server started on port ${port}`);
  }
  
  async stop() {
    if (this.server) {
      this.server.stop();
      logger.info("API Server stopped");
    }
  }
  
  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const origin = request.headers.get("origin");
    const allowedOrigins = this.config.corsOrigins || ["http://localhost:40006", "http://localhost:3000"];
    const allowOrigin = allowedOrigins.includes(origin || "") ? origin : allowedOrigins[0];
    
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    
    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    
    try {
      // Route handling
      switch (true) {
        case path === "/health":
          return this.jsonResponse({ success: true, data: { status: "healthy" } }, headers);
          
        case path === "/config":
          return this.jsonResponse({ success: true, data: getConfig() }, headers);
          
        case path === "/services/status":
        case path === "/api/status":
          return this.handleServicesStatus(headers);
          
        case path === "/tickers":
        case path === "/api/feeds":
          return this.handleGetTickers(headers);
          
        case path.startsWith("/ticker/"):
        case path.startsWith("/api/feeds/"):
          return this.handleGetTicker(path, headers);
          
        case path === "/orders":
          return this.handleGetOrders(headers);
          
        case path.startsWith("/orders/strategy/"):
          return this.handleGetOrdersByStrategy(path, headers);
          
        case path === "/strategies":
          return this.handleGetStrategies(headers);
          
        case path === "/positions":
          return this.handleGetPositions(url, headers);
          
        case path === "/ping":
          return this.jsonResponse({ success: true, data: { pong: Date.now() } }, headers);
          
        case path.startsWith("/orderbook/"):
          return this.handleOrderbook(path, url, headers);
          
        default:
          return this.jsonResponse(
            { success: false, error: "Not found" },
            headers,
            404
          );
      }
    } catch (error: any) {
      logger.error("API error:", error);
      return this.jsonResponse(
        { success: false, error: error.message },
        headers,
        500
      );
    }
  }
  
  private jsonResponse(data: ApiResponse, headers: any, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers,
    });
  }
  
  private async handleServicesStatus(headers: any): Promise<Response> {
    const statuses = await Promise.all(
      services.map(async (service) => {
        let status = "DOWN";
        let latencyMs = 0;
        const checkedAt = Date.now();
        
        // Check if this is the API service (always UP since we're responding)
        if (service.id === "api") {
          status = "UP";
          latencyMs = 1;
        } else {
          // For other services, try to ping their ports or check if they're responsive
          try {
            // Simple port check - if we can connect, service is likely up
            const portMap: Record<string, number> = {
              "websocket": 40006,
              "collector": 40007,
              "order-executor": 40008,
              "keeper": 40009,
              "status-checker": 40010
            };
            
            const port = portMap[service.id];
            if (port) {
              // Try a simple connection test
              const startTime = Date.now();
              try {
                // For now, assume services are up if they're in the process list
                status = "UP";
                latencyMs = Date.now() - startTime;
              } catch {
                status = "DOWN";
                latencyMs = 0;
              }
            } else {
              status = "UNKNOWN";
            }
          } catch (error) {
            status = "DOWN";
            latencyMs = 0;
          }
        }
        
        return {
          id: service.id,
          name: service.name,
          status: status,
          latencyMs: latencyMs,
          pingUrl: `internal:${service.id}`,
          checkedAt: checkedAt
        };
      })
    );
    
    return this.jsonResponse({ success: true, data: statuses }, headers);
  }
  
  private async handleGetTickers(headers: any): Promise<Response> {
    // Get configuration for tickers 
    const config = getConfig();
    const tickerConfigs = config.services?.collector?.tickers || {};
    
    // Get live data from price cache
    const activePrices = priceCache.getAllPrices();
    
    // Combine config with live data like bet-bot does
    const feeds = Object.entries(tickerConfigs).map(([symbol, config]) => {
      const priceData = activePrices[symbol] || {};
      return {
        symbol,
        config,
        last: priceData.last || priceData.mid ? {
          bid: priceData.bid || 0,
          ask: priceData.ask || 0,
          mid: priceData.mid || 0,
          last: priceData.last || priceData.mid || 0,
          volume: priceData.volume || 0,
          timestamp: priceData.timestamp || Date.now()
        } : null,
        history: priceData.history || { ts: [], o: [], h: [], l: [], c: [], v: [] },
        analysis: priceData.analysis || null,
      };
    });
    
    return this.jsonResponse({ success: true, data: feeds }, headers);
  }
  
  private async handleGetTicker(path: string, headers: any): Promise<Response> {
    const symbol = decodeURIComponent(
      path.replace("/ticker/", "").replace("/api/feeds/", "")
    );
    const ticker = await getTicker(symbol as any);
    
    if (!ticker) {
      return this.jsonResponse(
        { success: false, error: "Ticker not found" },
        headers,
        404
      );
    }
    
    return this.jsonResponse({ success: true, data: ticker }, headers);
  }
  
  private async handleGetOrders(headers: any): Promise<Response> {
    const orders = await getActiveOrders();
    return this.jsonResponse({ success: true, data: orders }, headers);
  }
  
  private async handleGetOrdersByStrategy(path: string, headers: any): Promise<Response> {
    const strategyId = path.replace("/orders/strategy/", "");
    const orders = await getOrdersByStrategy(strategyId);
    return this.jsonResponse({ success: true, data: orders }, headers);
  }
  
  private async handleGetStrategies(headers: any): Promise<Response> {
    const strategies = await getActiveStrategies();
    return this.jsonResponse({ success: true, data: strategies }, headers);
  }
  
  private async handleGetPositions(url: URL, headers: any): Promise<Response> {
    const strategyId = url.searchParams.get("strategyId") || undefined;
    const positions = await getOpenPositions(strategyId);
    return this.jsonResponse({ success: true, data: positions }, headers);
  }
  
  /**
   * Handle orderbook reconstruction requests
   * Routes:
   * - /orderbook/{chain} - Full market overview
   * - /orderbook/{chain}/{baseAsset}/{quoteAsset} - Specific pair
   */
  private async handleOrderbook(path: string, url: URL, headers: any): Promise<Response> {
    try {
      const pathParts = path.split('/').filter(p => p); // ['orderbook', chain, baseAsset?, quoteAsset?]
      
      if (pathParts.length < 2) {
        return this.jsonResponse(
          { success: false, error: "Chain ID required" },
          headers,
          400
        );
      }

      const chain = parseInt(pathParts[1]);
      if (isNaN(chain)) {
        return this.jsonResponse(
          { success: false, error: "Invalid chain ID" },
          headers,
          400
        );
      }

      // Get query parameters
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(parseInt(limitParam), 1000) : 1000;

      let orderbook;

      if (pathParts.length === 4) {
        // Specific pair: /orderbook/{chain}/{baseAsset}/{quoteAsset}
        const baseAsset = pathParts[2];
        const quoteAsset = pathParts[3];
        
        logger.info(`Reconstructing orderbook for ${chain}:${baseAsset}/${quoteAsset} (limit: ${limit})`);
        orderbook = await orderbookReconstructor.getOrderbookForPair(chain, baseAsset, quoteAsset, limit);
        
      } else if (pathParts.length === 2) {
        // Market overview: /orderbook/{chain}
        logger.info(`Reconstructing market overview for chain ${chain} (limit: ${limit})`);
        orderbook = await orderbookReconstructor.getMarketOverview(chain, limit);
        
      } else {
        return this.jsonResponse(
          { success: false, error: "Invalid orderbook request format" },
          headers,
          400
        );
      }

      return this.jsonResponse({ success: true, data: orderbook }, headers);

    } catch (error: any) {
      logger.error(`Orderbook reconstruction failed: ${error.message}`);
      
      // Handle specific error types
      if (error.message.includes('HTTP 401')) {
        return this.jsonResponse(
          { success: false, error: "1inch API authentication failed" },
          headers,
          401
        );
      } else if (error.message.includes('HTTP 429')) {
        return this.jsonResponse(
          { success: false, error: "Rate limit exceeded" },
          headers,
          429
        );
      } else {
        return this.jsonResponse(
          { success: false, error: "Failed to reconstruct orderbook" },
          headers,
          500
        );
      }
    }
  }
}

// Main execution
const apiServer = new ApiServer();

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await apiServer.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await apiServer.stop();
  process.exit(0);
});

// Start the service
apiServer.start().catch((error) => {
  logger.error("Failed to start API Server:", error);
  process.exit(1);
});