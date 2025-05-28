import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  TransferSingle as TransferSingleEvent,
  TransferBatch as TransferBatchEvent,
} from "../generated/templates/ERC1155/ERC1155";
import { Collection } from "../generated/schema";
import { accrueSeconds } from "./utils/rewards";
import { ADDRESS_ZERO_STR } from "./utils/const";
import { getOrCreateAccountRewardsPerCollection } from "./utils/getters";

export function handleTransferSingle(event: TransferSingleEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const value = event.params.value;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;

  const collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    log.warning(
      "handleTransferSingle: Collection {} not found. Skipping transfer.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  const loadedCollectionVaults = collection.vaults.load();

  if (loadedCollectionVaults.length == 0) {
    log.info(
      "handleTransferSingle: Collection {} is not registered in any CollectionVault. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  for (let i = 0; i < loadedCollectionVaults.length; i++) {
    const collectionVault = loadedCollectionVaults[i];

    if (collectionVault == null) {
      log.warning(
        "handleTransferSingle: Found a null CollectionVault in collection.vaults for Collection {}. Skipping.",
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

      fromAccRewards.balanceNFT = fromAccRewards.balanceNFT.minus(value);
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

      toAccRewards.balanceNFT = toAccRewards.balanceNFT.plus(value);
      toAccRewards.save();
    }
  }
}

export function handleTransferBatch(event: TransferBatchEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const values = event.params.values;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;

  log.info(
    "handleTransferBatch (ERC1155): collection {}, from {}, to {}, count {}",
    [
      collectionAddress.toHexString(),
      fromAddress.toHexString(),
      toAddress.toHexString(),
      BigInt.fromI32(values.length).toString(),
    ]
  );

  const collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    log.warning(
      "handleTransferBatch: Collection {} not found. Skipping transfer.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  const loadedCollectionVaults = collection.vaults.load();

  if (loadedCollectionVaults.length == 0) {
    log.info(
      "handleTransferBatch: Collection {} is not registered in any CollectionVault. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  for (let i = 0; i < loadedCollectionVaults.length; i++) {
    const collectionVault = loadedCollectionVaults[i];

    if (collectionVault == null) {
      log.warning(
        "handleTransferBatch: Found a null CollectionVault in collection.vaults for Collection {}. Skipping.",
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

      let totalValueFrom = BigInt.fromI32(0);
      for (let j = 0; j < values.length; j++) {
        totalValueFrom = totalValueFrom.plus(values[j]);
      }
      fromAccRewards.balanceNFT =
        fromAccRewards.balanceNFT.minus(totalValueFrom);
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

      let totalValueTo = BigInt.fromI32(0);
      for (let j = 0; j < values.length; j++) {
        totalValueTo = totalValueTo.plus(values[j]);
      }
      toAccRewards.balanceNFT = toAccRewards.balanceNFT.plus(totalValueTo);
      toAccRewards.save();
    }
  }
}
