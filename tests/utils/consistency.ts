import { assert } from "matchstick-as/assembly/index";
import { BigInt, store } from "@graphprotocol/graph-ts"; // Import store from graph-ts

export function expectConsistentVault(vaultId: string): void {
    const vault = store.get("CollectionsVault", vaultId);
    if (vault == null) {
        assert.assertTrue(false, "Vault not found: " + vaultId); // Use assertTrue(false) to fail
        return;
    }
    // Example: Add a simple consistency check here.
    // For instance, ensure totalShares is non-negative.
    const totalShares = vault.get("totalShares")!.toBigInt();
    assert.assertTrue(totalShares.ge(BigInt.fromI32(0)), "totalShares should be non-negative");
}

export function expectConsistentCollectionParticipation(collectionParticipationId: string): void {
    const cp = store.get("CollectionParticipation", collectionParticipationId);
    if (cp == null) {
        assert.assertTrue(false, "CollectionParticipation not found: " + collectionParticipationId); // Use assertTrue(false) to fail
        return;
    }
    // Example: Ensure principalShares is non-negative.
    const principalShares = cp.get("principalShares")!.toBigInt();
    assert.assertTrue(principalShares.ge(BigInt.fromI32(0)), "principalShares should be non-negative");
}