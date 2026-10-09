#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键同步版本号：sw.js 的 CACHE 与 index.html 里的 ?v= 一起 +1。

【为什么需要它】
本项目用「Service Worker 缓存版本 + 资源 URL 版本参数」双层机制防陈旧缓存。
两者必须同步 bump，否则会出现「代码改了、浏览器刷新还是旧版」：

  - sw.js 的 CACHE 没变  → 浏览器认为 SW 没更新，不会触发自动刷新
  - index.html 的 ?v= 没变 → 资源 URL 不变，浏览器 HTTP 缓存直接命中旧副本，
                            连 SW 里的 fetch() 也会被这个 HTTP 缓存截胡

【用法】
    python3 scripts/bump_version.py          # 版本号 +1
    python3 scripts/bump_version.py --to 70  # 指定版本为 v70
    python3 scripts/bump_version.py --show   # 只查看当前版本，不修改

改完记得提交并推送，Cloudflare 构建会自动重新部署。
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SW = ROOT / "sw.js"
# 带 ?v= 版本参数的页面（没有的会自动跳过）
PAGES = ["index.html", "name-cards.html"]

SW_RE = re.compile(r"(var CACHE\s*=\s*'kidboard-v)(\d+)(';)")
PAGE_RE = re.compile(r"\?v=v(\d+)")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def current_version() -> int:
    m = SW_RE.search(read(SW))
    if not m:
        sys.exit("✗ 在 sw.js 里找不到 `var CACHE = 'kidboard-vNN';`，请检查文件。")
    return int(m.group(2))


def page_versions() -> dict:
    """返回 {页面名: 该页面里出现过的版本号集合}"""
    found = {}
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        vers = sorted({int(v) for v in PAGE_RE.findall(read(p))})
        if vers:
            found[name] = vers
    return found


def main() -> None:
    ap = argparse.ArgumentParser(description="同步 sw.js 的 CACHE 与页面的 ?v= 版本号")
    ap.add_argument("--to", type=int, metavar="N", help="指定版本号为 N（默认在当前基础上 +1）")
    ap.add_argument("--show", action="store_true", help="只显示当前版本，不做修改")
    args = ap.parse_args()

    cur = current_version()
    pages = page_versions()

    if args.show:
        print(f"sw.js  CACHE = kidboard-v{cur}")
        for name, vers in pages.items():
            print(f"{name}  ?v= " + ", ".join(f"v{v}" for v in vers))
        if not pages:
            print("（各页面均未使用 ?v= 版本参数）")
        return

    new = args.to if args.to is not None else cur + 1
    if new <= cur and args.to is None:
        sys.exit(f"✗ 新版本号 v{new} 不大于当前 v{cur}，已中止。")

    # 1) sw.js 的 CACHE
    sw_text = read(SW)
    SW.write_text(SW_RE.sub(lambda m: m.group(1) + str(new) + m.group(3), sw_text), encoding="utf-8")
    print(f"✓ sw.js            CACHE: kidboard-v{cur} → kidboard-v{new}")

    # 2) 页面的 ?v=
    for name in PAGES:
        p = ROOT / name
        if not p.exists():
            continue
        text = read(p)
        new_text, n = PAGE_RE.subn(f"?v=v{new}", text)
        if n:
            p.write_text(new_text, encoding="utf-8")
            old = ", ".join(f"v{v}" for v in sorted({int(x) for x in PAGE_RE.findall(text)}))
            print(f"✓ {name:<17} ?v=  : {old} → v{new}  （{n} 处）")

    print(f"\n版本已同步到 v{new}。提交推送后 Cloudflare 会自动重新部署。")
    print("老用户下次打开页面会自动拿到新版本并刷新。")


if __name__ == "__main__":
    main()
