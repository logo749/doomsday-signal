/* ============================================================
 * 末日信号 · 合并生存  Doomsday Signal
 * 核心逻辑 + 渲染 + 输入（抖音小游戏 / H5 共用）
 * ruleset_id: doomsday-merge-v1
 * 逻辑分辨率 750 x 1334（竖屏），等比缩放适配任意屏幕
 * ============================================================ */
(function () {
  var G = (typeof window !== 'undefined') ? window
        : (typeof GameGlobal !== 'undefined') ? GameGlobal
        : (typeof globalThis !== 'undefined') ? globalThis : this;

  /* ---------------- 规则集（唯一数值来源） ---------------- */
  var RULESET = {
    id: 'doomsday-merge-v1',
    board: { size: 4, spawnLv1Prob: 0.9, initialTiles: 2, maxLevel: 11 },
    player: { maxHP: 100, waveClearHeal: 15, shieldCap: 60 },
    // 物资链：等级 -> 名称/图标/底色
    tiles: [
      null,
      { name: '废料',   icon: '🔩', color: '#6b6257' },
      { name: '罐头',   icon: '🥫', color: '#8a6d3b' },
      { name: '净水',   icon: '💧', color: '#3b6e8a' },
      { name: '药品',   icon: '💊', color: '#3b8a5f' },
      { name: '刀刃',   icon: '🔪', color: '#7d5ba6' },
      { name: '枪械',   icon: '🔫', color: '#a65b5b' },
      { name: '燃料',   icon: '⛽', color: '#b0762e' },
      { name: '电池',   icon: '🔋', color: '#2e8b8b' },
      { name: '电台',   icon: '📻', color: '#5b6ea6' },
      { name: '装甲',   icon: '🛡️', color: '#8f9aa8' },
      { name: '信号塔', icon: '📡', color: '#c9a227' }
    ],
    // 合成到等级 L 时：对怪物伤害
    mergeDamage: { 2: 1, 3: 2, 4: 3, 5: 6, 6: 10, 7: 16, 8: 24, 9: 36, 10: 54, 11: 80 },
    // 合成到等级 L 时：回复生命
    mergeHeal:   { 2: 3, 3: 4, 4: 10 },
    // 合成到等级 L 时：获得护盾
    mergeShield: { 10: 30 },
    scorePerMerge: function (lv) { return Math.pow(2, lv); }, // 2048 式计分
    chapters: [
      {
        name: '第一章 · 废弃地铁', bg: ['#141b26', '#2b2033'],
        monsters: [
          { name: '感染鼠群', icon: '🐀', hp: 20,  atk: 4,  interval: 7 },
          { name: '游荡丧尸', icon: '🧟', hp: 35,  atk: 6,  interval: 6 },
          { name: '变异猎犬', icon: '🐕', hp: 50,  atk: 8,  interval: 6 }
        ]
      },
      {
        name: '第二章 · 市立医院', bg: ['#101f1c', '#26333a'],
        monsters: [
          { name: '蛛群巢穴', icon: '🕷️', hp: 65,  atk: 9,  interval: 6 },
          { name: '感染医生', icon: '🧟‍♂️', hp: 85,  atk: 11, interval: 5 },
          { name: '血肉聚合体', icon: '👹', hp: 110, atk: 13, interval: 5 }
        ]
      },
      {
        name: '第三章 · 地下实验室', bg: ['#1a1030', '#331a2e'],
        monsters: [
          { name: '安保机甲', icon: '🤖', hp: 140, atk: 15, interval: 5 },
          { name: '变异暴君', icon: '👾', hp: 180, atk: 18, interval: 4 },
          { name: '母体核心', icon: '🐙', hp: 240, atk: 22, interval: 4 }
        ]
      }
    ],
    story: {
      intro: [
        { who: '阿岩', text: '病毒爆发第217天。城市里只剩下风声，和它们的嚎叫。' },
        { who: '老周·电台', text: '阿岩，听到请回答！北区实验室还在发信号，那里可能有疫苗……也可能是陷阱。' },
        { who: '阿岩', text: '食物见底了。留在这里是等死，走出去还有一线生机。' },
        { who: '老周·电台', text: '沿地铁线走。记住：搜集物资、合成武器，别让它们近身！' }
      ],
      chapter2: [
        { who: '阿岩', text: '地铁尽头是市立医院……消毒水味盖不住腐臭。' },
        { who: '老周·电台', text: '小心，医院里的感染体……更“聪明”。' }
      ],
      chapter3: [
        { who: '老周·电台', text: '就是这里，实验室B3层。信号源在最深处的培养舱。' },
        { who: '阿岩', text: '这些机器还在运转……所谓“疫苗”，根本就是在养它。' },
        { who: '？？？', text: '……更多……养料……' },
        { who: '阿岩', text: '母体，一切的源头。老周，打开撤离频道——这是最后一战。' }
      ],
      ending: [
        { who: '老周·电台', text: '信号确认！直升机三分钟后到楼顶！阿岩，你做到了！' },
        { who: '阿岩', text: '第218天，太阳升起来了。这一次，我是朝着光走的。' }
      ]
    },
    anim: { slideMs: 110, popMs: 160, spawnMs: 140, waveDelayMs: 950, floaterMs: 900 }
  };

  /* ---------------- 工具 ---------------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  /* ---------------- 棋盘纯逻辑 ---------------- */
  var N = RULESET.board.size, MAXL = RULESET.board.maxLevel;
  function emptyGrid() {
    var g = [];
    for (var r = 0; r < N; r++) { g.push([0, 0, 0, 0]); }
    return g;
  }
  function lineCells(dir, i) { // 滑动方向 0左 1右 2上 3下；返回从目标边缘起的格子序列
    var cells = [];
    for (var k = 0; k < N; k++) {
      if (dir === 0) cells.push([i, k]);
      else if (dir === 1) cells.push([i, N - 1 - k]);
      else if (dir === 2) cells.push([k, i]);
      else cells.push([N - 1 - k, i]);
    }
    return cells;
  }
  function moveGrid(grid, dir) {
    var moved = false, merges = [], slides = [], ng = emptyGrid();
    for (var i = 0; i < N; i++) {
      var cells = lineCells(dir, i), tiles = [];
      for (var k = 0; k < N; k++) {
        var r = cells[k][0], c = cells[k][1];
        if (grid[r][c] > 0) tiles.push({ r: r, c: c, lv: grid[r][c] });
      }
      var out = 0, j = 0;
      while (j < tiles.length) {
        var dest = cells[out];
        if (j + 1 < tiles.length && tiles[j].lv === tiles[j + 1].lv && tiles[j].lv < MAXL) {
          var lv = tiles[j].lv + 1;
          ng[dest[0]][dest[1]] = lv;
          merges.push({ r: dest[0], c: dest[1], level: lv });
          slides.push({ fr: tiles[j].r, fc: tiles[j].c, tr: dest[0], tc: dest[1], lv: tiles[j].lv });
          slides.push({ fr: tiles[j + 1].r, fc: tiles[j + 1].c, tr: dest[0], tc: dest[1], lv: tiles[j].lv });
          j += 2; moved = true;
        } else {
          var t = tiles[j];
          ng[dest[0]][dest[1]] = t.lv;
          slides.push({ fr: t.r, fc: t.c, tr: dest[0], tc: dest[1], lv: t.lv });
          if (t.r !== dest[0] || t.c !== dest[1]) moved = true;
          j += 1;
        }
        out++;
      }
    }
    return { grid: ng, moved: moved, merges: merges, slides: slides };
  }
  function canMoveGrid(grid) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var v = grid[r][c];
      if (v === 0) return true;
      if (v < MAXL) {
        if (c + 1 < N && grid[r][c + 1] === v) return true;
        if (r + 1 < N && grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  /* ---------------- 布局常量（逻辑坐标） ---------------- */
  var LW = 750, LH = 1334;
  var BOARD = { x: 45, y: 596, cell: 150, gap: 12 }; // 4*150+5*12=660
  BOARD.w = N * BOARD.cell + (N + 1) * BOARD.gap;
  function cellXY(r, c) {
    return {
      x: BOARD.x + BOARD.gap + c * (BOARD.cell + BOARD.gap),
      y: BOARD.y + BOARD.gap + r * (BOARD.cell + BOARD.gap)
    };
  }

  /* ---------------- 游戏实例 ---------------- */
  function createGame(opts) {
    var canvas = opts.canvas;
    var ctx = canvas.getContext('2d');
    var storage = opts.storage || { get: function () { return null; }, set: function () {} };
    var rng = mulberry32(opts.seed != null ? opts.seed : (Date.now() & 0xffffffff));
    var dpr = opts.dpr || 1;
    var view = { scale: 1, ox: 0, oy: 0 };
    var W = 0, H = 0;

    var g = {
      ruleset: RULESET,
      state: 'title',           // title | dialogue | play | over | win
      grid: emptyGrid(),
      score: 0, best: Number(storage.get('dm_best') || 0),
      hp: RULESET.player.maxHP, shield: 0,
      chapter: 0, wave: 0,
      monster: null, attackIn: 0,
      moves: 0, mergeCount: 0, kills: 0,
      slides: null, slideT: 0,
      pops: {}, spawns: {}, fxs: [],
      floaters: [], shake: 0, monsterFlash: 0, playerFlash: 0,
      banner: null, pendingWave: 0,
      dialogue: null, confirmRestart: false,
      overReason: '', time: 0, buttons: [],
      ended: false
    };

    function resize(w, h) {
      W = canvas.width = Math.round(w * dpr);
      H = canvas.height = Math.round(h * dpr);
      view.scale = Math.min(W / LW, H / LH);
      view.ox = (W - LW * view.scale) / 2;
      view.oy = (H - LH * view.scale) / 2;
    }
    resize(opts.width, opts.height);

    /* ---------- 运行流程 ---------- */
    function monsterDef(ch, wv) { return RULESET.chapters[ch].monsters[wv]; }
    function spawnMonster() {
      var d = monsterDef(g.chapter, g.wave);
      g.monster = { def: d, hp: d.hp, max: d.hp };
      g.attackIn = d.interval;
      // 换波/换章后棋盘可能已锁死，避免软锁
      if (!canMoveGrid(g.grid)) gameOver('board');
    }
    function spawnTile() {
      var empt = [];
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (g.grid[r][c] === 0) empt.push([r, c]);
      if (!empt.length) return;
      var p = empt[Math.floor(rng() * empt.length)];
      var lv = rng() < RULESET.board.spawnLv1Prob ? 1 : 2;
      g.grid[p[0]][p[1]] = lv;
      g.spawns[p[0] + ',' + p[1]] = 0;
    }
    function startRun() {
      g.grid = emptyGrid();
      g.score = 0; g.hp = RULESET.player.maxHP; g.shield = 0;
      g.chapter = 0; g.wave = 0; g.moves = 0; g.mergeCount = 0; g.kills = 0;
      g.floaters = []; g.pops = {}; g.spawns = {}; g.slides = null; g.fxs = [];
      g.banner = null; g.pendingWave = 0; g.confirmRestart = false; g.ended = false;
      for (var i = 0; i < RULESET.board.initialTiles; i++) spawnTile();
      spawnMonster();
      g.state = 'play';
    }
    function showDialogue(lines, onDone) {
      g.dialogue = { lines: lines, idx: 0, onDone: onDone };
      g.state = 'dialogue';
    }
    function startNewGame() {
      showDialogue(RULESET.story.intro, startRun);
    }
    function saveBest() {
      if (g.score > g.best) { g.best = g.score; try { storage.set('dm_best', String(g.best)); } catch (e) {} }
    }
    function gameOver(reason) {
      g.overReason = reason; g.ended = true; saveBest(); g.state = 'over';
    }
    function addFloater(x, y, text, color, size) {
      g.floaters.push({ x: x, y: y, text: text, color: color, size: size || 34, t: 0 });
    }

    /* ---------- 合并结算 ---------- */
    function applyMerge(m) {
      var lv = m.level;
      g.mergeCount++;
      g.score += RULESET.scorePerMerge(lv);
      var pos = cellXY(m.r, m.c);
      var cx = pos.x + BOARD.cell / 2, cy = pos.y + BOARD.cell / 2;
      var heal = RULESET.mergeHeal[lv] || 0;
      var dmg = RULESET.mergeDamage[lv] || 0;
      var sh = RULESET.mergeShield[lv] || 0;
      if (heal) {
        g.hp = clamp(g.hp + heal, 0, RULESET.player.maxHP);
        addFloater(160, 300, '+' + heal + ' HP', '#7ee2a0', 36);
        addFloater(cx, cy - 20, '+' + heal, '#7ee2a0', 30);
      }
      if (sh) {
        g.shield = clamp(g.shield + sh, 0, RULESET.player.shieldCap);
        addFloater(160, 348, '🛡 +' + sh, '#9fc6ff', 34);
      }
      if (dmg && g.monster) {
        g.monster.hp -= dmg;
        g.monsterFlash = 200;
        addFloater(565, 300, '-' + dmg, '#ff6b5e', dmg >= 24 ? 46 : 36);
        addFloater(cx, cy - 20, '⚔' + dmg, '#ffb199', 30);
      }
    }
    function monsterAttack() {
      var d = g.monster.def, dmg = d.atk, blocked = Math.min(g.shield, dmg);
      g.shield -= blocked;
      var real = dmg - blocked;
      g.hp -= real;
      g.shake = 260; g.playerFlash = 240;
      if (blocked > 0) addFloater(160, 300, '🛡 抵挡 ' + blocked, '#9fc6ff', 34);
      if (real > 0) addFloater(160, 348, '-' + real + ' HP', '#ff6b5e', 40);
      g.attackIn = d.interval;
      if (g.hp <= 0) { g.hp = 0; gameOver('hp'); }
    }
    function onWaveCleared() {
      g.kills++;
      g.hp = clamp(g.hp + RULESET.player.waveClearHeal, 0, RULESET.player.maxHP);
      g.banner = { text: '感染体消灭！搜刮物资 +' + RULESET.player.waveClearHeal + ' HP', t: 0 };
      addFloater(160, 300, '+' + RULESET.player.waveClearHeal + ' HP', '#7ee2a0', 36);
      g.pendingWave = RULESET.anim.waveDelayMs;
      saveBest();
    }
    function advanceWave() {
      if (g.wave < RULESET.chapters[g.chapter].monsters.length - 1) {
        g.wave++; spawnMonster();
      } else if (g.chapter < RULESET.chapters.length - 1) {
        g.chapter++; g.wave = 0;
        var lines = g.chapter === 1 ? RULESET.story.chapter2 : RULESET.story.chapter3;
        showDialogue(lines, function () { spawnMonster(); if (!g.ended) g.state = 'play'; });
      } else {
        g.ended = true; saveBest();
        showDialogue(RULESET.story.ending, function () { g.state = 'win'; });
      }
    }

    /* ---------- 玩家移动 ---------- */
    function tryMove(dir) {
      if (g.state !== 'play' || g.pendingWave > 0 || g.confirmRestart) return false;
      var res = moveGrid(g.grid, dir);
      if (!res.moved) return false;
      g.grid = res.grid;
      g.slides = res.slides; g.slideT = 0;
      g.pops = {}; g.fxs = [];
      for (var i = 0; i < res.merges.length; i++) {
        var m = res.merges[i];
        g.pops[m.r + ',' + m.c] = 0;
        g.fxs.push({ r: m.r, c: m.c, t: 0 });
        applyMerge(m);
      }
      spawnTile();
      g.moves++;
      if (g.monster.hp <= 0) {
        onWaveCleared();
      } else {
        g.attackIn--;
        if (g.attackIn <= 0) monsterAttack();
        if (g.state === 'play' && !canMoveGrid(g.grid)) gameOver('board');
      }
      return true;
    }

    /* ---------- 点击 / 对话 ---------- */
    function tap(x, y) {
      // 按钮命中（后画的优先）
      for (var i = g.buttons.length - 1; i >= 0; i--) {
        var b = g.buttons[i];
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { b.fn(); return; }
      }
      if (g.confirmRestart) return;
      if (g.state === 'dialogue') {
        g.dialogue.idx++;
        if (g.dialogue.idx >= g.dialogue.lines.length) {
          var fn = g.dialogue.onDone; g.dialogue = null;
          if (fn) fn(); else g.state = 'play';
        }
      }
    }
    function askRestart() { g.confirmRestart = true; }

    /* ---------- 帧更新 ---------- */
    function update(dt) {
      g.time += dt;
      if (g.slideT < RULESET.anim.slideMs) g.slideT += dt;
      var k;
      for (k in g.pops) { g.pops[k] += dt; if (g.pops[k] > RULESET.anim.popMs) delete g.pops[k]; }
      for (k in g.spawns) { g.spawns[k] += dt; if (g.spawns[k] > RULESET.anim.spawnMs) delete g.spawns[k]; }
      for (var fi = g.fxs.length - 1; fi >= 0; fi--) {
        g.fxs[fi].t += dt;
        if (g.fxs[fi].t > G.Sprites.FX_DURATION) g.fxs.splice(fi, 1);
      }
      for (var i = g.floaters.length - 1; i >= 0; i--) {
        g.floaters[i].t += dt;
        if (g.floaters[i].t > RULESET.anim.floaterMs) g.floaters.splice(i, 1);
      }
      if (g.shake > 0) g.shake -= dt;
      if (g.monsterFlash > 0) g.monsterFlash -= dt;
      if (g.playerFlash > 0) g.playerFlash -= dt;
      if (g.banner) { g.banner.t += dt; if (g.banner.t > 1600) g.banner = null; }
      if (g.pendingWave > 0) {
        g.pendingWave -= dt;
        if (g.pendingWave <= 0) { g.pendingWave = 0; advanceWave(); }
      }
    }

    /* ---------- 绘制辅助 ---------- */
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    function txt(s, x, y, size, color, align, bold) {
      ctx.font = (bold ? 'bold ' : '') + size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    }
    function emoji(s, x, y, size) {
      ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s, x, y);
    }
    function wrapText(s, maxW, size) {
      ctx.font = size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      var lines = [], cur = '';
      for (var i = 0; i < s.length; i++) {
        var t = cur + s[i];
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = s[i]; }
        else cur = t;
      }
      if (cur) lines.push(cur);
      return lines;
    }
    function button(id, x, y, w, h, label, fn, style) {
      g.buttons.push({ id: id, x: x, y: y, w: w, h: h, fn: fn });
      ctx.save();
      rr(x, y, w, h, 16);
      ctx.fillStyle = style === 'ghost' ? 'rgba(255,255,255,0.08)' : '#c9553d';
      ctx.fill();
      ctx.strokeStyle = style === 'ghost' ? 'rgba(255,255,255,0.35)' : '#ffb199';
      ctx.lineWidth = 2; ctx.stroke();
      txt(label, x + w / 2, y + h / 2 + 2, 32, '#fff', 'center', true);
      ctx.restore();
    }
    function bar(x, y, w, h, ratio, color, bg) {
      rr(x, y, w, h, h / 2); ctx.fillStyle = bg || 'rgba(0,0,0,0.55)'; ctx.fill();
      if (ratio > 0) {
        ctx.save(); rr(x, y, w, h, h / 2); ctx.clip();
        ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(ratio, 0, 1), h);
        ctx.restore();
      }
      rr(x, y, w, h, h / 2); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    }

    /* ---------- 场景绘制 ---------- */
    function drawScene() {
      var ch = RULESET.chapters[g.chapter];
      var grad = ctx.createLinearGradient(0, 0, 0, 560);
      grad.addColorStop(0, ch.bg[0]); grad.addColorStop(1, ch.bg[1]);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, LW, 560);
      // 血月
      ctx.fillStyle = 'rgba(220,90,70,0.85)';
      ctx.beginPath(); ctx.arc(620, 96, 44, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,90,70,0.15)';
      ctx.beginPath(); ctx.arc(620, 96, 66, 0, Math.PI * 2); ctx.fill();
      // 废墟剪影
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      var bs = [[0, 300, 70, 160], [80, 260, 60, 200], [150, 330, 90, 130], [250, 280, 55, 180],
                [315, 340, 80, 120], [405, 250, 65, 210], [480, 320, 95, 140], [585, 285, 60, 175], [655, 330, 95, 130]];
      for (var i = 0; i < bs.length; i++) ctx.fillRect(bs[i][0], bs[i][1], bs[i][2], bs[i][3]);
      // 地面
      ctx.fillStyle = '#241d1a'; ctx.fillRect(0, 452, LW, 108);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, 452, LW, 4);

      // 顶部信息
      txt(ch.name, 40, 44, 30, '#e8dcc8', 'left', true);
      txt('分数 ' + g.score, 710, 44, 30, '#ffd98a', 'right', true);
      txt('最佳 ' + g.best, 710, 82, 22, 'rgba(255,255,255,0.5)', 'right');
      // 波次点
      var mons = ch.monsters;
      for (var w = 0; w < mons.length; w++) {
        ctx.beginPath(); ctx.arc(46 + w * 30, 84, 8, 0, Math.PI * 2);
        ctx.fillStyle = w < g.wave ? '#7ee2a0' : (w === g.wave ? '#ffd98a' : 'rgba(255,255,255,0.25)');
        ctx.fill();
      }

      // 玩家
      var px = 160, py = 452, bob = Math.sin(g.time / 400) * 3;
      ctx.save();
      if (g.playerFlash > 0 && Math.floor(g.time / 60) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(px, py + 4, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3d4a56'; ctx.fillRect(px - 16, py - 62 + bob, 12, 62); ctx.fillRect(px + 4, py - 62 + bob, 12, 62); // 腿
      ctx.fillStyle = '#5a6e46'; rr(px - 24, py - 118 + bob, 48, 62, 10); ctx.fill(); // 躯干
      ctx.fillStyle = '#4a3b2e'; rr(px - 34, py - 112 + bob, 14, 44, 6); ctx.fill(); // 背包
      ctx.fillStyle = '#e8c39e'; ctx.beginPath(); ctx.arc(px, py - 138 + bob, 20, 0, Math.PI * 2); ctx.fill(); // 头
      ctx.fillStyle = '#8a4b3b'; rr(px - 22, py - 158 + bob, 44, 16, 8); ctx.fill(); // 帽
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px + 10, py - 96 + bob); ctx.lineTo(px + 58, py - 104 + bob); ctx.stroke(); // 枪
      ctx.restore();
      if (g.shield > 0) {
        ctx.strokeStyle = 'rgba(159,198,255,0.7)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py - 90, 74, 0, Math.PI * 2); ctx.stroke();
      }
      // 玩家血条
      txt('阿岩', 40, 128, 26, '#e8dcc8', 'left', true);
      bar(40, 148, 250, 22, g.hp / RULESET.player.maxHP, g.hp > 30 ? '#6fce8a' : '#e05545');
      txt(g.hp + '/' + RULESET.player.maxHP, 165, 160, 18, '#fff', 'center', true);
      if (g.shield > 0) txt('🛡 ' + g.shield, 40, 196, 22, '#9fc6ff', 'left', true);

      // 怪物
      if (g.monster) {
        var mx = 565, my = 452, mb = Math.sin(g.time / 300 + 2) * 5;
        var dying = g.monster.hp <= 0;
        ctx.save();
        if (dying) ctx.globalAlpha = clamp(g.pendingWave / RULESET.anim.waveDelayMs, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(mx, my + 4, 56, 12, 0, 0, Math.PI * 2); ctx.fill();
        emoji(g.monster.def.icon, mx, my - 66 + mb, 104);
        if (g.monsterFlash > 0) {
          ctx.globalAlpha = g.monsterFlash / 200 * 0.6;
          ctx.fillStyle = '#ff5040';
          ctx.beginPath(); ctx.arc(mx, my - 66, 62, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        txt(g.monster.def.name, 710, 128, 26, '#f0b9a8', 'right', true);
        bar(430, 148, 280, 22, Math.max(0, g.monster.hp) / g.monster.max, '#e05545');
        txt(Math.max(0, g.monster.hp) + '/' + g.monster.max, 570, 160, 18, '#fff', 'center', true);
        if (!dying) {
          var urgent = g.attackIn <= 2;
          var pulse = urgent ? (0.7 + 0.3 * Math.sin(g.time / 120)) : 1;
          ctx.save(); ctx.globalAlpha = pulse;
          rr(452, 186, 236, 40, 20);
          ctx.fillStyle = urgent ? 'rgba(224,85,69,0.85)' : 'rgba(0,0,0,0.5)'; ctx.fill();
          txt('⚔ ' + g.attackIn + ' 步后攻击 -' + g.monster.def.atk, 570, 207, 22, '#fff', 'center', true);
          ctx.restore();
        }
      }
      // 飘字
      for (var f = 0; f < g.floaters.length; f++) {
        var fl = g.floaters[f], t = fl.t / RULESET.anim.floaterMs;
        ctx.save(); ctx.globalAlpha = 1 - t * t;
        txt(fl.text, fl.x, fl.y - easeOut(t) * 60, fl.size, fl.color, 'center', true);
        ctx.restore();
      }
      // 横幅
      if (g.banner) {
        var bt = g.banner.t / 1600;
        ctx.save(); ctx.globalAlpha = bt < 0.1 ? bt / 0.1 : (bt > 0.8 ? (1 - bt) / 0.2 : 1);
        rr(90, 490, 570, 52, 26); ctx.fillStyle = 'rgba(201,162,39,0.9)'; ctx.fill();
        txt(g.banner.text, 375, 517, 26, '#1c1508', 'center', true);
        ctx.restore();
      }
    }

    /* ---------- 棋盘绘制 ---------- */
    function drawTile(x, y, lv, scale) {
      var def = RULESET.tiles[lv];
      ctx.save();
      ctx.translate(x + BOARD.cell / 2, y + BOARD.cell / 2);
      ctx.scale(scale, scale);
      rr(-BOARD.cell / 2, -BOARD.cell / 2, BOARD.cell, BOARD.cell, 18);
      ctx.fillStyle = def.color; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.stroke();
      if (lv >= 8) { ctx.strokeStyle = 'rgba(255,220,120,0.8)'; ctx.lineWidth = 3; ctx.stroke(); }
      if (!(G.Sprites && G.Sprites.drawSupply(ctx, lv, 0, -32, 66, g.time))) emoji(def.icon, 0, -22, 62);
      txt(def.name, 0, 38, 24, '#fff', 'center', true);
      txt('Lv' + lv, -BOARD.cell / 2 + 14, -BOARD.cell / 2 + 18, 18, 'rgba(255,255,255,0.65)', 'left');
      ctx.restore();
    }
    function drawBoard() {
      function drawFxLayer() {
        if (!g.fxs || !g.fxs.length || !G.Sprites) return;
        for (var i = 0; i < g.fxs.length; i++) {
          var f = g.fxs[i], fp = cellXY(f.r, f.c);
          G.Sprites.drawFx(ctx, fp.x + BOARD.cell / 2, fp.y + BOARD.cell / 2, BOARD.cell * 1.85, f.t / G.Sprites.FX_DURATION);
        }
      }
      rr(BOARD.x, BOARD.y, BOARD.w, BOARD.w, 24);
      ctx.fillStyle = '#2a2320'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.stroke();
      var r, c, p;
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        p = cellXY(r, c);
        rr(p.x, p.y, BOARD.cell, BOARD.cell, 18);
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
      }
      var sliding = g.slides && g.slideT < RULESET.anim.slideMs;
      var st = sliding ? easeOut(g.slideT / RULESET.anim.slideMs) : 1;
      var mergedDest = {};
      if (sliding) {
        // 滑动中的源瓦片
        for (var s = 0; s < g.slides.length; s++) {
          var sl = g.slides[s];
          var a = cellXY(sl.fr, sl.fc), b = cellXY(sl.tr, sl.tc);
          drawTile(lerp(a.x, b.x, st), lerp(a.y, b.y, st), sl.lv, 1);
        }
        drawFxLayer();
        return;
      }
      for (r = 0; r < N; r++) for (c = 0; c < N; c++) {
        var lv = g.grid[r][c];
        if (!lv) continue;
        p = cellXY(r, c);
        var key = r + ',' + c, sc = 1;
        if (g.pops[key] != null) {
          var pt = g.pops[key] / RULESET.anim.popMs;
          sc = 1 + 0.18 * Math.sin(pt * Math.PI);
        } else if (g.spawns[key] != null) {
          sc = easeOut(g.spawns[key] / RULESET.anim.spawnMs);
        }
        drawTile(p.x, p.y, lv, sc);
      }
      drawFxLayer();
    }

    /* ---------- 覆盖层 ---------- */
    function dim(a) { ctx.fillStyle = 'rgba(8,6,10,' + a + ')'; ctx.fillRect(0, 0, LW, LH); }
    function drawDialogue() {
      dim(0.55);
      var d = g.dialogue, line = d.lines[d.idx];
      rr(60, 760, 630, 330, 24);
      ctx.fillStyle = 'rgba(24,20,28,0.96)'; ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,39,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
      rr(88, 736, ctx.measureText(line.who).width + 44, 48, 24);
      ctx.fillStyle = '#c9a227'; ctx.fill();
      txt(line.who, 110, 761, 26, '#1c1508', 'left', true);
      var lines = wrapText(line.text, 560, 30);
      for (var i = 0; i < lines.length; i++) txt(lines[i], 96, 830 + i * 46, 30, '#efe6d6', 'left');
      var blink = 0.55 + 0.45 * Math.sin(g.time / 250);
      ctx.save(); ctx.globalAlpha = blink;
      txt('点击继续 ▸ (' + (d.idx + 1) + '/' + d.lines.length + ')', 654, 1056, 24, '#c9a227', 'right', true);
      ctx.restore();
    }
    function drawTitle() {
      var grad = ctx.createLinearGradient(0, 0, 0, LH);
      grad.addColorStop(0, '#141b26'); grad.addColorStop(0.6, '#331a2e'); grad.addColorStop(1, '#1a1210');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = 'rgba(220,90,70,0.8)';
      ctx.beginPath(); ctx.arc(375, 300, 110, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      var bs = [[0, 430, 90, 200], [100, 380, 70, 250], [180, 460, 110, 170], [300, 400, 80, 230],
                [390, 470, 100, 160], [500, 390, 75, 240], [585, 450, 90, 180], [680, 410, 70, 220]];
      for (var i = 0; i < bs.length; i++) ctx.fillRect(bs[i][0], bs[i][1], bs[i][2], bs[i][3]);
      emoji('📡', 375, 300, 120);
      txt('末日信号', 375, 560, 88, '#ffd98a', 'center', true);
      txt('合并物资 · 猎杀感染体 · 发出撤离信号', 375, 640, 30, '#e8dcc8', 'center');
      emoji('🔩', 205, 730, 52); emoji('➕', 275, 730, 40); emoji('🥫', 345, 730, 52);
      emoji('➡', 415, 730, 40); emoji('🔫', 485, 730, 52); emoji('➡', 555, 730, 40); emoji('🧟', 625, 730, 52);
      txt('滑动棋盘合并同级物资：食物药品回血，武器自动攻击怪物', 375, 810, 24, 'rgba(255,255,255,0.75)', 'center');
      txt('怪物按步数倒计时攻击，撑过 3 章 9 波，摧毁母体！', 375, 850, 24, 'rgba(255,255,255,0.75)', 'center');
      button('start', 195, 930, 360, 92, '开 始 生 存', startNewGame);
      txt('历史最佳 ' + g.best, 375, 1080, 26, 'rgba(255,217,138,0.8)', 'center');
      txt('键盘方向键 / 触屏滑动 均可操作', 375, 1130, 22, 'rgba(255,255,255,0.4)', 'center');
    }
    function statRow(label, value, y) {
      txt(label, 200, y, 28, 'rgba(255,255,255,0.7)', 'left');
      txt(String(value), 550, y, 28, '#ffd98a', 'right', true);
    }
    function drawOver() {
      dim(0.72);
      rr(90, 380, 570, 620, 28);
      ctx.fillStyle = 'rgba(30,20,22,0.97)'; ctx.fill();
      ctx.strokeStyle = 'rgba(224,85,69,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      emoji('💀', 375, 460, 80);
      txt('生存失败', 375, 550, 52, '#ff8a75', 'center', true);
      txt(g.overReason === 'hp' ? '你被感染体击倒了……信号中断。' : '物资堆满了营地，再也无法整理……', 375, 610, 26, '#e8dcc8', 'center');
      statRow('到达进度', RULESET.chapters[g.chapter].name.split(' · ')[0] + ' 第' + (g.wave + 1) + '波', 680);
      statRow('最终分数', g.score, 730);
      statRow('消灭感染体', g.kills, 780);
      statRow('合并次数', g.mergeCount, 830);
      statRow('生存步数', g.moves, 880);
      button('retry', 195, 920, 360, 88, '再 来 一 次', startRun);
    }
    function drawWin() {
      var grad = ctx.createLinearGradient(0, 0, 0, LH);
      grad.addColorStop(0, '#2b3a5e'); grad.addColorStop(0.5, '#c97b4a'); grad.addColorStop(1, '#3a2a20');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, LW, LH);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(375, 430, 90, 0, Math.PI * 2); ctx.fill();
      emoji('🚁', 375, 280 + Math.sin(g.time / 350) * 10, 110);
      txt('撤 离 成 功', 375, 560, 64, '#fff3d6', 'center', true);
      txt('母体被摧毁，撤离信号响彻废墟。', 375, 630, 28, '#ffe9c8', 'center');
      rr(120, 690, 510, 260, 24); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      statRow('最终分数', g.score, 740);
      statRow('消灭感染体', g.kills, 790);
      statRow('合并次数', g.mergeCount, 840);
      statRow('生存步数', g.moves, 890);
      button('again', 195, 1010, 360, 88, '再 战 一 局', startRun);
      txt('历史最佳 ' + g.best, 375, 1150, 26, 'rgba(255,243,214,0.85)', 'center');
    }
    function drawConfirm() {
      dim(0.6);
      rr(135, 560, 480, 240, 24);
      ctx.fillStyle = 'rgba(24,20,28,0.98)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
      txt('放弃本局，重新开始？', 375, 620, 30, '#efe6d6', 'center', true);
      button('yes', 165, 680, 190, 76, '重开', function () { g.confirmRestart = false; startRun(); });
      button('no', 395, 680, 190, 76, '继续', function () { g.confirmRestart = false; }, 'ghost');
    }

    /* ---------- 主渲染 ---------- */
    function render() {
      g.buttons = [];
      ctx.fillStyle = '#0a080c'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(view.ox, view.oy); ctx.scale(view.scale, view.scale);
      if (g.shake > 0) {
        var s = g.shake / 260 * 8;
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
      }
      if (g.state === 'title') {
        drawTitle();
      } else if (g.state === 'win') {
        drawWin();
      } else {
        drawScene();
        drawBoard();
        txt('滑动合并物资 · 武器攻击怪物 · 食药品回血', 40, 1290, 24, 'rgba(255,255,255,0.55)', 'left');
        if (g.state === 'play') button('restart', 590, 1262, 120, 52, '↻ 重开', askRestart, 'ghost');
        if (g.state === 'dialogue') drawDialogue();
        if (g.state === 'over') drawOver();
        if (g.confirmRestart) drawConfirm();
      }
      ctx.restore();
    }

    /* ---------- 输入 ---------- */
    function toLogical(cx, cy) {
      return { x: (cx * dpr - view.ox) / view.scale, y: (cy * dpr - view.oy) / view.scale };
    }
    var downPos = null;
    function onDown(cx, cy) { downPos = toLogical(cx, cy); }
    function onUp(cx, cy) {
      if (!downPos) return;
      var p = toLogical(cx, cy);
      var dx = p.x - downPos.x, dy = p.y - downPos.y;
      downPos = null;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 16) { tap(p.x, p.y); return; }
      if (dist >= 28 && g.state === 'play') {
        if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : 0);
        else tryMove(dy > 0 ? 3 : 2);
      }
    }
    function onKey(key) {
      var map = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3, a: 0, d: 1, w: 2, s: 3, A: 0, D: 1, W: 2, S: 3 };
      if (map[key] != null) { tryMove(map[key]); return; }
      if (key === ' ' || key === 'Enter') {
        if (g.state === 'title') startNewGame();
        else if (g.state === 'dialogue') tap(-1, -1);
        else if (g.state === 'over' || g.state === 'win') startRun();
      }
    }
    if (opts.input === 'tt') {
      tt.onTouchStart(function (e) { var t = e.touches[0]; onDown(t.clientX, t.clientY); });
      tt.onTouchEnd(function (e) { var t = e.changedTouches[0]; onUp(t.clientX, t.clientY); });
    } else {
      canvas.addEventListener('pointerdown', function (e) { onDown(e.clientX, e.clientY); });
      canvas.addEventListener('pointerup', function (e) { onUp(e.clientX, e.clientY); });
      canvas.addEventListener('pointercancel', function () { downPos = null; });
      window.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(e.key) >= 0) e.preventDefault();
        onKey(e.key);
      });
    }

    /* ---------- 主循环 ---------- */
    var last = 0, running = true;
    function loop(ts) {
      if (!running) return;
      var dt = last ? clamp(ts - last, 0, 50) : 16;
      last = ts;
      update(dt);
      render();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    /* ---------- 对外接口（含调试） ---------- */
    return {
      ruleset: RULESET,
      resize: resize,
      destroy: function () { running = false; },
      debug: {
        state: function () {
          return {
            state: g.state, grid: g.grid.map(function (r) { return r.slice(); }),
            score: g.score, hp: g.hp, shield: g.shield,
            chapter: g.chapter, wave: g.wave,
            monster: g.monster ? { name: g.monster.def.name, hp: g.monster.hp, max: g.monster.max, atk: g.monster.def.atk } : null,
            attackIn: g.attackIn, moves: g.moves, mergeCount: g.mergeCount, kills: g.kills,
            pendingWave: g.pendingWave, overReason: g.overReason,
            dialogue: g.dialogue ? { idx: g.dialogue.idx, total: g.dialogue.lines.length, who: g.dialogue.lines[g.dialogue.idx] ? g.dialogue.lines[g.dialogue.idx].who : '' } : null
          };
        },
        move: tryMove,
        tap: tap,
        key: onKey,
        start: startNewGame,
        restart: startRun,
        setBoard: function (arr) { for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) g.grid[r][c] = arr[r][c] | 0; },
        setMonsterHP: function (v) { if (g.monster) g.monster.hp = v; },
        setPlayerHP: function (v) { g.hp = v; },
        setAttackIn: function (v) { g.attackIn = v; },
        setShield: function (v) { g.shield = v; }
      }
    };
  }

  G.DM = { RULESET: RULESET, start: createGame, moveGrid: moveGrid, canMoveGrid: canMoveGrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.DM;
})();
