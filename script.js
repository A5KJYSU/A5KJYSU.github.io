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

/* 翻页状态：当文章页成为当前页时，给 <html> 加 page-writing，
   让毛玻璃在翻页过程中平滑「雾化」（无 JS 时由 CSS 兜底直接显示毛玻璃） */
(function () {
  'use strict';

  var sheet = document.querySelector('.writing');
  if (!sheet || !('IntersectionObserver' in window)) return;

  var root = document.documentElement;

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      root.classList.toggle('page-writing', entry.intersectionRatio >= 0.5);
    });
  }, { threshold: 0.5 });

  io.observe(sheet);
})();
