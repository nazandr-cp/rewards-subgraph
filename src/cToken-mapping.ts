import { log, BigInt } from "@graphprotocol/graph-ts";
import {
  AccrueInterest as AccrueInterestEvent,
  Borrow as BorrowEvent,
  LiquidateBorrow as LiquidateBorrowEvent,
  Mint as MintEvent,
  Redeem as RedeemEvent,
  RepayBorrow as RepayBorrowEvent,
  Transfer as TransferEvent,
} from "../generated/templates/cToken/cToken";
import { cToken as CTokenContract } from "../generated/templates/cToken/cToken";
import {} from "../generated/schema";
import {
  getOrCreateAccountMarket,
  getOrCreateAccount,
  getOrCreateCTokenMarket,
} from "./utils/getters";
import {} from "./utils/const";

const EXP_SCALE = BigInt.fromI32(10).pow(18);
// Standard Compound V2 protocol seize share is 2.8%
const PROTOCOL_SEIZE_SHARE_MANTISSA = BigInt.fromString("28000000000000000"); // 0.028 * 10^18

export function handleAccrueInterest(event: AccrueInterestEvent): void {
  const cashPrior = event.params.cashPrior;
  const interestAccumulated = event.params.interestAccumulated;
  const borrowIndex = event.params.borrowIndex;
  const totalBorrows = event.params.totalBorrows;

  const market = getOrCreateCTokenMarket(event.address);

  const cTokenContract = CTokenContract.bind(event.address);

  const exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
  if (!exchangeRateStoredTry.reverted) {
    market.exchangeRate = exchangeRateStoredTry.value;
  } else {
    log.warning(
      "exchangeRateStored() call reverted in AccrueInterest for cToken: {}",
      [event.address.toHexString()]
    );
  }

  market.interestAccumulated = interestAccumulated;
  market.cashPrior = cashPrior;
  market.borrowIndex = borrowIndex;
  market.totalBorrows = totalBorrows;
  market.lastExchangeRateTimestamp = event.block.timestamp.toI64();
  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.save();
}

export function handleBorrow(event: BorrowEvent): void {
  const borrower = event.params.borrower;
  //   const borrowAmount = event.params.borrowAmount;
  const accountBorrows = event.params.accountBorrows;
  const totalBorrows = event.params.totalBorrows;

  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(borrower, event.address);

  accountMarket.borrow = accountBorrows;
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  accountMarket.save();

  market.totalBorrows = totalBorrows;
  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.save();
}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {
  const cTokenBorrowedAddress = event.address;
  const liquidatorAddress = event.params.liquidator;
  const borrowerAddress = event.params.borrower;
  const repayAmount = event.params.repayAmount; // Amount of the underlying borrowed asset repaid by the liquidator
  const cTokenCollateralAddress = event.params.cTokenCollateral;
  const seizeTokens_ct = event.params.seizeTokens; // Total number of collateral cTokens seized from the borrower

  // --- Load or create market and account entities ---
  const borrowedMarket = getOrCreateCTokenMarket(cTokenBorrowedAddress);
  const collateralMarket = getOrCreateCTokenMarket(cTokenCollateralAddress);

  // Ensure Account entities are created for liquidator and borrower
  // These calls will fetch existing or create new ones if they don't exist.
  getOrCreateAccount(liquidatorAddress);
  getOrCreateAccount(borrowerAddress);

  // Borrower's account in the BORROWED market (where their debt is)
  const borrowerAccountBorrowedMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenBorrowedAddress
  );

  // Liquidator's account in the COLLATERAL market (where they receive seized assets)
  const liquidatorAccountCollateralMarket = getOrCreateAccountMarket(
    liquidatorAddress,
    cTokenCollateralAddress
  );

  // Borrower's account in the COLLATERAL market (where their collateral is taken from)
  const borrowerAccountCollateralMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenCollateralAddress
  );

  // --- Update Borrower's Debt in Borrowed Market ---
  // The borrower's debt in the borrowed asset's market is reduced by the repayAmount.
  borrowerAccountBorrowedMarket.borrow =
    borrowerAccountBorrowedMarket.borrow.minus(repayAmount);
  borrowerAccountBorrowedMarket.updatedAtBlock = event.block.number;
  borrowerAccountBorrowedMarket.updatedAtTimestamp =
    event.block.timestamp.toI64();
  borrowerAccountBorrowedMarket.save();

  // --- Update Borrowed Market State (Total Borrows) ---
  // The total borrows in the borrowed asset's market are updated.
  const borrowedCTokenContract = CTokenContract.bind(cTokenBorrowedAddress);
  const borrowedTotalBorrowsTry = borrowedCTokenContract.try_totalBorrows();
  if (!borrowedTotalBorrowsTry.reverted) {
    borrowedMarket.totalBorrows = borrowedTotalBorrowsTry.value;
  } else {
    log.warning(
      "totalBorrows() call reverted in LiquidateBorrow for borrowed cToken: {}",
      [cTokenBorrowedAddress.toHexString()]
    );
  }
  borrowedMarket.updatedAtBlock = event.block.number;
  borrowedMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  borrowedMarket.save();

  // --- Handle Collateral Seizure ---
  const collateralCTokenContract = CTokenContract.bind(cTokenCollateralAddress);

  // Get collateral's exchange rate to convert cTokens to underlying
  const exchangeRateStoredTry =
    collateralCTokenContract.try_exchangeRateStored();
  if (exchangeRateStoredTry.reverted) {
    log.warning(
      "exchangeRateStored() call reverted in LiquidateBorrow for collateral cToken: {}. Cannot accurately update collateral values.",
      [cTokenCollateralAddress.toHexString()]
    );
    // If we can't get the exchange rate, we can't accurately update underlying deposit values.
    // We might still update cToken balances if the schema supported it directly, or make assumptions.
    // For now, we'll save what we can and return if critical info is missing.
    collateralMarket.updatedAtBlock = event.block.number;
    collateralMarket.updatedAtTimestamp = event.block.timestamp.toI64();
    collateralMarket.save();
    return;
  }
  const exchangeRateCollateral = exchangeRateStoredTry.value; // This is scaled by 1e18
  collateralMarket.exchangeRate = exchangeRateCollateral;

  // Calculate the split of seized collateral cTokens based on protocolSeizeShareMantissa
  // protocolSeizeTokens_ct = seizeTokens_ct * protocolSeizeShareMantissa / 1e18
  const protocolSeizeShareMantissaResult =
    collateralCTokenContract.try_protocolSeizeShareMantissa();
  let protocolSeizeShareMantissa = PROTOCOL_SEIZE_SHARE_MANTISSA;
  if (!protocolSeizeShareMantissaResult.reverted) {
    protocolSeizeShareMantissa = protocolSeizeShareMantissaResult.value;
  } else {
    log.warning(
      "protocolSeizeShareMantissa() call reverted in LiquidateBorrow for collateral cToken: {}. Using default protocol seize share.",
      [cTokenCollateralAddress.toHexString()]
    );
  }
  const protocolSeizeTokens_ct = seizeTokens_ct
    .times(protocolSeizeShareMantissa)
    .div(EXP_SCALE);
  const liquidatorSeizeTokens_ct = seizeTokens_ct.minus(protocolSeizeTokens_ct);

  // Convert cToken amounts to their underlying value for the collateral asset
  // underlying = cTokens * exchangeRate / 1e18
  const underlyingSeizedFromBorrower_total = seizeTokens_ct
    .times(exchangeRateCollateral)
    .div(EXP_SCALE);
  const underlyingToLiquidator = liquidatorSeizeTokens_ct
    .times(exchangeRateCollateral)
    .div(EXP_SCALE);
  // const underlyingToProtocolReserves = protocolSeizeTokens_ct.times(exchangeRateCollateral).div(EXP_SCALE);

  // Update Borrower's Collateral Deposit (in underlying terms)
  // The borrower loses the total underlying value of the seized cTokens from their deposit.
  borrowerAccountCollateralMarket.deposit =
    borrowerAccountCollateralMarket.deposit.minus(
      underlyingSeizedFromBorrower_total
    );
  borrowerAccountCollateralMarket.updatedAtBlock = event.block.number;
  borrowerAccountCollateralMarket.updatedAtTimestamp =
    event.block.timestamp.toI64();
  borrowerAccountCollateralMarket.save();

  // Update Liquidator's Collateral Deposit (in underlying terms)
  // The liquidator receives the underlying value of their share of seized cTokens.
  liquidatorAccountCollateralMarket.deposit =
    liquidatorAccountCollateralMarket.deposit.plus(underlyingToLiquidator);
  liquidatorAccountCollateralMarket.updatedAtBlock = event.block.number;
  liquidatorAccountCollateralMarket.updatedAtTimestamp =
    event.block.timestamp.toI64();
  liquidatorAccountCollateralMarket.save();

  // --- Update Collateral Market State (TotalSupply and TotalReserves) ---
  // The totalSupply of the collateral cToken decreases by the amount reserved for the protocol.
  // The totalReserves of the collateral cToken increase by the underlying value of the protocol's share.
  // We fetch these directly from the contract post-event as they reflect the latest state.
  const collateralTotalSupplyTry = collateralCTokenContract.try_totalSupply();
  if (!collateralTotalSupplyTry.reverted) {
    collateralMarket.totalSupply = collateralTotalSupplyTry.value;
  } else {
    log.warning(
      "totalSupply() call reverted in LiquidateBorrow for collateral cToken: {}",
      [cTokenCollateralAddress.toHexString()]
    );
  }

  const collateralTotalReservesTry =
    collateralCTokenContract.try_totalReserves();
  if (!collateralTotalReservesTry.reverted) {
    collateralMarket.totalReserves = collateralTotalReservesTry.value;
  } else {
    log.warning(
      "totalReserves() call reverted in LiquidateBorrow for collateral cToken: {}",
      [cTokenCollateralAddress.toHexString()]
    );
  }

  collateralMarket.updatedAtBlock = event.block.number;
  collateralMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  collateralMarket.save();
}

export function handleMint(event: MintEvent): void {
  const cTokenContractAddress = event.address;
  const minter = event.params.minter;
  const mintAmount = event.params.mintAmount;
  //   const mintTokens_ct = event.params.mintTokens; // Amount of cTokens minted
  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(minter, cTokenContractAddress);

  accountMarket.deposit = accountMarket.deposit.plus(mintAmount);
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  accountMarket.save();

  const cTokenContract = CTokenContract.bind(cTokenContractAddress);
  const totalSupplyTry = cTokenContract.try_totalSupply();
  if (!totalSupplyTry.reverted) {
    market.totalSupply = totalSupplyTry.value;
  } else {
    log.warning("totalSupply() call reverted in Mint for cToken: {}", [
      event.address.toHexString(),
    ]);
  }
  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.updatedAtBlock = event.block.number;
  market.save();
}

export function handleRedeem(event: RedeemEvent): void {
  const cTokenContractAddress = event.address;
  const redeemer = event.params.redeemer;
  const redeemAmount = event.params.redeemAmount;
  //   const redeemTokens_ct = event.params.redeemTokens;
  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(
    redeemer,
    cTokenContractAddress
  );

  accountMarket.deposit = accountMarket.deposit.minus(redeemAmount);
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  accountMarket.save();

  const cTokenContract = CTokenContract.bind(cTokenContractAddress);
  const totalSupplyTry = cTokenContract.try_totalSupply();
  if (!totalSupplyTry.reverted) {
    market.totalSupply = totalSupplyTry.value;
  } else {
    log.warning("totalSupply() call reverted in Redeem for cToken: {}", [
      event.address.toHexString(),
    ]);
  }
  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.updatedAtBlock = event.block.number;
  market.save();
}

export function handleRepayBorrow(event: RepayBorrowEvent): void {
  const cTokenContractAddress = event.address;
  const payerAddress = event.params.payer;
  const borrowerAddress = event.params.borrower;
  // const actualRepayAmount = event.params.repayAmount;
  const newBorrowerLoanBalance = event.params.accountBorrows;
  const newMarketTotalBorrows = event.params.totalBorrows;

  const market = getOrCreateCTokenMarket(cTokenContractAddress);
  getOrCreateAccountMarket(payerAddress, cTokenContractAddress);
  const borrowerAccountMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenContractAddress
  );

  borrowerAccountMarket.borrow = newBorrowerLoanBalance;
  borrowerAccountMarket.updatedAtBlock = event.block.number;
  borrowerAccountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  borrowerAccountMarket.save();

  market.totalBorrows = newMarketTotalBorrows;

  const cTokenContract = CTokenContract.bind(cTokenContractAddress);
  const totalSupplyTry = cTokenContract.try_totalSupply();
  if (!totalSupplyTry.reverted) {
    market.totalSupply = totalSupplyTry.value;
  } else {
    log.warning("totalSupply() call reverted in RepayBorrow for cToken: {}", [
      cTokenContractAddress.toHexString(),
    ]);
  }

  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.updatedAtBlock = event.block.number;
  market.save();
}

export function handleTransfer(event: TransferEvent): void {
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const value_ct = event.params.amount;

  const market = getOrCreateCTokenMarket(event.address);
  const cTokenContract = CTokenContract.bind(event.address);

  const exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
  if (exchangeRateStoredTry.reverted) {
    log.warning(
      "exchangeRateStored() call reverted in handleTransfer for cToken: {}. Cannot accurately update account deposits.",
      [event.address.toHexString()]
    );
    market.updatedAtBlock = event.block.number;
    market.updatedAtTimestamp = event.block.timestamp.toI64();
    market.save();
    return;
  }
  const exchangeRate = exchangeRateStoredTry.value;
  market.exchangeRate = exchangeRate;

  const underlyingValueTransferred = value_ct
    .times(exchangeRate)
    .div(EXP_SCALE);

  const fromAccountMarket = getOrCreateAccountMarket(
    fromAddress,
    event.address
  );
  fromAccountMarket.deposit = fromAccountMarket.deposit.minus(
    underlyingValueTransferred
  );
  fromAccountMarket.updatedAtBlock = event.block.number;
  fromAccountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  fromAccountMarket.save();

  const toAccountMarket = getOrCreateAccountMarket(toAddress, event.address);
  toAccountMarket.deposit = toAccountMarket.deposit.plus(
    underlyingValueTransferred
  );
  toAccountMarket.updatedAtBlock = event.block.number;
  toAccountMarket.updatedAtTimestamp = event.block.timestamp.toI64();
  toAccountMarket.save();

  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp.toI64();
  market.save();
}
