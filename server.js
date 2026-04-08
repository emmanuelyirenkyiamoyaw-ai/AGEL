/* ================================================================
   server.js — AGEL Express Backend
   Serves the static files + handles API endpoints for:
   - Admin authentication & session management
   - Contact/consultation form submissions
   - Full REST APIs for services, projects, gallery with CRUD
   
   Run: node server.js
   Port: 3000
================================================================ */

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const session  = require('express-session');
const multer   = require('multer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'agel-secure-secret-key';

// Ensure paths are absolute and resolved correctly
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.cwd(), process.env.DATA_DIR)
  : path.join(__dirname, 'data');

const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.cwd(), process.env.UPLOADS_DIR)
  : path.join(__dirname, 'public', 'uploads');

// Prominent warning for Render/Ephemeral environments
const isEphemeral = !process.env.PERSISTENT_DISK || !process.env.DATA_DIR;
if (isEphemeral) {
  console.log('\n' + '!'.repeat(60));
  console.warn('⚠️  EPHEMERAL STORAGE WARNING:');
  console.warn('   The current configuration stores data and uploads in the app filesystem.');
  console.warn('   On platforms like Render, these files WILL BE DELETED on every deploy or restart.');
  console.warn('   To fix this, go to Render Dashboard -> Disks and mount a disk to /data and /public/uploads.');
  console.log('!'.repeat(60) + '\n');
}

console.log('✅ Storage Configured:');
console.log('   - Data Directory:', dataDir);
console.log('   - Uploads Directory:', uploadsDir);

function parseNotificationEmailList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(v => v.toString().trim()).filter(Boolean);
  }
  return value
    .toString()
    .split(/[,\n;]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

/* ================================================================
   DATABASE CONNECTION (MONGODB)
================================================================ */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/agel_db';

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('📦 Connected to MongoDB for persistent storage'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.warn('⚠️  WARNING: Data persistence is DISABLED because MongoDB is unavailable.');
    console.warn('   The app will use local JSON files/defaults, but changes WILL NOT persist on Render.');
  });

const dataSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const DataRecord = mongoose.model('DataRecord', dataSchema);

function getNotificationEmails(settings) {
  if (!settings) return [];
  return parseNotificationEmailList(settings.notificationEmails || settings.companyEmail || '');
}

function createEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

const emailTransporter = createEmailTransporter();

async function sendConsultationNotification(entry, emails) {
  if (!emailTransporter || !emails.length) return;
  const mailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;
  const subject = `New consultation request from ${entry.name}`;
  const lines = [
    `Name: ${entry.name}`,
    `Company: ${entry.company || 'N/A'}`,
    `Email: ${entry.email}`,
    `Phone: ${entry.phone}`,
    `Service: ${entry.service}`,
    `Description: ${entry.description}`,
    `Submitted: ${entry.date}`
  ];
  await emailTransporter.sendMail({
    from: mailFrom,
    to: emails.join(', '),
    subject,
    text: lines.join('\n'),
    html: `<h2>New consultation request</h2><ul>${lines.map(line => `<li>${line}</li>`).join('')}</ul>`
  });
}

/* ---- Admin Credentials (for production, use environment variables) ---- */
const ADMIN_USERNAME = process.env.ADMIN_USER || 'AGEL';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'agel@26';

/* ---- Google OAuth Configuration ---- */
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret';
// callbackURL is now dynamic using 'proxy: true' below

/* ---- Middleware ---- */
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

/* ---- Passport Configuration ---- */
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  (accessToken, refreshToken, profile, done) => {
    // Store Google profile info
    const user = {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: profile.photos[0].value,
      verified: profile.emails[0].verified
    };
    return done(null, user);
  }
));

/* ---- Serve admin panel ---- */
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin', (req, res) => res.redirect('/admin/login.html'));

/* ---- Serve uploaded images from configured upload directory ---- */
app.use('/uploads', express.static(uploadsDir));

/* ---- Serve static public website ---- */
app.use(express.static(path.join(__dirname, 'public')));

/* ---- Image upload configuration ---- */
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/* ================================================================
   AUTHENTICATION MIDDLEWARE
================================================================ */
function requireAuth(req, res, next) {
  if (req.session.admin) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login first.' });
}

/* ================================================================
   DATA HELPERS — read/write JSON files in /data/
================================================================ */
async function readData(key) {
  try {
    const record = await DataRecord.findOne({ key });
    if (record) return record.value;
    
    // Fallback to JSON migration if MongoDB is empty
    const file = key.endsWith('.json') ? key : `${key}.json`;
    const fp = path.join(dataDir, file);
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      console.log(`🚚 Migrating ${key} from JSON to MongoDB...`);
      await writeData(key, data);
      return data;
    }
    return [];
  } catch (err) {
    console.error(`Read error for ${key}:`, err.message);
    // Silent fallback to local JSON for migration path
    const file = key.endsWith('.json') ? key : `${key}.json`;
    const fp = path.join(dataDir, file);
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    }
    return [];
  }
}

async function writeData(key, data) {
  try {
    await DataRecord.findOneAndUpdate(
      { key },
      { value: data },
      { upsert: true, new: true }
    );
    console.log(`💾 Saved ${key} to MongoDB`);
    return true;
  } catch (err) {
    console.error(`Write error for ${key}:`, err.message);
    // Partial fallback: still write to JSON in dev if Mongo fails
    if (process.env.NODE_ENV !== 'production') {
      const file = key.endsWith('.json') ? key : `${key}.json`;
      const fp = path.join(dataDir, file);
      fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`📡 Fallback: Saved ${key} to local JSON`);
    }
    return false;
  }
}

// Database initialization will happen lazily on first access via readData

async function getStoredAdminCredentials() {
  const authData = await readData('auth');
  return {
    username: authData.adminUsername || ADMIN_USERNAME,
    password: authData.adminPassword || ADMIN_PASSWORD
  };
}

async function updateStoredAdminCredentials({ adminUsername, adminPassword }) {
  const current = await getStoredAdminCredentials();
  const updated = {
    adminUsername: adminUsername || current.username,
    adminPassword: adminPassword || current.password
  };
  await writeData('auth', updated);
  return updated;
}

/* ================================================================
   API ROUTES — AUTHENTICATION
================================================================ */

// Google OAuth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/admin/login.html' }),
  (req, res) => {
    // Store Google auth info in session
    req.session.googleAuth = {
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      verified: req.user.verified,
      timestamp: Date.now()
    };
    // Redirect to password verification step
    res.redirect('/admin/verify-password.html');
  }
);

// Password verification after Google auth
app.post('/api/auth/verify-password', async (req, res) => {
  const { username, password } = req.body;

  if (!req.session.googleAuth) {
    return res.status(401).json({ error: 'Google authentication required first' });
  }

  const adminCreds = await getStoredAdminCredentials();
  if (username === adminCreds.username && password === adminCreds.password) {
    req.session.admin = true;
    req.session.googleVerified = true;
    res.json({ success: true, message: 'Authentication successful' });
  } else {
    res.status(401).json({ error: 'Invalid admin username or password' });
  }
});

// Admin Login (Modified to require Google Auth first)
app.post('/api/auth/login', async (req, res) => {
  if (!req.session.googleAuth) {
    return res.status(401).json({ 
      error: 'Access Denied', 
      details: 'For security, you must log in with Google first.',
      requireGoogle: true 
    });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  const adminCreds = await getStoredAdminCredentials();
  if (username === adminCreds.username && password === adminCreds.password) {
    req.session.admin = true;
    req.session.googleVerified = true;
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Admin Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true, message: 'Logged out' });
  });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!req.session.admin,
    googleAuth: !!req.session.googleAuth,
    googleVerified: !!req.session.googleVerified
  });
});

// Get current Google auth info
app.get('/api/auth/google-info', (req, res) => {
  if (!req.session.googleAuth) {
    return res.status(404).json({ error: 'No Google authentication found' });
  }
  res.json(req.session.googleAuth);
});

app.get('/api/auth/credentials', requireAuth, async (req, res) => {
  const adminCreds = await getStoredAdminCredentials();
  res.json({ adminUsername: adminCreds.username });
});

app.put('/api/auth/credentials', requireAuth, async (req, res) => {
  const { adminUsername, adminPassword } = req.body;
  if (!adminUsername && !adminPassword) {
    return res.status(400).json({ error: 'No credentials provided.' });
  }
  const updated = await updateStoredAdminCredentials({ adminUsername, adminPassword });
  res.json({ success: true, adminUsername: updated.adminUsername });
});

app.post('/api/auth/credentials', requireAuth, async (req, res) => {
  const { adminUsername, adminPassword } = req.body;
  if (!adminUsername && !adminPassword) {
    return res.status(400).json({ error: 'No credentials provided.' });
  }
  const updated = await updateStoredAdminCredentials({ adminUsername, adminPassword });
  res.json({ success: true, adminUsername: updated.adminUsername });
});

/* ================================================================
   API ROUTES — CONSULTATIONS
================================================================ */

// Submit a new consultation request (public)
app.post('/api/consultations', async (req, res) => {
  // If array, this is admin bulk update (requires auth)
  if (Array.isArray(req.body)) {
    if (!req.session.admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await writeData('consultations', req.body);
    res.json({ success: true, message: 'Consultations updated' });
    return;
  }

  // Otherwise, this is a public consultation submission
  const { name, company, email, phone, service, description } = req.body;
  if (!name || !email || !phone || !service || !description) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }
  const consultations = await readData('consultations');
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    name, company: company || '', email, phone, service, description
  };
  consultations.unshift(entry);
  await writeData('consultations', consultations);

  const settings = await readData('settings');
  const notificationEmails = getNotificationEmails(settings);
  if (notificationEmails.length) {
    sendConsultationNotification(entry, notificationEmails)
      .catch(err => console.error('Consultation notification email failed:', err));
  }

  res.json({ success: true, message: 'Consultation request received.' });
});

// Get all consultation requests (admin)
app.get('/api/consultations', requireAuth, async (req, res) => {
  res.json(await readData('consultations'));
});

// Delete a consultation (admin)
app.delete('/api/consultations/:id', requireAuth, async (req, res) => {
  const id   = Number(req.params.id);
  const data = (await readData('consultations')).filter(c => c.id !== id);
  await writeData('consultations', data);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — SERVICES
================================================================ */

app.get('/api/services', async (req, res) => {
  res.json(await readData('services'));
});

app.post('/api/services', requireAuth, async (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all services
    await writeData('services', req.body);
    res.json({ success: true, message: 'Services updated' });
  } else {
    // Single item creation
    const { title, desc, icon } = req.body;
    if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
    const items = await readData('services');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      title, 
      desc, 
      icon: icon || 'fas fa-bolt' 
    };
    items.push(item);
    await writeData('services', items);
    res.json({ success: true, item });
  }
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, desc, icon } = req.body;
  if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
  const items = (await readData('services')).map(s => 
    s.id === id ? { ...s, title, desc, icon: icon || s.icon, id } : s
  );
  await writeData('services', items);
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const items = (await readData('services')).filter(s => s.id !== id);
  await writeData('services', items);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — PROJECTS
================================================================ */

app.get('/api/projects', async (req, res) => {
  res.json(await readData('projects'));
});

app.post('/api/projects', requireAuth, async (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all projects
    await writeData('projects', req.body);
    res.json({ success: true, message: 'Projects updated' });
  } else {
    // Single item creation
    const { title, desc, category, img } = req.body;
    if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
    const items = await readData('projects');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      title, 
      desc, 
      category: category || 'Industrial', 
      img: img || '' 
    };
    items.push(item);
    await writeData('projects', items);
    res.json({ success: true, item });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { title, desc, category, img } = req.body;
  if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
  const items = (await readData('projects')).map(p => 
    p.id === id ? { ...p, title, desc, category: category || p.category, img: img || p.img, id } : p
  );
  await writeData('projects', items);
  res.json({ success: true });
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const items = (await readData('projects')).filter(p => p.id !== id);
  await writeData('projects', items);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — GALLERY
================================================================ */

app.get('/api/gallery', async (req, res) => {
  res.json(await readData('gallery'));
});

app.post('/api/gallery', requireAuth, async (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all gallery items
    await writeData('gallery', req.body);
    res.json({ success: true, message: 'Gallery updated' });
  } else {
    // Single item creation
    const { label, url, icon } = req.body;
    if (!label) return res.status(400).json({ error: 'Label required.' });
    const items = await readData('gallery');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      label, 
      url: url || '', 
      icon: icon || 'fas fa-image' 
    };
    items.push(item);
    await writeData('gallery', items);
    res.json({ success: true, item });
  }
});

app.put('/api/gallery/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { label, url, icon } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required.' });
  const items = (await readData('gallery')).map(g => 
    g.id === id ? { ...g, label, url: url || g.url, icon: icon || g.icon, id } : g
  );
  await writeData('gallery', items);
  res.json({ success: true });
});

app.delete('/api/gallery/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const items = (await readData('gallery')).filter(g => g.id !== id);
  await writeData('gallery', items);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — TEAM
================================================================ */

app.get('/api/team', async (req, res) => {
  res.json(await readData('team'));
});

app.post('/api/team', requireAuth, async (req, res) => {
  const { name, role, bio, phone, email, img } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role required.' });
  const items = await readData('team');
  const item = {
    id: items.length ? Math.max(...items.map(i => i.id)) + 1 : 1,
    name,
    role,
    bio: bio || '',
    phone: phone || '',
    email: email || '',
    img: img || ''
  };
  items.push(item);
  await writeData('team', items);
  res.json({ success: true, item });
});

app.put('/api/team/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { name, role, bio, phone, email, img } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role required.' });
  const items = (await readData('team')).map(member =>
    member.id === id ? { ...member, name, role, bio: bio || member.bio, phone: phone || member.phone, email: email || member.email, img: img || member.img, id } : member
  );
  await writeData('team', items);
  res.json({ success: true });
});

app.delete('/api/team/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const items = (await readData('team')).filter(member => member.id !== id);
  await writeData('team', items);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — SETTINGS
================================================================ */

app.get('/api/settings', async (req, res) => {
  res.json(await readData('settings'));
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const updates = req.body;
  const current = await readData('settings');
  const updated = { ...current, ...updates };
  await writeData('settings', updated);
  res.json({ success: true, settings: updated });
});

/* ================================================================
   IMAGE UPLOAD ENDPOINT
================================================================ */

app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('image')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
  });
});

/* ---- API fallback: send structured JSON errors for unknown API routes ---- */
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

/* ---- Catch-all: serve index.html ---- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ================================================================
   ERROR HANDLING
================================================================ */
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: err.message || 'Server error' });
});

/* ================================================================
   START SERVER
================================================================ */
app.listen(PORT, async () => {
  const adminCreds = await getStoredAdminCredentials();
  console.log(`\n✅ AGEL Server running at http://localhost:${PORT}`);
  console.log(`   Website: http://localhost:${PORT}`);
  console.log(`   Admin:   http://localhost:${PORT}/admin/login.html`);
  console.log(`   Admin Username: ${adminCreds.username}\n`);
});
