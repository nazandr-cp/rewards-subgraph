import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Vault,
  CollectionVault,
  AccountRewardsPerCollection,
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
  arpc: AccountRewardsPerCollection,
  cv: CollectionVault,
  now: BigInt
): void {
  const dt = now.minus(BigInt.fromI64(arpc.updatedAtTimestamp));
  if (dt.isZero() || dt.lt(ZERO_BI)) {
    return;
  }

  let basePrincipalForReward = ZERO_BI;
  const accountAddress = Address.fromString(arpc.account);
  const vaultEntity = Vault.load(cv.vault);

  if (vaultEntity == null) {
    log.error(
      "accrueSeconds: Vault entity with ID {} not found for CollectionVault {}. Cannot determine cToken address.",
      [cv.vault, cv.id]
    );
    return;
  }
  const cTokenMarketAddress = Address.fromString(vaultEntity.cTokenMarket);

  if (!cv.isBorrowBased) {
    basePrincipalForReward = currentDepositU(
      accountAddress,
      cTokenMarketAddress
    );
  } else {
    basePrincipalForReward = currentBorrowU(
      accountAddress,
      cTokenMarketAddress
    );
  }

  const nftHoldingWeight = weight(arpc.balanceNFT, cv);
  const combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);

  const rewardAccruedScaled = combinedEffectiveValue.times(dt);

  if (rewardAccruedScaled.lt(ZERO_BI)) {
    log.critical(
      "Negative rewardAccruedScaled for account {}, collectionVault {}. Values: rewardAccruedScaled = {}, basePrincipalForReward = {}, nftHoldingWeight = {}, dt = {}. Reverting.",
      [
        arpc.account,
        cv.id,
        rewardAccruedScaled.toString(),
        basePrincipalForReward.toString(),
        nftHoldingWeight.toString(),
        dt.toString(),
      ]
    );
    return;
  }

  arpc.seconds = arpc.seconds.plus(rewardAccruedScaled.div(EXP_SCALE));
  arpc.updatedAtTimestamp = now.toI64();
}
