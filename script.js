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

/* 纸面雾化规则（方向感知）：
   - 到屏（可见 ≥50%）起雾（与 hero→文章 同款）；
   - 往「上」翻（回 hero 方向）：一开始离开就退雾——回程能看到散雾；
   - 往「下」翻（去项目）：保持毛玻璃不散，直到完全离屏才静默复位（避免中途一闪“清透”）。 */
(function () {
  'use strict';

  var sheets = [].slice.call(document.querySelectorAll('.writing'));
  if (!sheets.length || !('IntersectionObserver' in window)) return;

  var ratios = [];
  var lastY = window.scrollY;
  var movingUp = false;

  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (Math.abs(y - lastY) > 0.5) {
      movingUp = y < lastY;
      lastY = y;
    }
  }, { passive: true });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      var i = sheets.indexOf(el);
      if (i < 0) return;
      var r = entry.intersectionRatio;
      var prev = ratios[i];
      var leaving = prev !== undefined && r < prev;

      if (r >= 0.5) {
        el.classList.add('is-frosted');
      } else if (leaving && movingUp) {
        el.classList.remove('is-frosted');     // 回程：可见退雾
      } else if (r < 0.02) {
        el.classList.remove('is-frosted');     // 已离屏：静默复位
      }
      ratios[i] = r;
    });
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1] });

  sheets.forEach(function (s) { io.observe(s); });
})();

/* 首页整页翻页（桌面端 JS 接管，逐屏同速 800ms 缓入缓出）。
   首页共三屏：hero → 文章 → 项目；
   滚轮先滚当前屏的列表，列表到端点后再翻到下一屏（反向同理）。 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (root.className.indexOf('home') === -1) return;
  if (!document.querySelector('.hero')) return;          // 非首页不接管
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var sections = [].slice.call(document.querySelectorAll('.hero, .writing'));
  if (sections.length < 2) return;

  var DURATION = 800;
  var animating = false;
  var glideDir = 0;
  var rafId = null;

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    animating = false;
    glideDir = 0;
    root.style.scrollSnapType = '';          // 交还贴合（静止在最近的吸附点）
  }

  function glideTo(target, direction) {
    var start = window.scrollY;
    if (animating || Math.abs(target - start) < 2) return;

    animating = true;
    glideDir = direction;
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

  function currentIndex() {
    var mid = window.scrollY + window.innerHeight * 0.5;
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < sections.length; i++) {
      var d = Math.abs(sections[i].offsetTop + window.innerHeight * 0.5 - mid);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function innerCanScroll(el, dir) {
    var inner = el ? el.querySelector('.writing__inner') : null;
    if (!inner) return false;
    if (dir > 0) return inner.scrollTop + inner.clientHeight < inner.scrollHeight - 2;
    return inner.scrollTop > 2;
  }

  /* 先让列表自己滚；到端点后再翻屏。返回 true 表示本次翻屏已接管。 */
  function move(dir) {
    var idx = currentIndex();
    if (innerCanScroll(sections[idx], dir)) return false;
    var next = idx + dir;
    if (next < 0 || next >= sections.length) return false;
    glideTo(sections[next].offsetTop, dir);
    return true;
  }

  window.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) < 1) return;
    var dir = e.deltaY > 0 ? 1 : -1;

    if (animating) {
      e.preventDefault();
      if (glideDir !== 0 && dir !== glideDir) stop();   // 中途反向滚 → 取消本次翻页
      return;
    }

    if (move(dir)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', function (e) {
    if (animating) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (move(1)) e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (move(-1)) e.preventDefault();
    } else if (e.key === 'Home') {
      e.preventDefault();
      glideTo(0, -1);
    } else if (e.key === 'End') {
      e.preventDefault();
      glideTo(sections[sections.length - 1].offsetTop, 1);
    }
  });

  /* 页内锚点（向下看看 / 项目 → / 文章 →）也走同一套慢速翻页 */
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document && !(el.tagName === 'A' && el.getAttribute('href'))) {
      el = el.parentNode;
    }
    if (!el || el === document) return;
    var href = el.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    var target = document.getElementById(href.slice(1));
    if (!target) return;
    var idx = sections.indexOf(target);
    if (idx < 0) return;
    e.preventDefault();
    glideTo(target.offsetTop, idx > currentIndex() ? 1 : -1);
  });
})();
