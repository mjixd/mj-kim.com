// Stream the real HTML in stages: no injected application state or timer oracle.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const pwPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const pw = require(pwPath);
const { PNG } = require(require.resolve('pngjs', { paths: [path.dirname(require.resolve(pwPath))] }));
const engine = process.env.TEST_BROWSER || 'chromium';
const upstream = new URL(process.env.PORTFOLIO_URL || 'http://127.0.0.1:8794/');
const out = process.env.TEST_OUTPUT || '/tmp/tokenproof-loading';
const checks = [], errors = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
async function streamingServer() {
  const requested = deferred(), prefix = deferred(), rest = deferred();
  const html = fs.readFileSync(path.resolve(__dirname, '../../tokenproof/index.html'), 'utf8');
  const cut = html.indexOf('<script>') + '<script>'.length;
  if (cut < 8 || !html.slice(0, cut).includes('id="liveFrame"')) throw Error('No executable loading boundary after preview markup');
  const server = http.createServer(async (req, res) => {
    if (req.url.split('?')[0] === '/tokenproof/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.flushHeaders(); requested.resolve();
      await prefix.promise; res.write(html.slice(0, cut));
      await rest.promise; res.end(html.slice(cut));
    } else {
      const proxy = http.request(new URL(req.url, upstream), { method: req.method, headers: { ...req.headers, host: upstream.host } }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
      proxy.on('error', error => { res.writeHead(502); res.end(error.message); }); req.pipe(proxy);
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + server.address().port + '/', requested, prefix, rest, close: async () => { prefix.resolve(); rest.resolve(); server.closeAllConnections(); await new Promise(r => server.close(r)); } };
}
async function pixelSample(page, frame, innerSelector, name) {
  const geometry = await frame.evaluate(selector => {
    const host = window.frameElement, node = selector ? document.querySelector(selector) : document.documentElement;
    const inner = selector ? node.getBoundingClientRect() : { left: 0, top: 0, width: host.clientWidth, height: host.clientHeight };
    parent.scrollBy({ top: host.getBoundingClientRect().top + inner.top - 100, behavior: 'instant' });
    const outer = host.getBoundingClientRect();
    return { x: Math.max(0, outer.left + inner.left), y: Math.max(0, outer.top + inner.top), width: Math.min(inner.width, parent.innerWidth - Math.max(0, outer.left + inner.left)), height: Math.min(inner.height, parent.innerHeight - Math.max(0, outer.top + inner.top) - 1) };
  }, innerSelector);
  await page.waitForTimeout(150);
  const buffer = await page.screenshot({ clip: geometry, path: path.join(out, name + '.png') });
  const png = PNG.sync.read(buffer); let white = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] > 245 && png.data[i + 1] > 245 && png.data[i + 2] > 245) white++;
  return { whiteFraction: white / (png.width * png.height), width: png.width, height: png.height };
}
async function ready(frame) {
  await frame.waitForFunction(() => /^\d+$/.test(document.querySelector('#score')?.textContent || '') && !document.querySelector('#analyze')?.disabled && !!document.querySelector('#liveFrame')?.contentDocument?.querySelector('.metric-card'));
}
async function clickControl(page, frame, selector) {
  await frame.locator('#toast').waitFor({ state: 'hidden' });
  const point = await frame.locator(selector).evaluate(node => {
    const host = window.frameElement, rect = node.getBoundingClientRect();
    parent.scrollBy({ top: host.getBoundingClientRect().top + rect.top + rect.height / 2 - parent.innerHeight / 2, behavior: 'instant' });
    const outer = host.getBoundingClientRect(), current = node.getBoundingClientRect();
    return { x: outer.left + current.left + current.width / 2, y: outer.top + current.top + current.height / 2 };
  });
  await page.mouse.click(point.x, point.y);
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const executablePath = process.env[engine.toUpperCase() + '_EXECUTABLE'];
  const browser = await pw[engine].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const width of [1440,390]) {
      const stream = await streamingServer(), page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(stream.url + '#/work/samsung', { waitUntil: 'domcontentloaded' });
        const surface = page.locator('[data-samsung-governance] iframe');
        await surface.scrollIntoViewIfNeeded(); await stream.requested.promise;
        const frame = await (await surface.elementHandle()).contentFrame();
        const initial = await pixelSample(page, frame, null, width + '-waiting-document');
        check(width + ': pending document exposes no white rectangle', initial.whiteFraction < .05, initial);
        stream.prefix.resolve();
        await frame.locator('#liveFrame').waitFor({ state: 'attached' });
        const pending = await pixelSample(page, frame, '#liveFrame', width + '-waiting-preview');
        check(width + ': streamed empty preview exposes no white rectangle', pending.whiteFraction < .05, pending);
        stream.rest.resolve(); await ready(frame);
        const radius = () => frame.frameLocator('#liveFrame').locator('.metric-card').first().evaluate(node => getComputedStyle(node).borderRadius);
        const baselineRadius = await radius(), baselineScore = Number(await frame.locator('#score').textContent());
        await frame.locator('#token-2').selectOption('radius/large');
        await frame.waitForFunction(() => document.querySelector('#tokenEvidence').textContent.includes('radius/large')); await ready(frame);
        check(width + ': loaded token control changes rendered preview', await radius() === '24px' && baselineRadius !== '24px' && Number(await frame.locator('#score').textContent()) < baselineScore, { radius: await radius(), baselineRadius });
        await clickControl(page, frame, '#restore');
        await frame.waitForFunction(() => document.querySelector('#tokenEvidence').textContent.includes('Baseline restored')); await ready(frame);
        await clickControl(page, frame, '#analyze'); await ready(frame);
        check(width + ': restore and subsequent QA retain working visible preview', await radius() === baselineRadius && Number(await frame.locator('#score').textContent()) === baselineScore && await frame.locator('#liveFrame').evaluate(node => getComputedStyle(node).visibility !== 'hidden' && +getComputedStyle(node).opacity > .99), { radius: await radius(), score: await frame.locator('#score').textContent() });
        const loaded = await pixelSample(page, frame, '#liveFrame', width + '-ready-preview');
        check(width + ': ready preview is visibly rendered', loaded.whiteFraction < .05, loaded);
      } finally { await page.close(); await stream.close(); }
    }
    check('no uncaught browser errors', errors.length === 0, errors);
  } finally { await browser.close(); }
  const hashes = Object.fromEntries(['samsung-governance.js','samsung-governance.css','tokenproof/index.html','tokenproof/public.css','hello-w-play/tests/tokenproof-loading.cjs'].map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', f))).digest('hex')]));
  const failures = checks.filter(c => !c.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, hashes, checks, failures }, null, 2));
  console.log(checks.length + ' checks, ' + failures.length + ' failures', failures.map(c => c.name));
  if (failures.length) process.exitCode = 1;
})().catch(error => { fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ checks, errors, error: error.message }, null, 2)); console.error(error); process.exitCode = 1; });
