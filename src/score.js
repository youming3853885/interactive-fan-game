import { direction } from './motion.js';

export const SCORE_CFG = {
  deadzone: 1.5,
  baseRate: 100,
  tempoBonus: 1.6,
  tempoLo: 0.6,
  tempoHi: 1.6,
  comboStep: 2,
  comboMax: 5,
  revsPerBeat: 0.5,
  scoreForFullBar: 3000,
  gradeS: 1.5, gradeA: 1.0, gradeB: 0.5,
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
  if (!correct) return { score, combo }; // 做錯只暫停累積，不歸零 combo
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

export function gradeFor(score, roundSec, cfg) {
  const ratio = score / (cfg.baseRate * roundSec);
  if (ratio >= cfg.gradeS) return 'S';
  if (ratio >= cfg.gradeA) return 'A';
  if (ratio >= cfg.gradeB) return 'B';
  return 'C';
}
