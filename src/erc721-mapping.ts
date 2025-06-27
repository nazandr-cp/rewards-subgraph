import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { ADDRESS_ZERO_STR } from "./utils/const";
import {
  getOrCreateCollection,
  getOrCreateAccount,
} from "./utils/getters";

export function handleTransfer(event: TransferEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const tokenId = event.params.tokenId;
  const timestamp = event.block.timestamp;
  const blockNumber = event.block.number;

  const isMint = fromAddress.toHexString() == ADDRESS_ZERO_STR;
  const isBurn = toAddress.toHexString() == ADDRESS_ZERO_STR;

  if (isMint) {
    log.info("NFT Mint: token {} to {} for collection {}", [
      tokenId.toString(),
      toAddress.toHexString(),
      collectionAddress.toHexString()
    ]);
  } else if (isBurn) {
    log.info("NFT Burn: token {} from {} for collection {}", [
      tokenId.toString(),
      fromAddress.toHexString(),
      collectionAddress.toHexString()
    ]);
  } else {
    log.info("NFT Transfer: token {} from {} to {} for collection {}", [
      tokenId.toString(),
      fromAddress.toHexString(),
      toAddress.toHexString(),
      collectionAddress.toHexString()
    ]);
  }

  // Always update Account NFT balances regardless of vault participation
  if (!isMint) {
    const fromAccount = getOrCreateAccount(fromAddress);
    fromAccount.totalNFTsOwned = fromAccount.totalNFTsOwned.minus(BigInt.fromI32(1));
    fromAccount.updatedAtBlock = blockNumber;
    fromAccount.updatedAtTimestamp = timestamp;
    fromAccount.save();

    log.info("Updated FROM account {} NFT balance to {}", [
      fromAddress.toHexString(),
      fromAccount.totalNFTsOwned.toString()
    ]);
  }

  if (!isBurn) {
    const toAccount = getOrCreateAccount(toAddress);
    toAccount.totalNFTsOwned = toAccount.totalNFTsOwned.plus(BigInt.fromI32(1));
    toAccount.updatedAtBlock = blockNumber;
    toAccount.updatedAtTimestamp = timestamp;
    toAccount.save();

    log.info("Updated TO account {} NFT balance to {}", [
      toAddress.toHexString(),
      toAccount.totalNFTsOwned.toString()
    ]);
  }

  // Create collection entity to ensure it exists
  const collection = getOrCreateCollection(collectionAddress);

  // Update collection stats for mints
  if (isMint) {
    collection.totalSupply = collection.totalSupply.plus(BigInt.fromI32(1));
    collection.updatedAtBlock = blockNumber;
    collection.updatedAtTimestamp = timestamp;
    collection.save();

    log.info("Updated collection {} total supply to {}", [
      collectionAddress.toHexString(),
      collection.totalSupply.toString()
    ]);
  } else if (isBurn) {
    collection.totalSupply = collection.totalSupply.minus(BigInt.fromI32(1));
    collection.updatedAtBlock = blockNumber;
    collection.updatedAtTimestamp = timestamp;
    collection.save();

    log.info("Updated collection {} total supply to {} after burn", [
      collectionAddress.toHexString(),
      collection.totalSupply.toString()
    ]);
  }

  log.info("NFT {} processed successfully for collection {}", [
    isMint ? "mint" : isBurn ? "burn" : "transfer",
    collectionAddress.toHexString()
  ]);
}
