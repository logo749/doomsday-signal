"""一次性素材导入 + 渲染补丁（由 .github/workflows/art-import.yml 调用）。

为什么放在 CI 里：本环境无法直连 git push，二进制图集也过不了文本接口。
脚本幂等：sprites.js 作为导入标记，已导入则只刷新 assets。
"""
import io
import os
import sys
import urllib.request

from PIL import Image, ImageChops

ICON_URL = 'https://aka.doubaocdn.com/s/YuGuYioRZz'
FX_URL = 'https://aka.doubaocdn.com/s/9inXz0PrVD'

SPRITES_JS = '''/* 物资图集 + 合成爆点（可选增强层）
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
'''


def bg_color(im):
    """从四角与边缘中点取背景色（图中是玫红，不是纯品红）。"""
    w, h = im.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]
    px = im.convert('RGB')
    seq = sorted(px.getpixel(p) for p in pts)
    return seq[len(seq) // 2]


def key_bg(im, bg, lo=34, span=58):
    """按背景色抠像，并对边缘做去渗色，避免缩放把背景色带进轮廓。"""
    im = im.convert('RGBA')
    r, g, b, a0 = im.split()
    diff = ImageChops.difference(im.convert('RGB'), Image.new('RGB', im.size, bg))
    dr, dg, db = diff.split()
    d = ImageChops.lighter(ImageChops.lighter(dr, dg), db)
    alpha = d.point(lambda v: max(0, min(255, int((v - lo) * 255 / span))))
    if a0.getextrema()[0] < 255:
        alpha = ImageChops.darker(alpha, a0)
    mask = alpha.point(lambda v: 255 if v < 205 else 0)
    capr = g.point(lambda v: min(255, int(v * 1.2 + bg[0] * 0.1 + 12)))
    capb = g.point(lambda v: min(255, int(v * 1.2 + bg[2] * 0.1 + 12)))
    r2 = Image.composite(ImageChops.darker(r, capr), r, mask)
    b2 = Image.composite(ImageChops.darker(b, capb), b, mask)
    return Image.merge('RGBA', (r2, g, b2, alpha))


def save_quant(im, path, colors=64):
    """64 色量化但保住 alpha：Pillow 直接量化 RGBA 会丢透明，这里分开处理。"""
    a = im.getchannel('A')
    solid = Image.new('RGB', im.size, (0, 0, 0))
    rgb = Image.composite(im.convert('RGB'), solid, a.point(lambda v: 255 if v > 0 else 0))
    p = rgb.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGBA')
    p.putalpha(a)
    p.save(path, optimize=True)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGBA')


def build_assets():
    os.makedirs('assets', exist_ok=True)
    raw = fetch(ICON_URL)
    bg = bg_color(raw)
    icon = key_bg(raw, bg).resize((384, 288), Image.LANCZOS)
    icon = key_bg(icon, bg, lo=26, span=34)
    save_quant(icon, 'assets/supply-atlas.png')

    fx = fetch(FX_URL)
    w, h = fx.size
    cells = []
    for r in range(2):
        for c in range(2):
            cells.append(fx.crop((c * w // 2, r * h // 2, (c + 1) * w // 2, (r + 1) * h // 2)))

    def place(im, s, can=128):
        w2, h2 = round(im.width * s), round(im.height * s)
        resized = im.resize((w2, h2), Image.LANCZOS)
        cv = Image.new('RGBA', (can, can), (0, 0, 0, 0))
        cv.alpha_composite(resized, ((can - w2) // 2, (can - h2) // 2))
        return cv

    seq = [cells[0], Image.blend(cells[0], cells[1], 0.5), cells[1],
           Image.blend(cells[1], cells[2], 0.5), cells[2],
           Image.blend(cells[2], cells[3], 0.5), cells[3]]
    tail = place(cells[3], 0.92)
    tail.putalpha(tail.getchannel('A').point(lambda v: int(v * 0.5)))
    seq.append(tail)

    scales = [1.00, 1.04, 1.08, 1.12, 1.16, 1.20, 1.24, 1.24]
    atlas = Image.new('RGBA', (512, 256), (0, 0, 0, 0))
    for i, (im, s) in enumerate(zip(seq, scales)):
        row, col = divmod(i, 4)
        atlas.alpha_composite(place(im, s), (col * 128, row * 128))
    atlas.quantize(colors=64, method=Image.FASTOCTREE, dither=Image.NONE) \
        .save('assets/merge-fx.png', optimize=True)
    print('assets written')


# (文件, 旧串, 新串)；新串已存在则跳过，旧串缺失则报错
PATCHES = [
    ('js/game-core.js',
     "      pops: {}, spawns: {},\n      floaters:",
     "      pops: {}, spawns: {}, fxs: [],\n      floaters:"),
    ('js/game-core.js',
     "      g.floaters = []; g.pops = {}; g.spawns = {}; g.slides = null;",
     "      g.floaters = []; g.pops = {}; g.spawns = {}; g.slides = null; g.fxs = [];"),
    ('js/game-core.js',
     "      g.pops = {};\n      for (var i = 0; i < res.merges.length; i++) {\n"
     "        var m = res.merges[i];\n        g.pops[m.r + ',' + m.c] = 0;\n        applyMerge(m);",
     "      g.pops = {}; g.fxs = [];\n      for (var i = 0; i < res.merges.length; i++) {\n"
     "        var m = res.merges[i];\n        g.pops[m.r + ',' + m.c] = 0;\n"
     "        g.fxs.push({ r: m.r, c: m.c, t: 0 });\n        applyMerge(m);"),
    ('js/game-core.js',
     "      for (k in g.spawns) { g.spawns[k] += dt; if (g.spawns[k] > RULESET.anim.spawnMs) delete g.spawns[k]; }",
     "      for (k in g.spawns) { g.spawns[k] += dt; if (g.spawns[k] > RULESET.anim.spawnMs) delete g.spawns[k]; }\n"
     "      for (var fi = g.fxs.length - 1; fi >= 0; fi--) {\n"
     "        g.fxs[fi].t += dt;\n        if (g.fxs[fi].t > G.Sprites.FX_DURATION) g.fxs.splice(fi, 1);\n      }"),
    ('js/game-core.js',
     "      emoji(def.icon, 0, -22, 62);",
     "      if (!(G.Sprites && G.Sprites.drawSupply(ctx, lv, 0, -32, 66, g.time))) emoji(def.icon, 0, -22, 62);"),
    ('js/game-core.js',
     "    function drawBoard() {\n      rr(BOARD.x, BOARD.y, BOARD.w, BOARD.w, 24);",
     "    function drawBoard() {\n"
     "      function drawFxLayer() {\n"
     "        if (!g.fxs || !g.fxs.length || !G.Sprites) return;\n"
     "        for (var i = 0; i < g.fxs.length; i++) {\n"
     "          var f = g.fxs[i], fp = cellXY(f.r, f.c);\n"
     "          G.Sprites.drawFx(ctx, fp.x + BOARD.cell / 2, fp.y + BOARD.cell / 2, BOARD.cell * 1.85, f.t / G.Sprites.FX_DURATION);\n"
     "        }\n"
     "      }\n"
     "      rr(BOARD.x, BOARD.y, BOARD.w, BOARD.w, 24);"),
    ('js/game-core.js',
     "          drawTile(lerp(a.x, b.x, st), lerp(a.y, b.y, st), sl.lv, 1);\n        }\n        return;",
     "          drawTile(lerp(a.x, b.x, st), lerp(a.y, b.y, st), sl.lv, 1);\n        }\n        drawFxLayer();\n        return;"),
    ('js/game-core.js',
     "        drawTile(p.x, p.y, lv, sc);\n      }\n    }",
     "        drawTile(p.x, p.y, lv, sc);\n      }\n      drawFxLayer();\n    }"),
    ('index.html',
     '<script src="js/game-core.js"></script>',
     '<script src="js/sprites.js"></script>\n<script src="js/game-core.js"></script>'),
    ('game.js',
     "require('./js/game-core.js');",
     "require('./js/sprites.js');\nrequire('./js/game-core.js');"),
    ('README.md',
     "- 技术：纯 Canvas 2D，零依赖、零外部资源（图标用系统 Emoji），抖音小游戏与 H5 共用同一核心",
     "- 技术：纯 Canvas 2D，零依赖；物资图标与合成爆点来自 AI 生成图集（`assets/`），未就绪自动回退 Emoji；抖音小游戏与 H5 共用同一核心"),
    ('README.md',
     "├── js/game-core.js       # 规则集 + 逻辑 + 渲染 + 输入（双端共用）",
     "├── js/game-core.js       # 规则集 + 逻辑 + 渲染 + 输入（双端共用）\n"
     "├── js/sprites.js         # 图集与爆点绘制层（未就绪回退 Emoji）\n"
     "├── assets/               # AI 生成图集（物资 4x3 / 爆点 4x2）"),
    ('README.md',
     "- Emoji 图标在不同设备字体下观感略有差异；正式美术可替换 `drawTile/emoji` 为图集",
     "- 抖音运行时未实测；图集为 64 色量化 PNG，若后续换更高精度美术需同步调 `sprites.js` 的格宽"),
]


def apply_patches():
    files = {}
    changed = 0
    for path, old, new in PATCHES:
        if path not in files:
            if not os.path.exists(path):
                sys.exit('missing file: ' + path)
            files[path] = open(path, encoding='utf-8').read()
        s = files[path]
        if new in s and old not in s:
            continue  # 已打过
        if old not in s:
            sys.exit('anchor missing in %s: %r' % (path, old[:60]))
        if s.count(old) > 1:
            sys.exit('ambiguous anchor in %s: %r' % (path, old[:60]))
        files[path] = s.replace(old, new)
        changed += 1
    for path, s in files.items():
        open(path, 'w', encoding='utf-8').write(s)
    print('patches applied: %d change(s) in %d file(s)' % (changed, len(files)))


if __name__ == '__main__':
    if '--no-assets' not in sys.argv:
        build_assets()
    if not os.path.exists('js/sprites.js'):
        open('js/sprites.js', 'w', encoding='utf-8').write(SPRITES_JS)
        print('sprites.js written')
        apply_patches()
    else:
        # sprites.js 是导入标记：已导入则只刷新 assets，不再动源码
        print('sprites.js exists; rendering patches skipped')
