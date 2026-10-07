// Interactive float map: real OpenStreetMap / topo / satellite tiles with the actual river route.
(function () {
  'use strict';
  var el = document.getElementById('routeMap');
  if (!el) return;
  if (!window.L) { el.innerHTML = '<p class="map-fallback">The live map could not load. Open the <a href="https://www.google.com/maps/dir/?api=1&origin=43.92861,-86.02028&destination=43.93528,-86.05083" target="_blank" rel="noopener">put-in and take-out in Google Maps</a>.</p>'; return; }

  var route = window.PM_ROUTE, start = window.PM_PUTIN, end = window.PM_TAKEOUT;
  var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;

  var map = L.map(el, { scrollWheelZoom: false, dragging: !coarse, touchZoom: !coarse, zoomControl: true, attributionControl: true });

  var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
  var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, subdomains: 'abc', attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' });
  var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' });
  osm.addTo(map);
  L.control.layers({ 'Map': osm, 'Topo': topo, 'Satellite': sat }, null, { collapsed: window.innerWidth < 768, position: 'topright' }).addTo(map);

  // Route: white casing under a copper line so it reads on any base layer.
  L.polyline(route, { color: '#ffffff', weight: 9, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  var line = L.polyline(route, { color: '#C85A32', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(map);

  // Downstream arrows along the line.
  function bearing(a, b) {
    var r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
    var x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  for (var i = 18; i < route.length - 6; i += 24) {
    var deg = bearing(route[i], route[i + 5]);
    L.marker(route[i], {
      interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'route-arrow', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="0 0 16 16" width="18" height="18" style="transform:rotate(' + deg.toFixed(0) + 'deg)"><path d="M8 1l6 13-6-3-6 3z" fill="#fff" stroke="#8f3a19" stroke-width="1.4" stroke-linejoin="round"/></svg>' })
    }).addTo(map);
  }

  function gmaps(p) { return 'https://www.google.com/maps/search/?api=1&query=' + p.lat + ',' + p.lng; }
  function pin(p, cls, label, title, blurb) {
    var m = L.marker([p.lat, p.lng], { title: title, riseOnHover: true,
      icon: L.divIcon({ className: 'route-pin ' + cls, iconSize: [30, 30], iconAnchor: [15, 15], html: '<span>' + label + '</span>' }) }).addTo(map);
    m.bindPopup('<b>' + title + '</b><br>' + blurb + '<br><a href="' + gmaps(p) + '" target="_blank" rel="noopener">Open in Google Maps</a>');
    m.bindTooltip(cls === 'start' ? 'Put-in' : 'Take-out', { permanent: true, direction: cls === 'start' ? 'bottom' : 'top', offset: [0, cls === 'start' ? 10 : -10], className: 'route-tip' });
    return m;
  }
  pin(start, 'start', 'A', 'Put-in: ' + start.name, 'U.S. Forest Service access. We push off here around 8:00 AM.');
  pin(end, 'end', 'B', 'Take-out: ' + end.name, 'Back-in U.S. Forest Service access surrounded by private property. We wrap up here around 5:00 PM.');

  // Fit the whole route in view, and re-fit if the container is resized (or was hidden/zero-width at load)
  // until the visitor starts panning or zooming themselves.
  var userMoved = false, fitting = false;
  function fit() { fitting = true; map.fitBounds(line.getBounds(), { padding: [48, 48], animate: false }); fitting = false; }
  fit();
  map.on('dragstart zoomstart', function () { if (!fitting) userMoved = true; });
  if (window.ResizeObserver) new ResizeObserver(function () {
    if (!el.offsetWidth) return;
    map.invalidateSize({ animate: false });
    if (!userMoved) fit();
  }).observe(el);

  // Desktop: wheel-zoom only after clicking the map, so page scrolling is never hijacked.
  map.on('click', function () { map.scrollWheelZoom.enable(); });
  map.on('mouseout', function () { map.scrollWheelZoom.disable(); });

  // Touch devices: one-finger scrolling stays with the page until the visitor opts in.
  var lock = document.getElementById('mapLock');
  if (lock) {
    if (coarse) {
      lock.hidden = false;
      lock.addEventListener('click', function () {
        map.dragging.enable(); map.touchZoom.enable(); lock.hidden = true;
        setTimeout(function () { map.invalidateSize(); }, 50);
      });
    } else lock.hidden = true;
  }

  // River distance for the page copy, computed from the actual line.
  function hav(a, b) { var R = 6371000, t = Math.PI / 180, dl = (b[0] - a[0]) * t, dn = (b[1] - a[1]) * t;
    var h = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dn / 2) * Math.sin(dn / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
  var m = 0; for (var k = 1; k < route.length; k++) m += hav(route[k - 1], route[k]);
  document.querySelectorAll('[data-route-miles]').forEach(function (n) { n.textContent = (m / 1609.34).toFixed(1); });
})();
