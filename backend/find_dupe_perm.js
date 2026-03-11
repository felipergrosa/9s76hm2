const fs = require('fs');
const code = fs.readFileSync('C:/Users/feliperosa/whaticket/backend/src/helpers/PermissionAdapter.ts', 'utf8');

const catalogCode = code.match(/export const getPermissionsCatalog[\s\S]*?\];\n\};/)[0];
const regex = /\"([a-z0-9-]+\.[a-z0-9-]+)\"/g;
let match;
const permsArray = [];
while ((match = regex.exec(catalogCode)) !== null) {
  permsArray.push(match[1]);
}
console.log('Perms in catalog hardcoded strings:', permsArray.length);

const { getPermissionsCatalog } = require('C:/Users/feliperosa/whaticket/backend/dist/helpers/PermissionAdapter.js');
const catalog = getPermissionsCatalog();
let total = 0;
const allKeys = [];
catalog.forEach(c => {
    total += c.permissions.length;
    c.permissions.forEach(p => allKeys.push(p.key));
});
console.log('Total in catalog:', total);
const unique = new Set(allKeys);
console.log('Unique in catalog:', unique.size);

if (total !== unique.size) {
    const counts = {};
    allKeys.forEach(k => counts[k] = (counts[k] || 0) + 1);
    for (const [k, v] of Object.entries(counts)) {
        if (v > 1) console.log('DUPLICATE:', k);
    }
}
