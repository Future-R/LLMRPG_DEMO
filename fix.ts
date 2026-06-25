import fs from 'fs';
let data = fs.readFileSync('src/lib/api.ts', 'utf8');
data = data.replace(/\\\`/g, '`');
fs.writeFileSync('src/lib/api.ts', data);
