import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Also fix the timer and header as requested
content = content.replace(
  'text-6xl sm:text-7xl leading-none font-mono font-black tracking-tighter mb-2',
  'text-5xl sm:text-6xl leading-none font-mono font-black tracking-tighter mb-2'
);

content = content.replace(
  'font-black text-xl sm:text-2xl tracking-tighter text-gray-900 dark:text-white uppercase leading-none',
  'font-black text-2xl sm:text-3xl tracking-tighter text-gray-900 dark:text-white uppercase leading-none'
);

content = content.replace(/blue-100/g, 'green-100');
content = content.replace(/blue-200/g, 'green-200');
content = content.replace(/blue-300/g, 'green-300');
content = content.replace(/blue-400/g, 'green-400');
content = content.replace(/blue-500/g, 'green-500');
content = content.replace(/blue-600/g, 'green-600');
content = content.replace(/blue-700/g, 'green-700');
content = content.replace(/blue-800/g, 'green-800');
content = content.replace(/blue-900/g, 'green-900');
content = content.replace(/blue-50/g, 'green-50');

fs.writeFileSync('src/App.tsx', content);
