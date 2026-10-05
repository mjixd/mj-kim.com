# mj-kim.com

Portfolio site for Minjung Kim. Single-file static site (index.html) hosted on GitHub Pages.

사용자가 `/올려줘`라고 요청하면 승인한 변경을 이 포트폴리오 사이트에 적용하고 검증 후 배포한다.

- `index.html` — the whole site (hash routing: `#/work/<slug>`, `#/about`)
- `assets/decks/` — full case-study slide images (Figma exports and supplied planning images)
- `CNAME` — custom domain for GitHub Pages
- `og.png`, `favicon*.png`, `apple-touch-icon.png` — share card and icons

Figma detail visuals and decks use 2× PNG exports (3840×2160), displayed at 16:9.
Meta's Planning section uses the supplied `ML3.png` and `ML6.png` originals (8000×4500), cycling in that order every three seconds. Both also appear after EN 40 in the full Meta deck.
`EN · NN` images come from [Interview Deck · AI Strategy](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2192-715).
`WEB 42–44` (Domino mentorship) and `WEB 77–84` (LINE) supplement that selection from the English frames in [Interview Deck 25.12.15](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=1660-4743).
Keep the exported Figma frame names as filenames; `CASES` and `DECKS` in `index.html` own their placement and order.
Update `DECK_REVISION` when refreshing exports so visitors receive the latest images immediately.
Original Figma page numbers are covered only in the web presentation; exported PNGs remain unchanged.
The light theme uses `--surface-light` as its default background, one step lighter than `--surface`.

`assets/videos/` contains muted H.264 copies of the original Figma recordings:

- `domino-account.mp4` — `EN · 33`, from `RPReplay_Final1706341379 2.mov`.
- `domino-filter.mp4` — `WEB 44`, from `asset_filter.mov`.

`SLIDE_VIDEOS` keeps their placement aligned to the 1920×1080 Figma frames. Videos loop while visible in a detail page; the original slide stays underneath as a fallback.

Domino's founding strategy and account-centric work share the `domino-mvp` case, using the original account cover. The image below “Problem areas to solve” cycles through EN 22–25 every three seconds while visible, with previous/next and pause controls. The hero stays on EN 19, and EN 28 appears separately in “Build alignment through research.” Reduced-motion visitors can start the slideshow manually. EN 21 opens the full-story preview sequence. Old `domino-mydata` links redirect to the merged case.

Full case studies are available on request. Each project shows three deck previews; the third uses the actual slide under a rightward fade and a remaining-slide count. Slide images and request links open a prefilled email to `mjkiminfo@gmail.com`. Legacy `#/work/<slug>/deck/<index>` routes return to the public project page. This is a presentation strategy, not access control: exported assets remain public.

Meta keeps EN 44 and adds an interactive four-solution accordion after it. `META_SOLUTIONS` owns the descriptions and corresponding `assets/meta/solution-*.png` panels. These 2× panels are exported from the four editable [Figma accordion states](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2314-428), each with its own mesh gradient.

Remote-work adoption challenge combines the Manager Landing context with four square cards, replacing the EN 40 body thumbnail. Each card has a straight, equally sized browser preview and editable title and description below it. PDF pages 2, 10, 4, and 17 inform the screen previews; the reviewed context excludes pages 1, 5, 6, and 18. Each card retains Under NDA and the Meta email-request link. The PDF and unblurred page renders are not published. Cards use two columns on desktop and one on mobile. Play/pause controls use icons with accessible labels.

- Domino EN · 19 uses the refreshed 2× Figma export and a muted, looping H.264 chart video, cropped to the Figma video bounds. The exported app icon stays above the video. Playback pauses outside the viewport.
- Quality at scale uses frame 2072, titled “Design critique → Clearer filter UX”; the former WEB 43 asset is preserved.
- Whole story preview selections: Domino EN · 21 / 32 / 34 (D7 retention); Meta EN · 42 / 43 / 46 (D7 retention). These slides are not repeated in the public body or hero.

The four `assets/meta/context-*.png` previews were produced with the built-in image generator. Prompt: extract only the corresponding browser UI; show one front-facing, unrotated screen on a pale ice-blue/lilac background; bake in strong blur so names, faces, numbers and text are unreadable; no caption inside the image. The final topics are workspace, team signal, H2 scheduling, and the next phase. Final image paths: `assets/meta/context-workspace.png`, `assets/meta/context-team-signal.png`, `assets/meta/context-schedule.png`, and `assets/meta/context-next-phase.png`. The scheduling prompt extracts only the PDF page 4 table with its weekly columns, green workload bars, and blue highlighted month, then blurs all text.
