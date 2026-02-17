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
  const QUALITY_KEY = 'alquran_quality';

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
  const btnQualityDefault = document.getElementById('btnQualityDefault');
  const btnQuality2k = document.getElementById('btnQuality2k');

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

  const AUDIO_BASE = 'https://dn710109.ca.archive.org/0/items/aziz.quranhousebd/';
  const overlay = document.getElementById('audioOverlay');
  const panel = document.getElementById('audioPanel');
  const heading = document.getElementById('audioHeading');
  const verseLabel = document.getElementById('audioVerseLabel');
  const btnPrev = document.getElementById('audioPrev');
  const btnPlayPause = document.getElementById('audioPlayPause');
  const btnNext = document.getElementById('audioNext');

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

  function saveQualityToStorage(q) { try { localStorage.setItem(QUALITY_KEY, q); } catch (e) { } }
  function readQualityFromStorage() { try { return localStorage.getItem(QUALITY_KEY); } catch (e) { return null; } }
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

  let quality = readQualityFromStorage() || 'default'; // 'default' or '2k'

  function getPageUrl(page) {
    const prefix = (quality === '2k') ? 'hd_pages' : 'pages';
    return `${prefix}/${page}.png`;
  }

  // --- add helper: clear in-memory cache + revoke blob URLs
  function clearImageCache() {
    try {
      for (const [pg, entry] of imageCache) {
        if (entry && entry.blobUrl) {
          try { URL.revokeObjectURL(entry.blobUrl); } catch (e) { }
        }
      }
    } catch (e) { }
    imageCache.clear();
    inFlight.clear();
    listeners.clear(); // remove pending listeners so loadImage will re-register
  }

  // --- replace your applyQuality with this version
  function applyQuality(q) {
    quality = (q === '2k') ? '2k' : 'default';
    saveQualityToStorage(quality);

    // update buttons immediately
    if (typeof setQualityButtonStates === 'function') setQualityButtonStates();

    // clear in-memory cache so setPageImg fetches from the new folder
    clearImageCache();

    // re-preload and then reload current page from new source
    preloadRange(current, PRELOAD_BEFORE, PRELOAD_AFTER);
    // small delay so sample is visible before the real image replaces it
    setTimeout(() => setPageImg(current), 60);
  }


  (function initQuality() {
    // set initial UI state after DOM buttons exist
    const stored = readQualityFromStorage();
    if (stored) quality = stored;
    // callers below will wire UI buttons
  })();

  function setQualityButtonStates() {
    if (btnQualityDefault) btnQualityDefault.classList.toggle('active', quality === 'default');
    if (btnQuality2k) btnQuality2k.classList.toggle('active', quality === '2k');
  }

  if (btnQualityDefault) btnQualityDefault.addEventListener('click', () => { applyQuality('default'); setQualityButtonStates(); });
  if (btnQuality2k) btnQuality2k.addEventListener('click', () => { applyQuality('2k'); setQualityButtonStates(); });

  // initialize UI
  setQualityButtonStates();

  // ---------- image loader ----------
  function responseToBlobUrl(resp) {
    return resp.blob().then(blob => URL.createObjectURL(blob));
  }

  function loadImage(page, cb) {
    if (page < 1 || page > TOTAL_PAGES) return cb(new Error('out-of-range'));
    const url = getPageUrl(page);
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

  function openNav(){
  closeAllExcept('nav');
  if(!navOverlay) return;
  navOverlay.classList.add('open'); navOverlay.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=> {
    try{ navSearch.focus(); navSearch.select(); }catch(e) {}
    // ensure we render the currently active tab (surah/juz) when opening
    setNavTab(navActiveTab || 'surah');
    // if there's a search term, apply it (applyFilter uses navActiveTab)
    if (navSearch && navSearch.value) applyFilter(navSearch.value);
  });
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

  // --- Juz start pages (hardcoded)
const JUZ_START_PAGES = {
  1:1,2:22,3:42,4:62,5:82,6:102,7:121,8:142,9:162,10:182,
  11:201,12:222,13:242,14:262,15:282,16:302,17:322,
  18:342,19:362,20:382,21:402,22:422,23:442,24:462,
  25:482,26:502,27:522,28:542,29:562,30:582
};

// nav tabs state
let navActiveTab = 'surah'; // 'surah', 'juz', or 'page'
const tabSurah = document.getElementById('tabSurah');
const tabJuz = document.getElementById('tabJuz');
const tabPage = document.getElementById('tabPage');

// create a juz button node (reuses surah-item style so it looks identical)
function createJuzNode(juzNum) {
  const btn = document.createElement('button');
  btn.className = 'surah-item'; // reuse style
  btn.type = 'button';
  btn.setAttribute('data-juz', String(juzNum));

  const left = document.createElement('div'); left.className = 'surah-left';
  const titleRow = document.createElement('div'); titleRow.className = 'surah-title-row';

  const name = document.createElement('div'); name.className = 'surah-name';
  name.textContent = `Juz' ${String(juzNum).padStart(2,'')}`;

  titleRow.appendChild(name);

  // determine start page and end page for this juz
  const startPage = Number(JUZ_START_PAGES[juzNum]);
  const endPage = (juzNum < 30) ? Number(JUZ_START_PAGES[juzNum + 1]) - 1 : TOTAL_PAGES;

  // helper: find surah object by page using surahs table
  function surahForPage(page) {
    // find last surah whose startPage <= page
    let idx = surahs.findIndex((s, i) => {
      const next = surahs[i+1];
      if (!next) return page >= s.startPage;
      return page >= s.startPage && page < next.startPage;
    });
    if (idx === -1) idx = surahs.length - 1;
    return surahs[idx];
  }

  const startSurah = surahForPage(startPage) || { number: '?', name: 'Unknown' };
  const endSurah = surahForPage(endPage) || startSurah;

  const subtitle = startSurah.number === endSurah.number
    ? `${startSurah.name} <div class="small-num">${pad3(Number(startSurah.number))}</div>`
    : `${startSurah.name} <div class="small-num">${pad3(Number(startSurah.number))}</div> - ${endSurah.name} <div class="small-num">${pad3(Number(endSurah.number))}</div>`;

  const verses = document.createElement('div'); verses.className = 'surah-verses';
  verses.innerHTML = subtitle;

  left.appendChild(titleRow);
  left.appendChild(verses);

  const right = document.createElement('div'); right.className = 'surah-page';
  right.textContent = startPage || '';

  btn.appendChild(left);
  btn.appendChild(right);

  btn.addEventListener('click', () => {
    const p = Number(startPage || 1);
    if (typeof window.showPage === 'function') window.showPage(p);
    closeNav();
  });

  return btn;
}

function renderJuzList(norm = '') {
  if (!navList) return;
  const q = String(norm).trim().toLowerCase();

  const juzArr = Object.keys(JUZ_START_PAGES)
    .map(Number)
    .filter(j => {
      if (!q) return true;
      return String(j) === q || (`juz ${j}`).includes(q);
    })
    .sort((a,b)=>a-b);

  navList.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const j of juzArr) frag.appendChild(createJuzNode(j));
  navList.appendChild(frag);
}

// create a page button node
function createPageNode(pageNum) {
  const btn = document.createElement('button');
  btn.className = 'surah-item';
  btn.type = 'button';
  btn.setAttribute('data-page', String(pageNum));

  const left = document.createElement('div'); left.className = 'surah-left';
  const titleRow = document.createElement('div'); titleRow.className = 'surah-title-row';

  const name = document.createElement('div'); name.className = 'surah-name';
  name.textContent = `Page ${pageNum}`;

  titleRow.appendChild(name);

  // Get subtitle using pagesMeta
  let subtitle = '';
  if (pagesMeta && Array.isArray(pagesMeta)) {
    const p = pagesMeta.find(x => Number(x.page) === Number(pageNum));
    if (p && p.start && p.end) {
      const s1 = p.start; const s2 = p.end;
      const s1num = pad3(Number(s1.surah_number));
      const s2num = pad3(Number(s2.surah_number));
      const s1name = (s1.name && (s1.name.transliteration)) || s1.name || 'Unknown';
      const s2name = (s2.name && (s2.name.transliteration)) || s2.name || 'Unknown';
      if (s1name == s2name) {
        subtitle = `${s1name} <div class="small-num">${s1num}</div>`;
      } else {
        subtitle = `${s1name} <div class="small-num">${s1num}</div> - ${s2name} <div class="small-num">${s2num}</div>`;
      }
    }
  }
  
  // Fallback if pagesMeta not available
  if (!subtitle) {
    function surahForPage(page) {
      let idx = surahs.findIndex((s, i) => {
        const next = surahs[i+1];
        if (!next) return page >= s.startPage;
        return page >= s.startPage && page < next.startPage;
      });
      if (idx === -1) idx = surahs.length - 1;
      return surahs[idx];
    }
    const startSurah = surahForPage(pageNum) || { number: '?', name: 'Unknown' };
    subtitle = `${startSurah.name} <div class="small-num">${pad3(Number(startSurah.number))}</div>`;
  }

  const verses = document.createElement('div'); verses.className = 'surah-verses';
  verses.innerHTML = subtitle;

  left.appendChild(titleRow);
  left.appendChild(verses);

  const right = document.createElement('div'); right.className = 'surah-page';
  right.textContent = pageNum || '';

  btn.appendChild(left);
  btn.appendChild(right);

  btn.addEventListener('click', () => {
    const p = Number(pageNum || 1);
    if (typeof window.showPage === 'function') window.showPage(p);
    closeNav();
  });

  return btn;
}

function renderPageList(norm = '') {
  if (!navList) return;
  if (!pagesMetaLoaded) loadPagesMeta();
  const q = String(norm).trim();

  const pageArr = [];
  for (let i = 1; i <= TOTAL_PAGES; i++) {
    if (!q) {
      pageArr.push(i);
    } else {
      const pageStr = String(i);
      const pagePadded = String(i).padStart(3, '0');
      if (pageStr.includes(q) || pagePadded.includes(q)) {
        pageArr.push(i);
      }
    }
  }

  navList.innerHTML = '';
  const CHUNK = 30;
  let idx = 0;

  function stepChunk() {
    const end = Math.min(idx + CHUNK, pageArr.length);
    const frag = document.createDocumentFragment();
    for (; idx < end; idx++) {
      frag.appendChild(createPageNode(pageArr[idx]));
    }
    navList.appendChild(frag);
    if (idx < pageArr.length) requestAnimationFrame(stepChunk);
  }

  stepChunk();
}


function applyFilter(q) {
  const norm = String(q || '').trim().toLowerCase();

  if (navActiveTab === 'surah') {
    if (!norm) {
      renderList(surahs);
      return;
    }

    const filtered = surahs.filter(s => {
      if (String(s.number) === norm) return true;
      if (pad3(s.number) === norm) return true;
      if (s.name.toLowerCase().includes(norm)) return true;
      return false;
    });

    renderList(filtered);
  }

  if (navActiveTab === 'juz') {
    renderJuzList(norm); // juz stays juz
  }

  if (navActiveTab === 'page') {
    renderPageList(norm); // page stays page
  }
}


// tab switching helper
function setNavTab(tab) {
  if (tab === 'juz') navActiveTab = 'juz';
  else if (tab === 'page') navActiveTab = 'page';
  else navActiveTab = 'surah';

  if (tabSurah) tabSurah.setAttribute('aria-pressed', navActiveTab === 'surah');
  if (tabJuz) tabJuz.setAttribute('aria-pressed', navActiveTab === 'juz');
  if (tabPage) tabPage.setAttribute('aria-pressed', navActiveTab === 'page');
  // change placeholder to match tab
  if (navSearch) {
    if (navActiveTab === 'surah') navSearch.placeholder = "Try typing Ya-Sin or 36 ...";
    else if (navActiveTab === 'juz') navSearch.placeholder = "Try typing Juz' 30 or 30 ...";
    else navSearch.placeholder = "Try typing page 42 or 42 ...";
    navSearch.value = '';
  }
  // render appropriate list
  if (navActiveTab === 'surah') renderList(surahs);
  else if (navActiveTab === 'juz') renderJuzList();
  else if (navActiveTab === 'page') renderPageList();
}

// wire tab buttons (call once after DOM ready)
if (tabSurah) tabSurah.addEventListener('click', () => { setNavTab('surah'); });
if (tabJuz) tabJuz.addEventListener('click', () => { setNavTab('juz'); });
if (tabPage) tabPage.addEventListener('click', () => { setNavTab('page'); });

// ensure navSearch input still wires to new applyFilter
if (navSearch) navSearch.addEventListener('input', (e) => { applyFilter(e.target.value); });


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
        : `<i data-feather="trash-2"></i>`;
      feather.replace();
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
  
// initialize nav tab on load (call this where you init nav rendering)
setNavTab('surah');

  function applyFilter(q) {
  const norm = String(q || '').trim().toLowerCase();

  if (navActiveTab === 'surah') {
    if (typeof surahs === 'undefined') return;
    if (!norm) { renderList(surahs); return; }

    const filtered = surahs.filter(s => {
      if (String(s.number) === norm) return true;
      if (pad3(s.number) === norm) return true;
      if (s.name.toLowerCase().includes(norm)) return true;
      return false;
    });
    renderList(filtered);
  } 
  else if (navActiveTab === 'juz') {
    if (!norm) { renderJuzList(); return; }
    renderJuzList(norm); // your juz filter logic
  }
  else if (navActiveTab === 'page') {
    if (!norm) { renderPageList(); return; }
    renderPageList(norm);
  }
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

  let audio = new Audio();
// AUDIO PRELOAD CACHE
const audioCache = new Map(); // key -> { audio: Audio, page: Number }

// helper: dispatch custom audio events (used by wave UI)
function dispatchAudioEvent(name, detail = {}) {
  try {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (e) { /* ignore */ }
}

// preload all verses on a page
function preloadAudioForPage(page) {
  if (!pagesMeta) return;
  if (page < 1 || page > TOTAL_PAGES) return;
  const verses = getVersesForPageNum(page); // uses existing helper
  for (const v of verses) {
    const key = `${v.surah}_${v.verse}`;
    if (audioCache.has(key)) continue;
    try {
      const a = new Audio(audioUrlFor(v.surah, v.verse));
      // improve CORS for cached sources (safe if server supports it)
      try { a.crossOrigin = 'anonymous'; } catch (e) { }
      a.preload = 'auto';
      // start loading
      a.load();
      // if load errors, remove from cache so later attempts can retry
      a.addEventListener('error', () => { if (audioCache.get(key)?.audio === a) audioCache.delete(key); }, { passive: true });
      // store meta so we can trim by page later
      audioCache.set(key, { audio: a, page });
    } catch (e) {
      // ignore preload failures
    }
  }
}

// preload current page + next page (call this whenever page changes / when starting)
function preloadAudioForNearbyPages(page) {
  preloadAudioForPage(page);
  if (page + 1 <= TOTAL_PAGES) preloadAudioForPage(page + 1);
}

// trim audio cache to keep only pages in the keepPages set (helps memory)
function trimAudioCache(keepPages = new Set()) {
  for (const [key, entry] of audioCache) {
    if (!keepPages.has(entry.page)) {
      try { entry.audio.pause(); } catch (e) { }
      audioCache.delete(key);
    }
  }
}

audio.preload = 'auto';
let playingIndex = 0;
let currentSequence = []; // array of {surah, verse, page}
let isPlaying = false;
updatePlayPauseIcon();
// track last played surah (null until we actually play something)
let lastPlayedSurah = null;

// ensure pagesMeta loaded
async function ensurePagesMeta() {
  if (typeof pagesMeta === 'undefined' || !pagesMetaLoaded) {
    try { await loadPagesMeta(); } catch (e) { /* ignore */ }
  }
}

function surahVerseCount(n) {
  const s = surahs.find(x => Number(x.number) === Number(n));
  return s ? Number(s.verses) : 0;
}

// build array of {surah, verse} for a page
function getVersesForPageNum(page) {
  if (!pagesMeta) return [];
  const p = pagesMeta.find(x => Number(x.page) === Number(page));
  if (!p) return [];
  const s1 = Number(p.start.surah_number), v1 = Number(p.start.verse);
  const s2 = Number(p.end.surah_number), v2 = Number(p.end.verse);
  const out = [];
  for (let s = s1; s <= s2; s++) {
    const startV = (s === s1) ? v1 : 1;
    const endV = (s === s2) ? v2 : surahVerseCount(s);
    for (let v = startV; v <= endV; v++) out.push({ surah: s, verse: v });
  }
  return out;
}

// find page number that contains given (surah,verse)
function findPageForVerse(surahNum, verseNum) {
  if (!pagesMeta) return null;
  const s = pagesMeta.find(p => {
    const aS = Number(p.start.surah_number), aV = Number(p.start.verse);
    const bS = Number(p.end.surah_number), bV = Number(p.end.verse);
    const beforeStart = (surahNum < aS) || (surahNum === aS && verseNum < aV);
    const afterEnd = (surahNum > bS) || (surahNum === bS && verseNum > bV);
    return !beforeStart && !afterEnd;
  });
  return s ? Number(s.page) : null;
}

function audioUrlFor(surah, verse) {
  return AUDIO_BASE + pad3(Number(surah)) + pad3(Number(verse)) + '.mp3';
}

function updatePanelUI(surah, verse) {
  // heading: "002 Al-Baqarah" if pagesMeta available use transliteration/en: try pagesMeta mapping
  let surahName = '';
  const p = pagesMeta && pagesMeta.length ? pagesMeta.find(x => {
    // match a surah entry with same surah number in start or end
    return (Number(x.start.surah_number) === Number(surah)) || (Number(x.end.surah_number) === Number(surah));
  }) : null;
  if (p && p.start && Number(p.start.surah_number) === Number(surah)) {
    surahName = (p.start.name && (p.start.name.transliteration || p.start.name)) || `Surah ${surah}`;
  } else {
    // fallback to surahs table
    const sObj = surahs.find(s => Number(s.number) === Number(surah));
    surahName = sObj ? sObj.name : `Surah ${surah}`;
  }
  heading.innerHTML = `${surahName} <div class="audio-num">${pad3(Number(surah))}</div>`;
  verseLabel.textContent = `${Number(verse)}`;
}

function buildSequenceFromPage(page) {
  // returns array of {surah,verse,page}
  const arr = getVersesForPageNum(page).map(v => ({ surah: v.surah, verse: v.verse, page }));
  return arr;
}

// ensure bismillah (001001.mp3) is preloaded once
function preloadBismillahOnce() {
  const key = `1_1`; // surah1 verse1
  if (audioCache.has(key)) return;
  try {
    const a = new Audio(audioUrlFor(1, 1));
    try { a.crossOrigin = 'anonymous'; } catch (e) { }
    a.preload = 'auto';
    a.load();
    a.addEventListener('error', () => { if (audioCache.get(key)?.audio === a) audioCache.delete(key); }, { passive: true });
    audioCache.set(key, { audio: a, page: null });
  } catch (e) { }
}
// call it now so Bismillah is primed
preloadBismillahOnce();

// start playing sequence from page's first verse
async function startPlaybackFromCurrentPage() {
  await ensurePagesMeta();
  // preload current + next page audio immediately
  preloadAudioForNearbyPages(current);

  // optionally trim: keep current and next page audio only
  const keep = new Set([current, current + 1]);
  trimAudioCache(keep);

  // build initial sequence from current page
  currentSequence = buildSequenceFromPage(current);
  playingIndex = 0;
  if (currentSequence.length === 0) return;
  playIndex(playingIndex);
}

function playIndex(idx) {
  if (!currentSequence || idx < 0) return;
  // if idx beyond currentSequence, attempt to fetch next page's sequence
  if (idx >= currentSequence.length) {
    // move to next page's sequence
    const last = currentSequence[currentSequence.length - 1];
    const nextPage = Number(last.page) + 1;
    if (nextPage <= TOTAL_PAGES) {
      currentSequence = buildSequenceFromPage(nextPage);
      playingIndex = 0;
    } else {
      stopAudio();
      return;
    }
  } else {
    playingIndex = idx;
  }

  const item = currentSequence[playingIndex];
  if (!item) return stopAudio();
  const url = audioUrlFor(item.surah, item.verse);

  // if verse belongs to a different page than currently shown, change page
  const versePage = findPageForVerse(item.surah, item.verse);
  if (versePage && versePage !== current) {
    // wrap in try so if showPage throws we don't break playback
    try { showPage(versePage); } catch (e) { }
    // ensure current reflects visible page (some showPage implementations set it, but ensure)
    try { current = versePage; } catch (e) { }
  }

  // Determine if we must play Bismillah first:
  // Play Bismillah when entering a new surah (surah changed from lastPlayedSurah OR starting fresh),
  // the verse is 1, and the new surah is not 9 (At-Tawbah).
  const enteringNewSurah = (lastPlayedSurah === null) || (Number(item.surah) !== Number(lastPlayedSurah));
  const shouldPlayBismillah = enteringNewSurah && Number(item.verse) === 1 && Number(item.surah) !== 9;

  if (shouldPlayBismillah) {
    // show "Bismillah" label temporarily
    verseLabel.textContent = `0`;

    // Play bismillah first (use cached if available)
    const bKey = `1_1`;
    const bUrl = audioCache.has(bKey) ? audioCache.get(bKey).audio.src : audioUrlFor(1, 1);

    // set onended to then play the actual verse
    audio.onended = () => {
      // now play the actual verse
      lastPlayedSurah = item.surah; // mark surah as played before actual verse
      // restore default onended to advance to next verse
      audio.onended = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };
      audio.onerror = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };

      // try to use cached audio if available
      const cacheKey = `${item.surah}_${item.verse}`;
      audio.src = audioCache.has(cacheKey) ? audioCache.get(cacheKey).audio.src : url;
      // sync page with verse BEFORE playing
      const versePage2 = findPageForVerse(item.surah, item.verse);
      if (versePage2 && versePage2 !== current) {
        try { showPage(versePage2); } catch (e) { }
        current = versePage2; // 👈 important
      }
      // update UI to show actual verse number
      updatePanelUI(item.surah, item.verse);

      audio.play().then(() => {
        isPlaying = true;
        updatePlayPauseIcon();
        dispatchAudioEvent('alq-audio-play', { surah: item.surah, verse: item.verse });
      }).catch(() => {
        isPlaying = false;
        updatePlayPauseIcon();
        dispatchAudioEvent('alq-audio-pause');
      });
    };

    // play bismillah
    audio.src = bUrl;
    audio.play().then(() => {
      isPlaying = true;
      updatePlayPauseIcon();
      dispatchAudioEvent('alq-audio-play', { surah: 1, verse: 1 });
    }).catch(() => {
      isPlaying = false;
      updatePlayPauseIcon();
      dispatchAudioEvent('alq-audio-pause');
      // if bismillah autoplay fails, skip to actual verse
      setTimeout(() => {
        audio.onended && audio.onended();
      }, 150);
    });
    return;
  }

  // Normal path: no pre-bismillah required
  updatePanelUI(item.surah, item.verse);

  try {
    const cacheKey = `${item.surah}_${item.verse}`;
    if (audioCache.has(cacheKey)) {
      // The browser has already fetched / buffered this audio -> set same src (will be fast)
      audio.src = audioCache.get(cacheKey).audio.src;
    } else {
      audio.src = url;
    }

    // set default onended handler and start
    audio.onended = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };
    audio.onerror = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };

    audio.play().then(() => {
      isPlaying = true;
      lastPlayedSurah = item.surah; // mark this surah as the last played
      updatePlayPauseIcon();
      dispatchAudioEvent('alq-audio-play', { surah: item.surah, verse: item.verse });
    }).catch(() => {
      // autoplay failed; still set UI
      isPlaying = false;
      updatePlayPauseIcon();
      dispatchAudioEvent('alq-audio-pause');
    });
  } catch (e) {
    // on error skip to next
    setTimeout(() => { playNext(); }, 200);
  }
}

function playNext() {
  // advance within currentSequence; if at end, attempt to load next page's sequence
  if (!currentSequence) return;
  const nextIdx = playingIndex + 1;
  if (nextIdx < currentSequence.length) {
    playIndex(nextIdx);
    updatePlayPauseIcon();
  } else {
    // try to build sequence from next page
    const lastPage = currentSequence.length ? currentSequence[currentSequence.length - 1].page : current;
    const nextPage = Number(lastPage) + 1;
    if (nextPage <= TOTAL_PAGES) {
      currentSequence = buildSequenceFromPage(nextPage);
      // prefetch the page after nextPage too (so playback stays gapless)
      preloadAudioForNearbyPages(nextPage);
      // keep only nextPage and its following page in cache
      trimAudioCache(new Set([nextPage, nextPage + 1]));
      playingIndex = 0;
      updatePlayPauseIcon();
      playIndex(playingIndex);
    } else {
      stopAudio();
    }
  }
}

function playPrev() {
  if (!currentSequence) return;
  if (playingIndex > 0) {
    playIndex(playingIndex - 1);
    updatePlayPauseIcon();
  } else {
    // go to previous page's last verse if exists
    const firstPage = currentSequence.length ? currentSequence[0].page : current;
    const prevPage = Number(firstPage) - 1;
    if (prevPage >= 1) {
      currentSequence = buildSequenceFromPage(prevPage);
      playingIndex = currentSequence.length - 1;
      updatePlayPauseIcon();
      // ensure visible page sync
      try { showPage(prevPage); } catch (e) { }
      current = prevPage;
      playIndex(playingIndex);
    }
  }
}

function togglePlayPause() {
  if (!audio.src) {
    // start fresh from current page
    startPlaybackFromCurrentPage();
    return;
  }
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    dispatchAudioEvent('alq-audio-pause');
  } else {
    audio.play().catch(() => { });
    isPlaying = true;
    dispatchAudioEvent('alq-audio-play');
  }
  updatePlayPauseIcon();
}

function stopAudio() {
  try { audio.pause(); audio.currentTime = 0; } catch (e) { }
  isPlaying = false;
  dispatchAudioEvent('alq-audio-pause');
  updatePlayPauseIcon();
}

function updatePlayPauseIcon() {
  if (!btnPlayPause) return;
  if (isPlaying) {
    btnPlayPause.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pause-fill" viewBox="0 0 16 16">
    <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5m5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5"/>
  </svg>`;
  } else {
    btnPlayPause.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
    <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
  </svg>`;
  }
}


// Audio-wave controller (paste after audio player code)
(function () {
  const wave = document.querySelector('.reciter-wave');
  if (!wave) return;

  const lines = Array.from(wave.querySelectorAll('.wave-line'));
  let raf = null;
  let running = false;

  // randomize scale values (range), called each frame while playing
  function tick() {
    for (let i = 0; i < lines.length; i++) {
      // use slightly different randomness per line for organic motion
      const r = 0.4 + Math.abs(Math.sin((Date.now() / 300) + i * 1.13)) * (0.6 + Math.random() * 0.6);
      // apply scaleY and small height tweak for crispness
      lines[i].style.transform = `scaleY(${r.toFixed(3)})`;
      // optionally adjust opacity subtly
      lines[i].style.opacity = (0.6 + (r - 0.4) * 0.6).toFixed(2);
    }
    raf = requestAnimationFrame(tick);
  }

  function startWave() {
    if (!wave) return;
    wave.classList.add('playing');
    if (running) return;
    running = true;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function stopWave() {
    if (!wave) return;
    wave.classList.remove('playing');
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    // gently return to sleepy state
    lines.forEach(l => {
      l.style.transform = 'scaleY(0.45)';
      l.style.opacity = '0.45';
    });
  }

  // Listen for custom global events dispatched by the audio player
  document.addEventListener('alq-audio-play', startWave);
  document.addEventListener('alq-audio-pause', stopWave);

  // Also respond to page visibility / unload etc
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopWave();
  });

  // if you want to reflect initial state at load:
  // if (document.querySelector('#audioOverlay')?.classList.contains('open')) startWave();

})();

// audio events
audio.onended = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };
audio.onerror = () => { playNext(); dispatchAudioEvent('alq-audio-pause'); };
audio.onplay = () => { isPlaying = true; updatePlayPauseIcon(); dispatchAudioEvent('alq-audio-play'); };
audio.onpause = () => { isPlaying = false; updatePlayPauseIcon(); dispatchAudioEvent('alq-audio-pause'); };

// UI control bindings
btnPrev.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
btnNext.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
btnPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });

// toggle panel with 'P'
window.addEventListener('keydown', async (ev) => {
  // don't trigger P if typing in an input
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    return;
  }
  if (ev.key === 'p' || ev.key === 'P') {
    ev.preventDefault();
    if (!overlay.classList.contains('open')) {
      // open and start playing first verse of current page
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      await ensurePagesMeta();
      // build and play
      currentSequence = buildSequenceFromPage(current);
      if (!currentSequence || currentSequence.length === 0) {
        // fallback: find first verse on page via pagesMeta
        currentSequence = buildSequenceFromPage(current);
      }
      playingIndex = 0;
      playIndex(playingIndex);
      updatePlayPauseIcon();
    } else {
      // close: stop audio
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      stopAudio();
    }
  }
}, { passive: false });

// expose some helpers for debugging if needed
window.audioPlayer = {
  open: () => { overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false'); },
  close: () => { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); stopAudio(); },
  playNext,
  playPrev,
  playIndex
};

// ensure feather icons render
if (typeof feather !== 'undefined') feather.replace();

// On page change, if audio panel open and playing, update sequence if the page changed outside playback
const origShowPage = window.showPage;
window.showPage = function (p, dir) {
  origShowPage(p, dir);
  // refresh sequence if panel open
  if (overlay.classList.contains('open')) {
    currentSequence = buildSequenceFromPage(p);
    playingIndex = 0;
    // continue playing automatically
    playIndex(playingIndex);
    updatePlayPauseIcon();
  }
};

// simple tooltip for all buttons with a title attribute
(function () {
  let tooltipTimer = null;

  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  document.body.appendChild(tooltip);

  // store original title so we can restore it
  const originalTitle = new WeakMap();

  function showFor(el) {
    const txt = el.getAttribute('data-tooltip-text') || el.getAttribute('title');
    if (!txt) return;

    // delay tooltip
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      // temporarily remove native title
      if (el.getAttribute('title')) {
        originalTitle.set(el, el.getAttribute('title'));
        el.removeAttribute('title');
      }

      tooltip.textContent = txt;
      tooltip.classList.add('show');

      // position: centered above element if enough space, otherwise below
      const r = el.getBoundingClientRect();
      const ttR = tooltip.getBoundingClientRect();
      const margin = 8;

      let left = r.left + (r.width / 2) - (ttR.width / 2);
      left = Math.max(8, Math.min(left, window.innerWidth - ttR.width - 8));

      let top = r.top - ttR.height - margin;
      if (top < 8) {
        top = r.bottom + margin;
      }

      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(top)}px`;
    }, 800); // ⏱️ 800ms delay
  }

  function hideFor(el) {
    clearTimeout(tooltipTimer);

    tooltip.classList.remove('show');
    // restore native title after a short delay so quick hover won't re-trigger native tooltip
    setTimeout(() => {
      if (originalTitle.has(el)) {
        const v = originalTitle.get(el);
        if (v) el.setAttribute('title', v);
        originalTitle.delete(el);
      }
    }, 350);
  }

  // wire buttons
  function wireButtons(root = document) {
    const buttons = Array.from(root.querySelectorAll('button[title]'));
    buttons.forEach(btn => {
      // don't double-wire
      if (btn.__tooltip_wired) return;
      btn.__tooltip_wired = true;

      // support custom override text via data-tooltip-text if you want different wording later
      btn.addEventListener('mouseenter', () => showFor(btn), { passive: true });
      btn.addEventListener('mouseleave', () => hideFor(btn), { passive: true });
      btn.addEventListener('focus', () => showFor(btn), { passive: true });
      btn.addEventListener('blur', () => hideFor(btn), { passive: true });

      // mobile: show tooltip on long press (pressstart), hide on touchend
      let touchTimer = null;
      btn.addEventListener('touchstart', (e) => {
        // avoid interfering with clicks — show after 350ms hold
        touchTimer = setTimeout(() => showFor(btn), 350);
      }, { passive: true });
      btn.addEventListener('touchend', () => {
        clearTimeout(touchTimer);
        hideFor(btn);
      }, { passive: true });
      btn.addEventListener('touchcancel', () => { clearTimeout(touchTimer); hideFor(btn); }, { passive: true });
    });
  }

  // initial wiring
  wireButtons();

  // re-wire if DOM changes (for dynamic buttons)
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) wireButtons();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // expose helper if you want to set custom tooltip for a button:
  window.setButtonTooltip = (btn, text) => {
    if (!btn) return;
    btn.setAttribute('data-tooltip-text', text);
    // re-wire if needed
    wireButtons(document);
  };
})();


})();
