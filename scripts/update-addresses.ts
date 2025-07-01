import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

// Contract addresses from deployment
const addresses = {
  ASSET_ADDRESS: '0x4dd42d4559f7F5026364550FABE7824AECF5a1d1',
  NFT_ADDRESS: '0xc7CfdB8290571cAA6DF7d4693059aB9E853e22EB',
  VAULT_ADDRESS: '0x4A4be724F522946296a51d8c82c7C2e8e5a62655',
  CTOKEN_ADDRESS: '0x642d97319cd50D2E5FC7F0FE022Ed87407045e90',
  COMPTROLLER_ADDRESS: '0x7E81fAaF1132A17DCc0C76b1280E0C0e598D5635',
  LENDING_MANAGER_ADDRESS: '0xb493bEE4C9E0C7d0eC57c38751c9A1c08fAfE434',
  COLLECTION_REGISTRY_ADDRESS: '0xF9fF756360fD6Aea39db9Ab2E998235Dc1F6322F',
  EPOCH_MANAGER_ADDRESS: '0x5B6dD10DD0fa3454a2749dec1dcBc9e0983620DA',
  DEBT_SUBSIDIZER_ADDRESS: '0xf45CfbC6553BA36328Aba23A4473D4b4a3F569aF'
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
      }
      
      return match; // Keep original if no match
    });

  // Write updated subgraph.yaml
  fs.writeFileSync(subgraphPath, subgraphContent);
  console.log('✅ Updated subgraph.yaml with new contract addresses');

  // Create networks.json if it doesn't exist
  const networksPath = path.join(__dirname, '../networks.json');
  const networks = {
    "apechain-curtis": {
      "Comptroller": {
        "address": addresses.COMPTROLLER_ADDRESS,
        "startBlock": 19549350
      },
      "EpochManager": {
        "address": addresses.EPOCH_MANAGER_ADDRESS,
        "startBlock": 19549350
      },
      "DebtSubsidizer": {
        "address": addresses.DEBT_SUBSIDIZER_ADDRESS,
        "startBlock": 19549350
      },
      "LendingManager": {
        "address": addresses.LENDING_MANAGER_ADDRESS,
        "startBlock": 19549350
      },
      "ERC721Collection": {
        "address": addresses.NFT_ADDRESS,
        "startBlock": 19549350
      },
      "CollectionsVault": {
        "address": addresses.VAULT_ADDRESS,
        "startBlock": 19549350
      }
    }
  };

  fs.writeFileSync(networksPath, JSON.stringify(networks, null, 2));
  console.log('✅ Created networks.json with contract addresses');

  console.log('\n📋 Updated contract addresses:');
  console.log(`   Comptroller: ${addresses.COMPTROLLER_ADDRESS}`);
  console.log(`   EpochManager: ${addresses.EPOCH_MANAGER_ADDRESS}`);
  console.log(`   DebtSubsidizer: ${addresses.DEBT_SUBSIDIZER_ADDRESS}`);
  console.log(`   LendingManager: ${addresses.LENDING_MANAGER_ADDRESS}`);
  console.log(`   NFT Collection: ${addresses.NFT_ADDRESS}`);
  console.log(`   Collections Vault: ${addresses.VAULT_ADDRESS}`);

  console.log('\n🚀 Next steps:');
  console.log('   1. Run: npm run codegen');
  console.log('   2. Run: npm run build');
  console.log('   3. Run: npm run deploy-local');
  console.log('\n   The subgraph will now use the updated contract addresses with correct weight function parameters!');
}

// Run the update
updateSubgraphConfig().catch(console.error);