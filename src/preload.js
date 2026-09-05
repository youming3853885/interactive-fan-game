// 用 XHR blob 預載大檔 MV，回報整體進度，回傳 id→blob URL（播放即時、不再重抓）。
export function preloadTracks(tracks, onProgress) {
  const fracs = new Array(tracks.length).fill(0);
  const report = () => onProgress(fracs.reduce((a, b) => a + b, 0) / tracks.length);
  return Promise.all(tracks.map((t, idx) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', t.src, true);
    xhr.responseType = 'blob';
    xhr.onprogress = (e) => { if (e.lengthComputable) { fracs[idx] = e.loaded / e.total; report(); } };
    xhr.onload = () => { fracs[idx] = 1; report(); resolve({ id: t.id, url: URL.createObjectURL(xhr.response) }); };
    xhr.onerror = () => { fracs[idx] = 1; report(); resolve({ id: t.id, url: t.src }); }; // 失敗退回原網址
    xhr.send();
  })));
}
