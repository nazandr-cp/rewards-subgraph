import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { IERC721Metadata } from "../generated/ERC721Collection/IERC721Metadata";
import { ADDRESS_ZERO_STR } from "./utils/const";
import {
  getOrCreateCollection,
  getOrCreateAccount,
  getOrCreateAccountSubsidy,
} from "./utils/getters";
import { Collection } from "../generated/schema";
import { accrueSeconds } from "./utils/subsidies";

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

  const collection = getOrCreateCollection(collectionAddress);

  // Update collection name and symbol if they're still default values
  if (collection.name == "Unknown Collection" || collection.symbol == "UNKN") {
    const collectionContract = IERC721Metadata.bind(collectionAddress);

    const nameResult = collectionContract.try_name();
    if (!nameResult.reverted && collection.name == "Unknown Collection") {
      collection.name = nameResult.value;
    }

    const symbolResult = collectionContract.try_symbol();
    if (!symbolResult.reverted && collection.symbol == "UNKN") {
      collection.symbol = symbolResult.value;
    }
  }

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

  // Handle AccountSubsidiesPerCollection updates for collections that are part of vaults
  const collectionEntity = Collection.load(collectionAddress.toHexString());
  if (collectionEntity != null) {
    const loadedCollectionParticipations = collectionEntity.participations.load();

    if (loadedCollectionParticipations.length > 0) {
      log.info("Processing AccountSubsidiesPerCollection for {} collection participations", [
        BigInt.fromI32(loadedCollectionParticipations.length).toString()
      ]);

      for (let i = 0; i < loadedCollectionParticipations.length; i++) {
        const collectionParticipation = loadedCollectionParticipations[i];
        if (collectionParticipation == null) continue;

        // Update FROM account subsidies (decrease NFT balance)
        if (!isMint) {
          const fromAccSubsidies = getOrCreateAccountSubsidy(
            fromAddress,
            collectionParticipation.id,
            blockNumber,
            timestamp
          );

          accrueSeconds(fromAccSubsidies, collectionParticipation, timestamp);
          fromAccSubsidies.balanceNFT = fromAccSubsidies.balanceNFT.minus(BigInt.fromI32(1));
          fromAccSubsidies.updatedAtBlock = blockNumber;
          fromAccSubsidies.updatedAtTimestamp = timestamp;
          fromAccSubsidies.save();

          log.info("Updated FROM account {} subsidies for collection participation {}, new NFT balance: {}", [
            fromAddress.toHexString(),
            collectionParticipation.id,
            fromAccSubsidies.balanceNFT.toString()
          ]);
        }

        // Update TO account subsidies (increase NFT balance)
        if (!isBurn) {
          const toAccSubsidies = getOrCreateAccountSubsidy(
            toAddress,
            collectionParticipation.id,
            blockNumber,
            timestamp
          );

          accrueSeconds(toAccSubsidies, collectionParticipation, timestamp);
          toAccSubsidies.balanceNFT = toAccSubsidies.balanceNFT.plus(BigInt.fromI32(1));
          toAccSubsidies.updatedAtBlock = blockNumber;
          toAccSubsidies.updatedAtTimestamp = timestamp;
          toAccSubsidies.save();

          log.info("Updated TO account {} subsidies for collection participation {}, new NFT balance: {}", [
            toAddress.toHexString(),
            collectionParticipation.id,
            toAccSubsidies.balanceNFT.toString()
          ]);
        }
      }
    } else {
      log.info("Collection {} has no vault participations, skipping AccountSubsidiesPerCollection updates", [
        collectionAddress.toHexString()
      ]);
    }
  }

  log.info("NFT {} processed successfully for collection {}", [
    isMint ? "mint" : isBurn ? "burn" : "transfer",
    collectionAddress.toHexString()
  ]);
}
