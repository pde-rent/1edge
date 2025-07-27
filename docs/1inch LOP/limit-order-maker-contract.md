# Limit Order Maker Contract

This document describes the functions and classes used for creating and managing limit orders in the 1inch Limit Order Protocol.

## Functions

### calcTakingAmount

Calculates taker amount by linear proportion.

| Function | Type |
| -------- | ---- |
| `calcTakingAmount` | `(swapMakerAmount: bigint, orderMakerAmount: bigint, orderTakerAmount: bigint) => bigint` |

### calcMakingAmount

Calculates maker amount by linear proportion.

| Function | Type |
| -------- | ---- |
| `calcMakingAmount` | `(swapTakerAmount: bigint, orderMakerAmount: bigint, orderTakerAmount: bigint) => bigint` |

## MakerTraits

The MakerTraits type is an uint256, and different parts of the number are used to encode different traits.

### High bits (flags)
- **255 bit**: `NO_PARTIAL_FILLS_FLAG` - if set, the order does not allow partial fills
- **254 bit**: `ALLOW_MULTIPLE_FILLS_FLAG` - if set, the order permits multiple fills
- **253 bit**: unused
- **252 bit**: `PRE_INTERACTION_CALL_FLAG` - if set, the order requires pre-interaction call
- **251 bit**: `POST_INTERACTION_CALL_FLAG` - if set, the order requires post-interaction call
- **250 bit**: `NEED_CHECK_EPOCH_MANAGER_FLAG` - if set, the order requires to check the epoch manager
- **249 bit**: `HAS_EXTENSION_FLAG` - if set, the order has extension(s)
- **248 bit**: `USE_PERMIT2_FLAG` - if set, the order uses permit2
- **247 bit**: `UNWRAP_WETH_FLAG` - if set, the order requires to unwrap WETH

### Low 200 bits (data fields)
- **uint80**: last 10 bytes of allowed sender address (0 if any)
- **uint40**: expiration timestamp (0 if none)
- **uint40**: nonce or epoch
- **uint40**: series

### Methods

#### default

Creates default MakerTraits instance.

| Method | Type |
| ------ | ---- |
| `default` | `() => MakerTraits` |

#### allowedSender

Returns last 10 bytes of address.

| Method | Type |
| ------ | ---- |
| `allowedSender` | `() => string` |

#### isPrivate

Checks if order is private.

| Method | Type |
| ------ | ---- |
| `isPrivate` | `() => boolean` |

#### withAllowedSender

Sets allowed sender.

| Method | Type |
| ------ | ---- |
| `withAllowedSender` | `(sender: Address) => this` |

#### withAnySender

Removes sender check on contract.

| Method | Type |
| ------ | ---- |
| `withAnySender` | `() => this` |

#### expiration

Returns expiration timestamp. If null is returned, the order has no expiration.

| Method | Type |
| ------ | ---- |
| `expiration` | `() => bigint or null` |

#### withExpiration

Sets order expiration time.

| Method | Type |
| ------ | ---- |
| `withExpiration` | `(expiration: bigint) => this` |

Parameters:
- `expiration`: expiration timestamp in seconds

#### nonceOrEpoch

Returns epoch if `isEpochManagerEnabled()` is true, otherwise returns nonce.

| Method | Type |
| ------ | ---- |
| `nonceOrEpoch` | `() => bigint` |

#### withNonce

Sets nonce. Note: nonce and epoch share the same field, so they can't be set together.

| Method | Type |
| ------ | ---- |
| `withNonce` | `(nonce: bigint) => this` |

Parameters:
- `nonce`: must be less than or equal to uint40::max

#### withEpoch

Enables epoch manager check. If set, the contract will check that order epoch equals to epoch on SeriesEpochManager contract.

Note: epoch manager can be used only when partialFills AND multipleFills are allowed. Nonce and epoch share the same field, so they can't be set together.

| Method | Type |
| ------ | ---- |
| `withEpoch` | `(series: bigint, epoch: bigint) => this` |

Parameters:
- `series`: subgroup for epoch
- `epoch`: unique order id inside series

#### series

Gets current series.

| Method | Type |
| ------ | ---- |
| `series` | `() => bigint` |

#### hasExtension

Returns true if order has an extension, false otherwise.

| Method | Type |
| ------ | ---- |
| `hasExtension` | `() => boolean` |

#### withExtension

Marks that order has an extension.

| Method | Type |
| ------ | ---- |
| `withExtension` | `() => this` |

#### isPartialFillAllowed

Checks if partial fills are allowed for order.

| Method | Type |
| ------ | ---- |
| `isPartialFillAllowed` | `() => boolean` |

#### disablePartialFills

Disables partial fills for order.

| Method | Type |
| ------ | ---- |
| `disablePartialFills` | `() => this` |

#### allowPartialFills

Allows partial fills for order.

| Method | Type |
| ------ | ---- |
| `allowPartialFills` | `() => this` |

#### setPartialFills

Sets partial fill flag to passed value.

| Method | Type |
| ------ | ---- |
| `setPartialFills` | `(val: boolean) => this` |

#### isMultipleFillsAllowed

Returns true if order allows more than one fill, false otherwise.

| Method | Type |
| ------ | ---- |
| `isMultipleFillsAllowed` | `() => boolean` |

#### allowMultipleFills

Allows many fills for order.

| Method | Type |
| ------ | ---- |
| `allowMultipleFills` | `() => this` |

#### disableMultipleFills

Allows at most 1 fill for order.

| Method | Type |
| ------ | ---- |
| `disableMultipleFills` | `() => this` |

#### setMultipleFills

If val is true, then multiple fills are allowed, otherwise disallowed.

| Method | Type |
| ------ | ---- |
| `setMultipleFills` | `(val: boolean) => this` |

#### hasPreInteraction

Returns true if maker has pre-interaction, false otherwise.

| Method | Type |
| ------ | ---- |
| `hasPreInteraction` | `() => boolean` |

#### enablePreInteraction

Enables maker pre-interaction.

| Method | Type |
| ------ | ---- |
| `enablePreInteraction` | `() => this` |

#### disablePreInteraction

Disables maker pre-interaction.

| Method | Type |
| ------ | ---- |
| `disablePreInteraction` | `() => this` |

#### hasPostInteraction

Returns true if maker has post-interaction, false otherwise.

| Method | Type |
| ------ | ---- |
| `hasPostInteraction` | `() => boolean` |

#### enablePostInteraction

Enables maker post-interaction.

| Method | Type |
| ------ | ---- |
| `enablePostInteraction` | `() => this` |

#### disablePostInteraction

Disables maker post-interaction.

| Method | Type |
| ------ | ---- |
| `disablePostInteraction` | `() => this` |

#### isEpochManagerEnabled

Returns true if epoch manager is enabled.

| Method | Type |
| ------ | ---- |
| `isEpochManagerEnabled` | `() => boolean` |

#### isPermit2

Returns true if permit2 is enabled for maker funds transfer.

| Method | Type |
| ------ | ---- |
| `isPermit2` | `() => boolean` |

#### enablePermit2

Uses permit2 to transfer maker funds to contract.

| Method | Type |
| ------ | ---- |
| `enablePermit2` | `() => this` |

#### disablePermit2

Does not use permit2 to transfer maker funds to contract.

| Method | Type |
| ------ | ---- |
| `disablePermit2` | `() => this` |

#### isNativeUnwrapEnabled

Checks if WRAPPED token will be unwrapped to NATIVE before sending to maker.

| Method | Type |
| ------ | ---- |
| `isNativeUnwrapEnabled` | `() => boolean` |

#### enableNativeUnwrap

Unwraps WRAPPED token to NATIVE before sending it to maker.

| Method | Type |
| ------ | ---- |
| `enableNativeUnwrap` | `() => this` |

#### disableNativeUnwrap

Does not unwrap WRAPPED token to NATIVE before sending it to maker.

| Method | Type |
| ------ | ---- |
| `disableNativeUnwrap` | `() => this` |

#### asBigInt

Converts MakerTraits to bigint.

| Method | Type |
| ------ | ---- |
| `asBigInt` | `() => bigint` |

#### isBitInvalidatorMode

Returns true if bit invalidator mode is used to invalidate order (cancel/mark as filled).

Bit invalidator is cheaper in terms of gas, but can be used only when partial fills OR multiple fills are disabled.

| Method | Type |
| ------ | ---- |
| `isBitInvalidatorMode` | `() => boolean` |

## LimitOrder

The LimitOrder class represents a limit order in the protocol.

### Methods

#### buildSalt

Builds correct salt for order. If order has extension, it is crucial to build correct salt otherwise order won't be filled.

| Method | Type |
| ------ | ---- |
| `buildSalt` | `(extension: Extension, baseSalt?: bigint) => bigint` |

#### verifySalt

Verifies salt against extension.

| Method | Type |
| ------ | ---- |
| `verifySalt` | `(salt: bigint, extension: Extension) => bigint` |

#### fromCalldata

Creates LimitOrder from calldata.

| Method | Type |
| ------ | ---- |
| `fromCalldata` | `(bytes: string) => LimitOrder` |

#### fromDataAndExtension

Creates LimitOrder from data and extension.

| Method | Type |
| ------ | ---- |
| `fromDataAndExtension` | `(data: LimitOrderV4Struct, extension: Extension) => LimitOrder` |

#### toCalldata

Converts LimitOrder to calldata.

| Method | Type |
| ------ | ---- |
| `toCalldata` | `() => string` |

#### build

Builds LimitOrderV4Struct.

| Method | Type |
| ------ | ---- |
| `build` | `() => LimitOrderV4Struct` |

#### getTypedData

Gets EIP-712 typed data for signing.

| Method | Type |
| ------ | ---- |
| `getTypedData` | `(chainId: number) => EIP712TypedData` |

#### getOrderHash

Gets order hash.

| Method | Type |
| ------ | ---- |
| `getOrderHash` | `(chainId: number) => string` |

#### isPrivate

Returns true if only a specific address can fill order.

| Method | Type |
| ------ | ---- |
| `isPrivate` | `() => boolean` |

### Properties

| Property | Type |
| -------- | ---- |
| `salt` | `bigint` |
| `maker` | `Address` |
| `receiver` | `Address` |
| `makerAsset` | `Address` |
| `takerAsset` | `Address` |
| `makingAmount` | `bigint` |
| `takingAmount` | `bigint` |
| `makerTraits` | `MakerTraits` |

## Interaction

The Interaction class represents an interaction in the protocol.

### Methods

#### decode

Creates Interaction from bytes.

| Method | Type |
| ------ | ---- |
| `decode` | `(bytes: string) => Interaction` |

Parameters:
- `bytes`: Hex string with 0x. First 20 bytes are target, then data

#### encode

Encodes interaction as hex string with 0x. First 20 bytes are target, then data.

| Method | Type |
| ------ | ---- |
| `encode` | `() => string` |

## LimitOrderWithFee

The LimitOrderWithFee class extends LimitOrder with fee functionality.

### Methods

#### withRandomNonce

Sets random nonce to makerTraits and creates LimitOrderWithFee.

| Method | Type |
| ------ | ---- |
| `withRandomNonce` | `(orderInfo: Omit<OrderInfoData, "receiver">, feeExtension: FeeTakerExtension, makerTraits?: MakerTraits) => LimitOrderWithFee` |

#### fromDataAndExtension

Creates LimitOrderWithFee from data and extension.

| Method | Type |
| ------ | ---- |
| `fromDataAndExtension` | `(data: LimitOrderV4Struct, extension: Extension) => LimitOrderWithFee` |

#### getTakingAmount

Calculates the takingAmount required from the taker in exchange for the makingAmount.

| Method | Type |
| ------ | ---- |
| `getTakingAmount` | `(taker: Address, makingAmount?: bigint) => bigint` |

Parameters:
- `makingAmount`: amount to be filled

#### getMakingAmount

Calculates the makingAmount that the taker receives in exchange for the takingAmount.

| Method | Type |
| ------ | ---- |
| `getMakingAmount` | `(taker: Address, takingAmount?: bigint) => bigint` |

Parameters:
- `takingAmount`: amount to be filled

#### getResolverFee

Fee in takerAsset which resolver pays to resolver fee receiver.

| Method | Type |
| ------ | ---- |
| `getResolverFee` | `(taker: Address, makingAmount?: bigint) => bigint` |

Parameters:
- `taker`: who will fill order
- `makingAmount`: amount wanted to fill

#### getIntegratorFee

Fee in takerAsset which integrator gets to integrator wallet.

| Method | Type |
| ------ | ---- |
| `getIntegratorFee` | `(taker: Address, makingAmount?: bigint) => bigint` |

Parameters:
- `taker`: who will fill order
- `makingAmount`: amount wanted to fill

#### getProtocolFee

Fee in takerAsset which protocol gets. It equals to share from integrator fee plus resolver fee.

| Method | Type |
| ------ | ---- |
| `getProtocolFee` | `(taker: Address, makingAmount?: bigint) => bigint` |

Parameters:
- `taker`: who will fill order
- `makingAmount`: amount wanted to fill

## TakerTraits

The TakerTraits class defines traits used to encode the taker's preferences for an order in a single uint256.

### Structure

The TakerTraits are structured as follows:

#### High bits (flags)
- **255 bit**: `_MAKER_AMOUNT_FLAG` - If set, the taking amount is calculated based on making amount, otherwise making amount is calculated based on taking amount
- **254 bit**: `_UNWRAP_WETH_FLAG` - If set, the WETH will be unwrapped into ETH before sending to taker
- **253 bit**: `_SKIP_ORDER_PERMIT_FLAG` - If set, the order skips maker's permit execution
- **252 bit**: `_USE_PERMIT2_FLAG` - If set, the order uses the permit2 function for authorization
- **251 bit**: `_ARGS_HAS_TARGET` - If set, then first 20 bytes of args are treated as receiver address for maker's funds transfer

#### Middle bits (lengths)
- **224-247 bits**: `ARGS_EXTENSION_LENGTH` - The length of the extension calldata in the args
- **200-223 bits**: `ARGS_INTERACTION_LENGTH` - The length of the interaction calldata in the args

#### Low bits (data)
- **0-184 bits**: The threshold amount (the maximum amount a taker agrees to give in exchange for a making amount)

### Methods

#### default

Creates default TakerTraits instance.

| Method | Type |
| ------ | ---- |
| `default` | `() => TakerTraits` |

#### getAmountMode

Returns enabled amount mode, defining how to treat passed amount in fillContractOrderArgs function.

| Method | Type |
| ------ | ---- |
| `getAmountMode` | `() => AmountMode` |

#### setAmountMode

Sets amount mode.

| Method | Type |
| ------ | ---- |
| `setAmountMode` | `(mode: AmountMode) => this` |

#### isNativeUnwrapEnabled

Checks if Wrapped native currency will be unwrapped into Native currency before sending to taker.

| Method | Type |
| ------ | ---- |
| `isNativeUnwrapEnabled` | `() => boolean` |

#### enableNativeUnwrap

Wrapped native currency will be unwrapped into Native currency before sending to taker.

| Method | Type |
| ------ | ---- |
| `enableNativeUnwrap` | `() => this` |

#### disableNativeUnwrap

Wrapped native currency will NOT be unwrapped into Native currency before sending to taker.

| Method | Type |
| ------ | ---- |
| `disableNativeUnwrap` | `() => this` |

#### isOrderPermitSkipped

Returns true if maker's permit execution is skipped.

| Method | Type |
| ------ | ---- |
| `isOrderPermitSkipped` | `() => boolean` |

#### skipOrderPermit

The order skips maker's permit execution.

| Method | Type |
| ------ | ---- |
| `skipOrderPermit` | `() => this` |

#### isPermit2Enabled

Checks if permit2 function should be used for authorization.

| Method | Type |
| ------ | ---- |
| `isPermit2Enabled` | `() => boolean` |

#### enablePermit2

Uses permit2 function for authorization.

| Method | Type |
| ------ | ---- |
| `enablePermit2` | `() => this` |

#### disablePermit2

Does NOT use permit2 function for authorization.

| Method | Type |
| ------ | ---- |
| `disablePermit2` | `() => this` |

#### setReceiver

Sets address where order is filled to. Uses msg.sender if not set.

| Method | Type |
| ------ | ---- |
| `setReceiver` | `(receiver: Address) => this` |

#### removeReceiver

Sets order receiver as msg.sender.

| Method | Type |
| ------ | ---- |
| `removeReceiver` | `() => this` |

#### setExtension

Sets extension. It is required to provide same extension as in order creation (if any).

| Method | Type |
| ------ | ---- |
| `setExtension` | `(ext: Extension) => this` |

#### removeExtension

Removes extension.

| Method | Type |
| ------ | ---- |
| `removeExtension` | `() => this` |

#### setAmountThreshold

Sets threshold amount.

In taker amount mode: the minimum amount a taker agrees to receive in exchange for a taking amount.
In maker amount mode: the maximum amount a taker agrees to give in exchange for a making amount.

| Method | Type |
| ------ | ---- |
| `setAmountThreshold` | `(threshold: bigint) => this` |

#### getAmountThreshold

Gets threshold amount.

In taker amount mode: the minimum amount a taker agrees to receive in exchange for a taking amount.
In maker amount mode: the maximum amount a taker agrees to give in exchange for a making amount.

| Method | Type |
| ------ | ---- |
| `getAmountThreshold` | `() => bigint` |

#### removeAmountThreshold

Removes amount threshold.

| Method | Type |
| ------ | ---- |
| `removeAmountThreshold` | `() => this` |

#### setInteraction

Sets taker interaction. The interaction.target should implement ITakerInteraction interface.

| Method | Type |
| ------ | ---- |
| `setInteraction` | `(interaction: Interaction) => this` |

#### removeInteraction

Removes interaction.

| Method | Type |
| ------ | ---- |
| `removeInteraction` | `() => this` |

#### encode

Encodes TakerTraits.

| Method | Type |
| ------ | ---- |
| `encode` | `() => { trait: bigint; args: string; }` |

## Enumerations

### AmountMode

| Property | Value | Description |
| -------- | ----- | ----------- |
| `taker` | `0` | Amount provided to fill function treated as takingAmount and makingAmount calculated based on it |
| `maker` | `1` | Amount provided to fill function treated as makingAmount and takingAmount calculated based on it |