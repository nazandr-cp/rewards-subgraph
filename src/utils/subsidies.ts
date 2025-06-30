import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Account,
  CollectionsVault,
  CollectionParticipation,
  AccountSubsidiesPerCollection,
} from "../../generated/schema";
import { cToken } from "../../generated/templates/cToken/cToken";

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

export function weight(nftCount: BigInt, cv: CollectionParticipation): BigInt {
  if (cv.weightFunctionType == "LINEAR") {
    return linearWeight(nftCount, cv.weightFunctionP1, cv.weightFunctionP2);
  } else if (cv.weightFunctionType == "EXPONENTIAL") {
    return exponentialWeight(nftCount, cv.weightFunctionP1, cv.weightFunctionP2);
  } else {
    return ZERO_BI;
  }
}

export function accrueSeconds(
  apsc: AccountSubsidiesPerCollection,
  cv: CollectionParticipation,
  now: BigInt
): void {
  const dt = now.minus(apsc.updatedAtTimestamp);

  log.info("accrueSeconds: Account {}, dt = {}, now = {}, updatedAtTimestamp = {}", [
    apsc.account,
    dt.toString(),
    now.toString(),
    apsc.updatedAtTimestamp.toString()
  ]);

  if (dt.isZero() || dt.lt(ZERO_BI)) {
    log.info("accrueSeconds: Skipping due to zero or negative dt for account {}", [apsc.account]);
    return;
  }

  let basePrincipalForSubsidy = ZERO_BI;
  const accountAddress = Address.fromString(apsc.account);
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

  const nftHoldingWeight = weight(apsc.balanceNFT, cv);
  const effectiveValue = basePrincipalForSubsidy.plus(nftHoldingWeight);

  log.info("accrueSeconds: Account {}, basePrincipalForSubsidy = {}, nftHoldingWeight = {}, effectiveValue = {}, balanceNFT = {}", [
    apsc.account,
    basePrincipalForSubsidy.toString(),
    nftHoldingWeight.toString(),
    effectiveValue.toString(),
    apsc.balanceNFT.toString()
  ]);

  apsc.lastEffectiveValue = effectiveValue;

  const subsidyAccruedScaled = effectiveValue.times(dt);
  const finalAccrual = subsidyAccruedScaled.div(EXP_SCALE);

  log.info("accrueSeconds: Account {}, subsidyAccruedScaled = {}, finalAccrual = {}, EXP_SCALE = {}", [
    apsc.account,
    subsidyAccruedScaled.toString(),
    finalAccrual.toString(),
    EXP_SCALE.toString()
  ]);

  if (subsidyAccruedScaled.lt(ZERO_BI)) {
    log.critical(
      "Negative subsidyAccruedScaled for account {}, collectionVault {}. Values: subsidyAccruedScaled = {}, basePrincipalForSubsidy = {}, nftHoldingWeight = {}, dt = {}. Reverting.",
      [
        apsc.account,
        cv.id,
        subsidyAccruedScaled.toString(),
        basePrincipalForSubsidy.toString(),
        nftHoldingWeight.toString(),
        dt.toString(),
      ]
    );
    return;
  }

  apsc.secondsAccumulated = apsc.secondsAccumulated.plus(finalAccrual);
  apsc.updatedAtTimestamp = now;

  log.info("accrueSeconds: Account {}, new secondsAccumulated = {}", [
    apsc.account,
    apsc.secondsAccumulated.toString()
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

  const accountSubsidiesPerCollection = account.accountSubsidies.load();
  if (
    !accountSubsidiesPerCollection ||
    accountSubsidiesPerCollection.length == 0
  ) {
    return;
  }

  // Cache to avoid repeated CollectionVault loads within same transaction
  const loadedVaults = new Array<string>();
  const cachedVaults = new Array<CollectionParticipation>();

  for (let i = 0; i < accountSubsidiesPerCollection.length; i++) {
    const accSubsidies = accountSubsidiesPerCollection[i];
    if (!accSubsidies) continue;

    let collectionVault: CollectionParticipation | null = null;

    // Check cache first
    const cacheIndex = loadedVaults.indexOf(accSubsidies.collectionParticipation);
    if (cacheIndex >= 0) {
      collectionVault = cachedVaults[cacheIndex];
    } else {
      // Load and cache
      collectionVault = CollectionParticipation.load(accSubsidies.collectionParticipation);
      if (collectionVault) {
        loadedVaults.push(accSubsidies.collectionParticipation);
        cachedVaults.push(collectionVault);
      }
    }

    if (collectionVault) {
      accrueSeconds(accSubsidies, collectionVault, timestamp);
      accSubsidies.updatedAtBlock = blockNumber;
      accSubsidies.updatedAtTimestamp = timestamp;
      accSubsidies.save();
    }
  }
}
