# Al-Qur'an — القرآن


![Dark Theme](assets/sample_dark.png){ height="180px" }
![Sunset Theme](assets/sample_sunset.png){ height="180px" }

## Overview
- A lightweight, keyboard-friendly Quran page viewer with fast preloading, page navigation.  
- Includes a top-right Settings panel with theme samples and a Surah/Page navigator that reads metadata remotely.  
- Built as a single static HTML/CSS/JS bundle suitable for GitHub Pages hosting.

## Demo (local)
- Open `quran.html` in your browser or serve the folder with a static server to preview the app locally.

## Features
- Fast image preloading with safe swapping to avoid blank frames on rapid navigation.  
- Bottom-right page Navigate panel and top-right Settings panel with theme switching.  
- Surah list populated from remote `metadata.json` with Juz grouping when available.  
- Two built-in themes (Dark and Sunset) implemented via CSS variables for instant customization.  
- Keyboard shortcuts: `/` opens Navigate, `O` toggles Settings, Arrow keys navigate pages, and `Esc` closes overlays.

## Required repository structure
- `quran.html` — main single-file app (HTML/CSS/JS).  
- `assets/sample_dark.png` — theme sample image used in Settings.  
- `assets/sample_sunset.png` — theme sample image used in Settings.  
- `pages/` — folder containing page images named `1.png` .. `604.png` (or your page count).  
- `fonts/sura_names.ttf` — optional Surah number/name font used for the surah number if you choose to activate it.  
- (optional) `CNAME` — custom domain file for GitHub Pages if you use one.

## Quick installation (clone & preview)
- `git clone <your-repo-url>` is the first step to get the source locally.  
- `cd <repo-dir>` then `python -m http.server 8000` or `npx http-server` will serve the files locally.  
- Visit `http://localhost:8000` to preview the viewer.

## How to customize themes (colors, transition)
- Open the CSS variables block near the top of the CSS and change `--bg`, `--panel`, `--text`, `--muted-text`, and `--border` to any hex values you prefer.  
- Adjust `--color-transition` to change the smoothness of theme transitions globally.  
- The `body.theme-sunset` class toggles the sunset palette while `body.theme-dark` applies the default dark palette.

## How to change sample images
- Replace `assets/sample_dark.png` and `assets/sample_sunset.png` with your own images keeping the same filenames to maintain Settings references.  
- If you prefer different filenames, update the `<img src="...">` paths inside the Settings panel in `quran.html` to match.

## How to change Surah font
- Put your custom font file at `fonts/sura_names.ttf` and register it via `@font-face` in the CSS, then apply it to the `.surah-num` class using `font-family: 'SuraNames', Inter, system-ui;`.

## Surah metadata & Juz grouping
- The app fetches Surah metadata from `https://raw.githubusercontent.com/rn0x/Quran-Data/refs/heads/version-2.0/data/json/metadata.json` to show surah names and verse counts.  
- If you want to use an offline copy, download that JSON into `data/metadata.json` and update the JS fetch URL accordingly.  
- If you want to hardcode Juz start pages, edit the `JUZ_START_PAGES` object in the JS with your preferred values.

## Page image behavior & performance tips
- Use compressed but reasonable-resolution PNGs for `pages/` to keep memory use and load time low.  
- If you host many pages, consider limiting client-side cache size with the `CACHE_LIMIT` variable in the JS to avoid memory pressure.  
- Adjust `INITIAL_REPEAT_DELAY` and `REPEAT_INTERVAL_MS` in the JS to tune keyboard-hold navigation responsiveness.

## GitHub Pages deployment (simple)
- Push your repo to GitHub, go to the repository **Settings → Pages**, and choose the branch (usually `main`) and the root folder to serve the site.  
- If the site is served from a subpath (like `username.github.io/repo`), set `<base href="/repo/">` in `quran.html` or adjust relative paths accordingly.  
- Add a `CNAME` file to the repository root to enable a custom domain via GitHub Pages.

## Example `quran.html` adjustments for a repo subpath
- Add `<base href="/your-repo-name/">` inside `<head>` if your Pages site is at `https://username.github.io/your-repo-name/`.  
- Replace `pages/` and `assets/` references with absolute or correct relative paths if you change folder structure.

## Troubleshooting
- If Surah metadata fails to load, the UI falls back to a simple Surah listing and shows a short hint in the Navigate panel.  
- If arrows produce blank images, increase the `REPEAT_INTERVAL_MS` or lower `CACHE_LIMIT` to force more conservative preloads.  
- If images fail on GitHub Pages but work locally, check that files are committed and paths are case-sensitive on GitHub.

## Accessibility & keyboard usage
- The viewer adds `tabindex="0"` to the main viewer and moves focus to appropriate controls when panels open, and the `Esc` key closes overlays.

## Contribution
- Pull requests and issues are welcome, and please use feature branches and provide a short description for any UI or performance changes.

## License
- Include your preferred license file (e.g., `LICENSE`) and add a one-line summary here like “This project is licensed under the MIT License.”

## Credits & data sources
- Surah metadata is fetched from the `rn0x/Quran-Data` repository as noted above and should be credited when used in derived works.

---

### Quick copy-paste checklist for repo
- Ensure `quran.html`, `assets/`, `pages/`, and `fonts/` are present and committed.  
- Replace sample images in `assets/` and update `fonts/sura_names.ttf` if needed.  
- Push the repository to GitHub and enable GitHub Pages from **Settings → Pages**.

