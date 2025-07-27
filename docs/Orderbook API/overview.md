# 1inch Orderbook API Overview

The 1inch Orderbook API is a RESTful service that provides access to limit orders created through the 1inch Limit Order Protocol. It serves as a centralized discovery mechanism for orders while maintaining the decentralized execution nature of the protocol.

## Purpose

The Orderbook API bridges the gap between off-chain order creation and on-chain execution by:
- Storing signed limit orders submitted by makers
- Providing endpoints for takers and resolvers to discover orders
- Tracking order status and execution events
- Enabling efficient order matching and price discovery

## Key Features

### Order Management
- **Submit Orders**: Store signed orders for discovery by takers
- **Query Orders**: Search orders by various criteria (maker, assets, status)
- **Order Status**: Track order lifecycle from creation to completion

### Event Tracking
- **Fill Events**: Monitor partial and complete order fills
- **Cancel Events**: Track order cancellations
- **Real-time Updates**: Stay informed of order state changes

### Market Data
- **Active Pairs**: Discover trading pairs with active orders
- **Order Counts**: Get statistics on order distribution
- **Market Depth**: Analyze liquidity across different price levels

## API Endpoints

### Order Operations
- `POST /{chain}` - Submit a new order
- `GET /{chain}/all` - Get all orders with filters
- `GET /{chain}/order/{orderHash}` - Get specific order details
- `GET /{chain}/address/{address}` - Get orders by maker address

### Event Endpoints
- `GET /{chain}/events` - Get all order events
- `GET /{chain}/events/{orderHash}` - Get events for specific order

### Market Information
- `GET /{chain}/unique-active-pairs` - Get active trading pairs
- `GET /{chain}/count` - Get order count with filters

## Authentication

All API requests require authentication using an API key obtained from the [1inch Developer Portal](https://portal.1inch.dev/). Include the key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Rate Limits

The API implements rate limiting to ensure fair usage. Current limits:
- 10 requests per second per API key
- 1000 requests per minute per API key

## Response Format

All responses are in JSON format with consistent structure:
- Successful responses return requested data
- Error responses include status code and error message

## Network Support

The API supports multiple blockchain networks. Use the appropriate chain ID in the endpoint path:
- `1` - Ethereum Mainnet
- `137` - Polygon
- `56` - BSC
- `42161` - Arbitrum
- `10` - Optimism

## Next Steps

- [Quickstart Guide](./quickstart.md) - Get started with the API
- [API Reference](./api-reference/) - Detailed endpoint documentation
- [SDK Integration](../1inch LOP/Limit Order SDK/install.md) - Use the JavaScript SDK