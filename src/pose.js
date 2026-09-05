import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

// 左右各一個偵測器，各自吃半張畫面 → 該側玩家的手腕/肩座標。
export async function createPoseReader(video) {
  // 明確用 webgl 後端（最穩、支援最廣），並等它初始化完再建偵測器。
  // 預設會挑 webgpu 但常未初始化，導致 tf.ready() 前呼叫其他方法報錯。
  await tf.setBackend('webgl');
  await tf.ready();
  const model = poseDetection.SupportedModels.MoveNet;
  // enableSmoothing：開啟內建時間濾波（OneEuro），大幅降低手部抖動/閃爍。
  const cfg = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true, minPoseScore: 0.2 };
  const detA = await poseDetection.createDetector(model, cfg);
  const detB = await poseDetection.createDetector(model, cfg);
  const detFull = await poseDetection.createDetector(model, cfg);

  // 離屏畫布，各裝一半畫面
  const half = document.createElement('canvas');
  const hctx = half.getContext('2d');

  async function readSide(det, side) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    half.width = w / 2; half.height = h;
    // 畫面鏡像顯示：A=螢幕左=原始右半、B=螢幕右=原始左半
    const sx = side === 'A' ? w / 2 : 0;
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
    async readFull() {
      const poses = await detFull.estimatePoses(video);
      if (!poses.length) return null;
      const kp = Object.fromEntries(poses[0].keypoints.map((k) => [k.name, k]));
      return {
        leftWrist: kp['left_wrist'], leftShoulder: kp['left_shoulder'],
        rightWrist: kp['right_wrist'], rightShoulder: kp['right_shoulder'],
      };
    },
  };
}

// 從單側 keypoints 挑「較高於肩、信心足」的那隻手，回傳 {wrist, shoulder} 或 null。
export function pickArm(side) {
  if (!side) return null;
  const cands = [
    { wrist: side.leftWrist, shoulder: side.leftShoulder },
    { wrist: side.rightWrist, shoulder: side.rightShoulder },
  ].filter((c) => c.wrist && c.shoulder && c.wrist.score > 0.25 && c.shoulder.score > 0.25);
  if (!cands.length) return null;
  // 選手腕舉得最高（y 最小）的那隻
  return cands.sort((a, b) => a.wrist.y - b.wrist.y)[0];
}
