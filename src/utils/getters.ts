import { BigInt, Address, log, Bytes } from "@graphprotocol/graph-ts";
import { cToken as CTokenContract } from "../../generated/templates/cToken/cToken";
import {
  Account,
  Collection,
  CollectionsVault,
  CollectionParticipation,
  AccountSubsidy,
  CTokenMarket,
  AccountMarket,
  Epoch,
  SystemState,
  EpochVaultAllocation,
  MerkleDistribution,
  NFTHolding,
} from "../../generated/schema";

import { IdGenerator } from "./id-generation";
import { ZERO_BI, ADDRESS_ZERO_STR, SYSTEM_STATE_ID } from "./const";

// Use optimized ID generation
function generateCollectionVaultId(
  vaultAddress: Address,
  collectionAddress: Address
): string {
  return IdGenerator.collectionVaultId(vaultAddress, collectionAddress);
}

function generateAccountSubsidyId(
  accountAddress: Address,
  collectionVaultId: string
): string {
  return IdGenerator.accountSubsidiesPerCollectionId(accountAddress, collectionVaultId);
}

export function getOrCreateAccount(accountAddress: Address): Account {
  log.info("getOrCreateAccount: Input accountAddress: {}", [
    accountAddress.toHexString(),
  ]);
  let account = Account.load(accountAddress.toHexString());
  if (account == null) {
    account = new Account(accountAddress.toHexString());
    account.totalSecondsClaimed = ZERO_BI;
    account.totalSubsidiesReceived = ZERO_BI;
    account.totalYieldEarned = ZERO_BI;
    account.totalBorrowVolume = ZERO_BI;
    account.totalNFTsOwned = ZERO_BI;
    account.totalCollectionsParticipated = ZERO_BI;
    account.createdAtBlock = ZERO_BI;
    account.createdAtTimestamp = ZERO_BI;
    account.updatedAtBlock = ZERO_BI;
    account.updatedAtTimestamp = ZERO_BI;
    account.save();
    log.info("getOrCreateAccount: Created new account with ID: {}", [
      account.id,
    ]);
  } else {
    log.info("getOrCreateAccount: Loaded existing account with ID: {}", [
      account.id,
    ]);
  }
  return account;
}

export function getOrCreateCTokenMarket(address: Address): CTokenMarket {
  let cTokenMarket = CTokenMarket.load(address.toHexString());
  if (cTokenMarket == null) {
    // This function should only be called for validated cTokens
    // If validation failed earlier, this should not be reached
    cTokenMarket = new CTokenMarket(address.toHexString());
    cTokenMarket.symbol = "UNKNOWN";
    cTokenMarket.name = "UNKNOWN";
    cTokenMarket.decimals = 0;
    cTokenMarket.totalSupply = ZERO_BI;
    cTokenMarket.totalBorrows = ZERO_BI;
    cTokenMarket.totalReserves = ZERO_BI;
    cTokenMarket.exchangeRate = ZERO_BI;
    cTokenMarket.interestAccumulated = ZERO_BI;
    cTokenMarket.cashPrior = ZERO_BI;
    cTokenMarket.collateralFactor = ZERO_BI;
    cTokenMarket.borrowIndex = ZERO_BI;
    cTokenMarket.lastExchangeRateTimestamp = ZERO_BI;
    cTokenMarket.updatedAtBlock = ZERO_BI;
    cTokenMarket.updatedAtTimestamp = ZERO_BI;
    cTokenMarket.liquidationIncentive = ZERO_BI;
    cTokenMarket.reserveFactor = ZERO_BI;
    cTokenMarket.baseRatePerBlock = ZERO_BI;
    cTokenMarket.multiplierPerBlock = ZERO_BI;
    cTokenMarket.jumpMultiplierPerBlock = ZERO_BI;
    cTokenMarket.kink = ZERO_BI;

    const cTokenContract = CTokenContract.bind(address);
    const nameResult = cTokenContract.try_name();
    if (!nameResult.reverted) {
      cTokenMarket.name = nameResult.value;
    }

    const symbolResult = cTokenContract.try_symbol();
    if (!symbolResult.reverted) {
      cTokenMarket.symbol = symbolResult.value;
    }

    cTokenMarket.save();
  }
  return cTokenMarket;
}

export function getOrCreateCollection(collectionAddress: Address): Collection {
  let collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(collectionAddress.toHexString());
    collection.contractAddress = Address.fromHexString(collectionAddress.toHexString());
    collection.name = "Unknown Collection";
    collection.symbol = "UNKN";
    collection.totalSupply = ZERO_BI;
    collection.collectionType = "ERC721";
    // Registry integration
    collection.registry = Address.fromString("0x000000000000000000000000000000000000000A").toHexString(); // Set to a valid CollectionRegistry ID if available
    // Registry-managed configuration
    collection.isActive = false;
    collection.yieldSharePercentage = ZERO_BI;
    collection.weightFunctionType = "LINEAR";
    collection.weightFunctionP1 = ZERO_BI;
    collection.weightFunctionP2 = ZERO_BI;
    collection.minBorrowAmount = ZERO_BI;
    collection.maxBorrowAmount = ZERO_BI;
    // Core collection statistics (non-duplicate)
    collection.totalNFTsDeposited = ZERO_BI;
    // Vault associations (managed by CollectionRegistry)
    collection.vaults = [];
    // Metadata
    collection.createdAtBlock = ZERO_BI;
    collection.createdAtTimestamp = ZERO_BI;
    collection.updatedAtBlock = ZERO_BI;
    collection.updatedAtTimestamp = ZERO_BI;
    collection.save();
  }
  return collection;
}

export function getOrCreateVault(
  vaultAddress: Address,
  cTokenMarketAddress: Address
): CollectionsVault {
  let vault = CollectionsVault.load(vaultAddress.toHexString());
  if (vault == null) {
    vault = new CollectionsVault(vaultAddress.toHexString());
    const cTokenMarket = getOrCreateCTokenMarket(cTokenMarketAddress);
    vault.cTokenMarket = cTokenMarket.id;
    vault.totalShares = ZERO_BI;
    vault.totalDeposits = ZERO_BI;
    vault.totalCTokens = ZERO_BI;
    vault.globalDepositIndex = ZERO_BI;
    vault.totalPrincipalDeposited = ZERO_BI;
    // Registry and manager references (set to empty or placeholder, update as needed)
    vault.collectionRegistry = Address.fromString("0x0000000000000000000000000000000000000006").toHexString();
    vault.epochManager = Address.fromString("0x0000000000000000000000000000000000000007").toHexString();
    vault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString();
    vault.debtSubsidizer = Address.fromString("0x0000000000000000000000000000000000000009").toHexString();
    // Metadata
    vault.createdAtBlock = ZERO_BI;
    vault.createdAtTimestamp = ZERO_BI;
    vault.updatedAtBlock = ZERO_BI;
    vault.updatedAtTimestamp = ZERO_BI;
    vault.save();
  }
  return vault;
}

export function getOrCreateCollectionVault(
  vaultAddress: Address,
  collectionAddress: Address,
  cTokenMarketAddress: Address
): CollectionParticipation {
  const collection = getOrCreateCollection(collectionAddress);

  const id = generateCollectionVaultId(vaultAddress, collectionAddress);
  let cv = CollectionParticipation.load(id);

  if (cv == null) {
    const vault = getOrCreateVault(vaultAddress, cTokenMarketAddress);
    cv = new CollectionParticipation(id);
    cv.collection = collection.id;
    cv.vault = vault.id;
    cv.principalShares = ZERO_BI;
    cv.principalDeposited = ZERO_BI;
    cv.totalCTokens = ZERO_BI;
    cv.globalDepositIndex = ZERO_BI;
    cv.lastGlobalDepositIndex = ZERO_BI;
    cv.yieldAccrued = ZERO_BI;
    cv.yieldClaimed = ZERO_BI;
    cv.totalYieldGenerated = ZERO_BI;
    cv.isBorrowBased = true;
    cv.rewardSharePercentage = ZERO_BI;
    cv.secondsAccumulated = ZERO_BI;
    cv.secondsClaimed = ZERO_BI;
    cv.totalSubsidies = ZERO_BI;
    cv.totalSubsidiesClaimed = ZERO_BI;
    cv.totalParticipants = ZERO_BI;
    cv.createdAtBlock = ZERO_BI;
    cv.createdAtTimestamp = ZERO_BI;
    cv.updatedAtBlock = ZERO_BI;
    cv.updatedAtTimestamp = ZERO_BI;
    cv.save();
    
    // Log that this is the first time this collection participates in a vault
    // This indicates that existing NFT holders might need AccountSubsidy entities created
    log.info(
      "NEW COLLECTION PARTICIPATION: Collection {} now participates in vault {}. " +
      "Check for existing NFT holders who need AccountSubsidy entities retroactively created.",
      [collection.id, vault.id]
    );
  }
  return cv;
}

export function getOrCreateAccountSubsidy(
  accountAddress: Address,
  collectionVaultId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): AccountSubsidy {
  const account = getOrCreateAccount(accountAddress);
  const collectionVault = CollectionParticipation.load(collectionVaultId);

  if (collectionVault == null) {
    log.critical(
      "getOrCreateAccountSubsidiesPerCollection: CollectionVault {} not found. This should not happen.",
      [collectionVaultId]
    );
    // Return a dummy object to satisfy TypeScript, as log.critical is expected to halt execution.
    return new AccountSubsidy(collectionVaultId);
  }

  const vaultEntity = CollectionsVault.load(collectionVault.vault);
  if (vaultEntity == null) {
    log.critical(
      "getOrCreateAccountSubsidy: Vault with id {} not found when creating AccountSubsidy. This should not happen.",
      [collectionVault.vault]
    );
    // Return a dummy object to satisfy TypeScript, as log.critical is expected to halt execution.
    return new AccountSubsidy(collectionVaultId);
  }

  const cTokenMarketForVault = vaultEntity.cTokenMarket
    ? Address.fromString(vaultEntity.cTokenMarket)
    : Address.fromString(ADDRESS_ZERO_STR);

  const accountMarket = getOrCreateAccountMarket(
    accountAddress,
    cTokenMarketForVault
  );

  const id = generateAccountSubsidyId(
    accountAddress,
    collectionVault.id
  );
  let accountSubsidy = AccountSubsidy.load(id);

  if (accountSubsidy == null) {
    accountSubsidy = new AccountSubsidy(id);
    accountSubsidy.account = account.id;
    accountSubsidy.accountMarket = accountMarket.id;
    accountSubsidy.collectionParticipation = collectionVault.id;
    accountSubsidy.balanceNFT = ZERO_BI;
    accountSubsidy.secondsAccumulated = ZERO_BI;
    accountSubsidy.secondsClaimed = ZERO_BI;
    accountSubsidy.subsidiesAccrued = ZERO_BI;
    accountSubsidy.subsidiesClaimed = ZERO_BI;
    accountSubsidy.averageHoldingPeriod = ZERO_BI;
    accountSubsidy.totalRewardsEarned = ZERO_BI;
    accountSubsidy.lastEffectiveValue = ZERO_BI;
    accountSubsidy.updatedAtBlock = blockNumber;
    accountSubsidy.updatedAtTimestamp = timestamp;
    accountSubsidy.save();
  }
  return accountSubsidy;
}

export function getOrCreateAccountMarket(
  accountAddress: Address,
  marketAddress: Address
): AccountMarket {
  const account = getOrCreateAccount(accountAddress);
  const market = getOrCreateCTokenMarket(marketAddress);

  const id = account.id + "-" + market.id;
  let accountMarket = AccountMarket.load(id);

  if (accountMarket == null) {
    accountMarket = new AccountMarket(id);
    accountMarket.account = account.id;
    accountMarket.cTokenMarket = market.id;
    accountMarket.supplyBalance = ZERO_BI;
    accountMarket.borrowBalance = ZERO_BI;
    accountMarket.collateralBalance = ZERO_BI;
    accountMarket.supplyIndex = ZERO_BI;
    accountMarket.borrowIndex = ZERO_BI;
    accountMarket.createdAtBlock = ZERO_BI;
    accountMarket.createdAtTimestamp = ZERO_BI;
    accountMarket.updatedAtBlock = ZERO_BI;
    accountMarket.updatedAtTimestamp = ZERO_BI;
    accountMarket.save();
  }
  return accountMarket;
}

// Get or create SystemState singleton
export function getOrCreateSystemState(): SystemState {
  let systemState = SystemState.load(SYSTEM_STATE_ID);
  if (systemState == null) {
    systemState = new SystemState(SYSTEM_STATE_ID);
    systemState.totalVaults = ZERO_BI;
    systemState.totalUsers = ZERO_BI;
    systemState.totalCollections = ZERO_BI;
    systemState.totalValueLocked = ZERO_BI;
    systemState.systemUtilizationRate = ZERO_BI;
    systemState.lastUpdatedBlock = ZERO_BI;
    systemState.lastUpdatedTimestamp = ZERO_BI;
    systemState.save();
  }
  return systemState;
}

// Get or create EpochVaultAllocation by epoch and vault
export function getOrCreateEpochVaultAllocation(epochId: string, vaultId: string): EpochVaultAllocation {
  const id = epochId + "-" + vaultId;
  let allocation = EpochVaultAllocation.load(id);
  if (allocation == null) {
    allocation = new EpochVaultAllocation(id);
    allocation.epoch = epochId;
    allocation.vault = vaultId;
    allocation.yieldAllocated = ZERO_BI;
    allocation.subsidiesDistributed = ZERO_BI;
    allocation.remainingYield = ZERO_BI;
    allocation.participantCount = ZERO_BI;
    allocation.averageSubsidyPerUser = ZERO_BI;
    allocation.utilizationRate = ZERO_BI;
    allocation.createdAtBlock = ZERO_BI;
    allocation.createdAtTimestamp = ZERO_BI;
    allocation.updatedAtBlock = ZERO_BI;
    allocation.updatedAtTimestamp = ZERO_BI;
    allocation.save();
  }
  return allocation;
}

// Create MerkleDistribution (immutable entity, can only insert)
export function createMerkleDistribution(id: string, epochId: string, vaultId: string): MerkleDistribution {
  let distribution = MerkleDistribution.load(id);
  if (distribution != null) {
    log.warning("createMerkleDistribution: MerkleDistribution {} already exists. Skipping creation.", [id]);
    return distribution;
  }
  
  distribution = new MerkleDistribution(id);
  distribution.epoch = epochId;
  distribution.vault = vaultId;
  distribution.totalAmount = ZERO_BI;
  distribution.totalClaims = ZERO_BI;
  distribution.merkleRoot = Bytes.empty();
  distribution.blockNumber = ZERO_BI;
  distribution.timestamp = ZERO_BI;
  distribution.transactionHash = Bytes.empty();
  distribution.save();
  
  return distribution;
}

/**
 * Sync AccountSubsidy NFT balance with actual NFTHolding balance
 * This fixes historical inconsistencies where deltas were used instead of actual balances
 */
export function syncAccountSubsidyBalance(
  accountAddress: Address,
  collectionAddress: Address,
  participationId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): AccountSubsidy | null {
  const holdingId = accountAddress.toHexString() + "-" + collectionAddress.toHexString();
  const nftHolding = NFTHolding.load(holdingId);
  
  if (!nftHolding) {
    log.info("syncAccountSubsidyBalance: No NFTHolding found for account {} and collection {}", [
      accountAddress.toHexString(),
      collectionAddress.toHexString()
    ]);
    return null;
  }

  const accountSubsidy = getOrCreateAccountSubsidy(
    accountAddress,
    participationId,
    blockNumber,
    timestamp
  );

  const oldBalance = accountSubsidy.balanceNFT;
  accountSubsidy.balanceNFT = nftHolding.balance;
  accountSubsidy.updatedAtBlock = blockNumber;
  accountSubsidy.updatedAtTimestamp = timestamp;
  accountSubsidy.save();

  log.info("syncAccountSubsidyBalance: Synced balance for account {} from {} to {} for collection {}", [
    accountAddress.toHexString(),
    oldBalance.toString(),
    nftHolding.balance.toString(),
    collectionAddress.toHexString()
  ]);

  return accountSubsidy;
}

/**
 * Reconstruct historical balances for all existing AccountSubsidy entities
 * This should be called when the system detects balance inconsistencies
 */
export function reconstructHistoricalBalances(
  collectionAddress: Address,
  participationId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  log.info("reconstructHistoricalBalances: Starting balance reconstruction for collection {} and participation {}", [
    collectionAddress.toHexString(),
    participationId
  ]);

  let fixedCount = 0;
  let totalProcessed = 0;

  // Use the derived relationship to get all AccountSubsidy entities for this participation
  const participation = CollectionParticipation.load(participationId);
  if (!participation) {
    log.warning("reconstructHistoricalBalances: CollectionParticipation {} not found", [participationId]);
    return;
  }

  const accountSubsidies = participation.accountSubsidies.load();
  
  for (let i = 0; i < accountSubsidies.length; i++) {
    const existingSubsidy = accountSubsidies[i];
    if (!existingSubsidy) continue;

    totalProcessed++;
    
    // Check if balance needs fixing
    const holdingId = existingSubsidy.account + "-" + collectionAddress.toHexString();
    const nftHolding = NFTHolding.load(holdingId);
    
    if (nftHolding) {
      const actualBalance = nftHolding.balance;
      
      if (!existingSubsidy.balanceNFT.equals(actualBalance)) {
        log.info("reconstructHistoricalBalances: Found balance mismatch for account {}. AccountSubsidy: {}, NFTHolding: {}", [
          existingSubsidy.account,
          existingSubsidy.balanceNFT.toString(),
          actualBalance.toString()
        ]);

        // Fix the balance
        existingSubsidy.balanceNFT = actualBalance;
        existingSubsidy.updatedAtBlock = blockNumber;
        existingSubsidy.updatedAtTimestamp = timestamp;
        existingSubsidy.save();
        
        fixedCount++;
      }
    }
  }

  log.info("reconstructHistoricalBalances: Completed for collection {}. Processed {} entities, fixed {} balance mismatches", [
    collectionAddress.toHexString(),
    BigInt.fromI32(totalProcessed).toString(),
    BigInt.fromI32(fixedCount).toString()
  ]);
}

