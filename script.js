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

/* 回程翻页慢速动画：桌面端由 JS 接管「文章页 → 首页」的回滚
   （原生贴合动画约 0.4s，太快；这里用 1.1s 缓入缓出）
   去程不动；列表未滚到顶时不接管；反向滚可取消；减弱动态时不接管。 */
(function () {
  'use strict';

  var root = document.documentElement;
  var sheet = document.querySelector('.writing');
  if (!sheet || root.className.indexOf('home') === -1) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var DURATION = 1100;
  var animating = false;

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function stop() {
    animating = false;
    root.style.scrollSnapType = '';        // 交还贴合（会静止在最近的吸附点）
  }

  function atWritingPage() {
    return window.scrollY > window.innerHeight * 0.45;
  }

  function listAtTop() {
    var inner = sheet.querySelector('.writing__inner');
    return !inner || inner.scrollTop <= 0;
  }

  function glideToTop() {
    var start = window.scrollY;
    if (start <= 1 || animating) return;

    animating = true;
    root.style.scrollSnapType = 'none';    // 动画期间关掉贴合，避免与逐帧滚动打架

    var t0 = null;

    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / DURATION);
      window.scrollTo({ top: start * (1 - easeInOutQuad(p)), behavior: 'instant' });
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        stop();
      }
    }

    requestAnimationFrame(step);
  }

  window.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) < 1) return;

    if (animating) {
      e.preventDefault();
      if (e.deltaY > 0) stop();            // 中途反向滚 → 取消慢速回程
      return;
    }

    if (!atWritingPage() || e.deltaY > 0 || !listAtTop()) return;

    e.preventDefault();
    glideToTop();
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (animating || !atWritingPage() || !listAtTop()) return;
    if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') {
      e.preventDefault();
      glideToTop();
    }
  });
})();
