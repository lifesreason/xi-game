/* 极简音效：WebAudio 合成，无外部依赖，离线即用，移动端触摸自解锁 */
(function (global) {
  var ctx = null, enabled = true;

  function ac() {
    if (!ctx) {
      var C = global.AudioContext || global.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    return ctx;
  }

  /* 移动端首次交互唤醒 AudioContext */
  function unlockAudio() {
    var c = ac();
    if (c) {
      ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(function (evt) {
        document.removeEventListener(evt, unlockAudio, true);
      });
    }
  }
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(function (evt) {
    document.addEventListener(evt, unlockAudio, true);
  });

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
    get enabled() { return enabled; },
    move: function () { tone(520, 0.09, 'triangle', 0.13); },
    place: function () {
      tone(320, 0.08, 'sine', 0.18);
      tone(180, 0.06, 'triangle', 0.1, 0.01);
    },
    capture: function () {
      tone(220, 0.16, 'sawtooth', 0.11);
      tone(160, 0.2, 'square', 0.07, 0.05);
    },
    jump: function () {
      tone(680, 0.07, 'triangle', 0.1);
      tone(900, 0.07, 'triangle', 0.08, 0.06);
    },
    win: function () {
      var chords = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      chords.forEach(function (f, i) {
        tone(f, 0.35, 'triangle', 0.15, i * 0.1);
      });
    },
    lose: function () {
      [440, 392, 330, 261.6].forEach(function (f, i) {
        tone(f, 0.26, 'sine', 0.13, i * 0.13);
      });
    },
    draw: function () {
      [392, 392].forEach(function (f, i) {
        tone(f, 0.2, 'triangle', 0.12, i * 0.16);
      });
    },
    click: function () {
      tone(820, 0.04, 'sine', 0.09);
    },
    pop: function () {
      tone(620, 0.05, 'sine', 0.12);
      tone(940, 0.07, 'sine', 0.09, 0.03);
    },
    undo: function () {
      tone(360, 0.08, 'triangle', 0.12);
      tone(280, 0.1, 'sine', 0.1, 0.05);
    },
    flip: function () {
      tone(480, 0.04, 'triangle', 0.08);
      tone(720, 0.05, 'sine', 0.09, 0.02);
    },
    combo: function (streak) {
      var base = 523.25;
      var notes = [base, base * 1.25, base * 1.5, base * 1.875, base * 2];
      var count = Math.min(notes.length, Math.max(2, streak || 2));
      for (var i = 0; i < count; i++) {
        tone(notes[i], 0.18, 'triangle', 0.14, i * 0.07);
      }
    },
    light: function (idx) {
      var scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
      var f = scale[(idx || 0) % scale.length];
      tone(f, 0.12, 'sine', 0.14);
      tone(f * 2, 0.14, 'triangle', 0.06, 0.02);
    },
    ring: function () {
      tone(420, 0.08, 'sine', 0.16);
      tone(260, 0.12, 'triangle', 0.12, 0.02);
    },
    badge: function () {
      var notes = [440, 554.37, 659.25, 880, 1108.7];
      notes.forEach(function (f, i) {
        tone(f, 0.28, 'triangle', 0.16, i * 0.08);
      });
    }
  };
})(window);
