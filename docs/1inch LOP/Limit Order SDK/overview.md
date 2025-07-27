# 1inch Limit Order SDK Overview

The 1inch Limit Order SDK is a comprehensive JavaScript/TypeScript library for interacting with the 1inch Limit Order Protocol v4. It provides all the necessary tools to create, sign, and manage limit orders programmatically.

## Key Features

- **Order Creation**: Build limit orders with customizable parameters
- **EIP-712 Signing**: Sign orders using the Ethereum standard for typed data
- **Orderbook Integration**: Submit and query orders through the 1inch Orderbook API
- **TypeScript Support**: Full type definitions for enhanced developer experience
- **Multiple HTTP Providers**: Support for Fetch and Axios HTTP connectors

## Core Components

### Orders
- **LimitOrder**: Standard limit order with full feature support
- **RfqOrder**: Lightweight request-for-quote orders optimized for market makers
- **LimitOrderWithFee**: Extended orders with integrated fee mechanisms

### Traits
- **MakerTraits**: Configure order behavior (partial fills, expiration, etc.)
- **TakerTraits**: Define taker preferences and execution parameters

### API Integration
- **Sdk**: High-level interface for order management
- **Api**: Direct access to Orderbook API endpoints
- **HttpProviderConnector**: Pluggable HTTP client support

## Use Cases

1. **DEX Integration**: Build decentralized exchanges with limit order functionality
2. **Trading Bots**: Create automated trading strategies with precise price control
3. **Market Making**: Deploy efficient market-making strategies using RFQ orders
4. **Portfolio Management**: Execute trades at specific price targets

## Getting Started

1. Install the SDK: `bun add '@1inch/limit-order-sdk'`
2. Review the [installation guide](./install.md) for setup instructions
3. Follow the [integration guide](./integration.md) to create your first order
4. Explore the [API reference](../limit-order-maker-contract.md) for detailed documentation

## Network Support

The SDK supports all networks where the 1inch Limit Order Protocol is deployed:
- Ethereum Mainnet
- Polygon
- BSC
- Arbitrum
- Optimism
- And more...

## Authentication

To submit orders to the 1inch Orderbook, you'll need an API key from the [1inch Developer Portal](https://portal.1inch.dev/).

## Next Steps

- [Installation Guide](./install.md) - Set up the SDK in your project
- [Integration Guide](./integration.md) - Learn how to create and sign orders
- [Contract Documentation](../limit-order-maker-contract.md) - Understand the underlying protocol