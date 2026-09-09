const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

const regex = /<span className="bg-\[var\(--color-primary\)\]\/20 theme-text-main px-2 py-0\.5 rounded text-base font-black uppercase border border-\[var\(--color-primary\)\]\/30">\{h\.accion\}<\/span>/;

const replacement = `<span className={h.accion.toUpperCase().includes("PARCIAL") ? "bg-[#ffedd5] text-[#9a3412] dark:bg-[#7c2d12] dark:text-[#ffedd5] px-2 py-0.5 rounded text-base font-black uppercase border border-[#c2410c] shadow-sm" : "bg-[var(--color-primary)]/20 theme-text-main px-2 py-0.5 rounded text-base font-black uppercase border border-[var(--color-primary)]/30"}>{h.accion}</span>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
