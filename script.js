(function () {
  'use strict';

  var targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });

  targets.forEach(function (el) { io.observe(el); });
})();

/* 翻页状态：文章页进入视野（可见 ≥50%）时雾化成毛玻璃；
   一旦开始离开（可见比例下降）就立即退雾——这样「滑回首页」也能看到平滑过渡 */
(function () {
  'use strict';

  var sheet = document.querySelector('.writing');
  if (!sheet || !('IntersectionObserver' in window)) return;

  var root = document.documentElement;
  var prevRatio = null;

  var io = new IntersectionObserver(function (entries) {
    var r = entries[0].intersectionRatio;
    var leaving = prevRatio !== null && r < prevRatio;

    if (leaving) {
      root.classList.remove('page-writing');
    } else if (r >= 0.5) {
      root.classList.add('page-writing');
    }

    prevRatio = r;
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1] });

  io.observe(sheet);
})();

/* 翻页动画（桌面端 JS 接管，上下同速）：
   首页 ↔ 文章页 统一 800ms 缓入缓出；列表未滚到顶时不接管；
   反向滚可取消；减弱动态时不接管；脚本失效时自动回落原生贴合。 */
(function () {
  'use strict';

  var root = document.documentElement;
  var sheet = document.querySelector('.writing');
  if (!sheet || root.className.indexOf('home') === -1) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DURATION = 800;
  var animating = false;
  var dir = 0;                              // +1 向下翻、-1 向上翻
  var rafId = null;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function pageTwoTop() {
    return sheet.offsetTop;
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    animating = false;
    dir = 0;
    root.style.scrollSnapType = '';          // 交还贴合（静止在最近的吸附点）
  }

  function glideTo(target, direction) {
    var start = window.scrollY;
    if (animating || Math.abs(target - start) < 2) return;

    animating = true;
    dir = direction;
    root.style.scrollSnapType = 'none';      // 动画期间关掉贴合，避免与逐帧滚动打架

    var t0 = null;

    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / DURATION);
      window.scrollTo({ top: start + (target - start) * easeInOut(p), behavior: 'instant' });
      if (p < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        stop();
      }
    }

    rafId = requestAnimationFrame(step);
  }

  function onWritingPage() {
    return window.scrollY > pageTwoTop() * 0.45;
  }

  function listAtTop() {
    var inner = sheet.querySelector('.writing__inner');
    return !inner || inner.scrollTop <= 0;
  }

  window.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) < 1) return;

    if (animating) {
      e.preventDefault();
      if (dir !== 0 && e.deltaY * dir < 0) stop();   // 中途反向滚 → 取消本次翻页
      return;
    }

    if (e.deltaY > 0) {
      if (onWritingPage()) return;                   // 已在文章页：交给列表内滚动
      e.preventDefault();
      glideTo(pageTwoTop(), 1);
    } else {
      if (!onWritingPage() || !listAtTop()) return;  // 列表未到顶：交给列表内滚动
      e.preventDefault();
      glideTo(0, -1);
    }
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (animating) return;
    var k = e.key;

    if (k === 'ArrowDown' || k === 'PageDown' || k === 'End') {
      if (onWritingPage()) return;
      e.preventDefault();
      glideTo(pageTwoTop(), 1);
    } else if (k === 'ArrowUp' || k === 'PageUp' || k === 'Home') {
      if (!onWritingPage() || !listAtTop()) return;
      e.preventDefault();
      glideTo(0, -1);
    }
  });
})();
