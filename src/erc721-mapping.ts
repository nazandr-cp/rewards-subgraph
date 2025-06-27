import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { accrueSeconds } from "./utils/subsidies";
import { ADDRESS_ZERO_STR } from "./utils/const";
import {
  getOrCreateAccountSubsidiesPerCollection,
  getOrCreateUserEpochEligibility,
  getOrCreateCollection,
  getOrCreateSystemState,
  getOrCreateAccount,
} from "./utils/getters";

export function handleTransfer(event: TransferEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;

  // Use getOrCreateCollection to ensure the entity exists
  const collection = getOrCreateCollection(collectionAddress);

  const loadedCollectionParticipations = collection.participations.load();

  if (loadedCollectionParticipations.length == 0) {
    log.info(
      "handleTransfer: Collection {} is not registered in any CollectionVault. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  // Update UserEpochEligibility for the active epoch
  const systemState = getOrCreateSystemState();
  const activeEpochId: string | null = systemState.activeEpochId;

  if (activeEpochId != null) {
    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      const fromAccount = getOrCreateAccount(fromAddress);
      const userEpochEligibilityFrom = getOrCreateUserEpochEligibility(
        fromAccount.id,
        activeEpochId as string,
        collection.id
      );
      userEpochEligibilityFrom.nftBalance =
        userEpochEligibilityFrom.nftBalance.minus(BigInt.fromI32(1));
      userEpochEligibilityFrom.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      const toAccount = getOrCreateAccount(toAddress);
      const userEpochEligibilityTo = getOrCreateUserEpochEligibility(
        toAccount.id,
        activeEpochId as string,
        collection.id
      );
      userEpochEligibilityTo.nftBalance =
        userEpochEligibilityTo.nftBalance.plus(BigInt.fromI32(1));
      userEpochEligibilityTo.save();
    }
  }

  // Original logic for AccountSubsidiesPerCollection (related to specific vaults)
  for (let i = 0; i < loadedCollectionParticipations.length; i++) {
    const collectionParticipation = loadedCollectionParticipations[i];

    if (collectionParticipation == null) {
      log.warning(
        "handleTransfer: Found a null CollectionParticipation in collection.participations for Collection {}. Skipping.",
        [collection.id]
      );
      continue;
    }

    if (fromAddress.toHexString() != ADDRESS_ZERO_STR) {
      const fromAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        fromAddress,
        collectionParticipation.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(fromAccSubsidies, collectionParticipation, timestamp);

      fromAccSubsidies.balanceNFT = fromAccSubsidies.balanceNFT.minus(
        BigInt.fromI32(1)
      );
      fromAccSubsidies.save();
    }

    if (toAddress.toHexString() != ADDRESS_ZERO_STR) {
      const toAccSubsidies = getOrCreateAccountSubsidiesPerCollection(
        toAddress,
        collectionParticipation.id,
        blockNumber,
        timestamp
      );

      accrueSeconds(toAccSubsidies, collectionParticipation, timestamp);

      toAccSubsidies.balanceNFT = toAccSubsidies.balanceNFT.plus(
        BigInt.fromI32(1)
      );
      toAccSubsidies.save();
    }
  }
}
