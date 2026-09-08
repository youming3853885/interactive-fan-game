#!/usr/bin/env python3
# 讀 tools/chorus-times.json，對每首往前含 2.5 秒前奏切 60 秒 → public/mv/{id}-chorus.mp4。
# 邊界：太靠結尾就把起點前挪讓片段收在曲末；整片<60s 用整片。從專案根目錄執行。
import subprocess, json

SRC = {  # track_id → 來源檔名（與 detect-chorus.py 一致）
    'canon-rock':   'canon-rock.mp4',
    'super-run':    'super-run.mp4',
    'initial-d':    'initial-d.mp4',
    'bumblebee':    'flight-of-bumblebee.mp4',
    'dragon-boat':  'dragon-boat.mp4',
    'golden-snake': 'golden-snake.mp4',
}
MV = 'public/mv'
LEAD = 0.0   # 前奏秒數（使用者已親耳挑好確切起點，不再往前墊）
DUR = 60.0   # 目標片長

def probe_dur(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True).stdout.strip()
    return float(out)

def main():
    times = json.load(open('tools/chorus-times.json'))
    for tid, chorus in times.items():
        src = f'{MV}/{SRC[tid]}'
        dur = probe_dur(src)
        length = min(DUR, dur)
        start = max(0.0, min(chorus - LEAD, max(0.0, dur - length)))
        dst = f'{MV}/{tid}-chorus.mp4'
        subprocess.run([
            'ffmpeg', '-y', '-ss', f'{start:.2f}', '-i', src, '-t', f'{length:.2f}',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst,
        ], check=True)
        print(f'{tid:14s} start={start:.1f}s len={length:.1f}s → {dst}')

if __name__ == '__main__':
    main()
