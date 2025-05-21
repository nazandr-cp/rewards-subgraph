# Guide: Updating `rewards-subgraph`

This guide outlines the steps to modify the `rewards-subgraph` based on the tasks in `todo.md`, aligning with the new `RewardController` contract design.

## 1. Update Subgraph Schema (`schema.graphql`)

**Reference:** `todo.md` - Section 2.1 Schema (Lines 131-152)

Add the new `Vault` and `AccountVault` entity types to your `rewards-subgraph/schema.graphql` file. These entities will store the state related to the new lazy rewards mechanism.

```graphql
# ... existing enum definitions ...

type Vault @entity {
  id: ID! # vault address
  rewardPerBlock: BigInt!
  globalRPW: BigInt!
  totalWeight: BigInt!
  lastUpdateBlock: BigInt!
  weightByBorrow: Boolean! # From VaultInfo
  useExp: Boolean!         # From VaultInfo
  linK: BigInt             # From VaultInfo (optional, hence not BigInt!)
  expR: BigInt             # From VaultInfo (optional, hence not BigInt!)
  # Removed cToken and nft address fields as they are part of VaultInfo
  # but might not be directly queryable or essential for every Vault query.
  # If needed, they can be added.
  accountVaults: [AccountVault!]! @derivedFrom(field: "vault")
}

type AccountVault @entity {
  id: ID!                   # <vault>-<user>
  vault: Vault!             # Link to the Vault entity
  account: Bytes!           # User address
  weight: BigInt!
  rewardDebt: BigInt!
  accrued: BigInt!          # This will be 0 after a claim as per todo.md
  # helper:
  claimable: BigInt!        # Calculated client-side or via live call as per todo.md
}

# ... rest of your existing schema (Account, CollectionReward, etc.)
# Ensure Account entity has a field for AccountVault if needed for reverse lookups:
# type Account @entity {
#   id: Bytes! @id
#   # ... other fields
#   vaults: [AccountVault!]! @derivedFrom(field: "account")
# }
```
**Note on `Vault` entity fields:**
*   The `cToken` and `nft` addresses from `VaultInfo` are not included in the `Vault` entity above to keep it concise. If direct querying for these is required from the `Vault` entity, they can be added. They are primarily configuration for the contract.
*   The `id` for `Vault` will be the vault's address.
*   The `id` for `AccountVault` will be a composite ID like `vaultAddress.toHex() + "-" + userAddress.toHex()`.

**Note on `AccountVault.claimable`:**
*   As per `todo.md` (line 163), `claimable` is calculated using a live call. The subgraph will store the state *after* a claim. The `claimable` field in the schema is kept as per `todo.md`, but its population strategy in handlers needs to consider this. It might be more of a client-side calculation aid.

## 2. Update Subgraph Manifest (`subgraph.yaml`)

**Reference:** `todo.md` - Section 2.2 Handlers (Lines 157-161) and Contract Events (Section 1.4, 1.5)

Modify the `rewards-subgraph/subgraph.yaml` file to include handlers for the new events `RewardClaimed` and `RewardPerBlockUpdated` emitted by the `RewardsController` contract.

Ensure your `RewardsController` ABI (e.g., `./abis/IRewardsController.json`) is updated to include these new events and any new public functions if you intend to make contract calls from mappings.

```yaml
# ... specVersion, schema, etc. ...

dataSources:
  # ... other dataSources (cToken, CollectionVault) ...

  - kind: ethereum
    name: RewardsController # Or your chosen name for the new controller
    network: # your_network (e.g., apechain-curtis)
    source:
      address: "0xYOUR_NEW_REWARDS_CONTROLLER_ADDRESS" # Update with deployed address
      abi: RewardsController # Assumes an ABI named RewardsController in abis folder
      startBlock: 0 # Update with the deployment block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9 # Or your current apiVersion
      language: wasm/assemblyscript
      entities:
        - Vault # Add new entity
        - AccountVault # Add new entity
        # - RewardClaimed (if you create a specific entity for the event log itself)
        # - RewardPerBlockUpdated (if you create a specific entity for the event log itself)
        # ... other entities handled by this datasource ...
      abis:
        - name: RewardsController
          file: ./abis/IRewardsController.json # Ensure this ABI is updated
        # ... other ABIs ...
      eventHandlers:
        # ... existing event handlers for RewardsController ...
        - event: RewardPerBlockUpdated(indexed address,uint128) # Match event signature
          handler: handleRewardPerBlockUpdated # New handler
        - event: RewardClaimed(address,indexed address,uint256) # Match event signature
          handler: handleRewardClaimed # New handler
      file: ./src/rewards-controller-mapping.ts # Or your mapping file
```
*Self-correction: The event signatures in the YAML must exactly match the Solidity event definition.
`RewardPerBlockUpdated(address indexed vault, uint128 rewardPerBlock)`
`RewardClaimed(address vault, address indexed user, uint256 amount)`*
```yaml
# ... specVersion, schema, etc. ...

dataSources:
  # ... other dataSources (cToken, CollectionVault) ...

  - kind: ethereum
    name: RewardsController # Or your chosen name for the new controller
    network: # your_network (e.g., apechain-curtis)
    source:
      address: "0xYOUR_NEW_REWARDS_CONTROLLER_ADDRESS" # Update with deployed address
      abi: RewardsController # Assumes an ABI named RewardsController in abis folder
      startBlock: 0 # Update with the deployment block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9 # Or your current apiVersion
      language: wasm/assemblyscript
      entities:
        - Vault # Add new entity
        - AccountVault # Add new entity
      abis:
        - name: RewardsController
          file: ./abis/IRewardsController.json # Ensure this ABI is updated
      eventHandlers:
        # ... existing event handlers for RewardsController ...
        - event: RewardPerBlockUpdated(address,uint128) # vault (indexed), rewardPerBlock
          handler: handleRewardPerBlockUpdated # New handler for Vault entity
        - event: RewardClaimed(address,address,uint256) # vault, user (indexed), amount
          handler: handleRewardClaimed # New handler for AccountVault entity
      file: ./src/rewards-controller-mapping.ts # Or your mapping file
```

## 3. Implement New Event Handlers in Mappings (`rewards-controller-mapping.ts`)

**Reference:** `todo.md` - Section 2.2 Handlers (Lines 159-164)

In your `rewards-subgraph/src/rewards-controller-mapping.ts` (or the relevant mapping file specified in `subgraph.yaml`), implement the new handler functions.

```typescript
import { BigInt, Bytes, Address, store, log } from "@graphprotocol/graph-ts";
import {
    Vault, // New import
    AccountVault, // New import
    // ... other existing imports like Account, CollectionReward etc.
} from "../generated/schema";
import {
    RewardPerBlockUpdated as RewardPerBlockUpdatedEvent, // New event import
    RewardClaimed as RewardClaimedEvent, // New event import
    RewardsController // Contract binding for calls if needed
} from "../generated/RewardsController/RewardsController"; // Adjust path if RewardsController is a template

// You might need a utility for ZERO_BI if not already present
const ZERO_BI = BigInt.fromI32(0);

// Event handler for RewardPerBlockUpdated
export function handleRewardPerBlockUpdated(event: RewardPerBlockUpdatedEvent): void {
    let vaultId = event.params.vault.toHex();
    let vault = Vault.load(vaultId);

    if (!vault) {
        vault = new Vault(vaultId);
        // Initialize other fields from contract call if this is the first time
        // For example, using the RewardsController contract binding:
        // let contract = RewardsController.bind(event.address);
        // let vaultInfo = contract.vaults(event.params.vault);
        // vault.globalRPW = vaultInfo.globalRPW;
        // vault.totalWeight = vaultInfo.totalWeight;
        // vault.weightByBorrow = vaultInfo.weightByBorrow;
        // vault.useExp = vaultInfo.useExp;
        // vault.linK = vaultInfo.linK;
        // vault.expR = vaultInfo.expR;
        // vault.lastUpdateBlock = vaultInfo.lastUpdateBlock; // This will be updated by accumulate
        log.info("New Vault entity created: {}", [vaultId]);
    }

    vault.rewardPerBlock = event.params.rewardPerBlock;
    // The `lastUpdateBlock` and `globalRPW` are updated by `_accumulate` in the contract.
    // This event only signals a change in `rewardPerBlock`.
    // If `refreshRewardPerBlock` also calls `_accumulate` before emitting,
    // then `lastUpdateBlock` would be `event.block.number`.
    // And `globalRPW` might have changed.
    // For now, only updating what's directly in the event or clearly implied by todo.md for this handler.
    // todo.md line 159: "vault.rewardPerBlock = …"
    // todo.md line 49: `v.lastUpdateBlock = uint32(block.number);` is in `_accumulate`
    // todo.md line 116-117: `refreshRewardPerBlock` calculates delta based on `block.number - v.lastUpdateBlock`
    // then sets `v.rewardPerBlock`. It does *not* explicitly call `_accumulate` in the snippet.
    // However, `claim` *does* call `_accumulate`.
    // Let's assume `lastUpdateBlock` should be updated if `rewardPerBlock` is changing.
    // This might require a contract call to get the latest `VaultInfo` if the event isn't sufficient.
    // For simplicity, if `refreshRewardPerBlock` is expected to update `lastUpdateBlock` implicitly,
    // we might need to fetch it.
    // The `todo.md` for the handler just says `vault.rewardPerBlock = ...`
    // Let's stick to that for the guide, but note that `lastUpdateBlock` and `globalRPW` might need updates
    // from contract calls if they change during `refreshRewardPerBlock`.

    // To get the most current state, a contract call might be best:
    let contract = RewardsController.bind(event.address); // event.address is the RewardsController address
    let vaultInfoFromCall = contract.vaults(event.params.vault);
    vault.rewardPerBlock = vaultInfoFromCall.rewardPerBlock; // This is from event, but call confirms
    vault.globalRPW = vaultInfoFromCall.globalRPW;
    vault.totalWeight = vaultInfoFromCall.totalWeight;
    vault.lastUpdateBlock = BigInt.fromI32(vaultInfoFromCall.lastUpdateBlock);
    vault.weightByBorrow = vaultInfoFromCall.weightByBorrow;
    vault.useExp = vaultInfoFromCall.useExp;
    vault.linK = BigInt.fromI32(vaultInfoFromCall.linK.toI32()); // Assuming conversion if types differ
    vault.expR = BigInt.fromI32(vaultInfoFromCall.expR.toI32()); // Assuming conversion

    vault.save();
    log.info("Vault {} rewardPerBlock updated to {}", [vaultId, event.params.rewardPerBlock.toString()]);
}

// Event handler for RewardClaimed
export function handleRewardClaimed(event: RewardClaimedEvent): void {
    let vaultAddress = event.params.vault;
    let userAddress = event.params.user;
    let amountClaimed = event.params.amount;

    let vaultId = vaultAddress.toHex();
    let accountId = userAddress.toHex(); // userAddress is Bytes in schema for Account.id
    let accountVaultId = vaultId + "-" + accountId;

    let vault = Vault.load(vaultId);
    if (!vault) {
        // This should ideally not happen if vaults are created/updated by RewardPerBlockUpdated or an addVault event.
        // If it can, initialize the Vault entity here via a contract call.
        log.warning("Vault {} not found during RewardClaimed for user {}. Creating Vault.", [vaultId, accountId]);
        vault = new Vault(vaultId);
        let contract = RewardsController.bind(event.address);
        let vaultInfoFromCall = contract.vaults(vaultAddress);
        vault.rewardPerBlock = vaultInfoFromCall.rewardPerBlock;
        vault.globalRPW = vaultInfoFromCall.globalRPW;
        vault.totalWeight = vaultInfoFromCall.totalWeight;
        vault.lastUpdateBlock = BigInt.fromI32(vaultInfoFromCall.lastUpdateBlock);
        vault.weightByBorrow = vaultInfoFromCall.weightByBorrow;
        vault.useExp = vaultInfoFromCall.useExp;
        vault.linK = BigInt.fromI32(vaultInfoFromCall.linK.toI32());
        vault.expR = BigInt.fromI32(vaultInfoFromCall.expR.toI32());
        vault.save();
    } else {
        // Ensure Vault's globalRPW and lastUpdateBlock are up-to-date as claim calls _accumulate
        let contract = RewardsController.bind(event.address);
        let vaultInfoFromCall = contract.vaults(vaultAddress);
        vault.globalRPW = vaultInfoFromCall.globalRPW;
        vault.lastUpdateBlock = BigInt.fromI32(vaultInfoFromCall.lastUpdateBlock);
        vault.totalWeight = vaultInfoFromCall.totalWeight; // totalWeight also changes in claim
        vault.save();
    }

    let accountVault = AccountVault.load(accountVaultId);
    if (!accountVault) {
        accountVault = new AccountVault(accountVaultId);
        accountVault.vault = vaultId;
        accountVault.account = userAddress; // This is Bytes
    }

    // Update AccountVault based on contract state *after* claim
    // todo.md (line 160): "переносим pendings → accrued=0"
    // This means the `amountClaimed` was the pending rewards.
    accountVault.accrued = ZERO_BI;

    // To get the new weight and rewardDebt, a contract call is needed as
    // these are updated within the claim function (todo.md lines 98-99).
    let contract = RewardsController.bind(event.address); // event.address is the RewardsController address
    let accountInfoFromCall = contract.acc(vaultAddress, userAddress);

    accountVault.weight = accountInfoFromCall.weight;
    accountVault.rewardDebt = accountInfoFromCall.rewardDebt;
    // accountVault.accrued was already set to 0 from the call `contract.acc` if it reflects post-claim.
    // If `contract.acc` shows state *before* accrued is set to 0 in that specific transaction,
    // then `accountVault.accrued = ZERO_BI;` is correct.
    // Given todo.md line 100 (`a.accrued = 0;`), the contract call should reflect this.

    // For `claimable`: todo.md (line 163) states it's calculated via live-call by the client.
    // The subgraph stores state. If `claimable` must be stored, its value here would be 0
    // immediately after a claim of all pending rewards.
    // Or, it could be calculated based on the new state:
    // pending = new_weight * (vault.globalRPW - new_rewardDebt) / 1e18.
    // Since new_rewardDebt is likely vault.globalRPW, pending would be 0.
    accountVault.claimable = ZERO_BI; // After claiming, claimable is 0 until more blocks pass.

    accountVault.save();

    log.info("AccountVault {} updated after claim. Amount: {}. New weight: {}, New rewardDebt: {}", [
        accountVaultId,
        amountClaimed.toString(),
        accountVault.weight.toString(),
        accountVault.rewardDebt.toString()
    ]);

    // Optional: Create a RewardClaimed entity if you want to log each claim event distinctly
    // let claimEntity = new RewardClaimed(event.transaction.hash.toHex() + "-" + event.logIndex.toString());
    // claimEntity.vault = vaultId;
    // claimEntity.user = userAddress;
    // claimEntity.amount = amountClaimed;
    // claimEntity.timestamp = event.block.timestamp;
    // claimEntity.save();
}

// ... any other handlers ...
```

**Important Considerations for Mappings:**
*   **Data Freshness:** The `todo.md` emphasizes a "lazy" approach. For the subgraph to accurately reflect state, especially for `Vault.globalRPW`, `Vault.lastUpdateBlock`, `AccountVault.weight`, and `AccountVault.rewardDebt`, it's often best to fetch the state directly from the contract using contract calls (`RewardsController.bind(event.address).vaults(...)` or `.acc(...)`) within the handlers *after* the event-triggering transaction has modified the state. The event parameters themselves might not contain the complete updated state.
*   **Initialization of `Vault`:** The `handleRewardPerBlockUpdated` handler might be the first time a `Vault` is seen. It should initialize all non-event fields of the `Vault` entity using a contract call.
*   **`AccountVault.claimable`:** The `todo.md` states this is a helper field calculated by the front-end using live calls. If you store it in the subgraph, it would represent the claimable amount based on the *current* subgraph state. Immediately after a `handleRewardClaimed`, this would be `0`. It would become non-zero as blocks pass and `Vault.globalRPW` increases. Recalculating it on every block via a block handler for all `AccountVault` entities would be very inefficient. It's generally better to follow the `todo.md` suggestion and have clients calculate it.
*   **Error Handling & Edge Cases:** Add null checks for loaded entities (e.g., `Vault.load()`) and handle cases where entities might not exist as expected.

This completes the guide for updating the `rewards-subgraph`. Remember to run `graph codegen` and `graph build` after making these changes.