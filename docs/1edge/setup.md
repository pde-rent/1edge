# Development Setup

## Prerequisites

- **Bun**: This project uses [Bun](https://bun.sh) as the JavaScript runtime and package manager
- **Node.js**: Required for some development tools (v18+ recommended)
- **Git**: For version control and submodule management

## Installation

1. Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Clone the repository with submodules:

```bash
git clone --recursive https://github.com/pde-rent/1edge.git
cd 1edge
```

Or if you already cloned without submodules:

```bash
git clone https://github.com/pde-rent/1edge.git
cd 1edge
git submodule update --init --recursive
```

3. Install all dependencies (this automatically handles submodules and builds the SDK):

```bash
bun install
```

This will:
- Initialize and update git submodules (1inch SDK)
- Install dependencies for all workspaces (front, back, contracts)
- Build the 1inch SDK from source
- Set up the complete development environment

## Monorepo Structure

This project is organized as a monorepo with the following workspaces:

- **`front/`**: Next.js frontend application
- **`back/`**: Bun backend services
- **`contracts/`**: Hardhat smart contracts
- **`sdk-source/`**: 1inch SDK submodule (automatically managed)

## Quick Start

After installation, start the development environment:

```bash
# Terminal 1: Start backend services
bun run start:back

# Terminal 2: Start frontend development server
bun run start:front
```

The application will be available at:
- Frontend: http://localhost:40006
- Backend API: http://localhost:40005

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

### Building All Components

```bash
# Build everything (contracts, SDK, frontend)
bun run build:all

# Build individual components
bun run build:contracts    # Compile smart contracts
bun run build:sdk         # Build 1inch SDK from source
bun run build:front       # Build frontend for production
```

### Backend Services

```bash
# Start all backend services (recommended)
bun run start:back

# Start individual services
bun run start:api          # API server
bun run start:keeper       # Keeper service
bun run start:collector    # Data collector
bun run start:websocket    # WebSocket server
bun run start:status-checker # Status monitoring

# Development mode (with auto-restart)
bun run dev:back
```

### Frontend Development

```bash
# Start development server
bun run start:front

# Development mode (alternative)
bun run dev:front

# Build for production
bun run build:front
```

### Smart Contracts

```bash
# Navigate to contracts workspace
cd contracts

# Compile contracts
bun run compile

# Run contract tests
bun run test

# Deploy contracts to local network
bun run deploy

# Start local Hardhat node
bunx hardhat node
```

### SDK Management

```bash
# Clean and rebuild SDK
bun run clean:sdk
bun run build:sdk

# Update SDK submodule to latest
git submodule update --remote sdk-source
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

## Workspace Management

This monorepo uses Bun workspaces for dependency management:

```bash
# Install dependencies for all workspaces
bun install

# Add dependency to specific workspace
cd front && bun add <package>           # Frontend
cd back && bun add <package>            # Backend  
cd contracts && bun add <package>       # Contracts

# Add dev dependency
bun add -d <package>

# Remove dependency
bun remove <package>

# Update all dependencies
bun update
```

## Type Checking and Linting

```bash
# Type check all workspaces
bun run typecheck:all

# Type check individual workspaces
bun run typecheck:back
bun run typecheck:front
bun run typecheck:contracts

# Lint and format code
bun run lint              # Check formatting and lint
bun run lint:fix          # Auto-fix formatting and lint issues
bun run format            # Format code with Prettier
```

## Troubleshooting

### Common Issues

1. **Submodule not initialized**:
   ```bash
   git submodule update --init --recursive
   ```

2. **SDK build fails**:
   ```bash
   bun run clean:sdk
   bun run build:sdk
   ```

3. **Port conflicts**:
   ```bash
   bun run kill:all          # Kill all running services
   ```

4. **Dependency issues**:
   ```bash
   rm -rf node_modules */node_modules
   bun install
   ```

### Clean Rebuild

For a complete clean rebuild:

```bash
# Clean everything
bun run clean:all

# Reinstall and rebuild
rm -rf node_modules */node_modules
bun install
bun run build:all
```

## Notes

- Always use `bun` instead of `npm` or `yarn`
- Use `bunx` instead of `npx` for executing packages
- Bun is significantly faster than npm/yarn for installation and script execution
- All scripts in package.json files are executed with `bun run`
- The SDK submodule is automatically managed during `bun install`
- Each workspace has its own package.json and can have workspace-specific dependencies
