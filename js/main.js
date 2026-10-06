(function () {
  'use strict';
  var API_BASE = '/api'; // serverless functions live in /server (see server/README.md)

  /* ---------- Shared: nav, footer ---------- */
  var menuBtn = document.getElementById('menuBtn'), navLinks = document.getElementById('navLinks');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var o = navLinks.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o);
  });
  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();

  function show(el, text, ok) { el.textContent = text; el.className = 'form-msg show ' + (ok ? 'ok' : 'err'); }

  function post(path, data) {
    return fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json().catch(function () { return {}; }); });
  }
  var DEMO = 'The booking server is not connected yet, so nothing was sent. Please text us instead.';

  var news = document.getElementById('newsForm');
  if (news) news.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = document.getElementById('newsMsg');
    post('/subscribe', { email: document.getElementById('newsEmail').value })
      .then(function () { m.textContent = 'Thanks, you are on the list!'; })
      .catch(function () { m.textContent = 'Newsletter signup is not live yet.'; });
  });

  /* ---------- Lightbox ---------- */
  var grid = document.getElementById('photoGrid');
  if (grid) {
    var items = [].slice.call(grid.querySelectorAll('.photo')), idx = 0;
    var lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg'), lbCap = document.getElementById('lbCap');
    var opener = null;
    function open(i) {
      idx = (i + items.length) % items.length;
      lbImg.src = items[idx].dataset.full; lbImg.alt = items[idx].querySelector('img').alt; lbCap.textContent = items[idx].dataset.cap || '';
      lb.classList.add('open'); document.body.style.overflow = 'hidden';
    }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; if (opener) opener.focus(); }
    items.forEach(function (b, i) { b.addEventListener('click', function () { opener = b; open(i); document.getElementById('lbClose').focus(); }); });
    document.getElementById('lbClose').onclick = close;
    document.getElementById('lbPrev').onclick = function () { open(idx - 1); };
    document.getElementById('lbNext').onclick = function () { open(idx + 1); };
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') open(idx - 1); if (e.key === 'ArrowRight') open(idx + 1);
    });
  }

  /* ---------- Booking ---------- */
  var form = document.getElementById('bookingForm');
  if (!form) return;

  function nthWeekday(year, month, weekday, n) { // month 0-based, weekday 0=Sun
    var d = new Date(year, month, 1), diff = (weekday - d.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  }
  function seasonFor(year) { return { start: nthWeekday(year, 8, 2, 2), end: nthWeekday(year, 9, 4, 3), opens: new Date(year, 7, 1) }; }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function pretty(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }

  var today = startOfDay(new Date()), year = today.getFullYear(), s = seasonFor(year);
  if (today > s.end) { year++; s = seasonFor(year); }
  var isOpen = today >= s.opens;

  var statusEl = document.getElementById('bookingStatus'), fs = document.getElementById('bookingFieldset');
  var alertForm = document.getElementById('alertForm'), sel = document.getElementById('tourDate');

  if (!isOpen) {
    statusEl.innerHTML = '<span class="status-badge">Not Open for Scheduling Yet</span> <span>The ' + year + ' season (' + pretty(s.start).replace(/^\w+, /, '') + ' – ' + pretty(s.end).replace(/^\w+, /, '') + ') opens for reservations August 1.</span>';
    fs.disabled = true; sel.disabled = true; document.getElementById('bookBtn').disabled = true; alertForm.hidden = false;
  } else {
    statusEl.innerHTML = '<span class="status-badge open">Now Booking</span> <span>' + year + ' season: ' + pretty(s.start).replace(/^\w+, /, '') + ' – ' + pretty(s.end).replace(/^\w+, /, '') + '</span>';
    var d = new Date(s.start), count = 0;
    while (d <= s.end) {
      if ((d.getDay() === 2 || d.getDay() === 4) && d > today) {
        var o = document.createElement('option'); o.value = iso(d); o.textContent = pretty(d); sel.appendChild(o); count++;
      }
      d.setDate(d.getDate() + 1);
    }
    if (!count) { sel.disabled = true; statusEl.innerHTML += ' <span>No dates remaining this season.</span>'; }
  }

  alertForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = document.getElementById('alertMsg');
    post('/alert', { email: document.getElementById('alertEmail').value })
      .then(function () { show(m, 'You are on the list. We will email you when booking opens.', true); })
      .catch(function () { show(m, DEMO, false); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = document.getElementById('bookMsg');
    var v = function (id) { return document.getElementById(id).value.trim(); };
    if (!v('tourDate') || !v('gName') || !v('gPhone') || !/.+@.+\..+/.test(v('gEmail'))) return show(m, 'Please choose a date and complete your name, phone and a valid email.', false);
    for (var i = 1; i <= 5; i++) if (!document.getElementById('c' + i).checked) return show(m, 'Please confirm all five acknowledgements before reserving.', false);
    var btn = document.getElementById('bookBtn'); btn.disabled = true;
    post('/book', {
      date: v('tourDate'), name: v('gName'), partySize: +v('gSize'), phone: v('gPhone'), email: v('gEmail'),
      gear: v('gGear'), notes: v('gNotes'),
      confirmations: { waiver: true, swim: true, englishSpeaker: true, gearRules: true, michiganLicense: true }
    }).then(function (res) {
      show(m, 'Reserved for ' + pretty(new Date(v('tourDate') + 'T12:00:00')) + '. ' +
        (res.notified === false ? 'Your spot is saved, but we could not send the confirmation email yet. We will follow up by text. ' : 'A confirmation email is on its way. ') +
        'No payment is due online. Pay $500 in person at the start of the tour.', true);
      form.reset();
    }).catch(function () { show(m, DEMO, false); }).then(function () { btn.disabled = false; });
  });
})();
