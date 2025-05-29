import {
  CollectionDeposit as CollectionDepositEvent,
  CollectionWithdraw as CollectionWithdrawEvent,
} from "../generated/templates/CollectionVault/CollectionVault";
import { log, Address } from "@graphprotocol/graph-ts"; // Added Address
import { Vault } from "../generated/schema"; // Added Vault for loading

import { getOrCreateVault, getOrCreateCollectionVault } from "./utils/getters";

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;
  const totalCTokens = event.params.cTokenAmount;

  // Load the Vault to get its cTokenMarket address
  const vaultEntity = Vault.load(vaultAddress.toHex());
  if (!vaultEntity) {
    log.error("handleCollectionDeposit: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketForVault = Address.fromString(vaultEntity.cTokenMarket);

  const vault = getOrCreateVault(vaultAddress, cTokenMarketForVault);
  vault.totalShares = vault.totalShares.plus(shares);
  vault.totalDeposits = vault.totalDeposits.plus(assets);
  vault.totalCTokens = vault.totalCTokens.plus(totalCTokens);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketForVault
  );

  collVault.principalShares = collVault.principalShares.plus(shares);
  collVault.principalDeposited = collVault.principalDeposited.plus(assets);
  collVault.cTokenAmount = collVault.cTokenAmount.plus(totalCTokens);
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
  const totalCTokens = event.params.cTokenAmount;

  // Load the Vault to get its cTokenMarket address
  const vaultEntityWithdraw = Vault.load(vaultAddress.toHex());
  if (!vaultEntityWithdraw) {
    log.error("handleCollectionWithdraw: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketForVaultWithdraw = Address.fromString(
    vaultEntityWithdraw.cTokenMarket
  );

  const vault = getOrCreateVault(vaultAddress, cTokenMarketForVaultWithdraw);
  vault.totalShares = vault.totalShares.minus(shares);
  vault.totalDeposits = vault.totalDeposits.minus(assets);
  vault.totalCTokens = vault.totalCTokens.minus(totalCTokens);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketForVaultWithdraw
  );
  collVault.principalShares = collVault.principalShares.minus(shares);
  collVault.principalDeposited = collVault.principalDeposited.minus(assets);
  collVault.cTokenAmount = collVault.cTokenAmount.minus(totalCTokens);
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
