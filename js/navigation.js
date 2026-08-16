document.addEventListener('DOMContentLoaded', () => {
  // ---------- elements ----------
  const navOverlay = document.getElementById('navOverlay');
  const navPanel = document.getElementById('navPanel');
  const navSearch = document.getElementById('navSearch');
  const navMicBtn = document.getElementById('navMicBtn');
  const navAudioResults = document.getElementById('navAudioResults');
  const navList = document.getElementById('navList');
  const navTabs = document.querySelectorAll('.nav-tab');

  // Safe viewer reference so setPageImg doesn't throw if page viewer isn't present
  const viewer = document.getElementById('viewer') || document.querySelector('[data-role="viewer"]') || document.querySelector('.viewer') || null;

  const TOTAL_PAGES = window.TOTAL_PAGES || 604;
  let pagesMeta = null;
  let pagesMetaLoaded = false;
  let speechRecognition = null;
  let isRecordingSearch = false;
  let audioSearchToken = 0;
  let audioSearchDebounce = null;
  let quranChaptersCache = null;
  const versePageCache = new Map();

  // Surahs array (will be populated by API if possible). Keep a fallback if script that includes a locked baseline
  // has already defined `surahs`.
  window.surahs = window.surahs || null;

  // JUZ_START_PAGES (kept from your original code)
  const JUZ_START_PAGES = {
    1: 1, 2: 22, 3: 42, 4: 62, 5: 82, 6: 102, 7: 121, 8: 142, 9: 162, 10: 182,
    11: 201, 12: 222, 13: 242, 14: 262, 15: 282, 16: 302, 17: 322,
    18: 342, 19: 362, 20: 382, 21: 402, 22: 422, 23: 442, 24: 462,
    25: 482, 26: 502, 27: 522, 28: 542, 29: 562, 30: 582
  };

  // ---------- utilities ----------
  function pad3(n) { return String(n).padStart(3, '0'); }
  function isOpen(el) { return el && el.classList.contains('open'); }

  function hasArabic(text) {
    return /[\u0600-\u06FF]/.test(String(text || ''));
  }

  function normalizeVoiceQuery(text) {
    const raw = String(text || '').trim();
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, ' ');
    const simpleMap = {
      bismillah: 'بسم الله',
      'bismi allah': 'بسم الله',
      'bism allah': 'بسم الله',
      'bis millah': 'بسم الله',
      'بسمالله': 'بسم الله'
    };
    return simpleMap[normalized] || raw;
  }

  function setAudioResultsState(message) {
    if (!navAudioResults) return;
    navAudioResults.innerHTML = '';
    navAudioResults.classList.add('visible');
    const node = document.createElement('div');
    node.className = 'nav-audio-empty';
    node.innerHTML = message;
    navAudioResults.appendChild(node);
  }

  function clearAudioResults() {
    if (!navAudioResults) return;
    navAudioResults.innerHTML = '';
    navAudioResults.classList.remove('visible');
  }

  function setRecordingState(active) {
    isRecordingSearch = active;
    if (navMicBtn) {
      navMicBtn.classList.toggle('is-recording', active);
      navMicBtn.setAttribute('aria-pressed', String(active));
    }
  }

  function getVerseWords(verseKey) {
    return Array.from(document.querySelectorAll('.word')).filter(word => {
      const key = word.__verseKey || word.getAttribute('data-verse-key') || word.dataset.verseKey || word.getAttribute('data-verse');
      return key === verseKey;
    });
  }

  async function waitForVerseWords(verseKey, timeout = 2400) {
    if (getVerseWords(verseKey).length) return true;
    return new Promise(resolve => {
      let done = false;
      const root = document.getElementById('mushaf-page') || document.body;
      const observer = new MutationObserver(() => {
        if (getVerseWords(verseKey).length) {
          done = true;
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(root, { childList: true, subtree: true });
      setTimeout(() => {
        if (done) return;
        observer.disconnect();
        resolve(false);
      }, timeout);
    });
  }

  function blinkVerse(verseKey) {
    const words = getVerseWords(verseKey);
    if (!words.length) return;
    words.forEach(word => word.classList.add('search-ayah-blink'));
    try { words[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
    setTimeout(() => {
      words.forEach(word => word.classList.remove('search-ayah-blink'));
    }, 2200);
  }

  async function getPageForVerse(verseKey) {
    if (versePageCache.has(verseKey)) return versePageCache.get(verseKey);
    try {
      const response = await fetch(`https://api.quran.com/api/v4/verses/by_key/${encodeURIComponent(verseKey)}?fields=page_number`);
      if (!response.ok) throw new Error('page lookup failed');
      const data = await response.json();
      const page = Number(data?.verse?.page_number || data?.verse?.page);
      if (page) {
        versePageCache.set(verseKey, page);
        return page;
      }
    } catch (e) { }
    return null;
  }

  async function ensureChaptersCache() {
    if (quranChaptersCache) return quranChaptersCache;
    try {
      const response = await fetch('https://api.quran.com/api/v4/chapters?language=en');
      if (!response.ok) throw new Error();
      const data = await response.json();

      // Transform the array into an easy key-value map keyed by chapter ID
      quranChaptersCache = {};
      if (Array.isArray(data?.chapters)) {
        data.chapters.forEach(ch => {
          quranChaptersCache[ch.id] = ch.name_simple;
        });
      }
      return quranChaptersCache;
    } catch (e) {
      console.error("Failed to load chapters lookup mapping from Quran Foundation API", e);
      return null;
    }
  }

  function appendResultWords(container, result) {
    const words = Array.isArray(result.words) ? result.words : [];
    if (!words.length) {
      container.textContent = result.text || '';
      return;
    }
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word.text || '';
      if (word.highlight) span.className = 'nav-audio-hit';
      container.appendChild(span);
      if (index < words.length - 1) container.appendChild(document.createTextNode(' '));
    });
  }

  function renderAudioSearchResults(results, query) {
    if (!navAudioResults) return;
    navAudioResults.innerHTML = '';
    navAudioResults.classList.add('visible');

    if (!results.length) {
      setAudioResultsState(`No ayahs found for <span style="font-family: 'IndoPakNastaleeq', serif;">${query}</span>`);
      return;
    }

    const heading = document.createElement('div');
    heading.className = 'nav-audio-heading';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'search');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    
    const textSpan = document.createElement('span');
    textSpan.textContent = 'Search results';

    heading.appendChild(icon);
    heading.appendChild(textSpan);
    navAudioResults.appendChild(heading);

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons({ nameAttr: 'data-lucide' });
    }

    const frag = document.createDocumentFragment();
    results.forEach(result => {
      const button = document.createElement('button');
      button.className = 'nav-audio-result';
      button.type = 'button';

      const top = document.createElement('div');
      top.className = 'nav-audio-ref';
      
      const verseKey = result.verse_key || '';
      let surahName = '';
      
      if (verseKey && quranChaptersCache) {
        const chapterId = verseKey.split(':')[0];
        surahName = quranChaptersCache[chapterId] || '';
      }
      
      top.textContent = surahName ? `${surahName} ${verseKey}` : verseKey;

      const text = document.createElement('div');
      text.className = 'nav-audio-text';
      text.dir = 'rtl';
      appendResultWords(text, result);

      button.appendChild(top);
      button.appendChild(text);
      button.addEventListener('click', () => goToAudioSearchResult(result));
      frag.appendChild(button);
    });
    navAudioResults.appendChild(frag);
  }

  async function runArabicVerseSearch(query) {
    const cleaned = normalizeVoiceQuery(query);
    if (!cleaned) return;
    const token = ++audioSearchToken;
    if (navSearch) navSearch.value = cleaned;
    setAudioResultsState('Searching ayahs...');
    try {
      const response = await fetch(`https://api.quran.com/api/v4/search?mode=quick&query=${encodeURIComponent(cleaned)}`);
      if (!response.ok) throw new Error('search failed');
      const data = await response.json();
      if (token !== audioSearchToken) return;
      await ensureChaptersCache();
      const results = Array.isArray(data?.search?.results) ? data.search.results : [];
      renderAudioSearchResults(results, data?.search?.query || cleaned);
    } catch (e) {
      if (token === audioSearchToken) setAudioResultsState('Audio search is unavailable right now.');
    }
  }

  async function goToAudioSearchResult(result) {
    const verseKey = result?.verse_key;
    if (!verseKey) return;
    setAudioResultsState(`Opening ${verseKey}...`);
    const page = await getPageForVerse(verseKey);
    if (!page) {
      setAudioResultsState(`Could not find the page for ${verseKey}.`);
      return;
    }
    const fn = (window.mushafNav && window.mushafNav.showPage) || window.showPage;
    if (typeof fn === 'function') await Promise.resolve(fn(page));
    closeNav();
    await waitForVerseWords(verseKey);
    blinkVerse(verseKey);
  }

  function openNav() {
    if (typeof closeAllExcept === 'function') closeAllExcept('nav');
    if (!navOverlay) return;
    navOverlay.classList.add('open'); navOverlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      setNavTab(navActiveTab || 'surah');
      if (navSearch && navSearch.value) applyFilter(navSearch.value);
    });
  }

  function closeNav() {
    if (!navOverlay) return;
    navOverlay.classList.remove('open'); navOverlay.setAttribute('aria-hidden', 'true');
    if (navAudioResults) navAudioResults.classList.remove('visible');
    try { if (viewer) viewer.focus(); } catch (e) { }
  }

  if (navPanel) navPanel.addEventListener('click', (e) => e.stopPropagation());

  async function loadPagesMeta() {
    if (pagesMetaLoaded) return;
    pagesMetaLoaded = false;
    try {
      if (typeof PAGES_JSON_URL === 'string' && PAGES_JSON_URL) {
        const resp = await fetch(PAGES_JSON_URL, { cache: 'force-cache' });
        if (resp.ok) pagesMeta = await resp.json();
      }
    } catch (e) {
      pagesMeta = null;
    } finally {
      pagesMetaLoaded = true;
    }
  }

  // ---------- nav tabs state ----------
  let navActiveTab = 'surah'; // 'surah' | 'juz' | 'page'
  const tabSurah = document.getElementById('tabSurah');
  const tabJuz = document.getElementById('tabJuz');
  const tabPage = document.getElementById('tabPage');

  function getJuzForPage(page) {
    const pageNum = Number(page);
    if (!Number.isFinite(pageNum) || pageNum <= 0) return 1;

    let currentJuz = 1;
    Object.keys(JUZ_START_PAGES)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((juzNum) => {
        if (pageNum >= Number(JUZ_START_PAGES[juzNum])) currentJuz = juzNum;
      });

    return currentJuz;
  }

  function createJuzSubheadingNode(juzNum) {
    const heading = document.createElement('div');
    heading.className = 'nav-subheading';
    heading.textContent = `Juz' ${juzNum}`;
    return heading;
  }

  function createNavSeparatorNode() {
    const separator = document.createElement('div');
    separator.className = 'nav-separator';
    const rule = document.createElement('div');
    rule.className = 'nav-separator-rule';
    separator.appendChild(rule);
    return separator;
  }

  // ---------- create nodes ----------
  function createSurahNode(s) {
    const btn = document.createElement('button');
    btn.className = 'surah-item';
    btn.type = 'button';
    btn.setAttribute('data-surah', s.number);

    const left = document.createElement('div'); left.className = 'surah-left';
    const titleRow = document.createElement('div'); titleRow.className = 'surah-title-row';

    const name = document.createElement('div'); name.className = 'surah-name'; name.innerHTML = `<span style="color: var(--muted-text)">${s.number}.</span>&nbsp;${s.name}`;

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

  function createJuzNode(juzNum) {
    const btn = document.createElement('button');
    btn.className = 'surah-item'; // reuse style
    btn.type = 'button';
    btn.setAttribute('data-juz', String(juzNum));

    const left = document.createElement('div'); left.className = 'surah-left';
    const titleRow = document.createElement('div'); titleRow.className = 'surah-title-row';

    const name = document.createElement('div'); name.className = 'surah-name';
    name.textContent = `Juz' ${String(juzNum).padStart(2, '')}`;

    titleRow.appendChild(name);

    const startPage = Number(JUZ_START_PAGES[juzNum]);
    const endPage = (juzNum < 30) ? Number(JUZ_START_PAGES[juzNum + 1]) - 1 : TOTAL_PAGES;

    function surahForPage(page) {
      if (!window.surahs || !Array.isArray(window.surahs)) return null;
      let idx = window.surahs.findIndex((s, i) => {
        const next = window.surahs[i + 1];
        if (!next) return page >= s.startPage;
        return page >= s.startPage && page < next.startPage;
      });
      if (idx === -1) idx = window.surahs.length - 1;
      return window.surahs[idx];
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

    if (!subtitle) {
      function surahForPage(page) {
        if (!window.surahs || !Array.isArray(window.surahs)) return { number: '?', name: 'Unknown', startPage: page };
        let idx = window.surahs.findIndex((s, i) => {
          const next = window.surahs[i + 1];
          if (!next) return page >= s.startPage;
          return page >= s.startPage && page < next.startPage;
        });
        if (idx === -1) idx = window.surahs.length - 1;
        return window.surahs[idx];
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

  // ---------- render lists ----------
  let renderTokenNav = 0;
  function renderList(items) {
    renderTokenNav++;
    const token = renderTokenNav;
    if (!navList) return;
    navList.innerHTML = '';
    if (!items || items.length === 0) return;

    const sections = [];
    items.forEach((surah) => {
      const juzNum = Number(surah.juz) || getJuzForPage(surah.startPage);
      const lastSection = sections[sections.length - 1];
      if (!lastSection || lastSection.juz !== juzNum) {
        sections.push({ juz: juzNum, surahs: [surah] });
      } else {
        lastSection.surahs.push(surah);
      }
    });

    let i = 0;
    const CHUNK = 8;
    function doChunk() {
      if (token !== renderTokenNav) return;
      const frag = document.createDocumentFragment();
      const end = Math.min(i + CHUNK, sections.length);
      for (; i < end; i++) {
        const section = sections[i];
        const sectionNode = document.createElement('div');
        sectionNode.className = 'nav-section';

        const body = document.createElement('div');
        body.className = 'nav-section-body';

        sectionNode.appendChild(createJuzSubheadingNode(section.juz));
        section.surahs.forEach((surah) => {
          body.appendChild(createSurahNode(surah));
        });
        sectionNode.appendChild(body);
        frag.appendChild(sectionNode);

        if (i < sections.length - 1) {
          frag.appendChild(createNavSeparatorNode());
        }
      }
      navList.appendChild(frag);
      if (i < sections.length) requestAnimationFrame(doChunk);
    }
    doChunk();
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
      .sort((a, b) => a - b);

    navList.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const j of juzArr) frag.appendChild(createJuzNode(j));
    navList.appendChild(frag);
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

  // ---------- filter / applyFilter ----------
  function applyFilter(q) {
    const norm = String(q || '').trim().toLowerCase();

    if (navActiveTab === 'surah') {
      if (typeof window.surahs === 'undefined' || !Array.isArray(window.surahs)) return;
      if (!norm) { renderList(window.surahs); return; }

      const filtered = window.surahs.filter(s => {
        if (String(s.number) === norm) return true;
        if (pad3(s.number) === norm) return true;
        if ((s.name || '').toLowerCase().includes(norm)) return true;
        return false;
      });

      renderList(filtered);
      return;
    }

    if (navActiveTab === 'juz') {
      renderJuzList(norm);
      return;
    }

    if (navActiveTab === 'page') {
      renderPageList(norm);
      return;
    }
  }

  // ---------- nav tab switching ----------
  function setNavTab(tab) {
    if (tab === 'juz') navActiveTab = 'juz';
    else if (tab === 'page') navActiveTab = 'page';
    else navActiveTab = 'surah';

    if (tabSurah) tabSurah.setAttribute('aria-pressed', navActiveTab === 'surah');
    if (tabJuz) tabJuz.setAttribute('aria-pressed', navActiveTab === 'juz');
    if (tabPage) tabPage.setAttribute('aria-pressed', navActiveTab === 'page');

    if (navSearch) {
      if (navActiveTab === 'surah') navSearch.placeholder = "Try typing Ya-Sin or 36 ...";
      else if (navActiveTab === 'juz') navSearch.placeholder = "Try typing Juz' 30 or 30 ...";
      else navSearch.placeholder = "Try typing 42 ...";
      navSearch.value = '';
    }
    clearAudioResults();

    if (navActiveTab === 'surah') renderList(window.surahs || []);
    else if (navActiveTab === 'juz') renderJuzList();
    else if (navActiveTab === 'page') renderPageList();
  }

  if (tabSurah) tabSurah.addEventListener('click', () => { setNavTab('surah'); });
  if (tabJuz) tabJuz.addEventListener('click', () => { setNavTab('juz'); });
  if (tabPage) tabPage.addEventListener('click', () => { setNavTab('page'); });

  if (navSearch) navSearch.addEventListener('input', (e) => {
    const value = e.target.value;
    if (hasArabic(value)) {
      clearTimeout(audioSearchDebounce);
      audioSearchDebounce = setTimeout(() => runArabicVerseSearch(value), 300);
      return;
    }
    clearAudioResults();
    applyFilter(value);
  });

  function createSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.addEventListener('start', () => {
      setRecordingState(true);
      setAudioResultsState('Listening in Arabic...');
    });
    recognition.addEventListener('end', () => {
      setRecordingState(false);
    });
    recognition.addEventListener('error', () => {
      setRecordingState(false);
      setAudioResultsState('Could not hear that. Try again.');
    });
    recognition.addEventListener('result', (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const query = normalizeVoiceQuery(transcript);
      if (navSearch) navSearch.value = query;
      runArabicVerseSearch(query);
    });
    return recognition;
  }

  if (navMicBtn) {
    navMicBtn.addEventListener('click', () => {
      if (isRecordingSearch && speechRecognition) {
        speechRecognition.stop();
        return;
      }
      speechRecognition = speechRecognition || createSpeechRecognition();
      if (!speechRecognition) {
        setAudioResultsState('Voice search is not supported in this browser.');
        return;
      }
      try {
        speechRecognition.start();
      } catch (e) {
        setRecordingState(false);
      }
    });
  }

  // ---------- getSurahLabelForPage ----------
  function getSurahLabelForPage(page) {
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

    if (window.surahs && Array.isArray(window.surahs) && window.surahs.length) {
      let idx = window.surahs.findIndex((s, i) => {
        const next = window.surahs[i + 1];
        if (!next) return page >= s.startPage;
        return page >= s.startPage && page < next.startPage;
      });
      if (idx === -1) idx = 0;
      const s1 = window.surahs[idx];
      let idx2 = idx;
      if (idx + 1 < window.surahs.length && page >= window.surahs[idx + 1].startPage) idx2 = idx + 1;
      const s2 = window.surahs[idx2] || s1;
      return `${pad3(Number(s1.number))} ${s1.name} - ${pad3(Number(s2.number))} ${s2.name}`;
    }

    return `Page ${page}`;
  }

  // ---------- navigation panel (surah list) ----------
  function renderSurahNodesFromArray(arr) {
    window.surahs = Array.isArray(arr) ? arr : [];
    // ensure numeric fields and startPage exist
    window.surahs = window.surahs.map((s, idx) => {
      const number = Number(s.number || s.id || (idx + 1));
      const verses = Number(s.verses || s.verses_count || s.versesCount || 0);
      const name = s.name || (s.translated_name && s.translated_name.name) || s.simple_name || s.transliteration || s.transliterationText || s.displayName || 'â€”';
      // try to read startPage if API provides (commonly `pages` or `startPage` or `start_page`)
      let startPage = Number(s.startPage || s.start_page || s.pages?.[0] || s.page || s.mushaf_page || s.startPageNumber || 0);
      if (!startPage || isNaN(startPage)) {
        // best-effort: if pagesMeta exists, try to find the first page where this surah appears
        if (pagesMeta && Array.isArray(pagesMeta)) {
          const found = pagesMeta.find(x => x.start && Number(x.start.surah_number) === number);
          if (found) startPage = Number(found.page);
        }
      }
      // final fallback: approximate based on common mapping if present in a global `SURAH_STARTS` map
      if ((!startPage || isNaN(startPage)) && window.SURAH_STARTS && window.SURAH_STARTS[number]) startPage = Number(window.SURAH_STARTS[number]);

      return {
        number,
        name,
        verses,
        startPage: startPage || (idx === 0 ? 1 : (window.surahs && window.surahs[idx - 1] ? window.surahs[idx - 1].startPage + 1 : 1))
      };
    });

    // ensure ascending by surah number
    window.surahs.sort((a, b) => a.number - b.number);
    window.surahs = window.surahs.map(s => ({
      ...s,
      juz: Number(s.juz) || getJuzForPage(s.startPage)
    }));
  }

  // ---------- API fetching: try Quran.Foundation, fallback to other public apis ----------
  async function fetchJson(url, opts) {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) throw new Error('http:' + r.status);
      return await r.json();
    } catch (e) { return null; }
  }

  async function loadSurahsFromAPI() {
    // If surahs already provided by page script, skip fetching
    if (window.surahs && Array.isArray(window.surahs) && window.surahs.length === 114) {
      renderSurahNodesFromArray(window.surahs);
      return;
    }

    // try sequence of endpoints (resilient)
    const candidates = [
      'https://api.quran.com/api/v4/chapters'
    ];

    for (const url of candidates) {
      try {
        const data = await fetchJson(url, { cache: 'no-cache' });
        if (!data) continue;
        // Quran.Foundation typically returns { chapters: [...] } or direct array
        let arr = null;
        if (Array.isArray(data)) arr = data;
        else if (Array.isArray(data.chapters)) arr = data.chapters;
        else if (Array.isArray(data.data)) arr = data.data;
        else if (Array.isArray(data.surahs)) arr = data.surahs;
        else if (Array.isArray(data.result)) arr = data.result;
        if (!arr || arr.length === 0) continue;

        // map common shapes to { number, name, verses, startPage }
        const mapped = arr.map(item => {
          // common fields
          const number = item.id || item.chapter_number || item.number || item.chapterId || item.chapter_number;
          const name = item.name_simple;
          const verses = item.verses_count || item.versesCount || item.ayah_count || item.verses || item.numberOfAyahs || item.ayahs_count || item.ayah_count || item.versesCount;
          // try to identify page / first page info (not always available)
          let startPage = item.start_page || item.startPage || (item.pages && item.pages[0]) || item.page || null;
          return { number: Number(number || 0), name: String(name || (item.englishNameSimple || 'â€”')), verses: Number(verses || 0), startPage: startPage ? Number(startPage) : 0, raw: item };
        });

        // if page data absent, try to derive using pagesMeta when available
        if (!pagesMetaLoaded) await loadPagesMeta();
        if ((!mapped.some(m => m.startPage && m.startPage > 0)) && pagesMeta && pagesMeta.length) {
          // derive surah start pages from pagesMeta first appearance
          const startPageBySurah = {};
          pagesMeta.forEach(p => {
            if (p.start && p.start.surah_number) {
              const sn = Number(p.start.surah_number);
              if (!startPageBySurah[sn]) startPageBySurah[sn] = Number(p.page);
            }
          });
          mapped.forEach(m => {
            if ((!m.startPage || m.startPage === 0) && startPageBySurah[m.number]) m.startPage = Number(startPageBySurah[m.number]);
          });
        }

        // final: if startPage still missing, attempt simple deterministic fallback: approximate by iterating through verses counts
        if (!mapped.some(m => m.startPage && m.startPage > 0)) {
          let approxPage = 1;
          mapped.forEach((m, idx) => {
            m.startPage = approxPage;
            // rough heuristic: assume ~20 pages every 100 verses â€” this is only fallback and will be overridden by pagesMeta or SURAH_STARTS if present
            const versesApprox = Math.max(1, m.verses || 1);
            approxPage += Math.round(versesApprox / 20);
          });
        }

        renderSurahNodesFromArray(mapped);
        return;
      } catch (e) {
        // try next candidate
        continue;
      }
    }

    // Last resort: if nothing loaded, do nothing (existing hardcoded surahs may exist)
    if (!window.surahs || !Array.isArray(window.surahs)) {
      // create a minimal fallback for 114 surahs with generic names to avoid breaking UI
      const fallback = [];
      for (let i = 1; i <= 114; i++) fallback.push({ number: i, name: `Surah ${i}`, verses: 0, startPage: 1 + Math.floor((i - 1) * 5) });
      renderSurahNodesFromArray(fallback);
    }
  }

  // ---------- initial nav setup ----------
  async function initNav() {
    // wire basic open/close
    if (navOverlay) {
      navOverlay.addEventListener('click', (e) => { if (e.target === navOverlay) closeNav(); });
    }

    // fetch pagesMeta (if PAGES_JSON_URL available)
    loadPagesMeta();

    // attempt to load surahs from API (non-blocking for UI)
    await loadSurahsFromAPI();

    // set default tab and render
    setNavTab('surah');
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }
  }

  // ---------- keyboard wiring ----------
  window.addEventListener('keydown', ev => {
    if (document.getElementsByClassName('visible').length) return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); document.querySelectorAll('.open').forEach(e => e !== navOverlay && e.classList.remove('open')); isOpen(navOverlay) ? closeNav() : openNav(); }
  }, { passive: false });

  // ---------- wire small UI interactions ----------
  if (navSearch) {
    navSearch.addEventListener('keydown', (e) => {
      // prevent global shortcuts while focusing navSearch
      if (e.key === 'Escape') { closeNav(); }
    });
  }

  // finalize init
  initNav().catch(() => { /* ignore */ });

});
