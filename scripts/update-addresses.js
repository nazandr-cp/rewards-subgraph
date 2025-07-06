#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Read .env file from collection-vault directory
const envPath = path.join(__dirname, '../../collection-vault/.env');
const subgraphPath = path.join(__dirname, '../subgraph.yaml');
const networksPath = path.join(__dirname, '../networks.json');

function parseEnvFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, value] = trimmed.split('=');
            if (key && value) {
                // Remove comments from value
                const cleanValue = value.split('#')[0].trim();
                env[key.trim()] = cleanValue;
            }
        }
    });
    
    return env;
}

function updateSubgraphAddresses() {
    try {
        // Parse environment variables
        const env = parseEnvFile(envPath);
        console.log('Loaded environment variables from:', envPath);
        
        // Load subgraph.yaml
        const subgraphContent = fs.readFileSync(subgraphPath, 'utf8');
        const subgraph = yaml.load(subgraphContent);
        
        // Address mappings from .env to subgraph and networks
        const addressMappings = [
            { envKey: 'COMPTROLLER_ADDRESS', dataSourceName: 'Comptroller', networkName: 'Comptroller' },
            { envKey: 'EPOCH_MANAGER_ADDRESS', dataSourceName: 'EpochManager', networkName: 'EpochManager' },
            { envKey: 'DEBT_SUBSIDIZER_PROXY_ADDRESS', dataSourceName: 'DebtSubsidizer', networkName: 'DebtSubsidizer' },
            { envKey: 'LENDING_MANAGER_ADDRESS', dataSourceName: 'LendingManager', networkName: 'LendingManager' },
            { envKey: 'NFT_ADDRESS', dataSourceName: 'ERC721Collection', networkName: 'ERC721Collection' },
            { envKey: 'COLLECTION_REGISTRY_ADDRESS', dataSourceName: 'CollectionRegistry', networkName: 'CollectionRegistry' },
            { envKey: 'VAULT_ADDRESS', dataSourceName: null, networkName: 'CollectionsVault' }
        ];
        
        let updated = false;
        
        // Load networks.json
        const networksContent = fs.readFileSync(networksPath, 'utf8');
        const networks = JSON.parse(networksContent);
        
        // Update addresses in dataSources and networks
        addressMappings.forEach(mapping => {
            const envAddress = env[mapping.envKey];
            if (!envAddress) {
                console.warn(`Warning: ${mapping.envKey} not found in .env file`);
                return;
            }
            
            // Update subgraph.yaml dataSource
            if (mapping.dataSourceName) {
                const dataSource = subgraph.dataSources.find(ds => ds.name === mapping.dataSourceName);
                if (dataSource) {
                    const oldAddress = dataSource.source.address;
                    if (oldAddress !== envAddress) {
                        console.log(`Updating ${mapping.dataSourceName}: ${oldAddress} -> ${envAddress}`);
                        dataSource.source.address = envAddress;
                        updated = true;
                    } else {
                        console.log(`${mapping.dataSourceName} already up to date: ${envAddress}`);
                    }
                } else {
                    console.warn(`Warning: DataSource ${mapping.dataSourceName} not found in subgraph.yaml`);
                }
            }
            
            // Update networks.json
            if (mapping.networkName && networks['apechain-curtis'] && networks['apechain-curtis'][mapping.networkName]) {
                const oldNetworkAddress = networks['apechain-curtis'][mapping.networkName].address;
                if (oldNetworkAddress !== envAddress) {
                    console.log(`Updating networks.json ${mapping.networkName}: ${oldNetworkAddress} -> ${envAddress}`);
                    networks['apechain-curtis'][mapping.networkName].address = envAddress;
                    updated = true;
                } else {
                    console.log(`networks.json ${mapping.networkName} already up to date: ${envAddress}`);
                }
            }
        });
        
        if (updated) {
            // Write updated subgraph.yaml
            const updatedContent = yaml.dump(subgraph, { 
                indent: 2,
                lineWidth: -1,
                quotingType: '"',
                forceQuotes: true
            });
            
            fs.writeFileSync(subgraphPath, updatedContent);
            
            // Write updated networks.json
            fs.writeFileSync(networksPath, JSON.stringify(networks, null, 2));
            
            console.log('\nSubgraph and networks addresses updated successfully!');
        } else {
            console.log('\nNo updates needed - all addresses are already correct.');
        }
        
    } catch (error) {
        console.error('Error updating subgraph addresses:', error);
        process.exit(1);
    }
}

// Run the update
updateSubgraphAddresses();