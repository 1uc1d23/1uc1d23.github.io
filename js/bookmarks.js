// bookmarks.js
(function () {
  const overlay = document.getElementById('bookmarkOverlay');
  const panel = document.getElementById('bookmarkPanel');
  const list = document.getElementById('bookmarkList');
  const addBtn = document.getElementById('bookmarkAddBtn');
  const deleteBtn = document.getElementById('bookmarkDeleteBtn');

  const BOOKMARKS_KEY = 'mushaf-bookmarks';
  const BOOKMARK_COLORS = {
    red: { label: 'Red', color: 'rgb(254, 202, 202)', bg: 'rgba(254, 202, 202, 0.28)' },
    yellow: { label: 'Yellow', color: 'rgb(253, 230, 138)', bg: 'rgba(244, 197, 66, 0.34)' },
    green: { label: 'Green', color: 'rgb(187, 247, 208)', bg: 'rgba(95, 200, 120, 0.28)' },
    blue: { label: 'Blue', color: 'rgb(186, 230, 253)', bg: 'rgba(90, 169, 255, 0.28)' },
    pink: { label: 'Pink', color: 'rgb(233, 213, 255)', bg: 'rgba(244, 126, 179, 0.3)' }
  };
  const DEFAULT_BOOKMARK_COLOR = 'yellow';
  let bookmarks = [];
  let deleteMode = false;
  let captureMode = false;
  let hoverVerseKey = null;
  let tooltipEl = null;
  let verseWordMap = new Map();
  let mapValidForPage = null;

  function isOpen(el) { return el && el.classList.contains('open'); }

  function openPanel() {
    if (!overlay) return;
    document.querySelectorAll('.open').forEach(e => e !== overlay && e.classList.remove('open'));
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function loadBookmarks() {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      bookmarks = Array.isArray(parsed) ? parsed : [];
      bookmarks = bookmarks.map(normalizeBookmark).filter(Boolean);
      bookmarks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch {
      bookmarks = [];
    }
  }

  function saveBookmarks() {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  }

  function getSurahNameByNumber(num) {
    if (window.surahs && Array.isArray(window.surahs)) {
      const match = window.surahs.find(s => Number(s.number) === Number(num));
      if (match && match.name) return match.name;
    }
    return `Surah ${num}`;
  }

  function getBookmarkColor(colorKey) {
    return BOOKMARK_COLORS[colorKey] || BOOKMARK_COLORS[DEFAULT_BOOKMARK_COLOR];
  }

  function getDefaultBookmarkName(surahName, ayahNum) {
    return `${surahName} ${ayahNum}`;
  }

  function normalizeBookmark(item) {
    if (!item || !item.verseKey) return null;
    const parts = String(item.verseKey).split(':');
    const surahNum = Number(item.surah || parts[0] || 0);
    const ayahNum = Number(item.ayah || parts[1] || 0);
    if (!surahNum || !ayahNum) return null;
    const surahName = item.surahName || getSurahNameByNumber(surahNum);
    const colorKey = BOOKMARK_COLORS[item.colorKey] ? item.colorKey : DEFAULT_BOOKMARK_COLOR;
    return {
      ...item,
      surah: surahNum,
      ayah: ayahNum,
      surahName,
      colorKey,
      name: item.name || getDefaultBookmarkName(surahName, ayahNum),
      updatedAt: item.updatedAt || Date.now()
    };
  }

  function buildBookmarkNode(item) {
    const btn = document.createElement('button');
    btn.className = 'bookmark-item';
    btn.type = 'button';
    btn.dataset.verseKey = item.verseKey;
    btn.dataset.page = String(item.page || '');
    const color = getBookmarkColor(item.colorKey);
    btn.style.setProperty('--bookmark-color', color.color);
    btn.style.setProperty('--bookmark-bg', color.bg);

    const left = document.createElement('div');
    left.className = 'bookmark-left';

    const titleRow = document.createElement('div');
    titleRow.className = 'bookmark-title-row';

    const name = document.createElement('div');
    name.className = 'bookmark-name';
    name.textContent = item.name || getDefaultBookmarkName(item.surahName || `Surah ${item.surah}`, item.ayah);

    titleRow.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'bookmark-meta';
    meta.textContent = `${item.surahName || `Surah ${item.surah}`} - Verse ${item.ayah || ''}`;

    left.appendChild(titleRow);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.className = 'bookmark-page';
    right.innerHTML = '<i data-lucide="bookmark" class="w-4 h-4"></i>';

    const del = document.createElement('div');
    del.className = 'bookmark-delete-icon';
    del.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';

    btn.appendChild(left);
    btn.appendChild(right);
    btn.appendChild(del);

    btn.addEventListener('click', async () => {
      if (deleteMode) {
        removeBookmark(item.verseKey);
        return;
      }
      closePanel();
      await goToBookmark(item);
    });

    return btn;
  }

  function renderBookmarks() {
    if (!list) return;
    list.innerHTML = '';

    if (!bookmarks.length) {
      const empty = document.createElement('div');
      empty.className = 'bookmark-empty';
      empty.textContent = 'No bookmarks yet.';
      list.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    bookmarks.forEach(b => frag.appendChild(buildBookmarkNode(b)));
    list.appendChild(frag);
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }
  }

  function removeBookmark(verseKey) {
    bookmarks = bookmarks.filter(b => b.verseKey !== verseKey);
    saveBookmarks();
    renderBookmarks();
    highlightAllBookmarkedVerses();
  }

  function openBookmarkPrompt(verseKey) {
    if (!verseKey) return Promise.resolve(null);
    const parts = verseKey.split(':');
    const surahNum = Number(parts[0] || 0);
    const ayahNum = Number(parts[1] || 0);
    if (!surahNum || !ayahNum) return Promise.resolve(null);

    const existingIdx = bookmarks.findIndex(b => b.verseKey === verseKey);
    const surahName = getSurahNameByNumber(surahNum);
    const existing = existingIdx >= 0 ? normalizeBookmark(bookmarks[existingIdx]) : null;
    const selectedColor = { key: existing?.colorKey || DEFAULT_BOOKMARK_COLOR };

    const promptOverlay = document.createElement('div');
    promptOverlay.className = 'bookmark-prompt-overlay open';

    const dialog = document.createElement('form');
    dialog.className = 'bookmark-prompt';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Save bookmark');

    const title = document.createElement('h3');
    title.textContent = 'Save Bookmark';

    const subtitle = document.createElement('p');
    subtitle.textContent = `${surahName} - Verse ${ayahNum}`;

    const nameLabel = document.createElement('label');
    nameLabel.className = 'bookmark-prompt-label';
    nameLabel.textContent = 'Name';

    const input = document.createElement('input');
    input.className = 'bookmark-prompt-input';
    input.type = 'text';
    input.maxLength = 48;
    input.placeholder = getDefaultBookmarkName(surahName, ayahNum);
    input.value = existing?.name || getDefaultBookmarkName(surahName, ayahNum);

    const colorLabel = document.createElement('div');
    colorLabel.className = 'bookmark-prompt-label';
    colorLabel.textContent = 'Highlight color';

    const colorGrid = document.createElement('div');
    colorGrid.className = 'bookmark-color-grid';

    Object.entries(BOOKMARK_COLORS).forEach(([key, value]) => {
      const button = document.createElement('button');
      button.className = 'bookmark-color-option';
      button.type = 'button';
      button.title = value.label;
      button.setAttribute('aria-label', value.label);
      button.setAttribute('aria-pressed', String(key === selectedColor.key));
      button.style.setProperty('--bookmark-color', value.color);
      button.style.setProperty('--bookmark-bg', value.bg);
      button.addEventListener('click', () => {
        selectedColor.key = key;
        colorGrid.querySelectorAll('.bookmark-color-option').forEach(option => {
          option.setAttribute('aria-pressed', String(option === button));
        });
      });
      colorGrid.appendChild(button);
    });

    const actions = document.createElement('div');
    actions.className = 'bookmark-prompt-actions';

    const cancel = document.createElement('button');
    cancel.className = 'bookmark-prompt-btn';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';

    const save = document.createElement('button');
    save.className = 'bookmark-prompt-btn primary';
    save.type = 'submit';
    save.textContent = 'Save';

    actions.appendChild(cancel);
    actions.appendChild(save);
    nameLabel.appendChild(input);
    dialog.appendChild(title);
    dialog.appendChild(subtitle);
    dialog.appendChild(nameLabel);
    dialog.appendChild(colorLabel);
    dialog.appendChild(colorGrid);
    dialog.appendChild(actions);
    promptOverlay.appendChild(dialog);
    document.body.appendChild(promptOverlay);

    return new Promise(resolve => {
      function close(value) {
        document.removeEventListener('keydown', onKeydown, true);
        promptOverlay.remove();
        resolve(value);
      }

      function onKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        }
      }

      promptOverlay.addEventListener('click', (e) => {
        if (e.target === promptOverlay) close(null);
      });
      cancel.addEventListener('click', () => close(null));
      dialog.addEventListener('submit', (e) => {
        e.preventDefault();
        const typedName = input.value.trim();
        close({
          name: typedName || getDefaultBookmarkName(surahName, ayahNum),
          colorKey: selectedColor.key
        });
      });
      document.addEventListener('keydown', onKeydown, true);
      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
    });
  }

  async function addBookmark(verseKey) {
    if (!verseKey) return false;
    const parts = verseKey.split(':');
    const surahNum = Number(parts[0] || 0);
    const ayahNum = Number(parts[1] || 0);
    if (!surahNum || !ayahNum) return false;

    const details = await openBookmarkPrompt(verseKey);
    if (!details) return false;

    const existingIdx = bookmarks.findIndex(b => b.verseKey === verseKey);
    const surahName = getSurahNameByNumber(surahNum);
    const page = Number(window.currentPage || 1);
    const item = {
      verseKey,
      surah: surahNum,
      ayah: ayahNum,
      surahName,
      name: details.name,
      colorKey: details.colorKey,
      page,
      updatedAt: Date.now()
    };

    if (existingIdx >= 0) {
      bookmarks.splice(existingIdx, 1);
    }
    bookmarks.unshift(item);
    saveBookmarks();
    renderBookmarks();
    highlightAllBookmarkedVerses();
    return true;
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'bookmark-cursor-tooltip';
    tooltipEl.textContent = 'Hover over an ayah';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function setTooltipText(htmlText) {
    const el = ensureTooltip();
    el.innerHTML = htmlText;
  }

  function showTooltip() {
    ensureTooltip().classList.add('show');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('show');
  }

  function updateTooltipPosition(e) {
    if (!tooltipEl) return;
    const x = e.clientX + 12;
    const y = e.clientY + 16;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function extractVerseKeyFromElement(el) {
    return el && (el.__verseKey || el.getAttribute('data-verse-key') || el.dataset.verseKey || el.getAttribute('data-verse') || null);
  }

  function rebuildVerseMap() {
    verseWordMap = new Map();
    const words = Array.from(document.querySelectorAll('.word'));
    words.forEach(w => {
      const k = extractVerseKeyFromElement(w);
      if (!k) return;
      if (!verseWordMap.has(k)) verseWordMap.set(k, []);
      verseWordMap.get(k).push(w);
    });
    mapValidForPage = Number(window.currentPage || 1);
  }

  function getWordsForVerse(verseKey) {
    const currentPage = Number(window.currentPage || 1);
    if (!verseWordMap.size || mapValidForPage !== currentPage) rebuildVerseMap();
    return verseWordMap.get(verseKey) || [];
  }

  function clearHoverHighlight() {
    if (!hoverVerseKey) return;
    getWordsForVerse(hoverVerseKey).forEach(w => w.classList.remove('bookmark-verse-hover'));
    hoverVerseKey = null;
  }

  function highlightAllBookmarkedVerses() {
    // 1. Remove stale bookmark classes first
    document.querySelectorAll('.word.is-bookmarked').forEach(w => {
      w.classList.remove('is-bookmarked');
      w.style.removeProperty('--bookmark-bg');
      w.style.removeProperty('--bookmark-color');
    });
    document.querySelectorAll('.verse-modal-item.is-bookmarked').forEach(block => {
      block.classList.remove('is-bookmarked');
      block.style.removeProperty('--bookmark-bg');
      block.style.removeProperty('--bookmark-color');
    });
    document.querySelectorAll('.bookmark-section-badge').forEach(badge => {
      badge.remove();
    });

    if (!bookmarks.length) return;

    // 2. Build a quick lookup dictionary for current array items
    const activeMap = new Map(bookmarks.map(b => [b.verseKey, normalizeBookmark(b)]));

    // 3. Scan the page elements and mark matches
    const words = document.querySelectorAll('.word');
    words.forEach(w => {
      const k = extractVerseKeyFromElement(w);
      const bookmark = activeMap.get(k);
      if (k && bookmark) {
        const color = getBookmarkColor(bookmark.colorKey);
        w.classList.add('is-bookmarked');
        w.style.setProperty('--bookmark-bg', color.bg);
        w.style.setProperty('--bookmark-color', color.color);
      }
    });

    document.querySelectorAll('.verse-modal-item[data-verse-key]').forEach(block => {
      const bookmark = activeMap.get(block.dataset.verseKey);
      if (!bookmark) return;
      const color = getBookmarkColor(bookmark.colorKey);
      block.classList.add('is-bookmarked');
      block.style.setProperty('--bookmark-bg', color.bg);
      block.style.setProperty('--bookmark-color', color.color);

      const badge = document.createElement('div');
      badge.className = 'bookmark-section-badge';
      badge.innerHTML = '<i data-lucide="bookmark" class="w-4 h-4"></i>';
      const label = document.createElement('span');
      label.textContent = bookmark.name || getDefaultBookmarkName(bookmark.surahName, bookmark.ayah);
      badge.appendChild(label);
      block.prepend(badge);
    });
    try { if (window.lucide) lucide.createIcons(); } catch (e) { }
  }

  function setHoverVerse(verseKey) {
    if (hoverVerseKey === verseKey) return;
    clearHoverHighlight();
    hoverVerseKey = verseKey;
    getWordsForVerse(verseKey).forEach(w => w.classList.add('bookmark-verse-hover'));
  }

  function setCursorTooltipForVerse(verseKey) {
    const parts = verseKey.split(':');
    const surahNum = Number(parts[0] || 0);
    const ayahNum = Number(parts[1] || 0);
    const surahName = getSurahNameByNumber(surahNum);
    const numStr = String(surahNum).padStart(3, '0');
    setTooltipText(`Bookmark <i>Ayah ${ayahNum}</i>`);
  }

  function handlePointerOver(e) {
    if (!captureMode) return;
    const word = e.target.closest('.word');
    if (!word) return;
    const k = extractVerseKeyFromElement(word);
    if (!k) return;
    setHoverVerse(k);
    setCursorTooltipForVerse(k);
  }

  function handlePointerOut(e) {
    if (!captureMode) return;
    const fromWord = e.target.closest('.word');
    const toWord = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.word') : null;
    if (!fromWord) return;
    const fromKey = extractVerseKeyFromElement(fromWord);
    const toKey = toWord ? extractVerseKeyFromElement(toWord) : null;
    if (fromKey && fromKey === toKey) return;
    clearHoverHighlight();
    setTooltipText('Hover over an ayah');
  }

  async function handleCaptureClick(e) {
    if (!captureMode) return;
    const word = e.target.closest('.word');
    if (!word) return;
    const k = extractVerseKeyFromElement(word);
    if (!k) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    exitCaptureMode(false);
    const saved = await addBookmark(k);
    if (saved) openPanel();
  }

  function handleKeydown(e) {
    if (!captureMode) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      exitCaptureMode(false);
    }
  }

  function enterCaptureMode() {
    if (captureMode) return;
    captureMode = true;
    document.body.classList.add('bookmark-mode');
    closePanel();
    setTooltipText('Hover over an ayah');
    showTooltip();
    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('click', handleCaptureClick, true);
    document.addEventListener('mousemove', updateTooltipPosition, true);
    document.addEventListener('keydown', handleKeydown, true);
  }

  function exitCaptureMode(openAfter) {
    captureMode = false;
    document.body.classList.remove('bookmark-mode');
    clearHoverHighlight();
    hideTooltip();
    document.removeEventListener('pointerover', handlePointerOver, true);
    document.removeEventListener('pointerout', handlePointerOut, true);
    document.removeEventListener('click', handleCaptureClick, true);
    document.removeEventListener('mousemove', updateTooltipPosition, true);
    document.removeEventListener('keydown', handleKeydown, true);
    if (openAfter) openPanel();
  }

  function toggleDeleteMode() {
    deleteMode = !deleteMode;
    if (panel) panel.classList.toggle('delete-mode', deleteMode);
    if (deleteBtn) {
      deleteBtn.classList.toggle('active', deleteMode);
      deleteBtn.innerHTML = deleteMode ? '<i data-lucide="check" class="w-4 h-4"></i>' : '<i data-lucide="trash-2" class="w-4 h-4"></i>';
      try { if (window.lucide) lucide.createIcons(); } catch (e) { }
    }
  }

  async function waitForVerseInDom(verseKey, timeout = 2200) {
    if (getWordsForVerse(verseKey).length) return true;
    return new Promise(resolve => {
      let resolved = false;
      const root = document.getElementById('mushaf-page') || document.body;
      const obs = new MutationObserver(() => {
        if (getWordsForVerse(verseKey).length) {
          if (!resolved) {
            resolved = true;
            obs.disconnect();
            resolve(true);
          }
        }
      });
      obs.observe(root, { childList: true, subtree: true });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          obs.disconnect();
          resolve(false);
        }
      }, timeout);
    });
  }

  async function goToBookmark(item) {
    const page = Number(item.page || 1);
    const fn = (window.mushafNav && window.mushafNav.showPage) || window.showPage;
    if (typeof fn === 'function') {
      await Promise.resolve(fn(page));
    }

    await waitForVerseInDom(item.verseKey);
    const nodes = getWordsForVerse(item.verseKey);
    if (!nodes.length) return;
    nodes.forEach(n => n.classList.add('bookmark-verse-focus'));
    const first = nodes[0];
    try { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { }
    setTimeout(() => nodes.forEach(n => n.classList.remove('bookmark-verse-focus')), 1200);
  }

  function init() {
    loadBookmarks();
    renderBookmarks();

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePanel();
      });
    }

    if (panel) {
      panel.addEventListener('click', (e) => e.stopPropagation());
    }

    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (captureMode) return;
        enterCaptureMode();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        toggleDeleteMode();
        if (captureMode) exitCaptureMode(false);
      });
    }

    window.addEventListener('keydown', (ev) => {
      if (document.getElementsByClassName('visible').length) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      if (ev.key === 'b' || ev.key === 'B') {
        ev.preventDefault();
        if (captureMode) {
          exitCaptureMode(true);
          return;
        }
        isOpen(overlay) ? closePanel() : openPanel();
      }
    }, { passive: false });

    const pageRoot = document.getElementById('mushaf-page');
    if (pageRoot) {
      let mutationTimeout;
      const mo = new MutationObserver(() => {
        verseWordMap.clear();
        
        // Debounce to avoid stuttering frames while the page builds
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
          highlightAllBookmarkedVerses();
        }, 60);
      });
      
      mo.observe(pageRoot, { childList: true, subtree: true });
    }

    // Also watch your pageView modal container if renderPageMode target is a modal popup
    const modalRoot = document.getElementById('pageView') || document.querySelector('.verse-modal-page-list');
    if (modalRoot) {
      let modalTimeout;
      const modalObs = new MutationObserver(() => {
        clearTimeout(modalTimeout);
        modalTimeout = setTimeout(() => {
          highlightAllBookmarkedVerses();
        }, 60);
      });
      modalObs.observe(modalRoot, { childList: true, subtree: true });
    }

    try { if (window.lucide) lucide.createIcons(); } catch (e) { }
    
    setTimeout(highlightAllBookmarkedVerses, 100);
  }

  window.bookmarkUtils = {
    refreshHighlights: highlightAllBookmarkedVerses
  };

  document.addEventListener('DOMContentLoaded', init);
})();
