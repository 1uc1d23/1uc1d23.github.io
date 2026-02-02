
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

})();
