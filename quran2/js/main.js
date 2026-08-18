const loadedFonts = new Set();
const globalAudio = new Audio(); // single reusable audio instance
const chapterInfoCache = new Map();
let surahInfoOverlay = null;
let surahInfoHeader = null;
let surahInfoBody = null;

function sanitizeChapterInfoHtml(rawHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml || '', 'text/html');
  const allowed = new Set(['H2', 'P', 'UL', 'OL', 'LI', 'EM', 'STRONG', 'BR', 'B', 'I']);
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!allowed.has(node.tagName)) {
      toReplace.push(node);
      continue;
    }
    Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
  }

  toReplace.forEach(node => {
    const text = doc.createTextNode(node.textContent || '');
    node.replaceWith(text);
  });

  return doc.body.innerHTML;
}

function ensureSurahInfoModal() {
  if (surahInfoOverlay) return;

  surahInfoOverlay = document.createElement('div');
  surahInfoOverlay.className = 'surah-info-overlay';

  const modal = document.createElement('div');
  modal.className = 'surah-info-modal';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'surah-info-close modal-btn';
  closeBtn.setAttribute('aria-label', 'Close surah info');
  closeBtn.setAttribute('title', 'Close view &nbsp;<span class="shortcut">Esc</span>');
  closeBtn.innerHTML = '<i data-lucide="x"></i>';

  const chromeHeader = document.createElement('div');
  chromeHeader.className = 'surah-info-header';

  surahInfoHeader = document.createElement('div');
  surahInfoHeader.className = 'surah-info-heading';

  surahInfoBody = document.createElement('div');
  surahInfoBody.className = 'surah-info-body';

  chromeHeader.appendChild(surahInfoHeader);
  modal.appendChild(closeBtn);
  modal.appendChild(chromeHeader);
  modal.appendChild(surahInfoBody);
  surahInfoOverlay.appendChild(modal);
  document.body.appendChild(surahInfoOverlay);

  closeBtn.addEventListener('click', () => {
    surahInfoOverlay.classList.remove('visible');
  });

  surahInfoOverlay.addEventListener('click', (e) => {
    if (e.target === surahInfoOverlay) {
      surahInfoOverlay.classList.remove('visible');
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && surahInfoOverlay.classList.contains('visible')) {
      surahInfoOverlay.classList.remove('visible');
    }
  });

  try { if (window.lucide) lucide.createIcons(); } catch (e) { }
}

async function fetchChapterInfo(surahNum) {
  if (chapterInfoCache.has(surahNum)) return chapterInfoCache.get(surahNum);
  const res = await fetch(`https://api.quran.com/api/v4/chapters/${surahNum}/info?language=en`);
  if (!res.ok) throw new Error(`Failed to fetch chapter info for surah ${surahNum}`);
  const data = await res.json();
  const info = data.chapter_info || {};
  chapterInfoCache.set(surahNum, info);
  return info;
}

async function showSurahInfoPopup(surahNum, surahData) {
  ensureSurahInfoModal();
  surahInfoOverlay.classList.add('visible');

  const simpleName = surahData?.name_complex || surahData?.name_simple || `Surah ${surahNum}`;
  const translatedName = surahData?.translated_name?.name || '';
  const placeRaw = surahData?.revelation_place || '';
  const placeOfRevelation = placeRaw ? `${placeRaw.charAt(0).toUpperCase()}${placeRaw.slice(1)}` : 'Unknown';
  const versesCount = Number.isFinite(Number(surahData?.verses_count)) ? Number(surahData.verses_count) : null;
  const surahNumStr = String(surahNum).padStart(3, '0');
  const versesLabel = versesCount === null ? 'Unknown verses' : `${versesCount} verse${versesCount === 1 ? '' : 's'}`;

  surahInfoHeader.innerHTML = `
    <div class="surah-info-head-main">
      <div class="surah-info-num">${surahNumStr}</div>
      <div class="surah-info-names">
        <div class="surah-info-name-top">${surahNum}. ${simpleName}</div>
        <div class="surah-info-name-bottom">${translatedName}</div>
      </div>
    </div>
    <div class="surah-info-meta">${placeOfRevelation} &nbsp;–&nbsp; ${versesLabel}</div>
  `;

  surahInfoBody.innerHTML = `
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:60%"></div>
    <br>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:60%"></div>
    <br>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:60%"></div>
    <br>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:95%"></div>
    <div class="verse-skeleton-line" style="width:60%"></div>
    <br>
  `;

  try {
    const info = await fetchChapterInfo(surahNum);
    const richText = sanitizeChapterInfoHtml(info.text || '');
    const shortText = (info.short_text || '').trim();

    if (richText) {
      surahInfoBody.innerHTML = richText;
    } else if (shortText) {
      surahInfoBody.innerHTML = `<p>${shortText}</p>`;
    } else {
      surahInfoBody.innerHTML = '<p>Surah information is not available.</p>';
    }

  } catch (err) {
    surahInfoBody.innerHTML = '<p>Unable to load surah information right now.</p>';
  }
}

async function loadFont(name, url) {
  if (loadedFonts.has(name)) return name;
  const fontFace = new FontFace(name, `url(${url})`);
  await fontFace.load();
  document.fonts.add(fontFace);
  loadedFonts.add(name);
  return name;
}

async function renderMushafPage(pageNumber) {
  const container = document.getElementById('mushaf-page');
  const surahLabelDiv = document.getElementById('surah-label');

  // Build page OFF-DOM (prevents flicker)
  const newPage = document.createElement('div');
  newPage.style.opacity = '0';

  try {
    // Load fonts
    const fontName = await loadFont(
      `p${pageNumber}-v1`,
      `https://verses.quran.foundation/fonts/quran/hafs/v1/woff2/p${pageNumber}.woff2`
    );

    await loadFont('surah-name', '../assets/sura_names.ttf');
    await loadFont('bismillah', '../assets/bismillah.ttf');

    // Fetch page data (cached)
    let data;
    if (pageDataCache.has(pageNumber)) {
      data = pageDataCache.get(pageNumber);
    } else {
      const res = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${pageNumber}?words=true&translation_fields=ruku_number`
      );
      data = await res.json();
      pageDataCache.set(pageNumber, data);
    }

    const verses = data.verses;
    if (!verses.length) return;

    const verseMap = new Map();
    const linesMap = new Map();

      function normalizeWordText(word, page) {
        if (page === 443 && word.id === 50056 && typeof word.text === 'string') {
          const firstToken = word.text.trim().split(/\s+/)[0];
          return firstToken || word.text;
        }
        if (page === 454 && word.id === 27496 && typeof word.text === 'string') {
          return 'ﯩ';
        }
        if (page === 454 && word.id === 27498 && typeof word.text === 'string') {
          return 'ﯪﯫ';
        }
        return word.text;
      }

      verses.forEach(v => {
        verseMap.set(v.verse_key, []);

        v.words.forEach(w => {
          let correctedLineNumber = w.line_number;

          if (pageNumber === 177 && w.id === 6124 && w.line_number === 11) { correctedLineNumber = 12; }
          if (pageNumber === 443 && w.id === 50062 && w.line_number === 12) { correctedLineNumber = 13; }
          if (!linesMap.has(correctedLineNumber)) { linesMap.set(correctedLineNumber, []); }

          linesMap.get(correctedLineNumber).push({
            ...w,
            text: normalizeWordText(w, pageNumber),
            line_number: correctedLineNumber,
            verseKey: v.verse_key
          });

      });
    });

    // Fetch chapters
    const chaptersRes = await fetch('https://api.quran.com/api/v4/chapters');
    const chaptersData = await chaptersRes.json();
    const chapters = chaptersData.chapters;

    // Determine surahs on page
    const seenSurahs = new Set();
    verses.forEach(v => {
      const surahNum = parseInt(v.verse_key.split(':')[0], 10);
      seenSurahs.add(surahNum);
    });

    const seenSurahsArray = Array.from(seenSurahs).sort((a, b) => a - b);

    const sortedLineEntries = Array.from(linesMap.entries()).sort(
      (a, b) => a[0] - b[0]
    );

    const lastLineNumber = sortedLineEntries.length
      ? sortedLineEntries[sortedLineEntries.length - 1][0]
      : 1;

    // Juz calculation
    const juzStartPages = [
      1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
      202, 222, 242, 262, 282, 302, 322, 342, 362,
      382, 402, 422, 442, 462, 482, 502, 522, 542,
      562, 582
    ];
    window.juzNumber = juzStartPages.filter(p => p <= pageNumber).length;
    document.getElementById('juz-label').textContent = `Juz' ${window.juzNumber}`;

    // Surah label
    const surahLabelParts = seenSurahsArray.map(surahNum => {
      const surahData = chapters.find(c => c.id === surahNum);
      const surahName = surahData?.name_simple || `Surah ${surahNum}`;
      const numStr = String(surahNum).padStart(3, '0');
      return `${surahName} <span class="surah-num">${numStr}</span>`;
    });
    surahLabelDiv.innerHTML = surahLabelParts.join(' &nbsp;-&nbsp; ');

    document.getElementById('page-footer').textContent = `${pageNumber}`;

    const sortedLines = sortedLineEntries.map(e => e[1]);

    let currentSurah = null;
    const seenVerses = new Set();

    function insertSurahHeader(surahNum) {
      const surahData = chapters.find(c => c.id === surahNum);
      const header = document.createElement('div');
      header.className = 'mushaf-line surah-header';
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');

      const bg = document.createElement('div');
      bg.className = 'surah-header-bg';

      const text = document.createElement('div');
      text.className = 'surah-header-text';
      const surahNumStr = String(surahNum).padStart(3, '0');
      text.textContent = `${surahNumStr} surah`;

      header.appendChild(bg);
      header.appendChild(text);
      header.addEventListener('click', () => {
        showSurahInfoPopup(surahNum, surahData);
      });
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showSurahInfoPopup(surahNum, surahData);
        }
      });
      newPage.appendChild(header);
    }

    function insertBismillah() {
      const bLine = document.createElement('div');
      bLine.className = 'mushaf-line bismillah word';
      bLine.textContent = '321';
      bLine.dataset.tooltip = 'In the Name of Allah—the Most Compassionate, Most Merciful';
      newPage.appendChild(bLine);
    }

    // -------- RESTORED FIRST-SURAH LOGIC --------
    const firstLineWords = sortedLines[0];
    const firstWord = firstLineWords?.[0];

    const firstWordLineNumber = firstWord ? firstWord.line_number : 1;
    const firstSurahOfPage = firstWord
      ? parseInt(firstWord.verseKey.split(':')[0], 10)
      : null;
    const firstAyahOfPage = firstWord
      ? parseInt(firstWord.verseKey.split(':')[1], 10)
      : null;

    let firstSurahHandled = false;

    if (firstAyahOfPage === 1 && firstSurahOfPage) {
      const surahData = chapters.find(c => c.id === firstSurahOfPage);

      if (firstWordLineNumber === 3 || (firstWordLineNumber === 2 && !surahData.bismillah_pre)) {
        insertSurahHeader(firstSurahOfPage);
        if (surahData.bismillah_pre) insertBismillah();
      } else if (firstWordLineNumber === 2) {
        if (surahData.bismillah_pre) insertBismillah();
      }

      currentSurah = firstSurahOfPage;
      firstSurahHandled = true;
    }

    // -------- RENDER LINES --------
    sortedLines.forEach(lineWords => {

      for (const w of lineWords) {
        if (!seenVerses.has(w.verseKey)) {
          seenVerses.add(w.verseKey);

          const surahNum = parseInt(w.verseKey.split(':')[0], 10);
          const ayahNum = parseInt(w.verseKey.split(':')[1], 10);

          if (surahNum !== currentSurah) {
            currentSurah = surahNum;

            if (ayahNum === 1) {
              const surahData = chapters.find(c => c.id === surahNum);

              if (!firstSurahHandled || surahNum !== firstSurahOfPage) {
                insertSurahHeader(surahNum);
                if (surahData.bismillah_pre) insertBismillah();
              }
            }
          }
        }
      }

      const lineDiv = document.createElement('div');
      lineDiv.className = 'mushaf-line';

      lineWords.forEach(word => {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = word.text;
        span.style.fontFamily = fontName;
        const tooltipMode = localStorage.getItem('mushaf-tooltip-mode') || 'translation';

        if (tooltipMode === 'translation') {
          span.dataset.tooltip = word.translation?.text || '';
        } else if (tooltipMode === 'transliteration') {
          span.dataset.tooltip = word.transliteration?.text || '';
        } else {
          span.dataset.tooltip = '';
        }
        span.__verseKey = word.verseKey;

        verseMap.get(word.verseKey).push(span);

        span.addEventListener('click', () => {
          if (word.position && word.verseKey) {

            const [surahRaw, ayahRaw] = word.verseKey.split(':');

            const surahNum = surahRaw.padStart(3, '0');
            const verseNum = ayahRaw.padStart(3, '0');
            const wordPos = word.position.toString().padStart(3, '0');

            const audioUrl = `https://audio.qurancdn.com/wbw/${surahNum}_${verseNum}_${wordPos}.mp3`;

            globalAudio.src = audioUrl;
            globalAudio.play().catch(() => { });
          }
        });

        if (word.char_type_name === 'end') {
          span.classList.add('verse-separator');

          span.addEventListener('mouseenter', () => {
            verseMap.get(word.verseKey)
              .forEach(w => w.classList.add('highlighted'));
          });

          span.addEventListener('mouseleave', () => {
            verseMap.get(word.verseKey)
              .forEach(w => w.classList.remove('highlighted'));
          });
        }

        lineDiv.appendChild(span);
      });

      newPage.appendChild(lineDiv);
    });

    // Bottom-of-page next surah header
    if (lastLineNumber === 14) {
      const nextPageRes = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${pageNumber + 1}?words=true`
      );
      const nextPageData = await nextPageRes.json();
      const nextPageVerses = nextPageData.verses;

      if (nextPageVerses.length) {
        const firstNextVerse = nextPageVerses[0];
        const nextSurahNum = parseInt(firstNextVerse.verse_key.split(':')[0], 10);
        const nextAyahNum = parseInt(firstNextVerse.verse_key.split(':')[1], 10);

        if (nextAyahNum === 1) {
          insertSurahHeader(nextSurahNum);
        }
      }
    }

    // Swap DOM
    container.replaceChildren(newPage);

    document.body.classList.toggle('page-1', pageNumber === 1);
    document.body.classList.toggle('page-2', pageNumber === 2);

    void newPage.offsetWidth;
    newPage.style.opacity = '1';

  } catch (err) {
    console.error(err);
    container.textContent = ``;
  }
}

const TOTAL_PAGES = 604;
window.currentPage = 1;
window.juzNumber = 1;
const PRELOAD_RANGE = 5;
const pageDataCache = new Map();

function wrapPage(n) {
  if (n < 1) return TOTAL_PAGES;
  if (n > TOTAL_PAGES) return 1;
  return n;
}

async function prefetchPageResources(page) {
  if (page < 1 || page > TOTAL_PAGES) return;

  loadFont(`p${page}-v1`,
    `https://verses.quran.foundation/fonts/quran/hafs/v1/woff2/p${page}.woff2`
  ).catch(() => { });

  if (!pageDataCache.has(page)) {
    fetch(`https://api.quran.com/api/v4/verses/by_page/${page}?words=true`)
      .then(r => r.json())
      .then(json => pageDataCache.set(page, json))
      .catch(() => { });
  }
}

function prefetchNearby(center) {
  for (let i = center - PRELOAD_RANGE; i <= center + PRELOAD_RANGE; i++) {
    if (i < 1 || i > TOTAL_PAGES) continue;
    prefetchPageResources(i);
  }
}

let navigationLocked = false;

async function showPage(pageNum) {
  pageNum = wrapPage(pageNum);
  if (navigationLocked && pageNum === window.currentPage) return;

  navigationLocked = true;
  window.currentPage = pageNum;
  localStorage.setItem('lastMushafPage', pageNum);

  await renderMushafPage(window.currentPage).catch(() => { });

  prefetchNearby(window.currentPage);

  setTimeout(() => navigationLocked = false, 50);
}

function changePageBy(delta) {
  showPage(wrapPage(window.currentPage + delta));
}

let keyPressed = false;

window.addEventListener('keydown', (e) => {
  const tgt = e.target;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
  if (keyPressed) return;

  if (e.key === 'ArrowLeft') {
    keyPressed = true;
    changePageBy(+1);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    keyPressed = true;
    changePageBy(-1);
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') keyPressed = false;
});

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

      tooltip.innerHTML = txt;
      lucide.createIcons();
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
    }, 100);
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

  // wire buttons and divs
  function wireElements(root = document) {
    // select buttons and divs with a title attribute
    const elements = Array.from(root.querySelectorAll('button[title], div[title]'));
    elements.forEach(el => {
      // don't double-wire
      if (el.__tooltip_wired) return;
      el.__tooltip_wired = true;

      el.addEventListener('mouseenter', () => showFor(el), { passive: true });
      el.addEventListener('mouseleave', () => hideFor(el), { passive: true });
      el.addEventListener('focus', () => showFor(el), { passive: true });
      el.addEventListener('blur', () => hideFor(el), { passive: true });
      el.addEventListener('click', () => hideFor(el), { passive: true });

      // mobile: show tooltip on long press, hide on touchend
      let touchTimer = null;
      el.addEventListener('touchstart', (e) => {
        touchTimer = setTimeout(() => showFor(el), 350);
      }, { passive: true });
      el.addEventListener('touchend', () => { clearTimeout(touchTimer); hideFor(el); }, { passive: true });
      el.addEventListener('touchcancel', () => { clearTimeout(touchTimer); hideFor(el); }, { passive: true });
    });
  }

  // initial wiring
  wireElements();

  // re-wire if DOM changes (for dynamic elements)
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) wireElements();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // expose helper if you want to set custom tooltip for any element
  window.setElementTooltip = (el, text) => {
    if (!el) return;
    el.setAttribute('data-tooltip-text', text);
    wireElements(document);
  };
})();

function nextPage() { changePageBy(+1); }
function prevPage() { changePageBy(-1); }
function goToPage(n) { showPage(wrapPage(n)); }

prefetchNearby(window.currentPage);
const savedPage = parseInt(localStorage.getItem('lastMushafPage'), 10);

if (savedPage && savedPage >= 1 && savedPage <= TOTAL_PAGES) {
  window.currentPage = savedPage;
} else {
  window.currentPage = 1;
}

prefetchNearby(window.currentPage);
showPage(window.currentPage);

window.mushafNav = { showPage, nextPage, prevPage, goToPage, pageDataCache };
