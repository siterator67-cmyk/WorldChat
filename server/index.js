const express = require('express');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@libsql/client');
const crypto = require('crypto');
const { Resend } = require('resend');
const Stripe = require('stripe');

const app = express();
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
const PORT = process.env.PORT || 4000;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const FROM_EMAIL = process.env.FROM_EMAIL || 'WorldChat <onboarding@resend.dev>';
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || '';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const ADMIN_EMAILS = ['siterator67@gmail.com'];

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function dbRun(sql, args = []) {
  await db.execute({ sql, args });
}

async function dbGet(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows[0] ?? null;
}

async function dbAll(sql, args = []) {
  const { rows } = await db.execute({ sql, args });
  return rows;
}

async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      code_expires_at INTEGER,
      subscription TEXT DEFAULT 'free',
      stripe_customer_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  try { await db.execute(`ALTER TABLE users ADD COLUMN reset_code TEXT`); } catch(e) {}
  try { await db.execute(`ALTER TABLE users ADD COLUMN reset_code_expires_at INTEGER`); } catch(e) {}
}

// --- Middleware ---
app.use(cors());
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === check;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = await dbGet('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session) return res.status(401).json({ error: 'Invalid token' });

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  req.user = user;
  next();
}

// --- Routes ---

// Ping (keep-alive)
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Forgot password — send code
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'No account with this email' });

  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await dbRun('UPDATE users SET reset_code = ?, reset_code_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);

  if (resend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email.toLowerCase(),
        subject: 'WorldChat — Password reset code',
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
            <h2 style="color:#66c0f4;">WorldChat</h2>
            <p>Your password reset code:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#66c0f4;padding:16px;background:#1b2838;border-radius:8px;text-align:center;">
              ${code}
            </div>
            <p style="color:#888;font-size:12px;margin-top:16px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Email send error:', e);
    }
  } else {
    console.log(`[DEV] Reset code for ${email}: ${code}`);
  }

  res.json({ success: true });
});

// Reset password — verify code + set new password
app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'All fields are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });
  if (user.reset_code !== code) return res.status(400).json({ error: 'Invalid code' });
  if (Date.now() > user.reset_code_expires_at) return res.status(400).json({ error: 'Code expired. Please try again' });

  await dbRun('UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?', [hashPassword(newPassword), user.id]);

  const token = generateToken();
  await dbRun('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, subscription: ADMIN_EMAILS.includes(user.email) ? 'premplus' : user.subscription },
  });
});

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) {
    return res.status(400).json({ error: 'Account with this email already exists' });
  }

  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await dbRun(
    'INSERT INTO users (username, email, password_hash, verification_code, code_expires_at) VALUES (?, ?, ?, ?, ?)',
    [username, email.toLowerCase(), hashPassword(password), code, expiresAt]
  );

  if (resend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email.toLowerCase(),
        subject: 'WorldChat — Verify your email',
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
            <h2 style="color:#66c0f4;">WorldChat</h2>
            <p>Your verification code:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#66c0f4;padding:16px;background:#1b2838;border-radius:8px;text-align:center;">
              ${code}
            </div>
            <p style="color:#888;font-size:12px;margin-top:16px;">This code expires in 10 minutes.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Email send error:', e);
    }
  } else {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
  }

  res.json({ success: true, message: 'Verification code sent to your email' });
});

// Verify email
app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });

  if (user.email_verified) {
    return res.json({ success: true, message: 'Already verified' });
  }

  if (user.verification_code !== code) {
    return res.status(400).json({ error: 'Invalid code' });
  }

  if (Date.now() > user.code_expires_at) {
    return res.status(400).json({ error: 'Code expired. Please register again' });
  }

  await dbRun('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);

  const token = generateToken();
  await dbRun('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, subscription: ADMIN_EMAILS.includes(user.email) ? 'premplus' : user.subscription },
  });
});

// Resend verification code
app.post('/api/resend-code', async (req, res) => {
  const { email } = req.body;

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });

  if (user.email_verified) {
    return res.json({ success: true, message: 'Already verified' });
  }

  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await dbRun('UPDATE users SET verification_code = ?, code_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);

  if (resend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email.toLowerCase(),
        subject: 'WorldChat — Your new verification code',
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px;">
            <h2 style="color:#66c0f4;">WorldChat</h2>
            <p>Your new verification code:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#66c0f4;padding:16px;background:#1b2838;border-radius:8px;text-align:center;">
              ${code}
            </div>
            <p style="color:#888;font-size:12px;margin-top:16px;">This code expires in 10 minutes.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error('Email send error:', e);
    }
  } else {
    console.log(`[DEV] New verification code for ${email}: ${code}`);
  }

  res.json({ success: true, message: 'New code sent' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(400).json({ error: 'Wrong password' });
  }

  if (!user.email_verified) {
    return res.status(400).json({ error: 'Email not verified', needsVerification: true });
  }

  const token = generateToken();
  await dbRun('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, subscription: ADMIN_EMAILS.includes(user.email) ? 'premplus' : user.subscription },
  });
});

// Get current user
app.get('/api/me', authMiddleware, (req, res) => {
  const sub = ADMIN_EMAILS.includes(req.user.email) ? 'premplus' : req.user.subscription;
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      subscription: sub,
    },
  });
});

// Logout
app.post('/api/logout', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  await dbRun('DELETE FROM sessions WHERE token = ?', [token]);
  res.json({ success: true });
});

// --- Stripe Payments ---

// Create checkout session
app.post('/api/create-checkout', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan } = req.body;
  const user = req.user;

  const prices = {
    premium: { amount: 100, name: 'WorldChat Premium' },
    premplus: { amount: 299, name: 'WorldChat Premium+' },
  };

  if (!prices[plan]) return res.status(400).json({ error: 'Invalid plan' });

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id.toString() },
    });
    customerId = customer.id;
    await dbRun('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, user.id]);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: prices[plan].name },
        unit_amount: prices[plan].amount,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    }],
    metadata: { userId: user.id.toString(), plan },
    success_url: `${SERVER_URL}/payment-success.html`,
    cancel_url: `${SERVER_URL}/payment-cancel.html`,
  });

  res.json({ url: session.url });
});

// Stripe webhook
app.post('/webhook/stripe', async (req, res) => {
  if (!stripe) return res.status(500).send('Stripe not configured');

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body);
    }
  } catch (e) {
    return res.status(400).send('Webhook error');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan;
    if (userId && plan) {
      await dbRun('UPDATE users SET subscription = ? WHERE id = ?', [plan, parseInt(userId)]);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    await dbRun('UPDATE users SET subscription = ? WHERE stripe_customer_id = ?', ['free', customerId]);
  }

  res.json({ received: true });
});

// --- Static pages for Stripe redirects ---
app.get('/payment-success.html', (req, res) => {
  res.send(`
    <html><body style="background:#1b2838;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="text-align:center;">
        <div style="font-size:64px;">✅</div>
        <h1 style="color:#4caf50;">Payment successful!</h1>
        <p style="color:#8f98a0;">You can close this page and return to WorldChat.</p>
      </div>
    </body></html>
  `);
});

app.get('/payment-cancel.html', (req, res) => {
  res.send(`
    <html><body style="background:#1b2838;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="text-align:center;">
        <div style="font-size:64px;">❌</div>
        <h1 style="color:#e74c3c;">Payment cancelled</h1>
        <p style="color:#8f98a0;">You can close this page and return to WorldChat.</p>
      </div>
    </body></html>
  `);
});

// --- DeepL translation ---
const DEEPL_URL = DEEPL_API_KEY.endsWith(':fx')
  ? 'https://api-free.deepl.com/v2/translate'
  : 'https://api.deepl.com/v2/translate';

// app language code -> DeepL target_lang (unsupported langs like hi/bn/th fall through untranslated)
const DEEPL_TARGETS = {
  en: 'EN-US', ru: 'RU', es: 'ES', fr: 'FR', de: 'DE', ja: 'JA', ko: 'KO',
  zh: 'ZH', pt: 'PT-BR', it: 'IT', tr: 'TR', ar: 'AR', pl: 'PL', nl: 'NL',
  uk: 'UK', sv: 'SV', no: 'NB', da: 'DA', fi: 'FI', cs: 'CS', ro: 'RO',
  hu: 'HU', el: 'EL', id: 'ID', sk: 'SK', bg: 'BG',
};

const translationCache = new Map(); // "TARGET::text" -> translated text
const TRANSLATION_CACHE_MAX = 5000;

async function translateText(text, targetAppLang) {
  if (!DEEPL_API_KEY) return null;
  const target = DEEPL_TARGETS[targetAppLang];
  if (!target) return null;

  const cacheKey = `${target}::${text}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  try {
    const res = await fetch(DEEPL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], target_lang: target }),
    });
    if (!res.ok) {
      console.error('DeepL API error:', res.status);
      return null;
    }
    const data = await res.json();
    const translated = data.translations?.[0]?.text || null;
    if (translated) {
      if (translationCache.size >= TRANSLATION_CACHE_MAX) translationCache.clear();
      translationCache.set(cacheKey, translated);
    }
    return translated;
  } catch (e) {
    console.error('DeepL error:', e.message);
    return null;
  }
}

// --- Anti-spam ---
const spamState = new Map(); // userId -> { strikes, mutedUntil, lastStrikeAt, lastTexts: [{text, at}] }
const STRIKE_RESET_MS = 5 * 60 * 1000;
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|ru|io|me|gg|xyz|info|site|online|shop|store|club|top|link|app|dev)(\/|\b))/i;

function getSpamState(userId) {
  let st = spamState.get(userId);
  if (!st) {
    st = { strikes: 0, mutedUntil: 0, lastStrikeAt: 0, lastTexts: [] };
    spamState.set(userId, st);
  }
  return st;
}

// Returns { blocked: false } or { blocked: true, reason, remaining }
function checkSpam(userId, text, isSharedRoom) {
  const now = Date.now();
  const st = getSpamState(userId);

  if (now < st.mutedUntil) {
    return { blocked: true, reason: 'muted', remaining: Math.ceil((st.mutedUntil - now) / 1000) };
  }

  if (st.strikes > 0 && now - st.lastStrikeAt > STRIKE_RESET_MS) st.strikes = 0;

  const strike = (reason) => {
    st.strikes++;
    st.lastStrikeAt = now;
    if (st.strikes >= 3) {
      st.mutedUntil = now + (st.strikes >= 5 ? 5 * 60 * 1000 : 60 * 1000);
    }
    const remaining = st.mutedUntil > now ? Math.ceil((st.mutedUntil - now) / 1000) : 0;
    return { blocked: true, reason, remaining };
  };

  // links are not allowed in public/global rooms
  if (isSharedRoom && URL_RE.test(text)) return strike('link');

  // same message repeated 3+ times within 30s
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
  st.lastTexts = st.lastTexts.filter(e => now - e.at < 30000);
  const dupCount = st.lastTexts.filter(e => e.text === norm).length;
  st.lastTexts.push({ text: norm, at: now });
  if (dupCount >= 2) return strike('duplicate');

  // one character repeated 15+ times
  if (/(.)\1{14,}/.test(text)) return strike('flood');

  // >70% caps on messages with 20+ letters
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
  if (letters.length >= 20) {
    const caps = letters.replace(/[^A-ZА-ЯЁ]/g, '').length;
    if (caps / letters.length > 0.7) return strike('caps');
  }

  return { blocked: false };
}

// drop idle spam state to keep memory bounded
setInterval(() => {
  const now = Date.now();
  for (const [userId, st] of spamState) {
    const lastActivity = Math.max(st.lastStrikeAt, st.mutedUntil, st.lastTexts[st.lastTexts.length - 1]?.at || 0);
    if (now - lastActivity > 30 * 60 * 1000) spamState.delete(userId);
  }
}, 10 * 60 * 1000);

// --- Socket.io matchmaking ---
const MAX_ROOM_SIZE = 30;
const queues = new Map();
const publicRooms = new Map(); // queueKey -> [roomId, ...]
const globalRooms = [];        // shared pool for global chat

function getQueueKey(c1, c2, mode) {
  const sorted = [c1.name, c2.name].sort();
  return `${sorted[0]}__${sorted[1]}__${mode}`;
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    const session = await dbGet('SELECT * FROM sessions WHERE token = ?', [token]);
    if (!session) return next(new Error('Invalid token'));
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [session.user_id]);
    if (!user) return next(new Error('No user'));
    socket.user = user;
    const lang = socket.handshake.auth.lang;
    socket.lang = (typeof lang === 'string' && /^[a-z]{2,3}$/.test(lang)) ? lang : 'en';
    next();
  } catch(e) { next(new Error('Auth error')); }
});

io.on('connection', (socket) => {
  socket.currentQueue = null;
  socket.currentRoom = null;

  function leaveQueue() {
    if (!socket.currentQueue) return;
    const q = queues.get(socket.currentQueue);
    if (q) {
      const idx = q.findIndex(e => e.socket.id === socket.id);
      if (idx !== -1) q.splice(idx, 1);
      if (q.length === 0) queues.delete(socket.currentQueue);
    }
    socket.currentQueue = null;
  }

  socket.on('join_queue', ({ myCountry, theirCountry, mode }) => {
    leaveQueue();
    const key = getQueueKey(myCountry, theirCountry, mode);
    socket.currentQueue = key;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push({ socket, myCountry, theirCountry });

    const needed = mode === 'group' ? 4 : 2;
    const queue = queues.get(key);
    if (queue.length >= needed) {
      const group = queue.splice(0, needed);
      const roomId = crypto.randomBytes(8).toString('hex');
      group.forEach(({ socket: s, myCountry: mc, theirCountry: tc }) => {
        s.join(roomId);
        s.currentRoom = roomId;
        s.currentQueue = null;
        s.isGlobal = false;
        s.currentPublicKey = null;
        const partners = group
          .filter(e => e.socket.id !== s.id)
          .map(e => ({ username: e.socket.user.username, country: e.myCountry }));
        s.emit('matched', { roomId, mode, partners, myCountry: mc, theirCountry: tc });
      });
    }
  });

  socket.lastMessageAt = 0;

  socket.on('set_lang', (lang) => {
    if (typeof lang === 'string' && /^[a-z]{2,3}$/.test(lang)) socket.lang = lang;
  });

  socket.on('send_message', async ({ roomId, text }) => {
    if (!roomId || typeof text !== 'string' || socket.currentRoom !== roomId) return;
    text = text.trim();
    if (!text || text.length > 1000) return;

    const now = Date.now();
    if (now - socket.lastMessageAt < 5000) {
      const remaining = Math.ceil((5000 - (now - socket.lastMessageAt)) / 1000);
      socket.emit('cooldown', { remaining });
      return;
    }

    const isSharedRoom = !!socket.isGlobal || !!socket.currentPublicKey;
    const verdict = checkSpam(socket.user.id, text, isSharedRoom);
    if (verdict.blocked) {
      if (verdict.reason === 'muted') {
        socket.emit('muted', { remaining: verdict.remaining });
      } else {
        socket.emit('spam_warning', { reason: verdict.reason, remaining: verdict.remaining });
      }
      return;
    }

    socket.lastMessageAt = now;

    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return;

    // group recipients by language so each language is translated once
    const senderLang = socket.lang || 'en';
    const byLang = new Map();
    for (const sid of room) {
      if (sid === socket.id) continue;
      const s = io.sockets.sockets.get(sid);
      if (!s) continue;
      const lang = s.lang || 'en';
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang).push(s);
    }

    await Promise.all([...byLang].map(async ([lang, sockets]) => {
      let translated = null;
      if (lang !== senderLang) translated = await translateText(text, lang);
      const payload = {
        roomId,
        text: translated || text,
        original: translated ? text : null,
        translated: !!translated,
        sender: socket.user.username,
      };
      sockets.forEach(s => s.emit('receive_message', payload));
    }));
  });

  socket.on('typing', ({ roomId }) => {
    if (socket.currentRoom !== roomId) return;
    socket.to(roomId).emit('partner_typing', { roomId, sender: socket.user.username });
  });

  socket.on('stop_typing', ({ roomId }) => {
    if (socket.currentRoom !== roomId) return;
    socket.to(roomId).emit('partner_stop_typing', { roomId });
  });

  socket.on('join_public', ({ myCountry, theirCountry }) => {
    const key = getQueueKey(myCountry, theirCountry, 'public');
    if (!publicRooms.has(key)) publicRooms.set(key, []);
    const rooms = publicRooms.get(key);
    let roomId = rooms.find(rid => (io.sockets.adapter.rooms.get(rid)?.size || 0) < MAX_ROOM_SIZE);
    if (!roomId) { roomId = crypto.randomBytes(8).toString('hex'); rooms.push(roomId); }
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.currentPublicKey = key;
    socket.isGlobal = false;
    socket.to(roomId).emit('public_user_joined', { username: socket.user.username, roomId });
    socket.emit('matched', { roomId, mode: 'public', partners: [], myCountry, theirCountry });
  });

  socket.on('join_global', () => {
    const sub = socket.user.subscription;
    const isAdmin = ADMIN_EMAILS.includes(socket.user.email);
    if (sub !== 'premium' && sub !== 'premplus' && !isAdmin) {
      socket.emit('error_event', { message: 'Premium subscription required' });
      return;
    }
    let roomId = globalRooms.find(rid => (io.sockets.adapter.rooms.get(rid)?.size || 0) < MAX_ROOM_SIZE);
    if (!roomId) { roomId = crypto.randomBytes(8).toString('hex'); globalRooms.push(roomId); }
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.isGlobal = true;
    socket.currentPublicKey = null;
    socket.to(roomId).emit('public_user_joined', { username: socket.user.username, roomId });
    socket.emit('matched', { roomId, mode: 'global', partners: [], myCountry: { name: 'Global', flag: '🌍' }, theirCountry: { name: 'Global', flag: '🌍' } });
  });

  socket.on('leave_queue', () => leaveQueue());

  socket.on('disconnect', () => {
    leaveQueue();
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit('partner_disconnected', {
        roomId: socket.currentRoom,
        sender: socket.user.username,
      });
      if (socket.currentPublicKey) {
        setTimeout(() => {
          const room = io.sockets.adapter.rooms.get(socket.currentRoom);
          if (!room || room.size === 0) publicRooms.delete(socket.currentPublicKey);
        }, 200);
      }
    }
  });
});

// --- Start ---
initDb().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`WorldChat server running on port ${PORT}`);
    if (!RESEND_API_KEY) console.log('⚠ RESEND_API_KEY not set — emails will be logged to console');
    if (!STRIPE_SECRET_KEY) console.log('⚠ STRIPE_SECRET_KEY not set — payments disabled');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
