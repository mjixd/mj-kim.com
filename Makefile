.PHONY: test-motion-transition test-domino-carousel

# Serve the repository first; PORTFOLIO_URL defaults to localhost:8789.
# PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE may point to an existing runtime.
test-domino-carousel:
	TEST_BROWSER=chromium node hello-w-play/tests/domino-carousel.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/domino-carousel.cjs

test-motion-transition: test-domino-carousel
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
