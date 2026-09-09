const fs = require('fs');

let code = fs.readFileSync('src/components/orders/OrderDetailsModal.jsx', 'utf8');

const regex = /<span className=\{h\.accion\.toUpperCase\(\)\.includes\("PARCIAL"\) \? "[^"]+" : "[^"]+"\}\>\{h\.accion\}<\/span>/;

const replacement = `<span 
  className={h.accion.toUpperCase().includes("PARCIAL") ? "px-2 py-0.5 rounded text-base font-black uppercase border shadow-sm" : "bg-[var(--color-primary)]/20 theme-text-main px-2 py-0.5 rounded text-base font-black uppercase border border-[var(--color-primary)]/30"}
  style={h.accion.toUpperCase().includes("PARCIAL") ? { color: '#9a3412', backgroundColor: '#ffedd5', borderColor: '#c2410c' } : {}}
>{h.accion}</span>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/orders/OrderDetailsModal.jsx', code);
