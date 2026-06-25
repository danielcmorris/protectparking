/* ============================================================
   Stop the Vallejo Street Takeover — interactions
   Ported from the design prototype's component logic to vanilla JS.
   ============================================================ */
(function () {
  'use strict';

  /* ---- config / feature flags (prototype "props") ---- */
  var CONFIG = {
    showTicker: true,
    showPledgeCount: true,
    showShareBar: true,
    // TODO(production): seed from a real backend count, or set to null to hide.
    pledgeCountSeed: 28,
    // Base URL of the comment API. Empty '' = same origin (the API serves this
    // site), so the form POSTs to /api/comments. Set to an absolute URL only if
    // the API is hosted on a different origin.
    apiBase: '',
  };

  // English fallbacks; the active strings come from i18n (see i18n.js / i18n/*.json).
  var FALLBACK = {
    'share.text': "Stop the Vallejo Street Takeover — SFPD wants to convert the lower half of Vallejo Street into a police-only tow-away zone. Speak up before June 26.",
    'share.title': "Stop the Vallejo Street Takeover",
    'share.copyLink': "Copy link",
    'share.copied': "Link copied!",
    'ics.summary': "Public Meeting — Stop the Vallejo Street Takeover",
    'ics.description': "Call-in #: 415.523.2709. and enter conference ID 836 632 456#",
    'ics.location': "Call-in #: 415-523-2709",
  };
  // Resolve a string by key at call time, so the current language is honored.
  function L(key) {
    var v = (window.i18n && window.i18n.t) ? window.i18n.t(key) : '';
    return v || FALLBACK[key] || '';
  }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ---- feature flags: hide toggled-off sections ---- */
  if (!CONFIG.showTicker) hide($('#ticker'));
  if (!CONFIG.showShareBar) hide($('#share-card'));
  if (!CONFIG.showPledgeCount) hide($('#pledge-count'));

  /* ---- mobile nav ---- */
  var hamburger = $('#hamburger');
  var mobileMenu = $('#mobile-menu');

  function setMenu(open) {
    if (!hamburger || !mobileMenu) return;
    hamburger.setAttribute('aria-expanded', String(open));
    mobileMenu.hidden = !open;
  }
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      setMenu(hamburger.getAttribute('aria-expanded') !== 'true');
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.js-close-menu'), function (link) {
    link.addEventListener('click', function () { setMenu(false); });
  });
  // close menu when crossing the desktop breakpoint
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 880) setMenu(false);
  });

  /* ---- accordion (each row independent) ---- */
  Array.prototype.forEach.call(document.querySelectorAll('.accordion__btn'), function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.style.maxHeight = open ? '0px' : '320px';
    });
  });

  /* ---- comment form ---- */
  var STORAGE_KEY = 'vallejoPledge';
  var form = $('#pledge-form');
  var spinner = $('#pledge-spinner');
  var success = $('#pledge-success');
  var successClose = $('#pledge-success-close');
  var countEl = $('#pledge-count-num');
  var pledgeCount = CONFIG.pledgeCountSeed;
  var MIN_SPINNER_MS = 1500;

  function readStored() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  }
  // Exactly one of the three pledge views is visible: 'form' | 'spinner' | 'success'.
  function showState(state) {
    if (form) form.hidden = state !== 'form';
    if (spinner) spinner.hidden = state !== 'spinner';
    if (success) success.hidden = state !== 'success';
  }
  function renderCount() {
    if (countEl && typeof pledgeCount === 'number') {
      countEl.textContent = pledgeCount.toLocaleString('en-US');
    }
  }

  // hydrate from prior submission
  var stored = readStored();
  if (stored) {
    if (typeof stored.count === 'number') pledgeCount = stored.count;
    if (stored.pledged) showState('success');
  }
  renderCount();

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var email = (data.get('email') || '').toString().trim();
      if (!email) { form.reportValidity(); return; }

      var entry = {
        name: (data.get('name') || '').toString().trim(),
        address: (data.get('address') || '').toString().trim(),
        email: email,
        district3: data.get('district3') === 'on',
        comment: (data.get('comment') || '').toString().trim(),
        // Checked "don't publish" => keep private; otherwise queue for review.
        // An admin manually promotes a comment to 'public'.
        visibility: data.get('noPublish') === 'on' ? 'private' : 'to-review',
      };

      // Hide the form and show the spinner while the post is in flight.
      showState('spinner');
      var started = Date.now();

      // Only reveal the confirmation once the post has returned AND the spinner
      // has been visible for at least MIN_SPINNER_MS. The backend is best-effort,
      // so a network failure still confirms (the local record is kept).
      function finalize() {
        var wait = Math.max(0, MIN_SPINNER_MS - (Date.now() - started));
        setTimeout(function () {
          pledgeCount = (pledgeCount || CONFIG.pledgeCountSeed) + 1;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ pledged: true, count: pledgeCount, lastEntry: entry }));
          } catch (err) {}
          renderCount();
          showState('success');
        }, wait);
      }

      // POST to the backend (same origin when apiBase is ''). finalize on either outcome.
      fetch(CONFIG.apiBase.replace(/\/$/, '') + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).then(finalize, finalize);
    });
  }

  // Close the confirmation: clear the pledged flag (keep the count) and show a blank form.
  if (successClose) {
    successClose.addEventListener('click', function () {
      try {
        var s = readStored() || {};
        s.pledged = false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch (e) {}
      if (form) form.reset();
      showState('form');
    });
  }

  /* ---- add to calendar (.ics download) ---- */
  var calBtn = $('#add-to-calendar');
  if (calBtn) {
    calBtn.addEventListener('click', function () {
      var dt = '20260626T100000', de = '20260626T110000';
      var ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vallejo Street//EN', 'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:' + Date.now() + '@vallejo-street',
        'DTSTAMP:' + dt, 'DTSTART:' + dt, 'DTEND:' + de,
        'SUMMARY:' + L('ics.summary'),
        'DESCRIPTION:' + L('ics.description'),
        'LOCATION:' + L('ics.location'),
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      var blob = new Blob([ics], { type: 'text/calendar' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'vallejo-meeting.ics';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  /* ---- share ---- */
  function currentUrl() { return location.href; }

  bind('#share-native', function () {
    if (navigator.share) {
      navigator.share({ title: L('share.title'), text: L('share.text'), url: currentUrl() }).catch(function () {});
    } else {
      copyLink();
    }
  });
  bind('#share-x', function () {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(L('share.text')) + '&url=' + encodeURIComponent(currentUrl()), '_blank', 'noopener');
  });
  bind('#share-fb', function () {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentUrl()), '_blank', 'noopener');
  });
  bind('#share-email', function () {
    window.location.href = 'mailto:?subject=' + encodeURIComponent(L('share.title')) + '&body=' + encodeURIComponent(L('share.text') + ' ' + currentUrl());
  });

  var copyBtn = $('#copy-link');
  function copyLink() {
    var done = function () {
      if (!copyBtn) return;
      copyBtn.textContent = L('share.copied');
      setTimeout(function () { copyBtn.textContent = L('share.copyLink'); }, 1800);
    };
    try {
      navigator.clipboard.writeText(currentUrl()).then(done).catch(done);
    } catch (e) { done(); }
  }
  bind('#copy-link', copyLink);

  /* ---- neighbor voices: scrolling public comments ---- */
  function buildNeighborCard(c) {
    var card = document.createElement('figure');
    card.className = 'neighbor-card';

    var commentText = c.comment || '';
    var name = (c.name || '').trim() || L('neighbors.anon') || 'A neighbor';

    var quote = document.createElement('blockquote');
    quote.className = 'neighbor-card__quote';
    quote.textContent = commentText;
    card.appendChild(quote);

    var cite = document.createElement('figcaption');
    cite.className = 'neighbor-card__name';
    cite.textContent = name;
    card.appendChild(cite);

    // Click/tap (or keyboard) to read the full comment in a dialog.
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', function () { openNeighborDialog(commentText, name); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNeighborDialog(commentText, name); }
    });

    return card;
  }

  function pauseNeighbors(paused) {
    var track = $('#neighbors-track');
    if (track) track.style.animationPlayState = paused ? 'paused' : '';
  }

  function openNeighborDialog(comment, name) {
    var dlg = $('#neighbor-dialog');
    if (!dlg) return;
    $('#neighbor-dialog-quote').textContent = comment;
    $('#neighbor-dialog-name').textContent = name;
    pauseNeighbors(true);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  (function wireNeighborDialog() {
    var dlg = $('#neighbor-dialog');
    if (!dlg) return;
    function close() {
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
      pauseNeighbors(false);
    }
    var closeBtn = $('#neighbor-dialog-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    // Click on the backdrop (outside the inner content) closes too.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () { pauseNeighbors(false); });
  })();

  function loadNeighborVoices() {
    var section = $('#neighbors');
    var track = $('#neighbors-track');
    if (!section || !track) return;

    fetch(CONFIG.apiBase.replace(/\/$/, '') + '/api/comments/public?limit=60')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var items = (data && data.comments) || [];
        if (!items.length) return; // nothing public yet — leave the section hidden

        items.forEach(function (c) { track.appendChild(buildNeighborCard(c)); });
        // Duplicate the set so the -50% marquee loops seamlessly.
        items.forEach(function (c) {
          var clone = buildNeighborCard(c);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        });
        // Slow the scroll down for short lists so it isn't frantic.
        var seconds = Math.max(30, items.length * 7);
        track.style.animationDuration = seconds + 's';

        section.hidden = false;
      })
      .catch(function () { /* keep section hidden on error */ });
  }
  loadNeighborVoices();

  /* ---- helpers ---- */
  function bind(sel, fn) {
    var el = $(sel);
    if (el) el.addEventListener('click', fn);
  }
  function hide(el) { if (el) el.hidden = true; }
})();
