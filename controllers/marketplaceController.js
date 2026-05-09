const marketplaceService = require('../services/marketplaceService');

/**
 * Get all marketplace assets (paginated)
 */
exports.getMarketplaceAssets = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters'
      });
    }

    const result = await marketplaceService.getMarketplaceAssets(page, pageSize);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getMarketplaceAssets:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get a specific asset by ID
 */
exports.getAssetById = async (req, res) => {
  try {
    const { assetId } = req.params;

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID is required'
      });
    }

    const result = await marketplaceService.getAssetById(assetId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error('Error in getAssetById:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Purchase an asset
 * In a real implementation, this would be called from the frontend after wallet connection
 */
exports.purchaseAsset = async (req, res) => {
  try {
    const { assetId, userIdentifier, buyerAddress } = req.body;

    // Validate inputs
    if (!assetId || !userIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'assetId and userIdentifier are required'
      });
    }

    // Validate Ethereum address format if provided
    if (buyerAddress && !/^0x[a-fA-F0-9]{40}$/.test(buyerAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }

    // For mainnet, purchases should typically be initiated by the frontend
    // This endpoint is for reference/backend-initiated purchases only
    console.log(`Purchase request: asset=${assetId}, user=${userIdentifier}`);

    // Return instructions for frontend-based purchase
    const asset = await marketplaceService.getAssetById(assetId);
    
    if (!asset.success) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found or not registered'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'For mainnet purchases, initiate transaction from frontend wallet',
      purchaseInstructions: {
        contractAddress: process.env.MARKETPLACE_CONTRACT_ADDRESS,
        assetId: assetId,
        priceOG: asset.asset.priceWei,
        userIdentifier: userIdentifier,
        method: 'purchaseAsset(bytes32 assetHash, string userIdentifier)',
        note: 'Frontend must sign and submit transaction through connected wallet'
      },
      asset: asset.asset
    });
  } catch (error) {
    console.error('Error in purchaseAsset:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get user's purchase history
 */
exports.getUserPurchases = async (req, res) => {
  try {
    const { userIdentifier } = req.params;

    if (!userIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'User identifier is required'
      });
    }

    const result = await marketplaceService.getUserPurchases(userIdentifier);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getUserPurchases:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get total asset count
 */
exports.getAssetCount = async (req, res) => {
  try {
    const count = await marketplaceService.getTotalAssetCount();
    return res.status(200).json({
      success: true,
      totalAssets: count
    });
  } catch (error) {
    console.error('Error in getAssetCount:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Verify asset registration status
 */
exports.verifyAssetRegistration = async (req, res) => {
  try {
    const { assetId } = req.params;

    if (!assetId) {
      return res.status(400).json({
        success: false,
        error: 'Asset ID is required'
      });
    }

    const result = await marketplaceService.verifyAssetRegistration(assetId);
    return res.status(200).json({
      success: true,
      verification: result
    });
  } catch (error) {
    console.error('Error in verifyAssetRegistration:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Verify a purchase transaction on-chain
 * Body: { txHash, assetId, userIdentifier }
 */
exports.verifyPurchase = async (req, res) => {
  try {
    const { txHash, assetId, userIdentifier } = req.body;
    if (!txHash || !assetId || !userIdentifier) {
      return res.status(400).json({ success: false, error: 'txHash, assetId and userIdentifier are required' });
    }
    const result = await marketplaceService.verifyPurchaseTx(txHash, assetId, userIdentifier);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in verifyPurchase:', error.message);
    return res.status(400).json({ success: false, error: error.message });
  }
};

/**
 * Get marketplace stats
 */
exports.getMarketplaceStats = async (req, res) => {
  try {
    const count = await marketplaceService.getTotalAssetCount();
    
    // Get all assets for additional stats
    const assetsResult = await marketplaceService.getMarketplaceAssets(1, 100);
    const allAssets = assetsResult.assets;

    const activeAssets = allAssets.filter(a => a.isActive).length;
    const averagePrice = allAssets.length > 0 
      ? (allAssets.reduce((sum, a) => sum + parseFloat(a.price), 0) / allAssets.length).toFixed(2)
      : 0;
    const maxPrice = allAssets.length > 0
      ? Math.max(...allAssets.map(a => parseFloat(a.price))).toFixed(2)
      : 0;
    const minPrice = allAssets.length > 0
      ? Math.min(...allAssets.map(a => parseFloat(a.price))).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalAssets: count,
        activeAssets: activeAssets,
        inactiveAssets: count - activeAssets,
        averagePriceOG: averagePrice,
        maxPriceOG: maxPrice,
        minPriceOG: minPrice
      }
    });
  } catch (error) {
    console.error('Error in getMarketplaceStats:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
