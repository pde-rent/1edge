#!/usr/bin/env bun

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { getConfig } from './config';
import { getTicker, getActiveTickers } from './marketData';
import { logger } from '@back/utils/logger';
import type { Symbol, AggregatedTicker, TickerFeed } from '@common/types';
import { ZMQ_PRICE_FEED_PORT } from '@common/constants';
import * as zmq from 'zeromq';
import { priceCache } from './priceCache';

interface ClientSubscription {
  symbols: Set<Symbol>;
}

class WebSocketService {
  private server: any;
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientSubscription> = new Map();
  private port: number;
  private broadcastInterval: any;
  
  constructor() {
    const config = getConfig();
    this.port = config.services?.websocketServer?.port || 40007; // Default WebSocket server port
  }
  
  async start() {
    logger.info(`🚀 Starting WebSocket Server on port ${this.port}...`);
    
    // Connect to shared price cache
    await priceCache.connect();
    
    // Create HTTP server for WebSocket upgrade
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    // Handle WebSocket connections
    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Start HTTP server
    this.server.listen(this.port, () => {
      logger.info(`✅ WebSocket Server listening on ws://localhost:${this.port}/ws`);
    });
    
    // Start broadcasting price updates every 100ms
    this.startBroadcastLoop();
  }
  
  async stop() {
    logger.info('🛑 Stopping WebSocket Server...');
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    if (this.server) {
      this.server.close();
    }
    
    this.clients.clear();
    logger.info('✅ WebSocket Server stopped');
  }
  
  private startBroadcastLoop() {
    // Broadcast price updates every 100ms
    this.broadcastInterval = setInterval(() => {
      this.broadcastPriceUpdates();
    }, 100);
  }
  
  private broadcastPriceUpdates() {
    if (this.clients.size === 0) return;
    
    const activePrices = priceCache.getAllPrices();
    
    for (const [ws, client] of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      
      // Send updates for subscribed symbols
      for (const symbol of client.symbols) {
        const priceData = activePrices[symbol];
        if (priceData) {
          try {
            ws.send(JSON.stringify({
              type: 'price_update',
              symbol: symbol,
              data: priceData
            }));
          } catch (error) {
            logger.error(`❌ Error sending price update to client:`, error);
          }
        }
      }
    }
  }
  
  private handleConnection(ws: WebSocket) {
    logger.info(`🔌 New WebSocket client connected. Total clients: ${this.clients.size + 1}`);
    
    // Initialize client subscription
    this.clients.set(ws, {
      symbols: new Set()
    });
    
    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('❌ Error parsing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON format'
        }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info(`🔌 WebSocket client disconnected. Total clients: ${this.clients.size}`);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      logger.error('❌ WebSocket client error:', error);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      availableSymbols: priceCache.getAvailableSymbols()
    }));
  }
  
  private handleMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;
    
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, client, message.symbols);
        break;
        
      case 'unsubscribe':
        this.handleUnsubscribe(ws, client, message.symbols);
        break;
        
      case 'get_ticker':
        this.handleGetTicker(ws, message.symbol);
        break;
        
      case 'get_all_tickers':
        this.handleGetAllTickers(ws);
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  }
  
  private handleSubscribe(ws: WebSocket, client: ClientSubscription, symbols: Symbol[]) {
    if (!Array.isArray(symbols)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Symbols must be an array'
      }));
      return;
    }
    
    for (const symbol of symbols) {
      client.symbols.add(symbol);
    }
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      symbols: symbols,
      message: `Subscribed to ${symbols.length} symbol(s)`
    }));
    
    logger.debug(`📡 Client subscribed to: ${symbols.join(', ')}`);
  }
  
  private handleUnsubscribe(ws: WebSocket, client: ClientSubscription, symbols: Symbol[]) {
    if (!Array.isArray(symbols)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Symbols must be an array'
      }));
      return;
    }
    
    for (const symbol of symbols) {
      client.symbols.delete(symbol);
    }
    
    ws.send(JSON.stringify({
      type: 'unsubscribed',
      symbols: symbols,
      message: `Unsubscribed from ${symbols.length} symbol(s)`
    }));
    
    logger.debug(`🛑 Client unsubscribed from: ${symbols.join(', ')}`);
  }
  
  private async handleGetTicker(ws: WebSocket, symbol: Symbol) {
    try {
      const ticker = await getTicker(symbol);
      ws.send(JSON.stringify({
        type: 'ticker_data',
        symbol: symbol,
        data: ticker
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to get ticker for ${symbol}`
      }));
    }
  }
  
  private handleGetAllTickers(ws: WebSocket) {
    const tickers = priceCache.getAllPrices();
    ws.send(JSON.stringify({
      type: 'all_tickers',
      data: tickers
    }));
  }
  
  
  // Get connection stats
  getStats() {
    const totalSubscriptions = Array.from(this.clients.values())
      .reduce((sum, client) => sum + client.symbols.size, 0);
      
    return {
      connectedClients: this.clients.size,
      totalSubscriptions: totalSubscriptions,
      port: this.port
    };
  }
}

// Main execution
const wsServer = new WebSocketService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal');
  await wsServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal');
  await wsServer.stop();
  process.exit(0);
});

// Start the service
wsServer.start().catch((error) => {
  logger.error('Failed to start WebSocket Server:', error);
  process.exit(1);
});

export default wsServer;