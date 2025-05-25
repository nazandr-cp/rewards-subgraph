import { Address, log } from "@graphprotocol/graph-ts";
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
    Liquidation
} from "../generated/schema";
import {
    ZERO_BI,
    ADDRESS_ZERO_STR,
    getOrCreateAccount,
    getOrCreateCTokenMarket,
    getOrCreateMarketData,
} from "./utils/rewards";

const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);


export function handleAccrueInterest(event: AccrueInterestEvent): void {
    log.debug("handleAccrueInterest: {}", [event.address.toHexString()]);

    if (event.address.equals(ADDRESS_ZERO)) {
        log.warning("Zero address detected for cToken in AccrueInterest", []);
        return;
    }

    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    if (market == null) {
        log.error("Failed to load or create CTokenMarket entity", []);
        return;
    }

    const cTokenContract = CTokenContract.bind(event.address);

    if (event.params.totalBorrows) {
        market.totalBorrowsU = event.params.totalBorrows;
    }

    if (event.params.borrowIndex) {
        market.borrowIndex = event.params.borrowIndex;
    }

    const totalReservesTry = cTokenContract.try_totalReserves();
    if (!totalReservesTry.reverted) {
        market.totalReservesU = totalReservesTry.value;
    } else {
        log.warning("totalReserves() call reverted in AccrueInterest for cToken: {}", [event.address.toHexString()]);
    }

    const exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
    if (!exchangeRateStoredTry.reverted) {
        market.exchangeRate = exchangeRateStoredTry.value;
    } else {
        log.warning("exchangeRateStored() call reverted in AccrueInterest for cToken: {}", [event.address.toHexString()]);
    }

    market.lastAccrualTimestamp = event.block.timestamp;
    market.blockTimestamp = event.block.timestamp;
    market.save();

    const md = getOrCreateMarketData(event.address, event.block.timestamp);

    const totalSupplyTry = cTokenContract.try_totalSupply();
    if (!totalSupplyTry.reverted) {
        md.totalSupply = totalSupplyTry.value;
    } else {
        log.warning("totalSupply() call reverted in AccrueInterest for cToken: {}", [event.address.toHexString()]);
        md.totalSupply = ZERO_BI;
    }

    md.totalBorrow = event.params.totalBorrows;
    md.totalReserves = market.totalReservesU;
    md.accruedInterest = event.params.interestAccumulated;
    md.lastInterestUpdate = event.block.timestamp;
    md.save();
}

export function handleBorrow(event: BorrowEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.borrower);

    market.totalBorrowsU = event.params.totalBorrows;
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {
    const borrowedMarket = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    const collateralMarket = getOrCreateCTokenMarket(event.params.cTokenCollateral, event.block.timestamp);

    const liquidator = getOrCreateAccount(event.params.liquidator);
    const borrower = getOrCreateAccount(event.params.borrower);

    const borrowedCTokenContract = CTokenContract.bind(event.address);
    const borrowedTotalBorrowsTry = borrowedCTokenContract.try_totalBorrows();
    if (!borrowedTotalBorrowsTry.reverted) {
        borrowedMarket.totalBorrowsU = borrowedTotalBorrowsTry.value;
    } else {
        log.warning("totalBorrows() call reverted in LiquidateBorrow for borrowed cToken: {}", [event.address.toHexString()]);
    }
    borrowedMarket.blockTimestamp = event.block.timestamp;
    borrowedMarket.save();

    const collateralCTokenContract = CTokenContract.bind(event.params.cTokenCollateral);
    const collateralTotalSupplyTry = collateralCTokenContract.try_totalSupply();
    if (!collateralTotalSupplyTry.reverted) {
        collateralMarket.totalSupplyC = collateralTotalSupplyTry.value;
    } else {
        log.warning("totalSupply() call reverted in LiquidateBorrow for collateral cToken: {}", [event.params.cTokenCollateral.toHexString()]);
    }
    collateralMarket.blockTimestamp = event.block.timestamp;
    collateralMarket.save();

    const liquidationId = event.transaction.hash.toHexString()
        + "-" + event.logIndex.toString();
    const liquidation = new Liquidation(liquidationId);
    liquidation.liquidator = liquidator.id;
    liquidation.borrower = borrower.id;
    liquidation.borrowedCTokenMarket = borrowedMarket.id;
    liquidation.repayAmountUnderlying = event.params.repayAmount;
    liquidation.collateralCTokenMarket = collateralMarket.id;
    liquidation.seizedAmountCollateralCToken = event.params.seizeTokens;
    liquidation.blockNumber = event.block.number;
    liquidation.timestamp = event.block.timestamp;
    liquidation.transactionHash = event.transaction.hash;
    liquidation.save();
}

export function handleMint(event: MintEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.minter);

    const cTokenContract = CTokenContract.bind(event.address);
    const totalSupplyTry = cTokenContract.try_totalSupply();
    if (!totalSupplyTry.reverted) {
        market.totalSupplyC = totalSupplyTry.value;
    } else {
        log.warning("totalSupply() call reverted in Mint for cToken: {}", [event.address.toHexString()]);
    }
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleRedeem(event: RedeemEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.redeemer);

    const cTokenContract = CTokenContract.bind(event.address);
    const totalSupplyTry = cTokenContract.try_totalSupply();
    if (!totalSupplyTry.reverted) {
        market.totalSupplyC = totalSupplyTry.value;
    } else {
        log.warning("totalSupply() call reverted in Redeem for cToken: {}", [event.address.toHexString()]);
    }
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleRepayBorrow(event: RepayBorrowEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.payer);
    getOrCreateAccount(event.params.borrower);

    market.totalBorrowsU = event.params.totalBorrows;
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleTransfer(event: TransferEvent): void {
    getOrCreateAccount(event.params.from);
    getOrCreateAccount(event.params.to);

    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);

    const cTokenContract = CTokenContract.bind(event.address);

    const totalSupplyTry = cTokenContract.try_totalSupply();
    if (!totalSupplyTry.reverted) {
        market.totalSupplyC = totalSupplyTry.value;
    } else {
        log.warning("totalSupply() call reverted in Transfer for cToken: {}", [event.address.toHexString()]);
        return;
    }

    if (event.params.from.equals(ADDRESS_ZERO)) {
        log.info(
            "Mint-like transfer (from ZERO_ADDRESS) detected for cToken: {}. Amount: {}. New totalSupplyC: {}.",
            [
                event.address.toHexString(),
                event.params.amount.toString(),
                market.totalSupplyC.toString()
            ]
        );
    } else if (event.params.to.equals(ADDRESS_ZERO)) {
        log.info(
            "Burn-like transfer (to ZERO_ADDRESS) detected for cToken: {}. Amount: {}. New totalSupplyC: {}.",
            [
                event.address.toHexString(),
                event.params.amount.toString(),
                market.totalSupplyC.toString()
            ]
        );
    }

    market.blockTimestamp = event.block.timestamp;
    market.save();
}
