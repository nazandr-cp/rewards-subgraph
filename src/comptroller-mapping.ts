import { MarketListed } from "../generated/Comptroller/Comptroller";
import { cToken } from "../generated/templates";
import { cToken as CToken } from "../generated/Comptroller/cToken";
import { getOrCreateCTokenMarket } from "./utils/getters";

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
  cTokenMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  cTokenMarket.save();
}
