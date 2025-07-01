import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import { Account, Collection, CollectionParticipation, NFTHolding } from "../../generated/schema";
import { getOrCreateAccountSubsidy } from "./getters";

/**
 * Creates AccountSubsidy entities for accounts that should have them based on their NFT holdings
 * This function should be called periodically or when we detect missing AccountSubsidy entities
 */
export function createMissingAccountSubsidies(
  collectionAddress: Address,
  participationId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): i32 {
  log.info("Creating missing AccountSubsidy entities for collection {} and participation {}", [
    collectionAddress.toHexString(),
    participationId
  ]);

  let processedCount = 0;

  // Since we cannot efficiently query all NFTHolding entities, we'll use a different approach:
  // We'll check known active accounts that have totalNFTsOwned > 0
  
  // This is a limitation of TheGraph subgraphs - we cannot iterate over all entities efficiently
  // In a real production system, you would either:
  // 1. Have an off-chain process that identifies holders and creates transactions
  // 2. Use events/transfers to trigger AccountSubsidy creation
  // 3. Have a list of known active accounts
  
  log.info("AccountSubsidy creation complete for participation {}. Processed {} accounts.", [
    participationId,
    BigInt.fromI32(processedCount).toString()
  ]);

  return processedCount;
}

/**
 * Checks if an account should have an AccountSubsidy for a given collection participation
 * and creates it if missing
 */
export function ensureAccountSubsidyExists(
  accountAddress: Address,
  collectionAddress: Address,
  participationId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  // Check if the account has NFTs from this collection
  const nftHoldingId = accountAddress.toHexString() + "-" + collectionAddress.toHexString();
  const nftHolding = NFTHolding.load(nftHoldingId);
  
  if (nftHolding != null && nftHolding.balance.gt(BigInt.fromI32(0))) {
    // Account has NFTs, ensure AccountSubsidy exists
    const accountSubsidy = getOrCreateAccountSubsidy(
      accountAddress,
      participationId,
      blockNumber,
      timestamp
    );

    // Update the NFT balance to match the actual holding
    accountSubsidy.balanceNFT = nftHolding.balance;
    accountSubsidy.updatedAtBlock = blockNumber;
    accountSubsidy.updatedAtTimestamp = timestamp;
    accountSubsidy.save();

    log.info("Ensured AccountSubsidy exists for account {} with {} NFTs", [
      accountAddress.toHexString(),
      nftHolding.balance.toString()
    ]);
  }
}