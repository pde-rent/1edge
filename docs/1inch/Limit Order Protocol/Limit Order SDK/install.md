# 1inch Limit Order Protocol v4 SDK Installation

> **Quick Start Guide**  
> This guide covers installation and basic setup of the 1inch Limit Order Protocol SDK for integration into your applications.

---

## Installation

Install the SDK using your preferred package manager:

### Using Bun

```bash
bun add '@1inch/limit-order-sdk'
```

---

## Documentation Hub

|  Resource                 |  Description                     |  Link                                            |
| --------------------------- | ---------------------------------- | -------------------------------------------------- |
| **Limit Order Integration** | Creating and managing limit orders | [Integration Guide](./integration.md)              |
| **Contract Interactions**   | Taker contract methods and usage   | [Taker Contract](../limit-order-taker-contract.md) |
| **Maker Contract**          | Maker contract functionality       | [Maker Contract](../limit-order-maker-contract.md) |
| **SDK Overview**            | Complete feature overview          | [SDK Overview](./overview.md)                      |

---

## Quick Usage Examples

### Order Creation

> ** Security Warning**  
> The private key shown below is for testing purposes only. **NEVER** use it in production!

```javascript
import {
  LimitOrder,
  MakerTraits,
  Address,
  Sdk,
  randBigInt,
  FetchProviderConnector,
} from "@1inch/limit-order-sdk";
import { Wallet } from "ethers";

//  Test private key - DO NOT use in production!
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const apiKey = "..."; //  Get from https://portal.1inch.dev/
const maker = new Wallet(privateKey);
const expiresIn = 120n; //  2 minutes
const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;

const UINT_40_MAX = (1n << 48n) - 1n;

//  Configure order traits
const makerTraits = MakerTraits.default()
  .withExpiration(expiration)
  .withNonce(randBigInt(UINT_40_MAX));

//  Initialize SDK
const sdk = new Sdk({
  authKey: apiKey,
  networkId: 1,
  httpConnector: new FetchProviderConnector(),
});

//  Create order
const order = await sdk.createOrder(
  {
    makerAsset: new Address("0xdac17f958d2ee523a2206206994597c13d831ec7"), //  USDT
    takerAsset: new Address("0x111111111117dc0aa78b770fa6a738034120c302"), //  1INCH
    makingAmount: 100_000000n, //  100 USDT (6 decimals)
    takingAmount: 10_00000000000000000n, //  10 1INCH (18 decimals)
    maker: new Address(maker.address),
    //  salt?: bigint (optional)
    //  receiver?: Address (optional)
  },
  makerTraits,
);

//  Sign the order
const typedData = order.getTypedData();
const signature = await maker.signTypedData(
  typedData.domain,
  { Order: typedData.types.Order },
  typedData.message,
);

//  Submit to orderbook
await sdk.submitOrder(order, signature);
```

### RFQ Order Creation

> ** Pro Tip**  
> RfqOrder is a lightweight, gas-efficient version of LimitOrder optimized for market makers. It doesn't support multiple fills and extensions but offers superior performance.

```javascript
import { RfqOrder, Address, randBigInt } from "@1inch/limit-order-sdk";
import { UINT_40_MAX } from "@1inch/byte-utils";
import { Wallet } from "ethers";

//  Test private key - DO NOT use in production!
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const maker = new Wallet(privateKey);
const expiresIn = 120n; //  2 minutes
const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;

//  Create RFQ order
const order = new RfqOrder(
  {
    makerAsset: new Address("0xdac17f958d2ee523a2206206994597c13d831ec7"), //  USDT
    takerAsset: new Address("0x111111111117dc0aa78b770fa6a738034120c302"), //  1INCH
    makingAmount: 100_000000n, //  100 USDT (6 decimals)
    takingAmount: 10_00000000000000000n, //  10 1INCH (18 decimals)
    maker: new Address(maker.address),
  },
  {
    allowedSender: new Address("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), //  Specific taker only
    expiration,
    nonce: randBigInt(UINT_40_MAX),
  },
);

//  Sign the RFQ order
const typedData = order.getTypedData();
const signature = await maker.signTypedData(
  typedData.domain,
  { Order: typedData.types.Order },
  typedData.message,
);
```

#### RFQ vs Standard Orders Comparison

| Feature            |  Standard Orders |  RFQ Orders    |
| ------------------ | ------------------ | ---------------- |
| **Gas Efficiency** |  Moderate        |  **High**      |
| **Partial Fills**  |  Supported       |  Not supported |
| **Multiple Fills** |  Supported       |  Not supported |
| **Extensions**     |  Supported       |  Not supported |
| **Market Making**  |  Good            |  **Excellent** |

---

## API Usage

> ** Flexible HTTP Connectors**  
> The SDK supports multiple HTTP providers including Fetch API (built-in) and Axios (external package).

### Basic API Setup

```javascript
import {Api, FetchProviderConnector, LimitOrder, HttpProviderConnector} from '@1inch/limit-order-sdk'

const chainId = 1 //  Ethereum mainnet
const api = new Api({
    networkId: chainId,
    authKey: 'your_api_key', //  Get from https://portal.1inch.dev/
    httpConnector: new FetchProviderConnector() //  Built-in connector
})

//  Submit order to orderbook
const order = ... // 👆 See order creation examples above
const signature = '0x...'
await api.submitOrder(order, signature)

//  Get order by hash
const orderHash = order.getOrderHash(chainId)
const orderInfo = await api.getOrderByHash(orderHash)

//  Get all orders by maker address
const orders = await api.getOrdersByMaker(order.maker)
```

### Using Axios HTTP Provider

> ** Additional Installation Required**  
> The axios package must be installed separately for this connector.

```bash
# Install axios first
bun add axios
```

```javascript
import { Api, LimitOrder } from "@1inch/limit-order-sdk";
import { AxiosProviderConnector } from "@1inch/limit-order-sdk/axios";

const api = new Api({
  networkId: 1, //  Ethereum mainnet
  authKey: "your_api_key", //  Get from https://portal.1inch.dev/
  httpConnector: new AxiosProviderConnector(), //  Axios-based connector
});
```

#### HTTP Connector Comparison

| Connector                  |  Dependencies   |  Setup      |  Performance  |
| -------------------------- | ----------------- | ------------- | --------------- |
| **FetchProviderConnector** |  Built-in       |  Simple     |  Native       |
| **AxiosProviderConnector** |  Requires axios |  Extra step |  Feature-rich |

---

## Testing

> ** Quality Assurance**  
> The SDK includes comprehensive test suites to ensure reliability and correctness of your integrations.

### Unit Tests

#### Setup Dependencies

```bash
# Install all required packages
bun install
```

#### Run Unit Tests

```bash
# Execute the complete unit test suite
bun test
```

### Integration Tests

> ** Advanced Testing**  
> Integration tests use Foundry fork nodes to simulate real blockchain transactions in a controlled environment.

#### Setup Dependencies

```bash
# Install SDK dependencies and Foundry contracts
bun install && forge install
```

#### Run Integration Tests

```bash
# Execute full integration test suite
bun test:integration
```

### Test Coverage Overview

| Test Type             |  Purpose           |  Location           |  Speed    |
| --------------------- | -------------------- | --------------------- | ----------- |
| **Unit Tests**        | Component validation | `/tests/unit/`        |  Fast     |
| **Integration Tests** | End-to-end workflows | `/tests/integration/` |  Moderate |

> ** Development Tip**  
> Run unit tests during development for quick feedback, and integration tests before deployment to ensure full compatibility.

---

## Next Steps

 **Installation Complete!** You're ready to start building with the 1inch Limit Order SDK.

### What's Next?

1. ** Read the Integration Guide** - [Learn order creation and management](./integration.md)
2. ** Explore SDK Features** - [Review the complete SDK overview](./overview.md)
3. ** Understand Contracts** - [Study maker and taker contracts](../limit-order-maker-contract.md)
4. ** Build Extensions** - [Add custom functionality](../extensions.md)

### Need Help?

-  **Documentation**: Comprehensive guides and API references
-  **1inch Portal**: [Get API keys and access developer resources](https://portal.1inch.dev/)
-  **Community**: Join the 1inch developer community for support
