// versePopup.js
(function () {
  let modal;
  let modalContent;
  let pageView;   // container for page-mode UI
  let arabicContainer;
  let translationContainer;
  let closeBtn;
  let contentWrapper
  let header;
  const INDOPAK_FONT_FACTOR_KEY = 'mushaf-indopak-font-factor';
  const INDOPAK_FONT_USER_SET_KEY = 'mushaf-indopak-font-user-set';
  const INDOPAK_DEFAULT_FACTOR = 3;
  const INDOPAK_MIN_FACTOR = 1;
  const INDOPAK_MAX_FACTOR = 8;
  const INDOPAK_BASE_VH = 4.4;
  const footnoteCache = new Map();
  const indopakWordsCache = new Map();
  const indopakVerseEndCache = new Map();
  const WORD_TRANSLATION_UNDER_KEY = 'mushaf-word-translation-under';

  let currentVerseKey = null;
  let allVerseKeys = [];
  let renderPageToken = 0;

  // page-mode default ON (no single-verse mode)
  let pageMode = true;

  // try to find the container that holds .word elements
  function getWordsContainer() {
    const candidates = [
      '.mushaf', '#mushaf', '.mushaf-container', '#mushaf-container',
      '.pages', '#pages', 'main', 'body'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return document.body;
  }
  function getIndopakFontSize() {
    const userSet = localStorage.getItem(INDOPAK_FONT_USER_SET_KEY) === '1';
    const saved = userSet ? Number(localStorage.getItem(INDOPAK_FONT_FACTOR_KEY)) : NaN;
    const safeFactor = Number.isFinite(saved) ? Math.round(saved) : INDOPAK_DEFAULT_FACTOR;
    const normalizedFactor = Math.max(INDOPAK_MIN_FACTOR, Math.min(INDOPAK_MAX_FACTOR, safeFactor));
    const scaledVh = (INDOPAK_BASE_VH * normalizedFactor) / INDOPAK_DEFAULT_FACTOR;
    return `${scaledVh.toFixed(2)}vh`;
  }
  function applyIndopakFontSizeToModal() {
    if (!modalContent) return;
    const size = getIndopakFontSize();
    modalContent.querySelectorAll('.verse-modal-arabic').forEach(el => {
      el.style.fontSize = size;
    });
  }

  const wordsContainer = getWordsContainer();

  function createModal() {
    modal = document.createElement('div');
    modal.className = 'verse-modal-overlay';

    modalContent = document.createElement('div');
    modalContent.className = 'verse-modal';

    closeBtn = document.createElement('div');
    closeBtn.className = 'verse-modal-close modal-btn';
    closeBtn.title = 'Close view';
    closeBtn.setAttribute(
      'data-tooltip-text',
      'Close view &nbsp;<span class="shortcut">Esc</span>'
    );
    closeBtn.innerHTML = '<i data-lucide="x" class="w-5 h-5"></i>';

    const nextBtn = document.createElement('div');
    nextBtn.className = 'verse-modal-nav next modal-btn';
    nextBtn.setAttribute('title', 'Next page');
    nextBtn.setAttribute(
      'data-tooltip-text',
      'Next page &nbsp;<span class="shortcut">←</span>'
    );
    nextBtn.innerHTML = '<i data-lucide="chevron-left" class="w-5 h-5"></i>';

    const prevBtn = document.createElement('div');
    prevBtn.className = 'verse-modal-nav prev modal-btn';
    prevBtn.title = 'Previous page';
    prevBtn.setAttribute(
      'data-tooltip-text',
      'Previous page &nbsp;<span class="shortcut">→</span>'
    );
    prevBtn.innerHTML = '<i data-lucide="chevron-right" class="w-5 h-5"></i>';

    // page-mode view (always used)
    pageView = document.createElement('div');
    pageView.className = 'verse-modal-pageview';

    // header
    header = document.createElement('div');
    header.className = 'verse-modal-header';
    header.textContent = '';

    contentWrapper = document.createElement('div');
    contentWrapper.className = 'verse-modal-content';

    // translations containers (used while building items)
    arabicContainer = document.createElement('div');
    arabicContainer.className = 'verse-modal-arabic';
    translationContainer = document.createElement('div');
    translationContainer.className = 'verse-modal-translation';

    // assemble
    modalContent.appendChild(header);
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(prevBtn);
    modalContent.appendChild(nextBtn);
    contentWrapper.appendChild(pageView);
    modalContent.appendChild(contentWrapper);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // if lucide is available
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // wire buttons to page navigation
    prevBtn.addEventListener('click', () => {
      if (window.mushafNav && window.mushafNav.prevPage) {
        try { window.mushafNav.prevPage(); } catch (e) { }
        waitForWordsChange(1200).then(() => {
          populateAllVerseKeys();
          renderPageMode().catch(() => { });
        });
      }
    });
    nextBtn.addEventListener('click', () => {
      if (window.mushafNav && window.mushafNav.nextPage) {
        try { window.mushafNav.nextPage(); } catch (e) { }
        waitForWordsChange(1200).then(() => {
          populateAllVerseKeys();
          renderPageMode().catch(() => { });
        });
      }
    });
  }

  async function getSurahName(surahNumber) {
    try {
      const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahNumber}`);
      const data = await res.json();
      return data.chapter?.name_complex || '';
    } catch {
      return '';
    }
  }

  function openModal() {
    modal.classList.add('visible');
  }

  function closeModal() {
    modal.classList.remove('visible');
    // keep pageMode true (page-mode only)
    header.classList.remove('focused-verse');
  }

  async function fetchTranslation(verseKey) {
    try {
      const res = await fetch(
        `https://api.quran.com/api/v4/quran/translations/20?verse_key=${verseKey}`
      );
      const data = await res.json();
      const translation = (data.translations || []).find(
        t => t.verse_key === verseKey || !t.verse_key
      );

      let text = translation?.text || 'Translation not available.';
      return text;
    } catch {
      return 'Translation not available.';
    }
  }

  async function fetchPageIndopakWords(pageNumber) {
    const page = Number(pageNumber);
    if (!Number.isFinite(page) || page <= 0) return new Map();
    if (indopakWordsCache.has(page)) return indopakWordsCache.get(page);

    try {
      const res = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=text_indopak&per_page=300`
      );
      const data = await res.json().catch(() => ({}));
      const verseMap = new Map();
      const verses = Array.isArray(data.verses) ? data.verses : [];
      verses.forEach((verse) => {
        if (verse?.verse_key) verseMap.set(verse.verse_key, verse);
      });
      indopakWordsCache.set(page, verseMap);
      return verseMap;
    } catch {
      return new Map();
    }
  }

  async function fetchIndopakVerseEnd(verseKey) {
    const key = String(verseKey || '').trim();
    if (!key) return '';
    if (indopakVerseEndCache.has(key)) return indopakVerseEndCache.get(key);

    try {
      const res = await fetch(
        `https://api.quran.com/api/v4/quran/verses/indopak_nastaleeq?verse_key=${encodeURIComponent(key)}`
      );
      const data = await res.json().catch(() => ({}));
      const text = data.verses?.[0]?.text_indopak_nastaleeq || '';
      const chars = Array.from(String(text).trim());
      const ayahEnd = chars.length ? chars[chars.length - 1] : '';
      indopakVerseEndCache.set(key, ayahEnd);
      return ayahEnd;
    } catch {
      indopakVerseEndCache.set(key, '');
      return '';
    }
  }

  function shouldShowWordTranslationUnder() {
    return localStorage.getItem(WORD_TRANSLATION_UNDER_KEY) === '1';
  }

  function buildIndopakWordsFragment(words, verseKey, ayahEnd = '') {
    const frag = document.createDocumentFragment();
    const safeWords = Array.isArray(words) ? words : [];
    const tooltipMode = localStorage.getItem('mushaf-tooltip-mode') || 'translation';
    const showWordTranslationUnder = shouldShowWordTranslationUnder();

    safeWords.forEach((word, index) => {
      const isAyahEnd = word?.char_type_name === 'end';
      const span = document.createElement('span');
      span.className = 'word verse-modal-word';
      span.textContent = isAyahEnd && ayahEnd ? ayahEnd : (word?.text_indopak || word?.text || '');
      span.style.fontFamily = 'IndoPakNastaleeq';
      if (isAyahEnd) {
        span.dataset.tooltip = '';
      } else if (tooltipMode === 'translation') {
        span.dataset.tooltip = word?.translation?.text || '';
      } else if (tooltipMode === 'transliteration') {
        span.dataset.tooltip = word?.transliteration?.text || '';
      } else {
        span.dataset.tooltip = '';
      }
      if (verseKey) span.__verseKey = verseKey;

      if (showWordTranslationUnder) {
        const stack = document.createElement('span');
        stack.className = 'verse-modal-word-stack';
        stack.appendChild(span);

        if (!isAyahEnd) {
          const wordTranslation = document.createElement('span');
          wordTranslation.className = 'verse-modal-word-translation';
          wordTranslation.textContent = word?.translation?.text || '';
          stack.appendChild(wordTranslation);
        }
        frag.appendChild(stack);
      } else {
        frag.appendChild(span);
      }

      if (index < safeWords.length - 1) {
        frag.appendChild(document.createTextNode(showWordTranslationUnder ? '  ' : ' '));
      }
    });

    return frag;
  }

  async function fetchFootnoteText(footnoteId) {
    const key = String(footnoteId || '').trim();
    if (!key) return '';
    if (footnoteCache.has(key)) return footnoteCache.get(key);
    try {
      const res = await fetch(`https://api.quran.com/api/v4/foot_notes/${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      const text = data.foot_note?.text || 'Footnote is unavailable.';
      footnoteCache.set(key, text);
      return text;
    } catch {
      return 'Failed to load footnote.';
    }
  }

  function decorateTranslationFootnotes(block) {
    if (!block) return;
    const translationEl = block.querySelector('.verse-modal-translation');
    if (!translationEl) return;
    const footnotes = translationEl.querySelectorAll('sup[foot_note]');
    footnotes.forEach((sup) => {
      sup.classList.add('verse-footnote-trigger');
      sup.setAttribute('role', 'button');
      sup.setAttribute('tabindex', '0');
      const id = sup.getAttribute('foot_note');
      if (id) sup.dataset.footnoteId = id;
    });
  }

  function createFootnoteFrame(footnoteNumber, footnoteId) {
    const frame = document.createElement('div');
    frame.className = 'verse-footnote-frame';
    frame.dataset.footnoteId = String(footnoteId);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'verse-footnote-close';
    close.setAttribute('aria-label', 'Close footnote');
    close.innerHTML = '<i data-lucide="x"></i>';
    close.addEventListener('click', () => frame.remove());

    const title = document.createElement('div');
    title.className = 'verse-footnote-title';
    title.textContent = `Footnote - ${footnoteNumber || '?'}`;

    const body = document.createElement('div');
    body.className = 'verse-footnote-body';
    body.innerHTML = `
      <div class="verse-skeleton-line" style="width:95%"></div>
      <div class="verse-skeleton-line" style="width:82%"></div>
    `;

    frame.appendChild(close);
    frame.appendChild(title);
    frame.appendChild(body);
    return frame;
  }

  async function showVerseFootnote(triggerEl) {
    if (!triggerEl) return;
    const footnoteId = (triggerEl.getAttribute('foot_note') || triggerEl.dataset.footnoteId || '').trim();
    if (!footnoteId) return;
    const footnoteNumber = (triggerEl.textContent || '').trim();
    const verseBlock = triggerEl.closest('.verse-modal-item');
    if (!verseBlock) return;

    const existing = verseBlock.querySelector(`.verse-footnote-frame[data-footnote-id="${CSS.escape(footnoteId)}"]`);
    if (existing) {
      existing.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const translationEl = verseBlock.querySelector('.verse-modal-translation');
    if (!translationEl) return;

    const frame = createFootnoteFrame(footnoteNumber, footnoteId);
    translationEl.insertAdjacentElement('afterend', frame);
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }

    const body = frame.querySelector('.verse-footnote-body');
    const text = await fetchFootnoteText(footnoteId);
    if (body) body.textContent = text || 'Footnote is unavailable.';
  }

  function attachPageFootnoteHandlers(pageList) {
    if (!pageList || pageList.dataset.footnoteHandlersAttached === '1') return;
    pageList.dataset.footnoteHandlersAttached = '1';

    pageList.addEventListener('click', (e) => {
      const trigger = e.target.closest('.verse-footnote-trigger');
      if (!trigger) return;
      e.preventDefault();
      showVerseFootnote(trigger);
    });

    pageList.addEventListener('keydown', (e) => {
      const trigger = e.target.closest('.verse-footnote-trigger');
      if (!trigger) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      showVerseFootnote(trigger);
    });
  }

  function extractVerseKeyFromElement(el) {
    if (!el) return null;

    const key =
      el.__verseKey ||
      el.getAttribute('data-verse-key') ||
      el.dataset.verseKey ||
      el.getAttribute('data-verse');

    return isValidVerseKey(key) ? key : null;
  }

  function isValidVerseKey(key) {
    if (!key || typeof key !== 'string') return false;
    const match = key.match(/^(\d{1,3}):(\d{1,3})$/);
    if (!match) return false;
    const surah = Number(match[1]);
    const ayah = Number(match[2]);
    if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return false;
    if (surah < 1 || surah > 114) return false;
    if (ayah < 1) return false;
    return true;
  }

  function populateAllVerseKeys() {
    allVerseKeys = [];
    const verseSet = new Set();
    const selectorRoot = wordsContainer || document;
    const words = Array.from(selectorRoot.querySelectorAll('.word'));
    words.forEach(w => {
      const k = extractVerseKeyFromElement(w);
      if (isValidVerseKey(k) && !verseSet.has(k)) {
        allVerseKeys.push(k);
        verseSet.add(k);
      }
    });
  }

  // MAIN: open modal in page mode and focus the verse in the page listing
  async function showVersePopup(verseKey) {
    if (!verseKey) return;
    currentVerseKey = verseKey;

    populateAllVerseKeys();

    if (!modal) createModal();
    if (!modal.classList.contains('visible')) openModal();

    await renderPageMode();

    // scroll the focused verse into view inside pageView
    try {
      const target = pageView.querySelector(`.verse-modal-item[data-verse-key="${CSS.escape(verseKey)}"]`);
      if (target) {
        // slightly delay to let layout settle
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // add brief highlight class
          target.classList.add('verse-focused');
          setTimeout(() => target.classList.remove('verse-focused'), 1400);
        }, 50);
      }
    } catch (e) {
      // ignore
    }
  }

  // Wait for words list to change (used after navigating pages). Resolves with boolean foundNewWords.
  function waitForWordsChange(timeout = 2000) {
    return new Promise(resolve => {
      const root = (wordsContainer || document);
      const initialCount = root.querySelectorAll('.word').length;
      const firstEl = root.querySelector('.word');
      const initialFirstKey = extractVerseKeyFromElement(firstEl);
      let resolved = false;

      const obs = new MutationObserver(() => {
        const currentCount = root.querySelectorAll('.word').length;
        const currentFirstKey = extractVerseKeyFromElement(root.querySelector('.word'));
        if (currentCount !== initialCount || currentFirstKey !== initialFirstKey) {
          if (!resolved) {
            resolved = true;
            obs.disconnect();
            resolve(true);
          }
        }
      });

      obs.observe(root, { childList: true, subtree: true, attributes: false });

      // fallback timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          obs.disconnect();
          resolve(false);
        }
      }, timeout);
    });
  }

  async function goToNextVerseOrPage() {
    if (!currentVerseKey) return;
    const idx = allVerseKeys.indexOf(currentVerseKey);

    // page-mode -> flip pages
    if (pageMode) {
      if (window.mushafNav && window.mushafNav.nextPage) {
        try { window.mushafNav.nextPage(); } catch (e) { }
        await waitForWordsChange(1200);
        populateAllVerseKeys();
        await renderPageMode();
      }
      return;
    }

    // (legacy) traverse verses within same page
    if (idx < allVerseKeys.length - 1) {
      showVersePopup(allVerseKeys[idx + 1]);
      return;
    }
  }

  async function goToPrevVerseOrPage() {
    if (!currentVerseKey) return;
    const idx = allVerseKeys.indexOf(currentVerseKey);

    // page-mode -> flip pages
    if (pageMode) {
      if (window.mushafNav && window.mushafNav.prevPage) {
        try { window.mushafNav.prevPage(); } catch (e) { }
        await waitForWordsChange(1200);
        populateAllVerseKeys();
        await renderPageMode();
      }
      return;
    }

    // (legacy) traverse verses within same page
    if (idx > 0) {
      showVersePopup(allVerseKeys[idx - 1]);
      return;
    }
  }

  async function getSurahTranslation(surahNumber) {
    try {
      const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahNumber}`);
      const data = await res.json();
      return data.chapter?.translated_name?.name || '';
    } catch {
      return '';
    }
  }

  function attachVerseListeners() {
    document.addEventListener('click', e => {

      // ONLY allow clicks on verse separator
      const separator = e.target.closest('.verse-separator');

      if (!separator) return;

      const k = extractVerseKeyFromElement(separator);
      if (!k) return;

      showVersePopup(k);

    }, true);
  }

  function attachSurahScrollHandler(pageList) {
  if (!pageList || !contentWrapper) return;

  const updateSurahLabel = async () => {
    const items = Array.from(
      pageList.querySelectorAll('.verse-modal-item[data-verse-key]')
    );

    if (!items.length) return;

    const wrapperRect = contentWrapper.getBoundingClientRect();

    // Find the last verse block that has reached/passed the top
    // of the visible scrolling area.
    let activeItem = items[0];

    for (const item of items) {
      const rect = item.getBoundingClientRect();

      if (rect.top <= wrapperRect.top + 20) {
        activeItem = item;
      } else {
        break;
      }
    }

    const verseKey = activeItem.dataset.verseKey;
    if (!verseKey) return;

    const [surahNum] = verseKey.split(':');
    const surah = Number(surahNum);

   let chaptersCache = null;

async function getChapters() {
  if (chaptersCache) return chaptersCache;

  try {
    const res = await fetch('https://api.quran.com/api/v4/chapters');
    const data = await res.json();
    chaptersCache = Array.isArray(data.chapters) ? data.chapters : [];
    return chaptersCache;
  } catch {
    return [];
  }
}

    const chapters = await getChapters();
const surahData = chapters.find(chapter => chapter.id === surah);
const surahName = surahData?.name_simple || `Surah ${surah}`;
const surahNumThree = String(surah).padStart(3, '0');

    header.innerHTML =
  `Page ${window.currentPage || ''} &nbsp;&nbsp; ` +
  `<span style="font-weight: 300 !important;">Surah ${surahName} <span style="font-family: 'SuraNames';">${surahNumThree}</span></span>`;
  };

  contentWrapper.removeEventListener('scroll', pageList.__surahScrollHandler);

  pageList.__surahScrollHandler = updateSurahLabel;

  contentWrapper.addEventListener('scroll', updateSurahLabel, {
    passive: true
  });

  requestAnimationFrame(updateSurahLabel);
}

  async function renderPageMode() {
    const myToken = ++renderPageToken;
    const selectorRoot = wordsContainer || document;
    const words = Array.from(selectorRoot.querySelectorAll('.word'));
    const keys = [];
    const seen = new Set();

    if (contentWrapper) { contentWrapper.scrollTop = 0; }

    for (const w of words) {
      const k = extractVerseKeyFromElement(w);

      if (!k) continue;
      if (seen.has(k)) continue;

      keys.push(k);
      seen.add(k);
    }

    const pageList = document.createElement('div');
    pageList.className = 'verse-modal-page-list';

    // Build verse blocks FIRST (with skeletons)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const block = document.createElement('div');
      block.className = 'verse-modal-item';
      block.dataset.verseKey = key;
      block.style.padding = i === 0 ? '2vh 2vw 4.7vh 2vw' : '4.7vh 2vw';

      // extract surah + ayah
      const [surahNum, ayahNum] = key.split(':');

      // verse reference text
      const verseRef = document.createElement('div');
      verseRef.className = 'verse-modal-ref';
      verseRef.textContent = `${surahNum}:${ayahNum}`;

      const arab = document.createElement('div');
      arab.className = 'verse-modal-arabic';
      arab.style.fontFamily = 'IndoPakNastaleeq';
      arab.style.fontSize = getIndopakFontSize();

      const trans = document.createElement('div');
      trans.className = 'verse-modal-translation';

      // === SKELETON ===
      arab.innerHTML = `
      <div class="verse-skeleton-line arabic" style="width:90%"></div>
      <div class="verse-skeleton-line arabic" style="width:75%"></div>
    `;

      trans.innerHTML = `
      <div class="verse-skeleton-line" style="width:95%"></div>
      <div class="verse-skeleton-line" style="width:80%"></div>
    `;

      const hr = document.createElement('hr');
      hr.style.border = 'none';
      hr.style.borderTop = '1px solid var(--muted-text-3)';
      hr.style.margin = '0';
      hr.style.display = i === 0 ? 'none' : 'block';

      block.appendChild(arab);
      block.appendChild(trans);
      pageList.appendChild(hr);
      pageList.appendChild(block);
    }

    pageView.innerHTML = '';
pageView.appendChild(pageList);
attachPageFootnoteHandlers(pageList);
attachSurahScrollHandler(pageList);
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }

    const pageWordMap = await fetchPageIndopakWords(window.currentPage || 1);
    const validPageKeys = new Set(pageWordMap.keys());

    // 1. Clean the keys array: Remove DOM-scraped keys that do NOT belong to this API page layout
    for (let i = keys.length - 1; i >= 0; i--) {
      if (!validPageKeys.has(keys[i])) {
        keys.splice(i, 1);
      }
    }

    // 2. Clean the DOM: Remove any skeleton blocks that were built for the wrong/extra verses
    const builtBlocks = pageList.querySelectorAll('.verse-modal-item');
    builtBlocks.forEach(block => {
      const blockKey = block.dataset.verseKey;
      if (!validPageKeys.has(blockKey)) {
        // Remove the block's companion divider line if it exists
        const prevHr = block.previousElementSibling;
        if (prevHr && prevHr.tagName === 'HR') {
          prevHr.remove();
        }
        block.remove();
      }
    });

    // === FETCH ACTUAL CONTENT ===
    const fetchTasks = keys.map(async k => {
      try {
        const verseData = pageWordMap.get(k);

        if (!verseData) {
          return null;
        }

        const arabWords = verseData.words || [];
        const [transText, ayahEnd] = await Promise.all([
          fetchTranslation(k),
          fetchIndopakVerseEnd(k)
        ]);
        return { k, arabWords, transText, ayahEnd };
      } catch {
        return { k, arabWords: [], transText: '', ayahEnd: '' };
      }
    });

    const results = await Promise.allSettled(fetchTasks);

    if (myToken !== renderPageToken) return;

    for (let i = 0; i < results.length; i++) {

      if (results[i].status !== 'fulfilled') {
        continue;
      }

      const res = results[i].value;
      if (myToken !== renderPageToken) return;
      const block = pageList.querySelector(
        `.verse-modal-item[data-verse-key="${CSS.escape(res.k)}"]`
      );

      if (!block) continue;
      if (!pageView.contains(block)) continue;

      const [surah, ayah] = res.k.split(':').map(Number);
      const prev = keys[i - 1];
      let prevSurah = null;
      if (prev) prevSurah = Number(prev.split(':')[0]);

      // === PRESERVE YOUR SURAH HEADER + BISMILLAH ===
      if (ayah === 1 && surah !== prevSurah) {

        if (myToken !== renderPageToken) return;
        const surahTranslation = await getSurahTranslation(surah);
        const surahName = await getSurahName(surah);

        const surahInfo = document.createElement('div');
        surahInfo.style.display = 'flex';
        surahInfo.style.flexDirection = 'row';
        surahInfo.style.alignItems = 'center';
        surahInfo.style.justifyContent = 'center';
        surahInfo.style.direction = 'ltr';
        surahInfo.style.marginBottom = '1vh';
        surahInfo.style.gap = '1vw';

        const surahNumberDiv = document.createElement('div');
        surahNumberDiv.textContent = surah.toString().padStart(3, '0');
        surahNumberDiv.style.fontSize = '10vh';
        surahNumberDiv.style.fontFamily = 'SuraNames';
        surahInfo.appendChild(surahNumberDiv);

        const surahNameDiv = document.createElement('div');
        surahNameDiv.style.display = 'flex';
        surahNameDiv.style.flexDirection = 'column';
        surahNameDiv.style.textAlign = 'left';

        const surahNameTop = document.createElement('div');
        surahNameTop.textContent = `${surah}. ${surahName || ''}`;
        surahNameTop.style.fontSize = '3.5vh';
        surahNameTop.style.fontWeight = '500';
        surahNameDiv.appendChild(surahNameTop);

        const surahNameBottom = document.createElement('div');
        surahNameBottom.textContent = surahTranslation;
        surahNameBottom.style.fontSize = '2.8vh';
        surahNameBottom.style.fontWeight = '300';
        surahNameDiv.appendChild(surahNameBottom);

        surahInfo.appendChild(surahNameDiv);

        if (surah !== 1 && surah !== 9) {
          const bismillah = document.createElement('div');
          bismillah.innerHTML = `
          321<br>
          <span style="display:block; font-size:1.7vh; font-weight:300; margin-top:0.5vh;">
            In the Name of Allah—the Most Compassionate, Most Merciful
          </span>
        `;
          bismillah.style.textAlign = 'center';
          bismillah.style.marginBottom = '5vh';
          bismillah.style.fontFamily = 'Bismillah';
          bismillah.style.fontSize = '3.4vh';
          bismillah.style.opacity = '0.9';
          block.prepend(bismillah);
        }
        block.prepend(surahInfo);
      }

      // Replace skeleton with real content
      const arabicEl = block.querySelector('.verse-modal-arabic');
      arabicEl.replaceChildren();
      arabicEl.appendChild(buildIndopakWordsFragment(res.arabWords, res.k, res.ayahEnd));
      if (res.arabWords.length) {
        block.querySelector('.verse-modal-translation').innerHTML = res.transText;
      }
      decorateTranslationFootnotes(block);
    }

    // Defer the highlight routine until the browser has completed layout painting
    if (window.bookmarkUtils && typeof window.bookmarkUtils.refreshHighlights === 'function') {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.bookmarkUtils.refreshHighlights();
        }, 50);
      });
    }
  }

  function modalKeydownHandler(e) {
    if (!modal || !modal.classList.contains('visible')) return;

    // 🚫 Ignore auto-repeat events (when key is held down)
    if (e.repeat) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();

      if (e.key === 'ArrowLeft') {
        if (window.mushafNav && window.mushafNav.nextPage) {
          try { window.mushafNav.nextPage(); } catch { }
          waitForWordsChange(1200).then(() => {
            populateAllVerseKeys();
            renderPageMode().catch(() => { });
          });
        }
      }

      else if (e.key === 'ArrowRight') {
        if (window.mushafNav && window.mushafNav.prevPage) {
          try { window.mushafNav.prevPage(); } catch { }
          waitForWordsChange(1200).then(() => {
            populateAllVerseKeys();
            renderPageMode().catch(() => { });
          });
        }
      }

      else if (e.key === 'Escape') {
        closeModal();
      }
    }
  }

  function modalKeyupHandler(e) {
    if (!modal || !modal.classList.contains('visible')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    createModal();
    attachVerseListeners();

    // capture listeners run before other window handlers and stop propagation
    window.addEventListener('keydown', modalKeydownHandler, true);
    window.addEventListener('keyup', modalKeyupHandler, true);
    window.addEventListener('mushaf:indopak-font-size-changed', applyIndopakFontSizeToModal);
    window.addEventListener('mushaf:word-translation-under-changed', () => {
      if (modal && modal.classList.contains('visible')) {
        renderPageMode().catch(() => { });
      }
    });
  });

  // expose functions for other scripts if needed
  window.showVersePopup = showVersePopup;
  window.showVersePopupNext = goToNextVerseOrPage;
  window.showVersePopupPrev = goToPrevVerseOrPage;
})();
