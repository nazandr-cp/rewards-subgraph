import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/templates/ERC721/ERC721";
import { CollectionReward } from "../generated/schema";
import {
    accrueSeconds,
    getOrCreateAccountCollectionReward,
    getOrCreateAccount,
    HARDCODED_REWARD_TOKEN_ADDRESS,
    generateCollectionRewardId
} from "./utils/rewards";

export function handleTransfer(event: TransferEvent): void {
    const collectionAddress = event.address;
    const fromAddress = event.params.from;
    const toAddress = event.params.to;
    const timestamp = event.block.timestamp;

    const collectionRewardId = generateCollectionRewardId(collectionAddress, HARDCODED_REWARD_TOKEN_ADDRESS);
    const collectionRewardEntity = CollectionReward.load(collectionRewardId);

    if (collectionRewardEntity == null) {
        log.info(
            "handleTransfer (IERC721): CollectionReward not found for collection {} and reward token {}. Skipping reward accrual for this transfer.",
            [collectionAddress.toHexString(), HARDCODED_REWARD_TOKEN_ADDRESS.toHexString()]
        );
        return;
    }

    if (fromAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
        const fromAccountEntity = getOrCreateAccount(fromAddress);
        const fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);

        accrueSeconds(fromAcr, collectionRewardEntity, timestamp);

        if (fromAcr.balanceNFT.gt(BigInt.fromI32(0))) {
            fromAcr.balanceNFT = fromAcr.balanceNFT.minus(BigInt.fromI32(1));
        } else {
            log.warning(
                "Attempted to transfer NFT from account {} in collection {} which has a recorded balance of 0.",
                [fromAddress.toHexString(), collectionAddress.toHexString()]
            );
        }
        fromAcr.lastUpdate = timestamp;
        fromAcr.save();
    }

    if (toAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
        const toAccountEntity = getOrCreateAccount(toAddress);
        const toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);

        accrueSeconds(toAcr, collectionRewardEntity, timestamp);

        toAcr.balanceNFT = toAcr.balanceNFT.plus(BigInt.fromI32(1));
        toAcr.lastUpdate = timestamp;
        toAcr.save();
    }

    collectionRewardEntity.lastUpdate = timestamp;
    collectionRewardEntity.save();
}
