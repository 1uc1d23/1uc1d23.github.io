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

  let currentVerseKey = null;
  let allVerseKeys = [];

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
      'Close view &nbsp;<span style="opacity:0.5;">X</span>'
    );
    closeBtn.innerHTML = '<i data-feather="x"></i>';

    const nextBtn = document.createElement('div');
    nextBtn.className = 'verse-modal-nav next modal-btn';
    nextBtn.setAttribute('title', 'Next page');
    nextBtn.setAttribute(
      'data-tooltip-text',
      '<span style="opacity:0.5;">←</span> &nbsp;Next page'
    );
    nextBtn.innerHTML = '<i data-feather="chevron-left"></i>';

    const prevBtn = document.createElement('div');
    prevBtn.className = 'verse-modal-nav prev modal-btn';
    prevBtn.title = 'Previous page';
    prevBtn.setAttribute(
      'data-tooltip-text',
      '<span style="opacity:0.5;">→</span> &nbsp;Previous page'
    );
    prevBtn.innerHTML = '<i data-feather="chevron-right"></i>';

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

    // if feather is available
    try { if (window.feather) feather.replace({ width: 18, height: 18 }); } catch (e) { }

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
      let text = data.translations?.[0]?.text || 'Translation not available.';
      return text;
    } catch {
      return 'Translation not available.';
    }
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
    close.innerHTML = '<i data-feather="x"></i>';
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
    try { if (window.feather) feather.replace({ width: 14, height: 14 }); } catch (e) { }

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

  // helper to extract verseKey from a word element in many possible ways
  function extractVerseKeyFromElement(el) {
    return el && (el.__verseKey || el.getAttribute('data-verse-key') || el.dataset.verseKey || el.getAttribute('data-tooltip') || el.getAttribute('data-verse') || null);
  }

  function populateAllVerseKeys() {
    allVerseKeys = [];
    const verseSet = new Set();
    const selectorRoot = wordsContainer || document;
    const words = Array.from(selectorRoot.querySelectorAll('.word'));
    words.forEach(w => {
      const k = extractVerseKeyFromElement(w);
      if (k && !verseSet.has(k)) {
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

  async function renderPageMode() {
    const selectorRoot = wordsContainer || document;
    const words = Array.from(selectorRoot.querySelectorAll('.word'));
    const keys = [];
    const seen = new Set();

    if (contentWrapper) { contentWrapper.scrollTop = 0; }

    for (const w of words) {
      const k = extractVerseKeyFromElement(w);
      if (k && !seen.has(k)) {
        keys.push(k);
        seen.add(k);
      }
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

    header.innerHTML = `Page ${window.currentPage || ''} &nbsp; <span style="font-weight: 300 !important;">Juz ${window.juzNumber || ''}</span>`;
    pageView.innerHTML = '';
    pageView.appendChild(pageList);
    attachPageFootnoteHandlers(pageList);
    try { if (window.feather) feather.replace(); } catch (e) { }

    // === FETCH ACTUAL CONTENT ===
    const fetchTasks = keys.map(async k => {
      try {
        const arabResp = await fetch(`https://api.quran.com/api/v4/quran/verses/indopak_nastaleeq?verse_key=${k}`);
        const arabJson = await arabResp.json().catch(() => ({}));
        const arabText = arabJson.verses?.[0]?.text_indopak_nastaleeq || '';
        const transText = await fetchTranslation(k);
        return { k, arabText, transText };
      } catch {
        return { k, arabText: '', transText: '' };
      }
    });

    const results = await Promise.all(fetchTasks);

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const block = pageList.querySelector(
        `.verse-modal-item[data-verse-key="${res.k}"]`
      );
      if (!block) continue;

      const [surah, ayah] = res.k.split(':').map(Number);
      const prev = keys[i - 1];
      let prevSurah = null;
      if (prev) prevSurah = Number(prev.split(':')[0]);

      // === PRESERVE YOUR SURAH HEADER + BISMILLAH ===
      if (ayah === 1 && surah !== prevSurah) {

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
      block.querySelector('.verse-modal-arabic').textContent = res.arabText;
      block.querySelector('.verse-modal-translation').innerHTML = res.transText;
      decorateTranslationFootnotes(block);
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
  });

  // expose functions for other scripts if needed
  window.showVersePopup = showVersePopup;
  window.showVersePopupNext = goToNextVerseOrPage;
  window.showVersePopupPrev = goToPrevVerseOrPage;
})();
