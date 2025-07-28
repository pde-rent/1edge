# Get Fill/Cancel Events

Get all order fill and cancel events.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/events
```

## Parameters

### Path Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `chain` | `number` | Yes | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |

### Query Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `limit` | `number` | No | Number of events to return (default: 100, max: 1000) |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url = "https://api.1inch.dev/orderbook/v4.0/1/events";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {
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

Returns an array of fill and cancel events.

### Schema

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | `number` | Event ID |
| `network` | `number` | Network/chain ID |
| `logId` | `string` | Log identifier |
| `version` | `number` | Protocol version |
| `action` | `string` | Event action ("fill" or "cancel") |
| `orderHash` | `string` | Order hash |
| `taker` | `string` | Taker address |
| `remainingMakerAmount` | `string` | Remaining maker amount after event |
| `transactionHash` | `string` | Transaction hash |
| `blockNumber` | `number` | Block number |
| `createDateTime` | `string` | Event timestamp |

### Example Response

```json
[
  {
    "id": 371438716,
    "network": 1,
    "logId": "log_b1582237",
    "version": 4,
    "action": "cancel",
    "orderHash": "0xe335b69fd14019878bc8824f84d72514f634c79c7a6dee65ad807e13cfa9dd5d",
    "taker": "0x52b702259b78bac5ee7842a0f01937e670efcc7d",
    "remainingMakerAmount": "1800000000000000000",
    "transactionHash": "0x95ef780b9ba43c01675e4d5407125db0a02bbcfbb8253846d8b4b3bd4158c3fc",
    "blockNumber": 23009437,
    "createDateTime": "2025-07-27T08:59:26.509Z"
  },
  {
    "id": 371438655,
    "network": 1,
    "logId": "log_ccfedfbb",
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
```
