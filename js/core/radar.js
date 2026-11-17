/**
 * radar.js — 策略雷達圖（純 SVG，無外部函式庫）
 * axes:    [{ key, label }]  由 data.json 的 radarAxes 決定
 * ratings: { [key]: 0–10 }
 */
import { s } from './utils.js';

export function radarChart(axes, ratings = {}, { max = 10 } = {}) {
  const W = 300, H = 250, cx = W / 2, cy = H / 2, R = 82;
  const n = axes.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'radar', role: 'img' });
  if (n < 3) {
    svg.append(s('text', { x: cx, y: cy, 'text-anchor': 'middle', class: 'radar-label' }, '至少需要 3 個評分面向'));
    return svg;
  }
  const point = (i, ratio) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * R * ratio, cy + Math.sin(ang) * R * ratio];
  };
  const poly = (ratioOf) => axes.map((_, i) => point(i, ratioOf(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
  const val = (a) => Math.max(0, Math.min(max, Number(ratings?.[a.key]) || 0));

  // 背景同心格線
  for (const r of [0.25, 0.5, 0.75, 1]) svg.append(s('polygon', { points: poly(() => r), class: 'radar-grid' }));
  // 軸線與標籤
  axes.forEach((a, i) => {
    const [x, y] = point(i, 1);
    svg.append(s('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'radar-grid' }));
    const [lx, ly] = point(i, 1.2);
    const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
    svg.append(s('text', { x: lx, y: ly + 4, 'text-anchor': anchor, class: 'radar-label' }, `${a.label} ${val(a)}`));
  });
  // 資料區塊
  svg.append(s('polygon', { points: poly((i) => val(axes[i]) / max), class: 'radar-area' }));
  axes.forEach((a, i) => {
    const [x, y] = point(i, val(a) / max);
    svg.append(s('circle', { cx: x, cy: y, r: 3, class: 'radar-dot' }));
  });
  svg.setAttribute('aria-label', '策略雷達圖：' + axes.map((a) => `${a.label} ${val(a)}`).join('、'));
  return svg;
}
