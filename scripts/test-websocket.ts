#!/usr/bin/env bun

import WebSocket from 'ws';

// Test WebSocket client
const ws = new WebSocket('ws://localhost:40006/ws');

ws.on('open', () => {
  console.log('🔌 Connected to WebSocket server');
  
  // Subscribe to BTC and ETH tickers
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbols: ['agg:spot:BTCUSDC', 'agg:spot:ETHUSDC']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  switch (message.type) {
    case 'connected':
      console.log('✅ Server says:', message.message);
      console.log('📊 Available symbols:', message.availableSymbols);
      break;
      
    case 'subscribed':
      console.log('📡 Subscribed to:', message.symbols);
      break;
      
    case 'price_update':
      console.log(`💰 ${message.symbol}: $${message.data.mid} (bid: ${message.data.bid}, ask: ${message.data.ask})`);
      break;
      
    default:
      console.log('📨 Message:', message);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('🔌 Disconnected from WebSocket server');
});

// Keep the script running
process.on('SIGINT', () => {
  console.log('\n🛑 Closing connection...');
  ws.close();
  process.exit(0);
});