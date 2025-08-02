# Development Setup

## Prerequisites

- **Bun**: This project uses [Bun](https://bun.sh) as the JavaScript runtime and package manager
- **Node.js**: Required for some development tools (v18+ recommended)
- **Git**: For version control

## Installation

1. Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Clone the repository:

```bash
git clone https://github.com/pde-rent/1edge.git
cd 1edge
```

3. Install dependencies:

```bash
bun install
```

## Running Tests

All tests in this project are run using Bun:

### Smart Contract Tests

```bash
cd contracts
bunx hardhat test
```

### Backend Tests

```bash
cd backend
bun test
```

### Frontend Tests

```bash
cd frontend
bun test
```

## Development Commands

### Contracts

```bash
# Compile contracts
bunx hardhat compile

# Run tests
bunx hardhat test

# Deploy contracts
bunx hardhat run scripts/deployDelegateProxy.ts --network localhost

# Start local node
bunx hardhat node
```

### Backend Services

```bash
# Start all services
bun run start

# Start individual services
bun run start:api
bun run start:keeper
bun run start:executor
```

### Frontend

```bash
# Development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

## Environment Setup

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Key environment variables:

- `KEEPER_PK`: Private key for the keeper account
- `ONE_INCH_API_KEY`: Your 1inch API key
- `ETH_RPC_URL`: Ethereum RPC endpoint

## Package Management

This project uses Bun for all package management:

```bash
# Add a dependency
bun add <package>

# Add a dev dependency
bun add -d <package>

# Remove a dependency
bun remove <package>

# Update dependencies
bun update
```

## Notes

- Always use `bun` instead of `npm` or `yarn`
- Use `bunx` instead of `npx` for executing packages
- Bun is significantly faster than npm/yarn for installation and script execution
- All scripts in package.json files are executed with `bun run`
