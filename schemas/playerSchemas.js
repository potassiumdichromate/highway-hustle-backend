const Joi = require("joi");

const wallet = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/);
const optionalUser = Joi.string().min(2);

const loginBody = Joi.object({
  identifier: Joi.string().min(2).optional(),
  walletAddress: wallet.optional(),
  homeWalletAddress: wallet.optional(),
  privyMetaData: Joi.object({
    address: wallet.optional(),
    walletAddress: wallet.optional(),
    email: Joi.string().email().optional(),
    discord: Joi.string().optional(),
    discordId: Joi.string().optional(),
    telegram: Joi.string().optional(),
    providerName: Joi.string().optional(),
    chainId: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    type: Joi.string().optional(),
    privyUserId: Joi.string().optional(),
  }).optional(),
}).unknown(true);

const autoLoginBody = Joi.object({
  jwt: Joi.string().min(10).required(),
  source: Joi.string().valid("browser").required(),
  privyMetaData: Joi.object().optional(),
}).unknown(true);

const userQuery = Joi.object({
  user: optionalUser.optional(),
  address: optionalUser.optional(),
}).unknown(true);

const updateAllBody = Joi.object({
  privyData: Joi.object().optional(),
  userGameData: Joi.object().optional(),
  playerGameModeData: Joi.object().optional(),
  playerVehicleData: Joi.object().optional(),
  campaignData: Joi.object().optional(),
}).min(1).unknown(true);

const updateObjectBody = Joi.object().min(1).unknown(true);

const aiCommentPingBody = Joi.object({
  leaderboardType: Joi.string().valid("global", "gate").optional(),
  currentPlayer: Joi.object().required(),
  topPlayer: Joi.object().required(),
}).unknown(true);

module.exports = {
  loginBody,
  autoLoginBody,
  userQuery,
  updateAllBody,
  updateObjectBody,
  aiCommentPingBody,
};
