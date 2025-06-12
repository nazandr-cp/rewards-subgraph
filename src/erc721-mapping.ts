import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { Collection, SystemState, Account } from "../generated/schema";
import { accrueSeconds } from "./utils/rewards";
import { ADDRESS_ZERO_STR, SYSTEM_STATE_ID, ZERO_BI } from "./utils/const";
import { getOrCreateAccountRewardsPerCollection, getOrCreateUserEpochEligibility } from "./utils/getters";

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

  // Update UserEpochEligibility for the active epoch
  const systemState = SystemState.load(SYSTEM_STATE_ID);
  let activeEpochId: string | null = null;
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  }

  if (activeEpochId != null) {
    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      let fromAccount = Account.load(fromAddress.toHexString());
      if(fromAccount == null) {
        fromAccount = new Account(fromAddress.toHexString());
        fromAccount.totalSecondsClaimed = ZERO_BI;
        fromAccount.save();
      }
      const userEpochEligibilityFrom = getOrCreateUserEpochEligibility(
        fromAccount.id,
        activeEpochId!,
        collection.id
      );
      userEpochEligibilityFrom.nftBalance = userEpochEligibilityFrom.nftBalance.minus(BigInt.fromI32(1));
      userEpochEligibilityFrom.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      let toAccount = Account.load(toAddress.toHexString());
      if(toAccount == null) {
        toAccount = new Account(toAddress.toHexString());
        toAccount.totalSecondsClaimed = ZERO_BI;
        toAccount.save();
      }
      const userEpochEligibilityTo = getOrCreateUserEpochEligibility(
        toAccount.id,
        activeEpochId!,
        collection.id
      );
      userEpochEligibilityTo.nftBalance = userEpochEligibilityTo.nftBalance.plus(BigInt.fromI32(1));
      userEpochEligibilityTo.save();
    }
  }

  // Original logic for AccountRewardsPerCollection (related to specific vaults)
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
