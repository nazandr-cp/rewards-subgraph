import { BigInt, log, Address } from "@graphprotocol/graph-ts";
import {
  TransferSingle as TransferSingleEvent,
  TransferBatch as TransferBatchEvent,
} from "../generated/templates/ERC1155/ERC1155";
import { AccountCollectionReward, CollectionReward } from "../generated/schema";
import {
  accrueSeconds,
  getOrCreateAccountCollectionReward,
  getOrCreateAccount,
  generateCollectionRewardId,
  HARDCODED_REWARD_TOKEN_ADDRESS,
  ZERO_BI,
  ADDRESS_ZERO_STR
} from "./utils/rewards";

const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);

export function handleTransferSingle(event: TransferSingleEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const tokenId = event.params.id;
  const value = event.params.value;
  const timestamp = event.block.timestamp;

  log.info(
    "handleTransferSingle (ERC1155): collection {}, from {}, to {}, tokenId {}, value {}",
    [
      collectionAddress.toHexString(),
      fromAddress.toHexString(),
      toAddress.toHexString(),
      tokenId.toString(),
      value.toString()
    ]
  );

  const collectionRewardId = generateCollectionRewardId(collectionAddress, HARDCODED_REWARD_TOKEN_ADDRESS);
  const collectionRewardEntity = CollectionReward.load(collectionRewardId);

  if (collectionRewardEntity == null) {
    log.info(
      "handleTransferSingle (ERC1155): CollectionReward not found for collection {}. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  if (fromAddress.notEqual(ADDRESS_ZERO)) {
    const fromAccountEntity = getOrCreateAccount(fromAddress);
    const fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(fromAcr, collectionRewardEntity, timestamp);
    fromAcr.balanceNFT = fromAcr.balanceNFT.minus(value);
    if (fromAcr.balanceNFT.lt(ZERO_BI)) {
      log.warning("ERC1155 balanceNFT for account {} in collection {} went negative.", [fromAddress.toHexString(), collectionAddress.toHexString()]);
      fromAcr.balanceNFT = ZERO_BI;
    }
    fromAcr.lastUpdate = timestamp;
    fromAcr.save();
  }

  if (toAddress.notEqual(ADDRESS_ZERO)) {
    const toAccountEntity = getOrCreateAccount(toAddress);
    const toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(toAcr, collectionRewardEntity, timestamp);
    toAcr.balanceNFT = toAcr.balanceNFT.plus(value);
    toAcr.lastUpdate = timestamp;
    toAcr.save();
  }

  collectionRewardEntity.lastUpdate = timestamp;
  collectionRewardEntity.save();
}

export function handleTransferBatch(event: TransferBatchEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const tokenIds = event.params.ids;
  const values = event.params.values;
  const timestamp = event.block.timestamp;

  log.info(
    "handleTransferBatch (ERC1155): collection {}, from {}, to {}, count {}",
    [
      collectionAddress.toHexString(),
      fromAddress.toHexString(),
      toAddress.toHexString(),
      BigInt.fromI32(tokenIds.length).toString()
    ]
  );

  const collectionRewardId = generateCollectionRewardId(collectionAddress, HARDCODED_REWARD_TOKEN_ADDRESS);
  const collectionRewardEntity = CollectionReward.load(collectionRewardId);

  if (collectionRewardEntity == null) {
    log.info(
      "handleTransferBatch (ERC1155): CollectionReward not found for collection {}. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  let fromAcr: AccountCollectionReward | null = null;
  if (fromAddress.notEqual(ADDRESS_ZERO)) {
    const fromAccountEntity = getOrCreateAccount(fromAddress);
    fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(fromAcr, collectionRewardEntity, timestamp);
  }

  let toAcr: AccountCollectionReward | null = null;
  if (toAddress.notEqual(ADDRESS_ZERO)) {
    const toAccountEntity = getOrCreateAccount(toAddress);
    toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(toAcr, collectionRewardEntity, timestamp);
  }

  for (let i = 0; i < tokenIds.length; i++) {
    const value = values[i];

    if (fromAcr != null) {
      fromAcr.balanceNFT = fromAcr.balanceNFT.minus(value);
    }
    if (toAcr != null) {
      toAcr.balanceNFT = toAcr.balanceNFT.plus(value);
    }
  }

  if (fromAcr != null) {
    if (fromAcr.balanceNFT.lt(ZERO_BI)) {
      log.warning("ERC1155 batch balanceNFT for account {} in collection {} went negative.", [fromAddress.toHexString(), collectionAddress.toHexString()]);
      fromAcr.balanceNFT = ZERO_BI;
    }
    fromAcr.lastUpdate = timestamp;
    fromAcr.save();
  }

  if (toAcr != null) {
    toAcr.lastUpdate = timestamp;
    toAcr.save();
  }

  collectionRewardEntity.lastUpdate = timestamp;
  collectionRewardEntity.save();
}
