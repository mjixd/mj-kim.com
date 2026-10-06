# mj-kim.com

Portfolio site for Minjung Kim. Single-file static site (index.html) hosted on GitHub Pages.

사용자가 `/올려줘`라고 요청하면 승인한 변경을 이 포트폴리오 사이트에 적용하고 검증 후 배포한다.

- `index.html`: the whole site (hash routing: `#/work/<slug>`, `#/about`)
- `assets/decks/`: full case-study slide images (Figma exports and supplied planning images)
- `CNAME`: custom domain for GitHub Pages
- `og.png`, `favicon*.png`, `apple-touch-icon.png`: share card and icons

Figma detail visuals and decks use 2× PNG exports (3840×2160), displayed at 16:9.
Meta's Planning section uses the supplied `ML3.png` and `ML6.png` originals (8000×4500), cycling in that order every three seconds. Both also appear after EN 40 in the full Meta deck.
`EN · NN` images come from [Interview Deck · AI Strategy](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2192-715).
`WEB 42–44` (Domino mentorship) and `WEB 77–84` (LINE) supplement that selection from the English frames in [Interview Deck 25.12.15](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=1660-4743).
Keep the exported Figma frame names as filenames; `CASES` and `DECKS` in `index.html` own their placement and order.
Update `DECK_REVISION` when refreshing exports so visitors receive the latest images immediately.
Original Figma page numbers are covered only in the web presentation; exported PNGs remain unchanged.
The light theme uses `--surface-light` as its default background, one step lighter than `--surface`.

`assets/videos/` contains muted H.264 copies of the original Figma recordings:

- `domino-account.mp4`: `EN · 33`, from `RPReplay_Final1706341379 2.mov`.
- `domino-filter.mp4`: `WEB 44`, from `asset_filter.mov`.

`SLIDE_VIDEOS` keeps their placement aligned to the 1920×1080 Figma frames. Videos loop while visible in a detail page; the original slide stays underneath as a fallback.

Domino's founding strategy and account-centric work share the `domino-mvp` case, using the original account cover. The image below “Problem areas to solve” cycles through EN 22–25 every three seconds while visible, with previous/next and pause controls. The hero stays on EN 19, and EN 28 appears separately in “Build alignment through research.” Reduced-motion visitors can start the slideshow manually. EN 21 opens the full-story preview sequence. Old `domino-mydata` links redirect to the merged case.

Full case studies are available on request. Each project shows three deck previews; the third uses the actual slide under a rightward fade and a remaining-slide count. Slide images and request links open a prefilled email to `mjkiminfo@gmail.com`. Legacy `#/work/<slug>/deck/<index>` routes return to the public project page. This is a presentation strategy, not access control: exported assets remain public.

Meta keeps EN 44 and adds an interactive four-solution accordion after it. `META_SOLUTIONS` owns the descriptions and corresponding `assets/meta/solution-*.png` panels. These 2× panels are exported from the four editable [Figma accordion states](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2314-428), each with its own mesh gradient.

Remote-work adoption challenge combines the Manager Landing context with four square cards, replacing the EN 40 body thumbnail. Each card has a straight, equally sized browser preview and editable title and description below it. PDF pages 2, 10, 4, and 17 inform the screen previews; the reviewed context excludes pages 1, 5, 6, and 18. Each card retains Under NDA and the Meta email-request link. The PDF and unblurred page renders are not published. Cards use two columns on desktop and one on mobile, with four distinct soft mesh gradients. The screenshots fade into their backgrounds above the editable copy. Meta’s homepage cover uses the supplied `assets/covers/cover_meta.png` unchanged. The detail hero uses four mobile screens in a 16:9 image (`assets/meta/hero-four-screens.png`). Play/pause controls use icons with accessible labels.

- Domino EN · 19 uses the refreshed 2× Figma export and a muted, looping H.264 chart video, cropped to the Figma video bounds. The exported app icon stays above the video. Playback pauses outside the viewport.
- Quality at scale uses frame 2072, titled “Design critique → Clearer filter UX”; the former WEB 43 asset is preserved.
- Whole story preview selections: Domino EN · 21 / 32 / 34 (D7 retention); Meta EN · 42 / 43 / 46 (D7 retention). These slides are not repeated in the public body or hero.

The four `assets/meta/context-*.png` previews were produced with the built-in image generator. Prompt: extract only the corresponding browser UI; show one front-facing, unrotated screen on a pale ice-blue/lilac background; bake in strong blur so names, faces, numbers and text are unreadable; no caption inside the image. The final topics are workspace, team signal, H2 scheduling, and the next phase. Final image paths: `assets/meta/context-workspace.png`, `assets/meta/context-team-signal.png`, `assets/meta/context-schedule.png`, and `assets/meta/context-next-phase.png`. The scheduling prompt extracts only the PDF page 4 table with its weekly columns, green workload bars, and blue highlighted month, then blurs all text.

## SVA thesis: hello,w

The `hello-w` case follows the five professional cases and is linked from About → Education. Its purpose is to show research-led problem framing, assumptions, interaction design, and learning from qualitative evaluation. It is explicitly an individual 2020 MFA research prototype; it makes no shipped-product, retention, or career-impact claim. The scope band says “Research scope” rather than “Impact.”

Sources: Minjung Kim's final `MinjungKim_Thesis_2020.pdf` (49 pages) and `MJKim_Thesis_ProcessBook.pdf` (45 spreads). Page numbers below refer to PDF order, not printed folios.

| Public content | Source |
| --- | --- |
| 16 primary interview participants | Written thesis 17; process book 15. This is a participant count, not a count of interview sessions. |
| Confidence, interest, role models, stereotypes | Process book 18; synthesis includes literature and primary research. |
| Assumptions and AR-to-mentoring hypothesis | Process book 19, 22, 24–27. |
| Original AR, mentor, and question/answer screens | Process book 32–35. |
| Qualitative feedback and iteration priorities | Process book 39–40; written thesis 41–44. |
| Prototype limits and need for longer-term validation | Process book 41–42; written thesis 45–47. |

The documents disagree on usability sample totals (written page 39: 14, with a 2+8 breakdown; process spread 37: 10; a separate testing description mentions 6). The public summary does not aggregate or repeat those conflicting totals. The proposed next study in the final section is a forward-looking recommendation, not a completed study.

Both complete documents are archived below the existing [Interview Deck · AI Strategy](https://www.figma.com/design/XsDIEcceMNRpfouwbhCh6I/2026?node-id=2346-404): process section `2346:404`, written section `2346:405`. PDF pages were converted to SVG, with original vector geometry and embedded raster images retained. Glyphs are outlined paths, not editable Figma text. Adjacent glyph paths were combined to keep the imported file manageable without changing appearance. Original page/spread sizes and ordering are preserved.

Only eight curated SVGs in `assets/thesis/` are public. The cover/hero and experience compositions embed losslessly encoded source screens; `research.svg` is an editorial visualization of the four source themes. Three original vector spreads (20 competitive landscape, 25 journey, 39 testing synthesis) are fitted within 16:9 previews without stretching or cropping. Neither complete PDF nor the full set of page SVGs is published. Every preview opens the contextual email request; the +43 count includes the partially visible third spread. The original screenshots remain prototype artifacts, including their example profile content.

Portfolio copy must not use the em dash (U+2014). Use natural sentences, commas, or colons; use a vertical bar between the page title and name in browser and social titles. This applies to covers, descriptions, body copy, alt text, and email request copy.

Meta context previews preserve their source proportions in a 16:9 window and crop the bottom. Top and side insets are equal at 8%; Under NDA follows the body copy at 12px (8px on the smallest screens). Narrow mobile cards grow with their text. The solution accordion divides the available column width 40:60 and stacks on mobile.

## Playable hello,w exploration

`hello-w-play/` is a standalone HTML/CSS/JavaScript experience linked from the thesis hypothesis section. Open `hello-w-play/index.html` locally or serve the repository and visit `/hello-w-play/`. It needs no build step, external runtime, or account. The original purple ball and white block concept comes from process-book spread 33. Three new challenges explore movement, building a missing bridge, and executing a sequence. This is a 2026 interpretation, not evidence of outcomes from the 2020 study.

`game.js` owns pure movement rules; `app.js` owns UI, cancellable sequence playback, camera lifetime, and local mentoring previews. Arrow keys/WASD and touch controls are equivalent. Run starts the queued program from the beginning; Stop freezes it, while reset and challenge changes discard pending steps.

Camera mode requires an explicit action and a secure browser context. It overlays the puzzle on a live video backdrop, without plane detection, spatial anchoring, recording, or upload. Denied/unavailable camera access leaves the virtual game usable. Closing the camera, backgrounding, or leaving the page stops its tracks. Mentoring is an editable local question preview with an approved fictional AI mentor portrait; it sends nothing.
