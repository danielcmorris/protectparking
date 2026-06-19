/* ============================================================
   Lightweight client-side i18n for the campaign page.
   - String tables live in i18n/<lang>.json
   - Markup binds via data-i18n (textContent), data-i18n-html
     (innerHTML, for strings containing inline tags), and
     data-i18n-attr="attr:key|attr2:key2" (attributes).
   - Selected language persists in localStorage and is exposed
     to script.js via window.i18n.t(key).
   ============================================================ */
(function () {
  'use strict';

  var DEFAULT = 'en';
  var SUPPORTED = { en: true, zh: true };
  var HTML_LANG = { en: 'en', zh: 'zh-Hant' };
  var STORE = 'vallejoLang';

  var cache = {};       // lang -> parsed JSON
  var strings = {};     // currently active table
  var current = DEFAULT;

  function resolve(obj, path) {
    if (!obj) return undefined;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function t(key) {
    var v = resolve(strings, key);
    if (v == null) v = resolve(cache[DEFAULT], key); // fall back to English
    return v == null ? '' : v;
  }

  function getStored() {
    try {
      var l = localStorage.getItem(STORE);
      if (l && SUPPORTED[l]) return l;
    } catch (e) {}
    return null;
  }

  function each(sel, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
  }

  function applyDom() {
    document.documentElement.lang = HTML_LANG[current] || 'en';

    each('[data-i18n]', function (el) {
      var v = resolve(strings, el.getAttribute('data-i18n'));
      if (v != null) el.textContent = v;
    });

    each('[data-i18n-html]', function (el) {
      var v = resolve(strings, el.getAttribute('data-i18n-html'));
      if (v != null) el.innerHTML = v;
    });

    each('[data-i18n-attr]', function (el) {
      el.getAttribute('data-i18n-attr').split('|').forEach(function (pair) {
        var idx = pair.indexOf(':');
        if (idx < 0) return;
        var attr = pair.slice(0, idx).trim();
        var key = pair.slice(idx + 1).trim();
        var v = resolve(strings, key);
        if (v != null) el.setAttribute(attr, v);
      });
    });

    // Document/meta that aren't simple elements.
    var title = resolve(strings, 'meta.title');
    if (title) document.title = title;

    each('[data-lang-btn]', function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang-btn') === current));
    });

    window.i18n.lang = current;
    window.i18n.strings = strings;
    document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: current } }));
  }

  function load(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch('i18n/' + lang + '.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('i18n: failed to load ' + lang);
        return r.json();
      })
      .then(function (j) { cache[lang] = j; return j; });
  }

  function setLang(lang) {
    if (!SUPPORTED[lang]) lang = DEFAULT;
    // English is also the literal markup, so guarantee its table is available
    // for fallback even when starting in another language.
    var pre = lang === DEFAULT ? Promise.resolve() : load(DEFAULT).catch(function () {});
    return pre.then(function () { return load(lang); })
      .then(function (j) {
        current = lang;
        strings = j;
        try { localStorage.setItem(STORE, lang); } catch (e) {}
        applyDom();
      })
      .catch(function (e) {
        if (window.console) console.error(e);
      })
      .then(function () {
        document.documentElement.classList.remove('i18n-busy');
      });
  }

  window.i18n = { t: t, setLang: setLang, lang: current, strings: strings };

  function init() {
    each('[data-lang-btn]', function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        setLang(b.getAttribute('data-lang-btn'));
      });
    });
    setLang(getStored() || DEFAULT);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
