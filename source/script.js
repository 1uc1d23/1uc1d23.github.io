
(() => {
  const TOTAL_PAGES = 604;
  const pageImg = document.getElementById('pageImg');
  let current = 1;

  // cache: page -> { blobUrl: string, size: number }
  const imageCache = new Map();
  const CACHE_LIMIT = 80;           // entries to keep in memory + CacheStorage
  const MAX_CONCURRENT_PREFETCH = 4;
  const inFlight = new Set();       // pages currently being fetched
  const listeners = new Map();      // page -> [cb, cb...]

  // controlled repeat state
  let repeating = false;
  let repeatDir = 0;
  let repeatTimeout = null;
  let repeatInterval = null;
  const DEFAULT_INITIAL_REPEAT_DELAY = 200;
  const DEFAULT_REPEAT_INTERVAL_MS = 80;

  // storage key for theme persistence
  const THEME_KEY = 'alquran_theme';

  // tune behavior by network quality (if available)
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = conn && conn.effectiveType ? conn.effectiveType : '4g';
  // degrade aggressiveness on slower networks
  let PRELOAD_BEFORE = 10;
  let PRELOAD_AFTER = 10;
  let REPEAT_INTERVAL_MS = DEFAULT_REPEAT_INTERVAL_MS;
  if (effectiveType.includes('2g') || effectiveType.includes('slow-2g')) {
    PRELOAD_BEFORE = PRELOAD_AFTER = 2;
    REPEAT_INTERVAL_MS = 200;
  } else if (effectiveType.includes('3g')) {
    PRELOAD_BEFORE = PRELOAD_AFTER = 4;
    REPEAT_INTERVAL_MS = 140;
  }

  // util: create preload hint link for browser (helps HTTP/2 servers)
  function hintPreload(url) {
    try {
      const l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'image';
      l.href = url;
      document.head.appendChild(l);
      // remove after a while to avoid accumulating tags
      setTimeout(()=> l.remove(), 10_000);
    } catch(e){}
  }

  // trim memory cache and revoke blob URLs when removing
  function trimCache(center) {
    if (imageCache.size <= CACHE_LIMIT) return;
    const pages = Array.from(imageCache.keys()).sort((a,b)=> Math.abs(a-center) - Math.abs(b-center));
    while (imageCache.size > CACHE_LIMIT) {
      const toRemove = pages.pop();
      const entry = imageCache.get(toRemove);
      if (entry && entry.blobUrl) {
        try { URL.revokeObjectURL(entry.blobUrl); } catch(e){}
      }
      imageCache.delete(toRemove);
    }
  }

  // safe blob URL creation from Response
  async function responseToBlobUrl(resp) {
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }

  // main loader: uses Cache Storage when possible, falls back to network, stores blobUrls in memory
  function loadImage(page, cb) {
    if (page < 1 || page > TOTAL_PAGES) return cb(new Error('out-of-range'));
    const url = `pages/${page}.png`;

    // already cached in memory
    const mem = imageCache.get(page);
    if (mem && mem.blobUrl) return cb(null, mem.blobUrl);

    // attach listener list
    if (!listeners.has(page)) listeners.set(page, []);
    listeners.get(page).push(cb);

    if (inFlight.has(page)) return; // fetch already started

    inFlight.add(page);

    (async () => {
      try {
        // try CacheStorage first
        let resp = null;
        if ('caches' in window) {
          try {
            const c = await caches.open('alq-pages-v1');
            const match = await c.match(url);
            if (match) resp = match;
          } catch(e){}
        }

        // if not in caches, fetch and store in CacheStorage
        if (!resp) {
          // hint browser to prioritize
          hintPreload(url);

          const fetched = await fetch(url, { credentials: 'same-origin' });
          if (!fetched.ok) throw new Error('fetch-failed');
          // clone for cache
          const clone = fetched.clone();
          if ('caches' in window) {
            try {
              const c = await caches.open('alq-pages-v1');
              c.put(url, clone).catch(()=>{/* ignore cache put errors */});
            } catch(e){ /* ignore */ }
          }
          resp = fetched;
        }

        const blobUrl = await responseToBlobUrl(resp);
        // store in memory cache
        imageCache.set(page, { blobUrl, ts: Date.now() });

        // notify listeners
        const list = listeners.get(page) || [];
        for (const fn of list) {
          try { fn(null, blobUrl); } catch(e){}
        }
        listeners.delete(page);
      } catch (err) {
        const list = listeners.get(page) || [];
        for (const fn of list) {
          try { fn(err); } catch(e){}
        }
        listeners.delete(page);
      } finally {
        inFlight.delete(page);
      }
    })();
  }

  // prefetch with concurrency limit for a range
  function preloadRange(center, before = PRELOAD_BEFORE, after = PRELOAD_AFTER) {
    const toFetch = [];
    for (let i = center - before; i <= center + after; i++) {
      if (i < 1 || i > TOTAL_PAGES) continue;
      if (imageCache.has(i) || inFlight.has(i)) continue;
      toFetch.push(i);
    }
    let idx = 0;
    const concurrency = Math.max(1, Math.min(MAX_CONCURRENT_PREFETCH, Math.ceil(navigator.hardwareConcurrency ? navigator.hardwareConcurrency/2 : 2)));
    function nextSlot() {
      if (idx >= toFetch.length) return;
      const page = toFetch[idx++];
      loadImage(page, ()=>{}); // no-op cb; result stored in imageCache
      // schedule next after tiny delay to avoid bursts
      setTimeout(nextSlot, 50);
    }
    for (let k=0;k<concurrency;k++) nextSlot();
  }

  // set visible page using blob URL if available, else fall back to safe load
  function setPageImg(page) {
    if (page < 1 || page > TOTAL_PAGES) return;
    const entry = imageCache.get(page);
    if (entry && entry.blobUrl) {
      pageImg.src = entry.blobUrl;
      return;
    }
    // otherwise load then swap
    loadImage(page, (err, src) => {
      if (!err && src) pageImg.src = src;
      // if error, do nothing (keep current)
    });
  }

  // show page and trigger preloads and trimming
  function showPage(target, direction = 0) {
    if (target < 1 || target > TOTAL_PAGES) return;
    setPageImg(target);
    current = target;
    if (direction > 0) preloadRange(target, PRELOAD_BEFORE, PRELOAD_AFTER);
    else if (direction < 0) preloadRange(target, PRELOAD_BEFORE, PRELOAD_AFTER);
    else preloadRange(target, PRELOAD_BEFORE, PRELOAD_AFTER);
    trimCache(current);
  }
  window.showPage = showPage;

  function nextPage(){ const targ = current >= TOTAL_PAGES ? 1 : current + 1; showPage(targ, +1); }
  function prevPage(){ const targ = current <= 1 ? TOTAL_PAGES : current - 1; showPage(targ, -1); }
  function step(dir) { if (dir === +1) nextPage(); else if (dir === -1) prevPage(); }

  // controlled repeat (uses network-aware REPEAT_INTERVAL_MS)
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

  // hint to browser to warm next/prev images (useful for HTTP/2)
  function warmNeighbors(center) {
    const n1 = center+1; const p1 = center-1;
    if (n1 <= TOTAL_PAGES) hintPreload(`pages/${n1}.png`);
    if (p1 >= 1) hintPreload(`pages/${p1}.png`);
  }

  // ---------- UI wiring (menus, settings, theme persistence) ----------
  const menuOverlay = document.getElementById('menuOverlay');
  const pageInput = document.getElementById('pageInput');
  const goBtn = document.getElementById('goBtn');
  const viewer = document.getElementById('viewer');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const settingsPanel = document.getElementById('settingsPanel');
  const btnDark = document.getElementById('btnDark');
  const btnSunset = document.getElementById('btnSunset');

  if (viewer && !viewer.hasAttribute('tabindex')) viewer.setAttribute('tabindex','0');

  function openMenu(initialPage){ if(!menuOverlay) return; closeSettings(); menuOverlay.classList.add('open'); menuOverlay.setAttribute('aria-hidden','false'); pageInput.value = initialPage ? String(initialPage) : String(current || 1); setTimeout(()=>{ try{ pageInput.focus(); pageInput.select(); }catch(e){} }, 180); }
  function closeMenu(){ if(!menuOverlay) return; try{ pageInput.blur(); }catch(e){} menuOverlay.classList.remove('open'); menuOverlay.setAttribute('aria-hidden','true'); try{ viewer.focus(); }catch(e){} }
  function openSettings(){ if(!settingsOverlay) return; closeMenu(); settingsOverlay.classList.add('open'); settingsOverlay.setAttribute('aria-hidden','false'); setTimeout(()=>{ try{ settingsPanel.focus(); }catch(e){} }, 180); }
  function closeSettings(){ if(!settingsOverlay) return; settingsOverlay.classList.remove('open'); settingsOverlay.setAttribute('aria-hidden','true'); try{ viewer.focus(); }catch(e){} }

  if (menuOverlay) menuOverlay.addEventListener('click', (e) => { if (e.target === menuOverlay) closeMenu(); });
  const menuEl = document.getElementById('menu'); if (menuEl) menuEl.addEventListener('click', (e) => e.stopPropagation());
  if (settingsOverlay) settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettings(); });
  if (settingsPanel) settingsPanel.addEventListener('click', (e) => e.stopPropagation());

  if (goBtn) goBtn.addEventListener('click', () => { const v = parseInt(pageInput.value,10); if (isNaN(v)) return; const target = Math.max(1, Math.min(TOTAL_PAGES, v)); showPage(target); closeMenu(); });
  if (pageInput) pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); goBtn.click(); } else if (e.key === 'Escape'){ e.preventDefault(); closeMenu(); } });

  // theme persistence helpers
  function saveThemeToStorage(theme){ try{ localStorage.setItem(THEME_KEY, theme); }catch(e){} }
  function readThemeFromStorage(){ try{ return localStorage.getItem(THEME_KEY); }catch(e){ return null; } }
  function setButtonStates(theme){
    if(btnDark) { btnDark.classList.toggle('active', theme === 'dark'); btnDark.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'); }
    if(btnSunset) { btnSunset.classList.toggle('active', theme === 'sunset'); btnSunset.setAttribute('aria-pressed', theme === 'sunset' ? 'true' : 'false'); }
  }
  function applyTheme(theme){
    const body = document.body;
    if (theme === 'sunset'){ body.classList.add('theme-sunset'); body.classList.remove('theme-dark'); setButtonStates('sunset'); }
    else { body.classList.remove('theme-sunset'); body.classList.add('theme-dark'); setButtonStates('dark'); }
    saveThemeToStorage(theme);
  }
  (function initTheme(){ const stored = readThemeFromStorage(); if (stored === 'sunset') applyTheme('sunset'); else if (stored === 'dark') applyTheme('dark'); else { if (document.body.classList.contains('theme-sunset')) applyTheme('sunset'); else applyTheme('dark'); } })();
  if (btnDark) btnDark.addEventListener('click', ()=> applyTheme('dark'));
  if (btnSunset) btnSunset.addEventListener('click', ()=> applyTheme('sunset'));

  // keyboard wiring: arrows, slash, O, Esc
  window.addEventListener('keydown', (ev) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      if (ev.key === 'Escape') { if (menuOverlay && menuOverlay.classList.contains('open')){ ev.preventDefault(); closeMenu(); } if (settingsOverlay && settingsOverlay.classList.contains('open')){ ev.preventDefault(); closeSettings(); } }
      return;
    }

    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      if (ev.repeat) return;
      const dir = ev.key === 'ArrowLeft' ? +1 : -1;
      startRepeat(dir);
      return;
    }

    if (ev.key === '/') { ev.preventDefault(); if (menuOverlay && menuOverlay.classList.contains('open')) closeMenu(); else openMenu(current); return; }
    if (ev.key === 'o' || ev.key === 'O') { ev.preventDefault(); if (settingsOverlay && settingsOverlay.classList.contains('open')) closeSettings(); else openSettings(); return; }
    if (ev.key === 'Escape') { if (menuOverlay && menuOverlay.classList.contains('open')) { ev.preventDefault(); closeMenu(); } if (settingsOverlay && settingsOverlay.classList.contains('open')) { ev.preventDefault(); closeSettings(); } return; }
  }, { passive: false });

  window.addEventListener('keyup', (ev) => { if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') stopRepeat(); }, { passive: true });
  window.addEventListener('blur', () => stopRepeat(), { passive: true });

  // touch swipe
  let touchStartX = null;
  const viewerEl = document.getElementById('viewer');
  if (viewerEl) {
    viewerEl.addEventListener('touchstart', (e) => { if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX; }, { passive: true });
    viewerEl.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : null;
      if (endX === null){ touchStartX = null; return; }
      const dx = endX - touchStartX;
      if (Math.abs(dx) > 30){ if (dx < 0) nextPage(); else prevPage(); }
      touchStartX = null;
    }, { passive: true });
  }

  // init / deep-link
  (function init() {
    current = 1;
    preloadRange(current, PRELOAD_BEFORE, PRELOAD_AFTER);
    // warm neighbors by hint
    warmNeighbors(current);
    setPageImg(current);
  })();

  (function handleDeepLink() {
    try {
      const url = new URL(location.href);
      const p = parseInt(url.searchParams.get('p') || '', 10);
      if (!isNaN(p) && p >= 1 && p <= TOTAL_PAGES) showPage(p);
    } catch (e) { /* ignore */ }
  })();

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

  const navOverlay = document.getElementById('navOverlay');
const navSearch  = document.getElementById('navSearch');
const navList    = document.getElementById('navList');

let currentFilter = '';
let renderToken = 0;

function pad3(n){
  return String(n).padStart(3, '0');
}

/* ---------- helpers to enforce ONE panel open ---------- */
function isOpen(el){
  return el && el.classList.contains('open');
}

function closeAllExcept(except){
  if (typeof closeMenu === 'function' && except !== 'menu') closeMenu();
  if (typeof closeSettings === 'function' && except !== 'settings') closeSettings();
  if (except !== 'nav') closeNav();
}

/* ---------- surah item ---------- */
function createSurahNode(s){
  const btn = document.createElement('button');
  btn.className = 'surah-item';
  btn.type = 'button';

  const left = document.createElement('div');
  left.className = 'surah-left';

  const titleRow = document.createElement('div');
  titleRow.className = 'surah-title-row';

  const name = document.createElement('div');
  name.className = 'surah-name';
  name.textContent = s.name;

  const num = document.createElement('div');
  num.className = 'surah-num';
  num.textContent = pad3(s.number);

  titleRow.appendChild(name);
  titleRow.appendChild(num);

  const verses = document.createElement('div');
  verses.className = 'surah-verses';
  verses.textContent = `${s.verses} verses`;

  left.appendChild(titleRow);
  left.appendChild(verses);

  const right = document.createElement('div');
  right.className = 'surah-page';
  right.textContent = s.startPage;

  btn.appendChild(left);
  btn.appendChild(right);

  btn.addEventListener('click', () => {
    if (typeof window.showPage === 'function') {
      window.showPage(s.startPage);
    }
    closeNav();
  });

  return btn;
}

/* ---------- rendering ---------- */
function renderList(items){
  renderToken++;
  const token = renderToken;
  navList.innerHTML = '';

  if (!items || !items.length) return;

  const frag = document.createDocumentFragment();
  let i = 0;
  const CHUNK = 20;

  function step(){
    if (token !== renderToken) return;
    const end = Math.min(i + CHUNK, items.length);
    for (; i < end; i++) frag.appendChild(createSurahNode(items[i]));
    navList.appendChild(frag);
    if (i < items.length) requestAnimationFrame(step);
  }

  step();
}

/* ---------- filtering ---------- */
function applyFilter(q){
  const norm = String(q || '').trim().toLowerCase();
  if (!norm) return renderList(surahs);

  renderList(
    surahs.filter(s =>
      s.name.toLowerCase().includes(norm) ||
      String(s.number) === norm ||
      pad3(s.number) === norm
    )
  );
}

function debounce(fn, ms){
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const debouncedFilter = debounce(applyFilter, 180);

/* ---------- nav open / close ---------- */
function openNav(){
  closeAllExcept('nav');

  navOverlay.classList.add('open');
  navOverlay.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    try { navSearch.focus(); navSearch.select(); } catch {}
    applyFilter(navSearch.value);
  });
}

function closeNav(){
  navOverlay.classList.remove('open');
  navOverlay.setAttribute('aria-hidden', 'true');
  try { document.getElementById('viewer').focus(); } catch {}
}

/* ---------- clicks ---------- */
navOverlay.addEventListener('click', e => {
  if (e.target === navOverlay) closeNav();
});

document.getElementById('navPanel')
  .addEventListener('click', e => e.stopPropagation());

/* ---------- search ---------- */
navSearch.addEventListener('input', e => {
  currentFilter = e.target.value;
  debouncedFilter(currentFilter);
});

/* ---------- keyboard (STRICT exclusivity) ---------- */
window.addEventListener('keydown', ev => {
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.isContentEditable);

  if (typing && ev.key !== 'Escape') return;

  if (ev.key === 'n' || ev.key === 'N') {
    ev.preventDefault();
    isOpen(navOverlay) ? closeNav() : openNav();
  }

  if (ev.key === '/' && typeof openMenu === 'function') {
    ev.preventDefault();
    closeNav();
    openMenu();
  }

  if ((ev.key === 'o' || ev.key === 'O') && typeof openSettings === 'function') {
    ev.preventDefault();
    closeNav();
    openSettings();
  }

  if (ev.key === 'Escape' && isOpen(navOverlay)) {
    ev.preventDefault();
    closeNav();
  }
}, { passive: false });

/* ---------- initial ---------- */
requestAnimationFrame(() => renderList(surahs));



})();
