const express = require('express');
const router = express.Router();
const {
  getMarketplaceAssets,
  getAssetById,
  purchaseAsset,
  getUserPurchases,
  getAssetCount,
  verifyAssetRegistration,
  verifyPurchase,
  getMarketplaceStats
} = require('../controllers/marketplaceController');

/**
 * GET /api/marketplace/assets
 * Get all marketplace assets with pagination
 * Query params: page (default 1), pageSize (default 10, max 100)
 */
router.get('/assets', getMarketplaceAssets);

/**
 * GET /api/marketplace/assets/:assetId
 * Get a specific asset by ID
 */
router.get('/assets/:assetId', getAssetById);

/**
 * POST /api/marketplace/purchase
 * Initiate asset purchase (frontend-based for mainnet)
 * Body: { assetId, userIdentifier, buyerAddress }
 */
router.post('/purchase', purchaseAsset);

/**
 * POST /api/marketplace/purchase/verify
 * Verify a completed on-chain purchase transaction
 * Body: { txHash, assetId, userIdentifier }
 */
router.post('/purchase/verify', verifyPurchase);

/**
 * GET /api/marketplace/user/:userIdentifier/purchases
 * Get user's purchase history
 */
router.get('/user/:userIdentifier/purchases', getUserPurchases);

/**
 * GET /api/marketplace/count
 * Get total number of registered assets
 */
router.get('/count', getAssetCount);

/**
 * GET /api/marketplace/verify/:assetId
 * Verify if an asset is registered and active
 */
router.get('/verify/:assetId', verifyAssetRegistration);

/**
 * GET /api/marketplace/stats
 * Get marketplace statistics
 */
router.get('/stats', getMarketplaceStats);

module.exports = router;
