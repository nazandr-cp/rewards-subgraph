import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/templates/ERC721/ERC721";
import { CollectionReward } from "../generated/schema";
import {
    accrueSeconds,
    getOrCreateAccountCollectionReward,
    getOrCreateAccount,
    HARDCODED_REWARD_TOKEN_ADDRESS // This is the reward token used by RewardsController
} from "./utils/rewards";

// This mapping handles NFT transfers for collections that have been whitelisted
// by the RewardsController. The CollectionReward entity should already exist.
export function handleTransfer(event: TransferEvent): void {
    const collectionAddress = event.address; // The NFT contract address
    const fromAddress = event.params.from;
    const toAddress = event.params.to;
    const tokenId = event.params.tokenId; // Not directly used in reward logic here, but good for logging
    const timestamp = event.block.timestamp;

    log.info(
        "handleTransfer (IERC721): collection {}, from {}, to {}, tokenId {}",
        [
            collectionAddress.toHexString(),
            fromAddress.toHexString(),
            toAddress.toHexString(),
            tokenId.toString(),
        ]
    );

    // Load the CollectionReward entity. It should have been created by RewardsController
    // using the HARDCODED_REWARD_TOKEN_ADDRESS.
    const collectionRewardIdString = collectionAddress.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
    const collectionRewardEntity = CollectionReward.load(Bytes.fromHexString(collectionRewardIdString));

    if (collectionRewardEntity == null) {
        log.info(
            "handleTransfer (IERC721): CollectionReward not found for collection {} and reward token {}. Skipping reward accrual for this transfer.",
            [collectionAddress.toHexString(), HARDCODED_REWARD_TOKEN_ADDRESS.toHexString()]
        );
        return;
    }

    // Update for the 'from' account (if not a mint)
    if (fromAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
        const fromAccountEntity = getOrCreateAccount(fromAddress);
        const fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);

        accrueSeconds(fromAcr, collectionRewardEntity, timestamp);

        fromAcr.balanceNFT = fromAcr.balanceNFT.minus(BigInt.fromI32(1));
        if (fromAcr.balanceNFT.lt(BigInt.fromI32(0))) { // Should not happen with correct event ordering
            log.warning("NFT balance for account {} in collection {} went negative.", [fromAddress.toHexString(), collectionAddress.toHexString()]);
            fromAcr.balanceNFT = BigInt.fromI32(0);
        }
        fromAcr.lastUpdate = timestamp;
        fromAcr.save();
    }

    // Update for the 'to' account (if not a burn)
    if (toAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
        const toAccountEntity = getOrCreateAccount(toAddress);
        const toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);

        accrueSeconds(toAcr, collectionRewardEntity, timestamp);

        toAcr.balanceNFT = toAcr.balanceNFT.plus(BigInt.fromI32(1));
        toAcr.lastUpdate = timestamp;
        toAcr.save();
    }

    // The accrueSeconds helper should save collectionRewardEntity if it modifies it (e.g. totalSecondsAccrued).
    // Explicitly ensure its lastUpdate is current if other direct modifications were made,
    // but accrueSeconds should handle its own state.
    // If accrueSeconds doesn't save, we might need to save it here.
    // The comment in helpers.ts accrueSeconds says "Caller saves acr and coll".
    collectionRewardEntity.lastUpdate = timestamp; // Ensure lastUpdate is current.
    collectionRewardEntity.save(); // Save CollectionReward as accrueSeconds modifies totalSecondsAccrued.
}
