import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
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

import {
    CTokenMarket,
    Liquidation,
    MarketData
} from "../generated/schema";
import {
    ZERO_BI,
    ADDRESS_ZERO_STR,
    getOrCreateAccount,
} from "./utils/rewards";

const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);

function getOrCreateCTokenMarket(
    marketAddress: Address,
    blockTimestamp: BigInt
): CTokenMarket {
    let market = CTokenMarket.load(marketAddress);
    if (market == null) {
        market = new CTokenMarket(marketAddress);
        const cTokenContract = cToken.bind(marketAddress);

        let underlyingAddress: Address = ADDRESS_ZERO;
        let underlyingSymbol: string = "UNKNOWN";
        let underlyingDecimals: i32 = 18;

        const underlyingTry = cTokenContract.try_underlying();
        if (!underlyingTry.reverted && underlyingTry.value.notEqual(ADDRESS_ZERO)) {
            underlyingAddress = underlyingTry.value;
            const underlyingContract = ERC20.bind(underlyingAddress);

            const symbolTry = underlyingContract.try_symbol();
            if (!symbolTry.reverted) {
                underlyingSymbol = symbolTry.value;
            } else {
                const symbolBytesContract = ERC20SymbolBytes.bind(underlyingAddress);
                const symbolBytesTry = symbolBytesContract.try_symbol();
                if (!symbolBytesTry.reverted) {
                    underlyingSymbol = symbolBytesTry.value.toString();
                } else {
                    log.warning("Underlying symbol call reverted for token {}", [underlyingAddress.toHexString()]);
                }
            }

            const decimalsTry = underlyingContract.try_decimals();
            if (!decimalsTry.reverted) {
                underlyingDecimals = decimalsTry.value;
            } else {
                log.warning("Underlying decimals call reverted for token {}", [underlyingAddress.toHexString()]);
            }
        } else if (underlyingTry.reverted || underlyingTry.value.equals(ADDRESS_ZERO)) {
            underlyingAddress = ADDRESS_ZERO;
            underlyingSymbol = "ETH";
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

        const exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
        if (!exchangeRateStoredTry.reverted) {
            market.exchangeRate = exchangeRateStoredTry.value;
        } else {
            log.warning("exchangeRateStored() call reverted for cToken {}", [marketAddress.toHexString()]);
            market.exchangeRate = ZERO_BI;
        }

        const comptrollerAddressTry = cTokenContract.try_comptroller();
        if (!comptrollerAddressTry.reverted) {
            // const comptrollerAddress = comptrollerAddressTry.value; // Unused
            market.collateralFactor = ZERO_BI;
        } else {
            market.collateralFactor = ZERO_BI;
        }
        market.borrowIndex = ZERO_BI;
        market.lastAccrualTimestamp = blockTimestamp;
        market.blockTimestamp = blockTimestamp;
        market.save();
    }
    return market;
}


export function handleAccrueInterest(event: AccrueInterestEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    const cTokenContract = cToken.bind(event.address);

    market.totalBorrowsU = event.params.totalBorrows;
    market.borrowIndex = event.params.borrowIndex;
    market.totalReservesU = cTokenContract.totalReserves();
    market.lastAccrualTimestamp = event.block.timestamp;

    const exchangeRateStoredTry = cTokenContract.try_exchangeRateStored();
    if (!exchangeRateStoredTry.reverted) {
        market.exchangeRate = exchangeRateStoredTry.value;
    } else {
        log.warning("exchangeRateStored() call reverted in AccrueInterest for cToken {}", [event.address.toHexString()]);
    }
    market.blockTimestamp = event.block.timestamp;
    market.save();

    let md = MarketData.load(event.address);
    if (md == null) {
        md = new MarketData(Bytes.fromHexString(event.address.toHexString()));
    }
    md.totalSupply = cTokenContract.totalSupply();
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

    const borrowedCTokenContract = cToken.bind(event.address);
    borrowedMarket.totalBorrowsU = borrowedCTokenContract.totalBorrows();
    borrowedMarket.blockTimestamp = event.block.timestamp;
    borrowedMarket.save();

    const collateralCTokenContract = cToken.bind(event.params.cTokenCollateral);
    collateralMarket.totalSupplyC = collateralCTokenContract.totalSupply();
    collateralMarket.blockTimestamp = event.block.timestamp;
    collateralMarket.save();

    const liquidation = new Liquidation(event.transaction.hash.concatI32(event.logIndex.toI32()));
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

    const cTokenContract = cToken.bind(event.address);
    market.totalSupplyC = cTokenContract.totalSupply();
    market.blockTimestamp = event.block.timestamp;
    market.save();
}

export function handleRedeem(event: RedeemEvent): void {
    const market = getOrCreateCTokenMarket(event.address, event.block.timestamp);
    getOrCreateAccount(event.params.redeemer);

    const cTokenContract = cToken.bind(event.address);
    market.totalSupplyC = cTokenContract.totalSupply();
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

    const cTokenContract = cToken.bind(event.address);

    market.totalSupplyC = cTokenContract.totalSupply();

    if (event.params.from.equals(ADDRESS_ZERO)) {
        log.info(
            "Mint-like transfer (from ZERO_ADDRESS) detected for cToken {}. Amount: {}. New totalSupplyC: {}.",
            [
                event.address.toHexString(),
                event.params.amount.toString(),
                market.totalSupplyC.toString()
            ]
        );
    } else if (event.params.to.equals(ADDRESS_ZERO)) {
        log.info(
            "Burn-like transfer (to ZERO_ADDRESS) detected for cToken {}. Amount: {}. New totalSupplyC: {}.",
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
