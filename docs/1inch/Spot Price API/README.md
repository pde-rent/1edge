# 1inch Spot Price API Documentation

Welcome to the 1inch Spot Price API documentation. This API provides real-time cryptocurrency price data across multiple blockchain networks, aggregated from various decentralized exchanges.

## Quick Navigation

### Getting Started

- **[Overview](overview.md)** - Complete API overview with features and architecture
- **[Quickstart Guide](quickstart.md)** - Get up and running in minutes with examples

### API Reference

- **[Get All Prices](api-reference/get-all-prices.md)** - Retrieve prices for all whitelisted tokens
- **[Get Prices by Tokens](api-reference/get-prices-by-tokens.md)** - Get prices for specific tokens (single or batch)
- **[Get All Currencies](api-reference/get-all-currencies.md)** - List available base currencies

## Key Features

- **Multi-chain Support**: Ethereum, Polygon, BSC, Arbitrum, and more
- **Real-time Pricing**: Low-latency price feeds from aggregated DEX sources
- **Batch Requests**: Query multiple tokens efficiently in single API calls
- **Currency Flexibility**: Prices in USD, EUR, ETH, BTC, and other currencies
- **High Availability**: Enterprise-grade infrastructure with 99.9% uptime

## Common Use Cases

| Use Case            | Best Endpoint                                         | Example                     |
| ------------------- | ----------------------------------------------------- | --------------------------- |
| Portfolio valuation | [Batch Prices](api-reference/get-prices-by-tokens.md) | Get prices for all holdings |
| Single token lookup | [Single Price](api-reference/get-prices-by-tokens.md) | Current WETH price          |
| Market overview     | [All Prices](api-reference/get-all-prices.md)         | All Ethereum token prices   |
| Price alerts        | [Batch Prices](api-reference/get-prices-by-tokens.md) | Monitor specific tokens     |
| Currency conversion | [Currencies](api-reference/get-all-currencies.md)     | Get available currencies    |

## Supported Networks

| Network   | Chain ID | Native Token | Status |
| --------- | -------- | ------------ | ------ |
| Ethereum  | 1        | ETH          | Active |
| Polygon   | 137      | MATIC        | Active |
| BSC       | 56       | BNB          | Active |
| Arbitrum  | 42161    | ETH          | Active |
| Optimism  | 10       | ETH          | Active |
| Avalanche | 43114    | AVAX         | Active |

## Quick Start

### 1. Get Your API Key

Sign up at the [1inch Developer Portal](https://portal.1inch.dev/) to obtain your API key.

### 2. Make Your First Request

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 3. Integrate with Your Application

```javascript
const response = await fetch(
  "https://api.1inch.dev/price/v1.1/1/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  {
    headers: { Authorization: "Bearer YOUR_API_KEY" },
  },
);
const price = await response.json();
console.log("WETH Price:", price);
```

## Rate Limits

| Plan       | Requests/Min | Daily Limit | Batch Size |
| ---------- | ------------ | ----------- | ---------- |
| Free       | 100          | 10,000      | 50 tokens  |
| Pro        | 1,000        | 100,000     | 200 tokens |
| Enterprise | Custom       | Custom      | Custom     |

## Documentation Structure

```
docs/1inch/Spot Price API/
├── README.md                    # This file - main navigation
├── overview.md                  # Complete API overview
├── quickstart.md               # Getting started guide
└── api-reference/
    ├── get-all-prices.md       # Get all token prices
    ├── get-prices-by-tokens.md # Get specific token prices
    └── get-all-currencies.md   # Get available currencies
```

## Examples by Programming Language

### JavaScript/Node.js

- [Portfolio tracker example](quickstart.md#complete-example-portfolio-tracker)
- [Price monitoring system](api-reference/get-all-prices.md#price-monitoring)
- [Batch price requests](api-reference/get-prices-by-tokens.md#multiple-tokens-post)

### Python

- [Basic price fetching](api-reference/get-all-prices.md#python-requests)
- [Batch token prices](api-reference/get-prices-by-tokens.md#python-requests)
- [Currency support](api-reference/get-all-currencies.md#python-requests)

### Go

- [Token price client](api-reference/get-all-prices.md#go)
- [Batch processing](api-reference/get-prices-by-tokens.md#go)
- [Error handling patterns](api-reference/get-all-currencies.md#go)

### cURL

- [Command line examples](quickstart.md#test-your-connection)
- [API testing scripts](api-reference/get-all-prices.md#curl)

## Best Practices

### Performance Optimization

1. **Use Batch Requests**: Query multiple tokens in single API calls
2. **Implement Caching**: Cache responses for 30-60 seconds to reduce calls
3. **Handle Rate Limits**: Implement exponential backoff for retry logic

### Error Handling

1. **Check Response Status**: Always validate HTTP status codes
2. **Handle Missing Tokens**: Not all tokens may be available
3. **Implement Fallbacks**: Use backup currencies when preferred isn't available

### Security

1. **Protect API Keys**: Never expose keys in client-side code
2. **Use Environment Variables**: Store keys securely in production
3. **Monitor Usage**: Track API usage to avoid unexpected charges

## Related APIs

- **[1inch Orderbook API](/docs/1inch/Orderbook%20API/)** - Access limit order data
- **[1edge Platform](/docs/1edge/)** - Trading and analytics platform
- **[1inch Fusion API](https://docs.1inch.io/)** - Advanced trading features

## Support and Community

### Documentation

- [1inch Official Docs](https://docs.1inch.io/)
- [Developer Portal](https://portal.1inch.dev/)
- [API Status Page](https://status.1inch.dev/)

### Community

- [Discord Server](https://discord.gg/1inch)
- [Telegram Channel](https://t.me/one_edge)
- [GitHub Repositories](https://github.com/1inch)

### Support Channels

- **Technical Issues**: [Developer Portal Support](https://portal.1inch.dev/support)
- **API Questions**: [Discord #developers](https://discord.gg/1inch)
- **Integration Help**: [Documentation Issues](https://github.com/1inch/1inch-docs/issues)

## Recent Updates

- **2025-01-15**: Enhanced batch request limits for Pro tier users
- **2024-12-20**: Added support for Avalanche (Chain ID: 43114)
- **2024-11-30**: Improved price aggregation algorithm for better accuracy
- **2024-11-15**: New currency support: JPY, GBP for major trading pairs

---

For the most up-to-date information, visit the [1inch Developer Portal](https://portal.1inch.dev/) or check the [official documentation](https://docs.1inch.io/).
