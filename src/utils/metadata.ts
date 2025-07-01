import { BigInt } from "@graphprotocol/graph-ts";

// Metadata helper functions for consistent timestamp/block tracking
export class MetadataHelper {
  
  // Initialize creation metadata for new entities
  static setCreationMetadata(
    entity: any, 
    blockNumber: BigInt, 
    timestamp: BigInt
  ): void {
    entity.createdAtBlock = blockNumber;
    entity.createdAtTimestamp = timestamp;
    entity.updatedAtBlock = blockNumber;
    entity.updatedAtTimestamp = timestamp;
  }

  // Update modification metadata for existing entities
  static setUpdateMetadata(
    entity: any, 
    blockNumber: BigInt, 
    timestamp: BigInt
  ): void {
    entity.updatedAtBlock = blockNumber;
    entity.updatedAtTimestamp = timestamp;
  }

  // Set registration metadata (for entities with registeredAt fields)
  static setRegistrationMetadata(
    entity: any, 
    blockNumber: BigInt, 
    timestamp: BigInt
  ): void {
    entity.createdAtBlock = blockNumber;
    entity.createdAtTimestamp = timestamp;
    entity.updatedAtBlock = blockNumber;
    entity.updatedAtTimestamp = timestamp;
  }

  // Set interaction metadata (for accounts with first interaction)
  static setFirstInteractionMetadata(
    entity: any, 
    blockNumber: BigInt, 
    timestamp: BigInt
  ): void {
    entity.createdAtBlock = blockNumber;
    entity.createdAtTimestamp = timestamp;
    entity.updatedAtBlock = blockNumber;
    entity.updatedAtTimestamp = timestamp;
  }
}

export { MetadataHelper };