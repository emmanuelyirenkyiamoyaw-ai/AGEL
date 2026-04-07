# AGEL Website - Complete Documentation

## Project Overview

**AGEL** (African Genetics Engineering Limited) is a professional electrical engineering and consultancy website built with modern web technologies. The platform serves as both a public-facing website showcasing services, projects, and portfolio work, and a comprehensive admin dashboard for content management.

---

## Website Information

**Company Name:** AGEL (African Genetics Engineering Limited)  
**Website URL:** http://localhost:3000  
**Admin Panel:** http://localhost:3000/admin/login.html  
**Creator:** GALAXY DESIGN STUDIO (GDS)  
**Creator Contact:** 0556881003  

---

## Features

### Public Website
- **Service Showcase:** Displays 7 core electrical engineering services
- **Project Portfolio:** Showcase of completed projects with categories (Industrial, Commercial, Infrastructure, Maintenance)
- **Image Gallery:** Professional gallery with placeholder support
- **Consultation Form:** Client contact and consultation request submission
- **Responsive Design:** Mobile-first approach, works on all devices
- **Modern UI:** Yellow accent theme (#FFD000) with dark background

### Admin Dashboard
- **Authentication:** Secure login system with session management
- **Service Management:** Add, edit, delete electrical engineering services with custom icons
- **Project Management:** Complete CRUD for projects with image uploads
- **Gallery Management:** Manage gallery items with image upload support
- **Consultation Management:** View and manage client consultation requests
- **Real-time Sync:** All changes immediately reflect on the public website

---

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables, animations, gradients
- **JavaScript (Vanilla)** - No framework dependencies for lightweight performance
- **Font Awesome 6.5.0** - Icon library
- **Fetch API** - Client-server communication

### Backend
- **Node.js** - JavaScript runtime
- **Express 4.18.2** - Web framework
- **Express-Session 1.17.3** - Server-side session management
- **Multer 1.4.5-lts.1** - File upload handling
- **CORS** - Cross-origin resource sharing
- **JSON** - Data persistence (no database required)

### File Structure
```
agel/
├── package.json              # Dependencies and scripts
├── server.js                 # Express backend + API routes
├── DOCUMENTATION.md          # This file
├── public/                   # Website files
│   ├── index.html           # Main website
│   ├── profile.png          # Admin profile picture
│   ├── logo.png             # AGEL logo
│   ├── home.png             # Hero background
│   ├── uploads/             # Generated: uploaded images
│   ├── css/
│   │   └── style.css        # Website styling
│   └── js/
│       ├── data.js          # Data layer (fetches from API)
│       └── main.js          # Website logic
├── admin/                    # Admin panel
│   ├── login.html           # Login page
│   ├── dashboard.html       # Main dashboard
│   ├── css/
│   │   └── dashboard.css    # Admin styling
│   └── js/
│       └── dashboard.js     # Admin logic
└── data/                     # JSON data storage
    ├── services.json        # Services list
    ├── projects.json        # Projects list
    ├── gallery.json         # Gallery items
    ├── consultations.json   # Consultation requests
    ├── seed_services.json   # Default services
    └── seed_projects.json   # Default projects
```

---

## Admin Credentials

**Default Login:**
- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Security Note:** In production, change these credentials and use environment variables.

---

## Admin Dashboard Guide

### Accessing Admin Panel
1. Navigate to: http://localhost:3000/admin/login.html
2. Enter username: `admin`
3. Enter password: `admin123`
4. Click Login

### Dashboard Tabs

#### 1. Overview
- Quick statistics dashboard
- Total services, projects, gallery items, and consultation requests
- Recent consultation requests preview

#### 2. Services Management
- **View:** Table showing all services
- **Add:** Click "Add Service" button
  - Service Title (required)
  - Description (required)
  - Icon (Font Awesome class)
  - Click "Save Service"
- **Edit:** Click Edit button on any service
  - Modify title, description, or icon
  - Click "Save Changes"
- **Delete:** Click trash icon to remove service

#### 3. Projects Management
- **View:** Table showing all projects
- **Add:** Click "Add Project" button
  - Project Title (required)
  - Category (Industrial/Commercial/Infrastructure/Maintenance)
  - Description (required)
  - Upload Project Image (optional)
  - Click "Add Project"
- **Edit:** Click Edit button to modify project details and image
- **Delete:** Click trash icon to remove project

#### 4. Gallery Management
- **View:** Grid showing all gallery items
- **Add:** Click "Add Item" button
  - Caption/Label (required)
  - Upload Image (required)
  - Placeholder Icon (if image fails to load)
  - Click "Add Image"
- **Edit:** Click Edit button on any gallery item to update caption or image
- **Delete:** Click trash icon to remove gallery item

#### 5. Consultations
- **View:** Table of all consultation requests from website visitors
- **Delete:** Remove consultation request with trash icon
- **Fields:** Name, Email, Phone, Service, Date, Description

---

## How to Add Content (Step-by-Step)

### Adding a New Service
1. Click "Services" in admin sidebar
2. Click "Add Service" button
3. Enter title: "e.g., Smart Grid Solutions"
4. Enter description: "e.g., Advanced grid automation and monitoring systems"
5. Select icon from dropdown (e.g., fas fa-bolt)
6. Click "Save Service"
7. Service appears immediately on public website

### Adding a New Project
1. Click "Projects" in admin sidebar
2. Click "Add Project" button
3. Enter project title
4. Select category
5. Enter detailed description
6. Click "Choose File" and upload project image (JPG/PNG)
7. Click "Add Project"
8. Project appears on website with image and category filter

### Adding Gallery Images
1. Click "Gallery" in admin sidebar
2. Click "Add Item" button
3. Enter image caption/label
4. Click "Choose File" and select image
5. Optionally select placeholder icon (shown if image doesn't load)
6. Click "Add Image"
7. Image appears in gallery grid with hover effects

### Submitting Consultation Request (via public website)
1. Visitor fills contact form on website
2. System automatically records request
3. Admin can view in Consultations tab
4. Admin receives consultation details (name, email, phone, service, description)

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/status` - Check authentication status

### Services (Public Read, Admin Write)
- `GET /api/services` - Get all services
- `POST /api/services` - Create service (requires auth)
- `PUT /api/services/:id` - Update service (requires auth)
- `DELETE /api/services/:id` - Delete service (requires auth)

### Projects (Public Read, Admin Write)
- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create project (requires auth)
- `PUT /api/projects/:id` - Update project (requires auth)
- `DELETE /api/projects/:id` - Delete project (requires auth)

### Gallery (Public Read, Admin Write)
- `GET /api/gallery` - Get all gallery items
- `POST /api/gallery` - Create gallery item (requires auth)
- `PUT /api/gallery/:id` - Update gallery item (requires auth)
- `DELETE /api/gallery/:id` - Delete gallery item (requires auth)

### Consultations (Public Write, Admin Read)
- `POST /api/consultations` - Submit consultation request
- `GET /api/consultations` - Get all requests (requires auth)
- `DELETE /api/consultations/:id` - Delete request (requires auth)

### File Upload
- `POST /api/upload` - Upload image file (requires auth)
  - Returns: `{ success: true, url: "/uploads/filename.jpg" }`

---

## Data Formats

### Service Object
```json
{
  "id": 1,
  "title": "Electrical Engineering Consultancy",
  "desc": "Expert consultation for electrical projects...",
  "icon": "fas fa-hard-hat"
}
```

### Project Object
```json
{
  "id": 1,
  "title": "Tema Industrial Zone Electrification",
  "desc": "Complete MV/LV electrification...",
  "category": "Industrial",
  "img": "/uploads/project-123456.jpg"
}
```

### Gallery Object
```json
{
  "id": 1,
  "label": "Power Substation Installation",
  "url": "/uploads/gallery-123456.jpg",
  "icon": "fas fa-broadcast-tower"
}
```

### Consultation Object
```json
{
  "id": 1712345678,
  "date": "3/5/2026, 10:30:45 AM",
  "name": "John Doe",
  "company": "Tech Solutions Ltd",
  "email": "john@example.com",
  "phone": "+233-XXXXXXXXX",
  "service": "Power System Design",
  "description": "Need design for new facility..."
}
```

---

## Starting the Server

### Prerequisites
- Node.js 14+ installed
- npm installed

### Installation
```bash
cd agel
npm install
```

### Running
```bash
npm start
```

Server will start at: **http://localhost:3000**

### Development Mode (with auto-restart)
```bash
npm run dev
```
(Requires nodemon: `npm install --save-dev nodemon`)

---

## Default Data

### Initial Services (7 services)
1. Electrical Engineering Consultancy
2. Power System Design
3. Industrial Electrical Installations
4. Power Distribution Systems
5. Electrical Maintenance & Repairs
6. Energy Efficiency Solutions
7. Electrical Safety Inspections

### Initial Projects (6 projects)
1. Tema Industrial Zone Electrification
2. Commercial Plaza Power System Design
3. Ghana Highway Street Lighting Project
4. Factory Predictive Maintenance Programme
5. Port Facility Power Distribution Upgrade
6. Hotel Energy Efficiency Retrofit

### Initial Gallery (6 items with placeholder icons)
1. Power Substation Installation
2. Industrial Panel Wiring
3. Street Lighting Project
4. Cable Tray Installation
5. Control Room Setup
6. Safety Inspection

---

## Customization

### Changing Admin Credentials
Edit `server.js` lines 18-19:
```javascript
const ADMIN_USERNAME = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'admin123';
```

### Changing Company Name/Logo
- Replace `public/logo.png` with your logo
- Replace `public/profile.png` with admin profile picture
- Update footer text in `public/index.html`

### Changing Colors
Edit variables in CSS files:
- `public/css/style.css` - Website colors
- `admin/css/dashboard.css` - Admin panel colors
- Primary color: `#FFD000` (yellow)

### Adding More Services
Add entries to `data/seed_services.json` and they'll appear on next startup

### Changing Header/Footer
Edit `public/index.html` to customize website header and footer content

---

## Troubleshooting

### Issue: Port 3000 Already in Use
**Solution:**
```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :3000
kill -9 <PID>
```

### Issue: Images Not Uploading
- Ensure `/public/uploads/` folder exists
- Check file size (<10MB)
- Supported formats: JPG, PNG, GIF, WebP

### Issue: Login Not Working
- Verify credentials are correct (admin/admin123 by default)
- Check browser console for errors (F12)
- Ensure server is running

### Issue: Changes Not Showing on Website
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check Network tab in browser DevTools
- Verify API responses in Network tab

---

## Performance Tips

1. **Optimize Images:** Compress images before uploading (reduce to 400x300px)
2. **Clear Old Data:** Regularly clean up old consultations
3. **Browser Cache:** Clear periodically during development
4. **Session Timeout:** User auto-logs out after 7 days

---

## Security Notes

⚠️ **Before Production Deployment:**

1. Change admin credentials
2. Use environment variables for sensitive data
3. Enable HTTPS
4. Set up database (replace JSON files)
5. Implement CSRF protection
6. Add rate limiting for API
7. Validate all file uploads
8. Add comprehensive logging
9. Set up backup system
10. Use reverse proxy (Nginx/Apache)

---

## Contact & Support

**Website Creator:** GALAXY DESIGN STUDIO (GDS)  
**Contact Number:** 0556881003  
**Email:** (Add your email)  
**Website:** (Add your website)

For issues or feature requests, please contact the development team.

---

## Version Information

- **Website Version:** 1.0.0
- **Created:** March 2026
- **Last Updated:** April 5, 2026
- **Node.js Version:** 14+
- **Express Version:** 4.18.2

---

## License

All content and code are proprietary to AGEL (African Genetics Engineering Limited).

---

**End of Documentation**
