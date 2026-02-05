const { ethers } = require("ethers");
require("dotenv").config();

const ECONOMY_MANAGER_ABI = [
  "function recordTransaction(string memory _identifier, address _playerAddress, uint8 _transactionType, int256 _amount, string memory _description) external returns (uint256)",
  "function claimDailyReward(string memory _identifier, address _playerAddress) external returns (uint256, uint256)",
  "function updateBalance(string memory _identifier, address _playerAddress, uint256 _newBalance, string memory _reason) external",
  "function getPlayerEconomy(string memory _identifier) external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getBalance(string memory _identifier) external view returns (uint256)",
  "function getDailyStreak(string memory _identifier) external view returns (uint256, uint256, uint256, uint256, bool)",
  "function getStats() external view returns (uint256, uint256, uint256, uint256, address)"
];

const TRANSACTION_TYPES = {
  "GameEarning": 0,
  "VehiclePurchase": 1,
  "MissionReward": 2,
  "AchievementReward": 3,
  "DailyReward": 4,
  "WeeklyReward": 5,
  "ReferralBonus": 6,
  "AdminGrant": 7,
  "Other": 8
};

class EconomyBlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.ECONOMY_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc.0g.ai";
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || "16661");
  }

  async initialize() {
    try {
      if (this.initialized) return { success: true };

      console.log("💰 Initializing Economy Manager...");

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
        chainId: this.chainId,
        name: "0G Mainnet"
      });

      this.wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);

      if (!this.contractAddress) {
        throw new Error("ECONOMY_CONTRACT_ADDRESS not set");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        ECONOMY_MANAGER_ABI,
        this.wallet
      );

      const stats = await this.contract.getStats();
      console.log(`✅ Economy Manager ready - ${stats[0].toString()} transactions recorded`);

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error("❌ Economy Manager init error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async recordTransaction(playerData, transactionType, amount, description) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;
      const typeIndex = TRANSACTION_TYPES[transactionType] || 8;

      console.log(`\n💸 Recording transaction on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`📝 Type: ${transactionType}`);
      console.log(`💰 Amount: ${amount}`);

      const gasEstimate = await this.contract.recordTransaction.estimateGas(
        identifier,
        playerAddress,
        typeIndex,
        amount,
        description
      );

      const tx = await this.contract.recordTransaction(
        identifier,
        playerAddress,
        typeIndex,
        amount,
        description,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Transaction recorded on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Transaction recording error:", error.message);
      return { success: false, error: error.message };
    }
  }

  extractIdentifier(playerData) {
    return (
      playerData.privyData?.walletAddress ||
      playerData.privyData?.email ||
      playerData.privyData?.discord ||
      playerData.privyData?.telegram ||
      "unknown"
    );
  }

  async getPlayerEconomy(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const economy = await this.contract.getPlayerEconomy(identifier);
      return {
        success: true,
        economy: {
          totalEarned: economy[0].toString(),
          totalSpent: economy[1].toString(),
          currentBalance: economy[2].toString(),
          lastWeekBalance: economy[3].toString(),
          lifetimeBalance: economy[4].toString(),
          transactionCount: economy[5].toString()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getDailyStreak(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const streak = await this.contract.getDailyStreak(identifier);
      return {
        success: true,
        streak: {
          currentStreak: streak[0].toString(),
          longestStreak: streak[1].toString(),
          lastClaimDate: streak[2].toString(),
          totalClaims: streak[3].toString(),
          canClaimToday: streak[4]
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getStats() {
    try {
      if (!this.initialized) await this.initialize();
      const stats = await this.contract.getStats();
      return {
        success: true,
        totalTransactions: stats[0].toString(),
        totalRewardsClaimed: stats[1].toString(),
        totalPlayers: stats[2].toString(),
        totalCurrencyCirculation: stats[3].toString(),
        owner: stats[4]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async healthCheck() {
    try {
      if (!this.initialized) {
        return { healthy: false, error: "Not initialized" };
      }

      const balance = await this.provider.getBalance(this.wallet.address);
      const stats = await this.contract.getStats();

      return {
        healthy: true,
        wallet: this.wallet.address,
        balance: ethers.formatEther(balance),
        contractAddress: this.contractAddress,
        totalTransactions: stats[0].toString(),
        totalPlayers: stats[2].toString(),
        chainId: this.chainId
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

const economyBlockchainService = new EconomyBlockchainService();
module.exports = economyBlockchainService;