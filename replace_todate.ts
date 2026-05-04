import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\(?([a-zA-Z0-9_\.]+)[?!]?\.toDate\(\)(?:\s*\|\|\s*(?:t\.startTime\?\.toDate\(\)\s*\|\|\s*)?new Date\(\))?\)?/g;

content = content.replace(regex, (match, p1) => {
  return `ensureDate(${p1})`;
});

// There is one tricky line: format(t.timestamp?.toDate() || t.startTime?.toDate() || new Date(), 'HH:mm')
// The regex above will match `t.timestamp?.toDate() || t.startTime?.toDate() || new Date()` if we are just careful.
content = content.replace(/ensureDate\(t\.timestamp\)\s*\|\|\s*ensureDate\(t\.startTime\)\s*\|\|\s*new Date\(\)/g, "ensureDate(t.timestamp || t.startTime)");

fs.writeFileSync('src/App.tsx', content);
console.log("Replaced .toDate() with ensureDate()");
