const { ethers, network } = require("hardhat");
import fs from "fs";
import path from "path";
async function main() {
    console.log("Emitting mock events...");

    const networkName = network.name === "hardhat" ? "localhost" : network.name;
    const addressesPath = path.join(__dirname, "..", "networks.json");
    if (!fs.existsSync(addressesPath)) {
        console.error(`networks.json not found at ${addressesPath}. Deploy mocks first.`);
        process.exitCode = 1;
        return;
    }

    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    const mockRewardEmitterAddress = addresses[networkName]?.mockRewardEmitter;

    if (!mockRewardEmitterAddress) {
        console.error(`mockRewardEmitter address not found in networks.json for network ${networkName}.`);
        process.exitCode = 1;
        return;
    }

    console.log(`Using MockRewardEmitter at ${mockRewardEmitterAddress} on network ${networkName}`);

    const mockRewardEmitter: any = await ethers.getContractAt("MockRewardEmitter", mockRewardEmitterAddress);

    // Define mock data
    const [deployer, user1, user2, liquidator, payer] = await ethers.getSigners();
    const cTokenMock = ethers.Wallet.createRandom().address;
    const collectionMock = ethers.Wallet.createRandom().address;
    const cTokenCollateralMock = ethers.Wallet.createRandom().address;
    const vaultMock = ethers.Wallet.createRandom().address;

    const zeroAddress = ethers.constants.AddressZero;
    const smallAmount = ethers.utils.parseUnits("1", 18);
    const largeAmount = ethers.utils.parseUnits("1000", 18);
    const zeroAmount = ethers.constants.Zero;
    const tokenId1 = 1;
    const tokenId2 = 2;

    // --- cToken Events ---
    console.log("Emitting cToken events...");
    await (await mockRewardEmitter.emitAccrueInterest(smallAmount, ethers.utils.parseUnits("0.1", 18), ethers.utils.parseUnits("1.02", 18), largeAmount)).wait();
    await (await mockRewardEmitter.emitAccrueInterest(zeroAmount, zeroAmount, ethers.utils.parseUnits("1.02", 18), largeAmount)).wait();

    await (await mockRewardEmitter.emitBorrow(user1.address, smallAmount, smallAmount, largeAmount.add(smallAmount))).wait();
    await (await mockRewardEmitter.emitBorrow(user2.address, zeroAmount, zeroAmount, largeAmount.add(smallAmount))).wait();

    await (await mockRewardEmitter.emitLiquidateBorrow(liquidator.address, user1.address, smallAmount.div(2), cTokenCollateralMock, ethers.utils.parseUnits("50", 8))).wait();

    await (await mockRewardEmitter.emitMint(user1.address, largeAmount, ethers.utils.parseUnits("990", 8))).wait();
    await (await mockRewardEmitter.emitMint(user2.address, zeroAmount, zeroAmount)).wait();

    await (await mockRewardEmitter.emitRedeem(user1.address, ethers.utils.parseUnits("100", 8), smallAmount.div(10))).wait();
    await (await mockRewardEmitter.emitRedeem(user2.address, zeroAmount, zeroAmount)).wait();

    await (await mockRewardEmitter.emitRepayBorrow(payer.address, user1.address, smallAmount.div(4), smallAmount.mul(3).div(4), largeAmount.add(smallAmount).sub(smallAmount.div(4)))).wait();
    await (await mockRewardEmitter.emitRepayBorrow(payer.address, user2.address, zeroAmount, zeroAmount, largeAmount.add(smallAmount).sub(smallAmount.div(4)))).wait();

    await (await mockRewardEmitter.emitTransferCToken(user1.address, user2.address, smallAmount)).wait();
    await (await mockRewardEmitter.emitTransferCToken(user2.address, user1.address, zeroAmount)).wait();

    // --- CollectionVault Events ---
    console.log("Emitting CollectionVault events...");
    await (await mockRewardEmitter.emitCollectionDeposit(cTokenMock, collectionMock, user1.address, largeAmount, 5)).wait();
    await (await mockRewardEmitter.emitCollectionDeposit(cTokenMock, collectionMock, user2.address, zeroAmount, 0)).wait();

    await (await mockRewardEmitter.emitCollectionWithdraw(cTokenMock, collectionMock, user1.address, user1.address, smallAmount, 2)).wait();
    await (await mockRewardEmitter.emitCollectionWithdraw(cTokenMock, collectionMock, user2.address, user2.address, zeroAmount, 0)).wait();

    // --- RewardsController Events ---
    console.log("Emitting RewardsController events...");
    await (await mockRewardEmitter.emitNewCollectionWhitelisted(collectionMock, 0, 0, 1000)).wait();
    const collectionMock2 = ethers.Wallet.createRandom().address;
    await (await mockRewardEmitter.emitNewCollectionWhitelisted(collectionMock2, 1, 1, 500)).wait();

    await (await mockRewardEmitter.emitCollectionRewardShareUpdated(collectionMock, 1000, 1500)).wait();

    await (await mockRewardEmitter.emitWeightFunctionSet(collectionMock, { fnType: 0, p1: 1, p2: 0 })).wait();
    await (await mockRewardEmitter.emitWeightFunctionSet(collectionMock2, { fnType: 1, p1: 100, p2: 2 })).wait();

    await (await mockRewardEmitter.emitRewardsClaimedForLazy(user1.address, collectionMock, smallAmount, 1, 3600, 7200, ethers.utils.parseUnits("0.01", 18), smallAmount.div(10))).wait();
    await (await mockRewardEmitter.emitRewardsClaimedForLazy(user2.address, collectionMock, zeroAmount, 2, 0, 0, zeroAmount, zeroAmount)).wait();

    await (await mockRewardEmitter.emitBatchRewardsClaimedForLazy(deployer.address, largeAmount, 5)).wait();
    await (await mockRewardEmitter.emitBatchRewardsClaimedForLazy(deployer.address, zeroAmount, 0)).wait();

    await (await mockRewardEmitter.emitRewardPerBlockUpdated(vaultMock, ethers.utils.parseUnits("0.5", 18))).wait();
    await (await mockRewardEmitter.emitRewardPerBlockUpdated(vaultMock, zeroAmount)).wait();

    await (await mockRewardEmitter.emitRewardClaimed(vaultMock, user1.address, smallAmount)).wait();
    await (await mockRewardEmitter.emitRewardClaimed(vaultMock, user2.address, zeroAmount)).wait();

    await (await mockRewardEmitter.emitWhitelistCollectionRemoved(collectionMock2)).wait();

    // --- ERC1155 Events ---
    console.log("Emitting ERC1155 events...");
    await (await mockRewardEmitter.emitTransferSingle(deployer.address, zeroAddress, user1.address, tokenId1, 10)).wait();
    await (await mockRewardEmitter.emitTransferSingle(deployer.address, user1.address, user2.address, tokenId1, 5)).wait();
    await (await mockRewardEmitter.emitTransferSingle(deployer.address, user1.address, zeroAddress, tokenId1, 5)).wait();
    await (await mockRewardEmitter.emitTransferSingle(deployer.address, zeroAddress, user2.address, tokenId2, zeroAmount)).wait();

    await (await mockRewardEmitter.emitTransferBatch(deployer.address, zeroAddress, user1.address, [tokenId1, tokenId2], [10, 20])).wait();
    await (await mockRewardEmitter.emitTransferBatch(deployer.address, user1.address, user2.address, [tokenId1, tokenId2], [5, 5])).wait();
    await (await mockRewardEmitter.emitTransferBatch(deployer.address, user1.address, zeroAddress, [tokenId1, tokenId2], [5, 15])).wait();
    await (await mockRewardEmitter.emitTransferBatch(deployer.address, zeroAddress, user2.address, [tokenId1], [zeroAmount])).wait();

    // --- ERC721 Events ---
    console.log("Emitting ERC721 events...");
    await (await mockRewardEmitter.emitTransferERC721(zeroAddress, user1.address, tokenId1)).wait();
    await (await mockRewardEmitter.emitTransferERC721(user1.address, user2.address, tokenId1)).wait();
    await (await mockRewardEmitter.emitTransferERC721(user2.address, user1.address, tokenId2)).wait();
    await (await mockRewardEmitter.emitTransferERC721(user1.address, zeroAddress, tokenId1)).wait();
    await (await mockRewardEmitter.emitTransferERC721(user1.address, zeroAddress, tokenId2)).wait();

    console.log("All mock events emitted successfully.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});