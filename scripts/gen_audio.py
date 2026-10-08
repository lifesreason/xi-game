#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成全班小朋友名字和姓氏的标准发音音频与 Audio Sprite
使用精确的首尾静音裁剪，绝不截断字间停顿。
"""

import os
import re
import json
import subprocess
import wave
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(BASE_DIR, "audio")
NAMES_AUDIO_DIR = os.path.join(AUDIO_DIR, "names")
DATA_JS = os.path.join(BASE_DIR, "js", "names-data.js")
SPRITE_MP3 = os.path.join(AUDIO_DIR, "names-sprite.mp3")
SPRITE_JS = os.path.join(BASE_DIR, "js", "names-audio-data.js")

# 读音校准表（针对多音字在 TTS 引擎中易误读的字，用绝对准确的同音字替代发音，视觉文本不变）
SPOKEN_OVERRIDE = {
    "尹纶瑶": "尹轮瑶",  # “纶”易读为一声 guān，用“轮”锁定标准二声 lún
    "纶": "轮",
    "单乐天": "善勒天",  # 预备多音字
}

def parse_names_data():
    with open(DATA_JS, "r", encoding="utf-8") as f:
        content = f.read()
    
    pattern = re.compile(r'{\s*full:\s*"([^"]+)",\s*surname:\s*"([^"]+)",\s*given:\s*"([^"]+)",\s*py:\s*"([^"]+)",\s*surPy:\s*"([^"]+)"\s*}')
    matches = pattern.findall(content)
    names = []
    surnames = []
    for full, surname, given, py, surPy in matches:
        names.append({"full": full, "surname": surname, "py": py, "surPy": surPy})
        if surname not in surnames:
            surnames.append(surname)
    return names, surnames

def get_voice():
    # 优先使用 macOS 的 Flo (高质量中文普通话女声，发音温和清晰，最适合儿童识字)
    res = subprocess.run(["say", "-v", "?"], capture_output=True, text=True).stdout
    if "Flo (中文（中国大陆）)" in res:
        return "Flo (中文（中国大陆）)"
    if "Eddy (中文（中国大陆）)" in res:
        return "Eddy (中文（中国大陆）)"
    return "Tingting"

def trim_silence_wav(wav_path, threshold=120):
    with wave.open(wav_path, "rb") as w:
        params = w.getparams()
        frames = w.readframes(w.getnframes())
        data = np.frombuffer(frames, dtype=np.int16)
    
    non_silent = np.where(np.abs(data) > threshold)[0]
    if len(non_silent) == 0:
        return 0.0
    sr = params.framerate
    start = max(0, non_silent[0] - int(sr * 0.05)) # 保留前导 50ms 自然气息
    end = min(len(data), non_silent[-1] + int(sr * 0.12)) # 保留尾随 120ms 保证字尾声调充分衰减
    trimmed_data = data[start:end]
    
    with wave.open(wav_path, "wb") as w:
        w.setparams(params)
        w.writeframes(trimmed_data.tobytes())
    
    return len(trimmed_data) / float(sr)

def main():
    os.makedirs(NAMES_AUDIO_DIR, exist_ok=True)
    names, surnames = parse_names_data()
    print(f"找到 {len(names)} 位小朋友，{len(surnames)} 个姓氏")

    voice = get_voice()
    print(f"使用语音: {voice}")

    items_to_synth = []
    for n in names:
        text = n["full"]
        spoken = SPOKEN_OVERRIDE.get(text, text)
        items_to_synth.append((text, spoken, f"name_{text}"))
    
    for sur in surnames:
        text = sur
        spoken = SPOKEN_OVERRIDE.get(text, text)
        items_to_synth.append((text, spoken, f"sur_{text}"))

    temp_wav_list = []
    sprite_map = {}
    current_time = 0.0
    silence_gap = 0.20 # 夹断静音 200ms

    print("开始合成放慢、清晰、字正腔圆的教学级标准音频...")
    for text, spoken, tag in items_to_synth:
        aiff_path = os.path.join(NAMES_AUDIO_DIR, f"{tag}.aiff")
        wav_path = os.path.join(NAMES_AUDIO_DIR, f"{tag}.wav")
        mp3_path = os.path.join(NAMES_AUDIO_DIR, f"{tag}.mp3")

        # 1. 使用 say 命令以 110 wpm 合成高质量音频底本
        cmd_say = ["say", "-v", voice, "-r", "110", "-o", aiff_path, spoken]
        subprocess.run(cmd_say, check=True)

        # 2. 转换并应用高保真 atempo=0.75 均匀慢速拉伸算法（不改变音高，每一个字音韵清澈舒缓）
        cmd_ffmpeg = [
            "ffmpeg", "-y", "-i", aiff_path,
            "-filter:a", "atempo=0.75",
            "-ar", "22050", "-ac", "1", wav_path
        ]
        subprocess.run(cmd_ffmpeg, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if os.path.exists(aiff_path):
            os.remove(aiff_path)

        # 3. 精确首尾修剪静音（保留字间自然停顿，彻底防止多音字截断）
        duration = round(trim_silence_wav(wav_path), 3)

        # 记录在 sprite 中的起止时间
        start_t = round(current_time, 3)
        sprite_map[text] = [start_t, duration]
        current_time += duration + silence_gap

        # 同时导出一份独立的 mp3 供单独访问
        cmd_mp3 = ["ffmpeg", "-y", "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "48k", mp3_path]
        subprocess.run(cmd_mp3, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        temp_wav_list.append((wav_path, duration))

    print(f"共生成 {len(items_to_synth)} 段音频，总时长约 {current_time:.2f} 秒")

    # 4. 生成音频雪碧图 (合并所有 wav)
    print("正在合并生成 Audio Sprite (names-sprite.mp3)...")
    concat_list_file = os.path.join(AUDIO_DIR, "concat_list.txt")
    silence_wav = os.path.join(AUDIO_DIR, "silence.wav")
    
    # 制作 silence wav
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=22050:cl=mono",
        "-t", str(silence_gap), silence_wav
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    with open(concat_list_file, "w", encoding="utf-8") as f:
        for wav_path, dur in temp_wav_list:
            f.write(f"file '{wav_path}'\n")
            f.write(f"file '{silence_wav}'\n")

    cmd_concat = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file,
        "-codec:a", "libmp3lame", "-b:a", "48k", SPRITE_MP3
    ]
    subprocess.run(cmd_concat, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    # 清理临时拼接文件
    os.remove(concat_list_file)
    if os.path.exists(silence_wav):
        os.remove(silence_wav)
    for wav_path, _ in temp_wav_list:
        if os.path.exists(wav_path):
            os.remove(wav_path)

    sprite_size = os.path.getsize(SPRITE_MP3)
    print(f"Audio Sprite 生成成功: {SPRITE_MP3}, 大小: {sprite_size / 1024:.1f} KB")

    # 5. 生成 js/names-audio-data.js
    js_content = "/* ============ 认名字模块 · 标准发音音频雪碧图时间索引表 ============ */\n"
    js_content += "/* 格式: [开始秒数, 持续秒数] */\n"
    js_content += "window.NAME_AUDIO_SPRITE_SRC = 'audio/names-sprite.mp3';\n"
    js_content += "window.NAME_AUDIO_SPRITES = " + json.dumps(sprite_map, ensure_ascii=False, indent=2) + ";\n"

    with open(SPRITE_JS, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"时间索引表写入完成: {SPRITE_JS}")

if __name__ == "__main__":
    main()
