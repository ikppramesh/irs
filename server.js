import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as rk from 'railkit';

// Key comes from the environment (.env locally, Vercel settings), or from an optional
// committed railkit.key.js (`export default 'railkit_...'`) for deploys without env vars.
const fileKey = await import('./railkit.key.js').then((m) => m.default).catch(() => undefined);
const API_KEY = process.env.RAILKIT_API_KEY || fileKey;
// Don't exit when the key is missing: on Vercel that crashes the function with
// FUNCTION_INVOCATION_FAILED. Serve the page and explain the problem from /api instead.
if (API_KEY) rk.configure(API_KEY);
else console.error('Missing RAILKIT_API_KEY (set it in .env locally or in Vercel → Settings → Environment Variables)');

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel, public/ is served by the CDN; this covers local runs.
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', (req, res, next) => {
  if (API_KEY) return next();
  res.status(500).json({ success: false, error: 'Server is missing RAILKIT_API_KEY. Add it to the environment variables and redeploy.' });
});

// --- validation helpers -------------------------------------------------
const CLASSES = ['1A', '2A', '3A', '3E', 'CC', 'EC', 'EA', 'FC', 'SL', '2S', 'VS', 'CH', 'HS', 'VC', 'VA'];
const QUOTAS = ['GN', 'TQ', 'LD', 'SS', 'PT', 'DF', 'FT', 'LB', 'YU', 'DP', 'HP', 'PH'];

class BadRequest extends Error {}

const trainNo = (v) => {
  if (!/^\d{5}$/.test(v || '')) throw new BadRequest('Train number must be 5 digits');
  return v;
};
const stn = (v) => {
  const s = String(v || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,5}$/.test(s)) throw new BadRequest('Invalid station code');
  return s;
};
const oneOf = (list, label) => (v) => {
  const s = String(v || '').toUpperCase();
  if (!list.includes(s)) throw new BadRequest(`Invalid ${label}`);
  return s;
};
// Accepts YYYY-MM-DD (from <input type=date>) or DD-MM-YYYY; returns DD-MM-YYYY.
const date = (v, { optional = false } = {}) => {
  if (!v && optional) return undefined;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v || '');
  if (m) return v;
  throw new BadRequest('Date must be YYYY-MM-DD or DD-MM-YYYY');
};
const text = (v, min = 2) => {
  const s = String(v || '').trim();
  if (s.length < min || s.length > 40) throw new BadRequest(`Enter at least ${min} characters`);
  return s;
};

// --- small TTL cache so repeated lookups don't burn API quota --------------
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  const value = await fn();
  if (value?.success) cache.set(key, { value, exp: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return value;
}

const MIN = 60_000;
const route = (urlPath, ttl, handler) =>
  app.get(urlPath, async (req, res) => {
    try {
      const { key, call } = handler(req.query);
      const result = await cached(`${urlPath}|${key}`, ttl, call);
      res.status(result?.success ? 200 : 502).json(result ?? { success: false, error: 'Empty response' });
    } catch (err) {
      const status = err instanceof BadRequest ? 400 : 500;
      res.status(status).json({ success: false, error: err.message || 'Something went wrong' });
    }
  });

// --- API routes -------------------------------------------------------------
route('/api/stations', 24 * 60 * MIN, (q) => {
  const name = text(q.q);
  return { key: name.toLowerCase(), call: () => rk.stationsByName(name) };
});

route('/api/trains/search', 24 * 60 * MIN, (q) => {
  const name = text(q.q);
  return { key: name.toLowerCase(), call: () => rk.trainsByName(name) };
});

route('/api/between', 30 * MIN, (q) => {
  const from = stn(q.from), to = stn(q.to), d = date(q.date, { optional: true });
  return { key: `${from}|${to}|${d}`, call: () => rk.searchTrainBetweenStations(from, to, d) };
});

route('/api/train', 6 * 60 * MIN, (q) => {
  const t = trainNo(q.train);
  return { key: t, call: () => rk.getTrainInfo(t) };
});

route('/api/fare', 60 * MIN, (q) => {
  const t = trainNo(q.train), from = stn(q.from), to = stn(q.to), d = date(q.date);
  const cls = oneOf(CLASSES, 'class')(q.cls), quota = oneOf(QUOTAS, 'quota')(q.quota || 'GN');
  return { key: [t, from, to, d, cls, quota].join('|'), call: () => rk.fareLookup(t, from, to, d, cls, quota) };
});

route('/api/availability', 5 * MIN, (q) => {
  const t = trainNo(q.train), from = stn(q.from), to = stn(q.to), d = date(q.date);
  const cls = oneOf(CLASSES, 'class')(q.cls), quota = oneOf(QUOTAS, 'quota')(q.quota || 'GN');
  return { key: [t, from, to, d, cls, quota].join('|'), call: () => rk.getAvailability(t, from, to, d, cls, quota) };
});

route('/api/track', 1 * MIN, (q) => {
  const t = trainNo(q.train), d = date(q.date);
  return { key: `${t}|${d}`, call: () => rk.trackTrain(t, d) };
});

route('/api/history', 60 * MIN, (q) => {
  const t = trainNo(q.train), d = date(q.date);
  return { key: `${t}|${d}`, call: () => rk.getTrainHistory(t, d) };
});

route('/api/pnr', 2 * MIN, (q) => {
  if (!/^\d{10}$/.test(q.pnr || '')) throw new BadRequest('PNR must be 10 digits');
  return { key: q.pnr, call: () => rk.checkPNRStatus(q.pnr) };
});

route('/api/live-station', 2 * MIN, (q) => {
  const code = stn(q.code), hours = [2, 4, 8].includes(Number(q.hours)) ? Number(q.hours) : 2;
  return { key: `${code}|${hours}`, call: () => rk.liveAtStation(code, hours) };
});

route('/api/cancelled', 15 * MIN, () => ({ key: 'all', call: () => rk.cancelList() }));

route('/api/station', 24 * 60 * MIN, (q) => {
  const code = stn(q.code);
  return { key: code, call: () => rk.stationByCode(code) };
});

route('/api/amenities', 24 * 60 * MIN, (q) => {
  const code = stn(q.code);
  return { key: code, call: () => rk.stationAmenities(code) };
});

route('/api/timetable', 60 * MIN, (q) => {
  const code = stn(q.code), d = date(q.date, { optional: true });
  return { key: `${code}|${d}`, call: () => rk.trainTimetableAtStation(code, d) };
});

// Vercel runs the exported app as a serverless function; only listen when run directly.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`🚆 IRS running at http://localhost:${port}`));
}

export default app;
