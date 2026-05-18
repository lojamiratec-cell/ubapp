const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('dist')) {
        processDir(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let newContent = content.replace(/text-\[8px\]/g, 'text-[10px]')
                             .replace(/text-\[9px\]/g, 'text-[11px]')
                             .replace(/text-\[10px\]/g, 'text-xs');

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated texts in', fullPath);
      }
    }
  }
}

processDir('./src');
