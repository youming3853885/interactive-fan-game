import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

// 單一共用 SINGLEPOSE 偵測器：單人吃整張、雙人分別吃左右半張（保證每邊各抓到一人）。
// 比舊版建 3 個偵測器實例輕很多（那才是雙人 lag 主因）。
export async function createPoseReader(video) {
  await tf.setBackend('webgl');
  await tf.ready();
  const cfg = {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,   // 內建時間濾波降抖
    minPoseScore: 0.2,
  };
  const det = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, cfg);

  const half = document.createElement('canvas');
  const hctx = half.getContext('2d');

  function person(poses) {
    if (!poses.length) return null;
    const kp = Object.fromEntries(poses[0].keypoints.map((k) => [k.name, k]));
    return {
      leftWrist: kp['left_wrist'], leftShoulder: kp['left_shoulder'],
      rightWrist: kp['right_wrist'], rightShoulder: kp['right_shoulder'],
    };
  }

  return {
    // 半張畫面（A=螢幕左=原始右半、B=螢幕右=原始左半），回傳該半邊那個人的手腕/肩（座標在半張內）。
    async readHalf(side) {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return null;
      half.width = w / 2; half.height = h;
      const sx = side === 'A' ? w / 2 : 0;
      hctx.drawImage(video, sx, 0, w / 2, h, 0, 0, w / 2, h);
      return person(await det.estimatePoses(half));
    },
    // 整張畫面（單人用）。
    async readFull() {
      if (!video.videoWidth) return null;
      return person(await det.estimatePoses(video));
    },
  };
}

// 從一個人的 keypoints 挑「較活躍」的那隻手（舉最高、信心足），回傳 {wrist, shoulder} 或 null。
export function pickArm(person) {
  if (!person) return null;
  const cands = [
    { wrist: person.leftWrist, shoulder: person.leftShoulder },
    { wrist: person.rightWrist, shoulder: person.rightShoulder },
  ].filter((c) => c.wrist && c.shoulder && c.wrist.score > 0.25 && c.shoulder.score > 0.25);
  if (!cands.length) return null;
  return cands.sort((a, b) => a.wrist.y - b.wrist.y)[0]; // 手腕舉最高（y 最小）
}
