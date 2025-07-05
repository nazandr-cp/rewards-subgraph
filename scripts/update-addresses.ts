import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

// Contract addresses from deployment
// Generated automatically from deployment config
// DO NOT EDIT MANUALLY - Use deployment-config/tools/generate-subgraph-config.js
const addresses = {
  "ASSET_ADDRESS": "0x0000000000000000000000000000000000000000",
  "NFT_ADDRESS": "0x0000000000000000000000000000000000000000",
  "VAULT_ADDRESS": "0xf82c7d08e65b74bf926552726305ff9ff0b0f700",
  "CTOKEN_ADDRESS": "0x0000000000000000000000000000000000000000",
  "COMPTROLLER_ADDRESS": "0x0000000000000000000000000000000000000000",
  "LENDING_MANAGER_ADDRESS": "0x64bd8c3294956e039edf1a4058b6588de3731248",
  "COLLECTION_REGISTRY_ADDRESS": "0xfbbd2da1e36354c39d4849a1ba6934dd4f8ad5ff",
  "EPOCH_MANAGER_ADDRESS": "0xa75103e59ced5c25d871a870a1584ff6772e343c",
  "DEBT_SUBSIDIZER_ADDRESS": "0xc1fe1a63fae123795be2ee4af4b12dab947c2e00"
};

async function updateSubgraphConfig() {
  console.log('🔄 Updating subgraph configuration with new contract addresses...');

  // Read current subgraph.yaml
  const subgraphPath = path.join(__dirname, '../subgraph.yaml');
  let subgraphContent = fs.readFileSync(subgraphPath, 'utf8');

  // Update contract addresses in subgraph.yaml
  subgraphContent = subgraphContent
    .replace(/address: "0x[a-fA-F0-9]{40}"/g, (match, offset) => {
      const lines = subgraphContent.substring(0, offset).split('\n');
      const currentLine = lines[lines.length - 1];
      
      if (currentLine.includes('Comptroller')) {
        return `address: "${addresses.COMPTROLLER_ADDRESS}"`;
      } else if (currentLine.includes('EpochManager')) {
        return `address: "${addresses.EPOCH_MANAGER_ADDRESS}"`;
      } else if (currentLine.includes('DebtSubsidizer')) {
        return `address: "${addresses.DEBT_SUBSIDIZER_ADDRESS}"`;
      } else if (currentLine.includes('LendingManager')) {
        return `address: "${addresses.LENDING_MANAGER_ADDRESS}"`;
      } else if (currentLine.includes('ERC721Collection')) {
        return `address: "${addresses.NFT_ADDRESS}"`;
      } else if (currentLine.includes('CollectionsVault')) {
        return `address: "${addresses.VAULT_ADDRESS}"`;
      } else if (currentLine.includes('CollectionRegistry')) {
        return `address: "${addresses.COLLECTION_REGISTRY_ADDRESS}"`;
      }
      
      return match; // Keep original if no match
    });

  // Write updated subgraph.yaml
  fs.writeFileSync(subgraphPath, subgraphContent);
  console.log('✅ Updated subgraph.yaml with new contract addresses');

  console.log('\n📋 Updated contract addresses:');
  console.log(`   Comptroller: ${addresses.COMPTROLLER_ADDRESS}`);
  console.log(`   EpochManager: ${addresses.EPOCH_MANAGER_ADDRESS}`);
  console.log(`   DebtSubsidizer: ${addresses.DEBT_SUBSIDIZER_ADDRESS}`);
  console.log(`   LendingManager: ${addresses.LENDING_MANAGER_ADDRESS}`);
  console.log(`   NFT Collection: ${addresses.NFT_ADDRESS}`);
  console.log(`   Collections Vault: ${addresses.VAULT_ADDRESS}`);
  console.log(`   Collection Registry: ${addresses.COLLECTION_REGISTRY_ADDRESS}`);

  console.log('\n🚀 Next steps:');
  console.log('   1. Run: npm run codegen');
  console.log('   2. Run: npm run build');
  console.log('   3. Run: npm run deploy-local');
  console.log('\n   The subgraph will now use the updated contract addresses!');
}

// Run the update
updateSubgraphConfig().catch(console.error);
