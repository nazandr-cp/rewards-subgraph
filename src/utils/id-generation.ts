import { BigInt, Address, Bytes, crypto } from "@graphprotocol/graph-ts";

// Optimized ID generation utilities using hashing for better performance
class IdGenerator {
  
  // Generate collection vault ID using hash for better collision resistance
  static collectionVaultId(vaultAddress: Address, collectionAddress: Address): string {
    const input = vaultAddress.toHexString() + collectionAddress.toHexString();
    const hash = crypto.keccak256(Bytes.fromUTF8(input));
    return hash.toHexString();
  }

  // Generate account subsidies per collection ID
  static accountSubsidiesPerCollectionId(accountAddress: Address, collectionVaultId: string): string {
    const input = accountAddress.toHexString() + collectionVaultId;
    const hash = crypto.keccak256(Bytes.fromUTF8(input));
    return hash.toHexString();
  }

  // Generate account market ID (keep simple for frequent lookups)
  static accountMarketId(accountAddress: Address, marketAddress: Address): string {
    return accountAddress.toHexString() + "-" + marketAddress.toHexString();
  }

  // Generate epoch vault allocation ID
  static epochVaultAllocationId(epochId: string, vaultId: string): string {
    const input = epochId + vaultId;
    const hash = crypto.keccak256(Bytes.fromUTF8(input));
    return hash.toHexString();
  }


  // Generate merkle distribution ID
  static merkleDistributionId(epochId: string, vaultId: string, merkleRoot: Bytes): string {
    const input = epochId + vaultId + merkleRoot.toHexString();
    const hash = crypto.keccak256(Bytes.fromUTF8(input));
    return hash.toHexString();
  }

  // Generate event-based IDs for transactions
  static transactionEventId(txHash: Bytes, logIndex: BigInt): string {
    return txHash.toHexString() + "-" + logIndex.toString();
  }

  // Generate daily metrics ID
  static dailyMetricsId(timestamp: BigInt): string {
    // Convert timestamp to date string (YYYY-MM-DD)
    const secondsPerDay = BigInt.fromI32(86400);
    const daysSinceEpoch = timestamp.div(secondsPerDay);
    return daysSinceEpoch.toString();
  }
}

export { IdGenerator };