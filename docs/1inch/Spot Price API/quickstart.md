# Quickstart Guide

Get started with the 1inch Spot Price API in minutes. This guide will walk you through the basic setup and common usage patterns.

## Prerequisites

- API Key from [1inch Developer Portal](https://portal.1inch.dev/)
- Basic knowledge of REST APIs
- HTTP client (cURL, Postman, or your preferred programming language)

## Quick Setup

### 1. Obtain Your API Key

1. Visit the [1inch Developer Portal](https://portal.1inch.dev/)
2. Create an account or sign in
3. Generate a new API key for the Spot Price API
4. Copy and securely store your API key

### 2. Test Your Connection

Use cURL to verify your API key works:

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1" \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

**Expected Response:**

```json
{
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "3500.123456789",
  "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7": "1.987654321",
  "..."
}
```

## Common Usage Patterns

### Get All Token Prices

Retrieve prices for all whitelisted tokens on Ethereum:

```javascript
const axios = require("axios");

async function getAllPrices() {
  const response = await axios.get("https://api.1inch.dev/price/v1.1/1", {
    headers: {
      Authorization: "Bearer YOUR_API_KEY_HERE",
    },
  });

  console.log("All token prices:", response.data);
  return response.data;
}

getAllPrices();
```

### Get Specific Token Price

Get the price for a single token (e.g., WETH):

```javascript
async function getSingleTokenPrice() {
  const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

  const response = await axios.get(
    `https://api.1inch.dev/price/v1.1/1/${wethAddress}?currency=USD`,
    {
      headers: {
        Authorization: "Bearer YOUR_API_KEY_HERE",
      },
    },
  );

  console.log("WETH price:", response.data);
  return response.data;
}

getSingleTokenPrice();
```

### Batch Price Requests

Get prices for multiple specific tokens in one request:

```javascript
async function getBatchPrices() {
  const tokens = [
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", // USDC
    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  ];

  const response = await axios.post(
    "https://api.1inch.dev/price/v1.1/1",
    {
      tokens: tokens,
      currency: "USD",
    },
    {
      headers: {
        Authorization: "Bearer YOUR_API_KEY_HERE",
        "Content-Type": "application/json",
      },
    },
  );

  console.log("Batch prices:", response.data);
  return response.data;
}

getBatchPrices();
```

### Multi-Chain Price Fetching

Get prices from different blockchain networks:

```javascript
async function getMultiChainPrices() {
  const chains = [
    { id: 1, name: "Ethereum" },
    { id: 137, name: "Polygon" },
    { id: 56, name: "BSC" },
  ];

  const results = {};

  for (const chain of chains) {
    try {
      const response = await axios.get(
        `https://api.1inch.dev/price/v1.1/${chain.id}`,
        {
          headers: {
            Authorization: "Bearer YOUR_API_KEY_HERE",
          },
        },
      );

      results[chain.name] = response.data;
    } catch (error) {
      console.error(`Error fetching prices for ${chain.name}:`, error.message);
    }
  }

  return results;
}

getMultiChainPrices();
```

## Complete Example: Portfolio Tracker

Here's a complete example that tracks a portfolio value:

```javascript
const axios = require("axios");

class Portfolio {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.1inch.dev/price/v1.1";
    this.holdings = new Map();
  }

  // Add a token holding to the portfolio
  addHolding(tokenAddress, amount, chainId = 1) {
    const key = `${chainId}-${tokenAddress.toLowerCase()}`;
    this.holdings.set(key, {
      tokenAddress: tokenAddress.toLowerCase(),
      amount: parseFloat(amount),
      chainId,
    });
  }

  // Get current prices for all holdings
  async getCurrentPrices() {
    const pricesByChain = new Map();

    // Group holdings by chain
    for (const [key, holding] of this.holdings) {
      if (!pricesByChain.has(holding.chainId)) {
        pricesByChain.set(holding.chainId, []);
      }
      pricesByChain.get(holding.chainId).push(holding.tokenAddress);
    }

    const allPrices = new Map();

    // Fetch prices for each chain
    for (const [chainId, tokens] of pricesByChain) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/${chainId}`,
          {
            tokens: tokens,
            currency: "USD",
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
          },
        );

        // Store prices with chain prefix
        for (const [address, price] of Object.entries(response.data)) {
          allPrices.set(`${chainId}-${address}`, parseFloat(price));
        }
      } catch (error) {
        console.error(
          `Error fetching prices for chain ${chainId}:`,
          error.message,
        );
      }
    }

    return allPrices;
  }

  // Calculate total portfolio value
  async getTotalValue() {
    const prices = await this.getCurrentPrices();
    let totalValue = 0;

    for (const [key, holding] of this.holdings) {
      const price = prices.get(key);
      if (price) {
        const value = holding.amount * price;
        totalValue += value;
        console.log(
          `${holding.tokenAddress}: ${holding.amount} tokens @ $${price} = $${value.toFixed(2)}`,
        );
      } else {
        console.warn(
          `No price found for ${holding.tokenAddress} on chain ${holding.chainId}`,
        );
      }
    }

    return totalValue;
  }
}

// Usage example
async function main() {
  const portfolio = new Portfolio("YOUR_API_KEY_HERE");

  // Add some holdings (token address, amount, chain ID)
  portfolio.addHolding("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 1.5, 1); // 1.5 WETH on Ethereum
  portfolio.addHolding("0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", 1000, 1); // 1000 USDC on Ethereum
  portfolio.addHolding("0x2791bca1f2de4661ed88a30c99a7a9449aa84174", 500, 137); // 500 USDC on Polygon

  const totalValue = await portfolio.getTotalValue();
  console.log(`\nTotal Portfolio Value: $${totalValue.toFixed(2)}`);
}

main().catch(console.error);
```

## Error Handling Best Practices

Always implement proper error handling:

```javascript
async function robustPriceRequest(tokenAddress, chainId = 1, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(
        `https://api.1inch.dev/price/v1.1/${chainId}/${tokenAddress}`,
        {
          headers: {
            Authorization: "Bearer YOUR_API_KEY_HERE",
          },
          timeout: 5000, // 5 second timeout
        },
      );

      return response.data;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message);

      if (attempt === retries) {
        throw new Error(
          `Failed to fetch price after ${retries} attempts: ${error.message}`,
        );
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

## Rate Limiting

Implement rate limiting to stay within API limits:

```javascript
class RateLimitedPriceClient {
  constructor(apiKey, requestsPerMinute = 100) {
    this.apiKey = apiKey;
    this.requestQueue = [];
    this.requestTimes = [];
    this.maxRequests = requestsPerMinute;

    // Process queue every second
    setInterval(() => this.processQueue(), 1000);
  }

  async getPrice(tokenAddress, chainId = 1) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        tokenAddress,
        chainId,
        resolve,
        reject,
        timestamp: Date.now(),
      });
    });
  }

  async processQueue() {
    if (this.requestQueue.length === 0) return;

    // Clean old request times (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;
    this.requestTimes = this.requestTimes.filter((time) => time > oneMinuteAgo);

    // Check if we can make more requests
    if (this.requestTimes.length >= this.maxRequests) {
      return; // Rate limit reached, wait for next cycle
    }

    const request = this.requestQueue.shift();
    this.requestTimes.push(Date.now());

    try {
      const response = await axios.get(
        `https://api.1inch.dev/price/v1.1/${request.chainId}/${request.tokenAddress}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );
      request.resolve(response.data);
    } catch (error) {
      request.reject(error);
    }
  }
}
```

## Environment Setup

Create a `.env` file for your API configuration:

```bash
# .env file
ONEINCH_API_KEY=your_api_key_here
DEFAULT_CHAIN_ID=1
CACHE_TTL=30000
```

```javascript
// config.js
require("dotenv").config();

module.exports = {
  apiKey: process.env.ONEINCH_API_KEY,
  defaultChainId: parseInt(process.env.DEFAULT_CHAIN_ID) || 1,
  cacheTtl: parseInt(process.env.CACHE_TTL) || 30000,
};
```

## Next Steps

Now that you're familiar with the basics:

1. **Explore Advanced Features**: Check out the [API Reference](api-reference/) for detailed endpoint documentation
2. **Implement Caching**: Add Redis or in-memory caching for better performance
3. **Add Monitoring**: Set up logging and monitoring for production use
4. **Scale Your Integration**: Consider batch processing and connection pooling

## Troubleshooting

### Common Issues

**Invalid API Key Error (401)**

- Verify your API key is correct
- Check that you're using the Bearer token format
- Ensure your API key has the necessary permissions

**Rate Limit Exceeded (429)**

- Implement request throttling
- Consider upgrading your API plan
- Add retry logic with exponential backoff

**Token Not Found (404)**

- Verify the token address is correct and checksummed
- Check if the token is whitelisted on the specified chain
- Ensure you're using the correct chain ID

**Network Timeout**

- Implement connection timeouts
- Add retry logic for transient failures
- Consider using connection pooling

### Getting Help

- [API Reference Documentation](api-reference/)
- [1inch Developer Portal](https://portal.1inch.dev/)
- [Community Discord](https://discord.gg/1inch)
