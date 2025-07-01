import {
  CollectionRegistered,
  YieldShareUpdated,
  WeightFunctionUpdated,
  VaultAddedToCollection,
  VaultRemovedFromCollection,
  CollectionRemoved,
  CollectionReactivated,
} from "../generated/CollectionRegistry/CollectionRegistry";
import {
  CollectionRegistry,
  Collection,
  Account,
  Role,
  AccountRoleAssignment,
} from "../generated/schema";
import { log, Address, BigInt } from "@graphprotocol/graph-ts";

import { getOrCreateAccount, getOrCreateSystemState } from "./utils/getters";
import { ZERO_BI, ONE_BI } from "./utils/const";

export function handleCollectionRegistered(event: CollectionRegistered): void {
  // Get or create CollectionRegistry entity
  let registry = CollectionRegistry.load(event.address.toHexString());
  if (registry == null) {
    registry = new CollectionRegistry(event.address.toHexString());
    registry.totalCollections = ZERO_BI;
    registry.totalActiveCollections = ZERO_BI;
    registry.owner = event.transaction.from;
    registry.createdAtBlock = event.block.number;
    registry.createdAtTimestamp = event.block.timestamp;
  }

  // Increment total collections
  registry.totalCollections = registry.totalCollections.plus(ONE_BI);
  registry.totalActiveCollections = registry.totalActiveCollections.plus(ONE_BI);
  registry.updatedAtBlock = event.block.number;
  registry.updatedAtTimestamp = event.block.timestamp;
  registry.save();

  // Create or update Collection entity
  const collectionAddress = event.params.collection;
  let collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(collectionAddress.toHexString());
    collection.contractAddress = collectionAddress;
    collection.name = ""; // Will be populated by ERC721/ERC1155 mappings
    collection.symbol = ""; // Will be populated by ERC721/ERC1155 mappings
    collection.totalSupply = ZERO_BI;
    collection.totalNFTsDeposited = ZERO_BI;
    collection.vaults = [];
    collection.minBorrowAmount = ZERO_BI;
    collection.maxBorrowAmount = ZERO_BI;
    collection.createdAtBlock = event.block.number;
    collection.createdAtTimestamp = event.block.timestamp;
  }

  // Set registry-managed fields
  collection.registry = registry.id;
  collection.isActive = true;
  collection.collectionType = event.params.collectionType == 0 ? "ERC721" : "ERC1155";
  collection.yieldSharePercentage = BigInt.fromI32(event.params.yieldSharePercentage);
  collection.weightFunctionType = event.params.weightFunctionType == 0 ? "LINEAR" : "EXPONENTIAL";
  collection.weightFunctionP1 = event.params.p1;
  collection.weightFunctionP2 = event.params.p2;
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  // Update system state
  const systemState = getOrCreateSystemState();
  systemState.totalCollections = systemState.totalCollections.plus(ONE_BI);
  systemState.lastUpdatedBlock = event.block.number;
  systemState.lastUpdatedTimestamp = event.block.timestamp;
  systemState.save();

  log.info("Collection registered: {} with type: {}, yield share: {}%", [
    collectionAddress.toHexString(),
    collection.collectionType,
    collection.yieldSharePercentage.toString()
  ]);
}

export function handleYieldShareUpdated(event: YieldShareUpdated): void {
  const collectionAddress = event.params.collection;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for YieldShareUpdated event: {}", [collectionAddress.toHexString()]);
    return;
  }

  const oldShare = collection.yieldSharePercentage;
  collection.yieldSharePercentage = BigInt.fromI32(event.params.newShare);
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  log.info("Yield share updated for collection: {} from {}% to {}%", [
    collectionAddress.toHexString(),
    oldShare.toString(),
    collection.yieldSharePercentage.toString()
  ]);
}

export function handleWeightFunctionUpdated(event: WeightFunctionUpdated): void {
  const collectionAddress = event.params.collection;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for WeightFunctionUpdated event: {}", [collectionAddress.toHexString()]);
    return;
  }

  collection.weightFunctionType = event.params.weightFunctionType == 0 ? "LINEAR" : "EXPONENTIAL";
  collection.weightFunctionP1 = event.params.p1;
  collection.weightFunctionP2 = event.params.p2;
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  log.info("Weight function updated for collection: {} to type: {}, p1: {}, p2: {}", [
    collectionAddress.toHexString(),
    collection.weightFunctionType,
    collection.weightFunctionP1.toString(),
    collection.weightFunctionP2.toString()
  ]);
}

export function handleVaultAddedToCollection(event: VaultAddedToCollection): void {
  const collectionAddress = event.params.collection;
  const vaultAddress = event.params.vault;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for VaultAddedToCollection event: {}", [collectionAddress.toHexString()]);
    return;
  }

  // Add vault to collection's vaults array if not already present
  const vaults = collection.vaults;
  if (vaults.indexOf(vaultAddress) == -1) {
    vaults.push(vaultAddress);
    collection.vaults = vaults;
  }
  
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  log.info("Vault added to collection: {} -> {}", [
    collectionAddress.toHexString(),
    vaultAddress.toHexString()
  ]);
}

export function handleVaultRemovedFromCollection(event: VaultRemovedFromCollection): void {
  const collectionAddress = event.params.collection;
  const vaultAddress = event.params.vault;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for VaultRemovedFromCollection event: {}", [collectionAddress.toHexString()]);
    return;
  }

  // Remove vault from collection's vaults array
  const vaults = collection.vaults;
  const index = vaults.indexOf(vaultAddress);
  if (index > -1) {
    vaults.splice(index, 1);
    collection.vaults = vaults;
  }
  
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  log.info("Vault removed from collection: {} -> {}", [
    collectionAddress.toHexString(),
    vaultAddress.toHexString()
  ]);
}

export function handleCollectionRemoved(event: CollectionRemoved): void {
  const collectionAddress = event.params.collection;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for CollectionRemoved event: {}", [collectionAddress.toHexString()]);
    return;
  }

  collection.isActive = false;
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  // Update registry total active collections
  const registry = CollectionRegistry.load(event.address.toHexString());
  if (registry != null) {
    registry.totalActiveCollections = registry.totalActiveCollections.minus(ONE_BI);
    registry.updatedAtBlock = event.block.number;
    registry.updatedAtTimestamp = event.block.timestamp;
    registry.save();
  }

  log.info("Collection removed: {}", [collectionAddress.toHexString()]);
}

export function handleCollectionReactivated(event: CollectionReactivated): void {
  const collectionAddress = event.params.collection;
  const collection = Collection.load(collectionAddress.toHexString());
  
  if (collection == null) {
    log.error("Collection not found for CollectionReactivated event: {}", [collectionAddress.toHexString()]);
    return;
  }

  collection.isActive = true;
  collection.updatedAtBlock = event.block.number;
  collection.updatedAtTimestamp = event.block.timestamp;
  collection.save();

  // Update registry total active collections
  const registry = CollectionRegistry.load(event.address.toHexString());
  if (registry != null) {
    registry.totalActiveCollections = registry.totalActiveCollections.plus(ONE_BI);
    registry.updatedAtBlock = event.block.number;
    registry.updatedAtTimestamp = event.block.timestamp;
    registry.save();
  }

  log.info("Collection reactivated: {}", [collectionAddress.toHexString()]);
}