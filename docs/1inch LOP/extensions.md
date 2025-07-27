# Extensions

This document describes the Extension and ExtensionBuilder classes used in the 1inch Limit Order Protocol.

## Extension Class

The Extension class provides functionality for encoding and decoding order extensions.

### Methods

- [decode](#decode)
- [default](#default)
- [keccak256](#keccak256)
- [isEmpty](#isempty)
- [encode](#encode)

#### decode

Creates an Extension instance from bytes.

| Method | Type |
| ---------- | ---------- |
| `decode` | `(bytes: string) => Extension` |

#### default

Creates a default Extension instance.

| Method | Type |
| ---------- | ---------- |
| `default` | `() => Extension` |

#### keccak256

Calculates the keccak256 hash of the extension.

| Method | Type |
| ---------- | ---------- |
| `keccak256` | `() => bigint` |

#### isEmpty

Checks if the extension is empty.

| Method | Type |
| ---------- | ---------- |
| `isEmpty` | `() => boolean` |

#### encode

Encodes the extension as a hex string with 0x prefix.

| Method | Type |
| ---------- | ---------- |
| `encode` | `() => string` |

### Properties

- [EMPTY](#empty)
- [makerAssetSuffix](#makerassetsuffix)
- [takerAssetSuffix](#takerassetsuffix)
- [makingAmountData](#makingamountdata)
- [takingAmountData](#takingamountdata)
- [predicate](#predicate)
- [makerPermit](#makerpermit)
- [preInteraction](#preinteraction)
- [postInteraction](#postinteraction)
- [customData](#customdata)

#### EMPTY

An object representing an empty extension.

| Property | Type |
| ---------- | ---------- |
| `EMPTY` | `{ makerAssetSuffix: string; takerAssetSuffix: string; makingAmountData: string; takingAmountData: string; predicate: string; makerPermit: string; preInteraction: string; postInteraction: string; customData: string; }` |

#### makerAssetSuffix

Additional data for the maker asset.

| Property | Type |
| ---------- | ---------- |
| `makerAssetSuffix` | `string` |

#### takerAssetSuffix

Additional data for the taker asset.

| Property | Type |
| ---------- | ---------- |
| `takerAssetSuffix` | `string` |

#### makingAmountData

Data for calculating the making amount.

| Property | Type |
| ---------- | ---------- |
| `makingAmountData` | `string` |

#### takingAmountData

Data for calculating the taking amount.

| Property | Type |
| ---------- | ---------- |
| `takingAmountData` | `string` |

#### predicate

Predicate for conditional order execution.

| Property | Type |
| ---------- | ---------- |
| `predicate` | `string` |

#### makerPermit

Permit data for the maker.

| Property | Type |
| ---------- | ---------- |
| `makerPermit` | `string` |

#### preInteraction

Pre-interaction data.

| Property | Type |
| ---------- | ---------- |
| `preInteraction` | `string` |

#### postInteraction

Post-interaction data.

| Property | Type |
| ---------- | ---------- |
| `postInteraction` | `string` |

#### customData

Custom extension data.

| Property | Type |
| ---------- | ---------- |
| `customData` | `string` |

## ExtensionBuilder Class

The ExtensionBuilder class provides a fluent interface for building Extension instances.

### Methods

- [withMakerAssetSuffix](#withmakerassetsuffix)
- [withTakerAssetSuffix](#withtakerassetsuffix)
- [withMakingAmountData](#withmakingamountdata)
- [withTakingAmountData](#withtakingamountdata)
- [withPredicate](#withpredicate)
- [withMakerPermit](#withmakerpermit)
- [withPreInteraction](#withpreinteraction)
- [withPostInteraction](#withpostinteraction)
- [withCustomData](#withcustomdata)
- [build](#build)

#### withMakerAssetSuffix

Sets the maker asset suffix.

| Method | Type |
| ---------- | ---------- |
| `withMakerAssetSuffix` | `(suffix: string) => this` |

#### withTakerAssetSuffix

Sets the taker asset suffix.

| Method | Type |
| ---------- | ---------- |
| `withTakerAssetSuffix` | `(suffix: string) => this` |

#### withMakingAmountData

Sets the making amount calculation data.

| Method | Type |
| ---------- | ---------- |
| `withMakingAmountData` | `(address: Address, data: string) => this` |

Parameters:

* `address`: Address of contract which will be called with `data` to calculate making amount


#### withTakingAmountData

Sets the taking amount calculation data.

| Method | Type |
| ---------- | ---------- |
| `withTakingAmountData` | `(address: Address, data: string) => this` |

Parameters:

* `address`: Address of contract which will be called with `data` to calculate taking amount


#### withPredicate

Sets the predicate for conditional execution.

| Method | Type |
| ---------- | ---------- |
| `withPredicate` | `(predicate: string) => this` |

#### withMakerPermit

Sets the maker permit data.

| Method | Type |
| ---------- | ---------- |
| `withMakerPermit` | `(tokenFrom: Address, permitData: string) => this` |

#### withPreInteraction

Sets the pre-interaction.

| Method | Type |
| ---------- | ---------- |
| `withPreInteraction` | `(interaction: Interaction) => this` |

#### withPostInteraction

Sets the post-interaction.

| Method | Type |
| ---------- | ---------- |
| `withPostInteraction` | `(interaction: Interaction) => this` |

#### withCustomData

Sets custom extension data.

| Method | Type |
| ---------- | ---------- |
| `withCustomData` | `(data: string) => this` |

#### build

Builds the Extension instance.

| Method | Type |
| ---------- | ---------- |
| `build` | `() => Extension` |

