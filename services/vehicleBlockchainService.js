const { ethers } = require("ethers");
require("dotenv").config();

const VEHICLE_MANAGER_ABI = [
  "function purchaseVehicle(string memory _identifier, address _playerAddress, uint8 _vehicleType, uint256 _purchasePrice) external returns (uint256)",
  "function switchVehicle(string memory _identifier, address _playerAddress, uint8 _newVehicle) external returns (uint256)",
  "function getPlayerVehicles(string memory _identifier) external view returns (bool[5] memory)",
  "function getSelectedVehicle(string memory _identifier) external view returns (uint8)",
  "function getPlayerPurchaseIds(string memory _identifier) external view returns (uint256[] memory)",
  "function getPlayerSwitchIds(string memory _identifier) external view returns (uint256[] memory)",
  "function getPurchase(uint256 _purchaseId) external view returns (address, string, uint8, uint256, uint256)",
  "function getSwitch(uint256 _switchId) external view returns (address, string, uint8, uint8, uint256)",
  "function getPlayerSwitchCount(string memory _identifier) external view returns (uint256)",
  "function getStats() external view returns (uint256, uint256, uint256, address)"
];

const VEHICLE_TYPES = {
  0: "Jeep",
  1: "Van",
  2: "Sierra",
  3: "Sedan",
  4: "Lamborghini"
};

const VEHICLE_NAME_TO_INDEX = {
  "Jeep": 0,
  "Van": 1,
  "Sierra": 2,
  "Sedan": 3,
  "Lamborghini": 4
};

class VehicleBlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.contractAddress = process.env.VEHICLE_CONTRACT_ADDRESS;
    this.rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc.0g.ai";
    this.chainId = parseInt(process.env.ZEROG_CHAIN_ID || "16661");
  }

  async initialize() {
    try {
      if (this.initialized) return { success: true };

      console.log("🚗 Initializing Vehicle Manager...");

      this.provider = new ethers.JsonRpcProvider(this.rpcUrl, {
        chainId: this.chainId,
        name: "0G Mainnet"
      });

      this.wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, this.provider);

      if (!this.contractAddress) {
        throw new Error("VEHICLE_CONTRACT_ADDRESS not set");
      }

      this.contract = new ethers.Contract(
        this.contractAddress,
        VEHICLE_MANAGER_ABI,
        this.wallet
      );

      const stats = await this.contract.getStats();
      console.log(`✅ Vehicle Manager ready - ${stats[1].toString()} switches recorded`);

      this.initialized = true;
      return { success: true };
    } catch (error) {
      console.error("❌ Vehicle Manager init error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async switchVehicle(playerData, newVehicleIndex) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;
      
      console.log(`\n🔄 Switching vehicle on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`🚗 New Vehicle: ${VEHICLE_TYPES[newVehicleIndex]}`);

      const gasEstimate = await this.contract.switchVehicle.estimateGas(
        identifier,
        playerAddress,
        newVehicleIndex
      );

      const tx = await this.contract.switchVehicle(
        identifier,
        playerAddress,
        newVehicleIndex,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Vehicle switched on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Switch error:", error.message);
      return { success: false, error: error.message };
    }
  }

  async purchaseVehicle(playerData, vehicleName, purchasePrice) {
    try {
      if (!this.initialized) {
        const initResult = await this.initialize();
        if (!initResult.success) throw new Error(initResult.error);
      }

      const identifier = this.extractIdentifier(playerData);
      const playerAddress = playerData.privyData?.walletAddress || ethers.ZeroAddress;
      const vehicleIndex = VEHICLE_NAME_TO_INDEX[vehicleName];

      console.log(`\n💰 Recording vehicle purchase on blockchain...`);
      console.log(`👤 Player: ${identifier}`);
      console.log(`🚗 Vehicle: ${vehicleName}`);
      console.log(`💵 Price: ${purchasePrice}`);

      const gasEstimate = await this.contract.purchaseVehicle.estimateGas(
        identifier,
        playerAddress,
        vehicleIndex,
        purchasePrice
      );

      const tx = await this.contract.purchaseVehicle(
        identifier,
        playerAddress,
        vehicleIndex,
        purchasePrice,
        { gasLimit: gasEstimate * 120n / 100n }
      );

      console.log(`📤 TX: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`✅ Purchase recorded on-chain!`);
      console.log(`🔗 TX Hash: ${receipt.hash}\n`);

      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error("❌ Purchase error:", error.message);
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

  async getPlayerVehicles(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      
      const vehicles = await this.contract.getPlayerVehicles(identifier);
      return {
        success: true,
        vehicles: {
          Jeep: vehicles[0],
          Van: vehicles[1],
          Sierra: vehicles[2],
          Sedan: vehicles[3],
          Lamborghini: vehicles[4]
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getPlayerSwitchHistory(identifier) {
    try {
      if (!this.initialized) await this.initialize();
      
      const switchIds = await this.contract.getPlayerSwitchIds(identifier);
      const switches = [];

      for (const id of switchIds) {
        const sw = await this.contract.getSwitch(id);
        switches.push({
          switchId: id.toString(),
          playerAddress: sw[0],
          identifier: sw[1],
          fromVehicle: VEHICLE_TYPES[sw[2]],
          toVehicle: VEHICLE_TYPES[sw[3]],
          timestamp: new Date(Number(sw[4]) * 1000).toISOString()
        });
      }

      return { success: true, switches };
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
        totalPurchases: stats[0].toString(),
        totalSwitches: stats[1].toString(),
        totalPlayers: stats[2].toString(),
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
        totalPurchases: stats[0].toString(),
        totalSwitches: stats[1].toString(),
        totalPlayers: stats[2].toString(),
        chainId: this.chainId
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

const vehicleBlockchainService = new VehicleBlockchainService();
module.exports = vehicleBlockchainService;