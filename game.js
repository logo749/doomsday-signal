/* 抖音小游戏入口：竖屏 Canvas，复用 js/game-core.js */
require('./js/game-core.js');

var sys = tt.getSystemInfoSync();
var canvas = tt.createCanvas(); // 首次调用返回上屏 Canvas
var dpr = Math.min(sys.pixelRatio || 1, 3);

var game = DM.start({
  canvas: canvas,
  width: sys.windowWidth,
  height: sys.windowHeight,
  dpr: dpr,
  input: 'tt',
  storage: {
    get: function (k) { try { return tt.getStorageSync(k); } catch (e) { return null; } },
    set: function (k, v) { try { tt.setStorageSync(k, v); } catch (e) {} }
  }
});

// 切后台回前台时重置时间基准由核心 dt clamp 保证，不会补帧
GameGlobal.__game = game;
