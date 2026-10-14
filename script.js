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

/* 纸面区雾化（全局）：三屏中只有「hero ↔ 纸面区」之间存在雾化切换——
   - 进入纸面区（文章屏可见 ≥50%）起雾（hero→文章 的进场效果）；
   - 往 hero 方向离开时退雾（回程可见散雾）；
   - 文章 ↔ 项目 两屏都是毛玻璃：切换时保持不散，直接平滑滑过。 */
(function () {
  'use strict';

  var art = document.getElementById('writing');
  if (!art || !('IntersectionObserver' in window)) return;

  var root = document.documentElement;
  var prevRatio = null;
  var lastY = window.scrollY;
  var movingUp = false;

  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (Math.abs(y - lastY) > 0.5) {
      movingUp = y < lastY;
      lastY = y;
    }
  }, { passive: true });

  /* 翻页动画开始时同步运动方向与基线：避免上一段滚动的方向残留，
     导致首个亚像素帧就误触发退雾（锚点点击切到项目页时曾出现"先轻微退雾再起雾"的闪烁）。 */
  window.__glideStart = function (dir) {
    movingUp = dir < 0;
    lastY = window.scrollY;
  };

  var io = new IntersectionObserver(function (entries) {
    var r = entries[0].intersectionRatio;
    var leaving = prevRatio !== null && r < prevRatio;

    if (leaving && movingUp) {
      root.classList.remove('sheets-frosted');   // 回程：一开始离开就退雾
    } else if (r >= 0.5) {
      root.classList.add('sheets-frosted');      // 进入纸面区：起雾
    }
    prevRatio = r;
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 1] });

  io.observe(art);
})();

/* 首页整页翻页（桌面端 JS 接管）。
   首页共三屏：hero → 文章 → 项目；
   滚轮先滚当前屏的列表；列表到端点后需再累计约 1.5 格滚轮量才翻到下一屏（反向同理）。
   触屏：卡片列表内走原生滚动 + 端点门槛（累计约 80px 翻屏）；列表外（hero/标题区）为整屏手势
   （松手净位移 ≥45px 翻相邻一屏），由 JS 全程接管，保证任何内核都不会因惯性甩动跳过中间屏。
   时长：hero ↔ 文章 800ms（有雾化收尾，观感更长）；
   文章 → 项目 1000ms（两屏均为毛玻璃、无雾化收尾，800ms 实测观感偏快）。
   缓动：quart 缓入缓出——加速完之后尾段渐渐慢下来（四段翻页统一）；
   文章 → 项目 额外用 quint：尾端再慢一档。 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (root.className.indexOf('home') === -1) return;
  if (!document.querySelector('.hero')) return;          // 非首页不接管
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var sections = [].slice.call(document.querySelectorAll('.hero, .writing'));
  if (sections.length < 2) return;

  var DURATION = 800;           // 常规翻屏：hero ↔ 文章（带雾化收尾，观感更长）
  var DURATION_SHEETS = 1000;   // 文章 → 项目：纯滑动、无雾化收尾，稍慢一档以匹配观感
  var animating = false;
  var glideDir = 0;
  var rafId = null;

  function easeInOutQuart(t) {
    // 缓入 + 更长的缓出尾段（quart）：加速完之后渐渐慢下来
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  function easeInOutQuint(t) {
    // 更缓的尾段（quint）：专用于文章 → 项目，尾端更慢一档
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    animating = false;
    glideDir = 0;
    root.style.scrollSnapType = '';          // 交还贴合（静止在最近的吸附点）
  }

  function glideTo(target, direction, duration, easing) {
    var start = window.scrollY;
    if (animating || Math.abs(target - start) < 2) return;

    var dur = duration || DURATION;
    var ease = easing || easeInOutQuart;

    animating = true;
    glideDir = direction;
    root.style.scrollSnapType = 'none';      // 动画期间关掉贴合，避免与逐帧滚动打架
    if (window.__glideStart) window.__glideStart(direction);   // 同步雾化方向判定（防锚点切换误退雾）

    var t0 = null;

    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      window.scrollTo({ top: start + (target - start) * ease(p), behavior: 'instant' });
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
    if (sections[next].id === 'projects') {
      glideTo(sections[next].offsetTop, dir, DURATION_SHEETS, easeInOutQuint);   // 尾端更慢
    } else {
      glideTo(sections[next].offsetTop, dir, DURATION);
    }
    return true;
  }

  /* 到端点后的翻页门槛：列表滚到顶/底后，需要在端点继续同方向累计约 1.5 格滚轮量
     才触发翻屏，避免快速滚动余量 / 轻微误触直接把页面翻走。
     复位时机：列表恢复可滚、翻页动画期间、反向滚动、翻屏完成。 */
  var EDGE_GATE = 150;
  var edgeAcc = 0;
  var edgeDir = 0;

  function resetEdgeGate() {
    edgeAcc = 0;
    edgeDir = 0;
  }

  window.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) < 1) return;
    var dir = e.deltaY > 0 ? 1 : -1;

    if (animating) {
      e.preventDefault();
      resetEdgeGate();
      if (glideDir !== 0 && dir !== glideDir) stop();   // 中途反向滚 → 取消本次翻页
      return;
    }

    var sec = sections[currentIndex()];

    /* 无列表的屏（hero）：维持一格即翻 */
    if (!sec.querySelector('.writing__inner')) {
      resetEdgeGate();
      if (move(dir)) e.preventDefault();
      return;
    }

    /* 列表还能滚：交给列表原生滚动，并清空已累计的门槛量 */
    if (innerCanScroll(sec, dir)) {
      resetEdgeGate();
      return;
    }

    /* 列表已到顶/底：同方向累计滚轮量，反向则归零重计 */
    if (dir !== edgeDir) { edgeDir = dir; edgeAcc = 0; }
    edgeAcc += Math.abs(e.deltaY);
    e.preventDefault();

    if (edgeAcc >= EDGE_GATE) {          // 超过门槛 → 翻屏
      resetEdgeGate();
      move(dir);
    }
  }, { passive: false });

  /* 触屏（手机）两种手势：
     ① 卡片列表内：原生滚动；划到顶/底后继续同方向累计约 80px → 翻屏（单次手势内累计，松手清零）。
     ② 列表外（hero / 标题区）：整屏翻页手势——全程接管、不给原生滚动，松手净位移 ≥45px → 翻相邻一屏。
        由 JS 接管后，任何内核都无法因惯性甩动投影而跳过中间屏。 */
  var TOUCH_GATE = 80;                 // 列表端点翻屏门槛
  var PAGE_GATE = 45;                  // 整屏手势翻屏门槛（松手时的净位移）
  var touchAcc = 0;
  var touchDir = 0;
  var touchLastY = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchInInner = false;            // 本手势起手是否在卡片列表内

  function resetTouchGate() {
    touchAcc = 0;
    touchDir = 0;
    touchLastY = null;
  }

  /* 整屏手势翻页：直接翻到相邻屏（不受列表滚动位置影响） */
  function flipFromPageGesture(dir) {
    var idx = currentIndex();
    var next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    if (sections[next].id === 'projects') {
      glideTo(sections[next].offsetTop, dir, DURATION_SHEETS, easeInOutQuint);
    } else {
      glideTo(sections[next].offsetTop, dir, DURATION);
    }
  }

  window.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { resetTouchGate(); touchInInner = true; return; }
    touchAcc = 0;
    touchDir = 0;
    touchLastY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchInInner = !!(e.target && e.target.closest && e.target.closest('.writing__inner'));
  }, { passive: true });

  window.addEventListener('touchcancel', resetTouchGate, { passive: true });

  window.addEventListener('touchend', function (e) {
    if (!touchInInner && touchLastY !== null && e.changedTouches && e.changedTouches.length) {
      var netY = touchStartY - e.changedTouches[0].clientY;   // 上滑为正 = 下一页
      var netX = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(netY) >= PAGE_GATE && Math.abs(netY) > Math.abs(netX)) {
        flipFromPageGesture(netY > 0 ? 1 : -1);
      }
    }
    resetTouchGate();
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 1) { resetTouchGate(); return; }
    if (touchLastY === null) { touchLastY = e.touches[0].clientY; return; }

    var y = e.touches[0].clientY;
    var dy = touchLastY - y;             // 手指上移 = 内容向下滚（与滚轮同向）
    touchLastY = y;

    if (animating) {
      if (e.cancelable) e.preventDefault();   // 翻页动画期间冻结触屏
      return;
    }

    /* 列表外起手（hero / 标题区）：整屏手势，先阻止一切原生滚动（防惯性甩动跳屏） */
    if (!touchInInner) {
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (Math.abs(dy) < 1) return;
    var dir = dy > 0 ? 1 : -1;

    var sec = sections[currentIndex()];

    /* 列表还能滚：交给原生滚动，不拦截 */
    if (innerCanScroll(sec, dir)) {
      resetTouchGate();
      return;
    }

    if (e.cancelable) e.preventDefault();  // 已到顶/底：尽可能拦下橡皮筋与链滚（被浏览器接管的手势拦不住也无妨）
    if (dir !== touchDir) { touchDir = dir; touchAcc = 0; }
    touchAcc += Math.abs(dy);

    if (touchAcc >= TOUCH_GATE) {        // 超过门槛 → 翻屏
      resetTouchGate();
      move(dir);
    }
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
      glideTo(sections[sections.length - 1].offsetTop, 1, DURATION_SHEETS, easeInOutQuint);
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
    if (target.id === 'projects') {
      glideTo(target.offsetTop, idx > currentIndex() ? 1 : -1, DURATION_SHEETS, easeInOutQuint);
    } else {
      glideTo(target.offsetTop, idx > currentIndex() ? 1 : -1, DURATION);
    }
  });
})();

/* 从文章返回：落到文章屏并定位 / 高亮对应卡片。
   三种入口都兼容：新链接（#post-slug）、旧链接（#writing）、以及从文章页点“/”旧链接
   （用 referrer 推断来源文章）——即使浏览器不执行锚点跳转，也能正确定位。 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (root.className.indexOf('home') === -1) return;

  var art = document.getElementById('writing');
  if (!art) return;

  var inner = art.querySelector('.writing__inner');

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  function slugFromReferrer() {
    if (!document.referrer) return null;
    try {
      var u = new URL(document.referrer);
      if (u.origin !== location.origin) return null;
      var m = u.pathname.match(/^\/\d{4}\/\d{2}\/\d{2}\/([^\/]+)\.html$/);
      return m ? safeDecode(m[1]) : null;
    } catch (e) { return null; }
  }

  function arrive() {
    var el = location.hash.length > 1 ? document.getElementById(safeDecode(location.hash.slice(1))) : null;
    var card = null;
    if (!el) {
      var slug = slugFromReferrer();                       // 从文章页返回（含旧链接）
      if (slug) el = card = document.getElementById('post-' + slug);
    } else if (el !== art && el.id !== 'projects' && art.contains(el)) {
      card = el;                                           // #post-xxx 卡片锚点
    }
    if (!el) return;                                       // 正常进入首页：不动

    var top = card ? art.offsetTop : el.offsetTop;
    if (Math.abs(window.scrollY - top) > 2) {
      window.scrollTo({ top: top, behavior: 'instant' });
    }
    root.classList.add('sheets-frosted');                  // 直接落在纸面区：毛玻璃就位

    if (card && inner) {
      var r = card.getBoundingClientRect();
      var ir = inner.getBoundingClientRect();
      var delta = (r.top - ir.top) - 26;                   // 卡片靠近列表顶部一点
      if (Math.abs(delta) > 2) inner.scrollTop += delta;
      card.classList.add('is-highlight');
      window.setTimeout(function () { card.classList.remove('is-highlight'); }, 2200);
    }
  }

  window.addEventListener('load', function () {
    window.requestAnimationFrame(arrive);
  });
})();
