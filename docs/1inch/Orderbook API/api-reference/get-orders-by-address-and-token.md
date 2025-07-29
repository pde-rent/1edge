# Check Active Orders with Permit

Check if there are active orders with permit for a specified wallet address and token.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/has-active-orders-with-permit/{walletAddress}/{token}
```

## Parameters

### Path Parameters

| Parameter       | Type     | Required | Description                                      |
| --------------- | -------- | -------- | ------------------------------------------------ |
| `chain`         | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |
| `walletAddress` | `string` | Yes      | Wallet address to check                          |
| `token`         | `string` | Yes      | Token address to check for permits               |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url =
    "https://api.1inch.dev/orderbook/v4.0/1/has-active-orders-with-permit/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/0x1234567890ABCDEF1234567890ABCDEF12345678";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {},
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

Returns whether there are active orders with permit for the specified wallet and token.

### Schema

| Field    | Type      | Description                                              |
| -------- | --------- | -------------------------------------------------------- |
| `result` | `boolean` | True if active orders with permit exist, false otherwise |

### Example Response

```json
{
  "result": true
}
```

## Error Responses

### Bad Request (400)

Input data is invalid.

```json
{
  "statusCode": 400,
  "message": "Invalid address format",
  "error": "Bad Request"
}
```

## Notes

This endpoint is useful for checking if a user has active orders that utilize the permit functionality for a specific token. This can help in managing token permissions and understanding the user's active trading positions.
