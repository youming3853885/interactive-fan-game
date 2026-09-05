import { direction } from './motion.js';

export const SCORE_CFG = {
  deadzone: 1.5,
  baseRate: 100,
  tempoBonus: 1.6,
  tempoLo: 0.6,
  tempoHi: 1.6,
  comboStep: 3,
  comboMax: 5,
  revsPerBeat: 0.5,
  scoreForFullBar: 3000,
};

export function targetOmegaFor(bpm, cfg) {
  const beatSec = 60 / bpm;
  return cfg.revsPerBeat * 2 * Math.PI / beatSec;
}

export function comboMultiplier(combo, cfg) {
  return Math.min(cfg.comboMax, 1 + Math.floor(combo / cfg.comboStep));
}

// state = { score, combo(秒) }；segDir ∈ 'F'|'R'|'S'。回傳新 state。
export function scoreStep(state, segDir, omega, dt, bpm, cfg) {
  let { score, combo } = state;
  if (segDir === 'S' || segDir == null) return { score, combo };
  const dir = direction(omega, cfg.deadzone);
  const correct = dir !== 'S' && dir === segDir;
  if (!correct) return { score, combo: 0 };
  const target = targetOmegaFor(bpm, cfg);
  const mag = Math.abs(omega);
  const onTempo = mag >= cfg.tempoLo * target && mag <= cfg.tempoHi * target;
  const tempoMult = onTempo ? cfg.tempoBonus : 1;
  combo += dt;
  score += cfg.baseRate * dt * tempoMult * comboMultiplier(combo, cfg);
  return { score, combo };
}

export function higherScore(a, b) {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return null;
}
