# Get Orders Count

Get the count of orders matching specified filters.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/count
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description                                      |
| --------- | -------- | -------- | ------------------------------------------------ |
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |

### Query Parameters

| Parameter    | Type     | Required | Description                            |
| ------------ | -------- | -------- | -------------------------------------- |
| `statuses`   | `string` | No       | Comma-separated order statuses (1,2,3) |
| `takerAsset` | `string` | No       | Filter by taker asset address          |
| `makerAsset` | `string` | No       | Filter by maker asset address          |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url = "https://api.1inch.dev/orderbook/v4.0/1/count";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {
      statuses: "1,2,3",
      takerAsset: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      makerAsset: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
    paramsSerializer: {
      indexes: null,
    },
  };

  try {
    const response = await axios.get(url, config);
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}
```

## Response

### Success (200)

Returns the count of orders matching the filters.

### Schema

| Field   | Type     | Description                            |
| ------- | -------- | -------------------------------------- |
| `count` | `number` | Number of orders matching the criteria |

### Example Response

```json
{ "count": 4347 }
```
