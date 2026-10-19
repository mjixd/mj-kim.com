const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:8791/';
const out = process.env.TEST_OUTPUT || '/tmp/portfolio-copy-badges';
const engine = process.env.TEST_BROWSER || 'chromium';
const checks = [];
const check = (name, pass, actual) => checks.push({ name, pass: !!pass, actual });
const normalize = text => text.replace(/\s+/g, ' ').trim();
// Captured rendered titles and section order before the copy/badge change.
const cases = {
  samsung: ['B2B AI Agent & Mobile AI Office', ['From monitoring to on-site control.', 'Every task.One workspace.', 'Complex data, clear decisions, on site', 'Design token validation', 'Define the automation boundary', 'From one-off fixes to shared updates', 'The whole story, 15 slides']],
  'domino-mvp': ['0→1 product and business strategy', ['Background', 'Problem areas to solve', 'Priorities and problem framing', 'Quality at scale', 'Market validation and talent inflow', 'Account-centric product model', 'Users were already building accounts by hand', 'Build alignment through research', 'Keep the structure, or change it', 'Metrics before launch', 'Open the app, see live assets, switch accounts', 'The whole story, 22 slides']],
  meta: ['Remote-work adoption, Manager 1:1 tool', ['Remote-work adoption challenge', 'Planning', 'Design sprint with XFN partners', 'Workflow integration', 'Rooms integration', 'The whole story, 11 slides']],
  line: ['Siri for LINE', ['Siri opens to third-party apps', 'Say it to Siri.Send it with LINE.', 'Before the public release', 'A message startswith your voice.', 'Clear intent. Visible control.', 'One theme, across every state.', 'The whole story, 6 slides']],
  leadership: ['Strategy & organizational leadership', ['Scenario-based alignment', 'Cross-functional delivery', 'Shared product context', 'Knowledge and visibility', 'The whole story, 7 slides']],
};
const dominoBadges = ['1 Discover', '2 Strategy', '3 Delivery', '3 Outcome', '4 Account strategy', '4 Discover', '4 Research', '4 Trade-off', '4 Hypothesis', '5 Delivery', 'Full case study'];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { executablePath: process.env.CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {}) });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '#/');
      const home = page.locator('.strip[href="#/work/samsung"]');
      check(width + ': Samsung homepage title is exact', await home.locator('h3').textContent() === 'B2B AX · AI-readable Systems');
      check(width + ': Samsung homepage description is exact', await home.locator('.ed-sub').textContent() === 'Designing connected B2B workspaces and building AI-readable design systems—turning shared tokens and design rules into verifiable interfaces.');
      for (const [slug, [title, expectedHeadings]] of Object.entries(cases)) {
        await page.goto(base + '#/work/' + slug);
        await page.waitForFunction(title => document.querySelector('main h1')?.textContent.replace(/\s+/g, ' ').trim() === title, title);
        const badges = (await page.locator('main .tag').allTextContents()).map(normalize);
        check(width + ' ' + slug + ': section badges follow Domino-only rule', JSON.stringify(badges) === JSON.stringify(slug === 'domino-mvp' ? dominoBadges : []), badges);
        const headings = (await page.locator('main h2').allTextContents()).map(normalize);
        check(width + ' ' + slug + ': detail headings and their order remain unchanged', JSON.stringify(headings) === JSON.stringify(expectedHeadings), headings);
        if (slug === 'meta') check(width + ': Meta solution title remains without its pill', await page.locator('.solution-intro h2').textContent() === 'Workflow integration' && await page.locator('.solution-intro .tag').count() === 0);
        await page.evaluate(() => document.fonts.ready);
        check(width + ' ' + slug + ': no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      await page.goto(base + '#/about');
      await page.locator('.about-intro').waitFor();
      const intro = (await page.locator('.about-intro p').allTextContents()).join(' ');
      const added = intro.match(/align cross-functional leaders around them,([\s\S]+?)and stay through measurable outcomes/);
      check(width + ': About intro retains agency wording and requested Bay Area location', !!added && /agenc/i.test(added[1]) && /manag|lead|oversee/i.test(added[1]) && intro.includes('across Seoul and the Bay Area.') && !intro.includes('Silicon Valley'), intro);
      const leadership = await page.locator('.row').evaluateAll(rows => rows.find(row => row.querySelector('b')?.textContent.trim() === 'Leadership')?.querySelector('p')?.textContent || '');
      check(width + ': Leadership describes agency team management and direction without metrics', leadership === 'Executive stakeholder alignment, cross-functional influence, and team building. Managing agency teams and directing their design work.', leadership);
      const about = await page.locator('main').evaluate(main => {
        const headings = [...main.querySelectorAll('h2')];
        const rows = [...main.querySelectorAll('.row')];
        const ai = rows.find(row => row.querySelector('b')?.textContent === 'My input')?.closest('.rows');
        const sequence = [...main.querySelectorAll('h2,.rows')];
        const experienceIndex = sequence.findIndex(node => node.tagName === 'H2' && node.textContent === 'Experience');
        const howIndex = sequence.findIndex(node => node.tagName === 'H2' && node.textContent === 'How I work');
        const capabilitiesIndex = sequence.findIndex(node => node.tagName === 'H2' && node.textContent === 'Capabilities');
        return {
          headings: headings.map(node => node.textContent),
          headingSizes: headings.map(node => parseFloat(getComputedStyle(node).fontSize)),
          visible: headings.every(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden'),
          aiLabels: ai ? [...ai.querySelectorAll('.row b')].map(node => node.textContent) : [],
          afterExperience: !!ai && howIndex === experienceIndex + 2 && sequence.indexOf(ai) === howIndex + 1 && capabilitiesIndex === sequence.indexOf(ai) + 1,
          rows: rows.map(row => row.textContent.replace(/\s+/g, ' ').trim()).sort(),
        };
      });
      check(width + ': About group headings are smaller in requested order while manifesto is unchanged', about.visible && JSON.stringify(about.headings) === JSON.stringify(['The role doesn’t have a name yet', 'Experience', 'How I work', 'Capabilities', 'Education']) && about.headingSizes[0] === (width === 1440 ? 32 : 22) && about.headingSizes.slice(1).every(size => size >= 18 && size <= 22 && size < about.headingSizes[0]), { headings: about.headings, sizes: about.headingSizes });
      check(width + ': AI group is directly after Experience and before Capabilities', about.afterExperience && JSON.stringify(about.aiLabels) === JSON.stringify(['My input', 'AI contribution', 'Tools & tokens']), about.aiLabels);
      // All 14 rows stay exact, including the user-approved replacement tool list.
      const aboutRowsHash = crypto.createHash('sha256').update(JSON.stringify(about.rows)).digest('hex');
      check(width + ': About rows preserved exactly without duplication', about.rows.length === 14 && about.rows.includes('Tools & tokensFigma · Figma MCP · ChatGPT Codex · Claude Code · Git · Tokens Studio · Playwright') && aboutRowsHash === 'b418bebd1473b2a7ab585d1c2044689f6072428983b633a5c0714a510512288e', aboutRowsHash);
      await page.evaluate(() => document.fonts.ready);
      check(width + ': About has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(out, 'about-' + width + '.png'), fullPage: true });
      check(width + ': About full-case-study badge remains', await page.locator('.note .tag').textContent() === 'Full case studies');
      check(width + ': no runtime errors', errors.length === 0, errors);
      await page.close();
    }
  } finally { await browser.close(); }
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../../index.html'))).digest('hex');
  const failures = checks.filter(check => !check.pass);
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ engine, sourceHash, checks, failures }, null, 2));
  console.log(`${checks.length} checks, ${failures.length} failures`, failures);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
