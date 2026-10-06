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
