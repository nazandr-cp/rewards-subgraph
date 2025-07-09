# Claim Fix Verification

## Problem
The subgraph's `handleSubsidyClaimed` function was not properly recalculating `secondsAccumulated` after a claim, leading to incorrect accumulation tracking where users retained their full `secondsAccumulated` even after claiming.

## Solution Implemented
Modified `/Users/andrey/projects/lend.fam MVP/rewards-subgraph/src/debt-subsidizer-mapping.ts` in the `handleSubsidyClaimed` function:

### Before (lines 221-222):
```typescript
const newTotal = subsidy.secondsClaimed.plus(event.params.amount);
subsidy.secondsClaimed = newTotal;
```

### After (lines 221-227):
```typescript
const newTotal = subsidy.secondsClaimed.plus(event.params.amount);
subsidy.secondsClaimed = newTotal;
subsidy.subsidiesClaimed = subsidy.subsidiesClaimed.plus(event.params.amount);

// Reset secondsAccumulated to zero after claim since the accumulated seconds
// have been converted to subsidies. Future accruals will start from zero.
subsidy.secondsAccumulated = ZERO_BI;
```

## Behavior Changes
1. **Before**: `secondsAccumulated` remained unchanged after claims, leading to double-counting
2. **After**: `secondsAccumulated` is reset to zero after each claim, ensuring proper tracking

## Smart Contract Alignment
This change aligns with the smart contract's behavior where:
- `_userTotalSecondsClaimed[recipient] += amountToSubsidize` tracks cumulative claims
- Claims convert accumulated seconds to subsidies, so the accumulated seconds should be reset

## Impact
- Prevents double-counting of accumulated seconds
- Ensures future accruals start from zero after each claim
- Maintains correct relationship between `secondsAccumulated` and `secondsClaimed`
- Fixes the data inconsistency shown in the original GraphQL query

## Testing
A comprehensive test was prepared to verify the fix but could not be run due to schema migration issues in the test framework. The logic has been verified by:
1. Code review of the claim handler
2. Analysis of the smart contract behavior
3. Confirmation that the fix addresses the specific issue described

## Files Modified
- `/Users/andrey/projects/lend.fam MVP/rewards-subgraph/src/debt-subsidizer-mapping.ts`