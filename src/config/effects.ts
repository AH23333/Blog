export type HomeAsciiGlitchConfig = {
  enable: boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  frameMinMs: number;
  frameMaxMs: number;
  burstFrameMin: number;
  burstFrameMax: number;
  mutationRatioMin: number;
  mutationRatioMax: number;
  lineShiftChance: number;
};

export type EffectsConfig = {
  homeAsciiGlitch: HomeAsciiGlitchConfig;
};

export const effectsConfig: EffectsConfig = {
  homeAsciiGlitch: {
    enable: true,
    minIntervalMs: 1400,
    maxIntervalMs: 6800,
    frameMinMs: 28,
    frameMaxMs: 110,
    burstFrameMin: 2,
    burstFrameMax: 8,
    mutationRatioMin: 0.018,
    mutationRatioMax: 0.11,
    lineShiftChance: 0.52
  }
};
