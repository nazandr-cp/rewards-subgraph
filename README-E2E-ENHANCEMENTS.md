# Rewards Subgraph E2E Testing Enhancements

This document outlines the enhancements made to the rewards subgraph to support comprehensive End-to-End (E2E) testing infrastructure for the lend.fam MVP lending platform.

## Overview

The subgraph has been enhanced to:
- Index all critical events from the complete E2E workflow
- Export test data for backend integration testing
- Support both production and test environments
- Provide comprehensive event handling for the MVP workflow

## Enhanced Schema Entities

### New E2E Testing Entities

```graphql
# Collection deposit events for E2E testing
type CollectionDeposit @entity(immutable: true) {
  id: ID!
  depositor: Bytes!
  collection: Bytes!
  vault: Bytes!
  amount: BigInt!
  shares: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}

# Borrow events from Compound protocol
type Borrow @entity(immutable: true) {
  id: ID!
  borrower: Bytes!
  cToken: Bytes!
  amount: BigInt!
  accountBorrows: BigInt!
  totalBorrows: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}

# User balance tracking
type UserBalance @entity(immutable: false) {
  id: ID!
  user: Bytes!
  collection: Bytes!
  vault: Bytes!
  vaultShares: BigInt!
  borrowBalance: BigInt!
  nftBalance: BigInt!
  lastUpdated: BigInt!
}

# Yield allocation events
type YieldAllocation @entity(immutable: true) {
  id: ID!
  epoch: Bytes!
  vault: Bytes!
  collection: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}
```

## Enhanced Event Handlers

### 1. Collection Vault Mapping (`src/collection-vault-mapping.ts`)

**Enhanced Events:**
- `handleCollectionDeposit` - Now exports E2E test data
- `handleDepositForCollection` - New handler for E2E compatibility
- `handleVaultYieldAllocatedToEpoch` - Enhanced with test data export
- `handleCollectionYieldAppliedForEpoch` - Enhanced with test data export

**E2E Test Data Export:**
```typescript
// Example export format for deposits
const testData = `{"depositor": "${depositor.toHexString()}", "collection": "${collection.toHexString()}", "vault": "${vault.toHexString()}", "amount": "${amount.toString()}", "shares": "${shares.toString()}"}`;
log.info("E2E_TEST_DATA: DEPOSIT - {}", [testData]);
```

### 2. Debt Subsidizer Mapping (`src/debt-subsidizer-mapping.ts`)

**Enhanced Events:**
- `handleSubsidyClaimed` - Enhanced with E2E test data export
- `handleMerkleRootUpdated` - Existing functionality maintained

**E2E Test Data Export:**
```typescript
// Example export format for subsidy claims
const testData = `{"user": "${user.toHexString()}", "vault": "${vault.toHexString()}", "amount": "${amount.toString()}", "epoch": "${epochId}"}`;
log.info("E2E_TEST_DATA: SUBSIDY_CLAIM - {}", [testData]);
```

### 3. Epoch Manager Mapping (`src/epoch-manager-mapping.ts`)

**Enhanced Events:**
- `handleEpochStarted` - Enhanced with E2E test data export
- `handleEpochFinalized` - Enhanced with E2E test data export
- `handleEpochProcessingStarted` - Existing functionality maintained
- `handleEpochManagerVaultYieldAllocated` - Existing functionality maintained

**E2E Test Data Export:**
```typescript
// Example export format for epoch events
const testData = `{"epochId": "${epochId}", "eventType": "STARTED", "startTime": "${startTime.toString()}", "endTime": "${endTime.toString()}"}`;
log.info("E2E_TEST_DATA: EPOCH - {}", [testData]);
```

### 4. cToken Mapping (`src/cToken-mapping.ts`)

**Enhanced Events:**
- `handleBorrow` - Enhanced with E2E test data export for Compound borrow events

**E2E Test Data Export:**
```typescript
// Example export format for borrow events
const testData = `{"borrower": "${borrower.toHexString()}", "cToken": "${cToken.toHexString()}", "amount": "${amount.toString()}", "accountBorrows": "${accountBorrows.toString()}"}`;
log.info("E2E_TEST_DATA: BORROW - {}", [testData]);
```

### 5. Comptroller Mapping (`src/comptroller-mapping.ts`)

**Enhanced Events:**
- `handleMarketEntered` - New handler for market entry events

**E2E Test Data Export:**
```typescript
// Example export format for market entry events
const testData = `{"user": "${user.toHexString()}", "cToken": "${cToken.toHexString()}", "eventType": "MARKET_ENTERED"}`;
log.info("E2E_TEST_DATA: MARKET_ENTRY - {}", [testData]);
```

## Testing Utilities (`src/utils/testing.ts`)

Provides helper functions for E2E testing:

```typescript
// Export test data for E2E integration
export function exportTestData(eventType: string, data: string): void

// Create test data exports for different event types
export function exportDepositData(depositor: Bytes, collection: Bytes, vault: Bytes, amount: BigInt, shares: BigInt): void
export function exportBorrowData(borrower: Bytes, cToken: Bytes, amount: BigInt, accountBorrows: BigInt): void
export function exportSubsidyClaimData(user: Bytes, vault: Bytes, amount: BigInt): void
export function exportEpochData(epochId: BigInt, eventType: string, yieldAmount?: BigInt, subsidiesDistributed?: BigInt): void

// Validation and debugging utilities
export function validateDataConsistency(entityType: string, entityId: string): boolean
export function logE2EEvent(eventName: string, params: string[]): void
```

## Configuration Files

### 1. Production Configuration (`subgraph.yaml`)

Enhanced with:
- Support for `DepositForCollection` event handler
- Comprehensive event coverage for all contracts
- Backward compatibility with existing functionality

### 2. Test Configuration (`subgraph.test.yaml`)

Configured specifically for E2E testing with:
- Anvil network configuration
- Template address placeholders (`{{CONTRACT_ADDRESS}}`)
- Complete event handler coverage
- cToken template for dynamic contract handling

## E2E Testing Integration

### Data Export Format

All E2E test data is exported using structured JSON logs:

```typescript
log.info("E2E_TEST_DATA: {EVENT_TYPE} - {JSON_DATA}", [eventType, jsonData]);
```

### Event Types

- `DEPOSIT` - Collection deposits
- `BORROW` - Compound protocol borrows
- `SUBSIDY_CLAIM` - Debt subsidy claims
- `EPOCH` - Epoch lifecycle events
- `YIELD_ALLOCATION` - Yield allocation events
- `MARKET_ENTRY` - Compound market entry events

### Backend Integration

The enhanced subgraph integrates with the backend testing infrastructure by:

1. **Event Indexing**: All critical events are indexed and available via GraphQL queries
2. **Test Data Export**: Structured logs enable automated test verification
3. **State Consistency**: Comprehensive entity relationships ensure data integrity
4. **Real-time Updates**: Events are processed and available for immediate querying

## Deployment

### Test Environment

```bash
# Deploy to test environment (Anvil)
graph deploy \
  --node http://localhost:8020 \
  --ipfs http://localhost:5001 \
  lend-fam/rewards \
  subgraph.test.yaml
```

### Production Environment

```bash
# Deploy to production environment
graph deploy \
  --node https://api.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/ \
  your-github-username/lend-fam-rewards \
  subgraph.yaml
```

## Monitoring and Debugging

### E2E Test Data Monitoring

Monitor E2E test data exports using:

```bash
# Filter for E2E test data in logs
docker logs graph-node 2>&1 | grep "E2E_TEST_DATA"
```

### GraphQL Query Examples

```graphql
# Query collection deposits
query GetCollectionDeposits {
  collectionDeposits(orderBy: timestamp, orderDirection: desc) {
    id
    depositor
    collection
    amount
    shares
    timestamp
  }
}

# Query borrow events
query GetBorrows {
  borrows(orderBy: timestamp, orderDirection: desc) {
    id
    borrower
    cToken
    amount
    accountBorrows
    timestamp
  }
}

# Query subsidy claims
query GetSubsidyClaims {
  subsidyDistributions(orderBy: timestamp, orderDirection: desc) {
    id
    user
    vault
    subsidyAmount
    timestamp
  }
}
```

## Backward Compatibility

All enhancements maintain backward compatibility with:
- Existing entity schemas
- Current event handlers
- Production subgraph deployments
- Existing GraphQL queries

## Performance Considerations

- E2E test data exports use efficient string concatenation
- Entity relationships are optimized for query performance
- Indexing is configured for critical fields
- Memory usage is minimized through selective entity creation

## Future Enhancements

Potential future improvements:
- Additional test data validation
- Enhanced error handling for E2E scenarios
- Performance metrics collection
- Advanced debugging utilities
- Real-time test result aggregation

This enhanced subgraph configuration provides comprehensive support for E2E testing while maintaining production reliability and performance.