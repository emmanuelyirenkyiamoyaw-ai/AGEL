# AGEL Website

AGEL is an Express-based website with a public site, an admin dashboard, JSON-backed content, and image uploads.

## Structure

```text
agel/
├── admin/              # Admin HTML, CSS, and JS
├── data/               # Live JSON data + seed JSON files
├── docs/               # Project documentation/reference notes
├── node_modules/       # Installed dependencies
├── public/             # Public website assets and uploads
├── .env                # Local environment variables
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml         # Render deployment config
└── server.js           # Express server
```

## Run Locally

```powershell
npm install
npm start
```

The site runs at `http://localhost:3000`.

Admin login is at `http://localhost:3000/admin/login.html`.

## Deployment Notes

- `render.yaml` is kept at the repo root for Render.
- Uploaded files are stored in `public/uploads/`.
- Content and credentials are stored in `data/`.
