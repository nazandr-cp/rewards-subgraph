import { BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { AccountCollectionReward, CollectionReward } from "../../generated/schema"; // Removed Account

// Constants
const ONE_BIG_DECIMAL = BigDecimal.fromString("1");
const ZERO_BIG_DECIMAL = BigDecimal.fromString("0");
const ZERO_BIG_INT = BigInt.fromI32(0);

/**
 * Calculates e^x using a Taylor series expansion.
 * e^x = 1 + x + x^2/2! + x^3/3! + ...
 * @param x The exponent.
 * @returns BigDecimal approximation of e^x.
 */
function exp(x: BigDecimal): BigDecimal {
    if (x.equals(ZERO_BIG_DECIMAL)) {
        return ONE_BIG_DECIMAL;
    }

    let sum = ONE_BIG_DECIMAL;
    let term = ONE_BIG_DECIMAL;
    // Iterate a fixed number of times for precision.
    // More terms will increase accuracy but also computation time.
    // For x > 1, convergence might be slower or require more terms.
    // For negative x, e^-x = 1/e^x. This implementation might be less accurate for large negative x.
    for (let i = 1; i < 20; i++) { // Using 20 terms for better precision
        term = term.times(x).div(BigDecimal.fromString(i.toString()));
        sum = sum.plus(term);
    }
    return sum;
}

/**
 * Calculates base^exp for non-negative integer exponents.
 * @param base The base.
 * @param exp The non-negative integer exponent.
 * @returns BigDecimal result of base^exp.
 */
function pow(base: BigDecimal, exp: i32): BigDecimal {
    if (exp < 0) {
        // This implementation does not support negative exponents.
        // Consider returning an error or ONE_BIG_DECIMAL/pow(base, -exp) if needed.
        // For now, returning ONE_BIG_DECIMAL for simplicity as per current requirements.
        // Or throw an error: throw new Error("pow() does not support negative exponents.");
        return ONE_BIG_DECIMAL; // Or handle as an error
    }
    if (exp == 0) {
        return ONE_BIG_DECIMAL;
    }
    if (base.equals(ZERO_BIG_DECIMAL)) {
        return ZERO_BIG_DECIMAL; // 0^exp = 0 for exp > 0
    }

    let res = ONE_BIG_DECIMAL;
    for (let i = 0; i < exp; i++) {
        res = res.times(base);
    }
    return res;
}

/**
 * Calculates the weight based on the number of items and reward metadata.
 * @param n The number of items (i32).
 * @param meta The CollectionReward entity containing function type and parameters.
 * @returns BigDecimal The calculated weight.
 */
export function weight(n: i32, meta: CollectionReward): BigDecimal {
    let p1_val: BigDecimal;
    if (meta.p1 == null) { // Check for null or undefined
        p1_val = ZERO_BIG_DECIMAL;
    } else if (meta.p1 instanceof BigInt) { // Check if it's a BigInt
        p1_val = meta.p1.toBigDecimal();
    } else { // Otherwise, assume it's already BigDecimal
        p1_val = meta.p1;
    }

    let p2_val: BigDecimal;
    if (meta.p2 == null) { // Check for null or undefined
        p2_val = ZERO_BIG_DECIMAL;
    } else if (meta.p2 instanceof BigInt) { // Check if it's a BigInt
        p2_val = meta.p2.toBigDecimal();
    } else { // Otherwise, assume it's already BigDecimal
        p2_val = meta.p2;
    }

    let n_bd = BigDecimal.fromString(n.toString());

    if (meta.fnType == 0) { // Linear: p1*n + p2
        return p1_val.times(n_bd).plus(p2_val);
    } else if (meta.fnType == 1) { // Exp-Power: p1 * (e^(p2*n) - 1)
        let exponent = p2_val.times(n_bd);
        return p1_val.times(exp(exponent).minus(ONE_BIG_DECIMAL));
    } else { // Exp-Base: p1 * (p2^n)
        // fnType == 2 or any other value defaults to this
        return p1_val.times(pow(p2_val, n));
    }
}

// TODO: Replace with actual logic to fetch current deposit in underlying token U for the account in this collection
function currentDepositU(accountId: Bytes, collectionAddress: Bytes): BigDecimal {
    // Placeholder: needs actual implementation based on your schema
    // log.warning("currentDepositU for account {} in collection {} is a STUB", [accountId.toHex(), collectionAddress.toHex()]);
    return ZERO_BIG_DECIMAL;
}

// TODO: Replace with actual logic to fetch current borrow in underlying token U for the account in this collection
function currentBorrowU(accountId: Bytes, collectionAddress: Bytes): BigDecimal {
    // Placeholder: needs actual implementation based on your schema
    // log.warning("currentBorrowU for account {} in collection {} is a STUB", [accountId.toHex(), collectionAddress.toHex()]);
    return ZERO_BIG_DECIMAL;
}

export function accrueSeconds(ac: AccountCollectionReward, coll: CollectionReward, now: BigInt): void {
    let dt = now.minus(ac.lastUpdate);
    if (dt.equals(ZERO_BIG_INT)) return;

    // ac.account is the ID of the Account entity, expected to be Bytes.
    // coll.id is Bytes.
    // If Account entity itself is needed for real implementation, it should be loaded:
    // let accountEntity = Account.load(ac.account); // Assuming Account entity exists and ac.account is its ID
    // if (accountEntity == null) {
    //   log.critical("Account not found: {} for ACR: {}", [ac.account, ac.id.toHex()]); // ac.account would be string here if Account.id is string
    //   return;
    // }

    // Current errors suggest ac.account is string, and functions expect Bytes.
    // coll.id is Bytes.
    let accountIdAsBytes = Bytes.fromHexString(ac.account.toHexString()); // Ensure argument is string
    let eff = currentDepositU(accountIdAsBytes, coll.id)
        .minus(currentBorrowU(accountIdAsBytes, coll.id))
        .plus(weight(ac.balanceNFT.toI32(), coll));

    let secDelta = eff.times(dt.toBigDecimal());
    ac.seconds = ac.seconds.plus(secDelta);
    coll.totalSecondsAccrued = coll.totalSecondsAccrued.plus(secDelta);

    ac.lastUpdate = now;
    // Caller saves ac and coll
}