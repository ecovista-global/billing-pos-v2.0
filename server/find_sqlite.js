const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('src/routes');

files.forEach(file => {
  if (!file.endsWith('.js')) return;
  const filePath = path.join('src/routes', file);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  
  lines.forEach((line, idx) => {
    if (line.includes('DATE(') || line.includes('STRFTIME(') || line.includes('IFNULL(') || line.includes('DATETIME(')) {
      console.log(`[${file}:${idx + 1}] ${line.trim()}`);
    }
  });
});
