const { ethers } = require("ethers");
require("dotenv").config();

const MISSION_MANAGER_ABI = [
  "function createMission(string memory _missionId, string memory _name, string memory _description, uint8 _missionType, uint256 _targetValue, uint256 _rewardAmount) external returns (bool)",
  "function updateMissionProgress(string memory _identifier, address _playerAddress, string memory _missionId, uint256 _currentProgress) external returns (bool)",
  "function completeMission(string memory _identifier, address _playerAddress, string memory _missionId, uint256 _completedValue) external returns (uint256)",
  "function unlockAchievement(string memory _identifier, address _playerAddress, string memory _achievementId) external returns (bool)",
  "function batchUnlockAchievements(string memory _identifier, address _playerAddress, string[] memory _achievementIds) external returns (bool)",
  "function getPlayerMissions(string memory _identifier) external view returns (string[] memory)",
  "function getPlayerAchievements(string memory _identifier) external view returns (string[] memory)",
  "function playerHasAchievement(string memory _identifier, string memory _achievementId) external view returns (bool)",
  "function getPlayerCompletedMissionCount(string memory _identifier) external view returns (uint256)",
  "function getPlayerAchievementCount(string memory _identifier) external view returns (uint256)",
  "function getStats() external view returns (uint256, uint256, uint256, uint256, address)"
];

class MissionBlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.MISSION_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc.0g.ai";
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || "16661");
  }

  async initialize() {
    try {
      if (this.initialized) return { success: true };

      console.log("🎯 Initializing Mission Manager...");

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
        chainId: this.chainId,
        name: "0G Mainnet"
      });

      this.wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);

      if (!this.contractAddress) {
        throw new Error("MISSION_CONTRACT_ADDRESS not set");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        MISSION_MANAGER_ABI,
        this.wallet
      );

      const stats = await this.contract.getStats();
      console.log(`✅ Mission Manager ready - ${stats[2].toString()} achievements available`);

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error("❌ Mission Manager init error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async unlockAchievement(playerData, achievementId) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;

      console.log(`\n🏆 Unlocking achievement on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`🎖️ Achievement: ${achievementId}`);

      const gasEstimate = await this.contract.unlockAchievement.estimateGas(
        identifier,
        playerAddress,
        achievementId
      );

      const tx = await this.contract.unlockAchievement(
        identifier,
        playerAddress,
        achievementId,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Achievement unlocked on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Achievement unlock error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async completeMission(playerData, missionId, completedValue) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;

      console.log(`\n✅ Completing mission on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`🎯 Mission: ${missionId}`);
      console.log(`📊 Value: ${completedValue}`);

      const gasEstimate = await this.contract.completeMission.estimateGas(
        identifier,
        playerAddress,
        missionId,
        completedValue
      );

      const tx = await this.contract.completeMission(
        identifier,
        playerAddress,
        missionId,
        completedValue,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Mission completed on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Mission completion error:", error.message);
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

  async getPlayerAchievements(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const achievements = await this.contract.getPlayerAchievements(identifier);
      return { success: true, achievements };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async hasAchievement(identifier, achievementId) {
    try {
      if (!this.initialized) await this.initialize();
      const has = await this.contract.playerHasAchievement(identifier, achievementId);
      return { success: true, hasAchievement: has };
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
        totalMissions: stats[0].toString(),
        totalCompletions: stats[1].toString(),
        totalAchievements: stats[2].toString(),
        totalPlayers: stats[3].toString(),
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
        totalMissions: stats[0].toString(),
        totalCompletions: stats[1].toString(),
        totalAchievements: stats[2].toString(),
        totalPlayers: stats[3].toString(),
        chainId: this.chainId
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

const missionBlockchainService = new MissionBlockchainService();
module.exports = missionBlockchainService;