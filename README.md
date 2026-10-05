# mj-kim.com

Portfolio site for Minjung Kim. Single-file static site (index.html) hosted on GitHub Pages.

사용자가 `/올려줘`라고 요청하면 승인한 변경을 이 포트폴리오 사이트에 적용하고 검증 후 배포한다.

- `index.html` — the whole site (hash routing: `#/work/<slug>`, `#/about`)
- `assets/decks/` — full case-study slide images (Figma exports and supplied planning images)
- `CNAME` — custom domain for GitHub Pages
- `og.png`, `favicon*.png`, `apple-touch-icon.png` — share card and icons

Figma detail visuals and decks use 2× PNG exports (3840×2160), displayed at 16:9.
Meta's Planning section uses the supplied `ML3.png` and `ML6.png` originals (8000×4500), cycling in that order every five seconds. Both also appear after EN 40 in the full Meta deck.
`EN · NN` images come from [Interview Deck · AI Strategy](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2192-715).
`WEB 42–44` (Domino mentorship) and `WEB 77–84` (LINE) supplement that selection from the English frames in [Interview Deck 25.12.15](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=1660-4743).
Keep the exported Figma frame names as filenames; `CASES` and `DECKS` in `index.html` own their placement and order.
Update `DECK_REVISION` when refreshing exports so visitors receive the latest images immediately.
Original Figma page numbers are covered only in the web presentation; exported PNGs remain unchanged.
The light theme uses `--surface-light` as its default background, one step lighter than `--surface`.

Manager Landing uses a case-scoped light presentation: a neutral background, subtle blue/lilac gradients, large paired mobile screens, and short benefit headings. `MANAGER_SCREENS` defines CSS viewports into the unchanged EN 44 export in 1920×1080 coordinates; do not redraw or replace the historical UI. The original workflow slide remains available in a disclosure and the full deck. Project copy, dates, metrics, People Products · Enterprise Engineering attribution, internal-product context, Planning autoplay, and all 11 deck slides are retained. This presentation does not imply a relationship to any later product.

`assets/videos/` contains muted H.264 copies of the original Figma recordings:

- `domino-account.mp4` — `EN · 33`, from `RPReplay_Final1706341379 2.mov`.
- `domino-filter.mp4` — `WEB 44`, from `asset_filter.mov`.

`SLIDE_VIDEOS` keeps their placement aligned to the 1920×1080 Figma frames. Videos loop while visible in a detail page or deck viewer; the original slide stays underneath as a fallback.

Domino's founding strategy and account-centric work share the `domino-mvp` case, using the original account cover. The image below “Problem areas to solve” cycles through EN 22–25 every five seconds while visible, with previous/next and pause controls. The hero stays on EN 19, and EN 28 appears separately in “Build alignment through research.” Reduced-motion visitors can start the slideshow manually. Old `domino-mydata` links redirect to the merged case and preserve their original deck slide.
