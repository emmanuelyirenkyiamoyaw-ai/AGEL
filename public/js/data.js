/* ================================================================
   data.js — Data Management
   Fetches all site content from the API server
================================================================ */

const AGEL_DATA = {
  services: [],
  projects: [],
  gallery: [],
  consultations: [],
  team: [],
  settings: {},

  /* Initialize by fetching from API */
  async init() {
    try {
      const [servicesRes, projectsRes, galleryRes, teamRes, settingsRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/projects'),
        fetch('/api/gallery'),
        fetch('/api/team'),
        fetch('/api/settings')
      ]);

      this.services = await servicesRes.json();
      this.projects = await projectsRes.json();
      this.gallery = await galleryRes.json();
      this.team = await teamRes.json();
      this.settings = await settingsRes.json();
    } catch (err) {
      console.error('Failed to load data from server:', err);
      // Fallback to default data if API fails
      this.loadDefaults();
    }
  },

  loadDefaults() {
    this.services = [
      { id: 1, title: "Electrical Engineering Consultancy", desc: "Expert consultation for all electrical engineering needs — feasibility studies, design review, and technical advisory services.", icon: "fas fa-hard-hat" },
      { id: 2, title: "Power System Design",                desc: "End-to-end power system planning and design, including load analysis, single-line diagrams, and protection coordination.", icon: "fas fa-project-diagram" },
      { id: 3, title: "Industrial Electrical Installations", desc: "Full installation services for factories, warehouses, and industrial facilities — panels, conduit, motors, and control systems.", icon: "fas fa-industry" },
      { id: 4, title: "Power Distribution Systems",         desc: "Design and installation of low-voltage and medium-voltage distribution networks for reliable power delivery.", icon: "fas fa-network-wired" },
      { id: 5, title: "Electrical Maintenance & Repairs",   desc: "Scheduled and emergency maintenance for all electrical systems, ensuring maximum uptime and safe operation.", icon: "fas fa-tools" },
      { id: 6, title: "Energy Efficiency Solutions",        desc: "Audits, retrofits, and smart solutions that reduce energy consumption and lower operating costs for businesses.", icon: "fas fa-leaf" },
      { id: 7, title: "Electrical Safety Inspections",      desc: "Comprehensive safety assessments, testing, and compliance reporting to meet national and international electrical standards.", icon: "fas fa-shield-alt" }
    ];
    this.projects = [
      { id: 1, title: "Tema Industrial Zone Electrification",       desc: "Complete MV/LV electrification of a 5-hectare industrial estate including substations and distribution boards.", category: "Industrial",      img: "" },
      { id: 2, title: "Commercial Plaza Power System Design",        desc: "Full power system design and installation for a 12-storey commercial building in Accra central.",               category: "Commercial",     img: "" },
      { id: 3, title: "Ghana Highway Street Lighting Project",       desc: "Supply and installation of 120 LED street lighting units along a 15km highway corridor in Greater Accra.",    category: "Infrastructure", img: "" },
      { id: 4, title: "Factory Predictive Maintenance Programme",    desc: "Implementation of a 12-month predictive maintenance schedule for a large manufacturing plant in Tema.",         category: "Maintenance",    img: "" },
      { id: 5, title: "Port Facility Power Distribution Upgrade",    desc: "Upgrade of power distribution infrastructure for a logistics terminal, improving reliability and capacity.",   category: "Industrial",     img: "" },
      { id: 6, title: "Hotel Energy Efficiency Retrofit",            desc: "LED lighting, HVAC optimization and smart metering system installation reducing energy costs by 35%.",          category: "Commercial",     img: "" }
    ];
    this.gallery = [
      { id: 1, label: "Power Substation Installation", url: "", icon: "fas fa-broadcast-tower" },
      { id: 2, label: "Industrial Panel Wiring",        url: "", icon: "fas fa-bolt" },
      { id: 3, label: "Street Lighting Project",        url: "", icon: "fas fa-lightbulb" },
      { id: 4, label: "Cable Tray Installation",        url: "", icon: "fas fa-plug" },
      { id: 5, label: "Control Room Setup",             url: "", icon: "fas fa-server" },
      { id: 6, label: "Safety Inspection",              url: "", icon: "fas fa-shield-alt" }
    ];
    this.team = [
      { id: 1, name: "Reuben Akwafo Tswasam", role: "General Manager", bio: "Leading African Genetics Engineering Limited with deep expertise in power systems, industrial installations, and electrical consultancy across Ghana.", phone: "0266903265", email: "afrigenegcon@gmail.com", img: "/profile.png" }
    ];
    this.settings = {
      companyPhone1: "0266903265",
      companyPhone2: "0592765066",
      companyEmail: "afrigenegcon@gmail.com",
      companyAddress: "Community 25, Tema, Ghana",
      workingHours: "Mon – Fri: 8:00 AM – 6:00 PM",
      galaxyDesignsLink: "https://galaxydesignsstudio.com",
      qrCodeUrl: "",
      heroStat1: "50+ Projects Completed",
      heroStat2: "10+ Years Experience",
      heroStat3: "100% Safety Compliance"
    };
  },

  addConsultation(entry) {
    entry.id   = Date.now();
    entry.date = new Date().toLocaleString();
    this.consultations.unshift(entry);
  },

  nextId(arr) { return arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1; }
};
