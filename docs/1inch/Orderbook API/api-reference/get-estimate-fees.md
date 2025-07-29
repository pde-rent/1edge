# Get Estimate Fees

Estimate fees for order execution.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/estimate-fees
```

## Parameters

### Path Parameters

| Parameter | Type     | Required | Description                                      |
| --------- | -------- | -------- | ------------------------------------------------ |
| `chain`   | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |

### Query Parameters

| Parameter      | Type     | Required | Description                                  |
| -------------- | -------- | -------- | -------------------------------------------- |
| `orderHash`    | `string` | Yes      | The hash of the order to estimate fees for   |
| `takerAddress` | `string` | Yes      | Address of the taker who will fill the order |
| `makingAmount` | `string` | No       | Amount to be filled (if partial fill)        |

## Request Example

```javascript
const axios = require("axios");

async function httpCall() {
  const url = "https://api.1inch.dev/orderbook/v4.0/1/estimate-fees";

  const config = {
    headers: {
      Authorization: "Bearer {API_KEY}",
    },
    params: {
      orderHash:
        "0xf2637aec6b34381238f8c7c0a2e2e5b1bbcfa62c8e6411c7304f3f10e30d74b4",
      takerAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      makingAmount: "100000000",
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

Returns estimated fees for the order execution.

### Schema

| Field           | Type     | Description                             |
| --------------- | -------- | --------------------------------------- |
| `resolverFee`   | `string` | Fee amount paid to the resolver         |
| `integratorFee` | `string` | Fee amount for the integrator           |
| `protocolFee`   | `string` | Protocol fee amount                     |
| `totalFee`      | `string` | Total fees to be paid                   |
| `estimatedGas`  | `string` | Estimated gas units for the transaction |

### Example Response

```json
{
  "resolverFee": "50000",
  "integratorFee": "100000",
  "protocolFee": "25000",
  "totalFee": "175000",
  "estimatedGas": "150000"
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

### Not Found (404)

Order not found.

```json
{
  "statusCode": 404,
  "message": "Order not found",
  "error": "Not Found"
}
```
