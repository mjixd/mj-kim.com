# mj-kim.com

Portfolio site for Minjung Kim. Single-file static site (index.html) hosted on GitHub Pages.

사용자가 `/올려줘`라고 요청하면 승인한 변경을 이 포트폴리오 사이트에 적용하고 검증 후 배포한다.

- `index.html` — the whole site (hash routing: `#/work/<slug>`, `#/about`)
- `assets/decks/` — full case-study slide images (export from Figma, filenames = frame names)
- `CNAME` — custom domain for GitHub Pages
- `og.png`, `favicon*.png`, `apple-touch-icon.png` — share card and icons

Detail visuals and decks use 2× PNG exports (3840×2160), displayed at 16:9.
`EN · NN` images come from [Interview Deck · AI Strategy](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2192-715).
`WEB 42–44` (Domino mentorship) and `WEB 77–84` (LINE) supplement that selection from the English frames in [Interview Deck 25.12.15](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=1660-4743).
Keep the exported Figma frame names as filenames; `CASES` and `DECKS` in `index.html` own their placement and order.
Original Figma page numbers are covered only in the web presentation; exported PNGs remain unchanged.
The light theme uses `--surface-light` as its default background, one step lighter than `--surface`.

`assets/videos/` contains muted H.264 copies of the original Figma recordings:

- `domino-account.mp4` — `EN · 33`, from `RPReplay_Final1706341379 2.mov`.
- `domino-filter.mp4` — `WEB 44`, from `asset_filter.mov`.

`SLIDE_VIDEOS` keeps their placement aligned to the 1920×1080 Figma frames. Videos loop while visible in a detail page or deck viewer; the original slide stays underneath as a fallback.
