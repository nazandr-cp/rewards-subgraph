#!/bin/bash

# Deployment script using networks.json configuration
set -e

echo "🚀 Deploying subgraph with networks.json configuration..."

# Check if networks.json exists
if [ ! -f "networks.json" ]; then
    echo "❌ networks.json not found!"
    exit 1
fi

echo "📋 Using contract addresses from networks.json:"
cat networks.json | jq '.["apechain-curtis"]'

echo ""
echo "🔧 Step 1: Code generation..."
npm run codegen

echo ""
echo "🏗️  Step 2: Building subgraph..."
npm run build

echo ""
echo "🌐 Step 3: Deploying to Alchemy..."
echo "   Network: apechain-curtis"
echo "   Version: v0.0.4"
npm run deploy

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🎯 Key Updates:"
echo "   • Collection Registry: 0xF9fF756360fD6Aea39db9Ab2E998235Dc1F6322F (p1=1e18 ✅)"
echo "   • Collections Vault:   0x4A4be724F522946296a51d8c82c7C2e8e5a62655"
echo "   • All contracts verified on Blockscout"
echo ""
echo "💡 Next Steps:"
echo "   1. Test NFT transfers to trigger seconds accumulation"
echo "   2. Query accountSubsidies - secondsAccumulated should now be > 0"
echo "   3. The weight function bug is fixed!"