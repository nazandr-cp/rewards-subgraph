import {
    assert,
    describe,
    test,
    clearStore,
    beforeEach,
    afterEach,
    mockFunction,
    logStore,
    newMockEvent
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { CollectionMarket } from "../../generated/schema";
import { CollectionDeposit, CollectionWithdraw } from "../../generated/CollectionVault/CollectionVault";
import { handleCollectionDeposit, handleCollectionWithdraw } from "../../src/collection-vault-mapping";
import { ZERO_ADDRESS, ZERO_BI } from "../../src/utils/rewards";
import { ERC20 } from "../../generated/cToken/ERC20";
import { cToken } from "../../generated/cToken/cToken";

// Mock contract addresses
// const COLLECTION_VAULT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001"); // Commented out as unused
const CTOKEN_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002"); // Market address
const COLLECTION_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000003");
const UNDERLYING_ASSET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000004");
const CALLER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000005");
const RECEIVER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000006");
const OWNER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000007");

// Constants for the handleCollectionWithdraw tests
// Ensure COLLECTION_ADDRESS and CTOKEN_ADDRESS are defined before these lines (they are, around line 18)
const WITHDRAW_INITIAL_ASSETS = BigInt.fromI32(200).times(BigInt.fromI32(10).pow(18));
const WITHDRAW_INITIAL_SHARES = BigInt.fromI32(20);
const withdrawIdString = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString(); // COLLECTION_ADDRESS and CTOKEN_ADDRESS are global
const WITHDRAW_ID_BYTES = Bytes.fromHexString(withdrawIdString);

function setupWithdrawTestEntity(): void {
    const existingEntity = new CollectionMarket(WITHDRAW_ID_BYTES);
    existingEntity.collection = COLLECTION_ADDRESS;
    existingEntity.market = CTOKEN_ADDRESS;
    existingEntity.totalNFT = WITHDRAW_INITIAL_SHARES;
    existingEntity.principalU = WITHDRAW_INITIAL_ASSETS;
    existingEntity.totalSeconds = ZERO_BI; // ZERO_BI is global
    existingEntity.save();
    assert.entityCount("CollectionMarket", 1);
}

function createCollectionDepositEvent(
    collectionAddress: Address,
    caller: Address,
    receiver: Address,
    assets: BigInt,
    shares: BigInt
): CollectionDeposit {
    let mockEvent = newMockEvent();
    let event = new CollectionDeposit(
        CTOKEN_ADDRESS, // market address (event.address)
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        null
    );
    event.parameters = new Array();
    let collectionAddressParam = new ethereum.EventParam("collectionAddress", ethereum.Value.fromAddress(collectionAddress));
    let callerParam = new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller));
    let receiverParam = new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver));
    let assetsParam = new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets));
    let sharesParam = new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares));

    event.parameters.push(collectionAddressParam);
    event.parameters.push(callerParam);
    event.parameters.push(receiverParam);
    event.parameters.push(assetsParam);
    event.parameters.push(sharesParam);

    return event;
}

function createCollectionWithdrawEvent(
    collectionAddress: Address,
    caller: Address,
    receiver: Address,
    owner: Address,
    assets: BigInt,
    shares: BigInt
): CollectionWithdraw {
    let mockEvent = newMockEvent();
    let event = new CollectionWithdraw(
        CTOKEN_ADDRESS, // market address (event.address)
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        null
    );
    event.parameters = new Array();
    let collectionAddressParam = new ethereum.EventParam("collectionAddress", ethereum.Value.fromAddress(collectionAddress));
    let callerParam = new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller));
    let receiverParam = new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver));
    let ownerParam = new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner));
    let assetsParam = new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets));
    let sharesParam = new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares));

    event.parameters.push(collectionAddressParam);
    event.parameters.push(callerParam);
    event.parameters.push(receiverParam);
    event.parameters.push(ownerParam);
    event.parameters.push(assetsParam);
    event.parameters.push(sharesParam);

    return event;
}

function mockCTokenCalls(underlyingAddress: Address, underlyingReverts: boolean): void {
    if (underlyingReverts) {
        mockFunction(CTOKEN_ADDRESS, "underlying", "underlying():(address)", [], [], true);
    } else {
        mockFunction(CTOKEN_ADDRESS, "underlying", "underlying():(address)", [],
            [ethereum.Value.fromAddress(underlyingAddress)],
            false
        );
    }
}

function mockERC20Calls(tokenAddress: Address, decimals: i32, decimalsReverts: boolean, decimalsReturnsZero: boolean): void {
    if (decimalsReverts) {
        mockFunction(tokenAddress, "decimals", "decimals():(uint8)", [], [], true);
    } else if (decimalsReturnsZero) {
        mockFunction(tokenAddress, "decimals", "decimals():(uint8)", [],
            [ethereum.Value.fromI32(0)],
            false
        );
    }
    else {
        mockFunction(tokenAddress, "decimals", "decimals():(uint8)", [],
            [ethereum.Value.fromI32(decimals as i32)], // Ensure decimals is treated as i32 if it's not already typed explicitly
            false
        );
    }
}


describe("CollectionVault Handlers", () => {
    beforeEach(() => {
        // Mock cToken and ERC20 calls by default for happy paths
        mockCTokenCalls(UNDERLYING_ASSET_ADDRESS, false);
        mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 18, false, false);
    });

    afterEach(() => {
        clearStore();
    });

    describe("handleCollectionDeposit", () => {
        test("should create a new CollectionMarket entity if it does not exist", () => {
            const assets = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(18)); // 100e18
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            assert.entityCount("CollectionMarket", 0);
            handleCollectionDeposit(event);
            assert.entityCount("CollectionMarket", 1);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                assert.bytesEquals(COLLECTION_ADDRESS, entity.collection);
                assert.bytesEquals(CTOKEN_ADDRESS, entity.market);
                assert.bigIntEquals(shares, entity.totalNFT);
                assert.bigIntEquals(assets, entity.principalU); // Assuming 18 decimals for underlying
                assert.bigIntEquals(ZERO_BI, entity.totalSeconds);
            }
        });

        test("should update an existing CollectionMarket entity", () => {
            const initialAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const initialShares = BigInt.fromI32(5);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            const existingEntity = new CollectionMarket(idBytes); // Changed let to const
            existingEntity.collection = COLLECTION_ADDRESS;
            existingEntity.market = CTOKEN_ADDRESS;
            existingEntity.totalNFT = initialShares;
            existingEntity.principalU = initialAssets;
            existingEntity.totalSeconds = ZERO_BI;
            existingEntity.save();

            assert.entityCount("CollectionMarket", 1);

            const newAssets = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(18));
            const newShares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, newAssets, newShares);

            handleCollectionDeposit(event);
            assert.entityCount("CollectionMarket", 1);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                assert.bigIntEquals(initialShares.plus(newShares), entity.totalNFT);
                assert.bigIntEquals(initialAssets.plus(newAssets), entity.principalU);
            }
        });

        test("should handle underlying asset with 6 decimals", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 6, false, false); // Mock for 6 decimals

            const assets6Decimals = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(6)); // 100e6
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets6Decimals, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            handleCollectionDeposit(event);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                // principalU should be converted to 18 decimals
                const expectedPrincipalU = assets6Decimals.times(BigInt.fromI32(10).pow(12)); // 100e6 * 10e12 = 100e18
                assert.bigIntEquals(expectedPrincipalU, entity.principalU);
            }
        });

        test("should handle underlying asset with 20 decimals", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 20, false, false); // Mock for 20 decimals

            const assets20Decimals = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(20)); // 100e20
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets20Decimals, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            handleCollectionDeposit(event);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                // principalU should be converted to 18 decimals
                const expectedPrincipalU = assets20Decimals.div(BigInt.fromI32(10).pow(2)); // 100e20 / 10e2 = 100e18
                assert.bigIntEquals(expectedPrincipalU, entity.principalU);
            }
        });

        test("should handle cToken.underlying() revert", () => {
            mockCTokenCalls(UNDERLYING_ASSET_ADDRESS, true); // underlying() reverts

            const assets = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(18));
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            handleCollectionDeposit(event);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if underlying() reverts
                assert.bigIntEquals(assets, entity.principalU);
            }
        });

        test("should handle ERC20.decimals() revert", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 18, true, false); // decimals() reverts

            const assets = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(18));
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            handleCollectionDeposit(event);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if decimals() reverts
                assert.bigIntEquals(assets, entity.principalU);
            }
        });

        test("should handle ERC20.decimals() returning 0", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 18, false, true); // decimals() returns 0

            const assets = BigInt.fromI32(100).times(BigInt.fromI32(10).pow(18));
            const shares = BigInt.fromI32(10);
            const event = createCollectionDepositEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, assets, shares);
            const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString();
            const idBytes = Bytes.fromHexString(id);

            handleCollectionDeposit(event);

            const entity = CollectionMarket.load(idBytes);
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if decimals() returns 0
                assert.bigIntEquals(assets, entity.principalU);
            }
        });
    });

    describe("handleCollectionWithdraw", () => {
        // const initialAssets = BigInt.fromI32(200).times(BigInt.fromI32(10).pow(18)); // Moved to global WITHDRAW_INITIAL_ASSETS
        // const initialShares = BigInt.fromI32(20); // Moved to global WITHDRAW_INITIAL_SHARES
        // const id = COLLECTION_ADDRESS.concat(CTOKEN_ADDRESS).toHexString(); // Logic moved to global withdrawIdString
        // const idBytes = Bytes.fromHexString(id); // Moved to global WITHDRAW_ID_BYTES

        // Helper function setupInitialEntity is now top-level: setupWithdrawTestEntity
        // function setupInitialEntity(): void { ... } // Moved to top-level setupWithdrawTestEntity

        beforeEach(() => { 
            setupWithdrawTestEntity(); // Call the top-level setup function
        });


        test("should update an existing CollectionMarket entity on withdraw", () => {
            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);
            assert.entityCount("CollectionMarket", 1);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                assert.bigIntEquals(WITHDRAW_INITIAL_SHARES.minus(withdrawnShares), entity.totalNFT); // Use global constant
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(withdrawnAssets), entity.principalU); // Use global constant
            }
        });

        test("should handle withdraw if CollectionMarket entity does not exist (logs warning)", () => {
            clearStore(); // Ensure no entity exists for this specific test
            assert.entityCount("CollectionMarket", 0);

            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = BigInt.fromI32(5);
            // Use a different collection address to ensure a new ID
            const newCollectionAddress = Address.fromString("0x000000000000000000000000000000000000000F");
            const event = createCollectionWithdrawEvent(newCollectionAddress, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);
            // No entity should be created or modified
            assert.entityCount("CollectionMarket", 0);
            // We can't assert logs directly here, but we trust the handler logs a warning.
        });

        test("should handle underlying asset with 6 decimals on withdraw", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 6, false, false);

            const withdrawnAssets6Decimals = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(6)); // 50e6
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets6Decimals, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                const expectedWithdrawnPrincipalU = withdrawnAssets6Decimals.times(BigInt.fromI32(10).pow(12)); // 50e6 * 10e12 = 50e18
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(expectedWithdrawnPrincipalU), entity.principalU); // Use global constant
            }
        });

        test("should handle underlying asset with 20 decimals on withdraw", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 20, false, false);

            const withdrawnAssets20Decimals = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(20)); // 50e20
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets20Decimals, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                const expectedWithdrawnPrincipalU = withdrawnAssets20Decimals.div(BigInt.fromI32(10).pow(2)); // 50e20 / 10e2 = 50e18
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(expectedWithdrawnPrincipalU), entity.principalU); // Use global constant
            }
        });


        test("should handle cToken.underlying() revert on withdraw", () => {
            mockCTokenCalls(UNDERLYING_ASSET_ADDRESS, true); // underlying() reverts

            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if underlying() reverts
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(withdrawnAssets), entity.principalU); // Use global constant
            }
        });

        test("should handle ERC20.decimals() revert on withdraw", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 18, true, false); // decimals() reverts

            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if decimals() reverts
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(withdrawnAssets), entity.principalU); // Use global constant
            }
        });

        test("should handle ERC20.decimals() returning 0 on withdraw", () => {
            mockERC20Calls(UNDERLYING_ASSET_ADDRESS, 18, false, true); // decimals() returns 0

            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                // Should default to 18 decimals for assets if decimals() returns 0
                assert.bigIntEquals(WITHDRAW_INITIAL_ASSETS.minus(withdrawnAssets), entity.principalU); // Use global constant
            }
        });

        test("should reset principalU to zero if it goes negative", () => {
            const withdrawnAssets = WITHDRAW_INITIAL_ASSETS.plus(BigInt.fromI32(100)); // Withdraw more than available // Use global constant
            const withdrawnShares = BigInt.fromI32(5);
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                assert.bigIntEquals(ZERO_BI, entity.principalU);
            }
        });

        test("should reset totalNFT to zero if it goes negative", () => {
            const withdrawnAssets = BigInt.fromI32(50).times(BigInt.fromI32(10).pow(18));
            const withdrawnShares = WITHDRAW_INITIAL_SHARES.plus(BigInt.fromI32(10)); // Withdraw more shares than available // Use global constant
            const event = createCollectionWithdrawEvent(COLLECTION_ADDRESS, CALLER_ADDRESS, RECEIVER_ADDRESS, OWNER_ADDRESS, withdrawnAssets, withdrawnShares);

            handleCollectionWithdraw(event);

            const entity = CollectionMarket.load(WITHDRAW_ID_BYTES); // Use global constant
            assert.assertNotNull(entity);
            if (entity) {
                assert.bigIntEquals(ZERO_BI, entity.totalNFT);
            }
        });
    });
});

// Using the built-in newMockEvent() from matchstick-as
// function createMockEvent(): ethereum.Event { // Commented out as it's unused and causing a lint error
//     const mockEvent = newMockEvent();
//     mockEvent.address = COLLECTION_VAULT_ADDRESS;
//     mockEvent.block.timestamp = BigInt.fromI32(123);
//     mockEvent.parameters = new Array(); // Consider using []
//     return mockEvent;
// }