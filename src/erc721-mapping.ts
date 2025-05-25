import { BigInt } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/templates/ERC721/ERC721";
import {
    accrueSeconds,
    getOrCreateAccountCollectionReward,
    getOrCreateAccount,
    getOrCreateCollectionReward,
    HARDCODED_REWARD_TOKEN_ADDRESS,
    HARDCODED_CTOKEN_MARKET_ADDRESS,
    WeightFunctionType
} from "./utils/rewards";

export function handleTransfer(event: TransferEvent): void {
    const collectionAddress = event.address;
    const fromAddress = event.params.from;
    const toAddress = event.params.to;
    const timestamp = event.block.timestamp;

    const collectionRewardEntity = getOrCreateCollectionReward(
        collectionAddress,
        HARDCODED_REWARD_TOKEN_ADDRESS,
        HARDCODED_CTOKEN_MARKET_ADDRESS,
        false,
        WeightFunctionType.LINEAR,
        timestamp
    );

    if (fromAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
        const fromAccountEntity = getOrCreateAccount(fromAddress);
        const fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);

        accrueSeconds(fromAcr, collectionRewardEntity, timestamp);

        fromAcr.balanceNFT = fromAcr.balanceNFT.minus(BigInt.fromI32(1));
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
