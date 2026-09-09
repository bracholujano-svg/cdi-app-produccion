const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Header.jsx', 'utf8');

const baseBtn = "px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors";
const inactiveStyle = "bg-black/10 dark:bg-white/10 text-slate-800 dark:text-slate-200 border border-black/20 dark:border-white/20 hover:bg-black/20 dark:hover:bg-white/20 shadow-sm";

// Produccion
code = code.replace(
    /className=\{\`px-3 py-1\.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 \$\{viewFilter === 'TODOS' \? 'bg-\\\\[var\(--color-primary\)\\\\] text-white border-transparent shadow-md' : 'bg-transparent text-\\\\[var\(--color-primary\)\\\\] border-\\\\[var\(--color-primary\)\\\\] hover:bg-\\\\[var\(--color-primary\)\\\\] hover:text-white'\}\`\}/g,
    `className={\`${baseBtn} \${viewFilter === 'TODOS' ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border border-[var(--color-primary)] shadow-md' : '${inactiveStyle}'}\`}`
);

// Atrasos
code = code.replace(
    /className=\{\`px-3 py-1\.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 \$\{viewFilter === 'ATRASADOS' \? 'bg-red-700 text-white border-red-700 shadow-md' : 'bg-transparent text-red-700 border-red-700 hover:bg-red-700 hover:text-white dark:text-red-500 dark:border-red-500 dark:hover:bg-red-500 dark:hover:text-white'\}\`\}/g,
    `className={\`${baseBtn} \${viewFilter === 'ATRASADOS' ? 'bg-red-600 text-white border border-red-700 shadow-md' : '${inactiveStyle}'}\`}`
);

// Despachados
code = code.replace(
    /className=\{\`px-3 py-1\.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 \$\{viewFilter === 'DESPACHADOS' \? 'bg-green-700 text-white border-green-700 shadow-md' : 'bg-transparent text-green-700 border-green-700 hover:bg-green-700 hover:text-white dark:text-green-500 dark:border-green-500 dark:hover:bg-green-500 dark:hover:text-white'\}\`\}/g,
    `className={\`${baseBtn} \${viewFilter === 'DESPACHADOS' ? 'bg-green-600 text-white border border-green-700 shadow-md' : '${inactiveStyle}'}\`}`
);

// Coord
code = code.replace(
    /className=\{\`px-3 py-1\.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors border-2 \$\{coordinationAlerts\.length > 0 \? 'bg-orange-600 text-white border-orange-600 shadow-md animate-pulse' : 'bg-transparent text-slate-600 border-slate-400 dark:text-slate-400 dark:border-slate-600 hover:border-slate-600'\}\`\}/g,
    `className={\`${baseBtn} flex items-center gap-1 \${coordinationAlerts.length > 0 ? 'bg-orange-500 text-white border border-orange-600 shadow-md' : '${inactiveStyle}'}\`}`
);

// Recepciones
code = code.replace(
    /className=\{\`px-3 py-1\.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors relative border-2 \$\{totalNotifications > 0 \? 'bg-purple-700 text-white border-purple-700 shadow-md animate-pulse' : 'bg-transparent text-slate-600 border-slate-400 dark:text-slate-400 dark:border-slate-600 hover:border-slate-600'\}\`\}/g,
    `className={\`${baseBtn} flex items-center gap-1 relative \${totalNotifications > 0 ? 'bg-purple-600 text-white border border-purple-700 shadow-md' : '${inactiveStyle}'}\`}`
);

fs.writeFileSync('src/components/layout/Header.jsx', code);
