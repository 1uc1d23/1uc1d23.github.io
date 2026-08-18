// settings.js
// Handles theme switching + settings panel behavior

(function () {
    const overlay = document.getElementById('settingsOverlay');
    const panel = document.getElementById('settingsPanel');

    const darkBtn = document.getElementById('btnDark');
    const sunsetBtn = document.getElementById('btnSunset');
    const roseGoldBtn = document.getElementById('btnRoseGold');
    const tooltipSelect = document.getElementById('tooltipMode');
    const wordTranslationToggle = document.getElementById('wordTranslationToggle');
    const indopakFontSizeDown = document.getElementById('indopakFontSizeDown');
    const indopakFontSizeUp = document.getElementById('indopakFontSizeUp');
    const indopakFontSizeValue = document.getElementById('indopakFontSizeValue');
    const translationFontSizeDown = document.getElementById('translationFontSizeDown');
    const translationFontSizeUp = document.getElementById('translationFontSizeUp');
    const translationFontSizeValue = document.getElementById('translationFontSizeValue');
    const TOOLTIP_KEY = 'mushaf-tooltip-mode';
    const WORD_TRANSLATION_UNDER_KEY = 'mushaf-word-translation-under';
    const INDOPAK_FONT_FACTOR_KEY = 'mushaf-indopak-font-factor';
    const INDOPAK_FONT_USER_SET_KEY = 'mushaf-indopak-font-user-set';
    const TRANSLATION_FONT_FACTOR_KEY = 'mushaf-translation-font-factor';
    const TRANSLATION_FONT_USER_SET_KEY = 'mushaf-translation-font-user-set';
    const FONT_STEP = 0.5;
    const INDOPAK_DEFAULT_FACTOR = 3;
    const INDOPAK_MIN_FACTOR = 1;
    const INDOPAK_MAX_FACTOR = 5;
    const INDOPAK_BASE_VH = 4.4;
    const TRANSLATION_DEFAULT_FACTOR = 3;
    const TRANSLATION_MIN_FACTOR = 1;
    const TRANSLATION_MAX_FACTOR = 5;
    const TRANSLATION_BASE_VH = 2.1;

    const STORAGE_KEY = 'mushaf-theme';

    // -------------------------
    // THEME APPLY
    // -------------------------
    function applyTheme(theme) {
        document.body.classList.remove('theme-sunset', 'theme-rose-gold');

        if (theme === 'sunset') {
            document.body.classList.add('theme-sunset');
        } else if (theme === 'rose-gold') {
            document.body.classList.add('theme-rose-gold');
        }

        localStorage.setItem(STORAGE_KEY, theme);
        updateActiveButton(theme);
    }

    function updateActiveButton(theme) {
        darkBtn?.classList.remove('active');
        sunsetBtn?.classList.remove('active');
        roseGoldBtn?.classList.remove('active');

        if (theme === 'sunset') {
            sunsetBtn?.classList.add('active');
        } else if (theme === 'rose-gold') {
            roseGoldBtn?.classList.add('active');
        } else {
            darkBtn?.classList.add('active');
        }
    }
    function loadSavedTooltipMode() {
        const saved = localStorage.getItem(TOOLTIP_KEY) || 'translation';
        tooltipSelect.value = saved;
    }
    function setWordTranslationUnder(enabled, persist = true) {
        const isEnabled = Boolean(enabled);
        if (wordTranslationToggle) {
            wordTranslationToggle.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
        }
        if (persist) {
            localStorage.setItem(WORD_TRANSLATION_UNDER_KEY, isEnabled ? '1' : '0');
        }
        window.dispatchEvent(new CustomEvent('mushaf:word-translation-under-changed', {
            detail: { enabled: isEnabled }
        }));
    }
    function loadSavedWordTranslationUnder() {
        const saved = localStorage.getItem(WORD_TRANSLATION_UNDER_KEY) === '1';
        setWordTranslationUnder(saved, false);
    }
    function formatFactorDisplay(value) {
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    function snapToStep(value, step) {
        return Math.round(value / step) * step;
    }
    function setIndopakFontFactor(factor, persist = true, markUserSet = false) {
        const parsed = Number(factor);
        const safeFactor = Number.isFinite(parsed) ? snapToStep(parsed, FONT_STEP) : INDOPAK_DEFAULT_FACTOR;
        const normalizedFactor = Math.max(INDOPAK_MIN_FACTOR, Math.min(INDOPAK_MAX_FACTOR, safeFactor));
        const scaledVh = (INDOPAK_BASE_VH * normalizedFactor) / INDOPAK_DEFAULT_FACTOR;
        const cssValue = `${scaledVh.toFixed(2)}vh`;

        document.documentElement.style.setProperty('--indopak-font-size', cssValue);

        if (indopakFontSizeValue) {
            indopakFontSizeValue.textContent = formatFactorDisplay(normalizedFactor);
        }

        if (persist) {
            localStorage.setItem(INDOPAK_FONT_FACTOR_KEY, String(normalizedFactor));
        }
        if (markUserSet) {
            localStorage.setItem(INDOPAK_FONT_USER_SET_KEY, '1');
        }

        window.dispatchEvent(new CustomEvent('mushaf:indopak-font-size-changed', {
            detail: { factor: normalizedFactor, value: cssValue }
        }));
    }
    function loadSavedIndopakFontFactor() {
        const userSet = localStorage.getItem(INDOPAK_FONT_USER_SET_KEY) === '1';
        const saved = userSet ? localStorage.getItem(INDOPAK_FONT_FACTOR_KEY) : null;
        setIndopakFontFactor(saved ?? INDOPAK_DEFAULT_FACTOR, false);
    }
    function setTranslationFontFactor(factor, persist = true, markUserSet = false) {
        const parsed = Number(factor);
        const safeFactor = Number.isFinite(parsed) ? snapToStep(parsed, FONT_STEP) : TRANSLATION_DEFAULT_FACTOR;
        const normalizedFactor = Math.max(TRANSLATION_MIN_FACTOR, Math.min(TRANSLATION_MAX_FACTOR, safeFactor));
        const scaledVh = (TRANSLATION_BASE_VH * normalizedFactor) / TRANSLATION_DEFAULT_FACTOR;
        const cssValue = `${scaledVh.toFixed(1)}vh`;

        document.documentElement.style.setProperty('--translation-font-size', cssValue);

        if (translationFontSizeValue) {
            translationFontSizeValue.textContent = formatFactorDisplay(normalizedFactor);
        }

        if (persist) {
            localStorage.setItem(TRANSLATION_FONT_FACTOR_KEY, String(normalizedFactor));
        }
        if (markUserSet) {
            localStorage.setItem(TRANSLATION_FONT_USER_SET_KEY, '1');
        }

        window.dispatchEvent(new CustomEvent('mushaf:translation-font-size-changed', {
            detail: { factor: normalizedFactor, value: cssValue }
        }));
    }
    function loadSavedTranslationFontFactor() {
        const userSet = localStorage.getItem(TRANSLATION_FONT_USER_SET_KEY) === '1';
        const saved = userSet ? localStorage.getItem(TRANSLATION_FONT_FACTOR_KEY) : null;
        setTranslationFontFactor(saved ?? TRANSLATION_DEFAULT_FACTOR, false);
    }

    // -------------------------
    // LOAD SAVED THEME
    // -------------------------
    function loadSavedTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === 'sunset') {
            applyTheme('sunset');
        } else if (saved === 'rose-gold') {
            applyTheme('rose-gold');
        } else {
            applyTheme('dark');
        }
    }

    // -------------------------
    // PANEL OPEN / CLOSE
    // -------------------------
    function openPanel() {
        overlay.classList.add('open');
    }

    function closePanel() {
        overlay.classList.remove('open');
    }
    function isOpen(el) { return el && el.classList.contains('open'); }

    // Close when clicking outside panel
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePanel();
        }
    });

    // Optional: ESC key closes panel
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePanel();
        }
    });

    // -------------------------
    // BUTTON EVENTS
    // -------------------------
    darkBtn?.addEventListener('click', () => {
        applyTheme('dark');
    });

    sunsetBtn?.addEventListener('click', () => {
        applyTheme('sunset');
    });
    roseGoldBtn?.addEventListener('click', () => {
        applyTheme('rose-gold');
    });

    window.addEventListener('keydown', ev => {
        if (document.getElementsByClassName('visible').length) return;
        const a = document.activeElement;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
        if (ev.key === 'o' || ev.key === 'O') { ev.preventDefault(); document.querySelectorAll('.open').forEach(e => e !== settingsOverlay && e.classList.remove('open')); isOpen(settingsOverlay) ? closePanel() : openPanel(); }
    }, { passive: false });
    tooltipSelect?.addEventListener('change', () => {
    const mode = tooltipSelect.value;
    localStorage.setItem(TOOLTIP_KEY, mode);

    // Re-render current page to apply tooltip mode
    if (window.mushafNav && typeof window.mushafNav.showPage === 'function') {
        window.mushafNav.showPage(window.currentPage);
    }
});
    wordTranslationToggle?.addEventListener('click', () => {
        const next = wordTranslationToggle.getAttribute('aria-pressed') !== 'true';
        setWordTranslationUnder(next, true);
    });
    indopakFontSizeDown?.addEventListener('click', () => {
        const current = Number(indopakFontSizeValue?.textContent) || INDOPAK_DEFAULT_FACTOR;
        setIndopakFontFactor(current - FONT_STEP, true, true);
    });
    indopakFontSizeUp?.addEventListener('click', () => {
        const current = Number(indopakFontSizeValue?.textContent) || INDOPAK_DEFAULT_FACTOR;
        setIndopakFontFactor(current + FONT_STEP, true, true);
    });
    translationFontSizeDown?.addEventListener('click', () => {
        const current = Number(translationFontSizeValue?.textContent) || TRANSLATION_DEFAULT_FACTOR;
        setTranslationFontFactor(current - FONT_STEP, true, true);
    });
    translationFontSizeUp?.addEventListener('click', () => {
        const current = Number(translationFontSizeValue?.textContent) || TRANSLATION_DEFAULT_FACTOR;
        setTranslationFontFactor(current + FONT_STEP, true, true);
    });

    // Init
    loadSavedTheme();
    loadSavedTooltipMode();
    loadSavedWordTranslationUnder();
    loadSavedIndopakFontFactor();
    loadSavedTranslationFontFactor();
    if (window.lucide) lucide.createIcons();
})();
