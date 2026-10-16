export const mk = (w, h, fill = '.') => Array.from({ length: h }, () => Array(w).fill(fill));
export const put = (g, x, y, s) => { for (let i = 0; i < s.length; i++) g[y][x + i] = s[i]; };
export const col = (g, x, y0, y1, ch) => { for (let y = y0; y <= y1; y++) g[y][x] = ch; };
export const ground = (g, rows = [12, 13]) => { for (const y of rows) for (let x = 0; x < g[0].length; x++) g[y][x] = '#'; };
export const gap = (g, a, b, rows = [12, 13]) => { for (let x = a; x <= b; x++) for (const y of rows) g[y][x] = '.'; };
export const out = (g) => g.map(r => r.join('')).join('\n');
