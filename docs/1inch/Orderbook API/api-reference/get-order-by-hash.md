# Get Order by Hash

Get order details by the specified order hash.

## Endpoint

```
GET https://api.1inch.dev/orderbook/v4.0/{chain}/order/{orderHash}
```

## Parameters

### Path Parameters

| Parameter   | Type     | Required | Description                                      |
| ----------- | -------- | -------- | ------------------------------------------------ |
| `chain`     | `number` | Yes      | Chain ID (1 for Ethereum, 137 for Polygon, etc.) |
| `orderHash` | `string` | Yes      | The order hash to retrieve                       |

## Request Example

const axios = require("axios");

async function httpCall() {
const url =
"https://api.1inch.dev/orderbook/v4.0/1/order/0xf2637aec6b34381238f8c7c0a2e2e5b1bbcfa62c8e6411c7304f3f10e30d74b4";

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

## Response

### Success (200)

Returns the order details.

### Schema

| Field                  | Type      | Required | Description            |
| ---------------------- | --------- | -------- | ---------------------- |
| `id`                   | `number`  | Yes      | Order ID               |
| `orderHash`            | `string`  | Yes      | Order hash             |
| `createDateTime`       | `string`  | Yes      | Creation timestamp     |
| `lastChangedDateTime`  | `string`  | Yes      | Last update timestamp  |
| `takerAsset`           | `string`  | Yes      | Taker asset address    |
| `makerAsset`           | `string`  | Yes      | Maker asset address    |
| `orderStatus`          | `number`  | Yes      | Order status code      |
| `makerAmount`          | `string`  | Yes      | Total maker amount     |
| `remainingMakerAmount` | `string`  | Yes      | Remaining maker amount |
| `orderMaker`           | `string`  | Yes      | Maker address          |
| `makerBalance`         | `string`  | Yes      | Maker's balance        |
| `makerAllowance`       | `string`  | Yes      | Maker's allowance      |
| `takerAmount`          | `string`  | Yes      | Total taker amount     |
| `data`                 | `object`  | Yes      | Order data structure   |
| `makerRate`            | `string`  | Yes      | Maker exchange rate    |
| `takerRate`            | `string`  | Yes      | Taker exchange rate    |
| `orderInvalidReason`   | `string`  | Yes      | Reason if invalid      |
| `isMakerContract`      | `boolean` | Yes      | Is maker a contract    |

### Example Response

{
"id": 223802678,
"orderHash": "0xf2637aec6b34381238f8c7c0a2e2e5b1bbcfa62c8e6411c7304f3f10e30d74b4",
"createDateTime": "2025-07-27T07:27:23.335Z",
"lastChangedDateTime": "2025-07-27T07:27:23.335Z",
"takerAsset": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
"makerAsset": "0xdac17f958d2ee523a2206206994597c13d831ec7",
"orderStatus": 1,
"makerAmount": "500000000",
"remainingMakerAmount": "500000000",
"orderMaker": "0xccede9975db9241bfc54f077b6990aafe8aee6da",
"makerBalance": "1285018081",
"makerAllowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935",
"takerAmount": "142857142857142850",
"data": {
"salt": "5487688115047438160270854460963812119342305034397817101594570438434225671085",
"maker": "0xccede9975db9241bfc54f077b6990aafe8aee6da",
"receiver": "0xc0dfdb9e7a392c3dbbe7c6fbe8fbc1789c9fe05e",
"extension": "0x...",
"makerAsset": "0xdac17f958d2ee523a2206206994597c13d831ec7",
"takerAsset": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
"makerTraits": "0x4e80000000000000000000000000000000006889c95600000000000000000000",
"makingAmount": "500000000",
"takingAmount": "142857142857142850"
},
"makerRate": "285714285.714285700000000000",
"takerRate": "0.000000003500000000",
"orderInvalidReason": null,
"isMakerContract": false
}

```

```
