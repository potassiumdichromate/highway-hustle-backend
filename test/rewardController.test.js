const test = require("node:test");
const assert = require("node:assert/strict");
const { grantReward } = require("../controllers/rewardController");
const Reward = require("../models/Reward");

function createResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test.afterEach(() => {
  delete process.env.CONTEST_REWARD_GRANT_SECRET;
  Reward.updateOne = undefined;
  Reward.findOne = undefined;
});

test("grantReward accepts the built-in fallback secret when env is not configured", async () => {
  let updateArgs;
  Reward.updateOne = async (...args) => {
    updateArgs = args;
    return { upsertedCount: 1 };
  };
  Reward.findOne = async () => ({
    rewardId: "lamborghini",
    rewardType: "vehicle",
    note: "Unlocked by Warzone",
    status: "active",
  });

  const req = {
    get(name) {
      assert.equal(name, "x-contest-grant-secret");
      return "warzone-highway-lamborghini-cross-game-v1";
    },
    body: {
      walletAddress: "0x1234567890123456789012345678901234567890",
      rewardId: "lamborghini",
      rewardType: "vehicle",
      note: "Unlocked by Warzone",
    },
  };
  const res = createResponse();

  await grantReward(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(updateArgs[0].rewardId, "lamborghini");
});
