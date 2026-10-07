const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const target = process.argv[2] || path.resolve(__dirname, '../game.js');
const G = require(target);
const out = process.env.TEST_OUTPUT || path.join(require('os').tmpdir(), 'hello-w-tests');
const checks = [];
function test(name, fn) { try { fn(); checks.push({name, pass:true}); } catch (e) { checks.push({name, pass:false, error:e.message}); } }
const snapshot = s => JSON.parse(JSON.stringify(s));
const walk = (s, moves) => moves.reduce((s,d) => G.move(s,d),s);
const tiles = [ [[0,4],[1,4],[1,3],[2,3],[2,2],[3,2],[3,1],[4,1],[4,0]], [[0,4],[0,3],[1,3],[2,3],[2,1],[3,1],[4,1],[4,0]], [[0,4],[1,4],[1,3],[2,3],[2,2],[3,2],[3,1],[4,1],[4,0]] ];
const directions = {N:[0,-2],E:[2,0],S:[0,2],W:[-2,0]};
test('jump API available', () => assert.equal(typeof G.jump, 'function'));
if (typeof G.jump === 'function') {
  for (let level=0; level<3; level++) for (const bridge of [false,true]) {
    test(`level ${level}, bridge ${bridge}: all tile origins and four cardinal landings`, () => {
      const origins = [...tiles[level], ...(level===1 && bridge ? [[2,2]] : [])];
      for (const origin of origins) for (const [direction,delta] of Object.entries(directions)) {
        const state = {...G.createState(level), bridge, position:[...origin]};
        const before = snapshot(state), landing = origin.map((n,i)=>n+delta[i]);
        const valid = origins.some(p=>p[0]===landing[0] && p[1]===landing[1]);
        const result = G.jump(state,direction);
        assert.deepEqual(state,before,'input mutation');
        if (!valid) { assert.deepEqual(result,before,`${origin} ${direction} invalid`); continue; }
        assert.deepEqual(result.position,landing,`${origin} ${direction} valid landing`);
        assert.equal(result.steps,1); assert.equal(result.history.length,1);
        assert.equal(result.bridge,bridge);
        assert.equal(result.won,landing[0]===4 && landing[1]===0);
        assert.deepEqual(G.undo(result),before,'one undo reverses the whole jump');
      }
    });
  }
  test('missing bridge is skipped in one action; undo returns across gap', () => {
    const before = walk(G.createState(1),['N','E','E']);
    const after = G.jump(before,'N');
    assert.deepEqual(after.position,[2,1]); assert.equal(after.steps,4);
    assert.equal(after.history.length,4); assert.equal(after.bridge,false);
    assert.deepEqual(G.undo(after),before);
    assert.deepEqual(G.jump(after,'S').position,[2,3]);
  });
  test('invalid directions and completed game are immutable no-ops', () => {
    const ordinary = walk(G.createState(1),['N','E','E']);
    const won = {...ordinary, won:true};
    for (const state of [ordinary,won]) for (const d of ['bad','',null,undefined,'NE']) assert.deepEqual(G.jump(state,d),state);
    const wonBefore = snapshot(won);
    for (const d of Object.keys(directions)) { assert.deepEqual(G.jump(won,d),wonBefore); assert.deepEqual(won,wonBefore); }
  });
  test('goal uses both exact coordinates, and can be reached by jump', () => {
    // Synthetic origin isolates the landing rule; the current fixed path does not approach the goal two cells away.
    const before = {...G.createState(0),position:[4,2]};
    const won = G.jump(before,'N');
    assert.deepEqual(won.position,[4,0]); assert.equal(won.won,true);
    assert.deepEqual(G.undo(won),before);
    const near = G.jump({...G.createState(1),position:[2,1]},'E');
    assert.deepEqual(near.position,[4,1]); assert.equal(near.won,false);
  });
}
fs.mkdirSync(out,{recursive:true});
const result={target, sourceHash:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),checks,failures:checks.filter(c=>!c.pass)};
fs.writeFileSync(path.join(out,'jump-state-results.json'),JSON.stringify(result,null,2));
console.log(`${checks.length} checks, ${result.failures.length} failures`);
for (const check of result.failures) console.log(check.name+': '+check.error);
if(result.failures.length)process.exitCode=1;
