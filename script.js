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
    var leaving = prevRatio !== null && (prevRatio - r) > 0.1;

    if (leaving) {
      root.classList.remove('page-writing');
    } else if (r >= 0.5) {
      root.classList.add('page-writing');
    }

    prevRatio = r;
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  io.observe(sheet);
})();
