import { clearStore, test, assert, mockFunction } from "matchstick-as";
import { Address, BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts";
import { AccrueInterest } from "../generated/cToken/cToken";
import { handleAccrueInterest } from "../src/cToken-mapping";

// Test for handleAccrueInterest function which verifies our fix for entity name issues
test("handleAccrueInterest creates CTokenMarket entity with correct name", () => {
    clearStore();

    const marketAddress = Address.fromString("0x0000000000000000000000000000000000000001");

    // Mock function calls that will be made by the handler
    mockFunction(
        marketAddress,
        "totalSupply",
        "totalSupply():(uint256)",
        [],
        [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))],
        false
    );

    mockFunction(
        marketAddress,
        "totalReserves",
        "totalReserves():(uint256)",
        [],
        [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))],
        false
    );

    mockFunction(
        marketAddress,
        "exchangeRateStored",
        "exchangeRateStored():(uint256)",
        [],
        [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200000000))],
        false
    );

    mockFunction(
        marketAddress,
        "comptroller",
        "comptroller():(address)",
        [],
        [ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000006"))],
        false
    );

    // Create mock event
    const event = new AccrueInterest(
        Address.fromString("0x0000000000000000000000000000000000000000"),
        BigInt.fromI32(1),
        marketAddress,
        new ethereum.Block(
            Bytes.fromHexString("0x1"), // hash
            Bytes.fromHexString("0x0"), // parentHash
            Bytes.fromHexString("0x0"), // unclesHash
            Address.fromString("0x0000000000000000000000000000000000000000"), // author
            Bytes.fromHexString("0x0"), // stateRoot
            Bytes.fromHexString("0x0"), // transactionsRoot
            Bytes.fromHexString("0x0"), // receiptsRoot
            BigInt.fromI32(1), // number
            BigInt.fromI32(0), // gasUsed
            BigInt.fromI32(0), // gasLimit
            BigInt.fromI32(0), // timestamp
            Bytes.fromHexString("0x0"), // extraData
            Bytes.fromHexString("0x0"), // mixHash
            BigInt.fromI32(0), // nonce
            BigInt.fromI32(1) // baseFeePerGas (optional for EIP-1559)
        ),
        new ethereum.Transaction(
            Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000"), // hash
            BigInt.fromI32(0), // index
            Address.fromString("0x0000000000000000000000000000000000000000"), // from
            Address.fromString("0x0000000000000000000000000000000000000000"), // to
            BigInt.fromI32(0), // value
            BigInt.fromI32(0), // gasLimit
            BigInt.fromI32(0), // gasPrice
            Bytes.fromHexString("0x") // input
        ),
        [],
        null
    );

    // Set event parameters
    event.parameters = [
        new ethereum.EventParam("cashPrior", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))),
        new ethereum.EventParam("interestAccumulated", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))),
        new ethereum.EventParam("borrowIndex", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1100))),
        new ethereum.EventParam("totalBorrows", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(500)))
    ];

    // Call the handler with our mock event
    handleAccrueInterest(event);

    // Verify CTokenMarket entity was created properly with the correct entity name
    const marketId = marketAddress.toHexString();

    // This test will pass only if the entity name "CTokenMarket" exactly matches what's in schema.graphql
    assert.fieldEquals("CTokenMarket", marketId, "totalBorrowsU", "500");
    assert.fieldEquals("CTokenMarket", marketId, "borrowIndex", "1100");

    // Verify MarketData entity was created properly
    const marketDataId = "MD-" + marketAddress.toHexString();
    assert.entityCount("MarketData", 1);
    assert.fieldEquals("MarketData", marketDataId, "id", marketDataId);
});
