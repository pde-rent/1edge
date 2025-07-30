# Get Prices by Tokens

Retrieve prices for specific tokens using either GET (single token) or POST (multiple tokens) requests. This endpoint provides flexible price querying with currency options.

```mermaid
graph TD
    subgraph "Request Types"
        SINGLE[Single Token GET] --> VALIDATE1[Validate Token Address]
        BATCH[Batch Tokens POST] --> VALIDATE2[Validate Token List]
    end

    subgraph "Processing Pipeline"
        VALIDATE1 --> CURRENCY[Apply Currency Filter]
        VALIDATE2 --> CURRENCY
        CURRENCY --> CACHE[Check Price Cache]
        CACHE --> FETCH[Fetch from DEX Sources]
        FETCH --> NORMALIZE[Normalize & Convert]
        NORMALIZE --> RESPONSE[JSON Response]
    end

    subgraph "Response Formats"
        RESPONSE --> SINGLE_RESP[Single Token Object]
        RESPONSE --> BATCH_RESP[Token Address Map]
    end
```

## Endpoints

### Single Token (GET)

```
GET https://api.1inch.dev/price/v1.1/{chain}/{address}
```

### Multiple Tokens (POST)

```
POST https://api.1inch.dev/price/v1.1/{chain}
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description |
|-----------|----------|----------|-------------|
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, 56 for BSC, etc.) |
| `address` | `string` | Yes*     | Token contract address (GET requests only, *required for GET) |

### Query Parameters (GET only)

| Parameter  | Type     | Required | Default | Description |
|------------|----------|----------|---------|-------------|
| `currency` | `string` | No       | `USD`   | Base currency for price denomination |

### Request Body (POST only)

| Field      | Type       | Required | Description |
|------------|------------|----------|-------------|
| `tokens`   | `string[]` | Yes      | Array of token contract addresses |
| `currency` | `string`   | No       | Base currency for price denomination (default: `USD`) |

## Authentication

All requests require authentication using a Bearer token:

```http
Authorization: Bearer YOUR_API_KEY
```

## Request Examples

### Single Token (GET)

#### Basic Request

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1/0x111111111117dc0aa78b770fa6a738034120c302" \
  -H "Authorization: Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu" \
  -H "Accept: application/json"
```

#### With Currency Parameter

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1/0x111111111117dc0aa78b770fa6a738034120c302?currency=EUR" \
  -H "Authorization: Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu" \
  -H "Accept: application/json"
```

#### JavaScript (axios)

```javascript
const axios = require("axios");

async function getSingleTokenPrice(tokenAddress, currency = "USD", chainId = 1) {
  const url = `https://api.1inch.dev/price/v1.1/${chainId}/${tokenAddress}`;

  const config = {
    headers: {
      Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu",
      Accept: "application/json"
    },
    params: { currency }
  };

  try {
    const response = await axios.get(url, config);
    console.log(`Price for ${tokenAddress}:`, response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching token price:", error.response?.data || error.message);
    throw error;
  }
}

// Usage examples
getSingleTokenPrice("0x111111111117dc0aa78b770fa6a738034120c302", "USD");  // 1INCH in USD
getSingleTokenPrice("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", "EUR");   // WETH in EUR
getSingleTokenPrice("0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", "ETH");   // USDC in ETH
```

### Multiple Tokens (POST)

#### Basic Batch Request

```bash
curl -X POST "https://api.1inch.dev/price/v1.1/1" \
  -H "Authorization: Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu" \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": [
      "0x111111111117dc0aa78b770fa6a738034120c302",
      "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7"
    ],
    "currency": "USD"
  }'
```

#### JavaScript (axios)

```javascript
async function getBatchTokenPrices(tokenAddresses, currency = "USD", chainId = 1) {
  const url = `https://api.1inch.dev/price/v1.1/${chainId}`;

  const config = {
    headers: {
      Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu",
      "Content-Type": "application/json"
    }
  };

  const body = {
    tokens: tokenAddresses,
    currency: currency
  };

  try {
    const response = await axios.post(url, body, config);
    console.log(`Batch prices in ${currency}:`, response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching batch prices:", error.response?.data || error.message);
    throw error;
  }
}

// Usage examples
const tokens = [
  "0x111111111117dc0aa78b770fa6a738034120c302", // 1INCH
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
  "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", // USDC
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"  // UNI
];

getBatchTokenPrices(tokens, "USD");   // Prices in USD
getBatchTokenPrices(tokens, "ETH");   // Prices in ETH
getBatchTokenPrices(tokens, "EUR");   // Prices in EUR
```

#### Python (requests)

```python
import requests
import json

def get_batch_token_prices(token_addresses, currency="USD", chain_id=1, api_key="T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu"):
    url = f"https://api.1inch.dev/price/v1.1/{chain_id}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    payload = {
        "tokens": token_addresses,
        "currency": currency
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        prices = response.json()
        print(f"Token prices in {currency}:")
        for address, price in prices.items():
            print(f"  {address}: {price}")
            
        return prices
    except requests.exceptions.RequestException as e:
        print(f"Error fetching batch prices: {e}")
        raise

# Usage
tokens = [
    "0x111111111117dc0aa78b770fa6a738034120c302",  # 1INCH
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",  # WETH
    "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7"   # USDC
]

prices = get_batch_token_prices(tokens, "USD")
```

#### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

type BatchPriceRequest struct {
    Tokens   []string `json:"tokens"`
    Currency string   `json:"currency"`
}

func getBatchTokenPrices(chainID int, tokens []string, currency string, apiKey string) (map[string]string, error) {
    url := fmt.Sprintf("https://api.1inch.dev/price/v1.1/%d", chainID)
    
    requestBody := BatchPriceRequest{
        Tokens:   tokens,
        Currency: currency,
    }
    
    jsonBody, err := json.Marshal(requestBody)
    if err != nil {
        return nil, err
    }
    
    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")
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
    tokens := []string{
        "0x111111111117dc0aa78b770fa6a738034120c302", // 1INCH
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    }
    
    prices, err := getBatchTokenPrices(1, tokens, "USD", "T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu")
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Token prices: %v\n", prices)
}
```

## Response Format

### Single Token (GET)

Returns a JSON object with the token address as key and price as value:

```json
{
  "0x111111111117dc0aa78b770fa6a738034120c302": "0.27929411310613317"
}
```

### Multiple Tokens (POST)

Returns a JSON object mapping each token address to its price:

```json
{
  "0x111111111117dc0aa78b770fa6a738034120c302": "0.27929411310613317",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "3456.789123456789",
  "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7": "1.000123456789"
}
```

**Response Format Notes:**
- Token addresses are returned in lowercase with `0x` prefix
- Prices are strings to preserve decimal precision
- Missing tokens (not whitelisted or invalid) are omitted from response
- Prices are denominated in the requested currency

## Currency Support

### Available Currencies

Use the [Get All Currencies](get-all-currencies.md) endpoint to retrieve available currencies for each chain.

Common currencies include:
- **Fiat**: `USD` (default), `EUR`, `GBP`, `JPY`
- **Crypto**: `ETH`, `BTC`, `BNB`, `MATIC`
- **Stablecoins**: `USDC`, `USDT`, `BUSD`

### Currency Examples

```javascript
// Different currency examples
const wethAddress = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

// Price in USD (default)
const usdPrice = await getSingleTokenPrice(wethAddress, "USD");

// Price in EUR
const eurPrice = await getSingleTokenPrice(wethAddress, "EUR");

// Price in BTC
const btcPrice = await getSingleTokenPrice(wethAddress, "BTC");

// Price in ETH (shows 1.0 for WETH)
const ethPrice = await getSingleTokenPrice(wethAddress, "ETH");

console.log({
  USD: usdPrice,
  EUR: eurPrice,
  BTC: btcPrice,
  ETH: ethPrice
});
```

## Advanced Usage Examples

### Portfolio Price Tracking

Track portfolio value across multiple currencies:

```javascript
class PortfolioTracker {
  constructor(apiKey, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.holdings = new Map();
  }

  addHolding(tokenAddress, amount, symbol = null) {
    this.holdings.set(tokenAddress.toLowerCase(), {
      address: tokenAddress.toLowerCase(),
      amount: parseFloat(amount),
      symbol: symbol || tokenAddress.slice(0, 8)
    });
  }

  async getPortfolioValue(currency = "USD") {
    const tokenAddresses = Array.from(this.holdings.keys());
    
    if (tokenAddresses.length === 0) {
      return { totalValue: 0, breakdown: [], currency };
    }

    try {
      const prices = await getBatchTokenPrices(tokenAddresses, currency, this.chainId);
      let totalValue = 0;
      const breakdown = [];

      for (const [address, holding] of this.holdings) {
        const price = prices[address];
        if (price) {
          const value = holding.amount * parseFloat(price);
          totalValue += value;
          
          breakdown.push({
            symbol: holding.symbol,
            address: address,
            amount: holding.amount,
            price: parseFloat(price),
            value: value,
            percentage: 0 // Will be calculated after total
          });
        } else {
          console.warn(`No price found for ${holding.symbol} (${address})`);
        }
      }

      // Calculate percentages
      breakdown.forEach(item => {
        item.percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
      });

      // Sort by value descending
      breakdown.sort((a, b) => b.value - a.value);

      return {
        totalValue,
        breakdown,
        currency,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error("Error calculating portfolio value:", error);
      throw error;
    }
  }

  async getMultiCurrencyValue(currencies = ["USD", "EUR", "ETH"]) {
    const results = {};
    
    for (const currency of currencies) {
      try {
        results[currency] = await this.getPortfolioValue(currency);
      } catch (error) {
        console.error(`Failed to get portfolio value in ${currency}:`, error.message);
        results[currency] = null;
      }
    }
    
    return results;
  }
}

// Usage example
async function demonstratePortfolioTracking() {
  const portfolio = new PortfolioTracker("YOUR_API_KEY", 1);
  
  // Add holdings
  portfolio.addHolding("0x111111111117dc0aa78b770fa6a738034120c302", 1000, "1INCH");
  portfolio.addHolding("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 2.5, "WETH");
  portfolio.addHolding("0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", 5000, "USDC");

  // Get portfolio value in USD
  const usdValue = await portfolio.getPortfolioValue("USD");
  console.log(`Portfolio Value: $${usdValue.totalValue.toFixed(2)}`);
  
  usdValue.breakdown.forEach(holding => {
    console.log(`  ${holding.symbol}: ${holding.amount} × $${holding.price.toFixed(4)} = $${holding.value.toFixed(2)} (${holding.percentage.toFixed(1)}%)`);
  });

  // Get portfolio value in multiple currencies
  const multiCurrency = await portfolio.getMultiCurrencyValue(["USD", "EUR", "ETH"]);
  console.log("\nMulti-currency portfolio values:");
  for (const [currency, data] of Object.entries(multiCurrency)) {
    if (data) {
      console.log(`${currency}: ${data.totalValue.toFixed(6)}`);
    }
  }
}

demonstratePortfolioTracking();
```

### Price Alert System

Monitor token prices and trigger alerts:

```javascript
class PriceAlertSystem {
  constructor(apiKey, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.alerts = new Map();
    this.priceHistory = new Map();
    this.isRunning = false;
  }

  addAlert(tokenAddress, targetPrice, direction, currency = "USD", description = "") {
    const alertId = `${tokenAddress}-${Date.now()}`;
    
    this.alerts.set(alertId, {
      id: alertId,
      tokenAddress: tokenAddress.toLowerCase(),
      targetPrice: parseFloat(targetPrice),
      direction: direction.toLowerCase(), // 'above' or 'below'
      currency: currency.toUpperCase(),
      description: description,
      created: Date.now(),
      triggered: false
    });

    console.log(`✓ Alert added: ${description || tokenAddress} ${direction} ${targetPrice} ${currency}`);
    return alertId;
  }

  removeAlert(alertId) {
    const removed = this.alerts.delete(alertId);
    if (removed) {
      console.log(`✗ Alert removed: ${alertId}`);
    }
    return removed;
  }

  async checkAlerts() {
    if (this.alerts.size === 0) return;

    // Group alerts by currency for batch requests
    const alertsByCurrency = new Map();
    
    for (const alert of this.alerts.values()) {
      if (alert.triggered) continue;
      
      if (!alertsByCurrency.has(alert.currency)) {
        alertsByCurrency.set(alert.currency, []);
      }
      alertsByCurrency.get(alert.currency).push(alert);
    }

    // Check each currency group
    for (const [currency, currencyAlerts] of alertsByCurrency) {
      try {
        const tokenAddresses = [...new Set(currencyAlerts.map(a => a.tokenAddress))];
        const prices = await getBatchTokenPrices(tokenAddresses, currency, this.chainId);

        for (const alert of currencyAlerts) {
          const currentPrice = parseFloat(prices[alert.tokenAddress]);
          if (!currentPrice) continue;

          // Store price history
          const historyKey = `${alert.tokenAddress}-${currency}`;
          if (!this.priceHistory.has(historyKey)) {
            this.priceHistory.set(historyKey, []);
          }
          this.priceHistory.get(historyKey).push({
            price: currentPrice,
            timestamp: Date.now()
          });

          // Check alert condition
          const shouldTrigger = (
            (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
            (alert.direction === 'below' && currentPrice <= alert.targetPrice)
          );

          if (shouldTrigger) {
            this.triggerAlert(alert, currentPrice);
          }
        }
      } catch (error) {
        console.error(`Error checking alerts for ${currency}:`, error.message);
      }
    }
  }

  triggerAlert(alert, currentPrice) {
    alert.triggered = true;
    alert.triggeredAt = Date.now();
    alert.triggeredPrice = currentPrice;

    console.log(`🚨 PRICE ALERT TRIGGERED! 🚨`);
    console.log(`Token: ${alert.tokenAddress}`);
    console.log(`Description: ${alert.description}`);
    console.log(`Target: ${alert.direction} ${alert.targetPrice} ${alert.currency}`);
    console.log(`Current Price: ${currentPrice} ${alert.currency}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`---`);

    // Here you could send notifications via email, Slack, Discord, etc.
    this.sendNotification(alert, currentPrice);
  }

  async sendNotification(alert, currentPrice) {
    // Implement your notification logic here
    // Examples: email, SMS, webhook, Discord bot, etc.
    
    const notificationData = {
      type: 'price_alert',
      token: alert.tokenAddress,
      description: alert.description,
      targetPrice: alert.targetPrice,
      currentPrice: currentPrice,
      currency: alert.currency,
      direction: alert.direction,
      timestamp: Date.now()
    };

    // Example webhook notification
    try {
      // await sendWebhook('https://your-webhook-url.com', notificationData);
      console.log('Notification sent:', notificationData);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async start(checkInterval = 30000) {
    this.isRunning = true;
    console.log(`🎯 Price alert system started (checking every ${checkInterval/1000}s)`);

    while (this.isRunning) {
      try {
        await this.checkAlerts();
        
        // Clean up old price history (keep last 100 entries per token-currency)
        for (const [key, history] of this.priceHistory) {
          if (history.length > 100) {
            this.priceHistory.set(key, history.slice(-100));
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        console.error('Error in price alert system:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Price alert system stopped');
  }

  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(alert => !alert.triggered);
  }

  getTriggeredAlerts() {
    return Array.from(this.alerts.values()).filter(alert => alert.triggered);
  }

  getPriceHistory(tokenAddress, currency = "USD", limit = 50) {
    const historyKey = `${tokenAddress.toLowerCase()}-${currency.toUpperCase()}`;
    const history = this.priceHistory.get(historyKey) || [];
    return history.slice(-limit);
  }
}

// Usage example
async function demonstratePriceAlerts() {
  const alertSystem = new PriceAlertSystem("YOUR_API_KEY", 1);

  // Add some alerts
  alertSystem.addAlert(
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", 
    4000, 
    "above", 
    "USD", 
    "WETH above $4000"
  );

  alertSystem.addAlert(
    "0x111111111117dc0aa78b770fa6a738034120c302", 
    0.5, 
    "above", 
    "USD", 
    "1INCH above $0.50"
  );

  alertSystem.addAlert(
    "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", 
    0.98, 
    "below", 
    "USD", 
    "USDC below $0.98 (depeg alert)"
  );

  // Start monitoring (runs until stopped)
  alertSystem.start(60000); // Check every minute

  // Stop after 5 minutes for demo
  setTimeout(() => {
    alertSystem.stop();
    
    console.log("\nActive alerts:", alertSystem.getActiveAlerts().length);
    console.log("Triggered alerts:", alertSystem.getTriggeredAlerts().length);
  }, 300000);
}

// Uncomment to run
// demonstratePriceAlerts();
```

### Price Comparison Tool

Compare prices across different currencies and time periods:

```javascript
class PriceComparison {
  constructor(apiKey, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
  }

  async compareTokenPrices(tokenAddresses, currencies = ["USD", "EUR", "ETH"]) {
    const comparison = {
      tokens: tokenAddresses,
      currencies: currencies,
      timestamp: Date.now(),
      data: {}
    };

    for (const currency of currencies) {
      try {
        const prices = await getBatchTokenPrices(tokenAddresses, currency, this.chainId);
        comparison.data[currency] = prices;
      } catch (error) {
        console.error(`Failed to get prices in ${currency}:`, error.message);
        comparison.data[currency] = {};
      }
    }

    return comparison;
  }

  async analyzePriceRelationships(tokenAddresses, baseCurrency = "USD") {
    const prices = await getBatchTokenPrices(tokenAddresses, baseCurrency, this.chainId);
    const tokens = Object.keys(prices);
    const analysis = {
      baseCurrency,
      timestamp: Date.now(),
      relationships: {}
    };

    // Calculate price ratios between all token pairs
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const token1 = tokens[i];
        const token2 = tokens[j];
        const price1 = parseFloat(prices[token1]);
        const price2 = parseFloat(prices[token2]);
        
        if (price1 && price2) {
          const ratio = price1 / price2;
          const pairKey = `${token1.slice(0,8)}/${token2.slice(0,8)}`;
          
          analysis.relationships[pairKey] = {
            token1: { address: token1, price: price1 },
            token2: { address: token2, price: price2 },
            ratio: ratio,
            inverseRatio: 1 / ratio
          };
        }
      }
    }

    return analysis;
  }

  formatComparisonTable(comparison) {
    console.log("\n=== PRICE COMPARISON TABLE ===");
    console.log(`Timestamp: ${new Date(comparison.timestamp).toISOString()}`);
    console.log();

    // Header
    const header = ["Token Address", ...comparison.currencies];
    console.log(header.map(h => h.padEnd(15)).join(" | "));
    console.log("-".repeat(header.length * 18));

    // Data rows
    for (const tokenAddress of comparison.tokens) {
      const row = [tokenAddress.slice(0, 12) + "..."];
      
      for (const currency of comparison.currencies) {
        const price = comparison.data[currency][tokenAddress];
        row.push(price ? parseFloat(price).toFixed(6) : "N/A");
      }
      
      console.log(row.map(cell => cell.padEnd(15)).join(" | "));
    }
    
    console.log();
  }
}

// Usage example
async function demonstratePriceComparison() {
  const comparison = new PriceComparison("YOUR_API_KEY", 1);
  
  const tokens = [
    "0x111111111117dc0aa78b770fa6a738034120c302", // 1INCH
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
    "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7", // USDC
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"  // UNI
  ];

  // Compare prices across currencies
  const comp = await comparison.compareTokenPrices(tokens, ["USD", "EUR", "ETH", "BTC"]);
  comparison.formatComparisonTable(comp);

  // Analyze price relationships
  const analysis = await comparison.analyzePriceRelationships(tokens, "USD");
  console.log("\n=== PRICE RELATIONSHIPS ===");
  for (const [pair, data] of Object.entries(analysis.relationships)) {
    console.log(`${pair}: 1 ${data.token1.address.slice(0,8)} = ${data.ratio.toFixed(6)} ${data.token2.address.slice(0,8)}`);
  }
}

// demonstratePriceComparison();
```

## Error Responses

### 400 Bad Request

Invalid request parameters or malformed addresses.

```json
{
  "error": "Invalid token address",
  "description": "Token address must be a valid Ethereum address",
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

### 404 Not Found

Token not whitelisted or chain not supported.

```json
{
  "error": "Token not found",
  "description": "The requested token is not whitelisted on this chain",
  "statusCode": 404
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

## Best Practices

### 1. Use Batch Requests for Multiple Tokens

Always prefer POST batch requests when querying multiple tokens:

```javascript
// ❌ Inefficient: Multiple single requests
const prices = {};
for (const token of tokens) {
  prices[token] = await getSingleTokenPrice(token, "USD");
}

// ✅ Efficient: Single batch request
const prices = await getBatchTokenPrices(tokens, "USD");
```

### 2. Implement Request Caching

Cache results to reduce API calls:

```javascript
const NodeCache = require("node-cache");
const priceCache = new NodeCache({ stdTTL: 30 }); // 30 second cache

async function getCachedPrice(tokenAddress, currency = "USD", chainId = 1) {
  const cacheKey = `${chainId}-${tokenAddress}-${currency}`;
  let price = priceCache.get(cacheKey);
  
  if (!price) {
    const result = await getSingleTokenPrice(tokenAddress, currency, chainId);
    price = result[tokenAddress];
    priceCache.set(cacheKey, price);
  }
  
  return price;
}
```

### 3. Handle Missing Tokens Gracefully

Not all tokens may be available in the response:

```javascript
async function safeGetPrices(tokenAddresses, currency = "USD") {
  const prices = await getBatchTokenPrices(tokenAddresses, currency);
  const results = {};
  
  for (const address of tokenAddresses) {
    const price = prices[address.toLowerCase()];
    results[address] = {
      price: price || null,
      available: !!price,
      currency: currency
    };
  }
  
  return results;
}
```

### 4. Validate Addresses Before Requests

Validate Ethereum addresses before making API calls:

```javascript
function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function getValidatedPrice(tokenAddress, currency = "USD") {
  if (!isValidEthereumAddress(tokenAddress)) {
    throw new Error(`Invalid Ethereum address: ${tokenAddress}`);
  }
  
  return await getSingleTokenPrice(tokenAddress, currency);
}
```

## Rate Limiting

| Plan | Requests per Minute | Batch Size Limit | Daily Limit |
|------|-------------------|------------------|-------------|
| Free | 100 | 50 tokens | 10,000 |
| Pro | 1,000 | 200 tokens | 100,000 |
| Enterprise | Custom | Custom | Custom |

## Related Endpoints

- [Get All Prices](get-all-prices.md) - Get prices for all whitelisted tokens
- [Get All Currencies](get-all-currencies.md) - Get available base currencies
- [API Overview](../overview.md) - Complete API documentation

## Support

For technical issues or questions about this endpoint:
- [1inch Developer Portal](https://portal.1inch.dev/)
- [API Documentation](https://docs.1inch.io/)
- [Community Discord](https://discord.gg/1inch)
