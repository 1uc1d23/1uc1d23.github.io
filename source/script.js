(() => {
  // ---------- Config ----------
  const TOTAL_PAGES = 604;
  const CACHE_LIMIT = 80;
  const MAX_CONCURRENT_PREFETCH = 4;
  const DEFAULT_INITIAL_REPEAT_DELAY = 200;
  const DEFAULT_REPEAT_INTERVAL_MS = 80;
  const THEME_KEY = 'alquran_theme';
  const PAGE_KEY = 'alquran_last_page';
  const BOOKMARKS_KEY = 'alquran_bookmarks';
  const PAGES_JSON_URL = 'https://raw.githubusercontent.com/rn0x/Quran-Data/refs/heads/version-2.0/data/pagesQuran.json';

  // ---------- DOM refs ----------
  const pageImg = document.getElementById('pageImg');
  const viewer = document.getElementById('viewer');

  const menuOverlay = document.getElementById('menuOverlay');
  const menuEl = document.getElementById('menu');
  const pageInput = document.getElementById('pageInput');
  const goBtn = document.getElementById('goBtn');

  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsPanel = document.getElementById('settingsPanel');
  const btnDark = document.getElementById('btnDark');
  const btnSunset = document.getElementById('btnSunset');

  const navOverlay = document.getElementById('navOverlay');
  const navPanel = document.getElementById('navPanel');
  const navSearch = document.getElementById('navSearch');
  const navList = document.getElementById('navList');

  const bmOverlay = document.getElementById('bmOverlay');
  const bmPanel = document.getElementById('bmPanel');
  const bmAddBtn = document.getElementById('bmAddBtn');
  const bmTrashBtn = document.getElementById('bmTrashBtn');
  const bmList = document.getElementById('bmList');

  const bmPromptOverlay = document.getElementById('bmPromptOverlay');
  const bmPrompt = document.getElementById('bmPrompt');
  const bmNameInput = document.getElementById('bmNameInput');
  const bmPromptCancel = document.getElementById('bmPromptCancel');
  const bmPromptSave = document.getElementById('bmPromptSave');

  // ---------- State ----------
  let current = 1;
  const imageCache = new Map();
  const inFlight = new Set();
  const listeners = new Map();

  let repeating = false;
  let repeatDir = 0;
  let repeatTimeout = null;
  let repeatInterval = null;
  let REPEAT_INTERVAL_MS = DEFAULT_REPEAT_INTERVAL_MS;
  let PRELOAD_BEFORE = 10;
  let PRELOAD_AFTER = 10;

  const surahs = [
    { number: 1, name: "Al-Fatihah", verses: 7, startPage: 1 },
    { number: 2, name: "Al-Baqarah", verses: 286, startPage: 2 },
    { number: 3, name: "Ali 'Imran", verses: 200, startPage: 50 },
    { number: 4, name: "An-Nisa", verses: 176, startPage: 77 },
    { number: 5, name: "Al-Ma'idah", verses: 120, startPage: 106 },
    { number: 6, name: "Al-An'am", verses: 165, startPage: 128 },
    { number: 7, name: "Al-A'raf", verses: 206, startPage: 151 },
    { number: 8, name: "Al-Anfal", verses: 75, startPage: 177 },
    { number: 9, name: "At-Tawbah", verses: 129, startPage: 187 },
    { number: 10, name: "Yunus", verses: 109, startPage: 208 },
    { number: 11, name: "Hud", verses: 123, startPage: 221 },
    { number: 12, name: "Yusuf", verses: 111, startPage: 235 },
    { number: 13, name: "Ar-Ra'd", verses: 43, startPage: 249 },
    { number: 14, name: "Ibrahim", verses: 52, startPage: 255 },
    { number: 15, name: "Al-Hijr", verses: 99, startPage: 262 },
    { number: 16, name: "An-Nahl", verses: 128, startPage: 267 },
    { number: 17, name: "Al-Isra", verses: 111, startPage: 282 },
    { number: 18, name: "Al-Kahf", verses: 110, startPage: 293 },
    { number: 19, name: "Maryam", verses: 98, startPage: 305 },
    { number: 20, name: "Taha", verses: 135, startPage: 312 },
    { number: 21, name: "Al-Anbya", verses: 112, startPage: 322 },
    { number: 22, name: "Al-Hajj", verses: 78, startPage: 332 },
    { number: 23, name: "Al-Mu'minun", verses: 118, startPage: 342 },
    { number: 24, name: "An-Nur", verses: 64, startPage: 350 },
    { number: 25, name: "Al-Furqan", verses: 77, startPage: 359 },
    { number: 26, name: "Ash-Shu'ara", verses: 227, startPage: 367 },
    { number: 27, name: "An-Naml", verses: 93, startPage: 377 },
    { number: 28, name: "Al-Qasas", verses: 88, startPage: 385 },
    { number: 29, name: "Al-'Ankabut", verses: 69, startPage: 396 },
    { number: 30, name: "Ar-Rum", verses: 60, startPage: 404 },
    { number: 31, name: "Luqman", verses: 34, startPage: 411 },
    { number: 32, name: "As-Sajdah", verses: 30, startPage: 415 },
    { number: 33, name: "Al-Ahzab", verses: 73, startPage: 418 },
    { number: 34, name: "Saba", verses: 54, startPage: 428 },
    { number: 35, name: "Fatir", verses: 45, startPage: 434 },
    { number: 36, name: "Ya-Sin", verses: 83, startPage: 440 },
    { number: 37, name: "As-Saffat", verses: 182, startPage: 446 },
    { number: 38, name: "Sad", verses: 88, startPage: 453 },
    { number: 39, name: "Az-Zumar", verses: 75, startPage: 458 },
    { number: 40, name: "Ghafir", verses: 85, startPage: 467 },
    { number: 41, name: "Fussilat", verses: 54, startPage: 477 },
    { number: 42, name: "Ash-Shuraa", verses: 53, startPage: 483 },
    { number: 43, name: "Az-Zukhruf", verses: 89, startPage: 489 },
    { number: 44, name: "Ad-Dukhan", verses: 59, startPage: 496 },
    { number: 45, name: "Al-Jathiyah", verses: 37, startPage: 499 },
    { number: 46, name: "Al-Ahqaf", verses: 35, startPage: 502 },
    { number: 47, name: "Muhammad", verses: 38, startPage: 507 },
    { number: 48, name: "Al-Fath", verses: 29, startPage: 511 },
    { number: 49, name: "Al-Hujurat", verses: 18, startPage: 515 },
    { number: 50, name: "Qaf", verses: 45, startPage: 518 },
    { number: 51, name: "Adh-Dhariyat", verses: 60, startPage: 520 },
    { number: 52, name: "At-Tur", verses: 49, startPage: 523 },
    { number: 53, name: "An-Najm", verses: 62, startPage: 526 },
    { number: 54, name: "Al-Qamar", verses: 55, startPage: 528 },
    { number: 55, name: "Ar-Rahman", verses: 78, startPage: 531 },
    { number: 56, name: "Al-Waqi'ah", verses: 96, startPage: 534 },
    { number: 57, name: "Al-Hadid", verses: 29, startPage: 537 },
    { number: 58, name: "Al-Mujadila", verses: 22, startPage: 542 },
    { number: 59, name: "Al-Hashr", verses: 24, startPage: 545 },
    { number: 60, name: "Al-Mumtahanah", verses: 13, startPage: 549 },
    { number: 61, name: "As-Saf", verses: 14, startPage: 551 },
    { number: 62, name: "Al-Jumu'ah", verses: 11, startPage: 553 },
    { number: 63, name: "Al-Munafiqun", verses: 11, startPage: 554 },
    { number: 64, name: "At-Taghabun", verses: 18, startPage: 556 },
    { number: 65, name: "At-Talaq", verses: 12, startPage: 558 },
    { number: 66, name: "At-Tahrim", verses: 12, startPage: 560 },
    { number: 67, name: "Al-Mulk", verses: 30, startPage: 562 },
    { number: 68, name: "Al-Qalam", verses: 52, startPage: 564 },
    { number: 69, name: "Al-Haqqah", verses: 52, startPage: 566 },
    { number: 70, name: "Al-Ma'arij", verses: 44, startPage: 568 },
    { number: 71, name: "Nuh", verses: 28, startPage: 570 },
    { number: 72, name: "Al-Jinn", verses: 28, startPage: 572 },
    { number: 73, name: "Al-Muzzammil", verses: 20, startPage: 574 },
    { number: 74, name: "Al-Muddaththir", verses: 56, startPage: 575 },
    { number: 75, name: "Al-Qiyamah", verses: 40, startPage: 577 },
    { number: 76, name: "Al-Insan", verses: 31, startPage: 578 },
    { number: 77, name: "Al-Mursalat", verses: 50, startPage: 580 },
    { number: 78, name: "An-Naba", verses: 40, startPage: 582 },
    { number: 79, name: "An-Nazi'at", verses: 46, startPage: 583 },
    { number: 80, name: "'Abasa", verses: 42, startPage: 585 },
    { number: 81, name: "At-Takwir", verses: 29, startPage: 586 },
    { number: 82, name: "Al-Infitar", verses: 19, startPage: 587 },
    { number: 83, name: "Al-Mutaffifin", verses: 36, startPage: 587 },
    { number: 84, name: "Al-Inshiqaq", verses: 25, startPage: 589 },
    { number: 85, name: "Al-Buruj", verses: 22, startPage: 590 },
    { number: 86, name: "At-Tariq", verses: 17, startPage: 591 },
    { number: 87, name: "Al-A'la", verses: 19, startPage: 591 },
    { number: 88, name: "Al-Ghashiyah", verses: 26, startPage: 592 },
    { number: 89, name: "Al-Fajr", verses: 30, startPage: 593 },
    { number: 90, name: "Al-Balad", verses: 20, startPage: 594 },
    { number: 91, name: "Ash-Shams", verses: 15, startPage: 595 },
    { number: 92, name: "Al-Layl", verses: 21, startPage: 595 },
    { number: 93, name: "Ad-Duhaa", verses: 11, startPage: 596 },
    { number: 94, name: "Ash-Sharh", verses: 8, startPage: 596 },
    { number: 95, name: "At-Tin", verses: 8, startPage: 597 },
    { number: 96, name: "Al-'Alaq", verses: 19, startPage: 597 },
    { number: 97, name: "Al-Qadr", verses: 5, startPage: 598 },
    { number: 98, name: "Al-Bayyinah", verses: 8, startPage: 598 },
    { number: 99, name: "Az-Zalzalah", verses: 8, startPage: 599 },
    { number: 100, name: "Al-'Adiyat", verses: 11, startPage: 599 },
    { number: 101, name: "Al-Qari'ah", verses: 11, startPage: 600 },
    { number: 102, name: "At-Takathur", verses: 8, startPage: 600 },
    { number: 103, name: "Al-'Asr", verses: 3, startPage: 601 },
    { number: 104, name: "Al-Humazah", verses: 9, startPage: 601 },
    { number: 105, name: "Al-Fil", verses: 5, startPage: 601 },
    { number: 106, name: "Quraysh", verses: 4, startPage: 602 },
    { number: 107, name: "Al-Ma'un", verses: 7, startPage: 602 },
    { number: 108, name: "Al-Kawthar", verses: 3, startPage: 602 },
    { number: 109, name: "Al-Kafirun", verses: 6, startPage: 603 },
    { number: 110, name: "An-Nasr", verses: 3, startPage: 603 },
    { number: 111, name: "Al-Masad", verses: 5, startPage: 603 },
    { number: 112, name: "Al-Ikhlas", verses: 4, startPage: 604 },
    { number: 113, name: "Al-Falaq", verses: 5, startPage: 604 },
    { number: 114, name: "An-Nas", verses: 6, startPage: 604 }
  ];

  // network-adaptive
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = conn && conn.effectiveType ? conn.effectiveType : '4g';
  if (effectiveType.includes('2g') || effectiveType.includes('slow-2g')) {
    PRELOAD_BEFORE = PRELOAD_AFTER = 2;
    REPEAT_INTERVAL_MS = 200;
  } else if (effectiveType.includes('3g')) {
    PRELOAD_BEFORE = PRELOAD_AFTER = 4;
    REPEAT_INTERVAL_MS = 140;
  }

  function hintPreload(url) {
    try {
      const l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'image';
      l.href = url;
      document.head.appendChild(l);
      setTimeout(() => l.remove(), 10_000);
    } catch (e) { }
  }

  // ---------- storage helpers ----------
  function saveThemeToStorage(theme) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) { } }
  function readThemeFromStorage() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }

  function savePageToStorage() {
    try {
      if (typeof current === 'number' && current >= 1 && current <= TOTAL_PAGES) localStorage.setItem(PAGE_KEY, String(current));
    } catch (e) { }
  }
  function readPageFromStorage() {
    try {
      const v = parseInt(localStorage.getItem(PAGE_KEY), 10);
      if (!isNaN(v) && v >= 1 && v <= TOTAL_PAGES) return v;
    } catch (e) { }
    return null;
  }

  function readBookmarksFromStorage() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { }
    return [];
  }
  function saveBookmarksToStorage(list) { try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list)); } catch (e) { } }

  // ---------- image loader ----------
  function responseToBlobUrl(resp) {
    return resp.blob().then(blob => URL.createObjectURL(blob));
  }

  function loadImage(page, cb) {
    if (page < 1 || page > TOTAL_PAGES) return cb(new Error('out-of-range'));
    const url = `pages/${page}.png`;
    const mem = imageCache.get(page);
    if (mem && mem.blobUrl) return cb(null, mem.blobUrl);

    if (!listeners.has(page)) listeners.set(page, []);
    listeners.get(page).push(cb);

    if (inFlight.has(page)) return;
    inFlight.add(page);

    (async () => {
      try {
        let resp = null;
        if ('caches' in window) {
          try {
            const c = await caches.open('alq-pages-v1');
            const m = await c.match(url);
            if (m) resp = m;
          } catch (e) { }
        }
        if (!resp) {
          hintPreload(url);
          const fetched = await fetch(url, { credentials: 'same-origin' });
          if (!fetched.ok) throw new Error('fetch-failed');
          const clone = fetched.clone();
          if ('caches' in window) {
            try {
              const c = await caches.open('alq-pages-v1');
              c.put(url, clone).catch(() => { });
            } catch (e) { }
          }
          resp = fetched;
        }
        const blobUrl = await responseToBlobUrl(resp);
        imageCache.set(page, { blobUrl, ts: Date.now() });
        const list = listeners.get(page) || [];
        for (const fn of list) { try { fn(null, blobUrl); } catch (e) { } }
        listeners.delete(page);
      } catch (err) {
        const list = listeners.get(page) || [];
        for (const fn of list) { try { fn(err); } catch (e) { } }
        listeners.delete(page);
      } finally {
        inFlight.delete(page);
      }
    })();
  }

  function preloadRange(center, before = PRELOAD_BEFORE, after = PRELOAD_AFTER) {
    const toFetch = [];
    for (let i = center - before; i <= center + after; i++) {
      if (i < 1 || i > TOTAL_PAGES) continue;
      if (imageCache.has(i) || inFlight.has(i)) continue;
      toFetch.push(i);
    }
    let idx = 0;
    const concurrency = Math.max(1, Math.min(MAX_CONCURRENT_PREFETCH, Math.ceil((navigator.hardwareConcurrency || 4) / 2)));
    function nextSlot() {
      if (idx >= toFetch.length) return;
      const page = toFetch[idx++];
      loadImage(page, () => { });
      setTimeout(nextSlot, 50);
    }
    for (let k = 0; k < concurrency; k++) nextSlot();
  }

  function trimCache(center) {
    if (imageCache.size <= CACHE_LIMIT) return;
    const pages = Array.from(imageCache.keys()).sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    while (imageCache.size > CACHE_LIMIT) {
      const toRemove = pages.pop();
      const entry = imageCache.get(toRemove);
      if (entry && entry.blobUrl) {
        try { URL.revokeObjectURL(entry.blobUrl); } catch (e) { }
      }
      imageCache.delete(toRemove);
    }
  }

  function setPageImg(page) {
    if (page < 1 || page > TOTAL_PAGES) return;
    const entry = imageCache.get(page);
    if (entry && entry.blobUrl) { pageImg.src = entry.blobUrl; return; }
    loadImage(page, (err, src) => { if (!err && src) pageImg.src = src; });
  }

  // ---------- page navigation ----------
  function showPage(target, direction = 0) {
    if (target < 1 || target > TOTAL_PAGES) return;
    setPageImg(target);
    current = target;
    savePageToStorage();
    preloadRange(target, PRELOAD_BEFORE, PRELOAD_AFTER);
    trimCache(current);
    updateBookmarkIcon();
    renderBmList();
  }
  window.showPage = showPage;

  function nextPage() { const targ = current >= TOTAL_PAGES ? 1 : current + 1; showPage(targ, +1); }
  function prevPage() { const targ = current <= 1 ? TOTAL_PAGES : current - 1; showPage(targ, -1); }
  function step(dir) { if (dir === +1) nextPage(); else if (dir === -1) prevPage(); }

  function startRepeat(dir) {
    if (repeating) return;
    repeating = true; repeatDir = dir;
    step(dir);
    repeatTimeout = setTimeout(() => {
      repeatInterval = setInterval(() => step(dir), REPEAT_INTERVAL_MS);
    }, DEFAULT_INITIAL_REPEAT_DELAY);
  }
  function stopRepeat() {
    repeating = false; repeatDir = 0;
    if (repeatTimeout) { clearTimeout(repeatTimeout); repeatTimeout = null; }
    if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
  }

  // ---------- Theme handling ----------
  function setButtonStates(theme) {
    if (btnDark) { btnDark.classList.toggle('active', theme === 'dark'); btnDark.setAttribute('aria-pressed', theme === 'dark'); }
    if (btnSunset) { btnSunset.classList.toggle('active', theme === 'sunset'); btnSunset.setAttribute('aria-pressed', theme === 'sunset'); }
  }

  function applyTheme(theme) {
    const body = document.body;
    if (theme === 'sunset') { body.classList.add('theme-sunset'); body.classList.remove('theme-dark'); setButtonStates('sunset'); }
    else { body.classList.remove('theme-sunset'); body.classList.add('theme-dark'); setButtonStates('dark'); }
    saveThemeToStorage(theme);
  }
  (function initTheme() { const stored = readThemeFromStorage(); if (stored === 'sunset') applyTheme('sunset'); else if (stored === 'dark') applyTheme('dark'); else { if (document.body.classList.contains('theme-sunset')) applyTheme('sunset'); else applyTheme('dark'); } })();
  if (btnDark) btnDark.addEventListener('click', () => applyTheme('dark'));
  if (btnSunset) btnSunset.addEventListener('click', () => applyTheme('sunset'));

  // ---------- Overlays: Menu / Settings / Nav / Bookmarks ----------
  function isOpen(el) { return el && el.classList.contains('open'); }
  function closeAllExcept(except) {
    if (except !== 'menu' && isOpen(menuOverlay)) closeMenu();
    if (except !== 'settings' && isOpen(settingsOverlay)) closeSettings();
    if (except !== 'nav' && isOpen(navOverlay)) closeNav();
    if (except !== 'bm' && isOpen(bmOverlay)) closeBm();
  }

  function openMenu(initialPage) {
    closeAllExcept('menu');
    if (!menuOverlay) return;
    menuOverlay.classList.add('open'); menuOverlay.setAttribute('aria-hidden', 'false');
    pageInput.value = initialPage ? String(initialPage) : String(current || 1);
    setTimeout(() => { try { pageInput.focus(); pageInput.select(); } catch (e) { } }, 180);
  }
  function closeMenu() {
    if (!menuOverlay) return;
    try { pageInput.blur(); } catch (e) { }
    menuOverlay.classList.remove('open'); menuOverlay.setAttribute('aria-hidden', 'true');
    try { viewer.focus(); } catch (e) { }
  }

  function openSettings() {
    closeAllExcept('settings');
    if (!settingsOverlay) return;
    settingsOverlay.classList.add('open'); settingsOverlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => { try { settingsPanel.focus(); } catch (e) { } }, 180);
  }
  function closeSettings() {
    if (!settingsOverlay) return;
    settingsOverlay.classList.remove('open'); settingsOverlay.setAttribute('aria-hidden', 'true');
    try { viewer.focus(); } catch (e) { }
  }

  function openNav() {
    closeAllExcept('nav');
    if (!navOverlay) return;
    navOverlay.classList.add('open'); navOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => { try { navSearch.focus(); navSearch.select(); } catch (e) { } applyFilter(navSearch.value); });
  }
  function closeNav() {
    if (!navOverlay) return;
    navOverlay.classList.remove('open'); navOverlay.setAttribute('aria-hidden', 'true');
    try { viewer.focus(); } catch (e) { }
  }

  // Bookmarks panel functions (open/close)
  function openBm() {
    closeAllExcept('bm');
    if (!bmOverlay) return;
    bmOverlay.classList.add('open'); bmOverlay.setAttribute('aria-hidden', 'false');
    renderBmList();
    setTimeout(() => { try { bmList.focus(); } catch (e) { } }, 100);
  }
  function closeBm() {
    if (!bmOverlay) return;
    bmOverlay.classList.remove('open'); bmOverlay.setAttribute('aria-hidden', 'true');
    try { viewer.focus(); } catch (e) { }
    setBmDeleteMode(false);
  }

  // overlay click-to-close handlers
  if (menuOverlay) menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) closeMenu(); });
  if (menuEl) menuEl.addEventListener('click', (e) => e.stopPropagation());
  if (settingsOverlay) settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });
  if (settingsPanel) settingsPanel.addEventListener('click', (e) => e.stopPropagation());
  if (navOverlay) navOverlay.addEventListener('click', (e) => { if (e.target === navOverlay) closeNav(); });
  if (navPanel) navPanel.addEventListener('click', (e) => e.stopPropagation());
  if (bmOverlay) bmOverlay.addEventListener('click', (e) => { if (e.target === bmOverlay) closeBm(); });
  if (bmPanel) bmPanel.addEventListener('click', (e) => e.stopPropagation());

  // menu go button behavior
  if (goBtn) goBtn.addEventListener('click', () => {
    const v = parseInt(pageInput.value, 10);
    if (isNaN(v)) return;
    const target = Math.max(1, Math.min(TOTAL_PAGES, v));
    showPage(target);
    closeMenu();
  });
  if (pageInput) pageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goBtn.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
  });

  // ---------- Bookmark data + UI ----------
  // Bookmark object: { id: number (ts), page: number, name: string }
  let bookmarks = readBookmarksFromStorage();
  let bmDeleteMode = false; // when true, bookmarks show delete buttons

  function isPageBookmarked(page) { return bookmarks.some(b => b.page === page); }

  // update the bottom-left bookmark icon visibility & create if missing
  function ensureBmIcon() {
    let bmIconEl = document.querySelector('.bookmark-icon');
    if (bmIconEl) return bmIconEl;
    const wrap = document.createElement('div');
    wrap.className = 'bookmark-icon';
    wrap.setAttribute('aria-hidden', 'true');
    const img = document.createElement('div');
    img.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="bi bi-bookmark-fill">
            <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2"/>
          </svg>`;
    img.setAttribute('aria-hidden', 'true');
    wrap.appendChild(img);
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { e.stopPropagation(); openBm(); });
    return wrap;
  }

  function updateBookmarkIcon() {
    const el = ensureBmIcon();
    const visible = isPageBookmarked(current);
    el.classList.toggle('visible', visible);
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function addBookmarkForCurrent(name) {
    const page = current;
    if (!page || page < 1 || page > TOTAL_PAGES) return { ok: false, reason: 'invalid-page' };
    if (bookmarks.some(b => b.page === page)) return { ok: false, reason: 'exists' };
    const id = Date.now();
    const item = { id, page, name: (name && name.trim()) ? name.trim() : `Page ${page}` };
    bookmarks.unshift(item);
    saveBookmarksToStorage(bookmarks);
    renderBmList();
    updateBookmarkIcon();
    return { ok: true, item };
  }

  function removeBookmarkById(id) {
    const before = bookmarks.length;
    bookmarks = bookmarks.filter(b => b.id !== id);
    if (bookmarks.length !== before) {
      saveBookmarksToStorage(bookmarks);
      renderBmList();
      updateBookmarkIcon();
      return true;
    }
    return false;
  }
  function removeBookmarkByPage(page) { const before = bookmarks.length; bookmarks = bookmarks.filter(b => b.page !== page); if (bookmarks.length !== before) { saveBookmarksToStorage(bookmarks); renderBmList(); updateBookmarkIcon(); return true; } return false; }

  // ---------- Inject surah font and pages metadata ----------
  let pagesMeta = null;
  let pagesMetaLoaded = false;

  async function loadPagesMeta() {
    try {
      const resp = await fetch(PAGES_JSON_URL, { cache: 'force-cache' });
      if (!resp.ok) throw new Error('fetch-failed');
      pagesMeta = await resp.json();
    } catch (e) {
      pagesMeta = null;
    } finally {
      pagesMetaLoaded = true;
    }
  }

  function pad3(n) { return String(n).padStart(3, '0'); }

  function getSurahLabelForPage(page) {
    // prefer pagesMeta when available
    if (pagesMeta && Array.isArray(pagesMeta)) {
      const p = pagesMeta.find(x => Number(x.page) === Number(page));
      if (p && p.start && p.end) {
        const s1 = p.start; const s2 = p.end;
        const s1num = pad3(Number(s1.surah_number));
        const s2num = pad3(Number(s2.surah_number));
        const s1name = (s1.name && (s1.name.transliteration)) || s1.name || 'Unknown';
        const s2name = (s2.name && (s2.name.transliteration)) || s2.name || 'Unknown';
        if (s1name == s2name) {
          return `${s1name} <div class="small-num">${s1num}</div>`;
        }
        return `${s1name} <div class="small-num">${s1num}</div> - ${s2name} <div class="small-num">${s2num}</div>`;
      }
    }

    // fallback to surahs array
    if (surahs && Array.isArray(surahs) && surahs.length) {
      // find surah where startPage <= page and next startPage > page
      let idx = surahs.findIndex((s, i) => {
        const next = surahs[i + 1];
        if (!next) return page >= s.startPage;
        return page >= s.startPage && page < next.startPage;
      });
      if (idx === -1) idx = 0;
      const s1 = surahs[idx];
      // find end surah: if page overlaps into next surah start, pick that next
      let idx2 = idx;
      if (idx + 1 < surahs.length && page >= surahs[idx + 1].startPage) idx2 = idx + 1;
      const s2 = surahs[idx2] || s1;
      return `${pad3(Number(s1.number))} ${s1.name} - ${pad3(Number(s2.number))} ${s2.name}`;
    }

    return `Page ${page}`;
  }

  // ---------- render bookmarks into bmList (single unified implementation) ----------
  function renderBmList() {
    if (!bmList) return;
    if (!pagesMetaLoaded) loadPagesMeta();

    bmList.innerHTML = '';
    if (!bookmarks || bookmarks.length === 0) return;

    const frag = document.createDocumentFragment();
    const CHUNK = 30;
    let i = 0;

    function stepChunk() {
      const end = Math.min(i + CHUNK, bookmarks.length);
      for (; i < end; i++) {
        const bm = bookmarks[i];
        const item = document.createElement('div');
        item.className = 'bm-item' + (bmDeleteMode ? ' deletable' : '');
        item.setAttribute('data-id', String(bm.id));

        const left = document.createElement('div'); left.className = 'bm-left';
        const name = document.createElement('div'); name.className = 'bm-name'; name.textContent = bm.name;
        const small = document.createElement('div'); small.style.fontSize = '12px'; small.style.color = 'var(--muted-text-2)'; small.style.display = 'flex';
        small.innerHTML = getSurahLabelForPage(bm.page);

        left.appendChild(name); left.appendChild(small);

        const rightWrap = document.createElement('div'); rightWrap.style.display = 'flex'; rightWrap.style.alignItems = 'center'; rightWrap.style.gap = '8px';
        const pageEl = document.createElement('div'); pageEl.className = 'bm-page';
        pageEl.innerHTML = bm.page;
        rightWrap.appendChild(pageEl);

        // if showing a delete icon, create it but do not rely on it for logic;
        // clicking the whole item will handle delete vs navigate based on bmDeleteMode
        if (bmDeleteMode) {
          const del = document.createElement('div');
          del.className = 'bm-delete-btn';
          del.title = 'Delete bookmark';
          del.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="bi bi-x-lg"
  ><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>`;
          // make clicking the small delete icon act as delete (prevents double-handling)
          del.addEventListener('click', (e) => { e.stopPropagation(); removeBookmarkById(bm.id); });
          rightWrap.appendChild(del);
        }

        item.appendChild(left);
        item.appendChild(rightWrap);

        // unified item click: delete when bmDeleteMode, otherwise navigate
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (bmDeleteMode) {
            removeBookmarkById(bm.id);
          } else {
            showPage(bm.page);
            closeBm();
          }
        });

        frag.appendChild(item);
      }
      bmList.appendChild(frag);
      if (i < bookmarks.length) requestAnimationFrame(stepChunk);
    }

    stepChunk();
  }

  // bm delete mode toggle
  function setBmDeleteMode(on) {
    bmDeleteMode = !!on;
    if (bmTrashBtn) {
      bmTrashBtn.innerHTML = bmDeleteMode
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-lg" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5m-5 0v1h4v-1a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5M4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06m6.53-.528a.5.5 0 0 0-.528.47l-.5 8.5a.5.5 0 0 0 .998.058l.5-8.5a.5.5 0 0 0-.47-.528M8 4.5a.5.5 0 0 0-.5.5v8.5a.5.5 0 0 0 1 0V5a.5.5 0 0 0-.5-.5"/></svg>`;
    }
    renderBmList();
  }


  // ---------- BM Prompt (add bookmark) ----------
  function openBmPrompt() {
    if (!bmPromptOverlay) return;
    bmPromptOverlay.classList.add('open');
    bmPromptOverlay.setAttribute('aria-hidden', 'false');
    bmNameInput.value = `Bookmark — page ${current}`;
    setTimeout(() => { try { bmNameInput.focus(); bmNameInput.select(); } catch (e) { } }, 120);
  }
  function closeBmPrompt() { if (!bmPromptOverlay) return; bmPromptOverlay.classList.remove('open'); bmPromptOverlay.setAttribute('aria-hidden', 'true'); }

  if (bmAddBtn) bmAddBtn.addEventListener('click', (e) => { e.stopPropagation(); openBmPrompt(); });
  if (bmPromptCancel) bmPromptCancel.addEventListener('click', (e) => { e.preventDefault(); closeBmPrompt(); });
  if (bmPromptSave) bmPromptSave.addEventListener('click', (e) => {
    e.preventDefault();
    const name = bmNameInput.value || `Page ${current}`;
    if (bookmarks.some(b => b.page === current)) { closeBmPrompt(); openBm(); return; }
    const id = Date.now();
    const item = { id, page: current, name: name.trim() || `Page ${current}` };
    bookmarks.unshift(item);
    saveBookmarksToStorage(bookmarks);
    closeBmPrompt();
    renderBmList();
    updateBookmarkIcon();
  });

  if (bmTrashBtn) bmTrashBtn.addEventListener('click', (e) => { e.stopPropagation(); setBmDeleteMode(!bmDeleteMode); });

  // ---------- Navigation panel (surah list) ----------
  function createSurahNode(s) {
    const btn = document.createElement('button');
    btn.className = 'surah-item';
    btn.type = 'button';
    btn.setAttribute('data-surah', s.number);

    const left = document.createElement('div'); left.className = 'surah-left';
    const titleRow = document.createElement('div'); titleRow.className = 'surah-title-row';

    const name = document.createElement('div'); name.className = 'surah-name'; name.textContent = s.name;

    const num = document.createElement('div'); num.className = 'surah-num'; num.textContent = pad3(s.number);

    titleRow.appendChild(name);
    titleRow.appendChild(num);

    const verses = document.createElement('div'); verses.className = 'surah-verses'; verses.textContent = `${s.verses} verses`;

    left.appendChild(titleRow);
    left.appendChild(verses);

    const right = document.createElement('div'); right.className = 'surah-page';
    right.textContent = s.startPage;

    btn.appendChild(left);
    btn.appendChild(right);
    btn.addEventListener('click', () => { if (typeof window.showPage === 'function') window.showPage(s.startPage); closeNav(); });
    return btn;
  }

  let renderTokenNav = 0;
  function renderList(items) {
    renderTokenNav++;
    const token = renderTokenNav;
    if (!navList) return;
    navList.innerHTML = '';
    if (!items || items.length === 0) return;
    const frag = document.createDocumentFragment();
    let i = 0;
    const CHUNK = 20;
    function doChunk() {
      if (token !== renderTokenNav) return;
      const end = Math.min(i + CHUNK, items.length);
      for (; i < end; i++) frag.appendChild(createSurahNode(items[i]));
      navList.appendChild(frag);
      if (i < items.length) requestAnimationFrame(doChunk);
    }
    doChunk();
  }

  function applyFilter(q) {
    if (typeof surahs === 'undefined') return;
    const norm = String(q || '').trim().toLowerCase();
    if (!norm) { renderList(surahs); return; }
    const filtered = surahs.filter(s => {
      if (String(s.number) === norm) return true;
      if (pad3(s.number) === norm) return true;
      if (s.name.toLowerCase().includes(norm)) return true;
      return false;
    });
    renderList(filtered);
  }

  if (navSearch) navSearch.addEventListener('input', (e) => { applyFilter(e.target.value); });

  // ---------- keyboard wiring ----------
  window.addEventListener('keydown', (ev) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      if (ev.key === 'Escape') {
        if (isOpen(menuOverlay)) { ev.preventDefault(); closeMenu(); }
        if (isOpen(settingsOverlay)) { ev.preventDefault(); closeSettings(); }
        if (isOpen(navOverlay)) { ev.preventDefault(); closeNav(); }
        if (isOpen(bmOverlay)) { ev.preventDefault(); closeBm(); }
      }
      return;
    }

    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      if (ev.repeat) return;
      const dir = ev.key === 'ArrowLeft' ? +1 : -1;
      startRepeat(dir);
      return;
    }

    if (ev.key === '/') { ev.preventDefault(); if (isOpen(menuOverlay)) closeMenu(); else openMenu(current); return; }
    if (ev.key === 'o' || ev.key === 'O') { ev.preventDefault(); if (isOpen(settingsOverlay)) closeSettings(); else openSettings(); return; }
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); if (isOpen(navOverlay)) closeNav(); else openNav(); return; }
    if (ev.key === 'b' || ev.key === 'B') { ev.preventDefault(); if (isOpen(bmOverlay)) closeBm(); else openBm(); return; }
    if (ev.key === 'Escape') { if (isOpen(menuOverlay)) { ev.preventDefault(); closeMenu(); } if (isOpen(settingsOverlay)) { ev.preventDefault(); closeSettings(); } if (isOpen(navOverlay)) { ev.preventDefault(); closeNav(); } if (isOpen(bmOverlay)) { ev.preventDefault(); closeBm(); } return; }
  }, { passive: false });

  window.addEventListener('keyup', (ev) => { if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') stopRepeat(); }, { passive: true });
  window.addEventListener('blur', () => stopRepeat(), { passive: true });

  // ---------- touch swipe ----------
  let touchStartX = null;
  if (viewer) {
    viewer.addEventListener('touchstart', (e) => { if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : null;
      if (endX === null) { touchStartX = null; return; }
      const dx = endX - touchStartX;
      if (Math.abs(dx) > 30) { if (dx < 0) nextPage(); else prevPage(); }
      touchStartX = null;
    }, { passive: true });
  }

  // ---------- init / deep-link ----------
  (function init() {
    bookmarks = readBookmarksFromStorage();
    const stored = readPageFromStorage();
    current = stored || 1;
    preloadRange(current, PRELOAD_BEFORE, PRELOAD_AFTER);
    hintPreload(`pages/${current}.png`);
    setPageImg(current);
    if (typeof surahs !== 'undefined' && navList) requestAnimationFrame(() => renderList(surahs));
    ensureBmIcon();
    updateBookmarkIcon();
    renderBmList();
  })();

  (function handleDeepLink() {
    try {
      const url = new URL(location.href);
      const p = parseInt(url.searchParams.get('p') || '', 10);
      if (!isNaN(p) && p >= 1 && p <= TOTAL_PAGES) showPage(p);
    } catch (e) { }
  })();

  // persist last page
  window.addEventListener('beforeunload', savePageToStorage, { passive: true });
  window.addEventListener('pagehide', savePageToStorage, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') savePageToStorage(); }, { passive: true });

  // Expose useful functions
  window.openBookmarks = openBm;
  window.closeBookmarks = closeBm;
  window.addBookmarkForCurrent = addBookmarkForCurrent;
  window.removeBookmarkById = removeBookmarkById;

})();
