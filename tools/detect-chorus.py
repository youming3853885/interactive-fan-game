#!/usr/bin/env python3
# 離線偵測 6 首副歌/高潮起點（秒），寫入 tools/chorus-times.json 供人眼複核。
# 只用 numpy/scipy + ffmpeg，不裝 librosa/pychorus。從專案根目錄執行。
import subprocess, json, numpy as np

# (track_id, 來源檔名, 方法)：流行用 chroma 重複偵測、國樂用 energy 高潮偵測
SONGS = [
    ('canon-rock',   'canon-rock.mp4',          'chroma'),
    ('super-run',    'super-run.mp4',           'chroma'),
    ('initial-d',    'initial-d.mp4',           'chroma'),
    ('bumblebee',    'flight-of-bumblebee.mp4', 'chroma'),
    ('dragon-boat',  'dragon-boat.mp4',         'energy'),
    ('golden-snake', 'golden-snake.mp4',        'energy'),
]
MV = 'public/mv'
SR = 22050

def decode(path):
    # ffmpeg 解碼成單聲道 16-bit PCM，讀進 numpy [-1,1]
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

def energy_start(x, win=60.0, hop=0.5):
    # 滑動 60 秒視窗，回傳「平均能量最高」視窗的起點秒數（B 法）
    fl = int(hop * SR)
    n = len(x) // fl
    rms = np.sqrt(np.array([np.mean(x[i*fl:(i+1)*fl]**2) for i in range(n)]) + 1e-9)
    W = int(win / hop)
    if n <= W:
        return 0.0
    csum = np.cumsum(np.insert(rms, 0, 0))
    wmean = (csum[W:] - csum[:-W]) / W
    return float(np.argmax(wmean)) * hop

def chroma(x, hop=0.25):
    fl = int(hop * SR); win = fl * 2
    n = max(0, (len(x) - win) // fl)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    pc = np.full(len(freqs), -1)
    valid = freqs > 20
    pc[valid] = (np.round(12 * np.log2(freqs[valid] / 440.0) + 69).astype(int)) % 12
    w = np.hanning(win)
    C = np.zeros((n, 12))
    for i in range(n):
        mag = np.abs(np.fft.rfft(x[i*fl:i*fl+win] * w))
        for k in range(12):
            C[i, k] = mag[pc == k].sum()
    C /= (np.linalg.norm(C, axis=1, keepdims=True) + 1e-9)
    return C, hop

def chorus_start(x):
    # chroma 自相似 time-lag：找「最常重複的 ~15 秒段落」起點（A 法）
    C, hop = chroma(x)
    n = len(C)
    seg = int(15 / hop)          # 重複段長 ~15 秒
    min_lag = int(10 / hop)      # 兩次出現至少相隔 10 秒
    if n <= seg + min_lag:
        return 0.0
    S = C @ C.T                  # 已正規化 → cosine 相似度
    best_val, best_i = -1.0, 0
    for lag in range(min_lag, n - seg):
        idx = np.arange(0, n - lag)
        diag = S[idx, idx + lag]
        if len(diag) < seg:
            continue
        csum = np.cumsum(np.insert(diag, 0, 0))
        block = csum[seg:] - csum[:-seg]
        j = int(np.argmax(block))
        if block[j] > best_val:
            best_val, best_i = float(block[j]), j
    return best_i * hop

def main():
    out = {}
    for tid, fname, method in SONGS:
        x = decode(f'{MV}/{fname}')
        start = energy_start(x) if method == 'energy' else chorus_start(x)
        out[tid] = round(start, 1)
        print(f'{tid:14s} {method:7s} start={out[tid]}s  (len={len(x)/SR:.0f}s)')
    json.dump(out, open('tools/chorus-times.json', 'w'), indent=2)
    print('→ tools/chorus-times.json 已寫入，請人眼複核')

if __name__ == '__main__':
    main()
