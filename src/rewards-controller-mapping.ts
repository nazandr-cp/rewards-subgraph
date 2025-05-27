import { log, store, Address } from "@graphprotocol/graph-ts";
import { CollectionVault as CollectionVaultTemplate } from "../generated/templates";
import { RewardClaim } from "../generated/schema";
import { ZERO_BI } from "./utils/const";
import {
  getOrCreateVault,
  getOrCreateAccount,
  getOrCreateCollection,
  getOrCreateCollectionVault,
  getOrCreateAccountRewardsPerCollection,
} from "./utils/getters";
import { WeightFunctionType } from "./utils/rewards";
import {
  NewCollectionWhitelisted,
  WhitelistCollectionRemoved,
  CollectionRewardShareUpdated,
  WeightFunctionSet,
  RewardsController,
  RewardPerBlockUpdated as RewardPerBlockUpdatedEvent,
  RewardsClaimed as RewardClaimedEvent,
  VaultAdded as VaultAddedEvent,
} from "../generated/RewardsController/RewardsController";
import { ERC721Metadata } from "generated/RewardsController/ERC721Metadata";

export function handleVaultAdded(event: VaultAddedEvent): void {
  const vaultAddress = event.params.vaultAddress;
  const cTokenAddress = event.params.cTokenAddress;
  const vault = getOrCreateVault(vaultAddress);

  const rewardsController = RewardsController.bind(event.address);
  const vaultInfoTry = rewardsController.try_vaults(vaultAddress);

  if (!vaultInfoTry.reverted) {
    const vaultInfo = vaultInfoTry.value;
    vault.cTokenMarket = Address.fromString(
      cTokenAddress.toHexString()
    ).toHexString();
    vault.rewardPerBlock = vaultInfo.rewardPerBlock;
    vault.globalRPW = vaultInfo.globalRPW;
    vault.totalWeight = vaultInfo.totalWeight;
    vault.updatedAtBlock = vaultInfo.lastUpdateBlock;
    vault.updatedAtTimestamp = event.block.timestamp.toI64();
    vault.save();
    log.info("VaultAdded: Vault entity {} (re)loaded/created and updated.", [
      vault.id,
    ]);
  } else {
    log.warning(
      "handleVaultAdded: try_vaults reverted for vault {}. Vault might have default values.",
      [vaultAddress.toHexString()]
    );
  }

  CollectionVaultTemplate.create(vaultAddress);
  log.info(
    "VaultAdded: CollectionVault template creation attempted for address {}",
    [vaultAddress.toHexString()]
  );
}

export function handleNewCollectionWhitelisted(
  event: NewCollectionWhitelisted
): void {
  const vaultAddress = event.params.vaultAddress;
  const nftCollectionAddress = event.params.collectionAddress;
  const collectionTypeParam = event.params.collectionType;
  const rewardBasisParam = event.params.rewardBasis;
  const rewardSharePercentage = event.params.sharePercentage;
  const weightFunction = event.params.weightFunction;

  const collection = getOrCreateCollection(nftCollectionAddress);

  let collectionTypeString: string;
  if (collectionTypeParam == 0) {
    collectionTypeString = "ERC721";
  } else if (collectionTypeParam == 1) {
    collectionTypeString = "ERC1155";
  } else {
    collectionTypeString = "ERC721";
    log.warning(
      "NewCollectionWhitelisted: Unknown collectionTypeParam u8 {} for collection {}. Defaulting to ERC721.",
      [collectionTypeParam.toString(), nftCollectionAddress.toHexString()]
    );
  }
  collection.collectionType = collectionTypeString;
  const erc721Metadata = ERC721Metadata.bind(nftCollectionAddress);
  const nameTry = erc721Metadata.try_name();
  if (!nameTry.reverted) {
    collection.name = nameTry.value;
  } else {
    log.warning(
      "NewCollectionWhitelisted: ERC721Metadata.name() call reverted for collection {}. Using default name.",
      [nftCollectionAddress.toHexString()]
    );
    collection.name = "Unknown Collection Name";
  }
  const symbolTry = erc721Metadata.try_symbol();
  if (!symbolTry.reverted) {
    collection.symbol = symbolTry.value;
  } else {
    log.warning(
      "NewCollectionWhitelisted: ERC721Metadata.symbol() call reverted for collection {}. Using default symbol.",
      [nftCollectionAddress.toHexString()]
    );
    collection.symbol = "UNKN";
  }
  collection.save();

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    nftCollectionAddress
  );

  let isBorrowBased: boolean;
  if (rewardBasisParam == 0) {
    isBorrowBased = false;
  } else if (rewardBasisParam == 1) {
    isBorrowBased = true;
  } else {
    isBorrowBased = true;
    log.info(
      "NewCollectionWhitelisted: Unknown rewardBasisParam u8 {} for collection {}. Defaulting to isBorrowBased = true.",
      [rewardBasisParam.toString(), nftCollectionAddress.toHexString()]
    );
  }
  collVault.isBorrowBased = isBorrowBased;
  collVault.rewardSharePercentage = rewardSharePercentage;
  collVault.fnType = weightFunction.fnType == 0 ? "LINEAR" : "EXPONENTIAL";
  collVault.p1 = weightFunction.p1;
  collVault.p2 = weightFunction.p2;
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();

  log.info(
    "NewCollectionWhitelisted: Processed CollectionVault {}, collection {}, type {}, rewardBasis (from event u8) {}, sharePercentage {}",
    [
      collVault.id,
      nftCollectionAddress.toHexString(),
      collectionTypeString,
      rewardBasisParam.toString(),
      rewardSharePercentage.toString(),
    ]
  );
}

export function handleWhitelistCollectionRemoved(
  event: WhitelistCollectionRemoved
): void {
  const collectionAddress = event.params.collectionAddress;
  const vaultAddress = event.params.vaultAddress;

  const existingCollVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress
  );

  store.remove("CollectionVault", existingCollVault.id);
  log.info(
    "WhitelistCollectionRemoved: Removed CollectionVault {} for collection {}",
    [existingCollVault.id, collectionAddress.toHexString()]
  );
}

export function handleCollectionRewardShareUpdated(
  event: CollectionRewardShareUpdated
): void {
  const collectionAddress = event.params.collectionAddress;
  const vaultAddress = event.params.vaultAddress;
  const collVault = getOrCreateCollectionVault(vaultAddress, collectionAddress);

  collVault.rewardSharePercentage = event.params.newSharePercentage;
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();
}

export function handleWeightFunctionSet(event: WeightFunctionSet): void {
  const collectionAddress = event.params.collectionAddress;
  const vaultAddress = event.params.vaultAddress;
  const weightFnParams = event.params.fn;

  const collVault = getOrCreateCollectionVault(vaultAddress, collectionAddress);

  const fnTypeU8 = weightFnParams.fnType;
  if (fnTypeU8 == WeightFunctionType.LINEAR) {
    collVault.fnType = "LINEAR";
  } else if (fnTypeU8 == WeightFunctionType.EXPONENTIAL) {
    collVault.fnType = "EXPONENTIAL";
  } else {
    collVault.fnType = "LINEAR";
    log.warning(
      "handleWeightFunctionSet: Unknown fnType {} received for CollectionVault {}. Defaulting to LINEAR.",
      [fnTypeU8.toString(), collVault.id]
    );
  }
  collVault.p1 = weightFnParams.p1;
  collVault.p2 = weightFnParams.p2;
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();
  log.info(
    "handleWeightFunctionSet: Updated weight function for CollectionVault {} (collection {}). fnType: {}, p1: {}, p2: {}",
    [
      collVault.id,
      collectionAddress.toHexString(),
      collVault.fnType,
      collVault.p1.toString(),
      collVault.p2.toString(),
    ]
  );
}
// TODO: implement correctly
export function handleRewardPerBlockUpdated(
  event: RewardPerBlockUpdatedEvent
): void {
  const vaultAddress = event.params.vault;
  const vault = getOrCreateVault(vaultAddress);

  const rewardsController = RewardsController.bind(event.address);
  const vaultInfoTry = rewardsController.try_vaults(event.params.vault);
  if (vaultInfoTry.reverted) {
    log.error(
      "handleRewardPerBlockUpdated: contract.try_vaults reverted for vault {}",
      [event.params.vault.toHex()]
    );
    return;
  }
  const vaultInfo = vaultInfoTry.value;
  vault.rewardPerBlock = event.params.rewardPerBlock;
  vault.globalRPW = vaultInfo.globalRPW;
  vault.totalWeight = vaultInfo.totalWeight;
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  const vaultAddress = event.params.vaultAddress;
  const userAddress = event.params.user;
  const collectionAddressFromEvent = event.params.collectionAddress;
  const amountClaimed = event.params.amount;
  const newNonceFromEvent = event.params.newNonce;
  const secondsInClaimFromEvent = event.params.secondsInClaim;

  const vaultId = vaultAddress.toHex();
  const accountId = userAddress.toHex();

  // Ensure Vault entity is up-to-date
  const vault = getOrCreateVault(vaultAddress);
  const contract_ = RewardsController.bind(event.address);
  const vaultInfoTry_ = contract_.try_vaults(vaultAddress);
  if (!vaultInfoTry_.reverted) {
    const vaultInfo = vaultInfoTry_.value;
    vault.globalRPW = vaultInfo.globalRPW;
    vault.updatedAtBlock = event.block.number;
    vault.updatedAtTimestamp = event.block.timestamp.toI64();
    vault.totalWeight = vaultInfo.totalWeight;
    // rewardPerBlock is updated by its own handler
    vault.save();
  } else {
    log.error(
      "handleRewardClaimed: contract.try_vaults reverted for vault {} (during vault update)",
      [vaultAddress.toHex()]
    );
  }

  const account = getOrCreateAccount(userAddress); // Use util
  const previousTotalSecondsClaimed = account.totalSecondsClaimed;
  account.totalSecondsClaimed = account.totalSecondsClaimed.plus(
    secondsInClaimFromEvent
  );
  account.save();

  const rewardClaimIdBytes = event.transaction.hash.concatI32(
    event.logIndex.toI32()
  );
  const rewardClaim = new RewardClaim(rewardClaimIdBytes.toHex());
  rewardClaim.account = accountId;
  rewardClaim.vault = vaultId;
  rewardClaim.collection = collectionAddressFromEvent.toHex();
  rewardClaim.amount = amountClaimed;
  rewardClaim.blockTimestamp = event.block.timestamp.toI32();
  rewardClaim.blockNumber = event.block.number;
  rewardClaim.transactionHash = event.transaction.hash;
  rewardClaim.nonce = newNonceFromEvent;
  rewardClaim.secondsInClaim = secondsInClaimFromEvent;
  rewardClaim.secondsUser = previousTotalSecondsClaimed;
  rewardClaim.secondsColl = ZERO_BI;
  rewardClaim.incRPS = ZERO_BI;
  rewardClaim.yieldSlice = ZERO_BI;
  rewardClaim.save();

  const accountVault = getOrCreateAccountVault(accountId, vaultId);
  accountVault.accrued = ZERO_BI;
  accountVault.claimable = ZERO_BI;
  accountVault.save();
  const collectionVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddressFromEvent
  );

  const accRewards = getOrCreateAccountRewardsPerCollection(
    Address.fromString(accountId),
    collectionVault.id,
    event.block.timestamp
  );
  accRewards.lastUpdate = event.block.timestamp.toI32();
  accRewards.save();

  log.info(
    "handleRewardClaimed: Ensured/Updated AccountRewardsPerCollection {} for account {} and collectionVault {}.",
    [accRewards.id, account.id, collectionVault.id]
  );

  log.info(
    "Account {} totalSecondsClaimed updated to {}. RewardClaim {} created for amount {}. AccountVault {} processed.",
    [
      accountId,
      account.totalSecondsClaimed.toString(),
      rewardClaimIdBytes.toHex(),
      amountClaimed.toString(),
      accountVault.id,
    ]
  );
}
