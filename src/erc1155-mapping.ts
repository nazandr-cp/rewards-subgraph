import { BigInt, log } from "@graphprotocol/graph-ts";
import {
  TransferSingle as TransferSingleEvent,
  TransferBatch as TransferBatchEvent,
} from "../generated/ERC1155Collection/ERC1155"; // Adjusted path, assuming similar structure to ERC721
import { Collection, SystemState, Account } from "../generated/schema";
import { accrueSeconds } from "./utils/subsidies";
import { ADDRESS_ZERO_STR, SYSTEM_STATE_ID, ZERO_BI } from "./utils/const";
import {
  getOrCreateAccountSubsidiesPerCollection,
  getOrCreateUserEpochEligibility,
} from "./utils/getters";

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

  // Update UserEpochEligibility for the active epoch
  const systemState = SystemState.load(SYSTEM_STATE_ID);
  let activeEpochId: string | null = null;
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  }

  if (activeEpochId != null) {
    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      let fromAccount = Account.load(fromAddress.toHexString());
      if (fromAccount == null) {
        fromAccount = new Account(fromAddress.toHexString());
        fromAccount.totalSecondsClaimed = ZERO_BI;
        fromAccount.save();
      }
      const userEpochEligibilityFrom = getOrCreateUserEpochEligibility(
        fromAccount.id,
        activeEpochId,
        collection.id
      );
      userEpochEligibilityFrom.nftBalance =
        userEpochEligibilityFrom.nftBalance.minus(value);
      userEpochEligibilityFrom.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      let toAccount = Account.load(toAddress.toHexString());
      if (toAccount == null) {
        toAccount = new Account(toAddress.toHexString());
        toAccount.totalSecondsClaimed = ZERO_BI;
        toAccount.save();
      }
      const userEpochEligibilityTo = getOrCreateUserEpochEligibility(
        toAccount.id,
        activeEpochId,
        collection.id
      );
      userEpochEligibilityTo.nftBalance =
        userEpochEligibilityTo.nftBalance.plus(value);
      userEpochEligibilityTo.save();
    }
  }

  // Original logic for AccountSubsidiesPerCollection (related to specific vaults)
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
      const fromAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        fromAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(fromAccSubsidies, collectionVault, timestamp);

      fromAccSubsidies.balanceNFT = fromAccSubsidies.balanceNFT.minus(value);
      fromAccSubsidies.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      const toAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        toAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(toAccSubsidies, collectionVault, timestamp);

      toAccSubsidies.balanceNFT = toAccSubsidies.balanceNFT.plus(value);
      toAccSubsidies.save();
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

  // Update UserEpochEligibility for the active epoch
  const systemState = SystemState.load(SYSTEM_STATE_ID);
  let activeEpochId: string | null = null;
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  }

  let totalValue = BigInt.fromI32(0);
  for (let j = 0; j < values.length; j++) {
    totalValue = totalValue.plus(values[j]);
  }

  if (activeEpochId != null) {
    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      let fromAccount = Account.load(fromAddress.toHexString());
      if (fromAccount == null) {
        fromAccount = new Account(fromAddress.toHexString());
        fromAccount.totalSecondsClaimed = ZERO_BI;
        fromAccount.save();
      }
      const userEpochEligibilityFrom = getOrCreateUserEpochEligibility(
        fromAccount.id,
        activeEpochId,
        collection.id
      );
      userEpochEligibilityFrom.nftBalance =
        userEpochEligibilityFrom.nftBalance.minus(totalValue);
      userEpochEligibilityFrom.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      let toAccount = Account.load(toAddress.toHexString());
      if (toAccount == null) {
        toAccount = new Account(toAddress.toHexString());
        toAccount.totalSecondsClaimed = ZERO_BI;
        toAccount.save();
      }
      const userEpochEligibilityTo = getOrCreateUserEpochEligibility(
        toAccount.id,
        activeEpochId,
        collection.id
      );
      userEpochEligibilityTo.nftBalance =
        userEpochEligibilityTo.nftBalance.plus(totalValue);
      userEpochEligibilityTo.save();
    }
  }

  const loadedCollectionVaults = collection.vaults.load();

  if (loadedCollectionVaults.length == 0) {
    log.info(
      "handleTransferBatch: Collection {} is not registered in any CollectionVault. Skipping AccountSubsidiesPerCollection update.",
      [collectionAddress.toHexString()]
    );
    return; // If no vaults, no AccountSubsidiesPerCollection to update. UserEpochEligibility is already handled.
  }

  // Original logic for AccountSubsidiesPerCollection (related to specific vaults)
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
      const fromAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        fromAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(fromAccSubsidies, collectionVault, timestamp);

      fromAccSubsidies.balanceNFT =
        fromAccSubsidies.balanceNFT.minus(totalValue);
      fromAccSubsidies.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      const toAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        toAddress,
        collectionVault.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(toAccSubsidies, collectionVault, timestamp);

      toAccSubsidies.balanceNFT = toAccSubsidies.balanceNFT.plus(totalValue);
      toAccSubsidies.save();
    }
  }
}
