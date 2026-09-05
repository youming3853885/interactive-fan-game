import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

// 用 MoveNet MULTIPOSE：一次推論同時抓整張畫面裡最多多人（雙人不再跑兩次、速度同單人）。
export async function createPoseReader(video) {
  // 明確用 webgl 後端（最穩、支援最廣），並等它初始化完再建偵測器。
  await tf.setBackend('webgl');
  await tf.ready();
  const model = poseDetection.SupportedModels.MoveNet;
  const cfg = {
    modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
    enableSmoothing: true,          // 內建時間濾波（OneEuro）降抖
    enableTracking: true,           // 跨幀追蹤，多人身分穩定
    trackerType: poseDetection.TrackerType.BoundingBox,
    minPoseScore: 0.2,
  };
  const detector = await poseDetection.createDetector(model, cfg);

  function toPerson(p) {
    const kp = Object.fromEntries(p.keypoints.map((k) => [k.name, k]));
    const ls = kp['left_shoulder'], rs = kp['right_shoulder'], nose = kp['nose'];
    const xs = [ls, rs, nose].filter(Boolean).map((k) => k.x);
    const midX = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    return {
      leftWrist: kp['left_wrist'], leftShoulder: ls,
      rightWrist: kp['right_wrist'], rightShoulder: rs,
      midX, score: p.score ?? 1,
    };
  }

  return {
    // 回傳畫面中偵測到的人（各含左右手腕/肩 + 中心 x），主迴圈自行分派單/雙人。
    async readPeople() {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return [];
      const poses = await detector.estimatePoses(video, { maxPoses: 2 });
      return poses.map(toPerson);
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
