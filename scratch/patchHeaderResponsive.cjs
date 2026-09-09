const fs = require('fs');

let code = fs.readFileSync('src/components/layout/Header.jsx', 'utf8');

// Replace the central buttons container
code = code.replace(
  '<div className="flex bg-black/5 dark:theme-bg-card/5 rounded-xl p-1 shrink-0 overflow-x-auto custom-scrollbar max-w-[50vw]">',
  '<div className="flex bg-black/5 dark:theme-bg-card/5 rounded-xl p-1 shrink-0 overflow-x-auto custom-scrollbar w-full md:w-auto md:max-w-[50vw] order-last md:order-none mt-2 md:mt-0">'
);

fs.writeFileSync('src/components/layout/Header.jsx', code);
