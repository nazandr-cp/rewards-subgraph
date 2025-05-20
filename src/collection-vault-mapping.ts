import {
    CollectionDeposit as CollectionDepositEvent,
    CollectionWithdraw as CollectionWithdrawEvent
} from "../generated/CollectionVault/CollectionVault"
import { CollectionMarket } from "../generated/schema"
import { cToken } from "../generated/cToken/cToken"
import { ERC20 } from "../generated/cToken/ERC20"
import { BigInt, BigDecimal, log, Bytes, Address } from "@graphprotocol/graph-ts"
import { ZERO_BI, ONE_BI, ZERO_BD } from "./utils/rewards"

function fetchTokenDecimals(tokenAddress: Address): i32 {
    let contract = ERC20.bind(tokenAddress);
    let decimalValue = 18;
    let decimalResult = contract.try_decimals();
    if (!decimalResult.reverted) {
        if (decimalResult.value > 0) {
            decimalValue = decimalResult.value;
        } else {
            log.warning("fetchTokenDecimals: decimals() returned 0 or negative for token {}", [tokenAddress.toHexString()]);
        }
    } else {
        log.warning("fetchTokenDecimals: decimals() reverted for token {}", [tokenAddress.toHexString()]);
    }
    return decimalValue;
}

function convertTo18DecimalsBI(value: BigInt, currentDecimals: i32): BigInt {
    if (currentDecimals == 18) {
        return value;
    }
    let factor: BigInt;
    if (currentDecimals < 18) {
        let diff = 18 - currentDecimals;
        factor = BigInt.fromI32(10).pow(diff as u8);
        return value.times(factor);
    } else {
        let diff = currentDecimals - 18;
        factor = BigInt.fromI32(10).pow(diff as u8);
        if (factor.equals(ZERO_BI)) return ZERO_BI;
        return value.div(factor);
    }
}

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
    let id = event.params.collectionAddress.concat(event.address);
    let entity = CollectionMarket.load(id);

    if (!entity) {
        entity = new CollectionMarket(id);
        entity.collection = event.params.collectionAddress;
        entity.market = event.address; // This is the cToken address (market)
        entity.totalNFT = ZERO_BI;
        entity.totalSeconds = ZERO_BI; // Initialize, actual usage TBD
        entity.principalU = ZERO_BI;
    }

    entity.totalNFT = entity.totalNFT.plus(ONE_BI);

    let assetDecimals = 18;
    let cTokenAddress = event.address;
    let cTokenContract = cToken.bind(cTokenAddress);
    let underlyingAssetAddressResult = cTokenContract.try_underlying();

    if (!underlyingAssetAddressResult.reverted) {
        let underlyingAddress = underlyingAssetAddressResult.value;
        assetDecimals = fetchTokenDecimals(underlyingAddress);
    } else {
        log.warning("handleCollectionDeposit: CToken.underlying() reverted for cToken {}", [cTokenAddress.toHexString()]);
    }

    let assetsNormalizedBI = convertTo18DecimalsBI(event.params.assets, assetDecimals);
    entity.principalU = entity.principalU.plus(assetsNormalizedBI);

    log.info(
        "CollectionDeposit: collection {}, market (cToken) {}, caller {}, receiver {}, assets {}, shares {}, new totalNFT {}, new principalU {}",
        [
            event.params.collectionAddress.toHexString(),
            event.address.toHexString(),
            event.params.caller.toHexString(),
            event.params.receiver.toHexString(),
            event.params.assets.toString(),
            event.params.shares.toString(),
            entity.totalNFT.toString(),
            entity.principalU.toString()
        ]
    );

    entity.save();
}

export function handleCollectionWithdraw(event: CollectionWithdrawEvent): void {
    let id = event.params.collectionAddress.concat(event.address);
    let entity = CollectionMarket.load(id);

    if (entity) {
        entity.totalNFT = entity.totalNFT.minus(ONE_BI);

        let assetDecimals = 18;
        let cTokenAddress = event.address;
        let cTokenContract = cToken.bind(cTokenAddress);
        let underlyingAssetAddressResult = cTokenContract.try_underlying();

        if (!underlyingAssetAddressResult.reverted) {
            let underlyingAddress = underlyingAssetAddressResult.value;
            assetDecimals = fetchTokenDecimals(underlyingAddress);
        } else {
            log.warning("handleCollectionWithdraw: CToken.underlying() reverted for cToken {}", [cTokenAddress.toHexString()]);
        }

        let assetsNormalizedBI = convertTo18DecimalsBI(event.params.assets, assetDecimals);
        entity.principalU = entity.principalU.minus(assetsNormalizedBI);

        if (entity.principalU.lt(ZERO_BI)) {
            log.warning("CollectionWithdraw: principalU for collection {} market {} went negative. Resetting to zero.", [
                event.params.collectionAddress.toHexString(),
                event.address.toHexString()
            ]);
            entity.principalU = ZERO_BI;
        }
        if (entity.totalNFT.lt(ZERO_BI)) {
            log.warning("CollectionWithdraw: totalNFT for collection {} market {} went negative. Resetting to zero.", [
                event.params.collectionAddress.toHexString(),
                event.address.toHexString()
            ]);
            entity.totalNFT = ZERO_BI;
        }

        log.info(
            "CollectionWithdraw: collection {}, market (cToken) {}, caller {}, receiver {}, owner {}, assets {}, shares {}, new totalNFT {}, new principalU {}",
            [
                event.params.collectionAddress.toHexString(),
                event.address.toHexString(),
                event.params.caller.toHexString(),
                event.params.receiver.toHexString(),
                event.params.owner.toHexString(),
                event.params.assets.toString(),
                event.params.shares.toString(),
                entity.totalNFT.toString(),
                entity.principalU.toString()
            ]
        );
        entity.save();
    } else {
        log.warning(
            "CollectionWithdraw: CollectionMarket entity not found for collection {} and market (cToken) {}. This may happen if withdraw occurs before any deposit was recorded for this specific collection in this market.",
            [
                event.params.collectionAddress.toHexString(),
                event.address.toHexString()
            ]
        );
    }
}


