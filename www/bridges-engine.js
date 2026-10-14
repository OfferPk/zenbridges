/**
 * ZenBridges - Core Hashiwokakero (Bridges) Logic Engine
 * Pure vanilla JavaScript - zero external dependencies.
 * Usable both in browser and Node.js test runners.
 */

class BridgesEngine {
  constructor(level) {
    if (!level || !level.islands) {
      throw new Error('Invalid level data provided to BridgesEngine');
    }

    this.id = level.id || 1;
    this.name = level.name || `Level ${this.id}`;
    this.width = level.width || 7;
    this.height = level.height || 7;
    this.pack = level.pack || 'Archipelago';

    // Deep clone islands: [{ id, x, y, required }]
    this.islands = level.islands.map((island, index) => ({
      id: island.id !== undefined ? island.id : index,
      x: island.x,
      y: island.y,
      required: island.required
    }));

    // Island lookup by ID and by coordinates
    this.islandMap = new Map();
    this.coordMap = new Map();
    for (const island of this.islands) {
      this.islandMap.set(island.id, island);
      this.coordMap.set(`${island.x},${island.y}`, island);
    }

    // Compute potential orthogonal edges between direct visible island neighbors
    this.potentialEdges = this._computePotentialEdges();
    this.edgeMap = new Map();
    for (const edge of this.potentialEdges) {
      this.edgeMap.set(edge.key, edge);
    }

    // Precompute crossing conflicts between edges
    this.crossingConflicts = this._computeCrossingConflicts();

    // Bridge state: edgeKey -> count (0, 1, or 2)
    this.bridges = new Map();
    for (const edge of this.potentialEdges) {
      this.bridges.set(edge.key, 0);
    }

    // Undo history stack
    this.history = [];
    this.moveCount = 0;
  }

  static getEdgeKey(u, v) {
    const min = Math.min(u, v);
    const max = Math.max(u, v);
    return `${min}-${max}`;
  }

  _computePotentialEdges() {
    const edges = [];
    const n = this.islands.length;

    for (let i = 0; i < n; i++) {
      const u = this.islands[i];

      // Check horizontal neighbor to the right (East)
      let rightNeighbor = null;
      let minXDiff = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const v = this.islands[j];
        if (v.y === u.y && v.x > u.x) {
          const diff = v.x - u.x;
          if (diff < minXDiff) {
            minXDiff = diff;
            rightNeighbor = v;
          }
        }
      }

      if (rightNeighbor) {
        const key = BridgesEngine.getEdgeKey(u.id, rightNeighbor.id);
        edges.push({
          key,
          u: u.id,
          v: rightNeighbor.id,
          orientation: 'horizontal',
          x1: u.x,
          y1: u.y,
          x2: rightNeighbor.x,
          y2: rightNeighbor.y
        });
      }

      // Check vertical neighbor downwards (South)
      let downNeighbor = null;
      let minYDiff = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const v = this.islands[j];
        if (v.x === u.x && v.y > u.y) {
          const diff = v.y - u.y;
          if (diff < minYDiff) {
            minYDiff = diff;
            downNeighbor = v;
          }
        }
      }

      if (downNeighbor) {
        const key = BridgesEngine.getEdgeKey(u.id, downNeighbor.id);
        edges.push({
          key,
          u: u.id,
          v: downNeighbor.id,
          orientation: 'vertical',
          x1: u.x,
          y1: u.y,
          x2: downNeighbor.x,
          y2: downNeighbor.y
        });
      }
    }

    return edges;
  }

  _computeCrossingConflicts() {
    // Map each edgeKey to a set of conflicting edgeKeys
    const conflicts = new Map();
    for (const e of this.potentialEdges) {
      conflicts.set(e.key, new Set());
    }

    const n = this.potentialEdges.length;
    for (let i = 0; i < n; i++) {
      const e1 = this.potentialEdges[i];
      for (let j = i + 1; j < n; j++) {
        const e2 = this.potentialEdges[j];
        if (BridgesEngine.doEdgesCross(e1, e2)) {
          conflicts.get(e1.key).add(e2.key);
          conflicts.get(e2.key).add(e1.key);
        }
      }
    }

    return conflicts;
  }

  static doEdgesCross(e1, e2) {
    if (e1.orientation === e2.orientation) return false;

    const horiz = e1.orientation === 'horizontal' ? e1 : e2;
    const vert = e1.orientation === 'vertical' ? e1 : e2;

    const hX1 = Math.min(horiz.x1, horiz.x2);
    const hX2 = Math.max(horiz.x1, horiz.x2);
    const hY = horiz.y1;

    const vY1 = Math.min(vert.y1, vert.y2);
    const vY2 = Math.max(vert.y1, vert.y2);
    const vX = vert.x1;

    // Strict intersection of open segments
    return hX1 < vX && vX < hX2 && vY1 < hY && hY < vY2;
  }

  getBridgeCount(u, v) {
    const key = BridgesEngine.getEdgeKey(u, v);
    return this.bridges.get(key) || 0;
  }

  getCrossingEdge(u, v) {
    const key = BridgesEngine.getEdgeKey(u, v);
    const conflictSet = this.crossingConflicts.get(key);
    if (!conflictSet) return null;

    for (const conflictKey of conflictSet) {
      if ((this.bridges.get(conflictKey) || 0) > 0) {
        return this.edgeMap.get(conflictKey);
      }
    }
    return null;
  }

  cycleBridge(u, v) {
    const key = BridgesEngine.getEdgeKey(u, v);
    if (!this.edgeMap.has(key)) {
      return { success: false, reason: 'no_edge', key };
    }

    const current = this.bridges.get(key) || 0;
    const next = (current + 1) % 3; // 0 -> 1 -> 2 -> 0

    if (next > 0) {
      const crossing = this.getCrossingEdge(u, v);
      if (crossing) {
        return {
          success: false,
          reason: 'crossing_conflict',
          conflictingEdge: crossing
        };
      }
    }

    // Save previous state for undo
    this.history.push({
      key,
      prevCount: current,
      newCount: next
    });

    this.bridges.set(key, next);
    this.moveCount++;

    return {
      success: true,
      key,
      count: next,
      previousCount: current,
      islandU: this.getIslandStatus(u),
      islandV: this.getIslandStatus(v),
      isComplete: this.isLevelComplete()
    };
  }

  setBridgeCount(u, v, count) {
    if (count < 0 || count > 2) {
      throw new Error(`Invalid bridge count ${count}. Must be 0, 1, or 2.`);
    }
    const key = BridgesEngine.getEdgeKey(u, v);
    if (!this.edgeMap.has(key)) {
      return false;
    }

    if (count > 0) {
      const crossing = this.getCrossingEdge(u, v);
      if (crossing) {
        return false;
      }
    }

    const current = this.bridges.get(key) || 0;
    if (current === count) return true;

    this.history.push({
      key,
      prevCount: current,
      newCount: count
    });

    this.bridges.set(key, count);
    this.moveCount++;
    return true;
  }

  undo() {
    if (this.history.length === 0) return null;

    const action = this.history.pop();
    this.bridges.set(action.key, action.prevCount);
    this.moveCount = Math.max(0, this.moveCount - 1);

    const edge = this.edgeMap.get(action.key);
    return {
      key: action.key,
      count: action.prevCount,
      islandU: this.getIslandStatus(edge.u),
      islandV: this.getIslandStatus(edge.v),
      isComplete: this.isLevelComplete()
    };
  }

  reset() {
    if (this.history.length === 0) return;

    // Record snapshot in history to allow undoing a reset
    const snapshot = new Map(this.bridges);
    this.history.push({
      isReset: true,
      snapshot,
      prevMoveCount: this.moveCount
    });

    for (const key of this.bridges.keys()) {
      this.bridges.set(key, 0);
    }
    this.moveCount = 0;
  }

  getIslandCurrentDegree(islandId) {
    let sum = 0;
    for (const edge of this.potentialEdges) {
      if (edge.u === islandId || edge.v === islandId) {
        sum += this.bridges.get(edge.key) || 0;
      }
    }
    return sum;
  }

  getIslandStatus(islandId) {
    const island = this.islandMap.get(islandId);
    if (!island) return null;

    const current = this.getIslandCurrentDegree(islandId);
    const required = island.required;

    let status = 'under';
    if (current === required) {
      status = 'satisfied';
    } else if (current > required) {
      status = 'over';
    }

    return {
      id: islandId,
      x: island.x,
      y: island.y,
      current,
      required,
      status
    };
  }

  isGraphConnected() {
    if (this.islands.length === 0) return true;

    // Check if every island is connected in a single connected graph using active bridges (count > 0)
    const visited = new Set();
    const queue = [this.islands[0].id];
    visited.add(this.islands[0].id);

    // Build adjacency list for active bridges
    const adj = new Map();
    for (const island of this.islands) {
      adj.set(island.id, []);
    }

    for (const edge of this.potentialEdges) {
      const count = this.bridges.get(edge.key) || 0;
      if (count > 0) {
        adj.get(edge.u).push(edge.v);
        adj.get(edge.v).push(edge.u);
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = adj.get(curr) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    return visited.size === this.islands.length;
  }

  isLevelComplete() {
    // 1. Every island must be satisfied (current === required)
    for (const island of this.islands) {
      const current = this.getIslandCurrentDegree(island.id);
      if (current !== island.required) {
        return false;
      }
    }

    // 2. All islands must form a single connected component
    if (!this.isGraphConnected()) {
      return false;
    }

    return true;
  }

  getHint() {
    // 1. Check for mistakes: any island over-capacity or any crossing conflict
    for (const island of this.islands) {
      const current = this.getIslandCurrentDegree(island.id);
      if (current > island.required) {
        return {
          type: 'error',
          islandId: island.id,
          message: `Island at (${island.x}, ${island.y}) has too many bridges (${current}/${island.required}). Try reducing some.`
        };
      }
    }

    // 2. Hashi Deductive Logic:
    // Check if any island has required bridges equal to total remaining capacity of unblocked neighbors
    for (const island of this.islands) {
      const current = this.getIslandCurrentDegree(island.id);
      const remainingNeeded = island.required - current;
      if (remainingNeeded <= 0) continue;

      // Find all neighbors and calculate maximum bridges each neighbor can still accept
      const availableEdges = [];
      let totalCapacity = 0;

      for (const edge of this.potentialEdges) {
        if (edge.u === island.id || edge.v === island.id) {
          const neighborId = edge.u === island.id ? edge.v : edge.u;
          const neighbor = this.islandMap.get(neighborId);
          const neighborCurrent = this.getIslandCurrentDegree(neighborId);
          const neighborRemaining = neighbor.required - neighborCurrent;

          const currentBridgeCount = this.bridges.get(edge.key) || 0;
          const crossing = this.getCrossingEdge(edge.u, edge.v);

          if (!crossing && neighborRemaining > 0 && currentBridgeCount < 2) {
            const edgeCapacity = Math.min(2 - currentBridgeCount, neighborRemaining);
            if (edgeCapacity > 0) {
              availableEdges.push({ edge, capacity: edgeCapacity, currentCount: currentBridgeCount, neighborId });
              totalCapacity += edgeCapacity;
            }
          }
        }
      }

      // If total available capacity equals remaining needed, every available edge MUST be used to its max capacity!
      if (totalCapacity === remainingNeeded && availableEdges.length > 0) {
        const target = availableEdges[0];
        return {
          type: 'deduction',
          key: target.edge.key,
          u: target.edge.u,
          v: target.edge.v,
          message: `Island ${island.id} needs ${remainingNeeded} more bridge(s), and its neighbors have exactly that much capacity.`
        };
      }
    }

    // 3. Fallback to solver solution if available
    const solution = HashiSolver.solve(this);
    if (solution) {
      for (const [key, solCount] of solution.entries()) {
        const currCount = this.bridges.get(key) || 0;
        if (currCount < solCount) {
          const edge = this.edgeMap.get(key);
          const crossing = this.getCrossingEdge(edge.u, edge.v);
          if (!crossing) {
            return {
              type: 'solution_step',
              key,
              u: edge.u,
              v: edge.v,
              suggestedCount: solCount,
              message: `Try connecting Island ${edge.u} and Island ${edge.v}.`
            };
          }
        } else if (currCount > solCount) {
          const edge = this.edgeMap.get(key);
          return {
            type: 'solution_remove',
            key,
            u: edge.u,
            v: edge.v,
            suggestedCount: solCount,
            message: `The bridge between Island ${edge.u} and Island ${edge.v} is not needed.`
          };
        }
      }
    }

    return {
      type: 'general',
      message: 'Look for islands near borders or corners with high numbers.'
    };
  }
}

/**
 * HashiSolver - Backtracking solver for Hashiwokakero puzzles
 */
class HashiSolver {
  static solve(engineOrLevel) {
    let engine;
    if (engineOrLevel instanceof BridgesEngine) {
      engine = new BridgesEngine({
        id: engineOrLevel.id,
        width: engineOrLevel.width,
        height: engineOrLevel.height,
        islands: engineOrLevel.islands
      });
    } else {
      engine = new BridgesEngine(engineOrLevel);
    }

    const edges = engine.potentialEdges;
    const numEdges = edges.length;
    const assignments = new Map();

    function canPlace(edgeIdx, count) {
      if (count === 0) return true;

      const edge = edges[edgeIdx];

      // Check crossing conflicts
      const conflicts = engine.crossingConflicts.get(edge.key);
      if (conflicts) {
        for (const cKey of conflicts) {
          if ((assignments.get(cKey) || 0) > 0) return false;
        }
      }

      // Check island degrees
      const uDegree = getAssignedDegree(edge.u) + count;
      if (uDegree > engine.islandMap.get(edge.u).required) return false;

      const vDegree = getAssignedDegree(edge.v) + count;
      if (vDegree > engine.islandMap.get(edge.v).required) return false;

      return true;
    }

    function getAssignedDegree(islandId) {
      let deg = 0;
      for (const [k, c] of assignments.entries()) {
        const e = engine.edgeMap.get(k);
        if (e.u === islandId || e.v === islandId) {
          deg += c;
        }
      }
      return deg;
    }

    function isSolComplete() {
      for (const island of engine.islands) {
        if (getAssignedDegree(island.id) !== island.required) return false;
      }

      // Connectedness check
      const visited = new Set();
      const queue = [engine.islands[0].id];
      visited.add(engine.islands[0].id);

      const adj = new Map();
      for (const island of engine.islands) adj.set(island.id, []);

      for (const [k, c] of assignments.entries()) {
        if (c > 0) {
          const e = engine.edgeMap.get(k);
          adj.get(e.u).push(e.v);
          adj.get(e.v).push(e.u);
        }
      }

      while (queue.length > 0) {
        const curr = queue.shift();
        for (const next of adj.get(curr) || []) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }

      return visited.size === engine.islands.length;
    }

    function backtrack(edgeIdx) {
      if (edgeIdx === numEdges) {
        return isSolComplete();
      }

      const edge = edges[edgeIdx];

      // Try counts: 2, 1, 0 (or 0, 1, 2)
      for (const count of [2, 1, 0]) {
        if (canPlace(edgeIdx, count)) {
          assignments.set(edge.key, count);
          if (backtrack(edgeIdx + 1)) {
            return true;
          }
          assignments.delete(edge.key);
        }
      }

      return false;
    }

    if (backtrack(0)) {
      return assignments;
    }

    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BridgesEngine, HashiSolver };
}
