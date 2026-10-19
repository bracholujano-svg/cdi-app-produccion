import React from 'react';
import { AlertTriangle, AlertCircle, Search, MapPin, FileText, Package, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const formatQty = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return '0';
    return num.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1');
};

const firstNonEmpty = (...vals) => {
    for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
        }
    }
    return '';
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
    const samplePedido = firstNonEmpty(safeList[0]?.pedido_sin, safeList[0]?.pedido_num);
    const uniqueCodPts = Array.from(new Set(safeList.map(m => m.codpt).filter(Boolean)));
    const singleCodPt = uniqueCodPts.length === 1 ? uniqueCodPts[0] : null;
    const singleProdName = singleCodPt
        ? firstNonEmpty(safeList.find(m => m.codpt === singleCodPt)?.producto)
        : (safeList.length > 0 && new Set(safeList.map(m => m.producto).filter(Boolean)).size === 1
            ? firstNonEmpty(safeList.find(m => m.producto)?.producto)
            : '');

    const hasSinStock = safeList.some(m => (m.pendiente ?? m.faltante ?? 0) > 0 && (m.existencia ?? m.stockRestanteGlobal ?? 0) <= 0);
    const hasPendienteEntrega = safeList.some(m => (m.pendiente ?? m.faltante ?? 0) > 0 && (m.existencia ?? m.stockRestanteGlobal ?? 0) > 0);
    const isModalAlert = hasSinStock || hasPendienteEntrega;
    
    const filtered = safeList.filter(m => {
        if (!materialsSearchTerm) return true;
        const term = materialsSearchTerm.toLowerCase().trim();
        return (
            firstNonEmpty(m.referencia, m.descripcion).toLowerCase().includes(term) ||
            firstNonEmpty(m.idreferencia, m.id_referencia).toLowerCase().includes(term) ||
            firstNonEmpty(m.numero_rq).toLowerCase().includes(term) ||
            firstNonEmpty(m.codpt).toLowerCase().includes(term) ||
            firstNonEmpty(m.producto).toLowerCase().includes(term) ||
            firstNonEmpty(m.ubicacion).toLowerCase().includes(term)
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
                        <h2 className={`text-lg font-black uppercase flex items-center gap-2 ${isNoMaterials ? 'text-yellow-600' : hasSinStock ? 'text-red-600 dark:text-red-400' : isModalAlert ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
                            {(singleCodPt || singleProdName) && (
                                <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono">
                                    {singleCodPt ? `CÓD. PRODUCTO (codpt): ${singleCodPt}` : 'PRODUCTO:'} {singleProdName ? `— ${singleProdName}` : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    {!isNoMaterials && (
                        <div className="relative w-full sm:w-72 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted group-focus-within:text-[var(--color-primary)] transition-colors" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar Material, Ref, RQ o Producto..." 
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
                            : "Desglose exacto de materias primas e insumos por referencia y requisición (RQ). Rojo indica Sin Stock en almacén (Existencia 0); Ámbar indica material con stock en almacén pendiente por reclamar/entregar."
                        }
                    </p>

                    {!isNoMaterials && (
                        <div className="grid grid-cols-2 gap-3 md:gap-6 w-full md:w-auto">
                            <h3 className="text-xs sm:text-sm font-black text-red-600 dark:text-red-400 uppercase border-b-2 border-red-500/30 pb-1">
                                Pendientes / Faltantes ({faltantes.length})
                            </h3>
                            <h3 className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase border-b-2 border-emerald-500/30 pb-1">
                                Insumos Completos ({disponibles.length})
                            </h3>
                        </div>
                    )}
                </div>

                {/* LISTADO DE MATERIAS PRIMAS */}
                <div className="px-4 md:px-5 py-4 max-h-[58vh] overflow-y-auto custom-scrollbar">
                    {isNoMaterials ? (
                        <div className="p-10 rounded-xl border border-dashed border-yellow-400 bg-yellow-500/10 text-center">
                            <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-500 opacity-70" />
                            <span className="text-sm font-black text-yellow-600 dark:text-yellow-400 uppercase">Sin información de insumos</span>
                            <p className="text-sm font-bold theme-text-muted mt-2">El sistema no detectó ningún requerimiento de material en Supabase asociado a este pedido y/o artículo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                            {/* COLUMNA 1: PENDIENTES / SIN STOCK */}
                            <div className="space-y-3">
                                {faltantes.length > 0 ? (
                                    faltantes.map((mat, i) => {
                                        const idRef = firstNonEmpty(mat.idreferencia, mat.id_referencia, mat['Id Referencia']) || 'S/N';
                                        const refName = firstNonEmpty(mat.referencia, mat.descripcion, mat.Descripcion, mat.Referencia) || `REFERENCIA ${idRef}`;
                                        const rqNum = firstNonEmpty(mat.numero_rq, mat.numero) || 'S/N';
                                        const ubic = firstNonEmpty(mat.ubicacion, mat.Ubicacion, mat['Ubicación']) || 'SIN UBICACIÓN';
                                        const prodName = firstNonEmpty(mat.producto);
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
                                                style={{
                                                    backgroundColor: isZeroStock ? '#fef2f2' : '#fffbeb',
                                                    borderColor: isZeroStock ? '#ef4444' : '#f59e0b',
                                                    color: '#0f172a'
                                                }}
                                                className="p-4 rounded-2xl border-2 flex flex-col gap-2.5 shadow-md"
                                            >
                                                {/* FILA SUPERIOR: ETIQUETAS DE REFERENCIA, RQ Y ESTADO */}
                                                <div className="flex flex-wrap justify-between items-center gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
                                                            className="text-xs font-mono font-black uppercase px-2.5 py-1 rounded-md shadow-xs"
                                                        >
                                                            CÓD. INSUMO: {idRef}
                                                        </span>
                                                        <span
                                                            style={{ backgroundColor: '#e0e7ff', color: '#1e1b4b', borderColor: '#6366f1' }}
                                                            className="text-xs font-mono font-black uppercase px-2.5 py-1 border rounded-md flex items-center gap-1"
                                                        >
                                                            <FileText size={12} /> RQ: {rqNum}
                                                        </span>
                                                    </div>

                                                    <span
                                                        style={{
                                                            backgroundColor: isZeroStock ? '#dc2626' : '#d97706',
                                                            color: '#ffffff'
                                                        }}
                                                        className="text-xs font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs"
                                                    >
                                                        <AlertCircle size={13} />
                                                        {isZeroStock ? 'SIN STOCK EN ALMACÉN (0)' : 'PENDIENTE RECLAMAR EN ALMACÉN'}
                                                    </span>
                                                </div>

                                                {/* CAJA PRINCIPAL DESTACADA: NOMBRE EXACTO DEL MATERIAL / INSUMO */}
                                                <div
                                                    style={{
                                                        backgroundColor: '#ffffff',
                                                        borderColor: isZeroStock ? '#fca5a5' : '#fcd34d',
                                                        color: '#0f172a'
                                                    }}
                                                    className="p-3 rounded-xl border-2 shadow-xs"
                                                >
                                                    <span
                                                        style={{ color: isZeroStock ? '#b91c1c' : '#b45309' }}
                                                        className="block text-[11px] font-black uppercase tracking-wider mb-0.5"
                                                    >
                                                        {isZeroStock ? '🚨 INSUMO FALTANTE (NO HAY EN ALMACÉN):' : '📦 INSUMO PENDIENTE POR RECLAMAR EN ALMACÉN:'}
                                                    </span>
                                                    <p
                                                        style={{ color: '#0f172a', fontSize: '15px', lineHeight: '1.35' }}
                                                        className="font-black uppercase break-words"
                                                    >
                                                        {refName}
                                                    </p>
                                                    {(mat.codpt || prodName) && (
                                                        <div
                                                            style={{ color: '#1e3a8a', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
                                                            className="mt-2 px-2.5 py-1 rounded-lg border text-xs font-black uppercase flex items-center gap-1.5 flex-wrap"
                                                        >
                                                            <Package size={13} className="shrink-0" />
                                                            <span>PARA PRODUCTO: {mat.codpt ? `[${mat.codpt}] ` : ''}{prodName || ''}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* UBICACIÓN Y ORDEN DE COMPRA */}
                                                <div
                                                    style={{ backgroundColor: '#f8fafc', color: '#334155', borderColor: '#cbd5e1' }}
                                                    className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border"
                                                >
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={13} style={{ color: '#4f46e5' }} className="shrink-0" />
                                                        Ubicación Almacén: <strong style={{ color: '#0f172a' }} className="uppercase">{ubic}</strong>
                                                    </span>
                                                    {cantOc > 0 ? (
                                                        <span style={{ color: '#1d4ed8' }} className="font-black">EN O.C.: {formatQty(cantOc)}{unidad}</span>
                                                    ) : isZeroStock && (
                                                        <span style={{ color: '#dc2626' }} className="font-black">SIN O.C. REGISTRADA</span>
                                                    )}
                                                </div>

                                                {/* MÉTRICAS DE CANTIDAD */}
                                                <div
                                                    style={{ borderColor: '#cbd5e1' }}
                                                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-0.5 border-t pt-2.5"
                                                >
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#475569' }} className="text-[11px] font-black uppercase">Pedida (Reser)</span>
                                                        <span style={{ color: '#0f172a' }} className="text-sm font-black">{formatQty(pedida)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#475569' }} className="text-[11px] font-black uppercase">Entregada</span>
                                                        <span style={{ color: '#0f172a' }} className="text-sm font-black">{formatQty(entregada)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#dc2626' }} className="text-[11px] font-black uppercase">Falta Entregar</span>
                                                        <span style={{ color: '#dc2626' }} className="text-sm font-black">{formatQty(pendiente)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#475569' }} className="text-[11px] font-black uppercase">Stock Almacén</span>
                                                        <span
                                                            style={{ color: isZeroStock ? '#dc2626' : '#059669' }}
                                                            className="text-sm font-black"
                                                        >
                                                            {formatQty(existencia)}{unidad}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 rounded-xl border border-dashed border-emerald-400 bg-emerald-500/10 text-center">
                                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase">✅ Ningún material pendiente por entregar.</span>
                                    </div>
                                )}
                            </div>

                            {/* COLUMNA 2: INSUMOS COMPLETOS / ENTREGADOS */}
                            <div className="space-y-3">
                                {disponibles.length > 0 ? (
                                    disponibles.map((mat, i) => {
                                        const idRef = firstNonEmpty(mat.idreferencia, mat.id_referencia, mat['Id Referencia']) || 'S/N';
                                        const refName = firstNonEmpty(mat.referencia, mat.descripcion, mat.Descripcion, mat.Referencia) || `REFERENCIA ${idRef}`;
                                        const rqNum = firstNonEmpty(mat.numero_rq, mat.numero) || 'S/N';
                                        const ubic = firstNonEmpty(mat.ubicacion, mat.Ubicacion, mat['Ubicación']) || 'SIN UBICACIÓN';
                                        const prodName = firstNonEmpty(mat.producto);
                                        const pedida = mat.pedida_reser ?? mat.requerida ?? 0;
                                        const entregada = mat.entregada ?? mat.asignada ?? 0;
                                        const existencia = mat.existencia ?? mat.stockRestanteGlobal ?? 0;
                                        const unidad = mat.idunidad ? ` ${mat.idunidad}` : '';

                                        return (
                                            <div
                                                key={'d' + i}
                                                style={{
                                                    backgroundColor: '#f0fdf4',
                                                    borderColor: '#22c55e',
                                                    color: '#0f172a'
                                                }}
                                                className="p-4 rounded-2xl border-2 flex flex-col gap-2 shadow-sm"
                                            >
                                                <div className="flex flex-wrap justify-between items-center gap-2">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            style={{ backgroundColor: '#14532d', color: '#ffffff' }}
                                                            className="text-xs font-mono font-black uppercase px-2.5 py-0.5 rounded-md"
                                                        >
                                                            CÓD. INSUMO: {idRef}
                                                        </span>
                                                        <span
                                                            style={{ backgroundColor: '#e0e7ff', color: '#1e1b4b', borderColor: '#6366f1' }}
                                                            className="text-xs font-mono font-black uppercase px-2 py-0.5 border rounded-md"
                                                        >
                                                            RQ: {rqNum}
                                                        </span>
                                                    </div>
                                                    <span
                                                        style={{ backgroundColor: '#16a34a', color: '#ffffff' }}
                                                        className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg flex items-center gap-1"
                                                    >
                                                        <CheckCircle2 size={12} /> ENTREGADO / COMPLETO
                                                    </span>
                                                </div>

                                                <div
                                                    style={{ backgroundColor: '#ffffff', borderColor: '#86efac', color: '#0f172a' }}
                                                    className="p-2.5 rounded-xl border"
                                                >
                                                    <span style={{ color: '#15803d' }} className="block text-[10px] font-black uppercase tracking-wider">
                                                        ✅ MATERIAL COMPLETO:
                                                    </span>
                                                    <p style={{ color: '#0f172a', fontSize: '14px', lineHeight: '1.35' }} className="font-black uppercase break-words">
                                                        {refName}
                                                    </p>
                                                    {(mat.codpt || prodName) && (
                                                        <p style={{ color: '#1e40af' }} className="text-[11px] font-bold uppercase mt-1">
                                                            Producto: {mat.codpt ? `[${mat.codpt}] ` : ''}{prodName || ''}
                                                        </p>
                                                    )}
                                                </div>

                                                <div style={{ color: '#334155' }} className="text-xs font-bold flex items-center gap-1">
                                                    <MapPin size={12} style={{ color: '#16a34a' }} className="shrink-0" />
                                                    Ubicación: <strong style={{ color: '#0f172a' }} className="uppercase">{ubic}</strong>
                                                </div>

                                                <div style={{ borderColor: '#bbf7d0' }} className="grid grid-cols-3 gap-2 mt-1 border-t pt-2">
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#475569' }} className="text-[11px] font-black uppercase">Pedida</span>
                                                        <span style={{ color: '#0f172a' }} className="text-sm font-black">{formatQty(pedida)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#15803d' }} className="text-[11px] font-black uppercase">Entregada</span>
                                                        <span style={{ color: '#15803d' }} className="text-sm font-black">{formatQty(entregada)}{unidad}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span style={{ color: '#475569' }} className="text-[11px] font-black uppercase">Stock Almacén</span>
                                                        <span style={{ color: '#0f172a' }} className="text-sm font-black">{formatQty(existencia)}{unidad}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-6 rounded-xl border border-dashed border-slate-400 bg-black/5 text-center">
                                        <span className="text-sm font-bold theme-text-muted uppercase">Ningún material entregado al 100% aún.</span>
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
                        className={`text-white font-black uppercase text-sm px-6 py-2.5 rounded-xl transition-colors duration-200 hover:brightness-110 active:scale-95 cursor-pointer ${
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
