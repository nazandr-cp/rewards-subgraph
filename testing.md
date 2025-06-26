Below is a focused, soup-to-nuts unit-testing plan you can adopt for a Graph (AssemblyScript) subgraph.  I’ve stripped out everything that belongs to integration or replay; this is pure unit scope—fast, deterministic, and runnable offline.

⸻

1  Define the “unit”

Category	What counts as a unit?	Typical file
Event handler	The exported handle…() function that receives a single event	src/mappings/CollectionsVault.ts
Pure helper	Any function that consumes plain data and returns a value	src/utils/math.ts
Entity factory	A small constructor that wraps new Entity(id) and sets defaults	src/entities/Vault.ts

Never cross handler boundaries in a unit test. If handleDeposit calls calculateYield, stub the call instead of following it.

⸻

2  Select tools & folder layout

/tests
  /handlers
    collectionsVault.test.ts
    lendingManager.test.ts
  /helpers
    math.test.ts
/__snapshots__
  collectionsVault.block-12841857.json

Tool	Use‐case	Install hint
Matchstick-AS	Compile + run handler WASM, assert on store	yarn add -D @graphprotocol/matchstick-as
ts-jest	Supplementary tests for TypeScript helpers	yarn add -D jest ts-jest @types/jest
as-bignum	Arbitrary-precision maths in tests	optional


⸻

3  Scaffold every handler

// tests/handlers/collectionsVault.test.ts
import { beforeEach, test, assert } from "matchstick-as";
import {
  newDepositEvent,
  handleCollectionDeposit
} from "../utils/collectionsHelpers";

beforeEach(() => {
  clearStore();               // 1. fresh DB
});

test("happy path deposit", () => {
  const ev = newDepositEvent(user, vault, amount, block, tx);
  handleCollectionDeposit(ev); // 2. call the unit
  assert.fieldEquals("Deposit", id, "amount", amount.toString()); // 3. assert
});

Helper generator

In tests/utils/* put tiny factories that build mock events:

export function newDepositEvent(...) : CollectionDeposit {
  let ev = changetype<CollectionDeposit>(newMockEvent());
  ev.parameters = ...
  return ev;
}


⸻

4  Write a 3-way test for every code branch
	1.	Happy-path – valid params, state is updated.
	2.	Edge-case – zero amount, same from/to, timestamp at epoch boundary.
	3.	Guard-path – precondition fails (e.g. try_…reverted), handler must exit without side effects.

Maintain a file-level table to ensure coverage:

//  collectionsVault.test.ts
//  ✔ happy  ✔ zeroAmount  ✔ revertOnUnknownVault


⸻

5  Snapshot heavy mutations

Handlers that touch >3 entities are hard to assert field-by-field.
Do the first run manually, then snapshot the entire store:

MATCHSTICK_SNAPSHOT=1 yarn matchstick --debug > __snapshots__/collectionsVault.block-12841857.json

Subsequent tests load the snapshot and diff:

assert.storeEqualsSnapshot("__snapshots__/collectionsVault.block-12841857.json");

If a legitimate schema change happens you update the snapshot and add an explicit test describing why.

⸻

6  Negative testing catalogue

Category	Example test	Expected outcome
Missing entity	handleEpochFinalized before Epoch exists	Log warning; no new entity
Duplicate tx	Send same tx.hash twice	Second run: no side effects (ID collision)
Overflow	Withdraw more principal than available	Revert path engaged; store unchanged

Each bullet lives in its own test() block so failures are pinpointed.

⸻

7  Utility & pure-function tests (Jest)

Keep these separate—they do not need Matchstick.

import { wmul } from "../../src/utils/math";

describe("wmul", () => {
  it("multiplies 18-dec fixed-point numbers", () => {
    expect(wmul("1e18", "2e18")).toBe("2e18");
  });
});

Run with yarn jest.

⸻

8  Data-consistency meta-assertions

Create a small helper in tests/utils/consistency.ts:

export function expectConsistentEpoch(epochId: string): void {
  const remaining = BigInt(store.get("Epoch", epochId)!.get("remainingYield"));
  const allocated = ...
  assert.assertTrue(remaining == allocated - distributed, "invariant failed");
}

Call this at the tail of every handler test that mutates Epoch.

⸻

9  Coverage & mutation
	•	Wrap every handler entry with coverage.mark("handleCollectionDeposit").
	•	After the test run, print missed handlers and fail CI if >0.
	•	Mutation—script replaces “+” with “-” in built WASM, reruns tests; at least one must fail.

⸻

Quick reference checklist
	•	One test file per handler.
	•	3-way tests (happy/edge/guard) for every branch.
	•	Negative-case catalogue covered.
	•	Heavy handlers snapshotted + diffed.
	•	Pure helpers tested separately.
	•	Consistency invariants asserted.

Adopt this structure once, and every new event or entity you add later will get unit-tested in under five minutes of developer effort—while keeping your feedback loop lightning-fast.