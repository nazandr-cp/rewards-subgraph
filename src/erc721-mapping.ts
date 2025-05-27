import { BigInt, Address } from "@graphprotocol/graph-ts";
import { Transfer as TransferEvent } from "../generated/ERC721Collection/ERC721";
import {
  CollectionVault,
  AccountRewardsPerCollection,
} from "../generated/schema";

import { accrueSeconds } from "./utils/rewards";
import { ZERO_BI } from "./utils/const";

import {
  getOrCreateAccount,
  getOrCreateCollection,
  getOrCreateVault,
} from "./utils/getters";

function generateCollectionVaultId(
  vaultId: string,
  collectionAddress: Address
): string {
  return vaultId.concat("-").concat(collectionAddress.toHexString());
}

export function handleTransfer(event: TransferEvent): void {
  const collectionAddress = event.address;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const timestamp = event.block.timestamp;

  const vault = getOrCreateVault(HARDCODED_CTOKEN_MARKET_ADDRESS);
  const collection = getOrCreateCollection(collectionAddress);

  const collectionVaultId = generateCollectionVaultId(
    vault.id,
    collectionAddress
  );
  let collectionVault = getOrCreateCollectionVault(

  collectionVault.lastUpdateTimestamp = timestamp;
  collectionVault.save();

  if (
    fromAddress.toHexString() != "0x0000000000000000000000000000000000000000"
  ) {
    const fromAccount = getOrCreateAccount(fromAddress);
    const fromAccRewardsId = generateAccountRewardsPerCollectionId(
      fromAccount.id,
      collectionVault.id
    );
    let fromAccRewards = AccountRewardsPerCollection.load(fromAccRewardsId);

    if (fromAccRewards == null) {
      fromAccRewards = new AccountRewardsPerCollection(fromAccRewardsId);
      fromAccRewards.account = fromAccount.id;
      fromAccRewards.collectionVault = collectionVault.id;
      fromAccRewards.balanceNFT = ZERO_BI;
      fromAccRewards.seconds = ZERO_BI;
    }

    accrueSeconds(fromAccRewards, collectionVault, timestamp);

    fromAccRewards.balanceNFT = fromAccRewards.balanceNFT.minus(
      BigInt.fromI32(1)
    );
    fromAccRewards.lastUpdate = timestamp.toI32();
    fromAccRewards.save();
  }

  if (toAddress.toHexString() != "0x0000000000000000000000000000000000000000") {
    const toAccount = getOrCreateAccount(toAddress);
    const toAccRewardsId = generateAccountRewardsPerCollectionId(
      toAccount.id,
      collectionVault.id
    );
    let toAccRewards = AccountRewardsPerCollection.load(toAccRewardsId);

    if (toAccRewards == null) {
      toAccRewards = new AccountRewardsPerCollection(toAccRewardsId);
      toAccRewards.account = toAccount.id;
      toAccRewards.collectionVault = collectionVault.id;
      toAccRewards.balanceNFT = ZERO_BI;
      toAccRewards.seconds = ZERO_BI;
    }

    accrueSeconds(toAccRewards, collectionVault, timestamp);

    toAccRewards.balanceNFT = toAccRewards.balanceNFT.plus(BigInt.fromI32(1));
    toAccRewards.lastUpdate = timestamp.toI32();
    toAccRewards.save();
  }
}
