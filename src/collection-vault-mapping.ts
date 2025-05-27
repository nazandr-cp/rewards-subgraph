import {
  CollectionDeposit as CollectionDepositEvent,
  CollectionWithdraw as CollectionWithdrawEvent,
} from "../generated/CollectionVault/CollectionVault";
import { log } from "@graphprotocol/graph-ts";

import { getOrCreateVault, getOrCreateCollectionVault } from "./utils/getters";

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;

  const vault = getOrCreateVault(vaultAddress);
  vault.totalShares = vault.totalShares.plus(shares);
  vault.totalDeposits = vault.totalDeposits.plus(assets);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);

  const collVault = getOrCreateCollectionVault(vaultAddress, collectionAddress);

  collVault.principalShares = collVault.principalShares.plus(shares);
  collVault.principalDeposited = collVault.principalDeposited.plus(assets);
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();

  log.info(
    "CollectionDeposit: collectionVaultId {}, caller {}, receiver {}, assets {}, shares {}, new principalDeposited {}",
    [
      collVault.id,
      event.params.caller.toHexString(),
      event.params.receiver.toHexString(),
      assets.toString(),
      shares.toString(),
      collVault.principalDeposited.toString(),
    ]
  );
}

export function handleCollectionWithdraw(event: CollectionWithdrawEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;

  const vault = getOrCreateVault(vaultAddress);
  vault.totalShares = vault.totalShares.minus(shares);
  vault.totalDeposits = vault.totalDeposits.minus(assets);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);
  const collVault = getOrCreateCollectionVault(vaultAddress, collectionAddress);
  collVault.principalShares = collVault.principalShares.minus(shares);
  collVault.principalDeposited = collVault.principalDeposited.minus(assets);
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();
  log.info(
    "CollectionWithdraw: collectionVaultId {}, caller {}, receiver {}, assets {}, shares {}, new principalDeposited {}",
    [
      collVault.id,
      event.params.caller.toHexString(),
      event.params.receiver.toHexString(),
      assets.toString(),
      shares.toString(),
      collVault.principalDeposited.toString(),
    ]
  );
}
