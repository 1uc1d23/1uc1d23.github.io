// settings.js
// Handles theme switching + settings panel behavior

(function () {
    const overlay = document.getElementById('settingsOverlay');
    const panel = document.getElementById('settingsPanel');

    const darkBtn = document.getElementById('btnDark');
    const sunsetBtn = document.getElementById('btnSunset');
    const tooltipSelect = document.getElementById('tooltipMode');
    const indopakFontSizeDown = document.getElementById('indopakFontSizeDown');
    const indopakFontSizeUp = document.getElementById('indopakFontSizeUp');
    const indopakFontSizeValue = document.getElementById('indopakFontSizeValue');
    const TOOLTIP_KEY = 'mushaf-tooltip-mode';
    const INDOPAK_FONT_FACTOR_KEY = 'mushaf-indopak-font-factor';
    const INDOPAK_FONT_USER_SET_KEY = 'mushaf-indopak-font-user-set';
    const INDOPAK_DEFAULT_FACTOR = 3;
    const INDOPAK_MIN_FACTOR = 1;
    const INDOPAK_MAX_FACTOR = 8;
    const INDOPAK_BASE_VH = 4.4;

    const STORAGE_KEY = 'mushaf-theme';

    // -------------------------
    // THEME APPLY
    // -------------------------
    function applyTheme(theme) {
        document.body.classList.remove('theme-sunset');

        if (theme === 'sunset') {
            document.body.classList.add('theme-sunset');
        }

        localStorage.setItem(STORAGE_KEY, theme);
        updateActiveButton(theme);
    }

    function updateActiveButton(theme) {
        darkBtn?.classList.remove('active');
        sunsetBtn?.classList.remove('active');

        if (theme === 'sunset') {
            sunsetBtn?.classList.add('active');
        } else {
            darkBtn?.classList.add('active');
        }
    }
    function loadSavedTooltipMode() {
        const saved = localStorage.getItem(TOOLTIP_KEY) || 'translation';
        tooltipSelect.value = saved;
    }
    function setIndopakFontFactor(factor, persist = true, markUserSet = false) {
        const parsed = Number(factor);
        const safeFactor = Number.isFinite(parsed) ? Math.round(parsed) : INDOPAK_DEFAULT_FACTOR;
        const normalizedFactor = Math.max(INDOPAK_MIN_FACTOR, Math.min(INDOPAK_MAX_FACTOR, safeFactor));
        const scaledVh = (INDOPAK_BASE_VH * normalizedFactor) / INDOPAK_DEFAULT_FACTOR;
        const cssValue = `${scaledVh.toFixed(2)}vh`;

        document.documentElement.style.setProperty('--indopak-font-size', cssValue);

        if (indopakFontSizeValue) {
            indopakFontSizeValue.textContent = String(normalizedFactor);
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

    // -------------------------
    // LOAD SAVED THEME
    // -------------------------
    function loadSavedTheme() {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved === 'sunset') {
            applyTheme('sunset');
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
    indopakFontSizeDown?.addEventListener('click', () => {
        const current = Number(indopakFontSizeValue?.textContent) || INDOPAK_DEFAULT_FACTOR;
        setIndopakFontFactor(current - 1, true, true);
    });
    indopakFontSizeUp?.addEventListener('click', () => {
        const current = Number(indopakFontSizeValue?.textContent) || INDOPAK_DEFAULT_FACTOR;
        setIndopakFontFactor(current + 1, true, true);
    });

    // Init
    loadSavedTheme();
    loadSavedTooltipMode();
    loadSavedIndopakFontFactor();
    if (window.feather) {
        feather.replace({ width: 14, height: 14 });
    }
})();
