/**
 * Build script for ZenBridges
 * Copies runtime web assets from src/ to www/
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const wwwDir = path.join(__dirname, '..', 'www');

if (!fs.existsSync(wwwDir)) {
  fs.mkdirSync(wwwDir, { recursive: true });
}

function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

const files = fs.readdirSync(srcDir);
let copied = 0;

for (const file of files) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(wwwDir, file);
  copyRecursive(srcPath, destPath);
  copied++;
}

console.log(`ZenBridges build complete: copied ${copied} assets/dirs to www/`);
