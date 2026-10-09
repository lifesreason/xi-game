#!/usr/bin/env python3
"""Clean multi-viewport audit: dismiss rules modal, walk english module, instrument TTS."""
from playwright.sync_api import sync_playwright
import json

VIEWPORTS = [("phone", 390, 844), ("tablet", 820, 1180)]

AUDIT_JS = """
() => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const bad = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    const scrollable = (n) => { let p = n.parentElement; while (p) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowX)) return true; p = p.parentElement; } return false; };
    if (r.width > 0 && (r.right > vw + 2 || r.left < -2) && !scrollable(el)) {
      bad.push({cls: (el.className||'').toString().slice(0,50), tag: el.tagName,
                left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width)});
    }
  });
  const modal = document.querySelector('#rules-modal');
  return { vw, scrollW: doc.scrollWidth, overflowX: doc.scrollWidth > vw + 2,
           badCount: bad.length, bad: bad.slice(0, 10),
           modalOpen: modal ? !modal.classList.contains('hidden') : false };
}
"""

SPEAK_INSTRUMENT = """
() => {
  if (!window.__speakLog) {
    window.__speakLog = [];
    if (typeof speechSynthesis !== 'undefined') {
      const orig = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (u) => { window.__speakLog.push(String(u.text||'').slice(0,40)); return orig(u); };
    }
  }
  return window.__speakLog.length;
}
"""

def run_pw(pw):
    import glob
    cands = glob.glob("/Users/kuan/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing")
    browser = pw.chromium.launch(executable_path=sorted(cands)[-1],
                                 args=["--autoplay-policy=no-user-gesture-required"])
    for name, w, h in VIEWPORTS:
        ctx = browser.new_context(viewport={"width": w, "height": h},
                                  is_mobile=(name == "phone"), has_touch=True)
        page = ctx.new_page()
        logs = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text[:160]}") if m.type == "error" else None)
        page.on("pageerror", lambda e: logs.append(f"[PAGEERROR] {str(e)[:250]}"))
        page.goto("http://localhost:8765", wait_until="networkidle")
        page.evaluate("""() => navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))).then(() => caches.keys()).then(ks => Promise.all(ks.map(k => caches.delete(k))))""")
        page.reload(wait_until="networkidle")
        page.evaluate(SPEAK_INSTRUMENT)
        page.click("#home-pep-card", timeout=6000)
        page.wait_for_timeout(900)
        # close rules modal if open
        page.evaluate("""() => { const m = document.querySelector('#rules-modal'); if (m && !m.classList.contains('hidden')) { const ok = document.querySelector('#btn-rules-ok') || document.querySelector('#btn-rules-close'); if (ok) ok.click(); } }""")
        page.wait_for_timeout(700)
        a0 = page.evaluate(AUDIT_JS)
        page.screenshot(path=f"/tmp/xi2-{name}-lesson.png")

        steps = [
            ("phonics-tab", "[data-main=phonics]"),
            ("train", "[data-sub=train]"),
            ("soundout", "[data-sub=soundout]"),
            ("practice-tab", "[data-main=practice]"),
            ("quiz", "[data-sub=quiz]"),
            ("review", "[data-sub=review]"),
            ("lesson-back", "[data-main=lesson]"),
            ("lsub-dialogue", "[data-lsub=dialogue]"),
            ("lsub-vocab", "[data-lsub=vocab]"),
            ("lsub-chant", "[data-lsub=chant]"),
            ("lsub-dialogue2", "[data-lsub=dialogue]"),
        ]
        report = {}
        for label, sel in steps:
            try:
                page.click(sel, timeout=2500)
                page.wait_for_timeout(450)
                ok = True
            except Exception as e:
                ok = False
                logs.append(f"[CLICKFAIL] {label}: {str(e)[:100]}")
            report[label] = ok
        # tap a speaker in dialogue
        spk = page.query_selector(".pdi-speak-btn")
        spk_tap = False
        if spk:
            try:
                spk.click(); page.wait_for_timeout(600); spk_tap = True
            except Exception as e:
                logs.append(f"[CLICKFAIL] speaker: {str(e)[:100]}")
        speak_log = page.evaluate("() => window.__speakLog")
        a1 = page.evaluate(AUDIT_JS)
        page.screenshot(path=f"/tmp/xi2-{name}-dialogue.png")

        # vocab view overflow check
        page.click("[data-lsub=vocab]", timeout=2500)
        page.wait_for_timeout(600)
        a2 = page.evaluate(AUDIT_JS)
        page.screenshot(path=f"/tmp/xi2-{name}-vocab.png")

        print(f"===== {name} {w}x{h} =====")
        print("entry:", json.dumps(a0, ensure_ascii=False))
        print("clicks:", json.dumps(report), "speaker_tap:", spk_tap)
        print("speak_calls:", speak_log[:8], "total:", len(speak_log))
        print("dialogue-audit:", json.dumps({k: a1[k] for k in ("overflowX","scrollW","badCount","modalOpen")}, ensure_ascii=False))
        if a1["badCount"]: print("  bad:", json.dumps(a1["bad"], ensure_ascii=False))
        print("vocab-audit:", json.dumps({k: a2[k] for k in ("overflowX","scrollW","badCount")}, ensure_ascii=False))
        if a2["badCount"]: print("  bad:", json.dumps(a2["bad"], ensure_ascii=False))
        print("errors:", logs if logs else "clean")
        ctx.close()
    browser.close()

with sync_playwright() as pw:
    run_pw(pw)
