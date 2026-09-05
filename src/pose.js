import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs';

// 左右各一個偵測器，各自吃半張畫面 → 該側玩家的手腕/肩座標。
export async function createPoseReader(video) {
  const model = poseDetection.SupportedModels.MoveNet;
  const cfg = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
  const detA = await poseDetection.createDetector(model, cfg);
  const detB = await poseDetection.createDetector(model, cfg);

  // 離屏畫布，各裝一半畫面
  const half = document.createElement('canvas');
  const hctx = half.getContext('2d');

  async function readSide(det, side) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    half.width = w / 2; half.height = h;
    const sx = side === 'A' ? 0 : w / 2;
    hctx.drawImage(video, sx, 0, w / 2, h, 0, 0, w / 2, h);
    const poses = await det.estimatePoses(half);
    if (!poses.length) return null;
    const kp = Object.fromEntries(poses[0].keypoints.map((k) => [k.name, k]));
    // 取較活躍的一手：兩手都回傳，主迴圈自行挑。
    return {
      leftWrist: kp['left_wrist'], leftShoulder: kp['left_shoulder'],
      rightWrist: kp['right_wrist'], rightShoulder: kp['right_shoulder'],
    };
  }

  return {
    async read() {
      return { A: await readSide(detA, 'A'), B: await readSide(detB, 'B') };
    },
  };
}

// 從單側 keypoints 挑「較高於肩、信心足」的那隻手，回傳 {wrist, shoulder} 或 null。
export function pickArm(side) {
  if (!side) return null;
  const cands = [
    { wrist: side.leftWrist, shoulder: side.leftShoulder },
    { wrist: side.rightWrist, shoulder: side.rightShoulder },
  ].filter((c) => c.wrist && c.shoulder && c.wrist.score > 0.3 && c.shoulder.score > 0.3);
  if (!cands.length) return null;
  // 選手腕舉得最高（y 最小）的那隻
  return cands.sort((a, b) => a.wrist.y - b.wrist.y)[0];
}
