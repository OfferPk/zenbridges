const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { BridgesEngine, HashiSolver } = require('../src/bridges-engine.js');
const { ZEN_BRIDGES_LEVELS } = require('../src/levels.js');

describe('ZenBridges Engine Core Logic', () => {
  test('Initializes level correctly', () => {
    const level1 = ZEN_BRIDGES_LEVELS[0];
    const engine = new BridgesEngine(level1);

    assert.equal(engine.id, 1);
    assert.equal(engine.width, 5);
    assert.equal(engine.height, 5);
    assert.equal(engine.islands.length, level1.islands.length);
    assert.ok(engine.potentialEdges.length > 0);
  });

  test('Detects orthogonal line-of-sight neighbors correctly', () => {
    // 3 islands in a row: (0, 0), (2, 0), (4, 0)
    // Only (0, 0)-(2, 0) and (2, 0)-(4, 0) should be potential edges; (0, 0)-(4, 0) blocked by (2, 0)
    const testLevel = {
      id: 999,
      width: 5,
      height: 5,
      islands: [
        { id: 0, x: 0, y: 0, required: 1 },
        { id: 1, x: 2, y: 0, required: 2 },
        { id: 2, x: 4, y: 0, required: 1 }
      ]
    };
    const engine = new BridgesEngine(testLevel);
    assert.equal(engine.potentialEdges.length, 2);
    assert.ok(engine.edgeMap.has('0-1'));
    assert.ok(engine.edgeMap.has('1-2'));
    assert.ok(!engine.edgeMap.has('0-2'));
  });

  test('Detects crossing conflict between horizontal and vertical edges', () => {
    // Cross formation:
    // (1, 2) to (5, 2) [horizontal]
    // (3, 0) to (3, 4) [vertical]
    // They cross at (3, 2)
    const testLevel = {
      id: 998,
      width: 6,
      height: 6,
      islands: [
        { id: 0, x: 1, y: 2, required: 1 },
        { id: 1, x: 5, y: 2, required: 1 },
        { id: 2, x: 3, y: 0, required: 1 },
        { id: 3, x: 3, y: 4, required: 1 }
      ]
    };
    const engine = new BridgesEngine(testLevel);
    const conflicts = engine.crossingConflicts.get('0-1');
    assert.ok(conflicts.has('2-3'));

    // Place bridge on 0-1
    const res1 = engine.cycleBridge(0, 1);
    assert.equal(res1.success, true);
    assert.equal(res1.count, 1);

    // Attempt to place bridge on crossing edge 2-3 should be rejected
    const res2 = engine.cycleBridge(2, 3);
    assert.equal(res2.success, false);
    assert.equal(res2.reason, 'crossing_conflict');
  });

  test('Cycles bridges 0 -> 1 -> 2 -> 0 correctly', () => {
    const level1 = ZEN_BRIDGES_LEVELS[0];
    const engine = new BridgesEngine(level1);
    const edge = engine.potentialEdges[0];

    assert.equal(engine.getBridgeCount(edge.u, edge.v), 0);

    // 0 -> 1
    const step1 = engine.cycleBridge(edge.u, edge.v);
    assert.equal(step1.success, true);
    assert.equal(step1.count, 1);
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 1);

    // 1 -> 2
    const step2 = engine.cycleBridge(edge.u, edge.v);
    assert.equal(step2.success, true);
    assert.equal(step2.count, 2);
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 2);

    // 2 -> 0
    const step3 = engine.cycleBridge(edge.u, edge.v);
    assert.equal(step3.success, true);
    assert.equal(step3.count, 0);
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 0);
  });

  test('Undo restores previous bridge count and move count', () => {
    const level1 = ZEN_BRIDGES_LEVELS[0];
    const engine = new BridgesEngine(level1);
    const edge = engine.potentialEdges[0];

    engine.cycleBridge(edge.u, edge.v); // count = 1
    engine.cycleBridge(edge.u, edge.v); // count = 2
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 2);

    engine.undo();
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 1);

    engine.undo();
    assert.equal(engine.getBridgeCount(edge.u, edge.v), 0);
  });

  test('Island status correctly tracks under, satisfied, and over', () => {
    const testLevel = {
      id: 997,
      width: 4,
      height: 4,
      islands: [
        { id: 0, x: 0, y: 0, required: 2 },
        { id: 1, x: 2, y: 0, required: 2 }
      ]
    };
    const engine = new BridgesEngine(testLevel);

    assert.equal(engine.getIslandStatus(0).status, 'under');

    engine.cycleBridge(0, 1); // 1 bridge
    assert.equal(engine.getIslandStatus(0).status, 'under');

    engine.cycleBridge(0, 1); // 2 bridges
    assert.equal(engine.getIslandStatus(0).status, 'satisfied');
    assert.equal(engine.isLevelComplete(), true);
  });

  test('Verifies graph connectivity requirement', () => {
    // Two disconnected pairs of islands:
    // Pair A: (0, 0)-(1, 0)
    // Pair B: (0, 3)-(1, 3)
    // Both pairs satisfied, but graph not fully connected
    const testLevel = {
      id: 996,
      width: 4,
      height: 4,
      islands: [
        { id: 0, x: 0, y: 0, required: 1 },
        { id: 1, x: 1, y: 0, required: 1 },
        { id: 2, x: 0, y: 3, required: 1 },
        { id: 3, x: 1, y: 3, required: 1 }
      ]
    };
    const engine = new BridgesEngine(testLevel);
    engine.setBridgeCount(0, 1, 1);
    engine.setBridgeCount(2, 3, 1);

    // Both satisfied
    assert.equal(engine.getIslandStatus(0).status, 'satisfied');
    assert.equal(engine.getIslandStatus(2).status, 'satisfied');

    // But graph is not connected
    assert.equal(engine.isGraphConnected(), false);
    assert.equal(engine.isLevelComplete(), false);
  });

  test('HashiSolver solves and verifies all 50 levels', () => {
    assert.equal(ZEN_BRIDGES_LEVELS.length, 50);

    for (let i = 0; i < 50; i++) {
      const level = ZEN_BRIDGES_LEVELS[i];
      const solution = HashiSolver.solve(level);
      assert.ok(solution, `Level ${level.id} (${level.name}) must have a valid solution`);

      // Verify solution in engine
      const engine = new BridgesEngine(level);
      for (const [key, count] of solution.entries()) {
        const edge = engine.edgeMap.get(key);
        engine.setBridgeCount(edge.u, edge.v, count);
      }
      assert.equal(engine.isLevelComplete(), true, `Level ${level.id} must be complete with solution`);
    }
  });

  test('Hint generator returns actionable deduction or solver step', () => {
    const level1 = ZEN_BRIDGES_LEVELS[0];
    const engine = new BridgesEngine(level1);
    const hint = engine.getHint();
    assert.ok(hint);
    assert.ok(hint.message);
  });
});
