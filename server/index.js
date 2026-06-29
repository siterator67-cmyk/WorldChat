const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const crypto = require('crypto');
const { Resend } = require('resend');
const Stripe = require('stripe');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const FROM_EMAIL = process.env.FROM_EMAIL || 'WorldChat <onboarding@resend.dev>';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const ADMIN_EMAILS = ['siterator67@gmail.com'];

let db;
const DB_PATH = path.join(__dirname, 'worldchat.db');

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const dbQuery = {
  run(sql, params = []) {
    db.run(sql, params);
    saveDb();
  },
  get(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  },
  all(sql, params = []) {
    const results = [];
    const stmt = db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  },
};

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  saveDb();
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

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = dbQuery.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!session) return res.status(401).json({ error: 'Invalid token' });

  const user = dbQuery.get('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!user) return res.status(401).json({ error: 'User not found' });

  req.user = user;
  next();
}

// --- Routes ---

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = dbQuery.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) {
    return res.status(400).json({ error: 'Account with this email already exists' });
  }

  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  dbQuery.run(
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
app.post('/api/verify', (req, res) => {
  const { email, code } = req.body;

  const user = dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
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

  dbQuery.run('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?', [user.id]);

  const token = generateToken();
  dbQuery.run('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, subscription: ADMIN_EMAILS.includes(user.email) ? 'premplus' : user.subscription },
  });
});

// Resend verification code
app.post('/api/resend-code', async (req, res) => {
  const { email } = req.body;

  const user = dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });

  if (user.email_verified) {
    return res.json({ success: true, message: 'Already verified' });
  }

  const code = generateCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  dbQuery.run('UPDATE users SET verification_code = ?, code_expires_at = ? WHERE id = ?', [code, expiresAt, user.id]);

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
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  const user = dbQuery.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) return res.status(400).json({ error: 'User not found' });

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(400).json({ error: 'Wrong password' });
  }

  if (!user.email_verified) {
    return res.status(400).json({ error: 'Email not verified', needsVerification: true });
  }

  const token = generateToken();
  dbQuery.run('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

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
app.post('/api/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  dbQuery.run('DELETE FROM sessions WHERE token = ?', [token]);
  res.json({ success: true });
});

// --- Stripe Payments ---

// Create checkout session
app.post('/api/create-checkout', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });

  const { plan } = req.body; // 'premium' or 'premplus'
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
    dbQuery.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, user.id]);
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
      dbQuery.run('UPDATE users SET subscription = ? WHERE id = ?', [plan, parseInt(userId)]);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    dbQuery.run('UPDATE users SET subscription = ? WHERE stripe_customer_id = ?', ['free', customerId]);
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

// --- Start ---
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`WorldChat server running on port ${PORT}`);
    if (!RESEND_API_KEY) console.log('⚠ RESEND_API_KEY not set — emails will be logged to console');
    if (!STRIPE_SECRET_KEY) console.log('⚠ STRIPE_SECRET_KEY not set — payments disabled');
  });
});
