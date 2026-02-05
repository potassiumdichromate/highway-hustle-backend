const { ethers } = require("ethers");
require("dotenv").config();

const SCORE_MANAGER_ABI = [
  "function submitScore(string memory _identifier, address _playerAddress, uint8 _gameMode, uint256 _score, uint256 _distance, uint256 _currency, uint256 _playTime) external returns (uint256)",
  "function getPlayerStats(string memory _identifier) external view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getPlayerBestScore(string memory _identifier, uint8 _gameMode) external view returns (uint256)",
  "function getPlayerRank(string memory _identifier, uint8 _gameMode) external view returns (uint256, uint256)",
  "function getLeaderboard(uint8 _gameMode, uint256 _topN) external view returns (string[] memory, uint256[] memory, uint256[] memory)",
  "function getStats() external view returns (uint256, uint256, uint256, address)"
];

const GAME_MODE_MAP = {
  "bestScoreOneWay": 0,
  "bestScoreTwoWay": 1,
  "bestScoreTimeAttack": 2,
  "bestScoreBomb": 3
};

class ScoreBlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.SCORE_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc.0g.ai";
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || "16661");
  }

  async initialize() {
    try {
      if (this.initialized) return { success: true };

      console.log("🎮 Initializing Score Manager...");

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
        chainId: this.chainId,
        name: "0G Mainnet"
      });

      this.wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);

      if (!this.contractAddress) {
        throw new Error("SCORE_CONTRACT_ADDRESS not set");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        SCORE_MANAGER_ABI,
        this.wallet
      );

      const stats = await this.contract.getStats();
      console.log(`✅ Score Manager ready - ${stats[0].toString()} submissions recorded`);

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error("❌ Score Manager init error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async submitScore(playerData, gameModeData) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;

      // Determine which score changed and submit it
      const scores = [
        { mode: 0, score: gameModeData.bestScoreOneWay || 0, name: "OneWay" },
        { mode: 1, score: gameModeData.bestScoreTwoWay || 0, name: "TwoWay" },
        { mode: 2, score: gameModeData.bestScoreTimeAttack || 0, name: "TimeAttack" },
        { mode: 3, score: gameModeData.bestScoreBomb || 0, name: "Bomb" }
      ];

      // Find the highest score to submit (or submit all)
      const bestScore = scores.reduce((prev, current) => 
        (current.score > prev.score) ? current : prev
      );

      if (bestScore.score === 0) {
        return { success: false, error: "No valid score to submit" };
      }

      console.log(`\n🏁 Submitting score on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`🎮 Mode: ${bestScore.name}`);
      console.log(`📊 Score: ${bestScore.score}`);

      const gasEstimate = await this.contract.submitScore.estimateGas(
        identifier,
        playerAddress,
        bestScore.mode,
        bestScore.score,
        0, // distance
        playerData.userGameData?.currency || 0,
        playerData.userGameData?.totalPlayedTime || 0
      );

      const tx = await this.contract.submitScore(
        identifier,
        playerAddress,
        bestScore.mode,
        bestScore.score,
        0,
        playerData.userGameData?.currency || 0,
        playerData.userGameData?.totalPlayedTime || 0,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Score submitted on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Score submission error:", error.message);
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

  async getPlayerStats(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const stats = await this.contract.getPlayerStats(identifier);
      return {
        success: true,
        stats: {
          bestScoreOneWay: stats[0].toString(),
          bestScoreTwoWay: stats[1].toString(),
          bestScoreTimeAttack: stats[2].toString(),
          bestScoreBomb: stats[3].toString(),
          totalGamesPlayed: stats[4].toString(),
          totalScore: stats[5].toString(),
          lastPlayedTime: new Date(Number(stats[6]) * 1000).toISOString()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLeaderboard(gameMode, topN) {
    try {
      if (!this.initialized) await this.initialize();
      const leaderboard = await this.contract.getLeaderboard(gameMode, topN);
      
      const entries = [];
      for (let i = 0; i < leaderboard[0].length; i++) {
        entries.push({
          identifier: leaderboard[0][i],
          score: leaderboard[1][i].toString(),
          rank: leaderboard[2][i].toString()
        });
      }

      return { success: true, leaderboard: entries };
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
        totalSubmissions: stats[0].toString(),
        totalPlayers: stats[1].toString(),
        totalSnapshots: stats[2].toString(),
        owner: stats[3]
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
        totalSubmissions: stats[0].toString(),
        totalPlayers: stats[1].toString(),
        chainId: this.chainId
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

const scoreBlockchainService = new ScoreBlockchainService();
module.exports = scoreBlockchainService;