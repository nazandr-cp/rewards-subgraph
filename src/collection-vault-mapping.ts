import {
    CollectionDeposit as CollectionDepositEvent,
    CollectionWithdraw as CollectionWithdrawEvent
} from "../generated/CollectionVault/CollectionVault";
import { log, BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import { Account, CollectionReward, AccountCollectionReward } from "../generated/schema";
import {
    ZERO_BI,
    getOrCreateCollectionMarket,
    getOrCreateAccount,
    generateCollectionRewardId,
    getOrCreateAccountCollectionReward,
    HARDCODED_REWARD_TOKEN_ADDRESS,
    // getOrCreateCollectionReward, // Not creating CollectionReward here, only loading
    // HARDCODED_CTOKEN_MARKET_ADDRESS, // Not needed if only loading CollectionReward
    // WeightFunctionType // Not needed if only loading
} from "./utils/rewards";

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
    const entity = getOrCreateCollectionMarket(event.params.collectionAddress, event.address);

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

    // --- AccountCollectionReward Logic ---
    const accountId = event.params.receiver.toHexString();
    const account: Account = getOrCreateAccount(event.params.receiver as Bytes);

    const collectionAddress: Address = event.params.collectionAddress;
    const rewardTokenAddress = HARDCODED_REWARD_TOKEN_ADDRESS;
    const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardTokenAddress);
    const collectionReward = CollectionReward.load(collectionRewardId);

    if (collectionReward != null) {
        const accountCollectionReward: AccountCollectionReward = getOrCreateAccountCollectionReward(account, collectionReward, event.block.timestamp);
        accountCollectionReward.balanceNFT = accountCollectionReward.balanceNFT.plus(event.params.shares);
        accountCollectionReward.lastUpdate = event.block.timestamp;
        accountCollectionReward.save();
        log.info(
            "handleCollectionDeposit: Updated AccountCollectionReward {} for account {}, collectionReward {}. New balanceNFT: {}",
            [
                accountCollectionReward.id.toHexString(),
                accountId,
                collectionReward.id.toHexString(),
                accountCollectionReward.balanceNFT.toString()
            ]
        );
    } else {
        log.warning(
            "handleCollectionDeposit: CollectionReward not found for collection {} and reward token {}. AccountCollectionReward not updated.",
            [collectionAddress.toHexString(), rewardTokenAddress.toHexString()]
        );
    }
    // --- End AccountCollectionReward Logic ---
}

export function handleCollectionWithdraw(event: CollectionWithdrawEvent): void {
    const entity = getOrCreateCollectionMarket(event.params.collectionAddress, event.address);

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

        // --- AccountCollectionReward Logic ---
        // For withdraw, event.params.owner is the user whose NFT balance is affected.
        const accountId = event.params.owner.toHexString();
        const account: Account = getOrCreateAccount(event.params.owner as Bytes);

        const collectionAddress: Address = event.params.collectionAddress;
        const rewardTokenAddress = HARDCODED_REWARD_TOKEN_ADDRESS;
        const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardTokenAddress);
        const collectionReward = CollectionReward.load(collectionRewardId);

        if (collectionReward != null) {
            const accountCollectionReward: AccountCollectionReward = getOrCreateAccountCollectionReward(account, collectionReward, event.block.timestamp);
            const newBalance = accountCollectionReward.balanceNFT.minus(event.params.shares);
            accountCollectionReward.balanceNFT = newBalance.lt(ZERO_BI) ? ZERO_BI : newBalance; // Ensure non-negative
            accountCollectionReward.lastUpdate = event.block.timestamp;
            accountCollectionReward.save();
            log.info(
                "handleCollectionWithdraw: Updated AccountCollectionReward {} for account {}, collectionReward {}. New balanceNFT: {}",
                [
                    accountCollectionReward.id.toHexString(),
                    accountId,
                    collectionReward.id.toHexString(),
                    accountCollectionReward.balanceNFT.toString()
                ]
            );
        } else {
            log.warning(
                "handleCollectionWithdraw: CollectionReward not found for collection {} and reward token {}. AccountCollectionReward not updated.",
                [collectionAddress.toHexString(), rewardTokenAddress.toHexString()]
            );
        }
        // --- End AccountCollectionReward Logic ---

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


