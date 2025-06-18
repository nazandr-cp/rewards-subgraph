import { MarketEntered } from "../generated/Comptroller/Comptroller";
import { Borrow as BorrowEvent } from "../generated/templates/cToken/cToken";
import { log } from "@graphprotocol/graph-ts";

export function handleMarketEntered(event: MarketEntered): void {
  const user = event.params.account;
  const cToken = event.params.cToken;
  
  log.info("MarketEntered: User {} entered market {}", [
    user.toHexString(),
    cToken.toHexString()
  ]);
  
  // Export test data for E2E integration
  const testData = `{"user": "${user.toHexString()}", "cToken": "${cToken.toHexString()}", "eventType": "MARKET_ENTERED"}`;
  log.info("E2E_TEST_DATA: MARKET_ENTRY - {}", [testData]);
}

export function handleBorrow(event: BorrowEvent): void {
  const borrower = event.params.borrower;
  const borrowAmount = event.params.borrowAmount;
  const accountBorrows = event.params.accountBorrows;
  const totalBorrows = event.params.totalBorrows;
  const cTokenAddress = event.address;
  
  log.info("Borrow: User {} borrowed {} from cToken {}. Account borrows: {}, Total borrows: {}", [
    borrower.toHexString(),
    borrowAmount.toString(),
    cTokenAddress.toHexString(),
    accountBorrows.toString(),
    totalBorrows.toString()
  ]);
  
  // Export test data for E2E integration
  const testData = `{"borrower": "${borrower.toHexString()}", "cToken": "${cTokenAddress.toHexString()}", "amount": "${borrowAmount.toString()}", "accountBorrows": "${accountBorrows.toString()}", "totalBorrows": "${totalBorrows.toString()}"}`;
  log.info("E2E_TEST_DATA: BORROW - {}", [testData]);
}