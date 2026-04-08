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
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL
  || (process.env.RENDER_EXTERNAL_URL ? `https://${process.env.RENDER_EXTERNAL_URL}/auth/google/callback` : `http://localhost:${PORT}/auth/google/callback`);

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
    callbackURL: GOOGLE_CALLBACK_URL
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
function readData(file) {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  } catch {
    return [];
  }
}

function writeData(file, data) {
  const fp = path.join(dataDir, file);
  try {
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(fp, json, 'utf-8');
    console.log(`💾 Data saved successfully to ${file} (${json.length} bytes)`);
    return true;
  } catch (err) {
    console.error(`❌ CRITICAL ERROR writing to ${file}:`, err.message);
    return false;
  }
}

// Seed default data if not present
Object.entries({
  'services.json': require('./data/seed_services.json'),
  'projects.json': require('./data/seed_projects.json'),
  'gallery.json':  [],
  'consultations.json': [],
  'team.json': require('./data/seed_team.json'),
  'settings.json': require('./data/seed_settings.json'),
  'auth.json': require('./data/seed_auth.json')
}).forEach(([file, defaultData]) => {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) writeData(file, defaultData);
});

function getStoredAdminCredentials() {
  const authFile = path.join(dataDir, 'auth.json');
  const authData = fs.existsSync(authFile) ? readData('auth.json') : {};
  return {
    username: authData.adminUsername || ADMIN_USERNAME,
    password: authData.adminPassword || ADMIN_PASSWORD
  };
}

function updateStoredAdminCredentials({ adminUsername, adminPassword }) {
  const current = getStoredAdminCredentials();
  const updated = {
    adminUsername: adminUsername || current.username,
    adminPassword: adminPassword || current.password
  };
  writeData('auth.json', updated);
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
app.post('/api/auth/verify-password', (req, res) => {
  const { password } = req.body;

  if (!req.session.googleAuth) {
    return res.status(401).json({ error: 'Google authentication required first' });
  }

  const adminCreds = getStoredAdminCredentials();
  if (password === adminCreds.password) {
    req.session.admin = true;
    req.session.googleVerified = true;
    res.json({ success: true, message: 'Authentication successful' });
  } else {
    res.status(401).json({ error: 'Invalid admin password' });
  }
});

// Admin Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }
  const adminCreds = getStoredAdminCredentials();
  if (username === adminCreds.username && password === adminCreds.password) {
    req.session.admin = true;
    req.session.googleVerified = false; // Not using Google auth
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

app.get('/api/auth/credentials', requireAuth, (req, res) => {
  const adminCreds = getStoredAdminCredentials();
  res.json({ adminUsername: adminCreds.username });
});

app.put('/api/auth/credentials', requireAuth, (req, res) => {
  const { adminUsername, adminPassword } = req.body;
  if (!adminUsername && !adminPassword) {
    return res.status(400).json({ error: 'No credentials provided.' });
  }
  const updated = updateStoredAdminCredentials({ adminUsername, adminPassword });
  res.json({ success: true, adminUsername: updated.adminUsername });
});

app.post('/api/auth/credentials', requireAuth, (req, res) => {
  const { adminUsername, adminPassword } = req.body;
  if (!adminUsername && !adminPassword) {
    return res.status(400).json({ error: 'No credentials provided.' });
  }
  const updated = updateStoredAdminCredentials({ adminUsername, adminPassword });
  res.json({ success: true, adminUsername: updated.adminUsername });
});

/* ================================================================
   API ROUTES — CONSULTATIONS
================================================================ */

// Submit a new consultation request (public)
app.post('/api/consultations', (req, res) => {
  // If array, this is admin bulk update (requires auth)
  if (Array.isArray(req.body)) {
    if (!req.session.admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    writeData('consultations.json', req.body);
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
  const consultations = readData('consultations.json');
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    name, company: company || '', email, phone, service, description
  };
  consultations.unshift(entry);
  writeData('consultations.json', consultations);

  const settings = readData('settings.json');
  const notificationEmails = getNotificationEmails(settings);
  if (notificationEmails.length) {
    sendConsultationNotification(entry, notificationEmails)
      .catch(err => console.error('Consultation notification email failed:', err));
  }

  res.json({ success: true, message: 'Consultation request received.' });
});

// Get all consultation requests (admin)
app.get('/api/consultations', requireAuth, (req, res) => {
  res.json(readData('consultations.json'));
});

// Delete a consultation (admin)
app.delete('/api/consultations/:id', requireAuth, (req, res) => {
  const id   = Number(req.params.id);
  const data = readData('consultations.json').filter(c => c.id !== id);
  writeData('consultations.json', data);
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — SERVICES
================================================================ */

app.get('/api/services', (req, res) => {
  res.json(readData('services.json'));
});

app.post('/api/services', requireAuth, (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all services
    writeData('services.json', req.body);
    res.json({ success: true, message: 'Services updated' });
  } else {
    // Single item creation
    const { title, desc, icon } = req.body;
    if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
    const items = readData('services.json');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      title, 
      desc, 
      icon: icon || 'fas fa-bolt' 
    };
    items.push(item);
    writeData('services.json', items);
    res.json({ success: true, item });
  }
});

app.put('/api/services/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { title, desc, icon } = req.body;
  if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
  const items = readData('services.json').map(s => 
    s.id === id ? { ...s, title, desc, icon: icon || s.icon, id } : s
  );
  writeData('services.json', items);
  res.json({ success: true });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('services.json', readData('services.json').filter(s => s.id !== id));
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — PROJECTS
================================================================ */

app.get('/api/projects', (req, res) => {
  res.json(readData('projects.json'));
});

app.post('/api/projects', requireAuth, (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all projects
    writeData('projects.json', req.body);
    res.json({ success: true, message: 'Projects updated' });
  } else {
    // Single item creation
    const { title, desc, category, img } = req.body;
    if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
    const items = readData('projects.json');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      title, 
      desc, 
      category: category || 'Industrial', 
      img: img || '' 
    };
    items.push(item);
    writeData('projects.json', items);
    res.json({ success: true, item });
  }
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { title, desc, category, img } = req.body;
  if (!title || !desc) return res.status(400).json({ error: 'Title and description required.' });
  const items = readData('projects.json').map(p => 
    p.id === id ? { ...p, title, desc, category: category || p.category, img: img || p.img, id } : p
  );
  writeData('projects.json', items);
  res.json({ success: true });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('projects.json', readData('projects.json').filter(p => p.id !== id));
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — GALLERY
================================================================ */

app.get('/api/gallery', (req, res) => {
  res.json(readData('gallery.json'));
});

app.post('/api/gallery', requireAuth, (req, res) => {
  // Handle both single item creation and bulk array updates
  if (Array.isArray(req.body)) {
    // Bulk update: POST array replaces all gallery items
    writeData('gallery.json', req.body);
    res.json({ success: true, message: 'Gallery updated' });
  } else {
    // Single item creation
    const { label, url, icon } = req.body;
    if (!label) return res.status(400).json({ error: 'Label required.' });
    const items = readData('gallery.json');
    const item  = { 
      id: items.length ? Math.max(...items.map(i=>i.id)) + 1 : 1, 
      label, 
      url: url || '', 
      icon: icon || 'fas fa-image' 
    };
    items.push(item);
    writeData('gallery.json', items);
    res.json({ success: true, item });
  }
});

app.put('/api/gallery/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { label, url, icon } = req.body;
  if (!label) return res.status(400).json({ error: 'Label required.' });
  const items = readData('gallery.json').map(g => 
    g.id === id ? { ...g, label, url: url || g.url, icon: icon || g.icon, id } : g
  );
  writeData('gallery.json', items);
  res.json({ success: true });
});

app.delete('/api/gallery/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('gallery.json', readData('gallery.json').filter(g => g.id !== id));
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — TEAM
================================================================ */

app.get('/api/team', (req, res) => {
  res.json(readData('team.json'));
});

app.post('/api/team', requireAuth, (req, res) => {
  const { name, role, bio, phone, email, img } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role required.' });
  const items = readData('team.json');
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
  writeData('team.json', items);
  res.json({ success: true, item });
});

app.put('/api/team/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, role, bio, phone, email, img } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'Name and role required.' });
  const items = readData('team.json').map(member =>
    member.id === id ? { ...member, name, role, bio: bio || member.bio, phone: phone || member.phone, email: email || member.email, img: img || member.img, id } : member
  );
  writeData('team.json', items);
  res.json({ success: true });
});

app.delete('/api/team/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  writeData('team.json', readData('team.json').filter(member => member.id !== id));
  res.json({ success: true });
});

/* ================================================================
   API ROUTES — SETTINGS
================================================================ */

app.get('/api/settings', (req, res) => {
  res.json(readData('settings.json'));
});

app.put('/api/settings', requireAuth, (req, res) => {
  const updates = req.body;
  const current = readData('settings.json');
  const updated = { ...current, ...updates };
  writeData('settings.json', updated);
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
app.listen(PORT, () => {
  const adminCreds = getStoredAdminCredentials();
  console.log(`\n✅ AGEL Server running at http://localhost:${PORT}`);
  console.log(`   Website: http://localhost:${PORT}`);
  console.log(`   Admin:   http://localhost:${PORT}/admin/login.html`);
  console.log(`   Admin Username: ${adminCreds.username}\n`);
});
