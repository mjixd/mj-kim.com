.PHONY: test-motion-transition

# Serve the repository first; PORTFOLIO_URL defaults to localhost:8789.
# PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE may point to an existing runtime.
test-motion-transition:
	TEST_BROWSER=chromium node hello-w-play/tests/domino-zoom.cjs
	TEST_BROWSER=webkit node hello-w-play/tests/domino-zoom.cjs
