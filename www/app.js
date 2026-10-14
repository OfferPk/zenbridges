/**
 * ZenBridges - Main Game Application Controller
 * High-DPI canvas rendering, touch & mouse interactions, UI modals, audio, and state persistence.
 */

(function() {
  'use strict';

  // Game state
  let currentLevelIndex = 0;
  let engine = null;
  let audio = null;
  let completedLevels = new Set();
  let selectedIslandId = null;
  let hoveredEdgeKey = null;
  let hintEdgeKey = null;
  let waterRipples = [];

  // Canvas elements & context
  const puzzleCanvas = document.getElementById('puzzle-canvas');
  const puzzleCtx = puzzleCanvas.getContext('2d');
  const waterCanvas = document.getElementById('water-canvas');
  const waterCtx = waterCanvas.getContext('2d');
  const boardContainer = document.querySelector('.board-container');

  // DOM elements
  const levelTitleEl = document.getElementById('level-title');
  const packNameEl = document.getElementById('pack-name');
  const islandsMeterEl = document.getElementById('islands-meter');
  const islandProgressEl = document.getElementById('island-progress');
  const islandProgressFillEl = document.getElementById('island-progress-fill');
  const boardPromptEl = document.getElementById('board-prompt');
  const moveCountEl = document.getElementById('move-count');
  const hintBannerEl = document.getElementById('hint-banner');

  const btnSound = document.getElementById('btn-sound');
  const btnLevels = document.getElementById('btn-levels');
  const btnRules = document.getElementById('btn-rules');
  const btnUndo = document.getElementById('btn-undo');
  const btnReset = document.getElementById('btn-reset');
  const btnHint = document.getElementById('btn-hint');
  const btnNextLevel = document.getElementById('btn-next-level');

  const levelsModal = document.getElementById('levels-modal');
  const closeLevelsBtn = document.getElementById('close-levels');
  const packTabsContainer = document.getElementById('pack-tabs');
  const levelGridContainer = document.getElementById('level-grid');

  const rulesModal = document.getElementById('rules-modal');
  const closeRulesBtn = document.getElementById('close-rules');

  const winModal = document.getElementById('win-modal');
  const winMovesEl = document.getElementById('win-moves');
  const winIslandsEl = document.getElementById('win-islands');

  // Load progress from localStorage
  function loadProgress() {
    try {
      const saved = localStorage.getItem('zenbridges_completed');
      if (saved) {
        completedLevels = new Set(JSON.parse(saved));
      }
      const savedIdx = localStorage.getItem('zenbridges_current_level');
      if (savedIdx !== null) {
        const idx = parseInt(savedIdx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < ZEN_BRIDGES_LEVELS.length) {
          currentLevelIndex = idx;
        }
      }
    } catch (e) {
      console.warn('Progress load failed:', e);
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem('zenbridges_completed', JSON.stringify([...completedLevels]));
      localStorage.setItem('zenbridges_current_level', String(currentLevelIndex));
    } catch (e) {}
  }

  // Initialize Game
  function init() {
    audio = new ZenAudio();
    loadProgress();
    updateSoundButton();
    setupEventListeners();
    setupResizeHandler();
    startWaterAnimation();
    loadLevel(currentLevelIndex);
  }

  // Load level by index
  function loadLevel(index) {
    if (index < 0 || index >= ZEN_BRIDGES_LEVELS.length) return;
    currentLevelIndex = index;
    saveProgress();

    selectedIslandId = null;
    hoveredEdgeKey = null;
    hintEdgeKey = null;
    hideHint();

    const levelData = ZEN_BRIDGES_LEVELS[currentLevelIndex];
    engine = new BridgesEngine(levelData);

    levelTitleEl.textContent = `Level ${engine.id}`;
    packNameEl.textContent = engine.pack;

    updateUI();
    resizeCanvas();
    render();
  }

  // Resize canvas to fit board container cleanly
  function resizeCanvas() {
    if (!boardContainer || !puzzleCanvas) return;

    const rect = boardContainer.getBoundingClientRect();
    const size = Math.min(rect.width - 24, rect.height - 24, 480);
    const dpr = window.devicePixelRatio || 1;

    puzzleCanvas.width = Math.floor(size * dpr);
    puzzleCanvas.height = Math.floor(size * dpr);
    puzzleCanvas.style.width = `${size}px`;
    puzzleCanvas.style.height = `${size}px`;

    puzzleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Water canvas matches container
    waterCanvas.width = Math.floor(rect.width * dpr);
    waterCanvas.height = Math.floor(rect.height * dpr);
    waterCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setupResizeHandler() {
    window.addEventListener('resize', () => {
      resizeCanvas();
      render();
    });
  }

  // Get grid dimensions and coordinate mappings
  function getLayout() {
    const dpr = window.devicePixelRatio || 1;
    const canvasSize = puzzleCanvas.width / dpr;
    const padding = 38;
    const gridW = engine.width - 1 || 1;
    const gridH = engine.height - 1 || 1;
    const stepX = (canvasSize - padding * 2) / gridW;
    const stepY = (canvasSize - padding * 2) / gridH;

    function toScreen(gx, gy) {
      return {
        x: padding + gx * stepX,
        y: padding + gy * stepY
      };
    }

    const islandRadius = Math.max(16, Math.min(24, Math.min(stepX, stepY) * 0.36));

    return { canvasSize, padding, stepX, stepY, toScreen, islandRadius };
  }

  // Render Puzzle Board
  function render() {
    if (!engine || !puzzleCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = puzzleCanvas.width / dpr;
    const height = puzzleCanvas.height / dpr;

    puzzleCtx.clearRect(0, 0, width, height);

    const layout = getLayout();

    // 1. Draw alignment guidelines between potential bridge partners
    puzzleCtx.save();
    for (const edge of engine.potentialEdges) {
      const u = engine.islandMap.get(edge.u);
      const v = engine.islandMap.get(edge.v);
      const p1 = layout.toScreen(u.x, u.y);
      const p2 = layout.toScreen(v.x, v.y);

      puzzleCtx.beginPath();
      puzzleCtx.setLineDash([4, 6]);
      puzzleCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      puzzleCtx.lineWidth = 1.5;
      puzzleCtx.moveTo(p1.x, p1.y);
      puzzleCtx.lineTo(p2.x, p2.y);
      puzzleCtx.stroke();
    }
    puzzleCtx.restore();

    // 2. Draw active bridges
    for (const edge of engine.potentialEdges) {
      const count = engine.bridges.get(edge.key) || 0;
      if (count === 0 && edge.key !== hintEdgeKey) continue;

      const u = engine.islandMap.get(edge.u);
      const v = engine.islandMap.get(edge.v);
      const p1 = layout.toScreen(u.x, u.y);
      const p2 = layout.toScreen(v.x, v.y);

      const isHinted = edge.key === hintEdgeKey;

      if (isHinted && count === 0) {
        // Draw pulsing golden preview for hint
        puzzleCtx.save();
        puzzleCtx.beginPath();
        puzzleCtx.strokeStyle = '#FFD166';
        puzzleCtx.lineWidth = 3;
        puzzleCtx.setLineDash([6, 4]);
        puzzleCtx.shadowColor = '#FFD166';
        puzzleCtx.shadowBlur = 10;
        puzzleCtx.moveTo(p1.x, p1.y);
        puzzleCtx.lineTo(p2.x, p2.y);
        puzzleCtx.stroke();
        puzzleCtx.restore();
        continue;
      }

      if (count === 1) {
        // Single bridge
        puzzleCtx.save();
        puzzleCtx.beginPath();
        puzzleCtx.strokeStyle = '#2FE6C8';
        puzzleCtx.lineWidth = 3.5;
        puzzleCtx.shadowColor = 'rgba(47, 230, 200, 0.6)';
        puzzleCtx.shadowBlur = 8;
        puzzleCtx.moveTo(p1.x, p1.y);
        puzzleCtx.lineTo(p2.x, p2.y);
        puzzleCtx.stroke();
        puzzleCtx.restore();
      } else if (count === 2) {
        // Double bridge - two parallel lines offset perpendicular to direction
        const offset = 4.5;
        const dx = edge.orientation === 'vertical' ? offset : 0;
        const dy = edge.orientation === 'horizontal' ? offset : 0;

        puzzleCtx.save();
        puzzleCtx.strokeStyle = '#00E5FF';
        puzzleCtx.lineWidth = 3;
        puzzleCtx.shadowColor = 'rgba(0, 229, 255, 0.65)';
        puzzleCtx.shadowBlur = 9;

        // Line 1
        puzzleCtx.beginPath();
        puzzleCtx.moveTo(p1.x - dx, p1.y - dy);
        puzzleCtx.lineTo(p2.x - dx, p2.y - dy);
        puzzleCtx.stroke();

        // Line 2
        puzzleCtx.beginPath();
        puzzleCtx.moveTo(p1.x + dx, p1.y + dy);
        puzzleCtx.lineTo(p2.x + dx, p2.y + dy);
        puzzleCtx.stroke();

        puzzleCtx.restore();
      }
    }

    // 3. Draw islands
    for (const island of engine.islands) {
      const pos = layout.toScreen(island.x, island.y);
      const radius = layout.islandRadius;
      const status = engine.getIslandStatus(island.id);
      const isSelected = selectedIslandId === island.id;

      puzzleCtx.save();

      // Outer aura / glow
      let auraColor = 'rgba(77, 208, 225, 0.1)';
      let ringColor = '#234358';
      let textColor = '#E0F2FE';

      if (status.status === 'satisfied') {
        auraColor = 'rgba(47, 230, 200, 0.35)';
        ringColor = '#2FE6C8';
        textColor = '#FFFFFF';
      } else if (status.status === 'over') {
        auraColor = 'rgba(239, 71, 111, 0.4)';
        ringColor = '#EF476F';
        textColor = '#FFD2DC';
      } else if (isSelected) {
        auraColor = 'rgba(255, 209, 102, 0.45)';
        ringColor = '#FFD166';
      }

      // Draw outer aura
      puzzleCtx.beginPath();
      puzzleCtx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
      puzzleCtx.fillStyle = auraColor;
      puzzleCtx.fill();

      // Island stone circle
      const grad = puzzleCtx.createRadialGradient(pos.x - 2, pos.y - 2, 2, pos.x, pos.y, radius);
      grad.addColorStop(0, '#1E3646');
      grad.addColorStop(1, '#0F212C');

      puzzleCtx.beginPath();
      puzzleCtx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      puzzleCtx.fillStyle = grad;
      puzzleCtx.fill();

      // Island border ring
      puzzleCtx.lineWidth = isSelected ? 3 : 2;
      puzzleCtx.strokeStyle = ringColor;
      puzzleCtx.shadowColor = ringColor;
      puzzleCtx.shadowBlur = status.status === 'satisfied' || isSelected ? 8 : 0;
      puzzleCtx.stroke();

      // Number text
      puzzleCtx.shadowBlur = 0;
      puzzleCtx.fillStyle = textColor;
      puzzleCtx.font = `bold ${Math.floor(radius * 1.05)}px var(--font-family)`;
      puzzleCtx.textAlign = 'center';
      puzzleCtx.textBaseline = 'middle';
      puzzleCtx.fillText(island.required, pos.x, pos.y + 1);

      // Satisfied checkmark indicator
      if (status.status === 'satisfied') {
        puzzleCtx.beginPath();
        puzzleCtx.arc(pos.x + radius * 0.7, pos.y - radius * 0.7, 5, 0, Math.PI * 2);
        puzzleCtx.fillStyle = '#2FE6C8';
        puzzleCtx.fill();
      }

      puzzleCtx.restore();
    }
  }

  // Update UI text and counters
  function updateUI() {
    if (!engine) return;

    let satisfiedCount = 0;
    for (const island of engine.islands) {
      if (engine.getIslandStatus(island.id).status === 'satisfied') {
        satisfiedCount++;
      }
    }

    const totalIslands = engine.islands.length;
    const progress = totalIslands ? Math.round((satisfiedCount / totalIslands) * 100) : 0;
    islandsMeterEl.textContent = `${satisfiedCount}/${totalIslands}`;
    islandProgressEl.setAttribute('aria-valuemax', String(totalIslands));
    islandProgressEl.setAttribute('aria-valuenow', String(satisfiedCount));
    islandProgressFillEl.style.width = `${progress}%`;
    moveCountEl.textContent = engine.moveCount;
    btnUndo.disabled = engine.history.length === 0;
    btnReset.disabled = engine.moveCount === 0;
    boardPromptEl.textContent = selectedIslandId === null
      ? 'Tap an island, then a neighbor to build a bridge.'
      : 'Now choose a visible neighbor. Tap your selection again to cancel.';
    puzzleCanvas.setAttribute('aria-label', `Puzzle board. ${satisfiedCount} of ${totalIslands} islands are in harmony. Tap two islands or a bridge to change a connection.`);
  }

  // Check victory condition
  function checkVictory() {
    if (engine && engine.isLevelComplete()) {
      completedLevels.add(currentLevelIndex);
      saveProgress();

      audio.playVictory();

      // Trigger celebratory water ripples
      const layout = getLayout();
      for (const isl of engine.islands) {
        const p = layout.toScreen(isl.x, isl.y);
        addWaterRipple(p.x, p.y, 60);
      }

      setTimeout(() => {
        showVictoryModal();
      }, 500);
    }
  }

  function showVictoryModal() {
    winMovesEl.textContent = engine.moveCount;
    winIslandsEl.textContent = engine.islands.length;
    setModalState(winModal, true, btnNextLevel);
  }

  function setModalState(modal, isOpen, focusTarget) {
    const dialog = modal.querySelector('.modal-card');
    modal.classList.toggle('active', isOpen);
    dialog.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen && focusTarget) {
      window.requestAnimationFrame(() => focusTarget.focus());
    } else if (!isOpen && focusTarget) {
      focusTarget.focus();
    }
  }

  // Handle Board Click / Touch
  function handleBoardClick(clientX, clientY) {
    if (!engine) return;

    const rect = puzzleCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const layout = getLayout();

    // Check if clicked an island
    let clickedIsland = null;
    for (const island of engine.islands) {
      const p = layout.toScreen(island.x, island.y);
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist <= layout.islandRadius + 8) {
        clickedIsland = island;
        break;
      }
    }

    if (clickedIsland) {
      addWaterRipple(x, y, 40);

      if (selectedIslandId === null) {
        // Select this island
        selectedIslandId = clickedIsland.id;
        audio.playBridgeTap(1);
        updateUI();
        render();
        return;
      } else if (selectedIslandId === clickedIsland.id) {
        // Deselect
        selectedIslandId = null;
        updateUI();
        render();
        return;
      } else {
        // Connect selected island to clicked island if orthogonal line of sight exists
        const u = selectedIslandId;
        const v = clickedIsland.id;
        selectedIslandId = null;

        const res = engine.cycleBridge(u, v);
        if (res.success) {
          if (res.count > 0) {
            audio.playBridgeTap(res.count);
          } else {
            audio.playBridgeRemove();
          }

          if (res.islandU.status === 'satisfied' || res.islandV.status === 'satisfied') {
            audio.playIslandSatisfied();
          }

          hintEdgeKey = null;
          hideHint();
          updateUI();
          render();
          checkVictory();
        } else {
          // If not direct neighbor or blocked, select the new island instead
          selectedIslandId = clickedIsland.id;
          audio.playBridgeTap(1);
          updateUI();
          render();
        }
        return;
      }
    }

    // Check if clicked directly on a bridge edge
    let clickedEdge = null;
    let minEdgeDist = 14;

    for (const edge of engine.potentialEdges) {
      const u = engine.islandMap.get(edge.u);
      const v = engine.islandMap.get(edge.v);
      const p1 = layout.toScreen(u.x, u.y);
      const p2 = layout.toScreen(v.x, v.y);

      const d = distToSegment({ x, y }, p1, p2);
      if (d < minEdgeDist) {
        minEdgeDist = d;
        clickedEdge = edge;
      }
    }

    if (clickedEdge) {
      addWaterRipple(x, y, 35);
      selectedIslandId = null;
      updateUI();

      const res = engine.cycleBridge(clickedEdge.u, clickedEdge.v);
      if (res.success) {
        if (res.count > 0) {
          audio.playBridgeTap(res.count);
        } else {
          audio.playBridgeRemove();
        }

        if (res.islandU.status === 'satisfied' || res.islandV.status === 'satisfied') {
          audio.playIslandSatisfied();
        }

        hintEdgeKey = null;
        hideHint();
        updateUI();
        render();
        checkVictory();
      }
      return;
    }

    // Deselect if clicked empty water
    if (selectedIslandId !== null) {
      selectedIslandId = null;
      updateUI();
      render();
    }
  }

  // Distance from point to line segment
  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // Water ripple particle system
  function addWaterRipple(x, y, maxR = 50) {
    waterRipples.push({
      x, y,
      r: 4,
      maxR,
      opacity: 0.6,
      speed: 1.2
    });
  }

  function startWaterAnimation() {
    function animate() {
      if (waterCtx && waterCanvas) {
        const dpr = window.devicePixelRatio || 1;
        const w = waterCanvas.width / dpr;
        const h = waterCanvas.height / dpr;

        waterCtx.clearRect(0, 0, w, h);

        // Update and draw ripples
        for (let i = waterRipples.length - 1; i >= 0; i--) {
          const rip = waterRipples[i];
          rip.r += rip.speed;
          rip.opacity = Math.max(0, rip.opacity - 0.015);

          waterCtx.save();
          waterCtx.beginPath();
          waterCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
          waterCtx.strokeStyle = `rgba(47, 230, 200, ${rip.opacity * 0.4})`;
          waterCtx.lineWidth = 1.5;
          waterCtx.stroke();
          waterCtx.restore();

          if (rip.opacity <= 0 || rip.r >= rip.maxR) {
            waterRipples.splice(i, 1);
          }
        }
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  function showHint() {
    if (!engine) return;
    const hint = engine.getHint();
    if (!hint) return;

    audio.playUiClick();

    if (hint.key) {
      hintEdgeKey = hint.key;
      render();
    }

    hintBannerEl.textContent = hint.message;
    hintBannerEl.classList.add('visible');
  }

  function hideHint() {
    hintBannerEl.classList.remove('visible');
  }

  // Sound Toggle UI
  function updateSoundButton() {
    if (!audio) return;
    if (audio.isSoundEnabled()) {
      btnSound.classList.add('active');
      btnSound.title = 'Sound On';
      btnSound.setAttribute('aria-label', 'Mute sound');
      btnSound.setAttribute('aria-pressed', 'true');
    } else {
      btnSound.classList.remove('active');
      btnSound.title = 'Sound Muted';
      btnSound.setAttribute('aria-label', 'Enable sound');
      btnSound.setAttribute('aria-pressed', 'false');
    }
  }

  // Level Select Modal Builder
  function populateLevelSelect() {
    packTabsContainer.innerHTML = '';
    levelGridContainer.innerHTML = '';

    const packs = [
      { name: 'Archipelago', range: [0, 9] },
      { name: 'Serene Waters', range: [10, 19] },
      { name: 'Coral Reef', range: [20, 29] },
      { name: 'Mystic Atolls', range: [30, 39] },
      { name: 'Celestial Ocean', range: [40, 49] }
    ];

    let currentPack = packs.find(p => currentLevelIndex >= p.range[0] && currentLevelIndex <= p.range[1]) || packs[0];

    function showPackLevels(pack) {
      currentPack = pack;
      document.querySelectorAll('.pack-tab').forEach(t => t.classList.remove('active'));
      const activeTab = document.querySelector(`.pack-tab[data-pack="${pack.name}"]`);
      if (activeTab) activeTab.classList.add('active');

      levelGridContainer.innerHTML = '';
      for (let i = pack.range[0]; i <= pack.range[1]; i++) {
        const lvl = ZEN_BRIDGES_LEVELS[i];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'level-card';
        if (i === currentLevelIndex) card.classList.add('current');
        if (completedLevels.has(i)) card.classList.add('completed');
        card.setAttribute('aria-label', `Level ${lvl.id}${i === currentLevelIndex ? ', current level' : ''}${completedLevels.has(i) ? ', completed' : ''}`);
        card.setAttribute('aria-current', i === currentLevelIndex ? 'page' : 'false');

        card.innerHTML = `
          <span class="lvl-num">${lvl.id}</span>
          ${completedLevels.has(i) ? '<span class="lvl-check" aria-hidden="true">✓</span>' : ''}
        `;

        card.addEventListener('click', () => {
          setModalState(levelsModal, false, btnLevels);
          loadLevel(i);
        });

        levelGridContainer.appendChild(card);
      }
    }

    packs.forEach(pack => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'pack-tab';
      tab.dataset.pack = pack.name;
      tab.textContent = pack.name;
      if (pack.name === currentPack.name) tab.classList.add('active');
      tab.setAttribute('aria-pressed', String(pack.name === currentPack.name));

      tab.addEventListener('click', () => {
        showPackLevels(pack);
        packTabsContainer.querySelectorAll('.pack-tab').forEach(packTab => {
          packTab.setAttribute('aria-pressed', String(packTab === tab));
        });
      });
      packTabsContainer.appendChild(tab);
    });

    showPackLevels(currentPack);
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Canvas interactions
    puzzleCanvas.addEventListener('click', (e) => {
      handleBoardClick(e.clientX, e.clientY);
    });

    // Sound button
    btnSound.addEventListener('click', () => {
      audio.toggleSound();
      updateSoundButton();
    });

    // Undo button
    btnUndo.addEventListener('click', () => {
      if (!engine) return;
      const res = engine.undo();
      if (res) {
        audio.playUiClick();
        hintEdgeKey = null;
        hideHint();
        updateUI();
        render();
      }
    });

    // Reset button
    btnReset.addEventListener('click', () => {
      if (!engine) return;
      engine.reset();
      selectedIslandId = null;
      hintEdgeKey = null;
      hideHint();
      audio.playUiClick();
      updateUI();
      render();
    });

    // Hint button
    btnHint.addEventListener('click', () => {
      showHint();
    });

    // Level select modal
    btnLevels.addEventListener('click', () => {
      populateLevelSelect();
      setModalState(levelsModal, true, closeLevelsBtn);
    });

    closeLevelsBtn.addEventListener('click', () => {
      setModalState(levelsModal, false, btnLevels);
    });

    // Rules modal
    btnRules.addEventListener('click', () => {
      setModalState(rulesModal, true, closeRulesBtn);
    });

    closeRulesBtn.addEventListener('click', () => {
      setModalState(rulesModal, false, btnRules);
    });

    // Next Level button
    btnNextLevel.addEventListener('click', () => {
      setModalState(winModal, false, btnLevels);
      if (currentLevelIndex < ZEN_BRIDGES_LEVELS.length - 1) {
        loadLevel(currentLevelIndex + 1);
      } else {
        loadLevel(0); // Loop back to start
      }
    });

    // Close modals on overlay background click or Escape.
    const modalReturnFocus = new Map([
      [levelsModal, btnLevels],
      [rulesModal, btnRules],
      [winModal, btnLevels]
    ]);
    [levelsModal, rulesModal, winModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          setModalState(modal, false, modalReturnFocus.get(modal));
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const activeModal = [winModal, rulesModal, levelsModal].find(modal => modal.classList.contains('active'));
      if (activeModal) {
        e.preventDefault();
        setModalState(activeModal, false, modalReturnFocus.get(activeModal));
      }
    });
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
