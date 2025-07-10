# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important
- ALL instructions within this document MUST BE FOLLOWED, these are not optional unless explicitly stated.
- ASK FOR CLARIFICATION If you are uncertain of any of thing within the document.
- DO NOT edit more code than you have to.
- DO NOT WASTE TOKENS, be succinct and concise.


## Project Overview

This is a subgraph for indexing rewards and subsidies data for the lend.fam MVP platform. It tracks collection-based lending, yield distribution, and debt subsidization across multiple smart contracts including CollectionsVault, DebtSubsidizer, EpochManager, and Compound fork integration.

## Development Commands

### Core Subgraph Development
```bash
# Generate types from schema
npm run codegen

# Build subgraph
npm run build

# Deploy to production
npm run deploy

# Local development
npm run create-local
npm run deploy-local
npm run remove-local
```

### Testing
```bash
# Run unit tests (matchstick-as)
npm run test

# Run integration tests (jest)
npm run test:integration

# Run with coverage
npm run coverage
```

### Performance Testing
```bash
# Sync performance test
npm run test:perf:sync

# Query load testing (k6)
npm run test:perf:query

# Query profiling
npm run test:perf:profile
```

### Code Quality
```bash
# Run linting
npx eslint .

# Format code
npx prettier --write .
```

## Architecture Overview

### Core Entity Relationships
- **CollectionsVault**: Main ERC4626 vault managing collection-based deposits and yield
- **DebtSubsidizer**: Handles subsidy distribution via merkle trees and direct claims
- **EpochManager**: Manages time-based epochs for yield and subsidy allocation
- **Collections**: NFT collections with configurable yield share percentages
- **Accounts**: User accounts with subsidy tracking and market positions

### Smart Contract Integration
The subgraph indexes events from:
- **Comptroller**: Compound fork market management
- **cToken**: Individual lending markets (created via templates)
- **CollectionRegistry**: Collection configuration and vault associations
- **LendingManager**: Protocol deposits/withdrawals and principal tracking
- **EpochManager**: Epoch lifecycle and yield allocation
- **DebtSubsidizer**: Subsidy distributions and merkle root updates

### Data Flow Architecture
1. **Event Indexing**: Contract events → Mapping handlers → Entity updates
2. **Template System**: Dynamic cToken markets created via templates
3. **Batch Operations**: Efficient handling of large-scale subsidy distributions
4. **Yield Tracking**: Collection-specific yield accrual and distribution
5. **Subsidy Calculation**: Time-weighted subsidy accumulation based on NFT holdings

## Key Files Structure

### Mapping Files (`src/`)
- `debt-subsidizer-mapping.ts`: Core subsidy distribution logic
- `collection-vault-mapping.ts`: Collection deposits/withdrawals and yield
- `epoch-manager-mapping.ts`: Epoch lifecycle and allocation
- `ctoken-mapping.ts`: Template handler for cToken markets
- `collection-registry-mapping.ts`: Collection configuration
- `lending-manager-mapping.ts`: Protocol deposit/withdrawal tracking

### Utility Functions (`src/utils/`)
- `subsidies.ts`: Subsidy calculation and tracking logic
- `getters.ts`: Entity loading and creation utilities
- `id-generation.ts`: Consistent ID generation patterns
- `batch-operations.ts`: Efficient bulk operations
- `ctoken-cache.ts`: cToken market caching

### Testing (`tests/`)
- `handlers/`: Unit tests for each mapping handler
- `utils/`: Helper utilities for testing
- `__mocks__/`: Mock implementations for graph-ts

## Development Patterns

### Entity ID Generation
Use consistent ID patterns from `id-generation.ts`:
- Account-Collection: `${account}-${collection}`
- Epoch-Vault: `${epochId}-${vault}`
- Transaction-specific: `${txHash}-${logIndex}`

### Subsidy Tracking
- Use `calculateSubsidyAccrual()` for time-weighted calculations
- Track both `secondsAccumulated` and `secondsClaimed`
- Handle claim events with proper reset logic to prevent double-counting

### Testing Strategy
- Unit tests with matchstick-as for mapping logic
- Integration tests with Jest for complex scenarios
- Performance tests with k6 for GraphQL queries
- Mock external dependencies consistently

## Common Issues

### Build Issues
- Ensure `npm run codegen` is run after schema changes
- Check ABI files are present in `abis/` directory
- Verify network configuration in `subgraph.yaml`

### Testing Issues
- Use proper mocking for graph-ts dependencies
- Ensure test data matches contract event structures
- Check entity relationships are properly initialized

### Performance Considerations
- Use batch operations for large data sets
- Implement proper caching for frequently accessed entities
- Monitor query complexity and optimize derived fields

## Network Configuration

Current deployment targets `apechain-curtis` network with specific contract addresses in `subgraph.yaml`. Update addresses via `npm run update-addresses` script when contracts are redeployed.