const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Header.jsx', 'utf8');

// Replace using very explicit styles for contrast.
const oldProd = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border ${viewFilter === 'TODOS' ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border-transparent shadow-md' : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'}`}";
const newProd = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 ${viewFilter === 'TODOS' ? 'bg-[var(--color-primary)] text-white border-transparent shadow-md' : 'bg-transparent text-[var(--color-primary)] border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white'}`}";
code = code.replace(oldProd, newProd);

const oldAtr = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border ${viewFilter === 'ATRASADOS' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60'}`}";
const newAtr = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 ${viewFilter === 'ATRASADOS' ? 'bg-red-700 text-white border-red-700 shadow-md' : 'bg-transparent text-red-700 border-red-700 hover:bg-red-700 hover:text-white dark:text-red-500 dark:border-red-500 dark:hover:bg-red-500 dark:hover:text-white'}`}";
code = code.replace(oldAtr, newAtr);

const oldDes = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border ${viewFilter === 'DESPACHADOS' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/60'}`}";
const newDes = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm md:text-base font-black uppercase transition-colors border-2 ${viewFilter === 'DESPACHADOS' ? 'bg-green-700 text-white border-green-700 shadow-md' : 'bg-transparent text-green-700 border-green-700 hover:bg-green-700 hover:text-white dark:text-green-500 dark:border-green-500 dark:hover:bg-green-500 dark:hover:text-white'}`}";
code = code.replace(oldDes, newDes);

const oldCoo = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors border ${coordinationAlerts.length > 0 ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700 hover:bg-amber-500 hover:text-white' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'}`}";
const newCoo = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors border-2 ${coordinationAlerts.length > 0 ? 'bg-orange-600 text-white border-orange-600 shadow-md animate-pulse' : 'bg-transparent text-slate-600 border-slate-400 dark:text-slate-400 dark:border-slate-600 hover:border-slate-600'}`}";
code = code.replace(oldCoo, newCoo);

const oldRec = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors relative border ${totalNotifications > 0 ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-400 dark:border-pink-800 hover:bg-pink-600 hover:text-white' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'}`}";
const newRec = "className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-sm md:text-base font-black uppercase transition-colors relative border-2 ${totalNotifications > 0 ? 'bg-purple-700 text-white border-purple-700 shadow-md animate-pulse' : 'bg-transparent text-slate-600 border-slate-400 dark:text-slate-400 dark:border-slate-600 hover:border-slate-600'}`}";
code = code.replace(oldRec, newRec);

fs.writeFileSync('src/components/layout/Header.jsx', code);
