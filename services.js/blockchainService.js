const { ethers } = require("ethers");
require("dotenv").config();

// ========== CONTRACT ABI ==========
const SESSION_TRACKER_ABI = [
  "function recordSession(string memory _identifier, address _playerAddress, string memory _sessionType, uint256 _currency, uint256 _bestScore) external returns (uint256)",
  "function getPlayerSessionCount(string memory _identifier) external view returns (uint256)",
  "function getPlayerSessionIds(string memory _identifier) external view returns (uint256[] memory)",
  "function getSession(uint256 _sessionId) external view returns (address playerAddress, string identifier, uint256 timestamp, string sessionType, uint256 currency, uint256 bestScore)",
  "function getLastSessionTime(string memory _identifier) external view returns (uint256)",
  "function hasPlayed(string memory _identifier) external view returns (bool)",
  "function getStats() external view returns (uint256 _totalSessions, uint256 _totalUniquePlayers, address _owner)",
  "event SessionRecorded(uint256 indexed sessionId, string indexed identifier, address playerAddress, string sessionType, uint256 timestamp)",
  "event NewPlayerRegistered(string indexed identifier, uint256 timestamp)"
];

class BlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.SESSION_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc-mainnet.0g.ai";
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || "16600");
  }

  // ========== INITIALIZATION ==========
  async initialize() {
    try {
      if (this.initialized) {
        return { success: true, message: "Already initialized" };
      }

      console.log("🔗 Initializing 0G Blockchain Connection...");
      console.log(`📡 RPC URL: ${this.rpcUrl}`);
      console.log(`⛓️  Chain ID: ${this.chainId}`);

      // Setup provider
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
        chainId: this.chainId,
        name: "0G Mainnet"
      });

      // Verify connection
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

      // Setup wallet
      if (!process.env.DEPLOYER_PRIVATE_KEY) {
        throw new Error("DEPLOYER_PRIVATE_KEY not found in environment variables");
      }

      this.wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`👛 Deployer Wallet: ${this.wallet.address}`);
      console.log(`💰 Balance: ${ethers.formatEther(balance)} 0G`);

      if (balance === 0n) {
        console.warn("⚠️  Warning: Deployer wallet has 0 balance. Transactions will fail!");
      }

      // Setup contract
      if (!this.contractAddress) {
        throw new Error("SESSION_CONTRACT_ADDRESS not found in environment variables");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        SESSION_TRACKER_ABI,
        this.wallet
      );

      // Verify contract
      const stats = await this.contract.getStats();
      console.log(`📊 Contract Stats - Sessions: ${stats[0]}, Players: ${stats[1]}`);

      this.initialized = true;
      console.log("✅ 0G Blockchain Service Initialized Successfully!\n");

      return { success: true, message: "Blockchain service initialized" };
    } catch (error) {
      console.error("❌ Blockchain Initialization Error:", error.message);
      return { success: false, error: error.message };
    }
  }

  // ========== SESSION RECORDING ==========
  async recordSession(playerData, sessionType = "all") {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          throw new Error(`Initialization failed: ${initResult.error}`);
        }
      }

      // Extract data
      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;
      const currency = playerData.userGameData?.currency || 0;
      const bestScore = this.calculateBestScore(playerData.playerGameModeData);

      console.log(`\n🔗 Recording session on 0G blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`📊 Type: ${sessionType}`);
      console.log(`💰 Currency: ${currency}`);
      console.log(`🏆 Best Score: ${bestScore}`);

      // Estimate gas
      const gasEstimate = await this.contract.recordSession.estimateGas(
        identifier,
        playerAddress,
        sessionType,
        currency,
        bestScore
      );

      console.log(`⛽ Estimated Gas: ${gasEstimate.toString()}`);

      // Send transaction
      const tx = await this.contract.recordSession(
        identifier,
        playerAddress,
        sessionType,
        currency,
        bestScore,
        {
          gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
        }
      );

      console.log(`📤 Transaction sent: ${tx.hash}`);
      console.log(`⏳ Waiting for confirmation...`);

      // Wait for confirmation
      const receipt = await tx.wait();

      console.log(`✅ Session recorded on blockchain!`);
      console.log(`🔗 Transaction Hash: ${receipt.hash}`);
      console.log(`📦 Block Number: ${receipt.blockNumber}`);
      console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}\n`);

      // Extract session ID from event
      let sessionId = null;
      if (receipt.logs && receipt.logs.length > 0) {
        try {
          const log = this.contract.interface.parseLog(receipt.logs[0]);
          if (log && log.name === "SessionRecorded") {
            sessionId = log.args[0].toString();
          }
        } catch (e) {
          console.log("Could not parse session ID from event");
        }
      }

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        sessionId: sessionId
      };
    } catch (error) {
      console.error("❌ Blockchain Recording Error:", error.message);
      
      // Don't fail the API call if blockchain fails
      return {
        success: false,
        error: error.message,
        note: "Session not recorded on blockchain but API continued"
      };
    }
  }

  // ========== HELPER FUNCTIONS ==========
  extractIdentifier(playerData) {
    return (
      playerData.privyData?.walletAddress ||
      playerData.privyData?.email ||
      playerData.privyData?.discord ||
      playerData.privyData?.telegram ||
      "unknown"
    );
  }

  calculateBestScore(gameModeData) {
    if (!gameModeData) return 0;
    return Math.max(
      gameModeData.bestScoreOneWay || 0,
      gameModeData.bestScoreTwoWay || 0,
      gameModeData.bestScoreTimeAttack || 0,
      gameModeData.bestScoreBomb || 0
    );
  }

  // ========== VIEW FUNCTIONS ==========
  async getPlayerSessions(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      
      const sessionIds = await this.contract.getPlayerSessionIds(identifier);
      const sessions = [];

      for (const id of sessionIds) {
        const session = await this.contract.getSession(id);
        sessions.push({
          sessionId: id.toString(),
          playerAddress: session.playerAddress,
          identifier: session.identifier,
          timestamp: new Date(Number(session.timestamp) * 1000).toISOString(),
          sessionType: session.sessionType,
          currency: session.currency.toString(),
          bestScore: session.bestScore.toString()
        });
      }

      return { success: true, sessions };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPlayerSessionCount(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const count = await this.contract.getPlayerSessionCount(identifier);
      return { success: true, count: count.toString() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getContractStats() {
    try {
      if (!this.initialized) await this.initialize();
      const stats = await this.contract.getStats();
      return {
        success: true,
        totalSessions: stats[0].toString(),
        totalUniquePlayers: stats[1].toString(),
        owner: stats[2]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLastSessionTime(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      const timestamp = await this.contract.getLastSessionTime(identifier);
      return {
        success: true,
        timestamp: new Date(Number(timestamp) * 1000).toISOString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ========== HEALTH CHECK ==========
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
        totalSessions: stats[0].toString(),
        totalPlayers: stats[1].toString(),
        chainId: this.chainId
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

// ========== SINGLETON INSTANCE ==========
const blockchainService = new BlockchainService();

module.exports = blockchainService;