/* ================================================================
   AGEL ADMIN DASHBOARD
   Handles: Auth guard, Tab switching, CRUD for all data entities,
   Settings management, and Real-time UI updates
================================================================ */

/* ================================================================
   SECTION 1: AUTHENTICATION & INITIALIZATION
================================================================ */

const DEFAULT_QR_CODE_URL = 'frame.png';

function getQrCodeUrl(settings = {}) {
  const qrCodeUrl = typeof settings.qrCodeUrl === 'string' ? settings.qrCodeUrl.trim() : '';
  if (!qrCodeUrl || qrCodeUrl === '/uploads/frame.png' || qrCodeUrl === '/frame.png') {
    return DEFAULT_QR_CODE_URL;
  }
  return qrCodeUrl;
}

/**
 * Check if user is authenticated before allowing access to dashboard
 * Redirects to login page if not authenticated
 */
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/status', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'login.html';
    return false;
  }
}

/* ================================================================
   SECTION 2: GLOBAL DATA MANAGEMENT
================================================================ */

/**
 * Central data store for all dashboard content
 * Manages services, projects, gallery, team, settings, consultations
 */
const AGEL_DATA = {
  services: [],
  projects: [],
  gallery: [],
  consultations: [],
  team: [],
  settings: {},
  auth: {},

  /**
   * Initialize all data from server endpoints
   * Uses Promise.allSettled for resilience - one failing endpoint won't block others
   */
  async init() {
    const endpoints = [
      { key: 'services', url: '/api/services', defaultValue: [] },
      { key: 'projects', url: '/api/projects', defaultValue: [] },
      { key: 'gallery', url: '/api/gallery', defaultValue: [] },
      { key: 'consultations', url: '/api/consultations', defaultValue: [] },
      { key: 'team', url: '/api/team', defaultValue: [] },
      { key: 'settings', url: '/api/settings', defaultValue: {} },
      { key: 'auth', url: '/api/auth/credentials', defaultValue: {} }
    ];

    try {
      const results = await Promise.allSettled(endpoints.map(endpoint =>
        fetch(endpoint.url, { credentials: 'include' })
      ));

      for (let i = 0; i < endpoints.length; i++) {
        const { key, defaultValue, url } = endpoints[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          const res = result.value;
          if (res.ok) {
            try {
              this[key] = await res.json();
            } catch (parseError) {
              console.error(`Failed to parse JSON from ${url}:`, parseError);
              this[key] = defaultValue;
            }
          } else {
            console.error(`${url} returned ${res.status}`);
            this[key] = defaultValue;
          }
        } else {
          console.error(`Fetch failed for ${url}:`, result.reason);
          this[key] = defaultValue;
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      endpoints.forEach(({ key, defaultValue }) => {
        this[key] = defaultValue;
      });
    }
  },

  /**
   * Calculate next available ID for new items
   */
  nextId(arr) {
    return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
  },

  /**
   * Bulk save services to server
   */
  async saveServices(services) {
    this.services = services;
    await fetch('/api/services', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(services)
    });
  },

  /**
   * Bulk save projects to server
   */
  async saveProjects(projects) {
    this.projects = projects;
    await fetch('/api/projects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projects)
    });
  },

  /**
   * Bulk save gallery items to server
   */
  async saveGallery(gallery) {
    this.gallery = gallery;
    await fetch('/api/gallery', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gallery)
    });
  },

  /**
   * Bulk save consultations to server
   */
  async saveConsultations(consultations) {
    this.consultations = consultations;
    await fetch('/api/consultations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultations)
    });
  }
};

/* ================================================================
   SECTION 3: USER FEEDBACK & NOTIFICATIONS
================================================================ */

/**
 * Display toast notification to user
 * @param {string} message - Notification message
 * @param {string} type - Notification type: 'info', 'success', 'error', 'warning'
 */
function showNotification(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3800);
}

/* ================================================================
   SECTION 4: APP INITIALIZATION
================================================================ */

/**
 * Initialize dashboard on page load
 * Check auth, load data, and render initial UI
 */
(async function initAuth() {
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    await AGEL_DATA.init();
    const usernameEl = document.getElementById('userInfo');
    if (usernameEl) usernameEl.textContent = AGEL_DATA.auth.adminUsername || 'Admin';
    refreshDashboard();
  }
})();

/* ================================================================
   SECTION 5: AUTHENTICATION ACTIONS
================================================================ */

/**
 * Handle logout button click
 */
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
  window.location.href = 'login.html';
});

/**
 * Handle manual GitHub synchronization
 */
const syncBtn = document.getElementById('manualSyncBtn');
if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    try {
      syncBtn.disabled = true;
      syncBtn.classList.add('syncing');
      syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
      
      const res = await fetch('/api/sync', { 
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      
      if (res.ok) {
        showNotification(data.message || 'GitHub synchronization complete!', 'success');
        updateSyncStatus();
      } else {
        throw new Error(data.error || 'Synchronization failed.');
      }
    } catch (err) {
      console.error('Manual sync failed:', err);
      showNotification('Sync Error: ' + err.message, 'error');
    } finally {
      syncBtn.disabled = false;
      syncBtn.classList.remove('syncing');
      syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync to GitHub';
    }
  });
}


/* ================================================================
   SECTION 6: MOBILE SIDEBAR TOGGLE
================================================================ */

const sidebarToggle = document.getElementById('sidebarToggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

/* ================================================================
   SECTION 7: TAB NAVIGATION & ROUTING
================================================================ */

const tabTitles = {
  overview:      'Dashboard Overview',
  services:      'Manage Services',
  projects:      'Manage Projects',
  gallery:       'Manage Gallery',
  team:          'Manage Team',
  settings:      'Site Settings',
  consultations: 'Consultation Requests'
};

/**
 * Handle tab navigation clicks
 */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tabId = item.dataset.tab;

    // Update active nav item styling
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    // Show active tab content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Update topbar title
    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle) topbarTitle.textContent = tabTitles[tabId] || '';

    // Render relevant tab content
    renderTab(tabId);

    // Close mobile sidebar
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.classList.remove('open');
  });
});

/**
 * Route to appropriate render function based on tab
 */
function renderTab(id) {
  switch (id) {
    case 'overview':      renderOverview();      break;
    case 'services':      renderServices();      break;
    case 'projects':      renderProjects();      break;
    case 'gallery':       renderGallery();       break;
    case 'team':          renderTeam();          break;
    case 'settings':      renderSettings();      break;
    case 'consultations': renderConsultations(); break;
  }
}

/**
 * Refresh current dashboard view
 */
function refreshDashboard() {
  renderOverview();
  const activeTab = document.querySelector('.nav-item.active');
  if (activeTab) renderTab(activeTab.dataset.tab);
}

/* ================================================================
   SECTION 8: OVERVIEW TAB
================================================================ */

function renderOverview() {
  const services      = AGEL_DATA.services;
  const projects      = AGEL_DATA.projects;
  const gallery       = AGEL_DATA.gallery;
  const team          = AGEL_DATA.team;
  const consultations = AGEL_DATA.consultations;

  // Render statistics cards
  const statsRow = document.getElementById('statsRow');
  if (statsRow) {
    statsRow.innerHTML = `
      <div class="stat-card"><span class="stat-icon"><i class="fas fa-cogs"></i></span><span class="stat-num">${services.length}</span><span class="stat-lbl">Services</span></div>
      <div class="stat-card"><span class="stat-icon"><i class="fas fa-briefcase"></i></span><span class="stat-num">${projects.length}</span><span class="stat-lbl">Projects</span></div>
      <div class="stat-card"><span class="stat-icon"><i class="fas fa-images"></i></span><span class="stat-num">${gallery.length}</span><span class="stat-lbl">Gallery Items</span></div>
      <div class="stat-card"><span class="stat-icon"><i class="fas fa-users"></i></span><span class="stat-num">${team.length}</span><span class="stat-lbl">Team Members</span></div>
      <div class="stat-card"><span class="stat-icon"><i class="fas fa-envelope"></i></span><span class="stat-num">${consultations.length}</span><span class="stat-lbl">Requests</span></div>
    `;
  }

  // Render recent consultations (last 5)
  const recent = consultations.slice(0, 5);
  const recDiv = document.getElementById('recentConsultations');
  if (!recDiv) return;

  if (!recent.length) {
    recDiv.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No consultation requests yet.</p></div>';
    return;
  }
  recDiv.innerHTML = recent.map(c => `
    <div class="consult-row">
      <div>
        <div>${c.name}</div>
        <div class="muted">${c.email}</div>
      </div>
      <div>
        <div>${c.company || '—'}</div>
        <div class="muted">${c.phone}</div>
      </div>
      <div><span class="service-tag">${c.service}</span></div>
      <div class="muted" style="font-size:0.72rem;white-space:nowrap">${c.date}</div>
    </div>
  `).join('');
}

/* ================================================================
   SECTION 9: SERVICES TAB - CRUD OPERATIONS
================================================================ */

const ICON_OPTIONS = [
  { value: 'fas fa-hard-hat', label: 'Safety Helmet' },
  { value: 'fas fa-project-diagram', label: 'System Design' },
  { value: 'fas fa-industry', label: 'Industrial Plant' },
  { value: 'fas fa-network-wired', label: 'Network Wiring' },
  { value: 'fas fa-tools', label: 'Tools & Maintenance' },
  { value: 'fas fa-leaf', label: 'Energy Efficiency' },
  { value: 'fas fa-shield-alt', label: 'Safety Shield' },
  { value: 'fas fa-bolt', label: 'Electric Power' },
  { value: 'fas fa-plug', label: 'Power Plug' },
  { value: 'fas fa-lightbulb', label: 'Lighting' },
  { value: 'fas fa-server', label: 'Control System' },
  { value: 'fas fa-broadcast-tower', label: 'Transmission Tower' }
];

function renderIconOptions(options, selectedValue) {
  return options.map(({ value, label }) =>
    `<option value="${value}" ${selectedValue === value ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function renderServices() {
  const services = AGEL_DATA.services;
  const tbody    = document.getElementById('servicesTbody');
  if (!tbody) return;
  tbody.innerHTML = services.map(s => `
    <tr>
      <td class="icon-cell"><i class="${s.icon}"></i></td>
      <td><strong>${s.title}</strong></td>
      <td class="truncate">${s.desc}</td>
      <td>
        <div class="actions">
          <button class="btn btn-edit btn-sm" onclick="editService(${s.id})"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceModal(null));

function openServiceModal(service) {
  const isEdit = !!service;
  openModal(isEdit ? 'Edit Service' : 'Add New Service', `
    <div class="mform-group">
      <label>Service Title *</label>
      <input type="text" id="mSvcTitle" value="${isEdit ? escHtml(service.title) : ''}" placeholder="e.g. Power System Design" />
    </div>
    <div class="mform-group">
      <label>Description *</label>
      <textarea id="mSvcDesc" rows="3" placeholder="Brief description...">${isEdit ? escHtml(service.desc) : ''}</textarea>
    </div>
    <div class="mform-group">
      <label>Service Icon</label>
      <select id="mSvcIcon">
        ${renderIconOptions(ICON_OPTIONS, isEdit ? service.icon : '')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveService(${isEdit ? service.id : 'null'})">
        <i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Add Service'}
      </button>
    </div>
  `);
}

async function saveService(id) {
  try {
    const title = document.getElementById('mSvcTitle').value.trim();
    const desc  = document.getElementById('mSvcDesc').value.trim();
    const icon  = document.getElementById('mSvcIcon').value;
    if (!title || !desc) { alert('Please fill in all required fields.'); return; }

    const payload = { title, desc, icon };

    if (id) {
      const res = await fetch(\`/api/services/\${id}\`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update service.');
      AGEL_DATA.services = AGEL_DATA.services.map(s => s.id === id ? { ...s, title, desc, icon } : s);
    } else {
      const res = await fetch('/api/services', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create service.');
      AGEL_DATA.services.push(data.item);
    }

    closeModal();
    renderServices();
    refreshDashboard();
    showNotification(id ? 'Service updated.' : 'Service added.', 'success');
  } catch (err) {
    console.error('Save service error:', err);
    showNotification('Error saving service: ' + err.message, 'error');
  }
}

function editService(id) {
  const s = AGEL_DATA.services.find(x => x.id === id);
  if (s) openServiceModal(s);
}

async function deleteService(id) {
  if (!confirm('Delete this service?')) return;
  try {
    const res = await fetch(\`/api/services/\${id}\`, { 
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete service.');
    AGEL_DATA.services = AGEL_DATA.services.filter(s => s.id !== id);
    renderServices();
    refreshDashboard();
    showNotification('Service deleted.', 'success');
  } catch (err) {
    console.error('Delete service error:', err);
    showNotification('Error deleting service: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 10: PROJECTS TAB - CRUD OPERATIONS
================================================================ */

const PROJECT_CATEGORIES = ['Industrial', 'Commercial', 'Infrastructure', 'Maintenance'];

function renderProjects() {
  const projects = AGEL_DATA.projects;
  const tbody    = document.getElementById('projectsTbody');
  if (!tbody) return;
  tbody.innerHTML = projects.map(p => `
    <tr>
      <td><strong>${p.title}</strong></td>
      <td><span class="service-tag">${p.category}</span></td>
      <td class="truncate">${p.desc}</td>
      <td>
        <div class="actions">
          <button class="btn btn-edit btn-sm" onclick="editProject(${p.id})"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('addProjectBtn')?.addEventListener('click', () => openProjectModal(null));

function openProjectModal(project) {
  const isEdit = !!project;
  openModal(isEdit ? 'Edit Project' : 'Add New Project', `
    <div class="mform-group">
      <label>Project Title *</label>
      <input type="text" id="mPrjTitle" value="\${isEdit ? escHtml(project.title) : ''}" placeholder="Project name" />
    </div>
    <div class="mform-group">
      <label>Category *</label>
      <select id="mPrjCat">
        \${PROJECT_CATEGORIES.map(c => \`<option \${isEdit && project.category === c ? 'selected' : ''}>\${c}</option>\`).join('')}
      </select>
    </div>
    <div class="mform-group">
      <label>Description *</label>
      <textarea id="mPrjDesc" rows="3">\${isEdit ? escHtml(project.desc) : ''}</textarea>
    </div>
    <div class="mform-group">
      <label>Project Image</label>
      <input type="file" id="mPrjImgFile" accept="image/*" style="margin-bottom: 0.5rem;" onchange="handleFileSelect(this, 'prjPreview')" />
      <div id="prjPreview" class="img-preview-container" style="\${isEdit && project.img ? '' : 'display:none;'}">
        \${isEdit && project.img ? \`<img src="\${project.img}" id="prjPreviewImg" />\` : '<img src="" id="prjPreviewImg" />'}
        <button type="button" class="btn-remove-img" onclick="clearImage('mPrjImgFile', 'prjPreview')" title="Remove image">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <input type="hidden" id="mPrjImgPath" value="\${isEdit ? project.img || '' : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProject(\${isEdit ? project.id : 'null'})">
        <i class="fas fa-save"></i> \${isEdit ? 'Save Changes' : 'Add Project'}
      </button>
    </div>
  `);
}

async function saveProject(id) {
  try {
    const title    = document.getElementById('mPrjTitle').value.trim();
    const category = document.getElementById('mPrjCat').value;
    const desc     = document.getElementById('mPrjDesc').value.trim();
    const fileInput = document.getElementById('mPrjImgFile');
    const existingImg = document.getElementById('mPrjImgPath').value;
    
    if (!title || !desc) { alert('Title and description are required.'); return; }

    let img = existingImg;
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const res = await fetch('/api/upload', { 
        method: 'POST',
        credentials: 'include',
        body: formData 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image upload failed.');
      img = data.url;
    }

    const payload = { title, desc, category, img };
    if (id) {
      const res = await fetch(\`/api/projects/\${id}\`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update project.');
      AGEL_DATA.projects = AGEL_DATA.projects.map(p => p.id === id ? { ...p, title, category, desc, img } : p);
    } else {
      const res = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project.');
      AGEL_DATA.projects.push(data.item);
    }

    closeModal();
    renderProjects();
    refreshDashboard();
    showNotification(id ? 'Project updated.' : 'Project added.', 'success');
  } catch (err) {
    console.error('Save project error:', err);
    showNotification('Error saving project: ' + err.message, 'error');
  }
}

function editProject(id) {
  const p = AGEL_DATA.projects.find(x => x.id === id);
  if (p) openProjectModal(p);
}

async function deleteProject(id) {
  if (!confirm('Delete this project?')) return;
  try {
    const res = await fetch(\`/api/projects/\${id}\`, { 
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete project.');
    AGEL_DATA.projects = AGEL_DATA.projects.filter(p => p.id !== id);
    renderProjects();
    refreshDashboard();
    showNotification('Project deleted.', 'success');
  } catch (err) {
    console.error('Delete project error:', err);
    showNotification('Error deleting project: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 11: GALLERY TAB - CRUD OPERATIONS
================================================================ */

const GALLERY_ICONS = [
  { value: 'fas fa-broadcast-tower', label: 'Transmission Tower' },
  { value: 'fas fa-bolt', label: 'Electric Power' },
  { value: 'fas fa-lightbulb', label: 'Lighting' },
  { value: 'fas fa-plug', label: 'Power Plug' },
  { value: 'fas fa-server', label: 'Control System' },
  { value: 'fas fa-shield-alt', label: 'Safety Shield' }
];

function renderGallery() {
  const gallery = AGEL_DATA.gallery;
  const grid    = document.getElementById('galleryAdminGrid');
  if (!grid) return;
  grid.innerHTML = gallery.map(item => `
    <div class="gallery-admin-item">
      <div class="gallery-admin-thumb">
        \${item.url
          ? \`<img src="\${item.url}" alt="\${item.label}" />\`
          : \`<i class="\${item.icon || 'fas fa-image'}"></i>\`
        }
      </div>
      <div class="gallery-admin-info">
        <span title="\${item.label}">\${item.label}</span>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-edit btn-sm" onclick="editGalleryItem(\${item.id})"><i class="fas fa-pen"></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteGalleryItem(\${item.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('addGalleryBtn')?.addEventListener('click', () => openGalleryModal(null));

function openGalleryModal(item) {
  const isEdit = !!item;
  openModal(isEdit ? 'Edit Gallery Image' : 'Add Gallery Image', `
    <div class="mform-group">
      <label>Label / Caption *</label>
      <input type="text" id="mGalLabel" value="\${isEdit ? escHtml(item.label) : ''}" placeholder="e.g. Power Substation Installation" />
    </div>
    <div class="mform-group">
      <label>Upload Image\${isEdit ? ' (leave empty to keep current)' : ' *'}</label>
      <input type="file" id="mGalImgFile" accept="image/*" \${!isEdit ? 'required' : ''} onchange="handleFileSelect(this, 'galPreview')" />
      <div id="galPreview" class="img-preview-container" style="\${isEdit && item.url ? '' : 'display:none;'}">
        \${isEdit && item.url ? \`<img src="\${item.url}" id="galPreviewImg" />\` : '<img src="" id="galPreviewImg" />'}
        <button type="button" class="btn-remove-img" onclick="clearImage('mGalImgFile', 'galPreview')" title="Remove image">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <input type="hidden" id="mGalImgPath" value="\${isEdit ? item.url || '' : ''}" />
    </div>
    <div class="mform-group">
      <label>Fallback Icon</label>
      <select id="mGalIcon">
        \${renderIconOptions(GALLERY_ICONS, isEdit ? item.icon : '')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveGalleryItem(\${isEdit ? item.id : 'null'})"><i class="fas fa-save"></i> \${isEdit ? 'Save Changes' : 'Add Image'}</button>
    </div>
  `);
}

async function saveGalleryItem(id) {
  try {
    const label = document.getElementById('mGalLabel').value.trim();
    const fileInput = document.getElementById('mGalImgFile');
    const existingUrl = document.getElementById('mGalImgPath').value;
    const icon  = document.getElementById('mGalIcon').value;
    
    if (!label) { alert('Label is required.'); return; }
    if (!id && !fileInput.files.length) { alert('Please select an image.'); return; }

    let url = existingUrl;
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const res = await fetch('/api/upload', { 
        method: 'POST',
        credentials: 'include',
        body: formData 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image upload failed.');
      url = data.url;
    }

    const payload = { label, url, icon };
    if (id) {
      const res = await fetch(\`/api/gallery/\${id}\`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update gallery item.');
      AGEL_DATA.gallery = AGEL_DATA.gallery.map(g => g.id === id ? { ...g, label, url, icon } : g);
    } else {
      const res = await fetch('/api/gallery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create gallery item.');
      AGEL_DATA.gallery.push(data.item);
    }

    closeModal();
    renderGallery();
    refreshDashboard();
    showNotification(id ? 'Gallery item updated.' : 'Gallery item added.', 'success');
  } catch (err) {
    console.error('Save gallery error:', err);
    showNotification('Error saving gallery item: ' + err.message, 'error');
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Remove this gallery image?')) return;
  try {
    const res = await fetch(\`/api/gallery/\${id}\`, { 
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete gallery item.');
    AGEL_DATA.gallery = AGEL_DATA.gallery.filter(g => g.id !== id);
    renderGallery();
    refreshDashboard();
    showNotification('Gallery item deleted.', 'success');
  } catch (err) {
    console.error('Delete gallery item error:', err);
    showNotification('Error deleting gallery item: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 12: TEAM TAB - CRUD OPERATIONS
================================================================ */

function renderTeam() {
  const tbody = document.getElementById('teamTbody');
  if (!tbody) return;
  const team = AGEL_DATA.team;
  if (!team.length) {
    tbody.innerHTML = \`<tr><td colspan="6" class="empty-state"><i class="fas fa-users"></i><p>No team members found. Add a team member to get started.</p></td></tr>\`;
    return;
  }
  tbody.innerHTML = team.map(member => \`
    <tr>
      <td><img src="\${member.img || '../profile.png'}" alt="\${escHtml(member.name)}" class="team-thumb" /></td>
      <td>\${escHtml(member.name)}</td>
      <td>\${escHtml(member.role)}</td>
      <td><a href="mailto:\${escHtml(member.email)}">\${escHtml(member.email)}</a></td>
      <td>\${escHtml(member.phone)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-edit btn-sm" onclick="editTeamMember(\${member.id})"><i class="fas fa-pen"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTeamMember(\${member.id})"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>
  \`).join('');
}

document.getElementById('addTeamBtn')?.addEventListener('click', () => openTeamModal(null));

function openTeamModal(member) {
  const isEdit = !!member;
  openModal(isEdit ? 'Edit Team Member' : 'Add Team Member', \`
    <div class="mform-group">
      <label>Name *</label>
      <input type="text" id="mTeamName" value="\${isEdit ? escHtml(member.name) : ''}" placeholder="Reuben Akwafo Tswasam" />
    </div>
    <div class="mform-group">
      <label>Role *</label>
      <input type="text" id="mTeamRole" value="\${isEdit ? escHtml(member.role) : ''}" placeholder="General Manager" />
    </div>
    <div class="mform-group">
      <label>Email</label>
      <input type="email" id="mTeamEmail" value="\${isEdit ? escHtml(member.email) : ''}" placeholder="manager@example.com" />
    </div>
    <div class="mform-group">
      <label>Phone</label>
      <input type="text" id="mTeamPhone" value="\${isEdit ? escHtml(member.phone) : ''}" placeholder="0266903265" />
    </div>
    <div class="mform-group">
      <label>Bio</label>
      <textarea id="mTeamBio" rows="4" placeholder="Short profile for the manager or team member...">\${isEdit ? escHtml(member.bio) : ''}</textarea>
    </div>
    <div class="mform-group">
      <label>Profile Picture</label>
      <input type="file" id="mTeamImgFile" accept="image/*" />
      \${isEdit && member.img ? \`<div style="font-size:0.85rem; color: #FFD000; margin-top:0.5rem;">Current: \${member.img}</div>\` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTeamMember(\${isEdit ? member.id : 'null'})">
        <i class="fas fa-save"></i> \${isEdit ? 'Save Member' : 'Add Member'}
      </button>
    </div>
  \`);
}

async function saveTeamMember(id) {
  try {
    const name  = document.getElementById('mTeamName').value.trim();
    const role  = document.getElementById('mTeamRole').value.trim();
    const email = document.getElementById('mTeamEmail').value.trim();
    const phone = document.getElementById('mTeamPhone').value.trim();
    const bio   = document.getElementById('mTeamBio').value.trim();
    const fileInput = document.getElementById('mTeamImgFile');

    if (!name || !role) { alert('Name and role are required.'); return; }

    let img = '';
    if (fileInput.files.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const res = await fetch('/api/upload', { 
        method: 'POST',
        credentials: 'include',
        body: formData 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image upload failed.');
      img = data.url;
    } else if (id) {
      const existing = AGEL_DATA.team.find(m => m.id === id);
      img = existing ? existing.img : '';
    }

    const payload = { name, role, email, phone, bio, img };
    if (id) {
      const res = await fetch(\`/api/team/\${id}\`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update team member.');
      AGEL_DATA.team = AGEL_DATA.team.map(m => m.id === id ? { ...m, name, role, email, phone, bio, img } : m);
    } else {
      const res = await fetch('/api/team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create team member.');
      AGEL_DATA.team.push(data.item);
    }

    closeModal();
    renderTeam();
    refreshDashboard();
    showNotification(id ? 'Team member updated.' : 'Team member added.', 'success');
  } catch (err) {
    console.error('Save team member error:', err);
    showNotification('Error saving team member: ' + err.message, 'error');
  }
}

function editTeamMember(id) {
  const member = AGEL_DATA.team.find(x => x.id === id);
  if (member) openTeamModal(member);
}

async function deleteTeamMember(id) {
  if (!confirm('Delete this team member?')) return;
  try {
    const res = await fetch(\`/api/team/\${id}\`, { 
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete team member.');
    AGEL_DATA.team = AGEL_DATA.team.filter(m => m.id !== id);
    renderTeam();
    refreshDashboard();
    showNotification('Team member deleted.', 'success');
  } catch (err) {
    console.error('Delete team member error:', err);
    showNotification('Error deleting team member: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 13: SETTINGS TAB - CREDENTIALS & CONFIG
================================================================ */

function renderSettings() {
  const settings = AGEL_DATA.settings || {};
  const phone1 = document.getElementById('settingsPhone1');
  const phone2 = document.getElementById('settingsPhone2');
  const email = document.getElementById('settingsEmail');
  const notificationEmails = document.getElementById('settingsNotificationEmails');
  const address = document.getElementById('settingsAddress');
  const hours = document.getElementById('settingsHours');
  const adminUsername = document.getElementById('settingsAdminUsername');
  const gds = document.getElementById('settingsGDSLink');
  
  if (phone1) phone1.value = settings.companyPhone1 || '';
  if (phone2) phone2.value = settings.companyPhone2 || '';
  if (email) email.value = settings.companyEmail || '';
  if (notificationEmails) notificationEmails.value = (settings.notificationEmails || []).join(', ');
  if (address) address.value = settings.companyAddress || '';
  if (hours) hours.value = settings.workingHours || '';
  if (adminUsername) adminUsername.value = AGEL_DATA.auth.adminUsername || '';
  if (gds) gds.value = settings.galaxyDesignsLink || '';
  
  const preview = document.getElementById('settingsQrPreview');
  if (preview) preview.innerHTML = \`<img src="\${getQrCodeUrl(settings)}" alt="QR Code" />\`;
}

/**
 * Parse JSON from response, handling edge cases where response is HTML instead of JSON
 */
async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(\`Unexpected response: \${text.slice(0, 200)}\`);
  }
}

document.getElementById('settingsForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  await saveSettings();
});

async function saveSettings() {
  try {
    const phone1 = document.getElementById('settingsPhone1').value.trim();
    const phone2 = document.getElementById('settingsPhone2').value.trim();
    const email  = document.getElementById('settingsEmail').value.trim();
    const notificationEmailsRaw = document.getElementById('settingsNotificationEmails').value.trim();
    const address = document.getElementById('settingsAddress').value.trim();
    const hours  = document.getElementById('settingsHours').value.trim();
    const adminUsername = document.getElementById('settingsAdminUsername').value.trim();
    const newPassword = document.getElementById('settingsNewPassword').value;
    const confirmPassword = document.getElementById('settingsConfirmPassword').value;
    const gds    = document.getElementById('settingsGDSLink').value.trim();
    const fileInput = document.getElementById('settingsQrFile');

    if (!adminUsername) {
      throw new Error('Admin username is required.');
    }
    if (newPassword && newPassword !== confirmPassword) {
      throw new Error('New password and confirmation do not match.');
    }

    const notificationEmails = notificationEmailsRaw
      .split(/[,;\\n]+/)
      .map(v => v.trim())
      .filter(Boolean);

    if (notificationEmails.some(e => !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e))) {
      throw new Error('Notification emails must be valid email addresses.');
    }

    let qrCodeUrl = getQrCodeUrl(AGEL_DATA.settings);
    if (fileInput?.files?.length > 0) {
      const formData = new FormData();
      formData.append('image', fileInput.files[0]);
      const uploadRes = await fetch('/api/upload', { 
        method: 'POST',
        credentials: 'include',
        body: formData 
      });
      const uploadData = await parseJsonResponse(uploadRes);
      if (!uploadRes.ok) throw new Error(uploadData.error || 'QR code upload failed.');
      qrCodeUrl = uploadData.url;
    }

    const settingsPayload = {
      companyPhone1: phone1,
      companyPhone2: phone2,
      companyEmail: email,
      notificationEmails,
      companyAddress: address,
      workingHours: hours,
      galaxyDesignsLink: gds,
      qrCodeUrl
    };
    const authPayload = {
      adminUsername,
      ...(newPassword ? { adminPassword: newPassword } : {})
    };

    // Save settings and credentials in parallel
    const [settingsRes, authRes] = await Promise.all([
      fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload)
      }),
      fetch('/api/auth/credentials', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authPayload)
      })
    ]);

    const settingsData = await parseJsonResponse(settingsRes);
    if (!settingsRes.ok) throw new Error(settingsData.error || 'Failed to save settings.');

    const authData = await parseJsonResponse(authRes);
    if (!authRes.ok) throw new Error(authData.error || 'Failed to save admin credentials.');

    AGEL_DATA.settings = settingsData.settings;
    AGEL_DATA.auth = { adminUsername: authData.adminUsername };
    const usernameEl = document.getElementById('userInfo');
    if (usernameEl) usernameEl.textContent = authData.adminUsername || 'Admin';
    renderSettings();
    refreshDashboard();
    showNotification('Settings and admin credentials saved successfully.', 'success');
  } catch (err) {
    console.error('Save settings error:', err);
    showNotification('Error saving settings: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 14: CONSULTATIONS TAB - VIEW & DELETE
================================================================ */

function renderConsultations() {
  const consultations = AGEL_DATA.consultations;
  const tbody         = document.getElementById('consultationsTbody');
  const noMsg         = document.getElementById('noConsultations');
  if (!tbody || !noMsg) return;

  if (!consultations.length) {
    tbody.innerHTML = '';
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';
  tbody.innerHTML = consultations.map(c => \`
    <tr>
      <td style="white-space:nowrap;font-size:0.78rem;color:#888">\${c.date}</td>
      <td><strong>\${c.name}</strong></td>
      <td>\${c.company || '—'}</td>
      <td><a href="mailto:\${c.email}" style="color:#FFD000">\${c.email}</a></td>
      <td>\${c.phone}</td>
      <td><span class="service-tag">\${c.service}</span></td>
      <td class="truncate" style="max-width:180px">\${c.description}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteConsultation(\${c.id})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  \`).join('');
}

async function deleteConsultation(id) {
  if (!confirm('Delete this consultation request?')) return;
  try {
    const res = await fetch(\`/api/consultations/\${id}\`, { 
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete consultation.');
    AGEL_DATA.consultations = AGEL_DATA.consultations.filter(c => c.id !== id);
    renderConsultations();
    refreshDashboard();
    showNotification('Consultation deleted.', 'success');
  } catch (err) {
    console.error('Delete consultation error:', err);
    showNotification('Error deleting consultation: ' + err.message, 'error');
  }
}

/* ================================================================
   SECTION 15: MODAL MANAGEMENT
================================================================ */

/**
 * Open modal with custom title and body content
 */
function openModal(title, bodyHtml) {
  try {
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const overlayEl = document.getElementById('modalOverlay');
    
    if (!titleEl || !bodyEl || !overlayEl) {
      console.error('Modal elements not found');
      return;
    }
    
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    overlayEl.classList.add('open');
  } catch (err) {
    console.error('Modal error:', err);
  }
}

/**
 * Close currently open modal
 */
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

const modalClose = document.getElementById('closeModal');
if (modalClose) {
  modalClose.addEventListener('click', closeModal);
}
document.getElementById('modalOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

/* ================================================================
   SECTION 16: UTILITY FUNCTIONS & SYNC PLUMBING
================================================================ */

function handleFileSelect(input, previewContainerId) {
  const container = document.getElementById(previewContainerId);
  if (!container) return;
  const img = container.querySelector('img');
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      if (img) img.src = e.target.result;
      container.style.display = 'inline-block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function clearImage(inputId, previewContainerId) {
  const input = document.getElementById(inputId);
  const container = document.getElementById(previewContainerId);
  if (!input || !container) return;
  const isProject = inputId.includes('Prj');
  const hiddenPathInput = document.getElementById(isProject ? 'mPrjImgPath' : 'mGalImgPath');
  
  input.value = '';
  if (hiddenPathInput) hiddenPathInput.value = '';
  container.style.display = 'none';
  const img = container.querySelector('img');
  if (img) img.src = '';
}

async function updateSyncStatus() {
  const statusEl = document.getElementById('syncStatus');
  if (!statusEl) return;
  
  try {
    const res = await fetch('/api/sync/status', { credentials: 'include' });
    const data = await res.json();
    
    if (data.lastSync) {
      const date = new Date(data.lastSync);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = \`Last synced: \${timeStr}\`;
    } else if (data.config) {
      statusEl.textContent = 'Not synced yet';
    } else {
      statusEl.textContent = 'Sync not configured';
      statusEl.style.color = 'var(--red)';
    }
  } catch (err) {
    console.error('Sync status fetch failed:', err);
  }
}

// Initial sync status check
updateSyncStatus();

/**
 * Escape HTML special characters to prevent XSS
 */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Expose functions for global use in inline onclick handlers
 */
window.editService       = editService;
window.deleteService     = deleteService;
window.saveService       = saveService;
window.editProject       = editProject;
window.deleteProject     = deleteProject;
window.saveProject       = saveProject;
window.openGalleryModal  = openGalleryModal;
window.editGalleryItem   = editGalleryItem;
window.deleteGalleryItem = deleteGalleryItem;
window.saveGalleryItem   = saveGalleryItem;
window.editTeamMember    = editTeamMember;
window.deleteTeamMember  = deleteTeamMember;
window.saveTeamMember    = saveTeamMember;
window.deleteConsultation = deleteConsultation;
window.closeModal        = closeModal;
window.clearImage        = clearImage;
window.handleFileSelect  = handleFileSelect;
