import { MarketListed, MarketEntered } from "../generated/Comptroller/Comptroller";
import { cToken } from "../generated/templates";
import { cToken as CToken } from "../generated/Comptroller/cToken";
import { getOrCreateCTokenMarket } from "./utils/getters";
import { log, BigInt } from "@graphprotocol/graph-ts";

export function handleMarketListed(event: MarketListed): void {
  const cTokenContract = CToken.bind(event.params.cToken);

  // Comprehensive cToken validation - check for multiple cToken-specific methods
  const exchangeRateTry = cTokenContract.try_exchangeRateStored();
  const borrowRateTry = cTokenContract.try_borrowRatePerBlock();
  const supplyRateTry = cTokenContract.try_supplyRatePerBlock();
  const totalBorrowsTry = cTokenContract.try_totalBorrows();
  const totalSupplyTry = cTokenContract.try_totalSupply();

  // Check for multiple cToken-specific methods - all should exist for valid cTokens
  if (exchangeRateTry.reverted || borrowRateTry.reverted || supplyRateTry.reverted ||
    totalBorrowsTry.reverted || totalSupplyTry.reverted) {
    log.warning("Address {} does not appear to be a valid cToken contract (missing core methods). Skipping market listing.", [
      event.params.cToken.toHexString()
    ]);
    return;
  }

  // Validate symbol follows cToken convention
  const symbolResult = cTokenContract.try_symbol();
  if (!symbolResult.reverted) {
    const symbol = symbolResult.value;
    if (!symbol.startsWith("c")) {
      log.warning("Token {} with symbol '{}' does not follow cToken naming convention. Skipping market listing.", [
        event.params.cToken.toHexString(),
        symbol
      ]);
      return;
    }
  } else {
    log.warning("Failed to get symbol for token {}. Skipping market listing.", [
      event.params.cToken.toHexString()
    ]);
    return;
  }

  // Additional validation: check if exchange rate is reasonable (not zero)
  if (exchangeRateTry.value.equals(BigInt.fromI32(0))) {
    log.warning("Token {} has zero exchange rate, likely not a valid cToken. Skipping market listing.", [
      event.params.cToken.toHexString()
    ]);
    return;
  }

  cToken.create(event.params.cToken);

  const decimalsTry = cTokenContract.try_decimals();
  if (decimalsTry.reverted) {
    log.warning("Failed to get decimals for cToken: {}", [event.params.cToken.toHexString()]);
    return;
  }

  const decimals = decimalsTry.value;
  const exchangeRate = exchangeRateTry.value;
  const cTokenMarket = getOrCreateCTokenMarket(event.params.cToken);

  // Set symbol and name (required fields)
  if (symbolResult.reverted) {
    log.warning("Failed to get symbol for cToken: {}", [event.params.cToken.toHexString()]);
    cTokenMarket.symbol = "UNKNOWN";
  } else {
    cTokenMarket.symbol = symbolResult.value;
  }

  const nameResult = cTokenContract.try_name();
  if (nameResult.reverted) {
    log.warning("Failed to get name for cToken: {}", [event.params.cToken.toHexString()]);
    cTokenMarket.name = "UNKNOWN";
  } else {
    cTokenMarket.name = nameResult.value;
  }

  cTokenMarket.decimals = decimals;
  cTokenMarket.exchangeRate = exchangeRate;
  cTokenMarket.updatedAtBlock = event.block.number;
  cTokenMarket.updatedAtTimestamp = event.block.timestamp;
  cTokenMarket.save();

  log.info("Successfully listed cToken market: {} with symbol: {}", [
    event.params.cToken.toHexString(),
    cTokenMarket.symbol
  ]);
}

export function handleMarketEntered(event: MarketEntered): void {
  const user = event.params.account;
  const cToken = event.params.cToken;

  log.info("MarketEntered: User {} entered market {}", [
    user.toHexString(),
    cToken.toHexString()
  ]);

  const testData = `{"user": "${user.toHexString()}", "cToken": "${cToken.toHexString()}", "eventType": "MARKET_ENTERED"}`;
  log.info("E2E_TEST_DATA: MARKET_ENTRY - {}", [testData]);
}
