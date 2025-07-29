# Get Markets

Get unique active token pairs (markets) with limit orders.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/unique-active-pairs
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description                                      |
| --------- | -------- | -------- | ------------------------------------------------ |
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |

### Query Parameters

| Parameter | Type     | Required | Description                                        |
| --------- | -------- | -------- | -------------------------------------------------- |
| `page`    | `number` | No       | Page number for pagination (default: 1)            |
| `limit`   | `number` | No       | Number of items per page (default: 100, max: 1000) |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url = "https://api.1inch.dev/orderbook/v4.0/1/unique-active-pairs";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {
      page: 1,
      limit: 100,
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

Returns paginated list of unique active token pairs.

### Schema

| Field                | Type     | Description                  |
| -------------------- | -------- | ---------------------------- |
| `meta`               | `object` | Pagination metadata          |
| `meta.totalItems`    | `number` | Total number of unique pairs |
| `meta.itemsPerPage`  | `number` | Items per page               |
| `meta.totalPages`    | `number` | Total number of pages        |
| `meta.currentPage`   | `number` | Current page number          |
| `items`              | `array`  | Array of token pairs         |
| `items[].makerAsset` | `string` | Maker asset address          |
| `items[].takerAsset` | `string` | Taker asset address          |

### Example Response

{
"items": [
{
"makerAsset": "0x000000000000d0151e748d25b766e77efe2a6c83",
"takerAsset": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
},
// ...
{
"makerAsset": "0x027ce48b9b346728557e8d420fe936a72bf9b1c7",
"takerAsset": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
}
],
"meta": {
"totalItems": 15734,
"currentPage": 1,
"itemsPerPage": 100,
"totalPages": 158
}
}

````

## Error Responses

### Bad Request (400)

Input data is invalid.

```json
{
  "statusCode": 400,
  "message": "Invalid parameters",
  "error": "Bad Request"
}
````
