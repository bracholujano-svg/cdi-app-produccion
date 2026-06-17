const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderDetailsModal.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Añadir areaFilter al destructuring de useAppContext
if (!content.includes('areaFilter')) {
    content = content.replace(
        'showHistoryEntrega, setShowHistoryEntrega,\n    supervisorProfile\n  } = useAppContext();',
        'showHistoryEntrega, setShowHistoryEntrega,\n    supervisorProfile,\n    areaFilter\n  } = useAppContext();'
    );
}

// 2. Insertar el Banner justo después del inicio del contenedor scrollable
const bannerCode = `
              {/* BANNER DE SOLO LECTURA */}
              {(() => {
                const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || String(areaFilter).trim() === String(selectedOrder.areaActual).trim();
                if (!canEdit) {
                  return (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex gap-3 items-start animate-in zoom-in">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-black text-red-500 uppercase text-xs md:text-sm lg:text-base">Módulo de Solo Lectura</h4>
                        <p className="text-xs md:text-sm lg:text-base font-bold text-red-400/80 mt-1">Este producto se encuentra físicamente en <span className="text-red-500 underline">{selectedOrder.areaActual}</span>. Solo puedes auditar su histórico; no puedes registrar avances ni transferencias desde tu sección.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
`;

if (!content.includes('BANNER DE SOLO LECTURA')) {
    // Usamos regex para atrapar espacios variables
    content = content.replace(
        /(<div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">\s*)({\/\* Acordeón Planta \*\/})/,
        `$1${bannerCode}\n              $2`
    );
}

// 3. Bloquear el contenido interactivo de Planta
const plantaMatch = content.match(/(<input value=\{tempOperario\}[\s\S]*?Guardar Avance<\/button>\s*<\/div>)/);
if (plantaMatch && !plantaMatch[0].includes('const canEdit =')) {
    content = content.replace(
        plantaMatch[0],
        `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || String(areaFilter).trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              ${plantaMatch[0]}
                            </>
                          );
                        })()}`
    );
}

// 4. Bloquear el contenido interactivo de Calidad
const calidadMatch = content.match(/(<div className="flex gap-2">\s*<button type="button" onClick=\{\(\)=>setCalidadState\('APROBADO'\)[\s\S]*?Guardar Inspección<\/button>\s*<\/div>)/);
if (calidadMatch && !calidadMatch[0].includes('const canEdit =')) {
    content = content.replace(
        calidadMatch[0],
        `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || String(areaFilter).trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              ${calidadMatch[0]}
                            </>
                          );
                        })()}`
    );
}

// 5. Arreglar Entregas: Remover el input de "recibidoPor" y su lógica
content = content.replace(
    /<input id="recibidoPor"[\s\S]*?FIRMA RECIBE" \/>/,
    ''
);
content = content.replace(
    /<div className="grid grid-cols-2 gap-2">/,
    '<div className="grid grid-cols-1 gap-2">'
);

const oldButtonLogic = `const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                            const re = document.getElementById('recibidoPor').value.trim().toUpperCase();
                            if(en && re && tempTransferDate) updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, re);`;
const newButtonLogic = `const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                            if(en && tempTransferDate) {
                                updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en);
                            } else {
                                alert("Debe firmar la entrega e indicar la fecha.");
                            }`;
content = content.replace(oldButtonLogic, newButtonLogic);

// 6. Bloquear el contenido interactivo de Entregas
const entregaMatch = content.match(/(<select value=\{tempTransferArea\}[\s\S]*?Confirmar Entrega de Sección<\/button>)/);
if (entregaMatch && !entregaMatch[0].includes('const canEdit =')) {
    content = content.replace(
        entregaMatch[0],
        `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || String(areaFilter).trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              ${entregaMatch[0]}
                            </>
                          );
                        })()}`
    );
}

// 7. Add AlertCircle import
if (!content.includes('AlertCircle')) {
    content = content.replace('MessageSquare, UserCheck, ArrowRightLeft', 'MessageSquare, UserCheck, ArrowRightLeft, AlertCircle');
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('OrderDetailsModal parcheado con éxito!');
