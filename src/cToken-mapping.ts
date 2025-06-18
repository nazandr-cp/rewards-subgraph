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
import {
  getOrCreateAccountMarket,
  getOrCreateAccount,
  getOrCreateCTokenMarket,
} from "./utils/getters";
import { accrueAccountSubsidies } from "./utils/subsidies";

const EXP_SCALE = BigInt.fromI32(10).pow(18);
const PROTOCOL_SEIZE_SHARE_MANTISSA = BigInt.fromString("28000000000000000");

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
  market.lastExchangeRateTimestamp = event.block.timestamp;
  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp;
  market.save();
}

export function handleBorrow(event: BorrowEvent): void {
  const borrower = event.params.borrower;
  const accountBorrows = event.params.accountBorrows;
  const totalBorrows = event.params.totalBorrows;

  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(borrower, event.address);

  accountMarket.borrowBalance = accountBorrows;
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp;
  accountMarket.save();

  market.totalBorrows = totalBorrows;
  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp;
  market.save();

  accrueAccountSubsidies(borrower, event.block.number, event.block.timestamp);
}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {
  const cTokenBorrowedAddress = event.address;
  const liquidatorAddress = event.params.liquidator;
  const borrowerAddress = event.params.borrower;
  const repayAmount = event.params.repayAmount;
  const cTokenCollateralAddress = event.params.cTokenCollateral;
  const seizeTokens_ct = event.params.seizeTokens;

  const borrowedMarket = getOrCreateCTokenMarket(cTokenBorrowedAddress);
  const collateralMarket = getOrCreateCTokenMarket(cTokenCollateralAddress);

  getOrCreateAccount(liquidatorAddress);
  getOrCreateAccount(borrowerAddress);

  const borrowerAccountBorrowedMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenBorrowedAddress
  );

  const liquidatorAccountCollateralMarket = getOrCreateAccountMarket(
    liquidatorAddress,
    cTokenCollateralAddress
  );

  const borrowerAccountCollateralMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenCollateralAddress
  );

  borrowerAccountBorrowedMarket.borrowBalance =
    borrowerAccountBorrowedMarket.borrowBalance.minus(repayAmount);
  borrowerAccountBorrowedMarket.updatedAtBlock = event.block.number;
  borrowerAccountBorrowedMarket.updatedAtTimestamp =
    event.block.timestamp;
  borrowerAccountBorrowedMarket.save();

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
  borrowedMarket.updatedAtTimestamp = event.block.timestamp;
  borrowedMarket.save();

  const collateralCTokenContract = CTokenContract.bind(cTokenCollateralAddress);

  const exchangeRateStoredTry =
    collateralCTokenContract.try_exchangeRateStored();
  if (exchangeRateStoredTry.reverted) {
    log.warning(
      "exchangeRateStored() call reverted in LiquidateBorrow for collateral cToken: {}. Cannot accurately update collateral values.",
      [cTokenCollateralAddress.toHexString()]
    );
    collateralMarket.updatedAtBlock = event.block.number;
    collateralMarket.updatedAtTimestamp = event.block.timestamp;
    collateralMarket.save();
    return;
  }
  const exchangeRateCollateral = exchangeRateStoredTry.value;
  collateralMarket.exchangeRate = exchangeRateCollateral;

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

  const underlyingSeizedFromBorrower_total = seizeTokens_ct
    .times(exchangeRateCollateral)
    .div(EXP_SCALE);
  const underlyingToLiquidator = liquidatorSeizeTokens_ct
    .times(exchangeRateCollateral)
    .div(EXP_SCALE);

  borrowerAccountCollateralMarket.supplyBalance =
    borrowerAccountCollateralMarket.supplyBalance.minus(
      underlyingSeizedFromBorrower_total
    );
  borrowerAccountCollateralMarket.updatedAtBlock = event.block.number;
  borrowerAccountCollateralMarket.updatedAtTimestamp =
    event.block.timestamp;
  borrowerAccountCollateralMarket.save();

  liquidatorAccountCollateralMarket.supplyBalance =
    liquidatorAccountCollateralMarket.supplyBalance.plus(underlyingToLiquidator);
  liquidatorAccountCollateralMarket.updatedAtBlock = event.block.number;
  liquidatorAccountCollateralMarket.updatedAtTimestamp =
    event.block.timestamp;
  liquidatorAccountCollateralMarket.save();

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
  collateralMarket.updatedAtTimestamp = event.block.timestamp;
  collateralMarket.save();

  accrueAccountSubsidies(
    liquidatorAddress,
    event.block.number,
    event.block.timestamp
  );
  accrueAccountSubsidies(
    borrowerAddress,
    event.block.number,
    event.block.timestamp
  );
}

export function handleMint(event: MintEvent): void {
  const cTokenContractAddress = event.address;
  const minter = event.params.minter;
  const mintAmount = event.params.mintAmount;
  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(minter, cTokenContractAddress);

  accountMarket.supplyBalance = accountMarket.supplyBalance.plus(mintAmount);
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp;
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
  market.updatedAtTimestamp = event.block.timestamp;
  market.updatedAtBlock = event.block.number;
  market.save();

  accrueAccountSubsidies(minter, event.block.number, event.block.timestamp);
}

export function handleRedeem(event: RedeemEvent): void {
  const cTokenContractAddress = event.address;
  const redeemer = event.params.redeemer;
  const redeemAmount = event.params.redeemAmount;
  const market = getOrCreateCTokenMarket(event.address);
  const accountMarket = getOrCreateAccountMarket(
    redeemer,
    cTokenContractAddress
  );

  accountMarket.supplyBalance = accountMarket.supplyBalance.minus(redeemAmount);
  accountMarket.updatedAtBlock = event.block.number;
  accountMarket.updatedAtTimestamp = event.block.timestamp;
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
  market.updatedAtTimestamp = event.block.timestamp;
  market.updatedAtBlock = event.block.number;
  market.save();

  accrueAccountSubsidies(redeemer, event.block.number, event.block.timestamp);
}

export function handleRepayBorrow(event: RepayBorrowEvent): void {
  const cTokenContractAddress = event.address;
  const payerAddress = event.params.payer;
  const borrowerAddress = event.params.borrower;
  const newBorrowerLoanBalance = event.params.accountBorrows;
  const newMarketTotalBorrows = event.params.totalBorrows;

  const market = getOrCreateCTokenMarket(cTokenContractAddress);
  getOrCreateAccountMarket(payerAddress, cTokenContractAddress);
  const borrowerAccountMarket = getOrCreateAccountMarket(
    borrowerAddress,
    cTokenContractAddress
  );

  borrowerAccountMarket.borrowBalance = newBorrowerLoanBalance;
  borrowerAccountMarket.updatedAtBlock = event.block.number;
  borrowerAccountMarket.updatedAtTimestamp = event.block.timestamp;
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

  market.updatedAtTimestamp = event.block.timestamp;
  market.updatedAtBlock = event.block.number;
  market.save();

  accrueAccountSubsidies(
    borrowerAddress,
    event.block.number,
    event.block.timestamp
  );
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
    market.updatedAtTimestamp = event.block.timestamp;
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
  fromAccountMarket.supplyBalance = fromAccountMarket.supplyBalance.minus(
    underlyingValueTransferred
  );
  fromAccountMarket.updatedAtBlock = event.block.number;
  fromAccountMarket.updatedAtTimestamp = event.block.timestamp;
  fromAccountMarket.save();

  const toAccountMarket = getOrCreateAccountMarket(toAddress, event.address);
  toAccountMarket.supplyBalance = toAccountMarket.supplyBalance.plus(
    underlyingValueTransferred
  );
  toAccountMarket.updatedAtBlock = event.block.number;
  toAccountMarket.updatedAtTimestamp = event.block.timestamp;
  toAccountMarket.save();

  market.updatedAtBlock = event.block.number;
  market.updatedAtTimestamp = event.block.timestamp;
  market.save();

  accrueAccountSubsidies(
    fromAddress,
    event.block.number,
    event.block.timestamp
  );
  accrueAccountSubsidies(toAddress, event.block.number, event.block.timestamp);
}
