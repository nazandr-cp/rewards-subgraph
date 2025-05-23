const { ethers } = require("hardhat");
import fs from "fs";
import path from "path";

async function main() {
    console.log("Deploying MockRewardEmitter contract...");

    const MockRewardEmitterFactory = await ethers.getContractFactory("MockRewardEmitter");
    const mockRewardEmitter = await MockRewardEmitterFactory.deploy();

    await mockRewardEmitter.deployed();

    console.log("MockRewardEmitter deployed to:", mockRewardEmitter.address);

    const addresses = {
        mockRewardEmitter: mockRewardEmitter.address,
    };

    const addressesPath = path.join(__dirname, "..", "networks.json");
    let existingAddresses: any = {};
    if (fs.existsSync(addressesPath)) {
        try {
            existingAddresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
        } catch (e) {
            console.warn(`Could not parse existing networks.json at ${addressesPath}, starting fresh.`);
            existingAddresses = {};
        }
    }

    if (!existingAddresses.localhost) {
        existingAddresses.localhost = {};
    }

    existingAddresses.localhost = { ...existingAddresses.localhost, ...addresses };

    fs.writeFileSync(addressesPath, JSON.stringify(existingAddresses, null, 2));
    console.log(`Deployment addresses saved to ${addressesPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});