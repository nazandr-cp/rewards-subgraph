import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Account,
  CollectionsVault,
  CollectionParticipation,
  Collection,
  AccountSubsidy,
  NFTHolding,
} from "../../generated/schema";
import { cToken } from "../../generated/templates/cToken/cToken";
import { getOrCreateAccountSubsidy } from "./getters";

import { ZERO_BI } from "./const";

export const EXP_SCALE = BigInt.fromString("1000000000000000000");

function approxExponentialTerm(val: BigInt): BigInt {
  const term1 = val;
  const term2 = val.times(val).div(EXP_SCALE).div(BigInt.fromI32(2));
  return term1.plus(term2);
}

export function currentDepositU(user: Address, cTokenAddr: Address): BigInt {
  const cTokenInstance = cToken.bind(cTokenAddr);
  const balRes = cTokenInstance.try_balanceOf(user);
  if (balRes.reverted) {
    log.warning(
      "currentDepositU: try_balanceOf reverted for user {} and cToken {}",
      [user.toHexString(), cTokenAddr.toHexString()]
    );
    return ZERO_BI;
  }
  const cBal = balRes.value;

  const rateRes = cTokenInstance.try_exchangeRateStored();
  if (rateRes.reverted) {
    log.warning(
      "currentDepositU: try_exchangeRateStored reverted for cToken {}",
      [cTokenAddr.toHexString()]
    );
    return ZERO_BI;
  }
  const rate = rateRes.value;
  return cBal.times(rate).div(EXP_SCALE);
}

export function currentBorrowU(user: Address, cTokenAddr: Address): BigInt {
  const cTokenInstance = cToken.bind(cTokenAddr);
  const borrowRes = cTokenInstance.try_borrowBalanceStored(user);
  if (borrowRes.reverted) {
    log.warning(
      "currentBorrowU: try_borrowBalanceStored reverted for user {} and cToken {}",
      [user.toHexString(), cTokenAddr.toHexString()]
    );
    return ZERO_BI;
  }
  return borrowRes.value;
}

export const MAX_NFT_COUNT_FOR_WEIGHT_CALC = BigInt.fromI32(1000000);

export function linearWeight(nftCount: BigInt, p1: BigInt, p2: BigInt): BigInt {
  if (nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC)) {
    // Log warning when NFT count exceeds maximum in Graph environment
    if (typeof log !== 'undefined') {
      log.warning(
        "linearWeight: NFT count {} exceeds maximum {}. Using capped value.",
        [nftCount.toString(), MAX_NFT_COUNT_FOR_WEIGHT_CALC.toString()]
      );
    }
    nftCount = MAX_NFT_COUNT_FOR_WEIGHT_CALC;
  }

  return p1.times(nftCount).plus(p2);
}

export function exponentialWeight(nftCount: BigInt, A: BigInt, k: BigInt): BigInt {
  if (nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC)) {
    // Log warning when NFT count exceeds maximum in Graph environment
    if (typeof log !== 'undefined') {
      log.warning(
        "exponentialWeight: NFT count {} exceeds maximum {}. Using capped value.",
        [nftCount.toString(), MAX_NFT_COUNT_FOR_WEIGHT_CALC.toString()]
      );
    }
    nftCount = MAX_NFT_COUNT_FOR_WEIGHT_CALC;
  }

  const kn_scaled = k.times(nftCount);
  return A.times(approxExponentialTerm(kn_scaled)).div(EXP_SCALE);
}

export function weight(nftCount: BigInt, collection: Collection): BigInt {
  if (collection.weightFunctionType == "LINEAR") {
    return linearWeight(nftCount, collection.weightFunctionP1, collection.weightFunctionP2);
  } else if (collection.weightFunctionType == "EXPONENTIAL") {
    return exponentialWeight(nftCount, collection.weightFunctionP1, collection.weightFunctionP2);
  } else {
    return ZERO_BI;
  }
}

export function accrueSeconds(
  accountSubsidy: AccountSubsidy,
  cv: CollectionParticipation,
  now: BigInt
): void {
  const dt = now.minus(accountSubsidy.updatedAtTimestamp);

  log.info("accrueSeconds: Account {}, dt = {}, now = {}, updatedAtTimestamp = {}", [
    accountSubsidy.account,
    dt.toString(),
    now.toString(),
    accountSubsidy.updatedAtTimestamp.toString()
  ]);

  if (dt.isZero() || dt.lt(ZERO_BI)) {
    log.info("accrueSeconds: Skipping due to zero or negative dt for account {}", [accountSubsidy.account]);
    return;
  }

  let basePrincipalForSubsidy = ZERO_BI;
  const accountAddress = Address.fromString(accountSubsidy.account);
  const vaultEntity = CollectionsVault.load(cv.vault);

  if (vaultEntity == null) {
    log.error(
      "accrueSeconds: CollectionsVault entity with ID {} not found for CollectionParticipation {}. Cannot determine cToken address.",
      [cv.vault, cv.id]
    );
    return;
  }
  const cTokenMarketAddress = Address.fromString(vaultEntity.cTokenMarket);

  basePrincipalForSubsidy = currentBorrowU(accountAddress, cTokenMarketAddress);

  const collection = Collection.load(cv.collection);
  if (!collection) {
    log.error(
      "accrueSeconds: Collection entity with ID {} not found for CollectionParticipation {}. Cannot calculate weight.",
      [cv.collection, cv.id]
    );
    return;
  }

  const nftHoldingWeight = weight(accountSubsidy.balanceNFT, collection);
  const effectiveValue = basePrincipalForSubsidy.plus(nftHoldingWeight);

  log.info("accrueSeconds: Account {}, basePrincipalForSubsidy = {}, nftHoldingWeight = {}, effectiveValue = {}, balanceNFT = {}", [
    accountSubsidy.account,
    basePrincipalForSubsidy.toString(),
    nftHoldingWeight.toString(),
    effectiveValue.toString(),
    accountSubsidy.balanceNFT.toString()
  ]);

  accountSubsidy.lastEffectiveValue = effectiveValue;

  const subsidyAccruedScaled = effectiveValue.times(dt);
  const finalAccrual = subsidyAccruedScaled.div(EXP_SCALE);

  log.info("accrueSeconds: Account {}, subsidyAccruedScaled = {}, finalAccrual = {}, EXP_SCALE = {}", [
    accountSubsidy.account,
    subsidyAccruedScaled.toString(),
    finalAccrual.toString(),
    EXP_SCALE.toString()
  ]);

  if (subsidyAccruedScaled.lt(ZERO_BI)) {
    log.critical(
      "Negative subsidyAccruedScaled for account {}, collectionVault {}. Values: subsidyAccruedScaled = {}, basePrincipalForSubsidy = {}, nftHoldingWeight = {}, dt = {}. Reverting.",
      [
        accountSubsidy.account,
        cv.id,
        subsidyAccruedScaled.toString(),
        basePrincipalForSubsidy.toString(),
        nftHoldingWeight.toString(),
        dt.toString(),
      ]
    );
    return;
  }

  accountSubsidy.secondsAccumulated = accountSubsidy.secondsAccumulated.plus(finalAccrual);
  
  // Update average holding period when accruing seconds
  updateAverageHoldingPeriod(accountSubsidy, now, accountSubsidy.balanceNFT, accountSubsidy.balanceNFT);
  
  accountSubsidy.updatedAtTimestamp = now;

  log.info("accrueSeconds: Account {}, new secondsAccumulated = {}", [
    accountSubsidy.account,
    accountSubsidy.secondsAccumulated.toString()
  ]);
}

export function accrueAccountSubsidies(
  accountAddress: Address,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  const account = Account.load(accountAddress.toHexString());
  if (!account) {
    return;
  }

  const accountSubsidies = account.accountSubsidies.load();
  if (
    !accountSubsidies ||
    accountSubsidies.length == 0
  ) {
    return;
  }

  // Cache to avoid repeated CollectionVault loads within same transaction
  const loadedVaults = new Array<string>();
  const cachedVaults = new Array<CollectionParticipation>();

  for (let i = 0; i < accountSubsidies.length; i++) {
    const accountSubsidy = accountSubsidies[i];
    if (!accountSubsidy) continue;

    let collectionVault: CollectionParticipation | null = null;

    // Check cache first
    const cacheIndex = loadedVaults.indexOf(accountSubsidy.collectionParticipation);
    if (cacheIndex >= 0) {
      collectionVault = cachedVaults[cacheIndex];
    } else {
      // Load and cache
      collectionVault = CollectionParticipation.load(accountSubsidy.collectionParticipation);
      if (collectionVault) {
        loadedVaults.push(accountSubsidy.collectionParticipation);
        cachedVaults.push(collectionVault);
      }
    }

    if (collectionVault) {
      accrueSeconds(accountSubsidy, collectionVault, timestamp);
      accountSubsidy.updatedAtBlock = blockNumber;
      accountSubsidy.updatedAtTimestamp = timestamp;
      accountSubsidy.save();
    }
  }
}

/**
 * Recalculate subsidies for all NFT holders of a specific collection
 * This is triggered when collection yield rates change (deposits/withdrawals)
 */
export function accrueSubsidiesForAllCollectionHolders(
  collectionAddress: Address,
  participationId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  log.info("accrueSubsidiesForAllCollectionHolders: Starting comprehensive subsidy recalculation for collection {}, participation {}", [
    collectionAddress.toHexString(),
    participationId
  ]);

  // Load the collection participation to ensure it exists
  const collectionParticipation = CollectionParticipation.load(participationId);
  if (!collectionParticipation) {
    log.warning("accrueSubsidiesForAllCollectionHolders: CollectionParticipation {} not found. Cannot proceed.", [
      participationId
    ]);
    return;
  }

  let updatedCount = 0;

  // Use the derived relationship to get all AccountSubsidy entities for this participation
  const accountSubsidies = collectionParticipation.accountSubsidies.load();
  
  log.info("accrueSubsidiesForAllCollectionHolders: Found {} AccountSubsidy entities for participation {}", [
    BigInt.fromI32(accountSubsidies.length).toString(),
    participationId
  ]);

  for (let i = 0; i < accountSubsidies.length; i++) {
    const accountSubsidy = accountSubsidies[i];
    if (!accountSubsidy) continue;

    const accountAddress = Address.fromString(accountSubsidy.account);
    const holdingId = accountSubsidy.account + "-" + collectionAddress.toHexString();
    
    // Check if this account actually holds NFTs for this collection
    const nftHolding = NFTHolding.load(holdingId);
    if (nftHolding && nftHolding.balance.gt(ZERO_BI)) {
      // Update average holding period before changing balance
      const oldBalance = accountSubsidy.balanceNFT;
      updateAverageHoldingPeriod(accountSubsidy, timestamp, nftHolding.balance, oldBalance);
      
      // Sync NFT balance with actual holding
      accountSubsidy.balanceNFT = nftHolding.balance;

      // Accrue subsidies with updated yield rates
      accrueSeconds(accountSubsidy, collectionParticipation, timestamp);
      accountSubsidy.updatedAtBlock = blockNumber;
      accountSubsidy.updatedAtTimestamp = timestamp;
      accountSubsidy.save();

      updatedCount++;

      log.info("Updated subsidies for holder {} with {} NFTs for collection {}", [
        accountAddress.toHexString(),
        nftHolding.balance.toString(),
        collectionAddress.toHexString()
      ]);
    }
  }

  log.info("accrueSubsidiesForAllCollectionHolders: Completed for collection {}. Updated {} subsidies", [
    collectionAddress.toHexString(),
    BigInt.fromI32(updatedCount).toString()
  ]);
}


/**
 * Calculate subsidy rate for an epoch based on total yield available and total accumulated seconds
 * Rate = total yield / total accumulated seconds (with scaling)
 */
export function calculateSubsidyRate(
  totalYieldAvailable: BigInt,
  totalAccumulatedSeconds: BigInt
): BigInt {
  if (totalAccumulatedSeconds.equals(ZERO_BI)) {
    log.warning("calculateSubsidyRate: Total accumulated seconds is zero, returning zero rate", []);
    return ZERO_BI;
  }

  if (totalYieldAvailable.equals(ZERO_BI)) {
    log.warning("calculateSubsidyRate: Total yield available is zero, returning zero rate", []);
    return ZERO_BI;
  }

  // Rate = totalYield * EXP_SCALE / totalSeconds
  // This gives us subsidies per second with 18 decimal precision
  const rate = totalYieldAvailable.times(EXP_SCALE).div(totalAccumulatedSeconds);
  
  log.info("calculateSubsidyRate: totalYield={}, totalSeconds={}, rate={}", [
    totalYieldAvailable.toString(),
    totalAccumulatedSeconds.toString(),
    rate.toString()
  ]);

  return rate;
}

/**
 * Calculate subsidy amount for an account based on accumulated seconds and subsidy rate
 */
export function calculateSubsidyAmount(
  accumulatedSeconds: BigInt,
  subsidyRate: BigInt
): BigInt {
  if (accumulatedSeconds.equals(ZERO_BI) || subsidyRate.equals(ZERO_BI)) {
    return ZERO_BI;
  }

  // subsidyAmount = accumulatedSeconds * rate / EXP_SCALE
  const subsidyAmount = accumulatedSeconds.times(subsidyRate).div(EXP_SCALE);
  
  log.info("calculateSubsidyAmount: seconds={}, rate={}, amount={}", [
    accumulatedSeconds.toString(),
    subsidyRate.toString(),
    subsidyAmount.toString()
  ]);

  return subsidyAmount;
}

/**
 * Update subsidiesAccrued for all participants in a collection participation
 * This should be called during epoch processing to convert accumulated seconds to claimable subsidies
 */
export function updateSubsidiesAccruedForParticipation(
  participationId: string,
  subsidyRate: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  log.info("updateSubsidiesAccruedForParticipation: Starting subsidy accrual updates for participation {}, rate={}", [
    participationId,
    subsidyRate.toString()
  ]);

  const participation = CollectionParticipation.load(participationId);
  if (!participation) {
    log.error("updateSubsidiesAccruedForParticipation: Participation {} not found", [participationId]);
    return;
  }

  let updatedCount = 0;
  let totalSubsidiesCalculated = ZERO_BI;

  // Use the derived relationship to get all AccountSubsidy entities for this participation
  const accountSubsidies = participation.accountSubsidies.load();
  
  log.info("updateSubsidiesAccruedForParticipation: Found {} AccountSubsidy entities for participation {}", [
    BigInt.fromI32(accountSubsidies.length).toString(),
    participationId
  ]);
  
  for (let i = 0; i < accountSubsidies.length; i++) {
    const accountSubsidy = accountSubsidies[i];
    
    if (accountSubsidy && accountSubsidy.secondsAccumulated.gt(ZERO_BI)) {
      // Calculate new subsidies accrued based on accumulated seconds
      const newSubsidyAmount = calculateSubsidyAmount(
        accountSubsidy.secondsAccumulated,
        subsidyRate
      );
      
      if (newSubsidyAmount.gt(ZERO_BI)) {
        // Update average holding period during subsidy calculation
        updateAverageHoldingPeriod(accountSubsidy, timestamp, accountSubsidy.balanceNFT, accountSubsidy.balanceNFT);
        
        // Update subsidiesAccrued (this is the key missing piece!)
        accountSubsidy.subsidiesAccrued = accountSubsidy.subsidiesAccrued.plus(newSubsidyAmount);
        accountSubsidy.updatedAtBlock = blockNumber;
        accountSubsidy.updatedAtTimestamp = timestamp;
        accountSubsidy.save();
        
        updatedCount++;
        totalSubsidiesCalculated = totalSubsidiesCalculated.plus(newSubsidyAmount);
        
        log.info("Updated subsidiesAccrued for account {}: seconds={}, subsidy={}, total={}", [
          accountSubsidy.account,
          accountSubsidy.secondsAccumulated.toString(),
          newSubsidyAmount.toString(),
          accountSubsidy.subsidiesAccrued.toString()
        ]);
      }
    } else if (accountSubsidy) {
      log.info("Skipping account {} - no accumulated seconds ({})", [
        accountSubsidy.account,
        accountSubsidy.secondsAccumulated.toString()
      ]);
    }
  }

  log.info("updateSubsidiesAccruedForParticipation: Completed for participation {}. Updated {} accounts, total subsidies calculated: {}", [
    participationId,
    BigInt.fromI32(updatedCount).toString(),
    totalSubsidiesCalculated.toString()
  ]);
}

/**
 * Generate AccountSubsidy ID using the same logic as in getters.ts
 */
function generateAccountSubsidyId(
  accountAddress: Address,
  collectionVaultId: string
): string {
  return accountAddress.toHexString() + "-" + collectionVaultId;
}

/**
 * Calculate and update average holding period for an account
 * averageHoldingPeriod = total time holding NFTs / number of periods held
 */
export function updateAverageHoldingPeriod(
  accountSubsidy: AccountSubsidy,
  currentTimestamp: BigInt,
  newBalance: BigInt,
  oldBalance: BigInt
): void {
  // Only calculate if the account has had NFTs for some time
  if (accountSubsidy.updatedAtTimestamp.equals(ZERO_BI)) {
    // First time setting up, just initialize
    accountSubsidy.averageHoldingPeriod = ZERO_BI;
    log.info("updateAverageHoldingPeriod: Initializing for account {}", [
      accountSubsidy.account
    ]);
    return;
  }

  const timeDelta = currentTimestamp.minus(accountSubsidy.updatedAtTimestamp);
  
  // If account was holding NFTs, add to the holding period
  if (oldBalance.gt(ZERO_BI)) {
    // Weight the period by the balance held
    const weightedPeriod = timeDelta.times(oldBalance);
    
    // Update cumulative holding period (stored in averageHoldingPeriod for now)
    accountSubsidy.averageHoldingPeriod = accountSubsidy.averageHoldingPeriod.plus(weightedPeriod);
    
    log.info("updateAverageHoldingPeriod: Account {} held {} NFTs for {} seconds, cumulative weighted period: {}", [
      accountSubsidy.account,
      oldBalance.toString(),
      timeDelta.toString(),
      accountSubsidy.averageHoldingPeriod.toString()
    ]);
  }
  
  // Log current status
  log.info("updateAverageHoldingPeriod: Account {} balance change: {} -> {}, total weighted holding time: {}", [
    accountSubsidy.account,
    oldBalance.toString(),
    newBalance.toString(),
    accountSubsidy.averageHoldingPeriod.toString()
  ]);
}

/**
 * Calculate the actual average holding period based on cumulative data
 * This converts the cumulative weighted time into an average
 */
export function calculateActualAverageHoldingPeriod(
  cumulativeWeightedTime: BigInt,
  totalHoldingEvents: BigInt,
  currentBalance: BigInt
): BigInt {
  if (totalHoldingEvents.equals(ZERO_BI)) {
    return ZERO_BI;
  }

  // For now, use a simple approach: cumulative time / total events
  // In a more sophisticated system, we'd track the exact periods and balances
  const averagePeriod = cumulativeWeightedTime.div(totalHoldingEvents);
  
  log.info("calculateActualAverageHoldingPeriod: cumulative={}, events={}, average={}", [
    cumulativeWeightedTime.toString(),
    totalHoldingEvents.toString(),
    averagePeriod.toString()
  ]);
  
  return averagePeriod;
}
