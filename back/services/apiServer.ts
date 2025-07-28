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
import { logger } from "@back/utils/logger";
import type { ApiServerConfig, ApiResponse } from "@common/types";
import { services } from "@common/types";

class ApiServer {
  private config: ApiServerConfig;
  private server: any;
  
  constructor() {
    this.config = getServiceConfig("apiServer");
  }
  
  async start() {
    const port = this.config.port || 40005;
    
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
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": this.config.corsOrigins?.join(", ") || "*",
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
        if (service.id === "api") {
          return { ...service, status: "UP", latencyMs: 0 };
        }
        
        // Check other services by pinging their endpoints
        // This is a simplified version - in production you'd have proper health checks
        return { ...service, status: "UNKNOWN" };
      })
    );
    
    return this.jsonResponse({ success: true, data: statuses }, headers);
  }
  
  private async handleGetTickers(headers: any): Promise<Response> {
    // Get configuration for tickers 
    const config = getConfig();
    const tickerConfigs = config.services?.collector?.tickers || {};
    
    // Get live data from memory
    const activeTickersData = getActiveTickersFromMemory();
    
    // Combine config with live data like bet-bot does
    const feeds = Object.entries(tickerConfigs).map(([symbol, config]) => ({
      symbol,
      config,
      last: activeTickersData[symbol]?.last || null,
      history: activeTickersData[symbol]?.history || { ts: [], o: [], h: [], l: [], c: [], v: [] },
      analysis: activeTickersData[symbol]?.analysis || null,
    }));
    
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