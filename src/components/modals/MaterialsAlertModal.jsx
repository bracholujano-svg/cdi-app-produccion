import React from 'react';
import { AlertTriangle, AlertCircle, Search, MapPin, FileText, Package, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const formatQty = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return '0';
    return num.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1');
};

export default function MaterialsAlertModal({ 
    activeAlertMaterials = [], 
    setShowMaterialsAlertModal 
}) {
    const materialsSearchTerm = useAppStore(state => state.materialsSearchTerm);
    const setMaterialsSearchTerm = useAppStore(state => state.setMaterialsSearchTerm);

    const safeList = Array.isArray(activeAlertMaterials) ? activeAlertMaterials : [];
    const isNoMaterials = safeList.length === 0;

    // Detectar contexto (pedido y si corresponde a un producto específico codpt)
    const samplePedido = safeList[0]?.pedido_sin || safeList[0]?.pedido_num || '';
    const uniqueCodPts = Array.from(new Set(safeList.map(m => m.codpt).filter(Boolean)));
    const singleCodPt = uniqueCodPts.length === 1 ? uniqueCodPts[0] : null;
    const singleProdName = singleCodPt ? (safeList.find(m => m.codpt === singleCodPt)?.producto || '') : '';

    const hasSinStock = safeList.some(m => (m.pendiente ?? m.faltante ?? 0) > 0 && (m.existencia ?? m.stockRestanteGlobal ?? 0) <= 0);
    const hasPendienteEntrega = safeList.some(m => (m.pendiente ?? m.faltante ?? 0) > 0 && (m.existencia ?? m.stockRestanteGlobal ?? 0) > 0);
    const isModalAlert = hasSinStock || hasPendienteEntrega;
    
    const filtered = safeList.filter(m => {
        if (!materialsSearchTerm) return true;
        const term = materialsSearchTerm.toLowerCase().trim();
        return (
            String(m.referencia ?? m.descripcion ?? '').toLowerCase().includes(term) ||
            String(m.idreferencia ?? m.id_referencia ?? '').toLowerCase().includes(term) ||
            String(m.numero_rq ?? '').toLowerCase().includes(term) ||
            String(m.codpt ?? '').toLowerCase().includes(term) ||
            String(m.ubicacion ?? '').toLowerCase().includes(term)
        );
    });
    
    const faltantes = filtered
        .filter(m => (m.pendiente ?? m.faltante ?? 0) > 0)
        .sort((a, b) => {
            const aSinStock = (a.existencia ?? a.stockRestanteGlobal ?? 0) <= 0 ? 1 : 0;
            const bSinStock = (b.existencia ?? b.stockRestanteGlobal ?? 0) <= 0 ? 1 : 0;
            if (bSinStock !== aSinStock) return bSinStock - aSinStock;
            return (b.pendiente ?? b.faltante ?? 0) - (a.pendiente ?? a.faltante ?? 0);
        });

    const disponibles = filtered.filter(m => (m.pendiente ?? m.faltante ?? 0) <= 0);

    return (
        <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-3 sm:p-4">
            <div className={`w-full max-w-7xl theme-bg-card rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${isNoMaterials ? 'border-yellow-500/30' : hasSinStock ? 'border-red-500/40' : isModalAlert ? 'border-amber-500/40' : 'border-green-500/30'}`}>
                
                {/* CABECERA */}
                <div className={`p-4 sm:p-5 border-b flex flex-wrap justify-between items-center gap-3 shrink-0 ${isNoMaterials ? 'bg-yellow-500/10 border-yellow-500/20' : hasSinStock ? 'bg-red-500/10 border-red-500/20' : isModalAlert ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                    <div className="flex flex-col gap-1">
                        <h2 className={`text-base sm:text-lg font-black uppercase flex items-center gap-2 ${isNoMaterials ? 'text-yellow-600' : hasSinStock ? 'text-red-600 dark:text-red-400' : isModalAlert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            <AlertTriangle size={"1.2em"} className={isModalAlert && !isNoMaterials ? "animate-pulse" : ""}/>
                            {isNoMaterials
                                ? 'Sin Insumos Requeridos'
                                : hasSinStock
                                ? 'Alerta Crítica: Sin Stock en Almacén'
                                : isModalAlert
                                ? 'Pendiente Entrega de Almacén'
                                : 'Insumos Completos'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase theme-text-muted">
                            {samplePedido && (
                                <span className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 theme-text-main">
                                    PEDIDO: {samplePedido}
                                </span>
                            )}
                            {singleCodPt && (
                                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono">
                                    CÓD. PRODUCTO (codpt): {singleCodPt} {singleProdName ? `— ${singleProdName}` : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    {!isNoMaterials && (
                        <div className="relative w-full sm:w-72 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-[var(--color-primary)] transition-colors" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar Ref, Nombre, RQ o Ubicación..." 
                                value={materialsSearchTerm || ''} 
                                onChange={(e) => setMaterialsSearchTerm(e.target.value)} 
                                className="w-full pl-9 pr-3 py-2 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all placeholder:font-normal"
                            />
                        </div>
                    )}
                </div>

                {/* RESUMEN DE ESTADO */}
                <div className="p-4 md:p-5 bg-[var(--color-surface)] border-b theme-border flex flex-col md:flex-row gap-4 justify-between items-start md:items-center shrink-0">
                    <p className="font-bold text-xs sm:text-sm theme-text-muted leading-relaxed max-w-3xl">
                        {isNoMaterials 
                            ? "No se encontraron explosiones de materiales en Supabase para este pedido/producto." 
                            : "Desglose por referencia cruzado con almacén (requerimientos_pedido). Rojo indica Pendiente > 0 con Existencia 0 en almacén; Ámbar indica Pendiente > 0 con stock disponible en almacén por reclamar."
                        }
                    </p>

                    {!isNoMaterials && (
                        <div className="grid grid-cols-2 gap-3 md:gap-6 w-full md:w-auto">
                            <h3 className="text-xs sm:text-sm md:text-base font-black text-red-600 dark:text-red-400 uppercase border-b-2 border-red-500/30 pb-1">
                                Pendientes / Faltantes ({faltantes.length})
                            </h3>
                            <h3 className="text-xs sm:text-sm md:text-base font-black text-emerald-600 dark:text-emerald-400 uppercase border-b-2 border-emerald-500/30 pb-1">
                                Insumos Completos ({disponibles.length})
                            </h3>
                        </div>
                    )}
                </div>

                {/* LISTADO DE MATERIAS PRIMAS */}
                <div className="px-4 md:px-5 py-4 max-h-[58vh] overflow-y-auto custom-scrollbar">
                    {isNoMaterials ? (
                        <div className="p-10 rounded-xl border border-dashed border-yellow-200 bg-yellow-50 text-center">
                            <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-400 opacity-50" />
                            <span className="text-sm md:text-base font-black text-yellow-600 uppercase">Sin información de insumos</span>
                            <p className="text-sm md:text-base font-bold text-yellow-500/80 mt-2">El sistema no detectó ningún requerimiento de material en Supabase asociado a este pedido y/o artículo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                            {/* COLUMNA 1: PENDIENTES / SIN STOCK */}
                            <div className="space-y-3">
                                {faltantes.length > 0 ? (
                                    faltantes.map((mat, i) => {
                                        const idRef = mat.idreferencia ?? mat.id_referencia ?? 'S/N';
                                        const refName = mat.referencia ?? mat.descripcion ?? 'SIN DESCRIPCIÓN';
                                        const rqNum = mat.numero_rq || 'S/N';
                                        const ubic = mat.ubicacion || 'SIN UBICACIÓN';
                                        const pedida = mat.pedida_reser ?? mat.requerida ?? 0;
                                        const entregada = mat.entregada ?? mat.asignada ?? 0;
                                        const pendiente = mat.pendiente ?? mat.faltante ?? 0;
                                        const existencia = mat.existencia ?? mat.stockRestanteGlobal ?? 0;
                                        const cantOc = mat.cant_oc ?? mat.cantidad_oc ?? 0;
                                        const unidad = mat.idunidad ? ` ${mat.idunidad}` : '';
                                        const isZeroStock = existencia <= 0;

                                        return (
                                            <div
                                                key={'f' + i}
                                                className={`p-4 rounded-2xl border-2 flex flex-col gap-2 shadow-sm ${
                                                    isZeroStock
                                                        ? 'border-red-300 bg-red-50/90 dark:bg-red-950/30 dark:border-red-800/60'
                                                        : 'border-amber-300 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800/60'
                                                }`}
                                            >
                                                <div className="flex flex-wrap justify-between items-center gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs sm:text-sm font-mono font-black uppercase px-2 py-0.5 bg-white dark:bg-slate-900 border rounded-md border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100">
                                                            Ref: {idRef}
                                                        </span>
                                                        <span className="text-xs font-mono font-black uppercase px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 rounded-md text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                                                            <FileText size={12} /> RQ: {rqNum}
                                                        </span>
                                                        {mat.codpt && !singleCodPt && (
                                                            <span className="text-xs font-mono font-black uppercase px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-md text-blue-800 dark:text-blue-300 flex items-center gap-1">
                                                                <Package size={12} /> Cód.PT: {mat.codpt}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                                                        isZeroStock
                                                            ? 'bg-red-600 text-white shadow-sm'
                                                            : 'bg-amber-500 text-slate-950 shadow-sm'
                                                    }`}>
                                                        <AlertCircle size={13} />
                                                        {isZeroStock ? 'SIN STOCK EN ALMACÉN' : 'PENDIENTE ENTREGA ALMACÉN'}
                                                    </span>
                                                </div>

                                                <p className="font-black text-sm sm:text-base uppercase text-slate-900 dark:text-slate-100 leading-snug">
                                                    {refName}
                                                </p>

                                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-black/5 dark:border-white/5">
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={13} className="text-indigo-500 shrink-0" />
                                                        Ubicación Almacén: <strong className="text-slate-900 dark:text-white uppercase">{ubic}</strong>
                                                    </span>
                                                    {cantOc > 0 ? (
                                                        <span className="text-blue-600 dark:text-blue-400 font-black">O.C.: {formatQty(cantOc)}{unidad}</span>
                                                    ) : isZeroStock && (
                                                        <span className="text-red-600 dark:text-red-400 font-black">SIN O.C.</span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1 border-t pt-2.5 border-black/10 dark:border-white/10">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Pedida (Reser)</span>
                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{formatQty(pedida)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Entregada</span>
                                                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{formatQty(entregada)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-red-600 dark:text-red-400 uppercase">Pendiente</span>
                                                        <span className="text-sm font-black text-red-600 dark:text-red-400">{formatQty(pendiente)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Existencia Alm.</span>
                                                        <span className={`text-sm font-black ${isZeroStock ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                            {formatQty(existencia)}{unidad}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                                        <span className="text-sm md:text-base font-black text-emerald-600 dark:text-emerald-400 uppercase">✅ Ningún material pendiente por entregar.</span>
                                    </div>
                                )}
                            </div>

                            {/* COLUMNA 2: INSUMOS COMPLETOS / ENTREGADOS */}
                            <div className="space-y-3">
                                {disponibles.length > 0 ? (
                                    disponibles.map((mat, i) => {
                                        const idRef = mat.idreferencia ?? mat.id_referencia ?? 'S/N';
                                        const refName = mat.referencia ?? mat.descripcion ?? 'SIN DESCRIPCIÓN';
                                        const rqNum = mat.numero_rq || 'S/N';
                                        const ubic = mat.ubicacion || 'SIN UBICACIÓN';
                                        const pedida = mat.pedida_reser ?? mat.requerida ?? 0;
                                        const entregada = mat.entregada ?? mat.asignada ?? 0;
                                        const existencia = mat.existencia ?? mat.stockRestanteGlobal ?? 0;
                                        const unidad = mat.idunidad ? ` ${mat.idunidad}` : '';

                                        return (
                                            <div key={'d' + i} className="p-4 rounded-2xl border flex flex-col gap-2 border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/25 dark:border-emerald-800/50">
                                                <div className="flex flex-wrap justify-between items-center gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs sm:text-sm font-mono font-black uppercase px-2 py-0.5 bg-white dark:bg-slate-900 border rounded-md border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                                                            Ref: {idRef}
                                                        </span>
                                                        <span className="text-xs font-mono font-black uppercase px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-indigo-700 dark:text-indigo-300">
                                                            RQ: {rqNum}
                                                        </span>
                                                        {mat.codpt && !singleCodPt && (
                                                            <span className="text-xs font-mono font-black uppercase px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-700 dark:text-blue-300">
                                                                Cód.PT: {mat.codpt}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-lg bg-emerald-600 text-white flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> COMPLETO
                                                    </span>
                                                </div>

                                                <p className="font-bold text-sm sm:text-base uppercase text-slate-800 dark:text-slate-100 leading-tight">{refName}</p>

                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                                    <MapPin size={12} className="text-emerald-600 shrink-0" />
                                                    Ubicación: <strong className="uppercase">{ubic}</strong>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 mt-1 border-t pt-2.5 border-emerald-200 dark:border-emerald-800/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Pedida</span>
                                                        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{formatQty(pedida)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Entregada</span>
                                                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">{formatQty(entregada)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Existencia Alm.</span>
                                                        <span className="text-sm font-black text-slate-600 dark:text-slate-300">{formatQty(existencia)}{unidad}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 dark:bg-slate-900/40 text-center">
                                        <span className="text-sm md:text-base font-bold text-slate-400 uppercase">Ningún material entregado al 100% aún.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* PIE DEL MODAL */}
                <div className="p-4 bg-black/5 border-t theme-border flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowMaterialsAlertModal(false)}
                        className={`text-white font-black uppercase text-sm sm:text-base px-6 py-2.5 rounded-xl transition-colors duration-200 hover:brightness-110 active:scale-95 cursor-pointer ${
                            isNoMaterials
                                ? 'bg-yellow-500 border border-yellow-700'
                                : hasSinStock
                                ? 'bg-red-600 border border-red-800'
                                : isModalAlert
                                ? 'bg-amber-600 border border-amber-800'
                                : 'bg-[var(--color-primary)] border border-green-700'
                        }`}
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
