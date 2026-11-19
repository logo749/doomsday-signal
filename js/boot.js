/* 分支原型：压缩载荷解码 + 启动（H5 体验版；抖音构建见 main） */
(async function () {
  function fallback() {
    document.body.innerHTML = '<pre style="color:#f88;padding:24px;font-size:16px">当前浏览器不支持 DecompressionStream，请用 Chrome / Edge / Safari 16+ 打开。</pre>';
  }
  if (typeof DecompressionStream === 'undefined') { fallback(); return; }
  try {
    var names = ['js/core.b64.1', 'js/core.b64.2', 'js/core.b64.3', 'js/core.b64.4'];
    var texts = await Promise.all(names.map(function (n) {
      return fetch(n, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(n + ' ' + r.status);
        return r.text();
      });
    }));
    var b64 = texts.join('').replace(/[^A-Za-z0-9+/=]/g, '');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var out = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer();
    (0, eval)(new TextDecoder('utf-8').decode(out));

    var canvas = document.getElementById('game');
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var params = new URLSearchParams(location.search);
    var seed = params.has('seed') ? Number(params.get('seed')) : undefined;
    var game = window.DM.start({
      canvas: canvas, width: window.innerWidth, height: window.innerHeight, dpr: dpr,
      input: 'dom', seed: seed,
      storage: {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
      }
    });
    window.addEventListener('resize', function () { game.resize(window.innerWidth, window.innerHeight); });
    window.__game = game;
  } catch (e) {
    fallback();
    throw e;
  }
})();
