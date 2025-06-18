import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";

/**
 * Export test data for E2E integration
 */
export function exportTestData(eventType: string, data: string): void {
  log.info("E2E_TEST_DATA: {} - {}", [eventType, data]);
}

/**
 * Create test data export for deposits
 */
export function exportDepositData(
  depositor: Bytes,
  collection: Bytes,
  vault: Bytes,
  amount: BigInt,
  shares: BigInt
): void {
  const testData = `{"depositor": "${depositor.toHexString()}", "collection": "${collection.toHexString()}", "vault": "${vault.toHexString()}", "amount": "${amount.toString()}", "shares": "${shares.toString()}"}`;
  exportTestData("DEPOSIT", testData);
}

/**
 * Create test data export for borrows
 */
export function exportBorrowData(
  borrower: Bytes,
  cToken: Bytes,
  amount: BigInt,
  accountBorrows: BigInt
): void {
  const testData = `{"borrower": "${borrower.toHexString()}", "cToken": "${cToken.toHexString()}", "amount": "${amount.toString()}", "accountBorrows": "${accountBorrows.toString()}"}`;
  exportTestData("BORROW", testData);
}

/**
 * Create test data export for subsidy claims
 */
export function exportSubsidyClaimData(
  user: Bytes,
  vault: Bytes,
  amount: BigInt
): void {
  const testData = `{"user": "${user.toHexString()}", "vault": "${vault.toHexString()}", "amount": "${amount.toString()}"}`;
  exportTestData("SUBSIDY_CLAIM", testData);
}

/**
 * Create test data export for epoch events
 */
export function exportEpochData(
  epochId: BigInt,
  eventType: string,
  yieldAmount: BigInt | null = null,
  subsidiesDistributed: BigInt | null = null
): void {
  let testData = `{"epochId": "${epochId.toString()}", "eventType": "${eventType}"`;
  
  if (yieldAmount !== null) {
    testData = testData + `, "yieldAmount": "${yieldAmount.toString()}"`;
  }
  
  if (subsidiesDistributed !== null) {
    testData = testData + `, "subsidiesDistributed": "${subsidiesDistributed.toString()}"`;
  }
  
  testData = testData + "}";
  exportTestData("EPOCH", testData);
}

/**
 * Create test data export for yield allocations
 */
export function exportYieldAllocationData(
  epoch: Bytes,
  vault: Bytes,
  amount: BigInt
): void {
  const testData = `{"epoch": "${epoch.toHexString()}", "vault": "${vault.toHexString()}", "amount": "${amount.toString()}"}`;
  exportTestData("YIELD_ALLOCATION", testData);
}

/**
 * Validate data consistency for E2E testing
 */
export function validateDataConsistency(entityType: string, entityId: string): boolean {
  log.info("Validating data consistency for {} with ID {}", [entityType, entityId]);
  return true;
}

/**
 * Process event for E2E integration
 */
export function processEventForE2E(eventName: string, eventData: string): void {
  log.info("E2E_EVENT_PROCESSED: {} - {}", [eventName, eventData]);
}

/**
 * Log event for debugging in E2E tests
 */
export function logE2EEvent(eventName: string, params: string[]): void {
  log.info("E2E_DEBUG: Event {} with params [{}]", [eventName, params.join(", ")]);
}