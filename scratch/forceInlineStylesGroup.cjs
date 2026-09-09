const fs = require('fs');
let code = fs.readFileSync('src/components/orders/GroupDetailsModal.jsx', 'utf8');

// Replace the previous tailwind dynamic class approach with inline styles
const regex = /className=\{`theme-bg-card p-4 rounded-2xl border-\[3px\] cursor-pointer transition-colors active:scale-95 bg-\[var\(--color-surface\)\] relative flex flex-col justify-between \$\{[\s\S]*?theme-border shadow-sm hover:border-\[var\(--color-primary\)\]'\n                  \}`\}/;

code = code.replace(regex, `className="p-4 rounded-2xl cursor-pointer transition-all active:scale-95 relative flex flex-col justify-between shadow-md hover:-translate-y-1"
                  style={{
                    borderWidth: '4px',
                    borderStyle: 'solid',
                    borderColor: selectedBulkOrders.some(o => o.id === p.id) ? '#3b82f6' : (isSemaforoTerminado ? '#22c55e' : (isSemaforoEnProceso ? '#eab308' : '#ef4444')),
                    backgroundColor: selectedBulkOrders.some(o => o.id === p.id) ? 'rgba(59,130,246,0.05)' : (isSemaforoTerminado ? 'rgba(34,197,94,0.08)' : (isSemaforoEnProceso ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.05)')),
                    boxShadow: selectedBulkOrders.some(o => o.id === p.id) ? '0 0 15px rgba(59,130,246,0.3)' : (isSemaforoTerminado ? '0 0 15px rgba(34,197,94,0.3)' : (isSemaforoEnProceso ? '0 0 15px rgba(234,179,8,0.3)' : '0 0 15px rgba(239,68,68,0.2)'))
                  }}`);

fs.writeFileSync('src/components/orders/GroupDetailsModal.jsx', code);
