import { BigInt, log } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import { IERC721Metadata } from "../generated/ERC721Collection/IERC721Metadata";
import { ADDRESS_ZERO_STR, ZERO_BI } from "./utils/const";
import {
  getOrCreateCollection,
  getOrCreateAccount,
  getOrCreateAccountSubsidy,
} from "./utils/getters";
import { Collection, NFTHolding } from "../generated/schema";
import { accrueSeconds, updateAverageHoldingPeriod } from "./utils/subsidies";

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

    // Update NFTHolding for sender
    const fromHoldingId = fromAddress.toHexString() + "-" + collectionAddress.toHexString();
    let fromHolding = NFTHolding.load(fromHoldingId);
    if (fromHolding == null) {
      fromHolding = new NFTHolding(fromHoldingId);
      fromHolding.account = fromAccount.id;
      fromHolding.collection = collectionAddress.toHexString();
      fromHolding.balance = ZERO_BI;
    }
    fromHolding.balance = fromHolding.balance.minus(BigInt.fromI32(1));
    fromHolding.updatedAtBlock = blockNumber;
    fromHolding.updatedAtTimestamp = timestamp;
    fromHolding.save();

    log.info("Updated FROM account {} NFT balance to {} (collection holding: {})", [
      fromAddress.toHexString(),
      fromAccount.totalNFTsOwned.toString(),
      fromHolding.balance.toString()
    ]);
  }

  if (!isBurn) {
    const toAccount = getOrCreateAccount(toAddress);
    toAccount.totalNFTsOwned = toAccount.totalNFTsOwned.plus(BigInt.fromI32(1));
    toAccount.updatedAtBlock = blockNumber;
    toAccount.updatedAtTimestamp = timestamp;
    toAccount.save();

    // Update NFTHolding for receiver
    const toHoldingId = toAddress.toHexString() + "-" + collectionAddress.toHexString();
    let toHolding = NFTHolding.load(toHoldingId);
    if (toHolding == null) {
      toHolding = new NFTHolding(toHoldingId);
      toHolding.account = toAccount.id;
      toHolding.collection = collectionAddress.toHexString();
      toHolding.balance = ZERO_BI;
    }
    toHolding.balance = toHolding.balance.plus(BigInt.fromI32(1));
    toHolding.updatedAtBlock = blockNumber;
    toHolding.updatedAtTimestamp = timestamp;
    toHolding.save();

    log.info("Updated TO account {} NFT balance to {} (collection holding: {})", [
      toAddress.toHexString(),
      toAccount.totalNFTsOwned.toString(),
      toHolding.balance.toString()
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

        // Update FROM account subsidies (sync with actual NFT balance)
        if (!isMint) {
          const fromAccSubsidies = getOrCreateAccountSubsidy(
            fromAddress,
            collectionParticipation.id,
            blockNumber,
            timestamp
          );

          accrueSeconds(fromAccSubsidies, collectionParticipation, timestamp);
          
          // Sync with actual NFT holding balance instead of using deltas
          const fromHoldingId = fromAddress.toHexString() + "-" + collectionAddress.toHexString();
          const fromHolding = NFTHolding.load(fromHoldingId);
          const actualFromBalance = fromHolding ? fromHolding.balance : ZERO_BI;
          
          // CRITICAL: Update average holding period before changing balance
          const oldFromBalance = fromAccSubsidies.balanceNFT;
          updateAverageHoldingPeriod(fromAccSubsidies, timestamp, actualFromBalance, oldFromBalance);
          
          fromAccSubsidies.balanceNFT = actualFromBalance;
          fromAccSubsidies.updatedAtBlock = blockNumber;
          fromAccSubsidies.updatedAtTimestamp = timestamp;
          fromAccSubsidies.save();

          log.info("Updated FROM account {} subsidies for collection participation {}, synced NFT balance: {} (actual holding: {})", [
            fromAddress.toHexString(),
            collectionParticipation.id,
            fromAccSubsidies.balanceNFT.toString(),
            actualFromBalance.toString()
          ]);
        }

        // Update TO account subsidies (sync with actual NFT balance)
        if (!isBurn) {
          const toAccSubsidies = getOrCreateAccountSubsidy(
            toAddress,
            collectionParticipation.id,
            blockNumber,
            timestamp
          );

          accrueSeconds(toAccSubsidies, collectionParticipation, timestamp);
          
          // Sync with actual NFT holding balance instead of using deltas
          const toHoldingId = toAddress.toHexString() + "-" + collectionAddress.toHexString();
          const toHolding = NFTHolding.load(toHoldingId);
          const actualToBalance = toHolding ? toHolding.balance : ZERO_BI;
          
          // CRITICAL: Update average holding period before changing balance
          const oldToBalance = toAccSubsidies.balanceNFT;
          updateAverageHoldingPeriod(toAccSubsidies, timestamp, actualToBalance, oldToBalance);
          
          toAccSubsidies.balanceNFT = actualToBalance;
          toAccSubsidies.updatedAtBlock = blockNumber;
          toAccSubsidies.updatedAtTimestamp = timestamp;
          toAccSubsidies.save();

          log.info("Updated TO account {} subsidies for collection participation {}, synced NFT balance: {} (actual holding: {})", [
            toAddress.toHexString(),
            collectionParticipation.id,
            toAccSubsidies.balanceNFT.toString(),
            actualToBalance.toString()
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
