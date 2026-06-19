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
    pledgeCountSeed: 1284,
    // Base URL of the comment API. Leave '' to stay client-only (localStorage).
    // Set to e.g. 'https://vallejo-street-api-xxxx.run.app' once deployed.
    apiBase: '',
  };

  var SHARE_TEXT = "Stop the Vallejo Street Takeover — SFPD wants to convert the lower half of Vallejo Street into a police-only tow-away zone. Speak up before June 26.";
  var SHARE_TITLE = "Stop the Vallejo Street Takeover";

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
  var success = $('#pledge-success');
  var countEl = $('#pledge-count-num');
  var pledgeCount = CONFIG.pledgeCountSeed;

  function readStored() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  }
  function showSuccessState() {
    if (form) form.hidden = true;
    if (success) success.hidden = false;
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
    if (stored.pledged) showSuccessState();
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
      };

      // Optimistically reflect the submission locally.
      pledgeCount = (pledgeCount || CONFIG.pledgeCountSeed) + 1;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ pledged: true, count: pledgeCount, lastEntry: entry }));
      } catch (err) {}

      showSuccessState();
      renderCount();

      // If an API base is configured, POST to the backend (best-effort).
      // The UI already shows success; a failure here just keeps the local record.
      if (CONFIG.apiBase) {
        fetch(CONFIG.apiBase.replace(/\/$/, '') + '/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        }).catch(function () {});
      }
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
        'SUMMARY:Public Meeting — Stop the Vallejo Street Takeover',
        'DESCRIPTION:Call-in #: 415-523-2709. Contact danny.sauter@sfgov.org',
        'LOCATION:Call-in #: 415-523-2709',
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
      navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: currentUrl() }).catch(function () {});
    } else {
      copyLink();
    }
  });
  bind('#share-x', function () {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(SHARE_TEXT) + '&url=' + encodeURIComponent(currentUrl()), '_blank', 'noopener');
  });
  bind('#share-fb', function () {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(currentUrl()), '_blank', 'noopener');
  });
  bind('#share-email', function () {
    window.location.href = 'mailto:?subject=' + encodeURIComponent(SHARE_TITLE) + '&body=' + encodeURIComponent(SHARE_TEXT + ' ' + currentUrl());
  });

  var copyBtn = $('#copy-link');
  function copyLink() {
    var done = function () {
      if (!copyBtn) return;
      copyBtn.textContent = 'Link copied!';
      setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 1800);
    };
    try {
      navigator.clipboard.writeText(currentUrl()).then(done).catch(done);
    } catch (e) { done(); }
  }
  bind('#copy-link', copyLink);

  /* ---- helpers ---- */
  function bind(sel, fn) {
    var el = $(sel);
    if (el) el.addEventListener('click', fn);
  }
  function hide(el) { if (el) el.hidden = true; }
})();
