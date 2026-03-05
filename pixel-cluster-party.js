/**
 * Pixel Cluster Party – generative grid + burst animation.
 * Reference: frame-screenshots/ (chronological) for motion/timing.
 * Grid of black squares; colored bursts expand from behind then retract (stepped/async).
 */
(function () {
  var DEFAULT_PARAMS = {
    gridCols: 6,
    gridRows: 8,
    cellSize: 16,
    gridGap: 12,
    gridPadding: 24,
    burstDurationMs: 400,
    minDelayMs: 800,
    maxDelayMs: 2400,
    speed: 1,
    burstFreq: 1,
    stepSize: 2,
    easing: 'stepped',
    chaos: 0.3,
    accent1: '#ff6633',
    accent2: '#b299ff',
    primary: null
  };

  var easingFns = {
    linear: function (t) { return t; },
    stepped: function (t) { return Math.floor(t * 8) / 8; },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 2); },
    easeInOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    bounce: function (t) {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  };

  var container = document.getElementById('pixel-cluster-party');
  if (!container) return;

  var params = {};
  var gridEl = null;
  var cells = [];
  var rafId = null;
  var paused = false;
  var seed = 0;

  function mergeParams(overrides) {
    var p = {};
    for (var k in DEFAULT_PARAMS) p[k] = DEFAULT_PARAMS[k];
    if (overrides) for (var key in overrides) if (overrides[key] !== undefined) p[key] = overrides[key];
    return p;
  }

  function seededRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  function randomInRange(min, max, chaosMult) {
    var r = seededRandom();
    if (chaosMult && chaosMult < 1) r = r * chaosMult + (1 - chaosMult) * 0.5;
    return min + r * (max - min);
  }

  function buildGrid() {
    if (gridEl && gridEl.parentNode) gridEl.parentNode.removeChild(gridEl);
    gridEl = document.createElement('div');
    gridEl.className = 'pixel-cluster-party__grid';
    var gap = params.gridGap != null ? params.gridGap : DEFAULT_PARAMS.gridGap;
    var pad = params.gridPadding != null ? params.gridPadding : DEFAULT_PARAMS.gridPadding;
    gridEl.style.setProperty('--grid-gap', gap + 'px');
    gridEl.style.setProperty('--grid-padding', pad + 'px');
    gridEl.style.setProperty('--cell-size', (params.cellSize || DEFAULT_PARAMS.cellSize) + 'px');
    container.appendChild(gridEl);
    cells = [];
    var cols = params.gridCols || DEFAULT_PARAMS.gridCols;
    var rows = params.gridRows || DEFAULT_PARAMS.gridRows;
    var accents = [params.accent1 || DEFAULT_PARAMS.accent1, params.accent2 || DEFAULT_PARAMS.accent2];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = document.createElement('div');
        cell.className = 'pixel-cluster-party__cell';
        var square = document.createElement('div');
        square.className = 'pixel-cluster-party__square';
        var burst = document.createElement('div');
        burst.className = 'pixel-cluster-party__burst';
        burst.style.setProperty('--burst-scale', '0');
        burst.style.setProperty('--burst-color', accents[Math.floor(seededRandom() * 2) % 2]);
        cell.appendChild(square);
        cell.appendChild(burst);
        gridEl.appendChild(cell);
        cells.push({
          el: cell,
          burst: burst,
          state: 'idle',
          progress: 0,
          nextBurstAt: 0,
          burstColor: null
        });
      }
    }
  }

  function startBurst(cell, now) {
    cell.state = 'expand';
    cell.progress = 0;
    cell.burstColor = [params.accent1, params.accent2][Math.floor(seededRandom() * 2) % 2];
    cell.burst.style.setProperty('--burst-color', cell.burstColor);
  }

  function tick(now) {
    if (paused) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    now = now || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    var speed = params.speed != null ? params.speed : 1;
    var burstDuration = (params.burstDurationMs || DEFAULT_PARAMS.burstDurationMs) / speed;
    var minD = (params.minDelayMs || DEFAULT_PARAMS.minDelayMs) / (params.burstFreq != null ? params.burstFreq : 1);
    var maxD = (params.maxDelayMs || DEFAULT_PARAMS.maxDelayMs) / (params.burstFreq != null ? params.burstFreq : 1);
    var chaos = params.chaos != null ? params.chaos : 0.3;
    var easingName = params.easing || 'stepped';
    var ease = easingFns[easingName] || easingFns.stepped;
    var stepSize = params.stepSize != null ? params.stepSize : 2;
    var stepCount = Math.max(1, Math.floor(8 / stepSize));

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (cell.state === 'idle') {
        if (now >= cell.nextBurstAt) startBurst(cell, now);
        continue;
      }
      var dt = 16;
      var progressStep = (dt / burstDuration) * (cell.state === 'expand' ? 1 : -1);
      cell.progress = Math.max(0, Math.min(1, cell.progress + progressStep));
      var t = cell.progress;
      if (easingName === 'stepped') {
        t = Math.floor(t * stepCount) / stepCount;
      } else {
        t = ease(t);
      }
      cell.burst.style.setProperty('--burst-scale', String(t));
      if (cell.progress >= 1 && cell.state === 'expand') {
        cell.state = 'retract';
      } else if (cell.progress <= 0) {
        cell.state = 'idle';
        var delay = randomInRange(minD, maxD, 1 - chaos);
        cell.nextBurstAt = now + delay;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function init(initialOverrides) {
    params = mergeParams(initialOverrides);
    seed = Math.floor(Date.now() % 233280);
    buildGrid();
    var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    var minD = params.minDelayMs / (params.burstFreq || 1);
    var maxD = params.maxDelayMs / (params.burstFreq || 1);
    for (var i = 0; i < cells.length; i++) {
      cells[i].nextBurstAt = now + randomInRange(0, maxD * 0.5, 1 - params.chaos);
    }
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function setTheme(theme) {
    var root = document.documentElement;
    if (theme === 'dark') {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark');
    } else {
      root.classList.remove('theme-dark');
      root.classList.add('theme-light');
    }
  }

  function setPaused(p) {
    paused = !!p;
  }

  function setParams(overrides) {
    if (overrides && typeof overrides === 'object') {
      for (var k in overrides) if (overrides[k] !== undefined) params[k] = overrides[k];
      if (overrides.gridCols !== undefined || overrides.gridRows !== undefined || overrides.cellSize !== undefined || overrides.gridGap !== undefined || overrides.gridPadding !== undefined) {
        buildGrid();
        var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        var maxD = (params.maxDelayMs || DEFAULT_PARAMS.maxDelayMs) / (params.burstFreq != null ? params.burstFreq : 1);
        for (var i = 0; i < cells.length; i++) {
          cells[i].nextBurstAt = now + randomInRange(0, maxD * 0.3, 1 - (params.chaos != null ? params.chaos : 0.3));
        }
      }
    }
  }

  function bindControls(controlsEl) {
    if (!controlsEl) return;
    var speedInput = controlsEl.querySelector('#param-speed');
    var speedValue = controlsEl.querySelector('#param-speed-value');
    if (speedInput) {
      speedInput.addEventListener('input', function () {
        var v = parseFloat(speedInput.value);
        params.speed = v;
        if (speedValue) speedValue.textContent = v;
      });
      if (speedValue) speedValue.textContent = speedInput.value;
    }
    var burstFreqInput = controlsEl.querySelector('#param-burstFreq');
    var burstFreqValue = controlsEl.querySelector('#param-burstFreq-value');
    if (burstFreqInput) {
      burstFreqInput.addEventListener('input', function () {
        var v = parseFloat(burstFreqInput.value);
        params.burstFreq = v;
        if (burstFreqValue) burstFreqValue.textContent = v;
      });
      if (burstFreqValue) burstFreqValue.textContent = burstFreqInput.value;
    }
    var stepSizeInput = controlsEl.querySelector('#param-stepSize');
    if (stepSizeInput) {
      stepSizeInput.addEventListener('change', function () {
        var v = parseInt(stepSizeInput.value, 10);
        if (!isNaN(v)) params.stepSize = Math.max(1, Math.min(4, v));
      });
    }
    var easingSelect = controlsEl.querySelector('#param-easing');
    if (easingSelect) {
      easingSelect.addEventListener('change', function () {
        params.easing = easingSelect.value;
      });
    }
    var chaosInput = controlsEl.querySelector('#param-chaos');
    var chaosValue = controlsEl.querySelector('#param-chaos-value');
    if (chaosInput) {
      chaosInput.addEventListener('input', function () {
        var v = parseFloat(chaosInput.value);
        params.chaos = v;
        if (chaosValue) chaosValue.textContent = v;
      });
      if (chaosValue) chaosValue.textContent = chaosInput.value;
    }
    var colsInput = controlsEl.querySelector('#param-cols');
    var rowsInput = controlsEl.querySelector('#param-rows');
    if (colsInput) {
      colsInput.addEventListener('change', function () {
        var v = parseInt(colsInput.value, 10);
        if (!isNaN(v)) setParams({ gridCols: Math.max(4, Math.min(12, v)) });
      });
    }
    if (rowsInput) {
      rowsInput.addEventListener('change', function () {
        var v = parseInt(rowsInput.value, 10);
        if (!isNaN(v)) setParams({ gridRows: Math.max(4, Math.min(12, v)) });
      });
    }
    var presets = controlsEl.querySelectorAll('[data-preset]');
    for (var p = 0; p < presets.length; p++) {
      presets[p].addEventListener('click', function () {
        var name = this.getAttribute('data-preset');
        if (name === 'default') setParams({ speed: 1, burstFreq: 1, stepSize: 2, easing: 'stepped', chaos: 0.3 });
        else if (name === 'calm') setParams({ speed: 0.5, burstFreq: 0.4, stepSize: 2, easing: 'easeOut', chaos: 0.1 });
        else if (name === 'chaos') setParams({ speed: 1.8, burstFreq: 1.8, stepSize: 1, easing: 'linear', chaos: 0.9 });
        if (speedInput) { speedInput.value = params.speed; if (speedValue) speedValue.textContent = params.speed; }
        if (burstFreqInput) { burstFreqInput.value = params.burstFreq; if (burstFreqValue) burstFreqValue.textContent = params.burstFreq; }
        if (stepSizeInput) stepSizeInput.value = params.stepSize;
        if (easingSelect) easingSelect.value = params.easing;
        if (chaosInput) { chaosInput.value = params.chaos; if (chaosValue) chaosValue.textContent = params.chaos; }
      });
    }
  }

  init();

  window.PixelClusterParty = {
    setTheme: setTheme,
    setPaused: setPaused,
    setParams: setParams,
    bindControls: bindControls,
    stop: function () {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  };
})();
