const fs = require('fs');
let code = fs.readFileSync('src/components/orders/ReceptionModal.jsx', 'utf8');

code = code.replace(
    'className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-600 hover:text-white border border-red-200 dark:border-red-900 py-3 rounded-xl font-black uppercase text-sm md:text-base shadow-sm transition-colors flex flex-col items-center justify-center gap-1"',
    'className="bg-red-600 text-white border-2 border-red-700 hover:bg-red-700 py-3 rounded-xl font-black uppercase text-sm md:text-base shadow-sm transition-colors flex flex-col items-center justify-center gap-1"'
);

fs.writeFileSync('src/components/orders/ReceptionModal.jsx', code);
