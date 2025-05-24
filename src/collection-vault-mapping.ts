import {
    CollectionDeposit as CollectionDepositEvent,
    CollectionWithdraw as CollectionWithdrawEvent
} from "../generated/CollectionVault/CollectionVault"
import { CollectionMarket } from "../generated/schema"
import { BigInt, log } from "@graphprotocol/graph-ts"
import { ZERO_BI } from "./utils/rewards"

function convertTo18DecimalsBI(value: BigInt, currentDecimals: i32): BigInt {
    if (currentDecimals == 18) {
        return value;
    }
    let factor: BigInt;
    if (currentDecimals < 18) {
        const diff = 18 - currentDecimals;
        factor = BigInt.fromI32(10).pow(diff as u8);
        return value.times(factor);
    } else {
        const diff = currentDecimals - 18;
        factor = BigInt.fromI32(10).pow(diff as u8);
        if (factor.equals(ZERO_BI)) return ZERO_BI;
        return value.div(factor);
    }
}

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
    const id = event.params.collectionAddress.concat(event.address);
    let entity = CollectionMarket.load(id);

    if (!entity) {
        entity = new CollectionMarket(id);
        entity.collection = event.params.collectionAddress;
        entity.market = event.address;
        entity.totalNFT = ZERO_BI;
        entity.totalSeconds = ZERO_BI;
        entity.principalU = ZERO_BI;
    }

    entity.totalNFT = entity.totalNFT.plus(event.params.shares);

    const assetDecimals = 18;

    const assetsNormalizedBI = convertTo18DecimalsBI(event.params.assets, assetDecimals);
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
    const id = event.params.collectionAddress.concat(event.address);
    const entity = CollectionMarket.load(id);

    if (entity) {
        entity.totalNFT = entity.totalNFT.minus(event.params.shares);

        const assetDecimals = 18;

        const assetsNormalizedBI = convertTo18DecimalsBI(event.params.assets, assetDecimals);
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


