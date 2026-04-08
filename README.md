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
- Uploaded files are stored in `public/uploads/` by default.
- Content and credentials are stored in `data/` by default.
- On Render and similar hosts, the application filesystem is ephemeral by default. That means uploads and JSON data can be lost when the app redeploys or restarts.
- To preserve uploads and settings between deploys, configure persistent storage mounts and set these environment variables:
  - `DATA_DIR` for JSON data storage
  - `UPLOADS_DIR` for uploaded image storage

Example Render env vars:

```yaml
  envVars:
    - key: NODE_ENV
      value: production
    - key: SESSION_SECRET
      generateValue: true
    - key: DATA_DIR
      value: /path/to/persistent/data
    - key: UPLOADS_DIR
      value: /path/to/persistent/uploads
```
