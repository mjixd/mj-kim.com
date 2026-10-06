(function (root) {
  'use strict';
  const LEVELS = [
    {tiles:[[0,4],[1,4],[1,3],[2,3],[2,2],[3,2],[3,1],[4,1],[4,0]],start:[0,4],goal:[4,0]},
    {tiles:[[0,4],[0,3],[1,3],[2,3],[2,1],[3,1],[4,1],[4,0]],gap:[2,2],start:[0,4],goal:[4,0]},
    {tiles:[[0,4],[1,4],[1,3],[2,3],[2,2],[3,2],[3,1],[4,1],[4,0]],start:[0,4],goal:[4,0]}
  ];
  function createState(level) { return {level,position:[...LEVELS[level].start],steps:0,history:[],bridge:false,won:false}; }
  const DELTAS = {N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
  function move(state, direction) {
    const delta = DELTAS[direction];
    if (!delta || state.won) return state;
    const [x,y] = state.position.map((n,i) => n + delta[i]);
    if (!isWalkable(state,x,y)) return state;
    const goal = LEVELS[state.level].goal;
    return {...state,position:[x,y],steps:state.steps+1,
      history:[...state.history,{position:[...state.position],steps:state.steps,won:state.won}],
      won:x===goal[0] && y===goal[1]};
  }
  function undo(state) {
    if (!state.history.length) return state;
    return {...state,...state.history[state.history.length-1],history:state.history.slice(0,-1)};
  }
  function buildBridge(state) {
    return state.level === 1 && !state.won ? {...state,bridge:true} : state;
  }
  function isWalkable(state,x,y) {
    const level = LEVELS[state.level];
    return level.tiles.some(p => p[0]===x && p[1]===y) ||
      Boolean(state.bridge && level.gap && level.gap[0]===x && level.gap[1]===y);
  }
  const api = {LEVELS,createState,move,undo,buildBridge,isWalkable};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HelloWGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
