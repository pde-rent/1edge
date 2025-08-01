# Get All Prices

Retrieve current prices for all whitelisted tokens on a specific blockchain network.

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#f8f9fa','primaryTextColor':'#212529','primaryBorderColor':'#6c757d','lineColor':'#6c757d','sectionBkgColor':'transparent','altSectionBkgColor':'transparent','gridColor':'#dee2e6','secondaryColor':'#e9ecef','tertiaryColor':'#f8f9fa'}}}%%
graph LR
    subgraph "Request Flow"
        CLIENT[Client Request] --> API[1inch Price API]
        API --> CACHE[Price Cache]
        CACHE --> AGG[Price Aggregator]
        AGG --> SOURCES[DEX Price Sources]
    end

    subgraph "Response Flow"
        SOURCES --> AGG2[Aggregate & Normalize]
        AGG2 --> VALIDATE[Validate Prices]
        VALIDATE --> CACHE2[Update Cache]
        CACHE2 --> RESPONSE[JSON Response]
        RESPONSE --> CLIENT2[Client]
    end
```

## Endpoint

```
GET https://api.1inch.dev/price/v1.1/{chain}
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, 56 for BSC, etc.) |

### Query Parameters

This endpoint accepts no query parameters. All whitelisted tokens for the specified chain are returned.

## Authentication

All requests require authentication using a Bearer token in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

## Request Examples

### cURL

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1" \
  -H "Authorization: Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu" \
  -H "Accept: application/json"
```

### JavaScript (axios)

```javascript
const axios = require("axios");

async function getAllPrices() {
  const url = "https://api.1inch.dev/price/v1.1/1";

  const config = {
    headers: {
      Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu",
      Accept: "application/json"
    }
  };

  try {
    const response = await axios.get(url, config);
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching prices:", error.response?.data || error.message);
    throw error;
  }
}

getAllPrices();
```

### Python (requests)

```python
import requests

def get_all_prices(chain_id=1, api_key="T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu"):
    url = f"https://api.1inch.dev/price/v1.1/{chain_id}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching prices: {e}")
        raise

# Usage
prices = get_all_prices()
print(prices)
```

### Go

```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

func getAllPrices(chainID int, apiKey string) (map[string]string, error) {
    url := fmt.Sprintf("https://api.1inch.dev/price/v1.1/%d", chainID)
    
    req, err := http.NewRequest("GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Accept", "application/json")
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    var prices map[string]string
    err = json.Unmarshal(body, &prices)
    return prices, err
}

func main() {
    prices, err := getAllPrices(1, "T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu")
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Retrieved %d token prices\n", len(prices))
}
```

## Response

### Success Response (200)

Returns a JSON object where each key is a token contract address (lowercase, with `0x` prefix) and each value is the current price as a string.

### Response Schema

| Field | Type | Description |
|-------|------|-------------|
| `{tokenAddress}` | `string` | Price of the token in USD (default currency) |

### Example Response

```json
{
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "3456.789123456789",
  "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7": "1.000123456789",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "0.999876543210",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "12.345678901234",
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "89.123456789012",
  "0x59d9356e565ab3a36dd77763fc0d87feaf85508c": "0.000258695490709856"
}
```

**Response Format Notes:**
- All token addresses are returned in lowercase
- Prices are strings to preserve decimal precision
- Prices are denominated in USD by default
- Only whitelisted tokens are included in the response

## Common Token Addresses

Here are some commonly requested token addresses for reference:

### Ethereum (Chain ID: 1)

| Token | Symbol | Address |
|-------|--------|---------|
| Wrapped Ether | WETH | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` |
| USD Coin | USDC | `0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7` |
| Dai Stablecoin | DAI | `0x6b175474e89094c44da98b954eedeac495271d0f` |
| Uniswap | UNI | `0x1f9840a85d5af5bf1d1762f925bdaddc4201f984` |
| Aave | AAVE | `0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9` |
| 1INCH Token | 1INCH | `0x111111111117dc0aa78b770fa6a738034120c302` |

## Error Responses

### 400 Bad Request

Invalid chain ID or malformed request.

```json
{
  "error": "Invalid chain ID",
  "description": "Chain ID must be a positive integer",
  "statusCode": 400
}
```

### 401 Unauthorized  

Invalid or missing API key.

```json
{
  "error": "Unauthorized",
  "description": "Invalid API key or missing Authorization header",
  "statusCode": 401
}
```

### 429 Too Many Requests

Rate limit exceeded.

```json
{
  "error": "Rate limit exceeded",
  "description": "Too many requests. Please retry after some time",
  "statusCode": 429,
  "retryAfter": 60
}
```

### 500 Internal Server Error

Server-side error occurred.

```json
{
  "error": "Internal server error",
  "description": "An unexpected error occurred while processing the request",
  "statusCode": 500
}
```

## Rate Limits

| Plan | Requests per Minute | Daily Limit |
|------|-------------------|-------------|
| Free | 100 | 10,000 |
| Pro | 1,000 | 100,000 |
| Enterprise | Custom | Custom |

## Usage Examples

### Price Monitoring

Monitor price changes for all tokens:

```javascript
const axios = require("axios");

class PriceMonitor {
  constructor(apiKey, chainId = 1, interval = 30000) {
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.interval = interval;
    this.previousPrices = new Map();
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    console.log(`Starting price monitor for chain ${this.chainId}`);
    
    while (this.isRunning) {
      try {
        await this.checkPrices();
        await this.sleep(this.interval);
      } catch (error) {
        console.error("Error in price monitoring:", error.message);
        await this.sleep(5000); // Short delay on error
      }
    }
  }

  async checkPrices() {
    const response = await axios.get(
      `https://api.1inch.dev/price/v1.1/${this.chainId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    const currentPrices = response.data;
    
    for (const [address, price] of Object.entries(currentPrices)) {
      const currentPrice = parseFloat(price);
      const previousPrice = this.previousPrices.get(address);
      
      if (previousPrice) {
        const changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
        
        if (Math.abs(changePercent) > 5) { // Alert on 5%+ change
          console.log(`🚨 Price Alert: ${address}`);
          console.log(`  Previous: $${previousPrice.toFixed(6)}`);
          console.log(`  Current: $${currentPrice.toFixed(6)}`);
          console.log(`  Change: ${changePercent.toFixed(2)}%`);
        }
      }
      
      this.previousPrices.set(address, currentPrice);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
  }
}

// Usage
const monitor = new PriceMonitor("YOUR_API_KEY", 1, 60000); // Check every minute
monitor.start();
```

### Price Analytics

Calculate market statistics:

```javascript
async function getMarketStats(apiKey, chainId = 1) {
  const response = await axios.get(
    `https://api.1inch.dev/price/v1.1/${chainId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  const prices = Object.values(response.data).map(price => parseFloat(price));
  
  const stats = {
    totalTokens: prices.length,
    averagePrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
    medianPrice: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices),
    pricesAbove1000: prices.filter(price => price > 1000).length,
    pricesBelow1: prices.filter(price => price < 1).length
  };

  return stats;
}

// Usage
getMarketStats("YOUR_API_KEY")
  .then(stats => console.log("Market Statistics:", stats))
  .catch(console.error);
```

## Best Practices

### 1. Implement Caching

Cache responses to reduce API calls:

```javascript
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 30 }); // 30 second cache

async function getCachedPrices(apiKey, chainId) {
  const cacheKey = `prices-${chainId}`;
  let prices = cache.get(cacheKey);
  
  if (!prices) {
    const response = await axios.get(
      `https://api.1inch.dev/price/v1.1/${chainId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    prices = response.data;
    cache.set(cacheKey, prices);
  }
  
  return prices;
}
```

### 2. Handle Rate Limits

Implement exponential backoff:

```javascript
async function fetchWithRetry(url, config, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Process Large Responses Efficiently

Use streaming for large datasets:

```javascript
const { Transform } = require('stream');

class PriceProcessor extends Transform {
  constructor() {
    super({ objectMode: true });
    this.processedCount = 0;
  }

  _transform(chunk, encoding, callback) {
    try {
      const prices = JSON.parse(chunk);
      
      for (const [address, price] of Object.entries(prices)) {
        if (parseFloat(price) > 1000) { // Process high-value tokens
          this.push({ address, price: parseFloat(price) });
          this.processedCount++;
        }
      }
      
      callback();
    } catch (error) {
      callback(error);
    }
  }
}
```

## Related Endpoints

- [Get Prices by Tokens](get-prices-by-tokens.md) - Get prices for specific tokens
- [Get All Currencies](get-all-currencies.md) - Get available base currencies
- [API Overview](../overview.md) - Complete API documentation

## Support

For technical issues or questions about this endpoint:
- [1inch Developer Portal](https://portal.1inch.dev/)
- [API Documentation](https://docs.1inch.io/)
- [Community Discord](https://discord.gg/1inch)