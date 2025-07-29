# Get Fill/Cancel Events by Order

Get fill and cancel events related to a specific order.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/events/{orderHash}
```

## Parameters

### Path Parameters

| Parameter   | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `chain`     | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |
| `orderHash` | `string` | Yes      | The order hash to get events for                 |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url =
    "https://api.1inch.dev/orderbook/v4.0/1/events/0x55e039757dd333858f464b1da5dda6717284713352ba5f62447f8d1d63d49330";

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

Returns events related to the specified order hash.

### Schema

The response is an object where the key is the order hash and the value is an array of events.

| Field                  | Type     | Description                        |
| ---------------------- | -------- | ---------------------------------- |
| `id`                   | `number` | Event ID                           |
| `network`              | `number` | Network/chain ID                   |
| `logId`                | `string` | Log identifier                     |
| `version`              | `number` | Protocol version                   |
| `action`               | `string` | Event action ("fill" or "cancel")  |
| `orderHash`            | `string` | Order hash                         |
| `taker`                | `string` | Taker address                      |
| `remainingMakerAmount` | `string` | Remaining maker amount after event |
| `transactionHash`      | `string` | Transaction hash                   |
| `blockNumber`          | `number` | Block number                       |
| `createDateTime`       | `string` | Event timestamp                    |

### Example Response

```json
{
  "0x55e039757dd333858f464b1da5dda6717284713352ba5f62447f8d1d63d49330": [
    {
      "id": 371431676,
      "network": 1,
      "logId": "log_aaca02fe",
      "version": 4,
      "action": "fill",
      "orderHash": "0x55e039757dd333858f464b1da5dda6717284713352ba5f62447f8d1d63d49330",
      "taker": "0x71da20ac9f8d798a99b3c79681c8440cbfe77e07",
      "remainingMakerAmount": "0",
      "transactionHash": "0x864bfb2dec2fa32aa7a91e88d1a2befdb725630f1b53bcbd1f290190687e6148",
      "blockNumber": 23009264,
      "createDateTime": "2025-07-27T08:24:49.941Z"
    }
  ]
}
```

## Error Responses

### Bad Request (400)

Input data is invalid.

```json
{
  "statusCode": 400,
  "message": "Invalid order hash format",
  "error": "Bad Request"
}
```
