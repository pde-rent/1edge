# Submit Order

Submit a new limit order to the orderbook.

## Endpoint

```
POST https://api.1inch.dev/orderbook/v4.0/{chain}
```

## Parameters

### Path Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `chain` | `number` | Yes | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |

### Request Body

The request body should contain the order data and signature.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `orderHash` | `string` | Yes | Hash of the order |
| `signature` | `string` | Yes | Order signature |
| `data` | `object` | Yes | Order data structure |
| `data.makerAsset` | `string` | Yes | Maker asset address |
| `data.takerAsset` | `string` | Yes | Taker asset address |
| `data.maker` | `string` | Yes | Maker address |
| `data.receiver` | `string` | No | Receiver address (default: 0x0) |
| `data.makingAmount` | `string` | Yes | Amount of maker asset |
| `data.takingAmount` | `string` | Yes | Amount of taker asset |
| `data.salt` | `string` | Yes | Order salt for uniqueness |
| `data.extension` | `string` | No | Extension data (default: "0x") |
| `data.makerTraits` | `string` | No | Maker traits (default: "0") |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url = "https://api.1inch.dev/orderbook/v4.0/1";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {},
    paramsSerializer: {
      indexes: null,
    },
  };
  
  const body = {
    orderHash: "0xf2637aec6b34381238f8c7c0a2e2e5b1bbcfa62c8e6411c7304f3f10e30d74b4",
    signature: "0x9b2097ae806d5212ea48fd0d79aab10d330cea08ccf8a7e8aceaad24a8f4c3ae5121132fa69c5ef2fe1cbe5d484322d1c5da986516a69ed1be22341a4a8c02a51b",
    data: {
      makerAsset: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      takerAsset: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      maker: "0xccede9975db9241bfc54f077b6990aafe8aee6da",
      receiver: "0xc0dfdb9e7a392c3dbbe7c6fbe8fbc1789c9fe05e",
      makingAmount: "500000000",
      takingAmount: "142857142857142850",
      salt: "5487688115047438160270854460963812119342305034397817101594570438434225671085",
      extension: "0x",
      makerTraits: "0x4e80000000000000000000000000000000006889c95600000000000000000000",
    },
  };

  try {
    const response = await axios.post(url, body, config);
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}
```

## Response

### Success (201)

Order successfully submitted.

```json
{
  "success": true,
  "orderHash": "0xf2637aec6b34381238f8c7c0a2e2e5b1bbcfa62c8e6411c7304f3f10e30d74b4"
}
```

### Error Responses

#### Bad Request (400)

Invalid order data or signature.

```json
{
  "statusCode": 400,
  "message": "Invalid signature",
  "error": "Bad Request"
}
```

#### Conflict (409)

Order already exists.

```json
{
  "statusCode": 409,
  "message": "Order already exists",
  "error": "Conflict"
}
```

## Notes

- The order must be properly signed using EIP-712
- The orderHash must match the hash of the order data
- The maker must have sufficient balance and allowance
- Use the SDK to properly construct and sign orders before submission