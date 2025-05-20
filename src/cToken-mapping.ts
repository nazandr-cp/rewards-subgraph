import { BigInt, Address, Bytes, log, BigDecimal, ethereum } from "@graphprotocol/graph-ts";
import {
    AccrueInterest as AccrueInterestEvent,
    Borrow as BorrowEvent,
    LiquidateBorrow as LiquidateBorrowEvent,
    Mint as MintEvent,
    Redeem as RedeemEvent,
    RepayBorrow as RepayBorrowEvent,
    Transfer as TransferEvent,
    cToken
} from "../generated/cToken/cToken";
import { ERC20 } from "../generated/cToken/ERC20";
import { ERC20SymbolBytes } from "../generated/cToken/ERC20SymbolBytes";
import { Comptroller } from "../generated/cToken/Comptroller";

import {
    CTokenMarket,
    Account,
    Liquidation,
    MarketData
} from "../generated/schema";
import {
    ZERO_BI,
    ZERO_BD,
    ONE_BD,
    exponentToBigDecimal,
    ADDRESS_ZERO_STR,
    getOrCreateAccount
} from "./helpers";

const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);

function getOrCreateCTokenMarket(
    marketAddress: Address,
    blockTimestamp: BigInt
): CTokenMarket {
    let market = CTokenMarket.load(marketAddress);
    if (market == null) {
        market = new CTokenMarket(marketAddress);
        let cTokenContract = cToken.bind(marketAddress);

        let underlyingAddress: Address = ADDRESS_ZERO;
        let underlyingSymbol: string = "UNKNOWN";
        let underlyingDecimals: i32 = 18;

        let underlyingTry = cTokenContract.try_underlying();
        if (!underlyingTry.reverted && underlyingTry.value.notEqual(ADDRESS_ZERO)) {
            underlyingAddress = underlyingTry.value;
            let underlyingContract = ERC20.bind(underlyingAddress);

            let symbolTry = underlyingContract.try_symbol();
            if (!symbolTry.reverted) {
                underlyingSymbol = symbolTry.value;
            } else {
                let symbolBytesContract = ERC20SymbolBytes.bind(underlyingAddress);
                let symbolBytesTry = symbolBytesContract.try_symbol();
                if (!symbolBytesTry.reverted) {
                    underlyingSymbol = symbolBytesTry.value.toString();
                } else {
                    log.warning("Underlying symbol call reverted for token {}", [underlyingAddress.toHexString()]);
                }
            }

            let decimalsTry = underlyingContract.try_decimals();
            if (!decimalsTry.reverted) {
                underlyingDecimals = decimalsTry.value;
            } else {
                log.warning("Underlying decimals call reverted for token {}", [underlyingAddress.toHexString()]);
            }
        } else if (underlyingTry.reverted || underlyingTry.value.equals(ADDRESS_ZERO)) {
            underlyingAddress = ADDRESS_ZERO;
            underlyingSymbol = "ETH"; // Assuming ETH market if no underlying or call reverts
            underlyingDecimals = 18;
            if (underlyingTry.reverted) {
                log.warning("underlying() call reverted for cToken {}, assuming ETH market", [marketAddress.toHexString()]);
            }
        }

        market.underlying = underlyingAddress;
        market.underlyingSymbol = underlyingSymbol;
        market.underlyingDecimals = underlyingDecimals;

        market.totalSupplyC = cTokenContract.totalSupply();
        market.totalBorrowsU = cTokenContract.totalBorrows();
        market.totalReservesU = cTokenContract.totalReserves();

        let exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
        if (!exchangeRateStoredTry.reverted) {
            market.exchangeRate = exchangeRateStoredTry.value.toBigDecimal().div(exponentToBigDecimal(18)); // exchange rate is scaled by 1e18
        } else {
            log.warning("exchangeRateStored() call reverted for cToken {}", [marketAddress.toHexString()]);
            market.exchangeRate = ZERO_BD;
        }

        // Fetch collateralFactor from Comptroller
        let comptrollerAddressTry = cTokenContract.try_comptroller();
        if (!comptrollerAddressTry.reverted) {
            let comptrollerAddress = comptrollerAddressTry.value;
            let comptrollerContract = Comptroller.bind(comptrollerAddress);
            // Attempt to get collateral factor was removed as 'markets' function is not in the Comptroller ABI
            log.warning("Comptroller.markets() function not found in ABI for cToken {}. Setting collateralFactor to 0.", [marketAddress.toHexString()]);
            market.collateralFactor = ZERO_BD;
        } else {
            log.warning("cToken.comptroller() call reverted for cToken {}", [marketAddress.toHexString()]);
            market.collateralFactor = ZERO_BD;
        }
        market.borrowIndex = ZERO_BI; // Initialize borrowIndex
        market.lastAccrualTimestamp = blockTimestamp;
        market.blockTimestamp = blockTimestamp;
        market.save();
    }
    return market;
}


export function handleAccrueInterest(event: AccrueInterestEvent): void {
    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    let cTokenContract = cToken.bind(event.address);

    market.totalBorrowsU = event.params.totalBorrows;
    market.borrowIndex = event.params.borrowIndex;
    market.totalReservesU = cTokenContract.totalReserves(); // Fetches the latest total reserves
    market.lastAccrualTimestamp = event.block.timestamp;

    let exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
    if (!exchangeRateStoredTry.reverted) {
        market.exchangeRate = exchangeRateStoredTry.value.toBigDecimal().div(exponentToBigDecimal(18));
    } else {
        log.warning("exchangeRateStored() call reverted in AccrueInterest for cToken {}", [event.address.toHexString()]);
    }
    market.blockTimestamp = event.block.timestamp;
    market.save();

    // Optionally update MarketData entity
    let md = MarketData.load(event.address);
    if (md == null) {
        md = new MarketData(event.address);
    }
    md.totalSupply = cTokenContract.totalSupply(); // Fetch latest totalSupply
    md.totalBorrow = event.params.totalBorrows;
    md.totalReserves = market.totalReservesU;
    md.accruedInterest = event.params.interestAccumulated;
    md.lastInterestUpdate = event.block.timestamp;
    md.save();
}

export function handleBorrow(event: BorrowEvent): void {
    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.borrower);

    market.totalBorrowsU = event.params.totalBorrows;
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {
    let borrowedMarket = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    let collateralMarket = getOrCreateCTokenMarket(event.params.cTokenCollateral, event.block.timestamp);

    let liquidator = getOrCreateAccount(event.params.liquidator);
    let borrower = getOrCreateAccount(event.params.borrower);

    let borrowedCTokenContract = cToken.bind(event.address);
    borrowedMarket.totalBorrowsU = borrowedCTokenContract.totalBorrows();
    borrowedMarket.blockTimestamp = event.block.timestamp;
    borrowedMarket.save();

    let collateralCTokenContract = cToken.bind(event.params.cTokenCollateral);
    collateralMarket.totalSupplyC = collateralCTokenContract.totalSupply();
    collateralMarket.blockTimestamp = event.block.timestamp;
    collateralMarket.save();

    let liquidation = new Liquidation(event.transaction.hash.concatI32(event.logIndex.toI32()));
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
    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.minter);

    let cTokenContract = cToken.bind(event.address);
    market.totalSupplyC = cTokenContract.totalSupply();
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleRedeem(event: RedeemEvent): void {
    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.redeemer);

    let cTokenContract = cToken.bind(event.address);
    market.totalSupplyC = cTokenContract.totalSupply();
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleRepayBorrow(event: RepayBorrowEvent): void {
    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.payer);
    getOrCreateAccount(event.params.borrower);

    market.totalBorrowsU = event.params.totalBorrows;
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleTransfer(event: TransferEvent): void {
    getOrCreateAccount(event.params.from);
    getOrCreateAccount(event.params.to);

    let market = getOrCreateCTokenMarket(event.address, event.block.timestamp);

    if (event.params.from == ADDRESS_ZERO) {
        let cTokenContract = cToken.bind(event.address);
        market.totalSupplyC = cTokenContract.totalSupply();
        log.info("Transfer from ZERO_ADDRESS detected for market {} (cToken {}), amount {}. Assuming mint-like.", [market.id.toHexString(), event.address.toHexString(), event.params.amount.toString()]);
    } else if (event.params.to == ADDRESS_ZERO) {
        let cTokenContract = cToken.bind(event.address);
        market.totalSupplyC = cTokenContract.totalSupply();
        log.info("Transfer to ZERO_ADDRESS detected for market {} (cToken {}), amount {}. Assuming burn-like.", [market.id.toHexString(), event.address.toHexString(), event.params.amount.toString()]);
    }

    market.blockTimestamp = event.block.timestamp;
    market.save();
}
