// 題庫設定裡的落點／構面顏色（例如 #3182ce、#e53e3e）是當作「品牌色」挑的，直接
// 拿來當白字徽章的底色時，有些對比不到 WCAG AA 的 4.5:1（白字配 #3182ce 只有
// 4.0:1）。這裡在「保留色相」的前提下把底色調深到剛好達標，徽章看起來還是同一個
// 顏色，只是深一點（Sprint 8 驗收條件 8.1）。

function channels(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 白字在這個底色上的對比值。 */
export function contrastWithWhite(hex) {
  return 1.05 / (luminance(channels(hex)) + 0.05);
}

const cache = new Map();

/** 回傳可以放白字的底色：原色已達 4.5:1 就原樣回傳，否則等比例調深到達標為止。 */
export function badgeBg(hex) {
  if (typeof hex !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return hex;
  if (cache.has(hex)) return cache.get(hex);
  let rgb = channels(hex);
  let out = hex;
  for (let i = 0; i < 40 && contrastWithWhite(out) < 4.6; i += 1) {
    rgb = rgb.map((v) => v * 0.96);
    out = `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  }
  cache.set(hex, out);
  return out;
}

// ── 構面文字色（亮色／深色各一組）────────────────────────────
// 構面顏色直接當文字色時，在亮色底上有些太淺（綠 3.2:1、橘 3.4:1），在深色底上
// 有些太深（深棕 2.0:1）。算出兩組各自達到 4.5:1 的版本，透過 CSS 變數交給
// index.css 的 .dim-text 依模式切換——色相不變，只調明暗。

const LIGHT_SURFACES = ['#ffffff', '#fefdfb', '#f6f1e7', '#f6ecd7'];
const DARK_SURFACES = ['#231d15', '#1c1610', '#17130e', '#2a2217'];

function ratio(a, b) {
  const [x, y] = [luminance(channels(a)), luminance(channels(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const worst = (hex, surfaces) => Math.min(...surfaces.map((s) => ratio(hex, s)));

function adjust(hex, surfaces, toward) {
  let rgb = channels(hex);
  let out = toHex(rgb);
  for (let i = 0; i < 60 && worst(out, surfaces) < 4.6; i += 1) {
    rgb = toward === 'dark' ? rgb.map((v) => v * 0.95) : rgb.map((v) => v + (255 - v) * 0.08);
    out = toHex(rgb);
  }
  return out;
}

const textCache = new Map();

/** 給「用構面顏色當文字色」的元素用：搭配 className="dim-text"。非 hex 值原樣當 color。 */
export function dimTextStyle(hex) {
  if (typeof hex !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return { color: hex };
  if (!textCache.has(hex)) {
    textCache.set(hex, {
      '--dim-light': adjust(hex, LIGHT_SURFACES, 'dark'),
      '--dim-dark': adjust(hex, DARK_SURFACES, 'light'),
    });
  }
  return textCache.get(hex);
}
