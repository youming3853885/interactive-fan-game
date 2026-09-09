// 下載 MoveNet SinglePose Lightning 模型到 public/models/movenet-singlepose-lightning/
// 供離線使用。Node 18+ 有內建 fetch。從專案根目錄執行：node tools/fetch-movenet.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = 'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4/';
const Q = '?tfjs-format=file'; // tfhub 需要這個參數才吐檔案（會轉址到 kaggle 儲存）
const OUT = 'public/models/movenet-singlepose-lightning';

async function dl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`下載失敗 ${r.status}: ${url}`);
  return r;
}

await mkdir(OUT, { recursive: true });
const model = await (await dl(BASE + 'model.json' + Q)).json();
await writeFile(join(OUT, 'model.json'), JSON.stringify(model));
const shards = new Set();
for (const g of model.weightsManifest || []) for (const p of g.paths || []) shards.add(p);
for (const s of shards) {
  const buf = Buffer.from(await (await dl(BASE + s + Q)).arrayBuffer());
  await writeFile(join(OUT, s), buf);
  console.log('✓', s, buf.length, 'bytes');
}
console.log('模型下載完成 →', OUT, '（', shards.size, 'shards）');
