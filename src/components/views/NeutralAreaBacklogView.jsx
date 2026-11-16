import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Calendar,
  Package,
  Copy,
  Download,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  FileCode2,
  FolderKanban
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { AREAS_RECEPCION, CONFIG_PROCESOS } from '../../utils/constants';
import { getDaysLeft, formatLocalDate } from '../../utils/helpers';
import {
  SolidWorksStampPreview,
  copyBlueprintQrToClipboard,
  downloadBlueprintQrPng,
  buildProductBlueprintQrPayload,
  showCdiBlueprintToast
} from '../../utils/colorQrHelper';

export const isOrderInNeutralBacklog = (o) => {
  if (!o || o.estadoInterno === 'DESPACHADO' || o.isTerminado) return false;
  const areaAct = String(o.areaActual || '').trim().toUpperCase();
  const areaRaw = String(o.area || '').trim().toUpperCase();
  const estInt = String(o.estadoInterno || '').trim().toUpperCase();
  const estRaw = String(o.estado || '').trim().toUpperCase();

  return (
    areaAct === 'ÁREA NEUTRA / BACKLOG' ||
    areaAct === 'AREA NEUTRA / BACKLOG' ||
    areaAct === 'AREA_NEUTRA' ||
    areaRaw === 'AREA_NEUTRA' ||
    estInt === 'PENDIENTE_INGENIERIA' ||
    estRaw === 'PENDIENTE_INGENIERIA' ||
    areaAct === 'COMERCIAL / VENTAS'
  );
};

export default function NeutralAreaBacklogView() {
  const {
    orders,
    setOrders,
    syncOrderToSupabase,
    coordinationAlerts,
    supervisorProfile,
    setShowAddModal,
    setSelectedOrder,
    setSearchResults,
    setShowSearchSelector,
    setDuplicateError
  } = useAppContext();

  const [backlogSearch, setBacklogSearch] = useState('');
  const [expandedPedidos, setExpandedPedidos] = useState({});
  const [targetAreaByPedido, setTargetAreaByPedido] = useState({});
  const [targetAreaByItem, setTargetAreaByItem] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const productionTargetAreas = useMemo(() => {
    return AREAS_RECEPCION.filter(
      (a) => a !== 'Área Neutra / Backlog' && a !== 'Comercial / Ventas'
    );
  }, []);

  const alertsMap = useMemo(() => {
    const map = new Map();
    (coordinationAlerts || []).forEach((a) => {
      const k = String(a?.pedidoNum || '').trim().toUpperCase();
      if (k && !map.has(k)) map.set(k, a);
    });
    return map;
  }, [coordinationAlerts]);

  const backlogOrders = useMemo(() => {
    const q = backlogSearch.trim().toLowerCase();
    return (orders || []).filter((o) => {
      if (!isOrderInNeutralBacklog(o)) return false;
      if (!q) return true;
      return (
        String(o.pedidoNum || '').toLowerCase().includes(q) ||
        String(o.cliente || '').toLowerCase().includes(q) ||
        String(o.codArticulo || '').toLowerCase().includes(q) ||
        String(o.nombre || '').toLowerCase().includes(q)
      );
    });
  }, [orders, backlogSearch]);

  const groupedBacklogPedidos = useMemo(() => {
    const map = new Map();
    backlogOrders.forEach((ord) => {
      const ped = String(ord.pedidoNum || 'S/N').trim().toUpperCase();
      if (!map.has(ped)) {
        const alertObj = alertsMap.get(ped);
        map.set(ped, {
          pedidoNum: ped,
          cliente: ord.cliente || 'CLIENTE GENERAL',
          fechaEntrega: alertObj?.fechaEntrega || ord.fechaEntregaPrometida || null,
          fechaIngreso: ord.fechaIngresoArea || null,
          items: []
        });
      }
      map.get(ped).items.push(ord);
    });

    return Array.from(map.values()).sort((a, b) =>
      String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true })
    );
  }, [backlogOrders, alertsMap]);

  const totalUnitsCount = useMemo(
    () => backlogOrders.reduce((acc, o) => acc + (Number(o.cantidad) || 1), 0),
    [backlogOrders]
  );

  const handleCopyStamp = async (e, product) => {
    e.stopPropagation();
    try {
      await copyBlueprintQrToClipboard(product);
      setCopiedId(product.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      alert(err.message || 'No se pudo copiar la estampilla al portapapeles.');
    }
  };

  const handleDownloadAllPedidoQrs = (pedidoGroup) => {
    if (!pedidoGroup || !Array.isArray(pedidoGroup.items)) return;
    pedidoGroup.items.forEach((item, idx) => {
      setTimeout(() => {
        downloadBlueprintQrPng(item);
      }, idx * 280);
    });
    showCdiBlueprintToast(
      `Descargando ${pedidoGroup.items.length} estampillas PNG para SolidWorks (PED #${pedidoGroup.pedidoNum})`
    );
  };

  const handleMoveItemToProduction = (product, destinationArea) => {
    const targetArea = destinationArea || targetAreaByItem[product.id] || 'Diseño';
    const nextState = CONFIG_PROCESOS[targetArea]?.[0] || 'En Espera';
    const nowIso = new Date().toISOString();

    const updatedOrder = {
      ...product,
      area: targetArea,
      areaActual: targetArea,
      estado: 'EN_ESPERA',
      estadoInterno: nextState,
      qr_plano_payload:
        product.qr_plano_payload || buildProductBlueprintQrPayload(product),
      fechaIngresoArea: nowIso,
      historial: [
        ...(Array.isArray(product.historial) ? product.historial : []),
        {
          fecha: nowIso,
          accion: `Liberado desde Área Neutra / Backlog hacia ${targetArea}`,
          entrega: (supervisorProfile?.name || 'INGENIERÍA').toUpperCase(),
          recibe: targetArea.toUpperCase()
        }
      ]
    };

    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    syncOrderToSupabase(updatedOrder);
    showCdiBlueprintToast(
      `Ítem ${product.codArticulo} enviado a ${targetArea}`
    );
  };

  const handleMoveEntirePedidoToProduction = (pedidoGroup) => {
    if (!pedidoGroup || !Array.isArray(pedidoGroup.items)) return;
    const targetArea =
      targetAreaByPedido[pedidoGroup.pedidoNum] || 'Diseño';
    const nextState = CONFIG_PROCESOS[targetArea]?.[0] || 'En Espera';
    const nowIso = new Date().toISOString();
    const idsToMove = new Set(pedidoGroup.items.map((i) => i.id));

    const updatedList = [];
    setOrders((prev) =>
      prev.map((o) => {
        if (!idsToMove.has(o.id)) return o;
        const updated = {
          ...o,
          area: targetArea,
          areaActual: targetArea,
          estado: 'EN_ESPERA',
          estadoInterno: nextState,
          qr_plano_payload: o.qr_plano_payload || buildProductBlueprintQrPayload(o),
          fechaIngresoArea: nowIso,
          historial: [
            ...(Array.isArray(o.historial) ? o.historial : []),
            {
              fecha: nowIso,
              accion: `Liberación Masiva desde Área Neutra / Backlog hacia ${targetArea}`,
              entrega: (supervisorProfile?.name || 'INGENIERÍA').toUpperCase(),
              recibe: targetArea.toUpperCase()
            }
          ]
        };
        updatedList.push(updated);
        return updated;
      })
    );

    updatedList.forEach((u) => syncOrderToSupabase(u));
    showCdiBlueprintToast(
      `Pedido #${pedidoGroup.pedidoNum} (${pedidoGroup.items.length} ítems) liberado a ${targetArea}`
    );
  };

  return (
    <div className="max-w-[96vw] mx-auto px-2 sm:px-4 py-6 space-y-6 animate-in fade-in duration-200">
      {/* CABECERA PANORÁMICA DEL ÁREA NEUTRA / BACKLOG */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 border-2 border-indigo-500/40 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <FolderKanban size={30} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  MES • Etapa Pre-Planta (Backlog Comercial e Ingeniería)
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Estampillas SolidWorks 220×96 px Calibradas
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1">
                Área Neutra / Backlog de Ingeniería y Diseño
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-3xl">
                Repositorio de pedidos comerciales pendientes por bajar a planta. Desde aquí el equipo de Diseño y Programación copia con 1 clic la estampilla QR horizontal para pegarla con <strong>Ctrl+V</strong> en los planos de <strong>SolidWorks (.SLDDRW)</strong> antes de liberar los ítems a producción.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSearchResults([]);
                setShowSearchSelector(false);
                setDuplicateError('');
                setShowAddModal(true);
              }}
              className="px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={18} strokeWidth={3} />
              <span>Cargar Pedido a Área Neutra</span>
            </button>
          </div>
        </div>

        {/* KPIs RÁPIDOS + BUSCADOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Pedidos en Backlog
              </span>
              <span className="text-2xl font-black text-white">
                {groupedBacklogPedidos.length}
              </span>
            </div>
            <Layers className="text-indigo-400" size={26} />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Ítems Pendientes Ingeniería
              </span>
              <span className="text-2xl font-black text-amber-400">
                {backlogOrders.length}
              </span>
            </div>
            <FileCode2 className="text-amber-400" size={26} />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Unidades Futuras
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {totalUnitsCount}
              </span>
            </div>
            <Package className="text-emerald-400" size={26} />
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400" size={18} />
            <input
              type="text"
              value={backlogSearch}
              onChange={(e) => setBacklogSearch(e.target.value)}
              placeholder="Buscar pedido, cliente o código..."
              className="w-full h-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white font-bold text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* LISTADO DE PEDIDOS EN EL BACKLOG */}
      {groupedBacklogPedidos.length === 0 ? (
        <div className="theme-bg-card border-2 border-dashed theme-border rounded-3xl p-12 text-center space-y-3">
          <FolderKanban size={48} className="mx-auto text-indigo-500 opacity-60" />
          <h3 className="text-lg font-black uppercase theme-text-main">
            No hay pedidos pendientes en el Área Neutra / Backlog
          </h3>
          <p className="text-sm font-medium theme-text-muted max-w-lg mx-auto">
            Usa el botón <strong>"Cargar Pedido a Área Neutra"</strong> para ingresar nuevos pedidos comerciales antes de enviarlos a producción y generar sus códigos QR para SolidWorks.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBacklogPedidos.map((group) => {
            const isExpanded = expandedPedidos[group.pedidoNum] !== false;
            const dLeft = getDaysLeft(group.fechaEntrega);
            const selectedDestArea =
              targetAreaByPedido[group.pedidoNum] || 'Diseño';

            return (
              <div
                key={group.pedidoNum}
                className="theme-bg-card border-2 theme-border rounded-3xl shadow-xl overflow-hidden"
              >
                {/* CABECERA DEL PEDIDO */}
                <div className="p-4 sm:p-5 theme-bg-header border-b theme-border flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div
                    className="flex flex-wrap items-center gap-3 cursor-pointer"
                    onClick={() =>
                      setExpandedPedidos((prev) => ({
                        ...prev,
                        [group.pedidoNum]: !isExpanded
                      }))
                    }
                  >
                    <span className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-base sm:text-lg tracking-wide shadow">
                      PED #{group.pedidoNum}
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black uppercase theme-text-main leading-tight">
                        {group.cliente}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs font-bold theme-text-muted">
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black">
                          {group.items.length} ÍTEM(S) EN BACKLOG
                        </span>
                        {group.fechaEntrega ? (
                          <span
                            className={`px-2 py-0.5 rounded flex items-center gap-1 font-black ${
                              dLeft !== null && dLeft < 0
                                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            <Calendar size={12} />
                            Entrega: {formatLocalDate(group.fechaEntrega)}
                            {dLeft !== null && ` (${dLeft} días)`}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-500 flex items-center gap-1">
                            <Clock size={12} /> Fecha por coordinar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ACCIONES MASIVAS DEL PEDIDO (DESCARGAR QRs + ENVIAR A PLANTA) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadAllPedidoQrs(group)}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase flex items-center gap-1.5 border border-slate-700 shadow cursor-pointer"
                      title="Descargar todas las estampillas PNG (440x192px) de este pedido"
                    >
                      <Download size={15} />
                      <span>Descargar Todos los QRs ({group.items.length})</span>
                    </button>

                    <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl border theme-border">
                      <select
                        value={selectedDestArea}
                        onChange={(e) =>
                          setTargetAreaByPedido((prev) => ({
                            ...prev,
                            [group.pedidoNum]: e.target.value
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-xl theme-bg-card theme-text-main font-black text-xs uppercase border theme-border outline-none cursor-pointer"
                      >
                        {productionTargetAreas.map((area) => (
                          <option key={area} value={area}>
                            Hacia: {area}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleMoveEntirePedidoToProduction(group)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <span>Liberar Pedido</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* CUADRÍCULA DE ÍTEMS Y ESTAMPILLAS QR PARA SOLIDWORKS */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                    {group.items.map((item) => {
                      const itemDestArea =
                        targetAreaByItem[item.id] || 'Diseño';
                      const isCopied = copiedId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedOrder(item)}
                          className="p-4 rounded-2xl theme-bg-main border-2 theme-border hover:border-indigo-500/60 transition-all flex flex-col justify-between gap-3 shadow-sm cursor-pointer"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono font-black text-xs">
                                CÓD: {item.codArticulo || 'S/C'}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-black text-xs">
                                CANT: {item.cantidad || 1}
                              </span>
                            </div>

                            <h4 className="font-black text-sm sm:text-base uppercase theme-text-main leading-snug">
                              {item.nombre}
                            </h4>

                            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                              Estado: {item.estadoInterno || 'PENDIENTE_INGENIERIA'}
                            </div>
                          </div>

                          {/* VISTA PREVIA FIEL 1:1 (220x96px) DE LA ESTAMPILLA DE SOLIDWORKS */}
                          <div
                            className="bg-slate-200/70 dark:bg-slate-950/70 p-2.5 rounded-xl border theme-border flex flex-col items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-[10px] font-black uppercase tracking-wider theme-text-muted">
                              Estampilla SolidWorks (220×96 px • Nivel H)
                            </div>
                            <SolidWorksStampPreview product={item} />

                            <div className="grid grid-cols-2 gap-1.5 w-full pt-1">
                              <button
                                type="button"
                                onClick={(e) => handleCopyStamp(e, item)}
                                className={`py-2 px-2.5 rounded-xl font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                                }`}
                                title="Copiar imagen PNG al portapapeles para pegar con Ctrl+V en SolidWorks (.SLDDRW)"
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCircle2 size={14} />
                                    <span>¡Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={14} />
                                    <span>Copiar QR Plano</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadBlueprintQrPng(item);
                                }}
                                className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                                title="Descargar PNG en alta resolución (440x192 px)"
                              >
                                <Download size={14} />
                                <span>Descargar PNG</span>
                              </button>
                            </div>
                          </div>

                          {/* ENVIAR ÍTEM INDIVIDUAL A PRODUCCIÓN */}
                          <div
                            className="pt-2 border-t theme-border flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={itemDestArea}
                              onChange={(e) =>
                                setTargetAreaByItem((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value
                                }))
                              }
                              className="flex-1 px-2 py-1.5 rounded-lg theme-bg-card theme-text-main font-bold text-[11px] uppercase border theme-border outline-none"
                            >
                              {productionTargetAreas.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() =>
                                handleMoveItemToProduction(item, itemDestArea)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <span>Enviar</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
