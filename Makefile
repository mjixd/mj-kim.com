.PHONY: test-motion-transition test-domino-carousel test-samsung-story test-samsung-workspace

# Serve the repository with HTTP byte-range support for video scrubbing first;
# PORTFOLIO_URL defaults to localhost:8789.
# PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE may point to an existing runtime.
test-domino-carousel:
	TEST_BROWSER=chromium node hello-w-play/tests/domino-carousel.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/domino-carousel.cjs

test-samsung-story:
	TEST_BROWSER=chromium node hello-w-play/tests/samsung-story.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/samsung-story.cjs

test-samsung-workspace:
	TEST_BROWSER=chromium node hello-w-play/tests/samsung-workspace-cards.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/samsung-workspace-cards.cjs

test-motion-transition: test-domino-carousel test-samsung-story test-samsung-workspace
	TEST_BROWSER=chromium node hello-w-play/tests/domino-zoom.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/domino-zoom.cjs
	TEST_BROWSER=chromium node hello-w-play/tests/domino-mobile-resources.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/domino-mobile-resources.cjs
	TEST_BROWSER=chromium node hello-w-play/tests/meta-scroll.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/meta-scroll.cjs
	TEST_BROWSER=chromium node hello-w-play/tests/siri-story.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/siri-story.cjs
	TEST_BROWSER=chromium node hello-w-play/tests/siri-chip.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/siri-chip.cjs
