import * as fs from 'fs';
import * as path from 'path';

function processDir(dir: string) {
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
      
      let newContent = content.replace(/(className="[^"]*?\b)grid-cols-2(\b[^"]*")/g, (match, p1, p2) => {
        if (p1.includes('sm:') || p1.includes('md:') || p1.includes('lg:') || p1.includes('xl:')) {
            return match; 
        }
        return p1 + 'grid-cols-1 sm:grid-cols-2' + p2;
      });

      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir('./src');
