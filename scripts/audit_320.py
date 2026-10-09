#!/usr/bin/env python3
"""320px narrow-screen verification for pep module."""
from playwright.sync_api import sync_playwright
import json, glob

with sync_playwright() as pw:
    cands = glob.glob("/Users/kuan/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
    browser = pw.chromium.launch(executable_path=sorted(cands)[-1])
    ctx = browser.new_context(viewport={"width": 320, "height": 568}, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:200]))
    page.goto("http://localhost:8765", wait_until="networkidle")
    page.click("#home-pep-card", timeout=6000)
    page.wait_for_timeout(800)
    page.evaluate("""() => { const m = document.querySelector('#rules-modal'); if (m && !m.classList.contains('hidden')) { const ok = document.querySelector('#btn-rules-ok'); if (ok) ok.click(); } }""")
    page.wait_for_timeout(600)
    r = page.evaluate("""() => {
      const vw = window.innerWidth;
      const out = { vw, scrollW: document.documentElement.scrollWidth, clips: [] };
      document.querySelectorAll('.pep-main-tab, .pep-rate-btn, .plh-badge, .pep-sub-btn, .pep-lsub-btn').forEach(el => {
        if (el.scrollWidth > el.clientWidth + 1) out.clips.push((el.className||'').toString().slice(0,40) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth);
      });
      const nav = document.querySelector('.pep-main-nav');
      out.navH = nav ? nav.offsetHeight : -1;
      out.navOverflow = nav ? nav.scrollWidth > nav.clientWidth + 1 : null;
      return out;
    }""")
    page.screenshot(path="/tmp/xi3-320-lesson.png")
    page.click("[data-main=practice]", timeout=2500)
    page.wait_for_timeout(500)
    page.screenshot(path="/tmp/xi3-320-practice.png")
    print(json.dumps(r, ensure_ascii=False))
    print("errors:", errs if errs else "clean")
    ctx.close(); browser.close()
