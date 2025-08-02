# Get All Currencies

Retrieve all available base currencies that can be used for price denomination in the 1inch Spot Price API.

```mermaid
graph TD
    subgraph "Currency System"
        CLIENT[Client Request] --> API[Currency API]
        API --> DB[(Currency Registry)]
        DB --> VALIDATE[Validate Availability]
        VALIDATE --> FILTER[Filter by Chain]
        FILTER --> RESPONSE[Currency List]
        RESPONSE --> CLIENT
    end

    subgraph "Supported Currencies"
        USD[USD - US Dollar]
        ETH[ETH - Ethereum]
        BTC[BTC - Bitcoin]
        EUR[EUR - Euro]
        OTHER[Other Fiat & Crypto]
    end

    RESPONSE --> USD
    RESPONSE --> ETH
    RESPONSE --> BTC
    RESPONSE --> EUR
    RESPONSE --> OTHER
```

## Endpoint

```
GET https://api.1inch.dev/price/v1.1/{chain}/currencies
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description                                                  |
| --------- | -------- | -------- | ------------------------------------------------------------ |
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, 56 for BSC, etc.) |

### Query Parameters

This endpoint accepts no query parameters. All available currencies for the specified chain are returned.

## Authentication

All requests require authentication using a Bearer token in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

## Request Examples

### cURL

```bash
curl -X GET "https://api.1inch.dev/price/v1.1/1/currencies" \
  -H "Authorization: Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu" \
  -H "Accept: application/json"
```

### JavaScript (axios)

```javascript
const axios = require("axios");

async function getAllCurrencies(chainId = 1) {
  const url = `https://api.1inch.dev/price/v1.1/${chainId}/currencies`;

  const config = {
    headers: {
      Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu",
      Accept: "application/json",
    },
  };

  try {
    const response = await axios.get(url, config);
    console.log("Available currencies:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching currencies:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

getAllCurrencies();
```

### JavaScript (fetch)

```javascript
async function getCurrencies(
  chainId = 1,
  apiKey = "T4l6ro3uDEfeBY4ROtslRUjUhacPmBgu",
) {
  const response = await fetch(
    `https://api.1inch.dev/price/v1.1/${chainId}/currencies`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

// Usage
getCurrencies(1)
  .then((currencies) => console.log(currencies))
  .catch(console.error);
```

### Python (requests)

```python
import requests
import json

def get_all_currencies(chain_id=1, api_key="T4l6ro3uDEfeBY4ROtslRUjUhacePmBgu"):
    url = f"https://api.1inch.dev/price/v1.1/{chain_id}/currencies"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()

        currencies = response.json()
        print(f"Available currencies for chain {chain_id}:")
        print(json.dumps(currencies, indent=2))

        return currencies
    except requests.exceptions.RequestException as e:
        print(f"Error fetching currencies: {e}")
        raise

# Usage
currencies = get_all_currencies()
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

type CurrencyResponse struct {
    Currencies []string `json:"currencies"`
}

func getAllCurrencies(chainID int, apiKey string) ([]string, error) {
    url := fmt.Sprintf("https://api.1inch.dev/price/v1.1/%d/currencies", chainID)

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

    var currencies []string
    err = json.Unmarshal(body, &currencies)
    return currencies, err
}

func main() {
    currencies, err := getAllCurrencies(1, "T4l6ro3uDEfeBY4ROtslRUjUhacePmBgu")
    if err != nil {
        panic(err)
    }

    fmt.Printf("Available currencies: %v\n", currencies)
}
```

## Response

### Success Response (200)

Returns a JSON array containing all available currency codes that can be used as base currencies for price requests.

### Response Schema

| Field        | Type    | Description                    |
| ------------ | ------- | ------------------------------ |
| `currencies` | `array` | Array of currency code strings |

### Example Response

```json
["USD", "EUR", "GBP", "JPY", "ETH", "BTC", "BNB", "MATIC"]
```

**Response Format Notes:**

- Currency codes are returned as uppercase strings
- Includes both fiat currencies (USD, EUR, etc.) and cryptocurrency base currencies
- Available currencies may vary by blockchain network
- The list is ordered alphabetically

## Supported Currencies by Network

### Ethereum (Chain ID: 1)

| Currency | Type       | Description         |
| -------- | ---------- | ------------------- |
| `USD`    | Fiat       | US Dollar (default) |
| `EUR`    | Fiat       | Euro                |
| `GBP`    | Fiat       | British Pound       |
| `JPY`    | Fiat       | Japanese Yen        |
| `ETH`    | Crypto     | Ethereum            |
| `BTC`    | Crypto     | Bitcoin             |
| `USDC`   | Stablecoin | USD Coin            |
| `USDT`   | Stablecoin | Tether USD          |

### Polygon (Chain ID: 137)

| Currency | Type       | Description          |
| -------- | ---------- | -------------------- |
| `USD`    | Fiat       | US Dollar (default)  |
| `EUR`    | Fiat       | Euro                 |
| `MATIC`  | Crypto     | Polygon native token |
| `ETH`    | Crypto     | Ethereum             |
| `BTC`    | Crypto     | Bitcoin              |
| `USDC`   | Stablecoin | USD Coin             |

### BSC (Chain ID: 56)

| Currency | Type       | Description         |
| -------- | ---------- | ------------------- |
| `USD`    | Fiat       | US Dollar (default) |
| `EUR`    | Fiat       | Euro                |
| `BNB`    | Crypto     | Binance Coin        |
| `ETH`    | Crypto     | Ethereum            |
| `BTC`    | Crypto     | Bitcoin             |
| `BUSD`   | Stablecoin | Binance USD         |

## Usage Examples

### Currency Selection Interface

Build a currency picker for your application:

```javascript
async function buildCurrencySelector(chainId = 1) {
  try {
    const currencies = await getAllCurrencies(chainId);

    const currencyInfo = {
      USD: { symbol: "$", name: "US Dollar", type: "fiat" },
      EUR: { symbol: "�", name: "Euro", type: "fiat" },
      GBP: { symbol: "�", name: "British Pound", type: "fiat" },
      ETH: { symbol: "�", name: "Ethereum", type: "crypto" },
      BTC: { symbol: "�", name: "Bitcoin", type: "crypto" },
      BNB: { symbol: "BNB", name: "Binance Coin", type: "crypto" },
      MATIC: { symbol: "MATIC", name: "Polygon", type: "crypto" },
    };

    const selector = currencies.map((code) => ({
      code,
      ...currencyInfo[code],
      displayName: `${currencyInfo[code]?.symbol || ""} ${currencyInfo[code]?.name || code}`,
    }));

    console.log("Currency selector options:", selector);
    return selector;
  } catch (error) {
    console.error("Failed to build currency selector:", error);
    return [];
  }
}

buildCurrencySelector(1);
```

### Multi-Currency Price Fetching

Get prices in multiple currencies:

```javascript
async function getMultiCurrencyPrices(tokenAddress, chainId = 1) {
  const currencies = await getAllCurrencies(chainId);
  const prices = {};

  for (const currency of currencies) {
    try {
      const response = await axios.get(
        `https://api.1inch.dev/price/v1.1/${chainId}/${tokenAddress}?currency=${currency}`,
        {
          headers: {
            Authorization: "Bearer T4l6ro3uDEfeBY4ROtslRUjUhacePmBgu",
          },
        },
      );

      prices[currency] = response.data[tokenAddress];
    } catch (error) {
      console.warn(`Failed to get price in ${currency}:`, error.message);
      prices[currency] = null;
    }
  }

  return prices;
}

// Usage: Get WETH prices in all available currencies
getMultiCurrencyPrices("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2").then(
  (prices) => {
    console.log("WETH prices in different currencies:");
    for (const [currency, price] of Object.entries(prices)) {
      if (price) {
        console.log(`${currency}: ${price}`);
      }
    }
  },
);
```

### Currency Validation

Validate currency codes before making price requests:

```javascript
class CurrencyValidator {
  constructor(apiKey, chainId = 1) {
    this.apiKey = apiKey;
    this.chainId = chainId;
    this.supportedCurrencies = null;
    this.lastUpdated = null;
  }

  async getSupportedCurrencies() {
    // Cache currencies for 1 hour
    if (
      this.supportedCurrencies &&
      this.lastUpdated &&
      Date.now() - this.lastUpdated < 3600000
    ) {
      return this.supportedCurrencies;
    }

    try {
      const currencies = await getAllCurrencies(this.chainId);
      this.supportedCurrencies = new Set(currencies);
      this.lastUpdated = Date.now();
      return this.supportedCurrencies;
    } catch (error) {
      console.error("Failed to fetch supported currencies:", error);
      // Return cached currencies if available
      return this.supportedCurrencies || new Set(["USD"]);
    }
  }

  async isValidCurrency(currency) {
    const supported = await this.getSupportedCurrencies();
    return supported.has(currency.toUpperCase());
  }

  async validateAndNormalize(currency) {
    const normalized = currency.toUpperCase();
    const isValid = await this.isValidCurrency(normalized);

    if (!isValid) {
      throw new Error(
        `Unsupported currency: ${currency}. Use one of: ${Array.from(await this.getSupportedCurrencies()).join(", ")}`,
      );
    }

    return normalized;
  }
}

// Usage
const validator = new CurrencyValidator("YOUR_API_KEY", 1);

async function validateCurrencyInput(userInput) {
  try {
    const validCurrency = await validator.validateAndNormalize(userInput);
    console.log(` Valid currency: ${validCurrency}`);
    return validCurrency;
  } catch (error) {
    console.error(` ${error.message}`);
    return null;
  }
}

// Test various inputs
validateCurrencyInput("usd"); //  Valid currency: USD
validateCurrencyInput("eth"); //  Valid currency: ETH
validateCurrencyInput("xyz"); //  Unsupported currency: xyz
```

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

### 404 Not Found

Chain not supported or currencies not available.

```json
{
  "error": "Chain not supported",
  "description": "The requested chain ID is not currently supported",
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

### 1. Cache Currency Lists

Cache the currency list to avoid repeated API calls:

```javascript
const NodeCache = require("node-cache");
const currencyCache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

async function getCachedCurrencies(chainId) {
  const cacheKey = `currencies-${chainId}`;
  let currencies = currencyCache.get(cacheKey);

  if (!currencies) {
    currencies = await getAllCurrencies(chainId);
    currencyCache.set(cacheKey, currencies);
  }

  return currencies;
}
```

### 2. Handle Currency Fallbacks

Provide fallback currencies when the preferred one is unavailable:

```javascript
async function getPriceWithFallback(
  tokenAddress,
  preferredCurrency,
  chainId = 1,
) {
  const fallbackCurrencies = ["USD", "ETH", "BTC"];
  const supportedCurrencies = await getAllCurrencies(chainId);

  // Try preferred currency first
  if (supportedCurrencies.includes(preferredCurrency)) {
    try {
      return await getTokenPrice(tokenAddress, preferredCurrency, chainId);
    } catch (error) {
      console.warn(
        `Failed to get price in ${preferredCurrency}, trying fallbacks`,
      );
    }
  }

  // Try fallback currencies
  for (const currency of fallbackCurrencies) {
    if (supportedCurrencies.includes(currency)) {
      try {
        return await getTokenPrice(tokenAddress, currency, chainId);
      } catch (error) {
        console.warn(`Failed to get price in ${currency}`);
      }
    }
  }

  throw new Error("Unable to get price in any supported currency");
}
```

### 3. Build Currency Conversion

Create a simple currency converter:

```javascript
class CurrencyConverter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.exchangeRates = new Map();
    this.lastUpdated = null;
  }

  async updateExchangeRates(chainId = 1) {
    try {
      // Use a reference token (like USDC) to calculate cross rates
      const usdcAddress = "0xa0b86a33e6b2d4d51c7c3a9b78d2f8b9c4d5e6f7";
      const currencies = await getAllCurrencies(chainId);

      for (const currency of currencies) {
        if (currency !== "USD") {
          const price = await this.getTokenPriceInCurrency(
            usdcAddress,
            currency,
            chainId,
          );
          this.exchangeRates.set(`USD_${currency}`, parseFloat(price));
        }
      }

      this.lastUpdated = Date.now();
    } catch (error) {
      console.error("Failed to update exchange rates:", error);
    }
  }

  convert(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;

    // Convert through USD as base
    let usdAmount = amount;
    if (fromCurrency !== "USD") {
      const fromRate = this.exchangeRates.get(`USD_${fromCurrency}`);
      if (!fromRate) throw new Error(`No exchange rate for ${fromCurrency}`);
      usdAmount = amount / fromRate;
    }

    if (toCurrency === "USD") return usdAmount;

    const toRate = this.exchangeRates.get(`USD_${toCurrency}`);
    if (!toRate) throw new Error(`No exchange rate for ${toCurrency}`);

    return usdAmount * toRate;
  }
}
```

## Use Cases

### Portfolio Valuation

Calculate portfolio values in user's preferred currency:

```javascript
async function calculatePortfolioValue(
  holdings,
  preferredCurrency = "USD",
  chainId = 1,
) {
  const currencies = await getAllCurrencies(chainId);

  if (!currencies.includes(preferredCurrency)) {
    throw new Error(
      `Currency ${preferredCurrency} not supported on chain ${chainId}`,
    );
  }

  let totalValue = 0;

  for (const holding of holdings) {
    try {
      const price = await getTokenPriceInCurrency(
        holding.tokenAddress,
        preferredCurrency,
        chainId,
      );

      const value = holding.amount * parseFloat(price);
      totalValue += value;

      console.log(
        `${holding.symbol}: ${holding.amount} � ${price} ${preferredCurrency} = ${value.toFixed(2)} ${preferredCurrency}`,
      );
    } catch (error) {
      console.warn(`Failed to get price for ${holding.symbol}:`, error.message);
    }
  }

  return totalValue;
}
```

### Multi-Currency Analytics

Build analytics dashboards supporting multiple currencies:

```javascript
async function buildCurrencyAnalytics(tokenAddress, chainId = 1) {
  const currencies = await getAllCurrencies(chainId);
  const analytics = {
    tokenAddress,
    chainId,
    timestamp: Date.now(),
    prices: {},
    volatility: {},
    trends: {},
  };

  // Get current prices in all currencies
  for (const currency of currencies) {
    try {
      const price = await getTokenPriceInCurrency(
        tokenAddress,
        currency,
        chainId,
      );
      analytics.prices[currency] = parseFloat(price);
    } catch (error) {
      console.warn(`Failed to get ${currency} price:`, error.message);
    }
  }

  return analytics;
}
```

## Related Endpoints

- [Get All Prices](get-all-prices.md) - Get prices for all tokens
- [Get Prices by Tokens](get-prices-by-tokens.md) - Get prices for specific tokens with currency options
- [API Overview](../overview.md) - Complete API documentation

## Support

For technical issues or questions about this endpoint:

- [1inch Developer Portal](https://portal.1inch.dev/)
- [API Documentation](https://docs.1inch.io/)
- [Community Discord](https://discord.gg/1inch)
