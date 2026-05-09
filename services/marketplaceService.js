const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Marketplace Service
 * Handles all marketplace interactions with the VehiclePurchased contract on 0G blockchain
 */

const MARKETPLACE_ABI = [
  "function registerAsset(bytes32 assetHash, string assetId, uint256 price) external",
  "function purchaseAsset(bytes32 assetHash, string userIdentifier) external payable",
  "function getAsset(bytes32 assetHash) view returns (string id, uint256 price, bool isActive)",
  "function getAllAssets(uint256 startIndex, uint256 pageSize) view returns (bytes32[] hashes, string[] ids, uint256[] prices, bool[] actives, uint256 totalCount)",
  "function assets(bytes32) view returns (string id, uint256 price, bool isActive, bool exists)",
  "function updatePrice(bytes32 assetHash, uint256 newPrice) external",
  "function setAssetActive(bytes32 assetHash, bool isActive) external",
  "event AssetRegistered(bytes32 indexed assetHash, string indexed assetId, uint256 price)",
  "event AssetPurchased(bytes32 indexed assetHash, string indexed userIdentifier, uint256 amount, address indexed buyer)"
];

class MarketplaceService {
  constructor() {
    this.contractAddress = process.env.MARKETPLACE_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || 'https://evmrpc.0g.ai';
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || '16661');
    this.privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!this.contractAddress) {
      throw new Error('MARKETPLACE_CONTRACT_ADDRESS not set in environment');
    }

    // Read-only provider for view functions
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl, this.chainId);

    // Signer for transactions (if private key available)
    if (this.privateKey) {
      this.signer = new ethers.Wallet(this.privateKey, this.provider);
      this.contract = new ethers.Contract(this.contractAddress, MARKETPLACE_ABI, this.signer);
    } else {
      this.readOnlyContract = new ethers.Contract(this.contractAddress, MARKETPLACE_ABI, this.provider);
    }
  }

  /**
   * Get all marketplace assets with pagination
   * @param {number} page - Page number (1-based)
   * @param {number} pageSize - Number of assets per page (max 100)
   * @returns {Promise<Object>} Assets data with pagination info
   */
  async getMarketplaceAssets(page = 1, pageSize = 10) {
    try {
      if (pageSize > 100) pageSize = 100;
      if (pageSize < 1) pageSize = 1;
      if (page < 1) page = 1;

      const startIndex = (page - 1) * pageSize;
      const contract = this.readOnlyContract || this.contract;

      const result = await contract.getAllAssets(startIndex, pageSize);
      const [hashes, ids, prices, actives, totalCount] = result;

      // Get asset images from assets.js
      const assets = require('../data/assets');
      const assetMap = new Map(assets.map(a => [a.id, a]));

      const formattedAssets = hashes.map((hash, index) => {
        const id = ids[index];
        const assetData = assetMap.get(id);
        
        return {
          hash: hash,
          id: id,
          name: assetData?.name || id,
          price: ethers.formatEther(prices[index]), // Convert wei to OG
          priceWei: prices[index].toString(),
          isActive: actives[index],
          rarity: assetData?.rarity || 'Unknown',
          imageFile: assetData?.imageFile || `${id}.png`,
          rootHash: assetData?.rootHash || null
        };
      });

      const total = Number(totalCount);
      return {
        success: true,
        assets: formattedAssets,
        pagination: {
          page,
          pageSize,
          totalAssets: total,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('Error fetching marketplace assets:', error.message);
      throw new Error(`Failed to fetch marketplace assets: ${error.message}`);
    }
  }

  /**
   * Get a specific asset by ID
   * @param {string} assetId - Asset identifier (e.g., "ctr", "f1")
   * @returns {Promise<Object>} Asset details
   */
  async getAssetById(assetId) {
    try {
      const assets = require('../data/assets');
      const asset = assets.find(a => a.id === assetId);

      if (!asset) {
        throw new Error(`Asset ${assetId} not found in data`);
      }

      const assetHash = ethers.toBeHex(asset.rootHash);
      const contract = this.readOnlyContract || this.contract;

      try {
        const [id, price, isActive] = await contract.getAsset(assetHash);
        
        return {
          success: true,
          asset: {
            id: id,
            name: asset.name,
            price: ethers.formatEther(price),
            priceWei: price.toString(),
            isActive: isActive,
            rarity: asset.rarity,
            imageFile: asset.imageFile,
            currency: asset.currency,
            rootHash: asset.rootHash,
            txHash: asset.txHash
          }
        };
      } catch (contractError) {
        // Asset not registered yet
        return {
          success: false,
          error: 'Asset not registered on contract',
          asset: {
            id: assetId,
            name: asset.name,
            price: asset.price.toString(),
            currency: asset.currency,
            rarity: asset.rarity,
            imageFile: asset.imageFile,
            rootHash: asset.rootHash
          }
        };
      }
    } catch (error) {
      console.error('Error fetching asset:', error.message);
      throw new Error(`Failed to fetch asset: ${error.message}`);
    }
  }

  /**
   * Purchase an asset (requires signer/private key)
   * @param {string} assetId - Asset identifier
   * @param {string} userIdentifier - User's unique identifier (email, wallet, discord, etc.)
   * @param {string} buyerAddress - Buyer's wallet address (for signing transaction)
   * @returns {Promise<Object>} Transaction receipt
   */
  async purchaseAsset(assetId, userIdentifier, buyerAddress) {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Backend cannot process purchases yet.');
      }

      const assets = require('../data/assets');
      const asset = assets.find(a => a.id === assetId);

      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      const assetHash = ethers.toBeHex(asset.rootHash);
      const priceInWei = ethers.parseEther(asset.price.toString());

      console.log(`Purchasing asset ${assetId} for user ${userIdentifier}`);
      console.log(`Asset hash: ${assetHash}, Price: ${ethers.formatEther(priceInWei)} OG`);

      // Call the purchase function with payment
      const tx = await this.contract.purchaseAsset(assetHash, userIdentifier, {
        value: priceInWei,
        from: buyerAddress || this.signer.address
      });

      console.log(`Purchase transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        asset: {
          id: assetId,
          name: asset.name,
          price: asset.price
        }
      };
    } catch (error) {
      console.error('Error purchasing asset:', error.message);
      throw new Error(`Failed to purchase asset: ${error.message}`);
    }
  }

  /**
   * Get all assets purchased by a user by checking hasPurchased on-chain for each asset
   * @param {string} userIdentifier - wallet address or user ID
   * @returns {Promise<Object>}
   */
  async getUserPurchases(userIdentifier) {
    try {
      // Normalize to lowercase — contract stores identifiers exactly as passed during purchase
      userIdentifier = userIdentifier.toLowerCase();
      const assets = require('../data/assets');
      const contract = this.readOnlyContract || this.contract;
      const FULL_ABI = [
        ...MARKETPLACE_ABI,
        'function hasPurchased(bytes32 assetHash, string userIdentifier) view returns (bool)',
      ];
      const fullContract = new ethers.Contract(
        this.contractAddress,
        FULL_ABI,
        this.provider,
      );

      // Try both lowercase and checksummed — old purchases may have used checksummed address
      const checksummed = ethers.getAddress(userIdentifier);
      const results = await Promise.all(
        assets.map(async (asset) => {
          try {
            const ownedLower = await fullContract.hasPurchased(asset.rootHash, userIdentifier);
            if (ownedLower) return asset.id;
            if (checksummed !== userIdentifier) {
              const ownedChecksum = await fullContract.hasPurchased(asset.rootHash, checksummed);
              if (ownedChecksum) return asset.id;
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      const ownedIds = results.filter(Boolean);
      return { success: true, purchases: ownedIds };
    } catch (error) {
      console.error('Error fetching user purchases:', error.message);
      throw new Error(`Failed to fetch user purchases: ${error.message}`);
    }
  }

  /**
   * Verify a purchase transaction on-chain and confirm the AssetPurchased event exists
   * @param {string} txHash - transaction hash from the frontend
   * @param {string} assetId - expected asset id
   * @param {string} userIdentifier - wallet address of the buyer
   * @returns {Promise<Object>}
   */
  async verifyPurchaseTx(txHash, assetId, userIdentifier) {
    try {
      const assets = require('../data/assets');
      const asset = assets.find(a => a.id === assetId);
      if (!asset) throw new Error(`Asset ${assetId} not found`);

      // Wait up to 60s for the tx to be mined — Privy may submit before chain confirms
      let receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        console.log(`[marketplace] Waiting for tx ${txHash} to be mined...`);
        receipt = await this.provider.waitForTransaction(txHash, 1, 60000);
      }
      if (!receipt) throw new Error('Transaction not found on chain after 60s');
      if (receipt.status !== 1) throw new Error('Transaction failed on chain');

      const iface = new ethers.Interface(MARKETPLACE_ABI);
      const purchaseLog = receipt.logs.find((log) => {
        try {
          const parsed = iface.parseLog(log);
          return parsed?.name === 'AssetPurchased';
        } catch {
          return false;
        }
      });

      if (!purchaseLog) throw new Error('AssetPurchased event not found in transaction');

      const parsed = iface.parseLog(purchaseLog);
      return {
        success: true,
        txHash,
        blockNumber: receipt.blockNumber,
        assetId: parsed.args.userIdentifier ? assetId : assetId,
        userIdentifier,
        amount: ethers.formatEther(parsed.args.amount),
      };
    } catch (error) {
      console.error('Error verifying purchase tx:', error.message);
      throw new Error(`Purchase verification failed: ${error.message}`);
    }
  }

  /**
   * Get total registered assets count
   * @returns {Promise<number>} Total asset count
   */
  async getTotalAssetCount() {
    try {
      const contract = this.readOnlyContract || this.contract;
      const result = await contract.getAllAssets(0, 1);
      const totalCount = result[4]; // totalCount is 5th return value
      return Number(totalCount);
    } catch (error) {
      console.error('Error fetching asset count:', error.message);
      throw new Error(`Failed to fetch asset count: ${error.message}`);
    }
  }

  /**
   * Verify if an asset is registered and active
   * @param {string} assetId - Asset identifier
   * @returns {Promise<Object>} Asset registration status
   */
  async verifyAssetRegistration(assetId) {
    try {
      const assets = require('../data/assets');
      const asset = assets.find(a => a.id === assetId);

      if (!asset) {
        return { registered: false, active: false, message: 'Asset not found in data' };
      }

      const assetHash = ethers.toBeHex(asset.rootHash);
      const contract = this.readOnlyContract || this.contract;

      try {
        const [id, price, isActive] = await contract.getAsset(assetHash);
        return {
          registered: true,
          active: isActive,
          id: id,
          price: ethers.formatEther(price),
          message: isActive ? 'Asset is registered and active' : 'Asset is registered but inactive'
        };
      } catch {
        return {
          registered: false,
          active: false,
          message: 'Asset not registered on contract'
        };
      }
    } catch (error) {
      console.error('Error verifying asset registration:', error.message);
      throw new Error(`Failed to verify asset: ${error.message}`);
    }
  }
}

module.exports = new MarketplaceService();
