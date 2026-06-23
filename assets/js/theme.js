/*
 * Theme toggle (light/dark) + scroll-reveal.
 * The initial theme is set inline in <head> before paint to avoid a flash;
 * this file wires up the toggle button and progressive-enhancement animation.
 */
(function () {
  var root = document.documentElement;

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      // Persist via both localStorage and a cookie so the choice survives
      // navigation even if one storage mechanism is unavailable.
      try { localStorage.setItem('theme', next); } catch (e) {}
      try { document.cookie = 'theme=' + next + ';path=/;max-age=31536000;samesite=lax'; } catch (e) {}
    });
  }

  // ---- Scroll reveal (only animates content below the fold) ----
  function initReveal() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) { return; }

    var selector = [
      '.page__content > p',
      '.page__content > figure',
      '.page__content > h2',
      '.page__content > h3',
      '.page__content > blockquote',
      '.page__content > ul',
      '.page__content > .home-cards',
      '.archive__item'
    ].join(',');

    var targets = document.querySelectorAll(selector);
    if (!targets.length) { return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    var fold = window.innerHeight * 0.92;
    Array.prototype.forEach.call(targets, function (el) {
      // Leave anything already on screen untouched — no flash on load.
      if (el.getBoundingClientRect().top < fold) { return; }
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  if (document.readyState !== 'loading') { initReveal(); }
  else { document.addEventListener('DOMContentLoaded', initReveal); }
})();
