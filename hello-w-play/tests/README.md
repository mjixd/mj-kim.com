# hello,w regression checks

Run the state tests with Node:

```sh
node hello-w-play/tests/state.cjs
```

Serve the repository root over HTTP, then run the UI and lifecycle checks against the standalone page:

```sh
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/onboarding.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/game-ui.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/game-edges.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/integration.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/meta-layout.cjs
```

Browser tests use an existing `playwright` module and its installed Chromium by default. If the dependencies live elsewhere, set `PLAYWRIGHT_MODULE` to the module path and `CHROMIUM_EXECUTABLE` to the browser executable. These tests do not install dependencies or start a server. `TEST_OUTPUT` optionally overrides the default `hello-w-tests` directory under the operating system’s temporary directory.

Every failed assertion gives a nonzero exit status. Results and screenshots are written to the output directory. Tests never request a real camera: `camera-mock.cjs` provides permission denial, deferred permission, stream lifetime and media playback fixtures. Question preview tests verify local-only behavior; no email is sent.

Coverage:

- Onboarding: explicit game entry, three field-to-challenge and mentoring mappings, queue/camera cancellation on field change, real canvas orbit through buttons/keyboard/pointer, reduced-motion idle stability, desktop/mobile widths, vertical touch scrolling, WebGL fallback, and local-only asset loading.
- State: three independent challenge paths, legal/blocked movement, exact goal condition, immutable state, history/undo, gap/bridge and initialization isolation.
- UI: keyboard/button navigation, all three solutions, bridge interaction, queue ordering/24-command limit/edits, stop/restart/reset/challenge-switch cancellation, local text-safe mentoring preview, camera denial/unavailable/late permission cleanup, mobile geometry, failed asset requests and script errors.
- Edges: actual touch events, reset just before queued goal, overlapping camera requests, active-camera pagehide cleanup, running-program pagehide recovery and fresh-load camera nonactivation.

State expectations were written before core implementation. The runnable no-op product skeleton failed 15 of 28 behavioral checks, establishing a genuine red baseline. Final browser screenshots are reviewed separately for visual correctness; a passing geometry test alone does not establish legibility or artistic fidelity.

- Integration: portfolio CTA identifies the 2026 reinterpretation, enters field selection and starts its chosen challenge, returns to hello-w via the backlink, and retains the contextual full-study mailto.

Onboarding expectations were derived before reading implementation. The original playable page failed 3 of 4 focused entry checks (game gating, field choices and explicit Start); camera nonactivation already passed. The focused Red evidence and source hashes were captured in `/tmp/hello-w-onboarding-red/`. Browser captures remain a visual-review aid, not proof of photographic provenance or physical-device usability.

- Portfolio Meta layout: Workflow integration omits the old EN44 slide, retains all four accordion interactions, uses 25:75 text-to-thumbnail desktop columns and stacks at mobile widths. Its pre-change baseline failed the two requested changes and passed the seven preservation checks (`/tmp/meta-workflow-red/`).

Jump, inline demo, and scroll-header contracts:

```sh
node hello-w-play/tests/jump-state.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/jump-embed.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/header-role.cjs
```

- Jump state: cardinal landing rules across every tile origin, missing bridge traversal, invalid/won no-ops, immutable input, one-action history, undo, and exact-goal detection. A synthetic origin isolates goal landing because the fixed paths have no reachable tile two cells from their goal.
- Jump and embedding: direct playable iframe, permission nonactivation, parent/frame keyboard focus, responsive controls, route cleanup, directional Jump/Space, queued jump interpretation, cancellation, mentoring text input, actual 3D render changes, WebGL-unavailable SVG play, and pointer/keyboard bridge controls after context loss and reset.
- Header role: current committed second morph slot, home scroll visibility, all seven role nouns at 320/390/1280 pixels, navigation separation, comparable type size, return-to-top hiding, and route changes during animation. Browser-clock advancement exercises the existing timers without introducing a separate role timer.

The jump contract tests were drafted in an independent context before logic implementation. A temporary no-op jump API produced four behavioral failures in ten checks; the unchanged page separately failed the missing inline demo and header-role expectations. Focused Red evidence is in `/tmp/hello-w-jump-red/`. Existing test expectations remain unchanged. Visual fidelity is assessed from browser captures, separately from these state and geometry assertions.

The route-during-morph test additionally reproduced a stale animation callback touching cleared state. Its failure record is `/tmp/hello-w-header-lifecycle-red/header-role-results.json`; the same sequence passes after lifecycle cleanup. Header overflow assertions are scoped to the navigation, and resize checks allow the existing morph-slot width transition to settle.

`home-responsive.cjs` verifies the exact home manifesto sentence, one line at 1440/1920 pixels, natural wrapping at 320/390/640 pixels, mobile navigation gutters aligned to the main content, and brand/navigation separation at the top and after scrolling. It also loads and decodes the EN31 image referenced by the Domino page. Run with the same browser environment variables as the other browser tests.

The pre-change baseline failed four of 24 checks: 320px navigation used 16px instead of the main content's 20px gutters, and both wide viewports wrapped the manifesto. Evidence: `/tmp/hello-w-home-responsive-red/home-responsive-results.json`.
