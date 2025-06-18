import { MarketListed, MarketEntered } from "../generated/Comptroller/Comptroller";
import { cToken } from "../generated/templates";
import { cToken as CToken } from "../generated/Comptroller/cToken";
import { getOrCreateCTokenMarket } from "./utils/getters";
import { log } from "@graphprotocol/graph-ts";

export function handleMarketListed(event: MarketListed): void {
  cToken.create(event.params.cToken);
  const cTokenContract = CToken.bind(event.params.cToken);
  const decimalsTry = cTokenContract.try_decimals();
  if (decimalsTry.reverted) {
    throw new Error(
      `Failed to get decimals for cToken: ${event.params.cToken.toHexString()}`
    );
  }
  const decimals = decimalsTry.value;
  const exchangeRateTry = cTokenContract.try_exchangeRateStored();
  if (exchangeRateTry.reverted) {
    throw new Error(
      `Failed to get exchange rate for cToken: ${event.params.cToken.toHexString()}`
    );
  }
  const exchangeRate = exchangeRateTry.value;
  const cTokenMarket = getOrCreateCTokenMarket(event.params.cToken);
  cTokenMarket.decimals = decimals;
  cTokenMarket.exchangeRate = exchangeRate;
  cTokenMarket.updatedAtBlock = event.block.number;
  cTokenMarket.updatedAtTimestamp = event.block.timestamp;
  cTokenMarket.save();
}

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
