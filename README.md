# 🧮 Reward Calculation Guide

This guide explains how to fetch, compute, and verify claimable rewards from the [rewards-subgraph](https://github.com/nazandr-cp/rewards-subgraph).  
It covers both **collection-based** and **vault-style** rewards.

---

## 📡 1. GraphQL Queries

Use the following queries to fetch the necessary data. Replace `$user` with the lowercase `0x...` Ethereum address of the user.

### 1.1 Collection Rewards for a User

```graphql
query MyCollections($user: Bytes!) {
  account(id: $user) {
    id
    collectionRewards {
      id
      balanceNFT
      seconds
      lastUpdate
      collection {
        id
        collection
        rewardToken
        rewardPerSecond
        totalRewardsPool
        totalSecondsAccrued
        expiresAt
        fnType
        p1
        p2
        cTokenMarketAddress
        rewardBasis
      }
    }
  }
}
```

### 1.2 Historical Reward Claims (Optional)

```graphql
query Claims($user: Bytes!) {
  rewardClaims(
    first: 50
    where: { account: $user }
    orderBy: timestamp
    orderDirection: desc
  ) {
    collectionAddress
    amount
    timestamp
    transactionHash
  }
}
```

### 1.3 Vault Rewards

```graphql
query Vaults($user: Bytes!) {
  accountVaults(where: { account: $user }) {
    vault {
      id
      rewardPerBlock
      globalRPW
      totalWeight
      lastUpdateBlock
    }
    weight
    rewardDebt
    accrued
    claimable
  }
}
```

---

## 🧮 2. Collection-Based Reward Formula

Here’s how to compute `pendingReward` per collection.

### TypeScript Implementation

```ts
const WAD = 10n ** 18n;

function weight(nftCount: bigint, coll: CollectionReward): bigint {
  const n = nftCount > 1_000_000n ? 1_000_000n : nftCount;
  if (coll.fnType === "LINEAR") {
    return coll.p1 * n + coll.p2;
  }
  if (coll.fnType === "EXPONENTIAL") {
    const kn = coll.p2 * n;
    const term = kn + (kn * kn) / WAD / 2n;
    return (coll.p1 * term) / WAD;
  }
  return 0n;
}

function pendingReward(
  acr: AccountCollectionReward,
  coll: CollectionReward,
  now: bigint,
  userDepositU: bigint,
  userBorrowU: bigint
) {
  let seconds = acr.seconds;

  const dt = now - acr.lastUpdate;
  const principalU =
    coll.rewardBasis === "DEPOSIT" ? userDepositU : userBorrowU;
  const effValueU = principalU + weight(acr.balanceNFT, coll);
  const secondsNow = (effValueU * dt) / WAD;
  seconds += secondsNow;

  const amount1 = (seconds * coll.rewardPerSecond) / WAD;
  const amount2 =
    (seconds * coll.totalRewardsPool) / (coll.totalSecondsAccrued + seconds);

  return { seconds, amount1, amount2 };
}
```

### Which to Use?

| Case                                           | Use       |
| ---------------------------------------------- | --------- |
| `rewardPerSecond ≠ 0`                          | `amount1` |
| `rewardPerSecond == 0 && totalRewardsPool > 0` | `amount2` |

---

## 🏦 3. Vault-Style Reward Formula

If you're using the vault model (with `AccountVault` and `Vault` entities):

```ts
function pendingVaultReward(acc: AccountVault, v: Vault, blocksNow: bigint) {
  const blocks = blocksNow - v.lastUpdateBlock;
  const newGlobalRPW =
    v.globalRPW + (v.rewardPerBlock * blocks) / v.totalWeight;
  const pending =
    (acc.weight * (newGlobalRPW - acc.rewardDebt)) / WAD + acc.accrued;
  return pending;
}
```

Note: `claimable` is already stored in the subgraph and kept up-to-date.

---

## 🔁 4. End-to-End Reward Calculation Flow

```txt
1. Fetch data using query 1.1.
2. For each collection:
   a. Fetch user's deposit/borrow from on-chain cToken (if needed).
   b. Call `pendingReward(...)` to compute reward.
3. Sum rewards across all collections.
4. Fetch vaults using query 1.3 and sum `claimable` fields.
5. Add both totals together and show to user.
```

---

## 🧪 5. Sanity Tests

| Scenario                                            | Expected Result  |
| --------------------------------------------------- | ---------------- |
| User has no NFTs and no deposit/borrow              | Reward = `0`     |
| Collection is expired (`now > expiresAt`)           | Reward stops     |
| Collection has exponential weight and n > 1,000,000 | Weight is capped |

---

## ✅ Claiming Rewards

When ready, send a transaction to the contract’s `batchClaim()` method.  
The contract will recompute the rewards using the same logic and transfer tokens accordingly.

---

## 📎 Related Files

- [`rewards.ts`](./src/utils/rewards.ts) – off-chain calculation helpers
- [`schema.graphql`](./schema.graphql) – all entity definitions
- [`todo.md`](./todo.md) – implementation roadmap

---

Happy building! 🦍
