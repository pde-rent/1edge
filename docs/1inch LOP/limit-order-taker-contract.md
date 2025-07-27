# Limit Order Taker Contract

This document describes the LimitOrderContract class and its methods for filling limit orders in the 1inch Limit Order Protocol.

## LimitOrderContract

The LimitOrderContract class provides methods for creating calldata to fill orders.

### Methods

#### getFillOrderCalldata

Fills an order WITHOUT an extension and taker interaction.

| Method | Type |
| ------ | ---- |
| `getFillOrderCalldata` | `(order: LimitOrderV4Struct, signature: string, takerTraits: TakerTraits, amount: bigint) => string` |

Parameters:
- `order`: The limit order structure
- `signature`: Order signature
- `takerTraits`: Taker traits configuration
- `amount`: Amount to fill

Returns: Encoded calldata for the transaction

#### getFillContractOrderCalldata

Fills a contract order (order maker is smart-contract) WITHOUT an extension and taker interaction.

| Method | Type |
| ------ | ---- |
| `getFillContractOrderCalldata` | `(order: LimitOrderV4Struct, signature: string, takerTraits: TakerTraits, amount: bigint) => string` |

Parameters:
- `order`: The limit order structure
- `signature`: Order signature
- `takerTraits`: Taker traits configuration
- `amount`: Amount to fill

Returns: Encoded calldata for the transaction

#### getFillOrderArgsCalldata

Fills an order WITH an extension or taker interaction.

| Method | Type |
| ------ | ---- |
| `getFillOrderArgsCalldata` | `(order: LimitOrderV4Struct, signature: string, takerTraits: TakerTraits, amount: bigint) => string` |

Parameters:
- `order`: The limit order structure
- `signature`: Order signature
- `takerTraits`: Taker traits configuration
- `amount`: Amount to fill

Returns: Encoded calldata for the transaction

#### getFillContractOrderArgsCalldata

Fills a contract order (order maker is smart-contract) WITH an extension or taker interaction.

| Method | Type |
| ------ | ---- |
| `getFillContractOrderArgsCalldata` | `(order: LimitOrderV4Struct, signature: string, takerTraits: TakerTraits, amount: bigint) => string` |

Parameters:
- `order`: The limit order structure
- `signature`: Order signature
- `takerTraits`: Taker traits configuration
- `amount`: Amount to fill

Returns: Encoded calldata for the transaction

## Usage Notes

### Choosing the Right Method

1. **Order Type**:
   - Use `getFillOrderCalldata` or `getFillOrderArgsCalldata` for regular orders
   - Use `getFillContractOrderCalldata` or `getFillContractOrderArgsCalldata` for contract orders (where the maker is a smart contract)

2. **Extensions and Interactions**:
   - Use methods ending with `Calldata` when there are NO extensions or taker interactions
   - Use methods ending with `ArgsCalldata` when there ARE extensions or taker interactions

### Example Usage

```javascript
// For a regular order without extensions
const calldata = getFillOrderCalldata(order, signature, takerTraits, amount);

// For a contract order with extensions
const calldata = getFillContractOrderArgsCalldata(order, signature, takerTraits, amount);
```

The returned calldata can be used directly in a transaction to the 1inch Limit Order Protocol contract.