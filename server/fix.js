const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('src/routes');
let changed = false;

files.forEach(file => {
  if (!file.endsWith('.js')) return;
  const filePath = path.join('src/routes', file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.includes('\\${')) {
    content = content.replace(/\\\${/g, '${');
    fs.writeFileSync(filePath, content);
    console.log('Fixed:', file);
    changed = true;
  }
});

if (!changed) console.log('No files needed fixing for \\${');
