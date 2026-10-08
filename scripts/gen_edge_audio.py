#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用微软顶级神经网络音色“晓晓 (Xiaoxiao)”生成全班小朋友名字和姓氏的高保真教学发音。
依赖: pip install edge-tts
运行: python3 scripts/gen_edge_audio.py
"""

import os
import sys
import re
import json
import asyncio
import subprocess
import wave

# 支持用户全局与虚拟环境 site-packages 路径
sys.path.extend([
    os.path.expanduser("~/Library/Python/3.9/lib/python/site-packages"),
    os.path.expanduser("~/Library/Python/3.14/lib/python/site-packages")
])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(BASE_DIR, "audio")
NAMES_AUDIO_DIR = os.path.join(AUDIO_DIR, "names")
DATA_JS = os.path.join(BASE_DIR, "js", "names-data.js")
SPRITE_MP3 = os.path.join(AUDIO_DIR, "names-sprite.mp3")
SPRITE_JS = os.path.join(BASE_DIR, "js", "names-audio-data.js")

# 微软晓晓：国内公认中文幼教首选女声（温柔亲切、吐字极准、自然抑扬顿挫）
VOICE = "zh-CN-XiaoxiaoNeural"
# 教学级自然舒缓语速（大模型原生慢速，非机械拉伸）
RATE = "-20%"

# 读音校准表（针对多音字，确保 100% 声调精准）
SPOKEN_OVERRIDE = {
    "尹纶瑶": "尹轮瑶",  # “纶”易读为一声 guān，用“轮”锁定标准二声 lún
    "纶": "轮",
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

async def synth_item(edge_tts, text, spoken, mp3_path):
    communicate = edge_tts.Communicate(spoken, VOICE, rate=RATE)
    await communicate.save(mp3_path)

def get_mp3_duration(mp3_path):
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", mp3_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return round(float(res.stdout.strip()), 3)

async def main_async():
    try:
        import edge_tts
    except ImportError:
        print("\n【提示】未检测到 edge-tts 库。")
        print("请在终端运行以下命令安装：")
        print("    pip3 install edge-tts\n")
        print("安装后重新运行此脚本即可！")
        return

    os.makedirs(NAMES_AUDIO_DIR, exist_ok=True)
    names, surnames = parse_names_data()
    print(f"找到 {len(names)} 位小朋友，{len(surnames)} 个姓氏")
    print(f"使用音色: 微软云端大模型 【{VOICE}】")
    print(f"语速设定: {RATE}（幼教舒缓识字节奏）")

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

    print(f"开始批量生成 {len(items_to_synth)} 个标准发音音频文件...")
    for idx, (text, spoken, tag) in enumerate(items_to_synth, 1):
        mp3_path = os.path.join(NAMES_AUDIO_DIR, f"{tag}.mp3")
        wav_path = os.path.join(NAMES_AUDIO_DIR, f"{tag}.wav")

        # 调用微软大模型合成
        await synth_item(edge_tts, text, spoken, mp3_path)

        # 转换为统一步长 wav 便于合成 Sprite
        subprocess.run([
            "ffmpeg", "-y", "-i", mp3_path,
            "-ar", "24000", "-ac", "1", wav_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        dur = get_mp3_duration(mp3_path)
        start_t = round(current_time, 3)
        sprite_map[text] = [start_t, dur]
        current_time += dur + silence_gap
        temp_wav_list.append((wav_path, dur))
        print(f"  [{idx}/{len(items_to_synth)}] {text} ({spoken}) -> {dur:.2f}s")

    print(f"\n全部单条音频生成完成！总时长约 {current_time:.2f} 秒")
    print("正在合并为离线 Audio Sprite (names-sprite.mp3)...")

    concat_list_file = os.path.join(AUDIO_DIR, "concat_list.txt")
    silence_wav = os.path.join(AUDIO_DIR, "silence.wav")
    
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
        "-t", str(silence_gap), silence_wav
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    with open(concat_list_file, "w", encoding="utf-8") as f:
        for wav_path, _ in temp_wav_list:
            f.write(f"file '{wav_path}'\n")
            f.write(f"file '{silence_wav}'\n")

    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file,
        "-codec:a", "libmp3lame", "-b:a", "48k", SPRITE_MP3
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    os.remove(concat_list_file)
    if os.path.exists(silence_wav):
        os.remove(silence_wav)
    for wav_path, _ in temp_wav_list:
        if os.path.exists(wav_path):
            os.remove(wav_path)

    sprite_size = os.path.getsize(SPRITE_MP3)
    print(f"Audio Sprite 生成成功: {SPRITE_MP3}, 体积: {sprite_size / 1024:.1f} KB")

    js_content = "/* ============ 认名字模块 · 标准发音音频雪碧图时间索引表 (微软晓晓播音音色) ============ */\n"
    js_content += "/* 格式: [开始秒数, 持续秒数] */\n"
    js_content += "window.NAME_AUDIO_SPRITE_SRC = 'audio/names-sprite.mp3';\n"
    js_content += "window.NAME_AUDIO_SPRITES = " + json.dumps(sprite_map, ensure_ascii=False, indent=2) + ";\n"

    with open(SPRITE_JS, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"时间索引表写入完成: {SPRITE_JS}")
    print("\n恭喜！全套高保真晓晓播音音频包已全部制作并离线打包完毕！")

if __name__ == "__main__":
    asyncio.run(main_async())
