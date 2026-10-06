(function () {
  'use strict';
  var KEY = 'slammen.catches.v1';
  var SEED = [
    { id: 's1', photo: 'images/king-in-boat.jpg', species: 'Chinook salmon', location: 'Pere Marquette River', weight: 28, length: 42, bait: 'Plug', when: '2025-10-07T10:30' },
    { id: 's2', photo: 'images/trophy-king.webp', species: 'Chinook salmon', location: 'Pere Marquette River', weight: 31, length: 44, bait: 'Spawn bag', when: '2025-09-25T09:15' }
  ];
  function load() { try { var r = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(r)) return r; } catch (e) {} return SEED.slice(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { alert('Could not save: browser storage is full or blocked.'); } }
  var data = load();
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function fillSelect(sel, key) {
    var cur = sel.value, vals = [];
    data.forEach(function (c) { if (c[key] && vals.indexOf(c[key]) < 0) vals.push(c[key]); });
    sel.innerHTML = '<option value="">All</option>' + vals.sort().map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
    sel.value = vals.indexOf(cur) >= 0 ? cur : '';
  }
  function render() {
    fillSelect($('fSpecies'), 'species'); fillSelect($('fLoc'), 'location');
    var q = $('q').value.toLowerCase(), sp = $('fSpecies').value, lo = $('fLoc').value, from = $('fFrom').value, to = $('fTo').value;
    var rows = data.filter(function (c) {
      var day = (c.when || '').slice(0, 10);
      return (!sp || c.species === sp) && (!lo || c.location === lo) && (!from || day >= from) && (!to || day <= to) &&
        (!q || [c.species, c.location, c.bait].join(' ').toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return (b.when || '').localeCompare(a.when || ''); });
    $('catchGrid').innerHTML = rows.map(function (c) {
      return '<article class="card">' + (c.photo ? '<img src="' + esc(c.photo) + '" alt="' + esc(c.species) + '" loading="lazy">' : '') +
        '<div class="card-body"><span class="tag">' + esc(c.species) + '</span><h3>' + esc(c.location) + '</h3><div class="catch-meta">' +
        (c.weight ? '<span>' + esc(c.weight) + ' lb</span>' : '') + (c.length ? '<span>' + esc(c.length) + ' in</span>' : '') +
        (c.bait ? '<span>Bait: ' + esc(c.bait) + '</span>' : '') + '<span>' + esc(new Date(c.when).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })) + '</span></div></div></article>';
    }).join('');
    $('empty').hidden = rows.length > 0;
  }
  ['q', 'fSpecies', 'fLoc', 'fFrom', 'fTo'].forEach(function (id) { $(id).addEventListener('input', render); });

  var modal = $('modal');
  function openModal() { $('mWhen').value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16); modal.classList.add('open'); $('mSpecies').focus(); }
  function closeModal() { modal.classList.remove('open'); $('catchForm').reset(); $('fab').focus(); }
  $('fab').onclick = openModal; $('mCancel').onclick = closeModal;
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  // Downscale uploaded photos so localStorage doesn't overflow.
  function shrink(file, cb) {
    if (!file) return cb('');
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 800 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = function () { cb(''); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  $('catchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    shrink($('mPhoto').files[0], function (photo) {
      data.push({ id: 'c' + Date.now(), photo: photo, species: $('mSpecies').value.trim(), location: $('mLoc').value.trim(),
        weight: $('mWeight').value, length: $('mLen').value, bait: $('mBait').value.trim(), when: $('mWhen').value });
      save(); closeModal(); render();
    });
  });
  render();
})();
