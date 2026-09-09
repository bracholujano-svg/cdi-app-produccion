const fs = require('fs');
let code = fs.readFileSync('src/components/modals/PlantPlannerModal.jsx', 'utf8');

// 1. Fix Header Contrast
code = code.replace(
    '<h2 className="text-xl md:text-2xl font-black theme-text-primary tracking-tight">Panorámica de Planta</h2>',
    '<h2 className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">Planificador Panorámico de Planta</h2>'
);
code = code.replace(
    '<p className="text-xs md:text-sm theme-text-secondary opacity-90 font-medium">Control estratégico interactivo</p>',
    '<p className="text-sm md:text-base font-bold theme-text-primary mt-1">Control Estratégico y Mapa de Áreas</p>'
);

const newList = `
                                                                        {/* Lista de Items */}
                                                                        <div className="space-y-3 mt-4">
                                                                            <h5 className="text-xs font-black uppercase text-indigo-500 tracking-wider mb-2 border-b border-indigo-500/20 pb-1">Desglose de Productos en {area.areaName}</h5>
                                                                            {pedido.items.map(item => (
                                                                                <div key={item.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
                                                                                    <div className="flex items-start justify-between gap-3">
                                                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5 border border-indigo-100 dark:border-indigo-800/50">
                                                                                                <Package className="w-5 h-5" />
                                                                                            </div>
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <p className="text-sm md:text-base font-bold theme-text-primary leading-snug break-words">
                                                                                                    {item.descripcion || 'SIN DESCRIPCIÓN'}
                                                                                                </p>
                                                                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                                                                                        COD: {item.articulo}
                                                                                                    </span>
                                                                                                    {item.cantidad && (
                                                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50">
                                                                                                            CANT: {item.cantidad}
                                                                                                        </span>
                                                                                                    )}
                                                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/50">
                                                                                                        ESTADO: {item.estadoInterno}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>`;

const splitCode = code.split('{/* Lista de Items */}');
if (splitCode.length > 1) {
    const pre = splitCode[0];
    const post = splitCode[1];
    
    // Find the end of the list div
    // We can just find the string that follows the list to be safe.
    const endStr = '</div>\n                                                                )}';
    const endOfList = post.indexOf(endStr);
    
    if (endOfList !== -1) {
        code = pre + newList + '\n                                                                ' + post.substring(endOfList + endStr.length - 2);
        fs.writeFileSync('src/components/modals/PlantPlannerModal.jsx', code);
        console.log('Successfully updated PlantPlannerModal.jsx');
    }
}
