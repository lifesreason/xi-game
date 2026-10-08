/* 轻量通用触控手势内核 (Gestures Kernel)
   支持 Pointer Events 零延迟轻触、滑动识别 (Swipe)、平滑拖拽 (Drag) 与虚拟十字方向盘 (D-Pad) */
(function (global) {
  'use strict';

  /* ---------- 零延迟轻触 (Tap) ---------- */
  function bindTap(el, handler, opts) {
    if (!el || typeof handler !== 'function') return function () {};
    opts = opts || {};
    var startX = 0, startY = 0, startTime = 0, moved = false;
    var threshold = opts.threshold || 12;

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      moved = false;
      if (opts.activeClass) el.classList.add(opts.activeClass);
    }

    function onPointerMove(e) {
      if (moved) return;
      var dx = Math.abs(e.clientX - startX);
      var dy = Math.abs(e.clientY - startY);
      if (dx > threshold || dy > threshold) {
        moved = true;
        if (opts.activeClass) el.classList.remove(opts.activeClass);
      }
    }

    function onPointerUp(e) {
      if (opts.activeClass) el.classList.remove(opts.activeClass);
      if (!moved && Date.now() - startTime < 600) {
        if (opts.vibrate && global.Fx && global.Fx.vibrate) global.Fx.vibrate(8);
        handler(e);
      }
    }

    function onPointerCancel() {
      if (opts.activeClass) el.classList.remove(opts.activeClass);
      moved = true;
    }

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: true });
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return function unbind() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }

  /* ---------- 方向滑动监听 (Swipe) ---------- */
  function bindSwipe(el, callbacks, opts) {
    if (!el || !callbacks) return function () {};
    opts = opts || {};
    var minDistance = opts.distance || 36;
    var maxTime = opts.time || 650;
    var startX = 0, startY = 0, startTime = 0, tracking = false;

    function onStart(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      tracking = true;
    }

    function onEnd(e) {
      if (!tracking) return;
      tracking = false;
      var dt = Date.now() - startTime;
      if (dt > maxTime) return;

      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var absX = Math.abs(dx);
      var absY = Math.abs(dy);

      if (Math.max(absX, absY) < minDistance) return;

      if (absX > absY) {
        /* 横向滑动 */
        if (dx > 0 && typeof callbacks.onSwipeRight === 'function') {
          callbacks.onSwipeRight(e);
        } else if (dx < 0 && typeof callbacks.onSwipeLeft === 'function') {
          callbacks.onSwipeLeft(e);
        }
      } else {
        /* 纵向滑动 */
        if (dy > 0 && typeof callbacks.onSwipeDown === 'function') {
          callbacks.onSwipeDown(e);
        } else if (dy < 0 && typeof callbacks.onSwipeUp === 'function') {
          callbacks.onSwipeUp(e);
        }
      }
    }

    function onCancel() {
      tracking = false;
    }

    el.addEventListener('pointerdown', onStart, { passive: true });
    el.addEventListener('pointerup', onEnd, { passive: true });
    el.addEventListener('pointercancel', onCancel, { passive: true });

    return function unbind() {
      el.removeEventListener('pointerdown', onStart);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onCancel);
    };
  }

  /* ---------- 通用平滑拖拽 (Drag & Drop) ---------- */
  function bindDrag(el, handlers) {
    if (!el || !handlers) return function () {};
    var activeId = null;
    var startX = 0, startY = 0, lastX = 0, lastY = 0;

    function onDown(e) {
      if (activeId !== null) return;
      activeId = e.pointerId;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (handlers.onStart) {
        handlers.onStart({ x: startX, y: startY, event: e });
      }
    }

    function onMove(e) {
      if (activeId !== e.pointerId) return;
      var currentX = e.clientX;
      var currentY = e.clientY;
      var dx = currentX - lastX;
      var dy = currentY - lastY;
      var totalDx = currentX - startX;
      var totalDy = currentY - startY;
      lastX = currentX;
      lastY = currentY;

      if (handlers.onMove) {
        handlers.onMove({
          x: currentX, y: currentY,
          dx: dx, dy: dy,
          totalDx: totalDx, totalDy: totalDy,
          event: e
        });
      }
    }

    function onUp(e) {
      if (activeId !== e.pointerId) return;
      activeId = null;
      if (el.releasePointerCapture) {
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      if (handlers.onEnd) {
        handlers.onEnd({ x: e.clientX, y: e.clientY, event: e });
      }
    }

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return function unbind() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }

  global.Gestures = {
    bindTap: bindTap,
    bindSwipe: bindSwipe,
    bindDrag: bindDrag
  };
})(window);
