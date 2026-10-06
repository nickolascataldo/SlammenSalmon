// Slammen Salmon booking backend. Zero dependencies (Node 18+).
// Run: copy .env.example to .env, fill it in, then `node server.js`.
// Serves the static site AND /api/* so one process can host everything.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');

// --- tiny .env loader (no dotenv dependency) ---
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env: use real environment variables */ }

const env = process.env, ROOT = path.join(__dirname, '..'), DB = path.join(__dirname, 'bookings.json');
const PORT = env.PORT || 3000;
const GEAR = { provided: 'Needs rods/tackle provided', own: 'Bringing own gear', mix: 'Mix of own and provided gear' };

const readDb = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch (e) { return { bookings: [], alerts: [], subscribers: [] }; } };
const writeDb = d => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
const need = k => { if (!env[k]) throw new Error('Missing env var ' + k); return env[k]; };

async function sendSms(to, body) {
  const sid = need('TWILIO_ACCOUNT_SID');
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(sid + ':' + need('TWILIO_AUTH_TOKEN')).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: need('TWILIO_FROM_NUMBER'), Body: body })
  });
  if (!r.ok) throw new Error('Twilio ' + r.status + ' ' + await r.text());
}
async function sendEmail(to, subject, text) { // Resend (https://resend.com); swap for any provider
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + need('RESEND_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: need('EMAIL_FROM'), to: [to], subject, text })
  });
  if (!r.ok) throw new Error('Email ' + r.status + ' ' + await r.text());
}

const prettyDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function validate(b) {
  const d = new Date(b.date + 'T12:00:00');
  if (isNaN(d) || ![2, 4].includes(d.getDay())) return 'Tours run Tuesdays and Thursdays only.';
  if (!b.name || !b.phone || !/.+@.+\..+/.test(b.email || '')) return 'Name, phone and valid email are required.';
  if (![1, 2].includes(Number(b.partySize))) return 'Party size must be 1 or 2.';
  const c = b.confirmations || {};
  if (!(c.waiver && c.swim && c.englishSpeaker && c.gearRules && c.michiganLicense)) return 'All acknowledgements are required.';
  if (readDb().bookings.some(x => x.date === b.date)) return 'That date is already booked.';
  return null;
}

async function handleBook(b) {
  const err = validate(b);
  if (err) return [400, { error: err }];
  const rec = {
    id: Date.now().toString(36), date: b.date, name: String(b.name).slice(0, 120), partySize: Number(b.partySize),
    phone: String(b.phone).slice(0, 40), email: String(b.email).slice(0, 160), gear: GEAR[b.gear] || GEAR.provided,
    notes: String(b.notes || '').slice(0, 500), remindedAt: null
  };
  const db = readDb(); db.bookings.push(rec); writeDb(db);

  const results = await Promise.allSettled([
    // Owner notification. The destination number only ever comes from the environment.
    (async () => sendSms(need('NOTIFICATION_PHONE_NUMBER'),
      `NEW BOOKING ${prettyDate(rec.date)}\n${rec.name}, party of ${rec.partySize}\n${rec.phone} / ${rec.email}\nGear: ${rec.gear}${rec.notes ? ' (' + rec.notes + ')' : ''}\nConfirmed: waiver, can swim, English speaker, gear rules, MI license`))(),
    sendEmail(rec.email, 'Your Slammen Salmon tour is booked: ' + prettyDate(rec.date),
      `Hi ${rec.name},\n\nYou're booked for a guided salmon drift boat tour on the Pere Marquette River on ${prettyDate(rec.date)}, 8:00 AM to 5:00 PM, starting at the Upper Branch access point in Branch, MI.\n\n` +
      `NO PAYMENT HAS BEEN COLLECTED and none is required online. The full $500 tour fee is paid in person at the start of the tour.\n\n` +
      `Please bring: valid Michigan fishing license, your own waders (NO cleats or studded soles), signed waiver, weather layers.\n\nSee you on the river!\nSlammen Salmon`)
  ]);
  results.forEach((r, i) => { if (r.status === 'rejected') console.error(['SMS', 'Email'][i], 'failed:', r.reason.message); });
  // The booking is saved even if a notification provider is misconfigured; tell the caller honestly.
  return [200, { ok: true, notified: results.every(r => r.status === 'fulfilled') }];
}

// 24-hour reminder: runs every 15 min, sends once in the 24h before the 8 AM start.
async function reminders() {
  const db = readDb(); let changed = false; const now = Date.now();
  for (const b of db.bookings) {
    const start = new Date(b.date + 'T08:00:00').getTime();
    if (b.remindedAt || start < now || start - now > 24 * 3600e3) continue;
    const msg = `Reminder: your Slammen Salmon tour is tomorrow, ${prettyDate(b.date)}. Departure 8:00 AM, Upper Branch access point, Branch MI. Bring your valid Michigan fishing license, waders (NO cleats or studded soles), signed waiver, weather layers, and $500 payment (paid in person).`;
    const r = await Promise.allSettled([sendEmail(b.email, 'Tomorrow: your salmon tour on the Pere Marquette', msg), sendSms(b.phone, msg)]);
    if (r.some(x => x.status === 'fulfilled')) { b.remindedAt = new Date().toISOString(); changed = true; }
    else console.error('Reminder failed for', b.id);
  }
  if (changed) writeDb(db);
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' };
const readBody = req => new Promise((ok, no) => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e5) req.destroy(); });
  req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { no(e); } });
});

http.createServer(async (req, res) => {
  const json = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  try {
    if (req.method === 'POST' && req.url.startsWith('/api/')) {
      const b = await readBody(req), db = readDb();
      if (req.url === '/api/book') return json(...await handleBook(b));
      if (req.url === '/api/alert' || req.url === '/api/subscribe') {
        if (!/.+@.+\..+/.test(b.email || '')) return json(400, { error: 'Valid email required.' });
        db[req.url === '/api/alert' ? 'alerts' : 'subscribers'].push({ email: b.email, at: new Date().toISOString() });
        writeDb(db); return json(200, { ok: true });
      }
      return json(404, { error: 'Not found' });
    }
    // static files (never serve the server folder)
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || f.startsWith(__dirname) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { console.error(e); json(500, { error: 'Server error' }); }
}).listen(PORT, () => {
  console.log('Slammen Salmon on http://localhost:' + PORT);
  setInterval(() => reminders().catch(console.error), 15 * 60e3);
});
