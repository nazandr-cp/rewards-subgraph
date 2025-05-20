import { BigInt, Bytes, log, Address } from "@graphprotocol/graph-ts";
import {
  TransferSingle as TransferSingleEvent,
  TransferBatch as TransferBatchEvent,
} from "../generated/templates/ERC1155/ERC1155"; // Correct path from subgraph.yaml template
import { Account, AccountCollectionReward, CollectionReward } from "../generated/schema";
import {
  accrueSeconds,
  getOrCreateAccountCollectionReward,
  getOrCreateAccount,
  HARDCODED_REWARD_TOKEN_ADDRESS,
  ZERO_BI,
  ADDRESS_ZERO_STR
} from "./helpers";

const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);

export function handleTransferSingle(event: TransferSingleEvent): void {
  let collectionAddress = event.address; // The ERC1155 contract address
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let tokenId = event.params.id; // Specific ID of the ERC1155 token
  let value = event.params.value; // Amount of tokens transferred
  let timestamp = event.block.timestamp;

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

  let collectionRewardIdString = collectionAddress.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
  let collectionRewardEntity = CollectionReward.load(Bytes.fromHexString(collectionRewardIdString));

  if (collectionRewardEntity == null) {
    log.info(
      "handleTransferSingle (ERC1155): CollectionReward not found for collection {}. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  if (fromAddress.notEqual(ADDRESS_ZERO)) {
    let fromAccountEntity = getOrCreateAccount(fromAddress);
    let fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);
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
    let toAccountEntity = getOrCreateAccount(toAddress);
    let toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(toAcr, collectionRewardEntity, timestamp);
    toAcr.balanceNFT = toAcr.balanceNFT.plus(value);
    toAcr.lastUpdate = timestamp;
    toAcr.save();
  }

  collectionRewardEntity.lastUpdate = timestamp;
  collectionRewardEntity.save();
}

export function handleTransferBatch(event: TransferBatchEvent): void {
  let collectionAddress = event.address;
  let fromAddress = event.params.from;
  let toAddress = event.params.to;
  let tokenIds = event.params.ids;
  let values = event.params.values;
  let timestamp = event.block.timestamp;

  log.info(
    "handleTransferBatch (ERC1155): collection {}, from {}, to {}, count {}",
    [
      collectionAddress.toHexString(),
      fromAddress.toHexString(),
      toAddress.toHexString(),
      BigInt.fromI32(tokenIds.length).toString()
    ]
  );

  let collectionRewardIdString = collectionAddress.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
  let collectionRewardEntity = CollectionReward.load(Bytes.fromHexString(collectionRewardIdString));

  if (collectionRewardEntity == null) {
    log.info(
      "handleTransferBatch (ERC1155): CollectionReward not found for collection {}. Skipping.",
      [collectionAddress.toHexString()]
    );
    return;
  }

  // Accrue once before processing all balance changes for the batch
  let fromAcr: AccountCollectionReward | null = null;
  if (fromAddress.notEqual(ADDRESS_ZERO)) {
    let fromAccountEntity = getOrCreateAccount(fromAddress);
    fromAcr = getOrCreateAccountCollectionReward(fromAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(fromAcr, collectionRewardEntity, timestamp);
  }

  let toAcr: AccountCollectionReward | null = null;
  if (toAddress.notEqual(ADDRESS_ZERO)) {
    let toAccountEntity = getOrCreateAccount(toAddress);
    toAcr = getOrCreateAccountCollectionReward(toAccountEntity, collectionRewardEntity, timestamp);
    accrueSeconds(toAcr, collectionRewardEntity, timestamp); // Accrue for 'to' as well before balance updates
  }

  // Process balance changes
  for (let i = 0; i < tokenIds.length; i++) {
    let value = values[i];
    // let tokenId = tokenIds[i]; // tokenId not directly used in balanceNFT sum if it's total quantity

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
