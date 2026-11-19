/* 物资图集 + 合成爆点（可选增强层）
 * 图集放在 assets/，未就绪或加载失败时，绘制方自动回退到 Emoji。
 * H5 与抖音小游戏共用：抖音侧 tt.createImage，H5 侧 Image。
 */
(function () {
  var G = (typeof window !== 'undefined') ? window
        : (typeof GameGlobal !== 'undefined') ? GameGlobal
        : (typeof globalThis !== 'undefined') ? globalThis : this;

  var ATLAS_SRC = 'assets/supply-atlas.png';
  var FX_SRC = 'assets/merge-fx.png';

  var ICON_CELL = 96;    // 物资图集单格（4 x 3）
  var FX_CELL = 128;     // 爆点图集单格（4 x 2）
  var FXN = 8;           // 爆点帧数
  var FX_DURATION = 480; // 爆点总时长（ms）

  var atlas = null, fx = null, pending = 2, ready = false;

  function makeImage(src, onload) {
    try {
      if (typeof tt !== 'undefined' && tt.createImage) {
        var ti = tt.createImage();
        ti.onload = onload; ti.onerror = function () {}; ti.src = src; return ti;
      }
      if (typeof Image !== 'undefined') {
        var hi = new Image();
        hi.onload = onload; hi.onerror = function () {}; hi.src = src; return hi;
      }
    } catch (e) {}
    return null;
  }
  function settle() { pending--; if (pending <= 0) ready = true; }

  atlas = makeImage(ATLAS_SRC, settle);
  fx = makeImage(FX_SRC, settle);
  if (!atlas || !fx) { pending = 0; ready = false; }

  /* lv 1..11 -> 图集索引 0..10；坐标为中心点 */
  function drawSupply(ctx, lv, cx, cy, size, now) {
    if (!ready || !atlas) return false;
    var i = lv - 1;
    if (i < 0 || i > 10) return false;
    var sx = (i % 4) * ICON_CELL, sy = Math.floor(i / 4) * ICON_CELL;
    var breath = [1, 1.03, 1.06, 1.03][Math.floor((now || 0) / 100) % 4];
    var h = size * breath;
    ctx.drawImage(atlas, sx, sy, ICON_CELL, ICON_CELL, cx - h / 2, cy - h / 2, h, h);
    return true;
  }

  /* t: 0..1 播放进度；用 lighter 混合让发光叠加而不是压暗背景 */
  function drawFx(ctx, cx, cy, size, t) {
    if (!ready || !fx) return false;
    var p = t < 0 ? 0 : (t > 1 ? 1 : t);
    var i = Math.min(FXN - 1, Math.floor(p * FXN));
    var sx = (i % 4) * FX_CELL, sy = Math.floor(i / 4) * FX_CELL;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, 1 - Math.pow(p, 3));
    ctx.drawImage(fx, sx, sy, FX_CELL, FX_CELL, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
    return true;
  }

  G.Sprites = {
    supplyReady: function () { return ready; },
    drawSupply: drawSupply,
    drawFx: drawFx,
    FX_DURATION: FX_DURATION
  };
})();
