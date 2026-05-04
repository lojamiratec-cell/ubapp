import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/formatensureDate\(/g, "format(ensureDate(");
content = content.replace(/differenceInSeconds\(ensureDate\((.*?)\), ensureDate\((.*?)\)/g, "differenceInSeconds(ensureDate($1), ensureDate($2))");

fs.writeFileSync('src/App.tsx', content);
