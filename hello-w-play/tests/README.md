# hello,w regression checks

Run the state tests with Node:

```sh
node hello-w-play/tests/state.cjs
```

Serve the repository root over HTTP, then run the UI and lifecycle checks against the standalone page:

```sh
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/game-ui.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/game-edges.cjs
GAME_URL=http://127.0.0.1:8789/hello-w-play/ node hello-w-play/tests/integration.cjs
```

Browser tests use an existing `playwright` module and its installed Chromium by default. If the dependencies live elsewhere, set `PLAYWRIGHT_MODULE` to the module path and `CHROMIUM_EXECUTABLE` to the browser executable. These tests do not install dependencies or start a server. `TEST_OUTPUT` optionally overrides the default `hello-w-tests` directory under the operating system’s temporary directory.

Every failed assertion gives a nonzero exit status. Results and screenshots are written to the output directory. Tests never request a real camera: `camera-mock.cjs` provides permission denial, deferred permission, stream lifetime and media playback fixtures. Question preview tests verify local-only behavior; no email is sent.

Coverage:

- State: three independent challenge paths, legal/blocked movement, exact goal condition, immutable state, history/undo, gap/bridge and initialization isolation.
- UI: keyboard/button navigation, all three solutions, bridge interaction, queue ordering/24-command limit/edits, stop/restart/reset/challenge-switch cancellation, local text-safe mentoring preview, camera denial/unavailable/late permission cleanup, mobile geometry, failed asset requests and script errors.
- Edges: actual touch events, reset just before queued goal, overlapping camera requests, active-camera pagehide cleanup, running-program pagehide recovery and fresh-load camera nonactivation.

State expectations were written before core implementation. The runnable no-op product skeleton failed15 of28 behavioral checks, establishing a genuine red baseline. Final browser screenshots are reviewed separately for visual correctness; a passing geometry test alone does not establish legibility or artistic fidelity.

- Integration: portfolio CTA identifies the2026 reinterpretation, enters the actual game, returns to hello-w via the backlink, and retains the contextual full-study mailto.
