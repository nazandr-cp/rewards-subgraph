#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load addresses from networks.json
const networksPath = path.join(__dirname, 'networks.json');
const networks = JSON.parse(fs.readFileSync(networksPath, 'utf8'));
const addresses = networks['apechain-curtis'];

console.log('🔄 Updating subgraph.yaml with new contract addresses...');

// Read current subgraph.yaml
const subgraphPath = path.join(__dirname, 'subgraph.yaml');
let subgraphContent = fs.readFileSync(subgraphPath, 'utf8');

// Update contract addresses in subgraph.yaml
const addressMappings = {
  'EpochManager': addresses.EpochManager.address,
  'DebtSubsidizer': addresses.DebtSubsidizer.address, 
  'LendingManager': addresses.LendingManager.address,
  'CollectionsVault': addresses.CollectionsVault.address,
  'CollectionRegistry': addresses.CollectionRegistry.address
};

// Replace addresses in the subgraph.yaml
for (const [contractName, newAddress] of Object.entries(addressMappings)) {
  const regex = new RegExp(`(name: ${contractName}[\\s\\S]*?address: )"0x[a-fA-F0-9]{40}"`, 'g');
  subgraphContent = subgraphContent.replace(regex, `$1"${newAddress}"`);
}

// Write updated subgraph.yaml
fs.writeFileSync(subgraphPath, subgraphContent);
console.log('✅ Updated subgraph.yaml with new contract addresses');

console.log('\n📋 Updated contract addresses:');
for (const [contractName, address] of Object.entries(addressMappings)) {
  console.log(`   ${contractName}: ${address}`);
}

console.log('\n🚀 Next steps:');
console.log('   1. Run: npm run codegen');
console.log('   2. Run: npm run build');
console.log('   3. Run: npm run deploy-local (for local) or npm run deploy (for hosted service)');
console.log('\n   The subgraph will now use the updated contract addresses!');