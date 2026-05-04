const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix formatensureDate
content = content.replace(/formatensureDate\(/g, "format(ensureDate(");

// Fix differenceInSecondsensureDate
content = content.replace(/differenceInSecondsensureDate\((.*?)\), ensureDate\((.*?)\) :/g, "differenceInSeconds(ensureDate($1), ensureDate($2)) :");

fs.writeFileSync('src/App.tsx', content);
