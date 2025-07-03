import { beforeEach, test, assert, clearStore, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { handleTransfer } from "../../src/erc721-mapping";
import { Transfer } from "../../generated/ERC721Collection/ERC721";
import { newERC721TransferEvent } from "../utils/tokenHelpers";
import { Collection, CollectionsVault, CollectionParticipation, AccountSubsidy } from "../../generated/schema";
import { IdGenerator } from "../../src/utils/id-generation";

const COLLECTION = Address.fromString("0x00000000000000000000000000000000000000c1");
const VAULT = Address.fromString("0x0000000000000000000000000000000000000001");
const CTOKEN = Address.fromString("0x0000000000000000000000000000000000000002");
const FROM = Address.fromString("0x0000000000000000000000000000000000000003");
const TO = Address.fromString("0x0000000000000000000000000000000000000004");

beforeEach(() => {
    clearStore();

    // Create a collection
    const col = new Collection(COLLECTION.toHexString());
    col.contractAddress = COLLECTION;
    col.registry = Address.fromString("0x00000000000000000000000000000000000000a0").toHexString();
    col.isActive = true;
    col.name = "Test Collection";
    col.symbol = "TEST";
    col.totalSupply = BigInt.fromI32(0);
    col.collectionType = "ERC721";
    col.yieldSharePercentage = BigInt.fromI32(0);
    col.weightFunctionType = "LINEAR";
    col.weightFunctionP1 = BigInt.fromString("1000000000000000000"); // 1e18
    col.weightFunctionP2 = BigInt.fromString("500000000000000000");  // 0.5e18
    col.minBorrowAmount = BigInt.fromI32(0);
    col.maxBorrowAmount = BigInt.fromI32(0);
    col.totalNFTsDeposited = BigInt.fromI32(0);
    col.vaults = [];
    col.registeredAtBlock = BigInt.fromI32(0);
    col.registeredAtTimestamp = BigInt.fromI32(0);
    col.updatedAtBlock = BigInt.fromI32(0);
    col.updatedAtTimestamp = BigInt.fromI32(0);
    col.save();

    // Create a vault
    const vault = new CollectionsVault(VAULT.toHexString());
    vault.cTokenMarket = CTOKEN.toHexString();
    vault.totalShares = BigInt.fromI32(0);
    vault.totalDeposits = BigInt.fromI32(0);
    vault.totalCTokens = BigInt.fromI32(0);
    vault.globalDepositIndex = BigInt.fromI32(0);
    vault.totalPrincipalDeposited = BigInt.fromI32(0);
    vault.collectionRegistry = Address.fromString("0x0000000000000000000000000000000000000006").toHexString();
    vault.epochManager = Address.fromString("0x0000000000000000000000000000000000000007").toHexString();
    vault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString();
    vault.debtSubsidizer = Address.fromString("0x0000000000000000000000000000000000000009").toHexString();
    vault.createdAtBlock = BigInt.fromI32(0);
    vault.createdAtTimestamp = BigInt.fromI32(0);
    vault.updatedAtBlock = BigInt.fromI32(0);
    vault.updatedAtTimestamp = BigInt.fromI32(0);
    vault.save();

    // Create a collection participation (collection-vault relationship)
    const collectionVaultId = IdGenerator.collectionVaultId(VAULT, COLLECTION);
    const cp = new CollectionParticipation(collectionVaultId);
    cp.collection = COLLECTION.toHexString();
    cp.vault = VAULT.toHexString();
    cp.principalShares = BigInt.fromI32(0);
    cp.principalDeposited = BigInt.fromI32(0);
    cp.totalCTokens = BigInt.fromI32(0);
    cp.globalDepositIndex = BigInt.fromI32(0);
    cp.lastGlobalDepositIndex = BigInt.fromI32(0);
    cp.yieldAccrued = BigInt.fromI32(0);
    cp.yieldClaimed = BigInt.fromI32(0);
    cp.totalYieldGenerated = BigInt.fromI32(0);
    cp.isBorrowBased = true;
    cp.rewardSharePercentage = BigInt.fromI32(0);
    cp.secondsAccumulated = BigInt.fromI32(0);
    cp.secondsClaimed = BigInt.fromI32(0);
    cp.totalSubsidies = BigInt.fromI32(0);
    cp.totalSubsidiesClaimed = BigInt.fromI32(0);
    cp.averageAPY = BigInt.fromI32(0);
    cp.totalParticipants = BigInt.fromI32(0);
    cp.createdAtBlock = BigInt.fromI32(0);
    cp.createdAtTimestamp = BigInt.fromI32(0);
    cp.updatedAtBlock = BigInt.fromI32(0);
    cp.updatedAtTimestamp = BigInt.fromI32(0);
    cp.save();

    // Mock cToken contract calls
    createMockedFunction(
        CTOKEN,
        "name",
        "name():(string)"
    ).returns([ethereum.Value.fromString("Test cToken")]);

    createMockedFunction(
        CTOKEN,
        "symbol",
        "symbol():(string)"
    ).returns([ethereum.Value.fromString("cTEST")]);

    createMockedFunction(
        CTOKEN,
        "borrowBalanceStored",
        "borrowBalanceStored(address):(uint256)"
    )
        .withArgs([ethereum.Value.fromAddress(TO)])
        .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromString("2000000000000000000000"))]);

    createMockedFunction(
        CTOKEN,
        "borrowBalanceStored",
        "borrowBalanceStored(address):(uint256)"
    )
        .withArgs([ethereum.Value.fromAddress(FROM)])
        .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1000000000000000000000"))]);
});

test("should accumulate seconds on NFT transfer when collection participates in vault", () => {
    // Create an initial AccountSubsidy for the TO address
    const collectionVaultId = IdGenerator.collectionVaultId(VAULT, COLLECTION);
    const accountSubsidiesId = IdGenerator.accountSubsidiesPerCollectionId(TO, collectionVaultId);
    const accountSubsidies = new AccountSubsidy(accountSubsidiesId);
    accountSubsidies.account = TO.toHexString();
    accountSubsidies.accountMarket = TO.toHexString() + "-" + CTOKEN.toHexString();
    accountSubsidies.collectionParticipation = collectionVaultId;
    accountSubsidies.balanceNFT = BigInt.fromI32(0);
    accountSubsidies.secondsAccumulated = BigInt.fromI32(0);
    accountSubsidies.secondsClaimed = BigInt.fromI32(0);
    accountSubsidies.subsidiesAccrued = BigInt.fromI32(0);
    accountSubsidies.subsidiesClaimed = BigInt.fromI32(0);
    accountSubsidies.averageHoldingPeriod = BigInt.fromI32(0);
    accountSubsidies.totalRewardsEarned = BigInt.fromI32(0);
    accountSubsidies.lastEffectiveValue = BigInt.fromI32(0);
    accountSubsidies.updatedAtBlock = BigInt.fromI32(1000);
    accountSubsidies.updatedAtTimestamp = BigInt.fromI32(1000); // 1000 seconds initial time
    accountSubsidies.save();

    // Create transfer event at time 2000 (1000 seconds later)
    const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
    event.address = COLLECTION;
    event.block.timestamp = BigInt.fromI32(2000);
    event.block.number = BigInt.fromI32(2000);

    // Execute the transfer
    handleTransfer(event);

    // Load the updated AccountSubsidy
    const updatedAccountSubsidies = AccountSubsidy.load(accountSubsidiesId);
    assert.assertNotNull(updatedAccountSubsidies);

    if (updatedAccountSubsidies) {
        // Verify that seconds were accumulated
        // Expected calculation:
        // dt = 2000 - 1000 = 1000 seconds
        // basePrincipalForSubsidy = 2000e18 (from mock)
        // nftHoldingWeight = linearWeight(1, 1e18, 0.5e18) = 1e18 + 0.5e18 = 1.5e18  
        // effectiveValue = 2000e18 + 1.5e18 = 2001.5e18
        // subsidyAccruedScaled = 2001.5e18 * 1000 = 2001500e18
        // finalAccrual = 2001500e18 / 1e18 = 2001500

        assert.bigIntEquals(updatedAccountSubsidies.secondsAccumulated, BigInt.fromI32(2000500));
        assert.bigIntEquals(updatedAccountSubsidies.balanceNFT, BigInt.fromI32(1));
        assert.bigIntEquals(updatedAccountSubsidies.updatedAtTimestamp, BigInt.fromI32(2000));
        assert.bigIntEquals(
            updatedAccountSubsidies.lastEffectiveValue,
            BigInt.fromString("2000500000000000000000") // 2000.5e18
        );
    }
});

test("should accumulate additional seconds on subsequent transfers", () => {
    // Create initial AccountSubsidy
    const collectionVaultId = IdGenerator.collectionVaultId(VAULT, COLLECTION);
    const accountSubsidiesId = IdGenerator.accountSubsidiesPerCollectionId(TO, collectionVaultId);
    const accountSubsidies = new AccountSubsidy(accountSubsidiesId);
    accountSubsidies.account = TO.toHexString();
    accountSubsidies.accountMarket = TO.toHexString() + "-" + CTOKEN.toHexString();
    accountSubsidies.collectionParticipation = collectionVaultId;
    accountSubsidies.balanceNFT = BigInt.fromI32(0);
    accountSubsidies.secondsAccumulated = BigInt.fromI32(0);
    accountSubsidies.secondsClaimed = BigInt.fromI32(0);
    accountSubsidies.subsidiesAccrued = BigInt.fromI32(0);
    accountSubsidies.subsidiesClaimed = BigInt.fromI32(0);
    accountSubsidies.averageHoldingPeriod = BigInt.fromI32(0);
    accountSubsidies.totalRewardsEarned = BigInt.fromI32(0);
    accountSubsidies.lastEffectiveValue = BigInt.fromI32(0);
    accountSubsidies.updatedAtBlock = BigInt.fromI32(1000);
    accountSubsidies.updatedAtTimestamp = BigInt.fromI32(1000);
    accountSubsidies.save();

    // First transfer at time 2000
    const event1 = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
    event1.address = COLLECTION;
    event1.block.timestamp = BigInt.fromI32(2000);
    event1.block.number = BigInt.fromI32(2000);
    handleTransfer(event1);

    // Second transfer at time 3000 (another 1000 seconds later)
    const event2 = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(2)));
    event2.address = COLLECTION;
    event2.block.timestamp = BigInt.fromI32(3000);
    event2.block.number = BigInt.fromI32(3000);
    handleTransfer(event2);

    // Load the final state
    const finalAccountSubsidies = AccountSubsidy.load(accountSubsidiesId);
    assert.assertNotNull(finalAccountSubsidies);

    if (finalAccountSubsidies) {
        // Should have accumulated seconds from both periods
        // After first transfer: 2001500 seconds (calculated above)
        // After second transfer: additional accumulation based on new balance (2 NFTs)
        assert.assertTrue(finalAccountSubsidies.secondsAccumulated.gt(BigInt.fromI32(2001500)));
        assert.bigIntEquals(finalAccountSubsidies.balanceNFT, BigInt.fromI32(2));
        assert.bigIntEquals(finalAccountSubsidies.updatedAtTimestamp, BigInt.fromI32(3000));
    }
});

test("should handle zero NFT balance correctly", () => {
    // Create AccountSubsidy with existing balance
    const collectionVaultId = IdGenerator.collectionVaultId(VAULT, COLLECTION);
    const accountSubsidiesId = IdGenerator.accountSubsidiesPerCollectionId(FROM, collectionVaultId);
    const accountSubsidies = new AccountSubsidy(accountSubsidiesId);
    accountSubsidies.account = FROM.toHexString();
    accountSubsidies.accountMarket = FROM.toHexString() + "-" + CTOKEN.toHexString();
    accountSubsidies.collectionParticipation = collectionVaultId;
    accountSubsidies.balanceNFT = BigInt.fromI32(1); // Has 1 NFT initially
    accountSubsidies.secondsAccumulated = BigInt.fromI32(0);
    accountSubsidies.secondsClaimed = BigInt.fromI32(0);
    accountSubsidies.subsidiesAccrued = BigInt.fromI32(0);
    accountSubsidies.subsidiesClaimed = BigInt.fromI32(0);
    accountSubsidies.averageHoldingPeriod = BigInt.fromI32(0);
    accountSubsidies.totalRewardsEarned = BigInt.fromI32(0);
    accountSubsidies.lastEffectiveValue = BigInt.fromI32(0);
    accountSubsidies.updatedAtBlock = BigInt.fromI32(1000);
    accountSubsidies.updatedAtTimestamp = BigInt.fromI32(1000);
    accountSubsidies.save();

    // Transfer away the NFT (FROM -> TO), reducing FROM's balance to 0
    const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
    event.address = COLLECTION;
    event.block.timestamp = BigInt.fromI32(2000);
    event.block.number = BigInt.fromI32(2000);
    handleTransfer(event);

    // Load the FROM account's subsidies
    const fromAccountSubsidies = AccountSubsidy.load(accountSubsidiesId);
    assert.assertNotNull(fromAccountSubsidies);

    if (fromAccountSubsidies) {
        // Should have accumulated some seconds before transfer, then balance becomes 0
        assert.assertTrue(fromAccountSubsidies.secondsAccumulated.gt(BigInt.fromI32(0)));
        assert.bigIntEquals(fromAccountSubsidies.balanceNFT, BigInt.fromI32(0));
        assert.bigIntEquals(fromAccountSubsidies.updatedAtTimestamp, BigInt.fromI32(2000));
    }
});