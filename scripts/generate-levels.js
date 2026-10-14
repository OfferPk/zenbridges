/**
 * Level Generator & Solver Verifier for ZenBridges
 * Generates 50 solver-verified levels across 5 thematic packs.
 */

const fs = require('fs');
const path = require('path');
const { BridgesEngine, HashiSolver } = require('../src/bridges-engine.js');

function createRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateLevel(id, packName, width, height, targetIslands, rng) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const islands = [];
    const islandGrid = Array.from({ length: height }, () => Array(width).fill(null));
    const bridges = new Map(); // key -> count

    function getEdgeKey(u, v) {
      return u < v ? `${u}-${v}` : `${v}-${u}`;
    }

    // Place initial island
    const startX = Math.floor(rng() * (width - 2)) + 1;
    const startY = Math.floor(rng() * (height - 2)) + 1;
    const startIsland = { id: 0, x: startX, y: startY };
    islands.push(startIsland);
    islandGrid[startY][startX] = startIsland;

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];

    // Grow islands
    while (islands.length < targetIslands) {
      let added = false;
      // Shuffle islands to pick from
      const order = [...Array(islands.length).keys()].sort(() => rng() - 0.5);

      for (const idx of order) {
        const u = islands[idx];
        const shuffledDirs = [...dirs].sort(() => rng() - 0.5);

        for (const dir of shuffledDirs) {
          // Choose distance 2 to 4
          const maxDist = Math.max(width, height);
          for (let dist = 2; dist <= Math.min(4, maxDist); dist++) {
            const nx = u.x + dir.dx * dist;
            const ny = u.y + dir.dy * dist;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !islandGrid[ny][nx]) {
              // Check path is clear of other islands
              let clear = true;
              for (let step = 1; step <= dist; step++) {
                const px = u.x + dir.dx * step;
                const py = u.y + dir.dy * step;
                if (step < dist && islandGrid[py][px]) {
                  clear = false;
                  break;
                }
              }

              if (!clear) continue;

              // Check crossing with existing bridges
              const newEdge = {
                x1: u.x, y1: u.y,
                x2: nx, y2: ny,
                orientation: dir.dx !== 0 ? 'horizontal' : 'vertical'
              };

              let crosses = false;
              for (const [key, cnt] of bridges.entries()) {
                if (cnt === 0) continue;
                const [su, sv] = key.split('-').map(Number);
                const iu = islands[su];
                const iv = islands[sv];
                const existEdge = {
                  x1: iu.x, y1: iu.y,
                  x2: iv.x, y2: iv.y,
                  orientation: iu.y === iv.y ? 'horizontal' : 'vertical'
                };
                if (BridgesEngine.doEdgesCross(newEdge, existEdge)) {
                  crosses = true;
                  break;
                }
              }

              if (crosses) continue;

              // Place new island!
              const newIsland = { id: islands.length, x: nx, y: ny };
              islands.push(newIsland);
              islandGrid[ny][nx] = newIsland;

              // Add 1 or 2 bridges
              const bridgeCount = rng() > 0.55 ? 2 : 1;
              bridges.set(getEdgeKey(u.id, newIsland.id), bridgeCount);
              added = true;
              break;
            }
          }
          if (added) break;
        }
        if (added) break;
      }

      if (!added) break; // Could not grow further in this attempt
    }

    if (islands.length < targetIslands) continue;

    // Try adding a few extra cross-connecting bridges to make it an interesting puzzle
    const extraTries = 4;
    for (let t = 0; t < extraTries; t++) {
      const i = Math.floor(rng() * islands.length);
      const j = Math.floor(rng() * islands.length);
      if (i === j) continue;
      const u = islands[i];
      const v = islands[j];

      if (u.x === v.x || u.y === v.y) {
        const key = getEdgeKey(u.id, v.id);
        if (bridges.has(key) && bridges.get(key) >= 2) continue;

        // Check if path is clear of islands between u and v
        let clear = true;
        const dx = Math.sign(v.x - u.x);
        const dy = Math.sign(v.y - u.y);
        let cx = u.x + dx;
        let cy = u.y + dy;
        while (cx !== v.x || cy !== v.y) {
          if (islandGrid[cy][cx]) {
            clear = false;
            break;
          }
          cx += dx;
          cy += dy;
        }

        if (!clear) continue;

        const candEdge = {
          x1: u.x, y1: u.y,
          x2: v.x, y2: v.y,
          orientation: u.y === v.y ? 'horizontal' : 'vertical'
        };

        let crosses = false;
        for (const [bKey, cnt] of bridges.entries()) {
          if (cnt === 0 || bKey === key) continue;
          const [su, sv] = bKey.split('-').map(Number);
          const iu = islands[su];
          const iv = islands[sv];
          const existEdge = {
            x1: iu.x, y1: iu.y,
            x2: iv.x, y2: iv.y,
            orientation: iu.y === iv.y ? 'horizontal' : 'vertical'
          };
          if (BridgesEngine.doEdgesCross(candEdge, existEdge)) {
            crosses = true;
            break;
          }
        }

        if (!crosses) {
          const currentCount = bridges.get(key) || 0;
          if (currentCount < 2) {
            bridges.set(key, currentCount + 1);
          }
        }
      }
    }

    // Calculate required degrees
    const degrees = new Map();
    for (const island of islands) degrees.set(island.id, 0);
    for (const [key, cnt] of bridges.entries()) {
      if (cnt > 0) {
        const [su, sv] = key.split('-').map(Number);
        degrees.set(su, degrees.get(su) + cnt);
        degrees.set(sv, degrees.get(sv) + cnt);
      }
    }

    // Set requirements
    for (const island of islands) {
      island.required = degrees.get(island.id);
    }

    // Every island must have required > 0
    if (islands.some(isl => isl.required === 0)) continue;

    // Verify with solver
    const levelData = {
      id,
      name: `Level ${id}`,
      pack: packName,
      width,
      height,
      islands
    };

    const solution = HashiSolver.solve(levelData);
    if (!solution) continue;

    // Level is 100% solver-verified!
    return levelData;
  }

  throw new Error(`Failed to generate level ${id} after max attempts`);
}

function generateAllLevels() {
  const packs = [
    { name: 'Archipelago', start: 1, count: 10, width: 5, height: 5, islands: 5 },
    { name: 'Serene Waters', start: 11, count: 10, width: 6, height: 6, islands: 7 },
    { name: 'Coral Reef', start: 21, count: 10, width: 7, height: 7, islands: 9 },
    { name: 'Mystic Atolls', start: 31, count: 10, width: 8, height: 8, islands: 11 },
    { name: 'Celestial Ocean', start: 41, count: 10, width: 9, height: 9, islands: 14 }
  ];

  const rng = createRng(42819);
  const allLevels = [];

  for (const pack of packs) {
    console.log(`Generating pack: ${pack.name}...`);
    for (let i = 0; i < pack.count; i++) {
      const id = pack.start + i;
      // Slight variation in island count
      const islCount = pack.islands + (i % 3);
      const level = generateLevel(id, pack.name, pack.width, pack.height, islCount, rng);
      allLevels.push(level);
    }
  }

  return allLevels;
}

const levels = generateAllLevels();
console.log(`Successfully generated and solver-verified ${levels.length} levels!`);

const outputCode = `/**
 * ZenBridges - 50 Solver-Verified Levels Across 5 Thematic Packs
 * Generated and validated by HashiSolver
 */

const ZEN_BRIDGES_LEVELS = ${JSON.stringify(levels, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ZEN_BRIDGES_LEVELS };
}
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'levels.js'), outputCode, 'utf8');
console.log('Saved to src/levels.js');
