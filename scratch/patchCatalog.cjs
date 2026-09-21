const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

code = code.replace(
  '<button onClick={() => setShowCatalogModal(false)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors theme-text-main">✕</button>',
  '<button onClick={() => setShowCatalogModal(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2"><ArrowLeft size={18} /> VOLVER</button>'
);

fs.writeFileSync('src/components/SCEntonacion.jsx', code, 'utf8');
console.log("Catalog modal patched");
