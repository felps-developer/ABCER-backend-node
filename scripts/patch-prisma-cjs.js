// Patches dist/generated/prisma/client.js after nest build.
// TypeScript compiles the Prisma 7 generated client (which uses import.meta.url)
// into CJS output that still contains ESM-only syntax. Node.js 24 rejects CJS
// files that contain import.meta, so we replace it with the CJS equivalent __dirname.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'generated', 'prisma', 'client.js');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "path.dirname((0, node_url_1.fileURLToPath)(import.meta.url))",
  "__dirname"
);

fs.writeFileSync(file, content);
console.log('✔ patched dist/generated/prisma/client.js (import.meta.url → __dirname)');
