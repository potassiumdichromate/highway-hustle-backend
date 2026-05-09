const { ethers } = require('ethers');
require('dotenv').config();

// Contract ABI - only the functions we need
const contractABI = [
  "function registerAsset(bytes32 assetHash, string assetId, uint256 price) external",
  "function assets(bytes32) view returns (string id, uint256 price, bool isActive, bool exists)"
];

// Network configuration
const network = {
  name: '0g-mainnet',
  chainId: 16661, // 0G mainnet chainId
  rpc: process.env.ZEROG_RPC_URL || 'https://evmrpc.0g.ai'
};

// Load assets
const assets = require('../data/assets');

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  const contractAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;

  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY not set in .env');
  }
  if (!contractAddress) {
    throw new Error('MARKETPLACE_CONTRACT_ADDRESS not set in .env');
  }

  // Create provider and signer
  const provider = new ethers.JsonRpcProvider(network.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);

  console.log('Connected to contract at:', contractAddress);
  console.log('Using wallet:', wallet.address);

  for (const asset of assets) {
    const assetHash = ethers.hexlify(asset.rootHash); // Convert string to bytes32
    const assetId = asset.id;
    const priceInWei = ethers.parseEther(asset.price.toString()); // Convert OG to wei (18 decimals)

    // Check if already exists
    const existing = await contract.assets(assetHash);
    if (existing.exists) {
      console.log(`Asset ${assetId} already registered, skipping`);
      continue;
    }

    console.log(`Registering asset ${assetId} with hash ${assetHash} and price ${priceInWei} wei`);

    try {
      const tx = await contract.registerAsset(assetHash, assetId, priceInWei);
      await tx.wait();
      console.log(`✅ Registered ${assetId}`);
    } catch (error) {
      console.error(`❌ Failed to register ${assetId}:`, error.message);
    }
  }

  console.log('All assets processed');
}

main().catch(console.error);