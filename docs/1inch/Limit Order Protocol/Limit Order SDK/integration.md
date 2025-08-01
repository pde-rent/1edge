# Limit Orders Integration Guide

> ** Complete Integration Walkthrough**  
> Master the art of creating, signing, and managing limit orders with the 1inch Limit Order Protocol SDK. Build sophisticated trading applications with precision and control.

---

## Overview

Limit orders revolutionize DeFi trading by allowing users to define exact price and amount parameters for token trades. Here's how the magic happens:

### Order Lifecycle

| Phase            | 📍 Location  |  Action                   |  Technology |
| ---------------- | ------------ | --------------------------- | ------------- |
| **1. Creation**  |  Off-chain | Define trade parameters     |  SDK        |
| **2. Signing**   | 🔐 Off-chain | Cryptographic authorization |  EIP-712    |
| **3. Sharing**   | 📡 API       | Broadcast to orderbook      |  1inch API  |
| **4. Execution** | ⛓ On-chain  | Smart contract fulfillment  |  Protocol   |

### Key Benefits

- ** Precision**: Execute trades at exact target prices
- ** Efficiency**: Gas-optimized smart contract execution
- **🔒 Security**: Cryptographically signed and verified
- ** Accessibility**: Available across multiple networks

---

## Creating and Signing a Limit Order

> ** Security First**  
> Always use secure private key management in production. The example below is for demonstration purposes only.

### Complete Implementation Example

```javascript
import {
  Sdk,
  MakerTraits,
  Address,
  randBigInt,
  FetchProviderConnector,
} from "@1inch/limit-order-sdk";

import { Wallet } from "ethers";

//  Example private key (NEVER use in production!)
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const maker = new Wallet(privateKey);

//  Initialize SDK with authentication
const sdk = new Sdk({
  authKey: "YOUR_AUTH_KEY", //  Get from https://portal.1inch.dev/
  networkId: 1, //  Ethereum mainnet
  httpConnector: new FetchProviderConnector(), //  HTTP client
});

//  Configure order expiration (optional but recommended)
const expiresIn = 120n; // 2 minutes from now
const expiration = BigInt(Math.floor(Date.now() / 1000)) + expiresIn;
const UINT_40_MAX = (1n << 48n) - 1n;

//  Define order behavior traits
const makerTraits = MakerTraits.default()
  .withExpiration(expiration) //  Set expiration time
  .withNonce(randBigInt(UINT_40_MAX)); // 🎲 Unique identifier

//  Create the limit order
const order = await sdk.createOrder(
  {
    makerAsset: new Address("0xdAC17F958D2ee523a2206206994597C13D831ec7"), //  USDT
    takerAsset: new Address("0x111111111117dc0aa78b770fa6a738034120c302"), //  1INCH
    makingAmount: 100_000000n, //  100 USDT (6 decimals)
    takingAmount: 10_00000000000000000n, //  10 1INCH (18 decimals)
    maker: new Address(maker.address), // 👤 Order creator
  },
  makerTraits, //  Order configuration
);

//  Generate EIP-712 signature for verification
const typedData = order.getTypedData();
const signature = await maker.signTypedData(
  typedData.domain,
  { Order: typedData.types.Order },
  typedData.message,
);

//  Submit to 1inch Orderbook (optional)
await sdk.submitOrder(order, signature);
```

### Step-by-Step Breakdown

| Step                  |  Purpose            |  Details                                  |
| --------------------- | --------------------- | ------------------------------------------- |
| **1. SDK Setup**      | Initialize connection | Configure network, auth, and HTTP provider  |
| **2. Traits Config**  | Define order behavior | Set expiration, nonce, and other parameters |
| **3. Order Creation** | Specify trade details | Set tokens, amounts, and maker address      |
| **4. Signature**      | Cryptographic proof   | EIP-712 signing for security                |
| **5. Submission**     | Broadcast order       | Share with orderbook for matching           |

---

## Cryptographic Signing

> **🔒 EIP-712 Standard**  
> Orders use the EIP-712 structured data signing standard, ensuring cryptographic integrity and preventing unauthorized modifications.

### Security Guarantees

The EIP-712 signature provides multiple layers of protection:

- ** Precision**: Order can only be filled with exact parameters specified
- **🔐 Authentication**: Cryptographically proves maker authorization
- **⛓ Domain Binding**: Tied to specific network and protocol version
- **🚫 Replay Protection**: Prevents cross-chain and cross-protocol attacks

> ** Developer Tip**  
> The SDK handles all typed data construction automatically via `order.getTypedData()`. No manual EIP-712 implementation required!

---

## MakerTraits and Order Configuration

> ** Fine-Grained Control**  
> MakerTraits provide granular control over order behavior, execution rules, and lifecycle management.

### Core Configuration Options

| Feature            |  Description                               |  Method                     |  Default |
| ------------------ | -------------------------------------------- | ----------------------------- | ---------- |
| **Partial Fills**  | Allow order to be filled in chunks           | `.withPartialFill()`          | Enabled    |
| **Multiple Fills** | Allow same order to be filled multiple times | `.allowMultipleFills()`       | Disabled   |
| **Expiration**     | Set order deadline timestamp                 | `.withExpiration(timestamp)`  | None       |
| **Nonce**          | Unique identifier for order                  | `.withNonce(value)`           | Random     |
| **Private Orders** | Restrict filling to specific address         | `.withAllowedSender(address)` | Public     |

### Advanced Configuration Example

```javascript
import { MakerTraits, randBigInt } from "@1inch/limit-order-sdk";

const UINT_40_MAX = (1n << 48n) - 1n;
const futureTimestamp = BigInt(Math.floor(Date.now() / 1000)) + 3600n; // 1 hour

const advancedTraits = MakerTraits.default()
  .withPartialFill() //  Allow partial execution
  .allowMultipleFills() //  Allow multiple fills
  .withExpiration(futureTimestamp) //  Set 1-hour deadline
  .withNonce(randBigInt(UINT_40_MAX)) // 🎲 Unique identifier
  .enablePreInteraction() // 🔄 Enable pre-execution hooks
  .enablePostInteraction(); // 🔄 Enable post-execution hooks
```

### Use Case Examples

#### Standard Trading Order

```javascript
// Simple buy/sell order with expiration
const standardTraits = MakerTraits.default()
  .withExpiration(expiration)
  .withNonce(randBigInt(UINT_40_MAX));
```

#### Market Maker Order

```javascript
// Professional market maker configuration
const marketMakerTraits = MakerTraits.default()
  .allowMultipleFills() //  Reusable order
  .withPartialFill() //  Partial execution
  .withNonce(randBigInt(UINT_40_MAX));
```

#### Private Order

```javascript
// Restricted to specific taker
const privateTraits = MakerTraits.default()
  .withAllowedSender(new Address("0x1234...")) //  Specific taker only
  .withExpiration(expiration)
  .withNonce(randBigInt(UINT_40_MAX));
```

---

## Order Field Reference

> ** Essential Parameters**  
> Understanding each field is crucial for creating precise and effective limit orders.

### Core Order Fields

| Field              |  Type   | 💭 Description                    | 📏 Format                          |
| ------------------ | --------- | --------------------------------- | ---------------------------------- |
| **`makerAsset`**   | `Address` |  Token being sold by maker      | ERC-20 contract address            |
| **`takerAsset`**   | `Address` |  Token expected from taker      | ERC-20 contract address            |
| **`makingAmount`** | `bigint`  |  Amount maker is offering       | Wei units (respect token decimals) |
| **`takingAmount`** | `bigint`  |  Amount maker wants in return   | Wei units (respect token decimals) |
| **`maker`**        | `Address` | 👤 Order creator's wallet address | Ethereum address                   |

### Field Best Practices

#### Amount Calculations

```javascript
// 🧮 Always account for token decimals
const usdtAmount = 100n * 10n ** 6n; // 100 USDT (6 decimals)
const inchAmount = 10n * 10n ** 18n; // 10 1INCH (18 decimals)
```

#### Address Validation

```javascript
//  Use Address wrapper for type safety
import { Address } from "@1inch/limit-order-sdk";

const makerAsset = new Address("0xdAC17F958D2ee523a2206206994597C13D831ec7"); // USDT
const takerAsset = new Address("0x111111111117dc0aa78b770fa6a738034120c302"); // 1INCH
```

---

## Orderbook Integration

> **📡 Global Order Visibility**  
> Submit orders to the 1inch Orderbook API for maximum exposure to professional resolvers and market makers.

### Authentication Setup

Before submitting orders, obtain your API key:

1. ** Visit**: [1inch Developer Portal](https://portal.1inch.dev/)
2. ** Register**: Create developer account
3. ** Generate**: API authentication key
4. ** Configure**: Add key to SDK initialization

### Submission Process

```javascript
//  Submit order to global orderbook
try {
  await sdk.submitOrder(order, signature);
  console.log(" Order successfully submitted to orderbook!");
} catch (error) {
  console.error(" Submission failed:", error.message);
}
```

### Benefits of Orderbook Submission

| Advantage            |  Description                      |  Impact               |
| -------------------- | ----------------------------------- | ----------------------- |
| ** Global Reach**  | Visible to all network participants | Higher fill probability |
| ** Fast Matching** | Professional resolver network       | Quick execution         |
| ** Best Prices**   | Competitive market environment      | Optimal pricing         |
| ** Transparency**  | Public order visibility             | Market confidence       |

### Alternative Approaches

> ** Flexible Integration**  
> Orderbook submission is optional. You can also:

- ** Direct Integration**: Embed orders in your own application
- **🤝 Private Sharing**: Share orders with specific counterparties
- **📡 Custom APIs**: Build your own order distribution system

---

## Integration Complete!

 You now have the knowledge to create, sign, and manage sophisticated limit orders with the 1inch Protocol SDK.

### Next Steps

1. **🧪 Test Integration** - Deploy on testnets first
2. ** Explore Extensions** - Add custom functionality with [Extensions](../extensions.md)
3. ** Study Contracts** - Understand the underlying [smart contracts](../limit-order-maker-contract.md)
4. ** Monitor Orders** - Implement order tracking and management
