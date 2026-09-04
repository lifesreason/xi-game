/* 极简音效：WebAudio 合成，无外部资源，离线可用 */
(function (global) {
  var ctx = null, enabled = true;
  function ac() {
    if (!ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }
  function tone(freq, dur, type, vol, delay) {
    if (!enabled) return;
    var c = ac(); if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol == null ? 0.16 : vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }
  global.Sfx = {
    setEnabled: function (v) { enabled = !!v; },
    move: function () { tone(520, 0.09, 'triangle', 0.13); },
    place: function () { tone(300, 0.07, 'sine', 0.15); },
    capture: function () { tone(220, 0.16, 'sawtooth', 0.11); tone(160, 0.2, 'square', 0.07, 0.05); },
    jump: function () { tone(680, 0.07, 'triangle', 0.1); tone(900, 0.07, 'triangle', 0.08, 0.06); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.14, i * 0.11); }); },
    lose: function () { [440, 392, 330, 262].forEach(function (f, i) { tone(f, 0.26, 'sine', 0.13, i * 0.13); }); },
    draw: function () { [392, 392].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.12, i * 0.16); }); },
    click: function () { tone(760, 0.05, 'square', 0.06); }
  };
})(window);
