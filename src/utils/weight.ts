import { BigInt } from "@graphprotocol/graph-ts";
import { CollectionParticipation } from "../../generated/schema";

const EXP_SCALE = BigInt.fromString("1000000000000000000");

const MAX_NFT_COUNT_FOR_WEIGHT_CALC = BigInt.fromI32(1000000);

function approxExponentialTerm(val: BigInt): BigInt {
  const term1 = val;
  const term2 = val.times(val).div(EXP_SCALE).div(BigInt.fromI32(2));
  return term1.plus(term2);
}

export function weight(nftCount: BigInt, cv: CollectionParticipation): BigInt {
  const n_bi = nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC)
    ? MAX_NFT_COUNT_FOR_WEIGHT_CALC
    : nftCount;

  if (cv.weightFunctionType == "LINEAR") {
    return cv.weightFunctionP1.times(n_bi).plus(cv.weightFunctionP2);
  } else if (cv.weightFunctionType == "EXPONENTIAL") {
    const k_bi = cv.weightFunctionP2;
    const A_bi = cv.weightFunctionP1;
    const kn_scaled = k_bi.times(n_bi);
    return A_bi.times(approxExponentialTerm(kn_scaled)).div(EXP_SCALE);
  } else {
    return BigInt.fromI32(0);
  }
}
