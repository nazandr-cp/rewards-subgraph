import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { Collection } from "../generated/schema";
import { accrueSeconds } from "./utils/rewards";
import { ADDRESS_ZERO_STR } from "./utils/const";
import { getOrCreateAccountRewardsPerCollection } from "./utils/getters";

export function handleTransfer(event: TransferEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;

  const collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    log.warning("handleTransfer: Collection {} not found. Skipping transfer.", [
      collectionAddress.toHexString(),
    ]);
    return;
  }

  const loadedCollectionVaults = collection.vaults.load();

  if (loadedCollectionVaults.length == 0) {
    log.info(
      "handleTransfer: Collection {} is not registered in any CollectionVault. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  for (let i = 0; i < loadedCollectionVaults.length; i++) {
    const collectionVault = loadedCollectionVaults[i];

    if (collectionVault == null) {
      log.warning(
        "handleTransfer: Found a null CollectionVault in collection.vaults for Collection {}. Skipping.",
        [collection.id]
      );
      continue;
    }

    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      const fromAccRewards = getOrCreateAccountRewardsPerCollection(
        fromAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(fromAccRewards, collectionVault, timestamp);

      fromAccRewards.balanceNFT = fromAccRewards.balanceNFT.minus(
        BigInt.fromI32(1)
      );
      fromAccRewards.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      const toAccRewards = getOrCreateAccountRewardsPerCollection(
        toAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(toAccRewards, collectionVault, timestamp);

      toAccRewards.balanceNFT = toAccRewards.balanceNFT.plus(BigInt.fromI32(1));
      toAccRewards.save();
    }
  }
}
