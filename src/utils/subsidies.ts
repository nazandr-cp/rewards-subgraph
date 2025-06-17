import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Account,
  Vault,
  CollectionVault,
  AccountSubsidiesPerCollection,
} from "../../generated/schema";
import { cToken } from "../../generated/templates/cToken/cToken";

import { ZERO_BI } from "./const";

export enum WeightFunctionType {
  LINEAR,
  EXPONENTIAL,
}

export const EXP_SCALE = BigInt.fromString("1000000000000000000");

export function exponentToBigInt(decimals: i32): BigInt {
  let bi = BigInt.fromI32(1);
  for (let i = 0; i < decimals; i++) {
    bi = bi.times(BigInt.fromI32(10));
  }
  return bi;
}

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

const MAX_NFT_COUNT_FOR_WEIGHT_CALC = BigInt.fromI32(1000000);

export function weight(nftCount: BigInt, cv: CollectionVault): BigInt {
  const n_bi = nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC)
    ? MAX_NFT_COUNT_FOR_WEIGHT_CALC
    : nftCount;

  if (cv.fnType == "LINEAR") {
    return cv.p1.times(n_bi).plus(cv.p2);
  } else if (cv.fnType == "EXPONENTIAL") {
    const k_bi = cv.p2;
    const A_bi = cv.p1;
    const kn_scaled = k_bi.times(n_bi);
    return A_bi.times(approxExponentialTerm(kn_scaled)).div(EXP_SCALE);
  } else {
    return ZERO_BI;
  }
}

export function accrueSeconds(
  apsc: AccountSubsidiesPerCollection,
  cv: CollectionVault,
  now: BigInt
): void {
  const dt = now.minus(BigInt.fromI64(apsc.updatedAtTimestamp));
  if (dt.isZero() || dt.lt(ZERO_BI)) {
    return;
  }

  let basePrincipalForSubsidy = ZERO_BI;
  const accountAddress = Address.fromString(apsc.account);
  const vaultEntity = Vault.load(cv.vault);

  if (vaultEntity == null) {
    log.error(
      "accrueSeconds: Vault entity with ID {} not found for CollectionVault {}. Cannot determine cToken address.",
      [cv.vault, cv.id]
    );
    return;
  }
  const cTokenMarketAddress = Address.fromString(vaultEntity.cTokenMarket);

  basePrincipalForSubsidy = currentBorrowU(accountAddress, cTokenMarketAddress);

  const nftHoldingWeight = weight(apsc.balanceNFT, cv);
  const combinedEffectiveValue = basePrincipalForSubsidy.plus(nftHoldingWeight);

  const subsidyAccruedScaled = combinedEffectiveValue.times(dt);

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

  apsc.seconds = apsc.seconds.plus(subsidyAccruedScaled.div(EXP_SCALE));
  apsc.updatedAtTimestamp = now.toI64();
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
  const cachedVaults = new Array<CollectionVault>();

  for (let i = 0; i < accountSubsidiesPerCollection.length; i++) {
    const accSubsidies = accountSubsidiesPerCollection[i];
    if (!accSubsidies) continue;

    let collectionVault: CollectionVault | null = null;

    // Check cache first
    const cacheIndex = loadedVaults.indexOf(accSubsidies.collectionVault);
    if (cacheIndex >= 0) {
      collectionVault = cachedVaults[cacheIndex];
    } else {
      // Load and cache
      collectionVault = CollectionVault.load(accSubsidies.collectionVault);
      if (collectionVault) {
        loadedVaults.push(accSubsidies.collectionVault);
        cachedVaults.push(collectionVault);
      }
    }

    if (collectionVault) {
      accrueSeconds(accSubsidies, collectionVault, timestamp);
      accSubsidies.updatedAtBlock = blockNumber;
      accSubsidies.updatedAtTimestamp = timestamp.toI64();
      accSubsidies.save();
    }
  }
}
