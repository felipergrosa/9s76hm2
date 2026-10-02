// Gera tabelas markdown: permissao -> enforcement backend / uso frontend
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');

const cat = fs.readFileSync(path.join(root, 'backend/src/modules/permissions/catalog.ts'), 'utf8');

// Extrai grupos do AVAILABLE_PERMISSIONS na ordem declarada
const groups = {};
const grpRe = /(\w+):\s*\[([\s\S]*?)\]/g;
let g;
while ((g = grpRe.exec(cat))) {
  groups[g[1]] = [...g[2].matchAll(/"([a-z][a-z0-9-]+\.[a-z-*]+)"/g)].map(m => m[1]);
}
const keys = [...new Set(Object.values(groups).flat())];

const files = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return walk(p);
  if (/\.(ts|js)$/.test(e.name) && !p.includes('node_modules')) files.push(p);
});
walk(path.join(root, 'backend/src'));
walk(path.join(root, 'frontend/src'));

// Pontos de registro (catalogo/labels) nao contam como enforcement
const REGISTRY = new Set([
  'backend/src/modules/permissions/catalog.ts',
  'backend/src/helpers/PermissionAdapter.ts',
  'backend/src/database/migrations/20261006000001-admin-role-composition.ts',
  'frontend/src/routes/PrivateRoute.js' // PERMISSION_LABELS map — registro, nao gate
]);

const beMap = {}, feMap = {};
for (const p of files) {
  const c = fs.readFileSync(p, 'utf8');
  const rel = path.relative(root, p).replace(/\\/g, '/');
  if (REGISTRY.has(rel)) continue;
  const isBack = rel.startsWith('backend');
  for (const m of c.matchAll(/["']([a-z][a-z0-9-]*\.[a-z-*]+)["']/g)) {
    if (!keys.includes(m[1])) continue;
    const map = isBack ? beMap : feMap;
    (map[m[1]] = map[m[1]] || new Set()).add(rel);
  }
}

const short = f => f.replace('backend/src/', '').replace('frontend/src/', '');
const cell = set => set && set.size ? [...set].map(short).map(s => '`' + s + '`').join('<br>') : '—';

let md = '';
for (const [grp, ks] of Object.entries(groups)) {
  md += `\n### ${grp}\n\n| Permissão | Backend (enforcement) | Frontend (uso) |\n|---|---|---|\n`;
  for (const k of ks) md += `| \`${k}\` | ${cell(beMap[k])} | ${cell(feMap[k])} |\n`;
}
fs.writeFileSync(path.join(__dirname, '.perm-tables.md'), md);
console.log('grupos:', Object.keys(groups).join(', '), '| chaves:', keys.length);
console.log('backend-only:', keys.filter(k => beMap[k] && !feMap[k]).length, '| front-only:', keys.filter(k => !beMap[k] && feMap[k]).length, '| ambos:', keys.filter(k => beMap[k] && feMap[k]).length, '| nenhum:', keys.filter(k => !beMap[k] && !feMap[k]).length);
