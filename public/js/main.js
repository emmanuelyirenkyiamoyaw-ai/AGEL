/* ================================================================
   main.js — Public Website Logic
   Handles: Navbar, Services, Projects, Gallery, Form, Lightbox
================================================================ */

/* Initialize data from server */
(async function() {
  await AGEL_DATA.init();
  renderPageContent();
})();

const DEFAULT_QR_CODE_URL = 'frame.png';

function getQrCodeUrl(settings = {}) {
  const qrCodeUrl = typeof settings.qrCodeUrl === 'string' ? settings.qrCodeUrl.trim() : '';
  if (!qrCodeUrl || qrCodeUrl === '/uploads/frame.png' || qrCodeUrl === '/frame.png') {
    return DEFAULT_QR_CODE_URL;
  }
  return qrCodeUrl;
}

function renderPageContent() {
(function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const toggle    = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  const allLinks  = navLinks.querySelectorAll('.nav-link');

  // Sticky on scroll
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    highlightActiveLink();
  });

  // Mobile toggle
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // Close menu on link click
  allLinks.forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  // Highlight nav link matching visible section
  function highlightActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
    });
    allLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  }
})();

applySiteSettings();

/* ----------------------------------------------------------------
   FOOTER — dynamic year
---------------------------------------------------------------- */
document.getElementById('footerYear').textContent = new Date().getFullYear();


/* ----------------------------------------------------------------
   SERVICES — render cards from AGEL_DATA
---------------------------------------------------------------- */
(function renderServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const services = AGEL_DATA.services;
  grid.innerHTML = services.map(s => `
    <div class="service-card" data-id="${s.id}">
      <div class="service-icon"><i class="${s.icon}"></i></div>
      <h3>${s.title}</h3>
      <p>${s.desc}</p>
    </div>
  `).join('');
})();


/* ----------------------------------------------------------------
   PROJECTS — render + category filter
---------------------------------------------------------------- */
(function renderProjects() {
  const grid       = document.getElementById('projectsGrid');
  const filterTabs = document.getElementById('filterTabs');
  if (!grid) return;

  let currentFilter = 'all';

  function iconForCategory(cat) {
    const map = { Industrial: 'fa-industry', Commercial: 'fa-building', Infrastructure: 'fa-road', Maintenance: 'fa-tools' };
    return `fas ${map[cat] || 'fa-bolt'}`;
  }

  function render(filter) {
    const projects = AGEL_DATA.projects;
    const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);
    grid.innerHTML = filtered.map(p => `
      <div class="project-card">
        <div class="project-img-wrap">
          ${p.img
            ? `<img src="${p.img}" alt="${p.title}" loading="lazy" />`
            : `<div class="project-img-placeholder"><i class="${iconForCategory(p.category)}"></i></div>`
          }
          <span class="project-category">${p.category}</span>
        </div>
        <div class="project-info">
          <h3>${p.title}</h3>
          <p>${p.desc}</p>
        </div>
      </div>
    `).join('');
  }

  // Filter tab clicks
  filterTabs.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render(currentFilter);
    });
  });

  render(currentFilter);
})();


/* ----------------------------------------------------------------
   GALLERY — render grid + lightbox
---------------------------------------------------------------- */
(function renderGallery() {
  const grid    = document.getElementById('galleryGrid');
  const lightbox  = document.getElementById('lightbox');
  const lbClose   = document.getElementById('lightboxClose');
  const lbImg     = document.getElementById('lightboxImg');
  if (!grid) return;

  function render() {
    const gallery = AGEL_DATA.gallery;
    grid.innerHTML = gallery.map(item => `
      <div class="gallery-item" data-url="${item.url || ''}">
        ${item.url
          ? `<img src="${item.url}" alt="${item.label}" loading="lazy" />`
          : `<div class="gallery-placeholder"><i class="${item.icon || 'fas fa-bolt'}"></i><span>${item.label}</span></div>`
        }
        <div class="gallery-item-overlay"><i class="fas fa-expand"></i></div>
      </div>
    `).join('');

    // Attach lightbox on real images
    grid.querySelectorAll('.gallery-item').forEach(item => {
      const url = item.dataset.url;
      if (url) {
        item.addEventListener('click', () => {
          lbImg.src = url;
          lightbox.classList.add('open');
        });
      }
    });
  }

  lbClose.addEventListener('click', () => lightbox.classList.remove('open'));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lightbox.classList.remove('open'); });

  render();
})();


/* ----------------------------------------------------------------
   CONSULTATION FORM — submit + save to localStorage
---------------------------------------------------------------- */
(function initForm() {
  const form   = document.getElementById('consultationForm');
  const msgBox = document.getElementById('formMsg');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const data = {
      name:        form.clientName.value.trim(),
      company:     form.clientCompany.value.trim(),
      email:       form.clientEmail.value.trim(),
      phone:       form.clientPhone.value.trim(),
      service:     form.serviceNeeded.value,
      description: form.projectDesc.value.trim()
    };

    // Basic validation
    if (!data.name || !data.email || !data.phone || !data.service || !data.description) {
      showMsg('Please fill in all required fields.', 'error');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(data.email)) {
      showMsg('Please enter a valid email address.', 'error');
      return;
    }

    // Send to API
    fetch('/api/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        showMsg('✓ Your consultation request has been submitted! We will contact you within 24 hours.', 'success');
        form.reset();
      } else {
        showMsg('Error submitting request. Please try again.', 'error');
      }
    })
    .catch(err => {
      console.error('Submission error:', err);
      showMsg('Error submitting request. Please try again.', 'error');
    });
  });

  function showMsg(text, type) {
    msgBox.textContent = text;
    msgBox.className   = `form-msg ${type}`;
    setTimeout(() => { msgBox.textContent = ''; msgBox.className = 'form-msg'; }, 6000);
  }
})();


/* ----------------------------------------------------------------
   SCROLL REVEAL — fade in sections on scroll
---------------------------------------------------------------- */
(function initScrollReveal() {
  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .reveal.visible { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);

  // Add reveal class to all section headers and cards
  document.querySelectorAll('.section-header, .service-card, .project-card, .gallery-item, .mv-card, .contact-card').forEach(el => {
    el.classList.add('reveal');
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();
}

function applySiteSettings() {
  const settings = AGEL_DATA.settings || {};

  function renderHeroStat(id, rawText) {
    const numEl = document.getElementById(id);
    const labelEl = document.getElementById(`${id}Label`);
    if (!numEl || !labelEl || !rawText) return;
    const parts = rawText.split(' ');
    const value = parts.shift();
    numEl.textContent = value;
    labelEl.textContent = parts.join(' ');
  }

  renderHeroStat('heroStat1', settings.heroStat1 || '50+ Projects Completed');
  renderHeroStat('heroStat2', settings.heroStat2 || '10+ Years Experience');
  renderHeroStat('heroStat3', settings.heroStat3 || '100% Safety Compliance');

  const manager = (AGEL_DATA.team && AGEL_DATA.team[0]) || null;
  if (manager) {
    const managerPhoto = document.getElementById('managerPhoto');
    if (managerPhoto) managerPhoto.src = manager.img || '/profile.png';
    const managerName = document.getElementById('managerName');
    if (managerName) managerName.textContent = manager.name;
    const managerRole = document.getElementById('managerRole');
    if (managerRole) managerRole.textContent = manager.role;
    const managerBio = document.getElementById('managerBio');
    if (managerBio) managerBio.textContent = manager.bio;
  }

  const phone1 = document.getElementById('contactPhone1');
  const phone2 = document.getElementById('contactPhone2');
  const email = document.getElementById('contactEmail');
  const address = document.getElementById('contactAddress');
  const hours = document.getElementById('contactHours');
  const footerPhone1 = document.getElementById('footerPhone1');
  const footerPhone2 = document.getElementById('footerPhone2');
  const footerEmail = document.getElementById('footerEmail');
  const footerAddress = document.getElementById('footerAddress');
  const gdsLink = document.getElementById('gdsLink');
  const qrImage = document.getElementById('qrCodeImage');
  const qrFallback = document.getElementById('qrCodeFallback');

  if (phone1) {
    phone1.textContent = settings.companyPhone1 || '0266903265';
    phone1.href = `tel:${settings.companyPhone1 || '0266903265'}`;
  }
  if (phone2) {
    phone2.textContent = settings.companyPhone2 || '0592765066';
    phone2.href = `tel:${settings.companyPhone2 || '0592765066'}`;
  }
  if (email) {
    email.textContent = settings.companyEmail || 'afrigenegcon@gmail.com';
    email.href = `mailto:${settings.companyEmail || 'afrigenegcon@gmail.com'}`;
  }
  if (address) address.textContent = settings.companyAddress || 'Community 25, Tema, Ghana';
  if (hours) hours.textContent = settings.workingHours || 'Mon – Fri: 8:00 AM – 6:00 PM';
  if (footerPhone1) {
    footerPhone1.textContent = settings.companyPhone1 || '02669003265';
    footerPhone1.href = `tel:${settings.companyPhone1 || '02669003265'}`;
  }
  if (footerPhone2) {
    footerPhone2.textContent = settings.companyPhone2 || '0592765066';
    footerPhone2.href = `tel:${settings.companyPhone2 || '0592765066'}`;
  }
  if (footerEmail) {
    footerEmail.textContent = settings.companyEmail || 'afrigenegcon@gmail.com';
    footerEmail.href = `mailto:${settings.companyEmail || 'afrigenegcon@gmail.com'}`;
  }
  if (footerAddress) footerAddress.textContent = settings.companyAddress || 'Community 25, Tema, Ghana';
  if (gdsLink) {
    gdsLink.href = settings.galaxyDesignsLink || 'https://galaxydesignsstudio.com';
  }

  if (qrImage) {
    qrImage.onerror = () => {
      if (!qrImage.src.endsWith('frame.png')) {
        qrImage.src = 'frame.png';
      }
    };
    qrImage.src = getQrCodeUrl(settings);
  }
}
