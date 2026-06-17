const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'orders', 'OrderDetailsModal.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Añadir areaFilter al destructuring de useAppContext
content = content.replace(
    'showHistoryEntrega, setShowHistoryEntrega,\n    supervisorProfile\n  } = useAppContext();',
    'showHistoryEntrega, setShowHistoryEntrega,\n    supervisorProfile,\n    areaFilter\n  } = useAppContext();'
);

// 2. Insertar el Banner justo después del inicio del contenedor scrollable
const bannerCode = `
              {/* BANNER DE SOLO LECTURA */}
              {(() => {
                const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || areaFilter === selectedOrder.areaActual;
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

content = content.replace(
    '<div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">\n              \n              {/* Acordeón Planta */}',
    `<div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">\n              ${bannerCode}\n              {/* Acordeón Planta */}`
);

// 3. Añadir AlertCircle a los imports de lucide-react si no está
if (!content.includes('AlertCircle')) {
    content = content.replace('MessageSquare, UserCheck, ArrowRightLeft', 'MessageSquare, UserCheck, ArrowRightLeft, AlertCircle');
}

// 4. Bloquear el contenido interactivo de Planta
const plantaInteractableStart = '<input value={tempOperario}';
const plantaInteractableEnd = 'Guardar Avance</button>\n                        </div>';
content = content.replace(
    /(\<input value=\{tempOperario\}[\s\S]*?Guardar Avance\<\/button\>\n                        \<\/div\>)/,
    `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || areaFilter === selectedOrder.areaActual;
                          if (!canEdit) return null;
                          return (
                            <>
                              $1
                            </>
                          );
                        })()}`
);

// 5. Bloquear el contenido interactivo de Calidad
content = content.replace(
    /(\<div className="flex gap-2"\>\n                            \<button type="button" onClick=\{\(\)=\>setCalidadState\('APROBADO'\)[\s\S]*?Guardar Inspección\<\/button\>\n                        \<\/div\>)/,
    `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || areaFilter === selectedOrder.areaActual;
                          if (!canEdit) return null;
                          return (
                            <>
                              $1
                            </>
                          );
                        })()}`
);

// 6. Bloquear el contenido interactivo de Entregas
content = content.replace(
    /(\<select value=\{tempTransferArea\}[\s\S]*?Enviar Solicitud de Entrega\<\/button\>)/,
    `{(() => {
                          const canEdit = areaFilter === 'Administrador / Todos' || areaFilter === 'Todas' || areaFilter === selectedOrder.areaActual;
                          if (!canEdit) return null;
                          return (
                            <>
                              $1
                            </>
                          );
                        })()}`
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('OrderDetailsModal actualizado correctamente.');
