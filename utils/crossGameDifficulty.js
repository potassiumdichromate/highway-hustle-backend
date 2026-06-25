const DIFFICULTY = Object.freeze({
  NONE: 'none',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
});

const CROSS_GAME_THRESHOLDS = Object.freeze({
  highwayHustle: Object.freeze({
    label: 'Highway Hustle',
    metric: 'points',
    freePoints: 20000,
    thresholds: Object.freeze({ easy: 22000, medium: 25000, hard: 30001 }),
  }),
});

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function classifyAtLeast(value, thresholds) {
  const score = toFiniteNumber(value);
  if (score === null) return DIFFICULTY.NONE;
  if (score >= thresholds.hard) return DIFFICULTY.HARD;
  if (score >= thresholds.medium) return DIFFICULTY.MEDIUM;
  if (score >= thresholds.easy) return DIFFICULTY.EASY;
  return DIFFICULTY.NONE;
}

function classifyCrossGamePerformance(gameKey, value) {
  const config = CROSS_GAME_THRESHOLDS[gameKey];
  if (!config) {
    throw new Error(`Unknown cross-game key: ${gameKey}`);
  }

  return {
    gameKey,
    game: config.label,
    metric: config.metric,
    value: toFiniteNumber(value) ?? 0,
    difficulty: classifyAtLeast(value, config.thresholds),
    thresholds: config.thresholds,
    ...(config.freePoints !== undefined ? { freePoints: config.freePoints } : {}),
  };
}

module.exports = {
  CROSS_GAME_THRESHOLDS,
  DIFFICULTY,
  classifyCrossGamePerformance,
};
