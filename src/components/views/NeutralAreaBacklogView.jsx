import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Search,
  Calendar,
  Package,
  Copy,
  Download,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCode2,
  FolderKanban,
  LayoutList,
  ArrowUpDown
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../supabaseClient';
import { AREAS_RECEPCION, CONFIG_PROCESOS } from '../../utils/constants';
import { getDaysLeft, formatLocalDate } from '../../utils/helpers';
import { cleanErpCode, normalizeProductName } from '../../services/ribisoftExcelImporter';
import {
  SolidWorksStampPreview,
  copyBlueprintQrToClipboard,
  downloadBlueprintQrPng,
  buildProductBlueprintQrPayload,
  showCdiBlueprintToast
} from '../../utils/colorQrHelper';
import {
  isTargetBacklogDeliveryDate,
  parseCommercialDeliveryDate
} from '../../services/neutralBacklogSyncService';

const MONTH_NAMES = [
  { num: 1, name: 'Enero', short: 'Ene' },
  { num: 2, name: 'Febrero', short: 'Feb' },
  { num: 3, name: 'Marzo', short: 'Mar' },
  { num: 4, name: 'Abril', short: 'Abr' },
  { num: 5, name: 'Mayo', short: 'May' },
  { num: 6, name: 'Junio', short: 'Jun' },
  { num: 7, name: 'Julio', short: 'Jul' },
  { num: 8, name: 'Agosto', short: 'Ago' },
  { num: 9, name: 'Septiembre', short: 'Sep' },
  { num: 10, name: 'Octubre', short: 'Oct' },
  { num: 11, name: 'Noviembre', short: 'Nov' },
  { num: 12, name: 'Diciembre', short: 'Dic' }
];

export const isOrderInNeutralBacklog = (o, alertsMap = null) => {
  if (!o || o.estadoInterno === 'DESPACHADO' || o.isTerminado) return false;
  const areaAct = String(o.areaActual || '').trim().toUpperCase();
  const areaRaw = String(o.area || '').trim().toUpperCase();
  const estInt = String(o.estadoInterno || '').trim().toUpperCase();
  const estRaw = String(o.estado || '').trim().toUpperCase();

  if (
    areaAct === 'ÁREA DE CONSULTA GENERAL' ||
    areaAct === 'AREA DE CONSULTA GENERAL' ||
    areaAct === 'ÁREA NEUTRA / BACKLOG' ||
    areaAct === 'AREA NEUTRA / BACKLOG' ||
    areaAct === 'AREA_NEUTRA' ||
    areaRaw === 'AREA_NEUTRA' ||
    estInt === 'PENDIENTE_INGENIERIA' ||
    estRaw === 'PENDIENTE_INGENIERIA' ||
    areaAct === 'COMERCIAL / VENTAS'
  ) {
    return true;
  }

  const hasPlantWork =
    (Array.isArray(o.bitacoraTurnos) && o.bitacoraTurnos.length > 0) ||
    (Array.isArray(o.bitacoraCalidad) && o.bitacoraCalidad.length > 0) ||
    (Array.isArray(o.historial) && o.historial.length > 1);

  if (!hasPlantWork) {
    const pedKey = String(o.pedidoNum || '').replace(/^#/, '').trim().toUpperCase();
    const alertDate = alertsMap && pedKey ? alertsMap.get(pedKey)?.fechaEntrega : null;
    const candidateDate = o.fechaEntregaPrometida || alertDate;
    if (candidateDate && isTargetBacklogDeliveryDate(candidateDate)) {
      return true;
    }
  }

  return false;
};

export default function NeutralAreaBacklogView() {
  const {
    orders,
    setOrders,
    syncOrderToSupabase,
    coordinationAlerts,
    supervisorProfile,
    setSelectedOrder,
    supabaseData,
    gridColumns,
    setGridColumns
  } = useAppContext();

  const {
    searchTerm: globalSearchTerm,
    clientFilter: globalClientFilter,
    sortBy,
    setSortBy
  } = useAppStore();

  const [ribisoftRows, setRibisoftRows] = useState([]);
  const [loadingRibi, setLoadingRibi] = useState(true);
  const [backlogSearch, setBacklogSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('TODOS'); // 'TODOS' | '1'..'12' | 'YYYY-MM'
  const [selectedYear, setSelectedYear] = useState('TODOS'); // 'TODOS' | '2026' | '2027'
  const [minPedidoNum, setMinPedidoNum] = useState(63500);
  const [expandedPedidos, setExpandedPedidos] = useState({});
  const [targetAreaByPedido, setTargetAreaByPedido] = useState({});
  const [targetAreaByItem, setTargetAreaByItem] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const productionTargetAreas = useMemo(() => {
    return AREAS_RECEPCION.filter(
      (a) =>
        a !== 'Área de Consulta General' &&
        a !== 'Área Neutra / Backlog' &&
        a !== 'Comercial / Ventas'
    );
  }, []);

  const alertsMap = useMemo(() => {
    const map = new Map();
    (coordinationAlerts || []).forEach((a) => {
      const k = String(a?.pedidoNum || '').replace(/^#/, '').trim().toUpperCase();
      if (k && !map.has(k)) map.set(k, a);
    });
    return map;
  }, [coordinationAlerts]);

  const prodToCodptMap = useMemo(() => {
    const map = new Map();
    const reqList = supabaseData?.requerimientos || [];
    reqList.forEach((r) => {
      const pSin = cleanErpCode(r.pedido_sin ?? r.pedidosin);
      const codpt = cleanErpCode(r.codpt);
      const prod = normalizeProductName(r.producto);
      if (pSin && codpt && prod) {
        map.set(`${pSin}__${prod}`, codpt);
      }
    });
    return map;
  }, [supabaseData]);

  useEffect(() => {
    let isMounted = true;

    const loadRibisoftPedidos = async () => {
      setLoadingRibi(true);
      try {
        await supabase.auth.getSession();
        let allRows = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore && isMounted) {
          const { data, error } = await supabase
            .from('ribisoft_pedidos')
            .select('*')
            .range(from, from + step - 1);

          if (error || !data || data.length === 0) {
            hasMore = false;
          } else {
            allRows = allRows.concat(data);
            from += step;
            if (data.length < step) hasMore = false;
          }
        }

        if (isMounted) {
          setRibisoftRows(allRows);
        }
      } catch (err) {
        console.error('Error cargando pedidos desde ribisoft_pedidos:', err);
      } finally {
        if (isMounted) setLoadingRibi(false);
      }
    };

    loadRibisoftPedidos();

    const handleErpSynced = () => {
      loadRibisoftPedidos();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cdi-erp-synced', handleErpSynced);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('cdi-erp-synced', handleErpSynced);
      }
    };
  }, []);

  /**
   * Unifica en una sola vista todos los pedidos que:
   * 1) Fueron cargados a `Área de Consulta General` en `orders` (`produccion_pedidos`), Y
   * 2) Todos los pedidos e ítems que entraron al RIBI por el archivo Excel (`ribisoft_pedidos`)
   *    y que aún no han entrado en producción en las secciones de planta.
   */
  const unifiedConsultaItems = useMemo(() => {
    const itemsMap = new Map();
    const plantStartedSet = new Set();

    // 1. Clasificar órdenes existentes en `produccion_pedidos`
    (orders || []).forEach((ord) => {
      if (!ord || !ord.pedidoNum) return;
      const ped = String(ord.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      const cod = cleanErpCode(ord.codArticulo || ord.codigo_item || '') || '';
      const normName = normalizeProductName(ord.nombre || ord.descripcion || '');
      const key = `${ped}__${normName || cod || ord.id}`;

      if (isOrderInNeutralBacklog(ord, alertsMap)) {
        itemsMap.set(key, {
          ...ord,
          pedidoNum: ped,
          codArticulo: (cod || ord.codArticulo || 'S/C').toUpperCase(),
          isFromPlantTable: true
        });
      } else {
        if (cod) plantStartedSet.add(`${ped}__CODE__${cod.toUpperCase()}`);
        if (normName) plantStartedSet.add(`${ped}__NAME__${normName}`);
      }
    });

    // 2. Incorporar todos los pedidos de `ribisoft_pedidos` (Excel RIBI) que aún no están en secciones de planta
    const minNumVal = Number(minPedidoNum) || 0;

    (ribisoftRows || []).forEach((r, idx) => {
      if (!r || typeof r !== 'object') return;
      const rawPed = cleanErpCode(r['PedidoSIN'] ?? r['pedido_sin'] ?? r['pedidosin'] ?? r['Pedido']);
      if (!rawPed) return;
      const ped = String(rawPed).replace(/^#/, '').trim().toUpperCase();

      const numMatch = ped.match(/\d+/);
      const pedNumber = numMatch ? Number(numMatch[0]) : 0;

      const rawFechaEntrega =
        r['Fecha Entrega'] ??
        r['fecha_entrega'] ??
        r['Fecha de Entrega'] ??
        alertsMap.get(ped)?.fechaEntrega ??
        null;

      const hasFutureDate = isTargetBacklogDeliveryDate(rawFechaEntrega);

      if (!hasFutureDate && minNumVal > 0 && pedNumber > 0 && pedNumber < minNumVal) {
        return;
      }

      const desc = String(
        r['Descripción'] ?? r['Descripcion'] ?? r['descripcion'] ?? r['Producto'] ?? r['producto'] ?? ''
      ).trim();
      const normName = normalizeProductName(desc);
      let cod = cleanErpCode(r['Código Ítem'] ?? r['codigo_item'] ?? r['codpt'] ?? '') || '';
      if (!cod && normName && prodToCodptMap.has(`${ped}__${normName}`)) {
        cod = prodToCodptMap.get(`${ped}__${normName}`);
      }
      const codUpper = (cod || 'S/C').toUpperCase();

      if (!normName && codUpper === 'S/C') return;

      if (
        (cod && plantStartedSet.has(`${ped}__CODE__${codUpper}`)) ||
        (normName && plantStartedSet.has(`${ped}__NAME__${normName}`))
      ) {
        return;
      }

      const key = `${ped}__${normName || codUpper}`;
      const existing = itemsMap.get(key);

      if (!existing || ((!existing.codArticulo || existing.codArticulo === 'S/C') && cod)) {
        const deterministicId = existing?.id || `RIBI_${ped}_${codUpper !== 'S/C' ? codUpper : idx + 1}`;
        const parsedEntrega = parseCommercialDeliveryDate(rawFechaEntrega);
        const parsedGenera = parseCommercialDeliveryDate(
          r['fecha_genera_ped'] ?? r['Fecha Genera Ped.'] ?? r['fecha_asigna']
        );

        itemsMap.set(key, {
          id: deterministicId,
          pedidoNum: ped,
          pedidoNumeric: pedNumber,
          codArticulo: codUpper,
          codigo_item: codUpper,
          qr_plano_payload: buildProductBlueprintQrPayload({
            id: deterministicId,
            pedidoNum: ped,
            codArticulo: codUpper
          }),
          nombre: normName || 'PRODUCTO RIBI',
          cantidad: Number(r['Cantidad'] ?? r['cantidad']) || 1,
          cliente: String(
            r['Cliente'] ??
              r['cliente'] ??
              r['Nombre Proyecto'] ??
              alertsMap.get(ped)?.cliente ??
              'CLIENTE GENERAL'
          )
            .trim()
            .toUpperCase(),
          nombre_proyecto: String(r['Nombre Proyecto'] ?? r['nombre_proyecto'] ?? '')
            .trim()
            .toUpperCase(),
          programador: String(r['Programador'] ?? r['programador'] ?? '')
            .trim()
            .toUpperCase(),
          area: 'AREA_NEUTRA',
          areaActual: 'Área de Consulta General',
          estado: 'PENDIENTE_INGENIERIA',
          estadoInterno: r['Estado'] || 'EN CONSULTA GENERAL (RIBI)',
          fechaEntregaPrometida: parsedEntrega?.isoDate || existing?.fechaEntregaPrometida || null,
          fechaGeneraPed: parsedGenera?.isoDate || null,
          dim_1: r['dim_1'] ?? r['Dim.1'] ?? null,
          dim_2: r['dim_2'] ?? r['Dim.2'] ?? null,
          dim_3: r['dim_3'] ?? r['Dim.3'] ?? null,
          acabado_1: r['acabado_1'] ?? r['Acabado1'] ?? null,
          acabado_2: r['acabado_2'] ?? r['Acabado2'] ?? null,
          acabado_3: r['acabado_3'] ?? r['Acabado3'] ?? null,
          caracteristicas: r['caracteristicas'] ?? r['Características'] ?? null,
          categoria: r['categoria'] ?? r['Categoria'] ?? null,
          notas: r['notas'] ?? r['Notas'] ?? null,
          observaciones_erp: r['observaciones_erp'] ?? r['Observaciones'] ?? null,
          isFromPlantTable: Boolean(existing?.isFromPlantTable)
        });
      }
    });

    return Array.from(itemsMap.values());
  }, [orders, ribisoftRows, alertsMap, prodToCodptMap, minPedidoNum]);

  // Detectar meses disponibles dinámicamente en los pedidos cargados para mostrar píldoras rápidas de mes
  const availableYearMonths = useMemo(() => {
    const ymMap = new Map();
    unifiedConsultaItems.forEach((item) => {
      const pedKey = String(item.pedidoNum || '').trim().toUpperCase();
      const rawDate =
        alertsMap.get(pedKey)?.fechaEntrega ||
        item.fechaEntregaPrometida ||
        item.fechaGeneraPed;
      const parsed = parseCommercialDeliveryDate(rawDate);
      if (parsed) {
        const ymKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
        if (!ymMap.has(ymKey)) {
          const mInfo = MONTH_NAMES.find((m) => m.num === parsed.month);
          ymMap.set(ymKey, {
            key: ymKey,
            year: parsed.year,
            month: parsed.month,
            label: `${mInfo ? mInfo.name : parsed.month} ${parsed.year}`,
            pedidosSet: new Set()
          });
        }
        ymMap.get(ymKey).pedidosSet.add(pedKey);
      }
    });

    return Array.from(ymMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [unifiedConsultaItems, alertsMap]);

  // Filtrado por buscador (global + local), filtro de cliente global, mes y año
  const filteredItems = useMemo(() => {
    const qLocal = backlogSearch.trim().toLowerCase();
    const qGlobal = (globalSearchTerm || '').trim().toLowerCase();
    const clientUpper =
      globalClientFilter && globalClientFilter !== 'Todos'
        ? globalClientFilter.trim().toUpperCase()
        : '';

    return unifiedConsultaItems.filter((item) => {
      const pedKey = String(item.pedidoNum || '').trim().toUpperCase();
      const effDate =
        alertsMap.get(pedKey)?.fechaEntrega ||
        item.fechaEntregaPrometida ||
        item.fechaGeneraPed;
      const parsedDate = parseCommercialDeliveryDate(effDate);

      // Filtro por Año
      if (selectedYear !== 'TODOS') {
        if (!parsedDate || String(parsedDate.year) !== String(selectedYear)) {
          return false;
        }
      }

      // Filtro por Mes ('1'..'12' o 'YYYY-MM')
      if (selectedMonth !== 'TODOS') {
        if (!parsedDate) return false;
        if (selectedMonth.includes('-')) {
          const ym = `${parsedDate.year}-${String(parsedDate.month).padStart(2, '0')}`;
          if (ym !== selectedMonth) return false;
        } else if (Number(parsedDate.month) !== Number(selectedMonth)) {
          return false;
        }
      }

      // Filtro de Cliente de la barra superior
      if (clientUpper) {
        const cliStr = String(item.cliente || '').toUpperCase();
        const proyStr = String(item.nombre_proyecto || '').toUpperCase();
        if (!cliStr.includes(clientUpper) && !proyStr.includes(clientUpper)) {
          return false;
        }
      }

      // Filtro por texto (buscador global y buscador local)
      const matchesQuery = (q) => {
        if (!q) return true;
        return (
          String(item.pedidoNum || '').toLowerCase().includes(q) ||
          String(item.cliente || '').toLowerCase().includes(q) ||
          String(item.nombre_proyecto || '').toLowerCase().includes(q) ||
          String(item.codArticulo || '').toLowerCase().includes(q) ||
          String(item.nombre || '').toLowerCase().includes(q)
        );
      };

      return matchesQuery(qLocal) && matchesQuery(qGlobal);
    });
  }, [
    unifiedConsultaItems,
    backlogSearch,
    globalSearchTerm,
    globalClientFilter,
    selectedMonth,
    selectedYear,
    alertsMap
  ]);

  // Agrupación por Pedido y Ordenamiento dinámico conectado con `sortBy` (Pedido Asc/Desc y Fecha Asc/Desc)
  const groupedPedidos = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((ord) => {
      const ped = String(ord.pedidoNum || 'S/N').replace(/^#/, '').trim().toUpperCase();
      if (!map.has(ped)) {
        const alertObj = alertsMap.get(ped);
        map.set(ped, {
          pedidoNum: ped,
          cliente: ord.cliente || alertObj?.cliente || 'CLIENTE GENERAL',
          proyecto: ord.nombre_proyecto || '',
          fechaEntrega: alertObj?.fechaEntrega || ord.fechaEntregaPrometida || null,
          fechaGenera: ord.fechaGeneraPed || null,
          items: []
        });
      }
      map.get(ped).items.push(ord);
    });

    const list = Array.from(map.values());

    const getEffectiveIsoDate = (group) => {
      const parsed = parseCommercialDeliveryDate(group.fechaEntrega || group.fechaGenera);
      return parsed ? parsed.isoDate : null;
    };

    if (sortBy === 'pedido_asc') {
      list.sort((a, b) =>
        String(a.pedidoNum).localeCompare(String(b.pedidoNum), undefined, { numeric: true })
      );
    } else if (sortBy === 'pedido_desc') {
      list.sort((a, b) =>
        String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true })
      );
    } else if (sortBy === 'fecha_asc') {
      list.sort((a, b) => {
        const dA = getEffectiveIsoDate(a);
        const dB = getEffectiveIsoDate(b);
        if (!dA && !dB) {
          return String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true });
        }
        if (!dA) return 1;
        if (!dB) return -1;
        const cmp = dA.localeCompare(dB);
        if (cmp !== 0) return cmp;
        return String(a.pedidoNum).localeCompare(String(b.pedidoNum), undefined, { numeric: true });
      });
    } else if (sortBy === 'fecha_desc') {
      list.sort((a, b) => {
        const dA = getEffectiveIsoDate(a);
        const dB = getEffectiveIsoDate(b);
        if (!dA && !dB) {
          return String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true });
        }
        if (!dA) return 1;
        if (!dB) return -1;
        const cmp = dB.localeCompare(dA);
        if (cmp !== 0) return cmp;
        return String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true });
      });
    } else {
      // Orden por defecto: Pedido más reciente primero
      list.sort((a, b) =>
        String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true })
      );
    }

    return list;
  }, [filteredItems, alertsMap, sortBy]);

  const totalUnitsCount = useMemo(
    () => filteredItems.reduce((acc, o) => acc + (Number(o.cantidad) || 1), 0),
    [filteredItems]
  );

  // Clases dinámicas de cuadrícula sincronizadas con `gridColumns` (1, 2, 3, 4 o 5 columnas)
  const pedidosGridClass = useMemo(() => {
    if (gridColumns === 1) return 'grid grid-cols-1 gap-4';
    if (gridColumns === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-4';
    if (gridColumns === 4) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
    if (gridColumns === 5) return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4';
    return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'; // Por defecto 3 columnas
  }, [gridColumns]);

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

  const buildPlantReadyOrder = (item, targetArea, nowIso) => {
    const nextState = CONFIG_PROCESOS[targetArea]?.[0] || 'En Espera';
    const generateUUID = () =>
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ORD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const finalId = item.isFromPlantTable ? item.id : generateUUID();

    return {
      ...item,
      id: finalId,
      isFromPlantTable: true,
      area: targetArea,
      areaActual: targetArea,
      estado: 'EN_ESPERA',
      estadoInterno: nextState,
      qr_plano_payload: buildProductBlueprintQrPayload({
        id: finalId,
        pedidoNum: item.pedidoNum,
        codArticulo: item.codArticulo
      }),
      fechaIngresoArea: nowIso,
      bitacoraTurnos: Array.isArray(item.bitacoraTurnos) ? item.bitacoraTurnos : [],
      bitacoraCalidad: Array.isArray(item.bitacoraCalidad) ? item.bitacoraCalidad : [],
      historial: [
        ...(Array.isArray(item.historial) ? item.historial : []),
        {
          fecha: nowIso,
          accion: `Enviado desde Área de Consulta General hacia ${targetArea}`,
          entrega: (supervisorProfile?.name || 'CONSULTA GENERAL').toUpperCase(),
          recibe: targetArea.toUpperCase()
        }
      ]
    };
  };

  const handleMoveItemToProduction = (product, destinationArea) => {
    const targetArea = destinationArea || targetAreaByItem[product.id] || 'Diseño';
    const nowIso = new Date().toISOString();
    const readyOrder = buildPlantReadyOrder(product, targetArea, nowIso);

    setOrders((prev) => {
      const exists = (prev || []).some((o) => o.id === readyOrder.id);
      if (exists) {
        return prev.map((o) => (o.id === readyOrder.id ? readyOrder : o));
      }
      return [...(prev || []), readyOrder];
    });

    syncOrderToSupabase(readyOrder);
    showCdiBlueprintToast(`Ítem ${product.codArticulo} enviado a ${targetArea}`);
  };

  const handleMoveEntirePedidoToProduction = (pedidoGroup) => {
    if (!pedidoGroup || !Array.isArray(pedidoGroup.items)) return;
    const targetArea = targetAreaByPedido[pedidoGroup.pedidoNum] || 'Diseño';
    const nowIso = new Date().toISOString();

    const preparedOrders = pedidoGroup.items.map((item) =>
      buildPlantReadyOrder(item, targetArea, nowIso)
    );

    setOrders((prev) => {
      const byId = new Map((prev || []).map((o) => [o.id, o]));
      preparedOrders.forEach((po) => {
        byId.set(po.id, po);
      });
      return Array.from(byId.values());
    });

    preparedOrders.forEach((po) => syncOrderToSupabase(po));
    showCdiBlueprintToast(
      `Pedido #${pedidoGroup.pedidoNum} (${preparedOrders.length} ítems) enviado a ${targetArea}`
    );
  };

  return (
    <div className="max-w-[96vw] mx-auto px-2 sm:px-4 py-5 space-y-5 animate-in fade-in duration-200">
      {/* CABECERA PANORÁMICA DEL ÁREA DE CONSULTA GENERAL */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border-2 border-indigo-500/40 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 shrink-0">
              <FolderKanban size={28} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Visualización Automática de Pedidos RIBI y Comercial
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Estampillas SolidWorks 220×96 px Calibradas
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight mt-1">
                Área de Consulta General
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5 max-w-4xl">
                Todos los pedidos cargados al sincronizar el archivo de Excel del RIBI o desde <strong>+ Nuevo</strong> que aún no han entrado en producción se visualizan aquí automáticamente.
              </p>
            </div>
          </div>

          {/* SELECTOR RÁPIDO DE COLUMNAS DE CUADRÍCULA Y RANGO DE PEDIDO */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <span className="text-[10px] font-black uppercase text-slate-400 px-2">
                Vista:
              </span>
              {[1, 2, 3, 4, 5].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => setGridColumns(cols)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                    gridColumns === cols
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={cols === 1 ? 'Vista Tipo Lista (1 columna)' : `Cuadrícula de ${cols} Columnas`}
                >
                  {cols === 1 ? 'Lista' : `${cols} Col`}
                </button>
              ))}
            </div>

            <select
              value={minPedidoNum}
              onChange={(e) => setMinPedidoNum(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-xs outline-none cursor-pointer"
            >
              <option value={64000}>Desde Pedido #64000</option>
              <option value={63500}>Desde Pedido #63500</option>
              <option value={63000}>Desde Pedido #63000</option>
              <option value={0}>Histórico Completo RIBI</option>
            </select>
          </div>
        </div>

        {/* BARRA DE FILTRADO POR MESES, AÑO Y ORDENAMIENTO */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Selector de Mes y Año + Píldoras Rápidas por Mes */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 mr-1">
              <Calendar size={14} /> Filtrar por Mes:
            </span>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-xs uppercase outline-none cursor-pointer focus:border-amber-400"
            >
              <option value="TODOS">🗓️ Todos los Meses</option>
              {MONTH_NAMES.map((m) => (
                <option key={m.num} value={String(m.num)}>
                  Mes de {m.name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-black text-xs uppercase outline-none cursor-pointer focus:border-amber-400"
            >
              <option value="TODOS">Todos los Años</option>
              <option value="2026">Año 2026</option>
              <option value="2027">Año 2027</option>
            </select>

            {/* Píldoras rápidas de los meses detectados con pedidos */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth('TODOS');
                  setSelectedYear('TODOS');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer ${
                  selectedMonth === 'TODOS' && selectedYear === 'TODOS'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todos
              </button>
              {availableYearMonths.map((ym) => (
                <button
                  key={ym.key}
                  type="button"
                  onClick={() => {
                    setSelectedYear('TODOS');
                    setSelectedMonth(ym.key);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase transition-all cursor-pointer ${
                    selectedMonth === ym.key
                      ? 'bg-amber-400 text-slate-950 shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ym.label} ({ym.pedidosSet.size})
                </button>
              ))}
            </div>
          </div>

          {/* Selector directo de Ordenamiento sincronizado con la barra superior */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black uppercase text-slate-400 flex items-center gap-1">
              <ArrowUpDown size={13} /> Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-black text-xs uppercase outline-none cursor-pointer"
            >
              <option value="ninguno">Pedido Más Reciente (Desc)</option>
              <option value="pedido_desc">Nº Pedido (Descendente)</option>
              <option value="pedido_asc">Nº Pedido (Ascendente)</option>
              <option value="fecha_asc">Fecha Entrega / RIBI (Ascendente)</option>
              <option value="fecha_desc">Fecha Entrega / RIBI (Descendente)</option>
            </select>
          </div>
        </div>

        {/* KPIs RÁPIDOS + BUSCADOR */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Pedidos Filtrados
              </span>
              <span className="text-2xl font-black text-white">
                {groupedPedidos.length}
              </span>
            </div>
            <Layers className="text-indigo-400" size={24} />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Ítems en Consulta General
              </span>
              <span className="text-2xl font-black text-amber-400">
                {filteredItems.length}
              </span>
            </div>
            <FileCode2 className="text-amber-400" size={24} />
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Unidades
              </span>
              <span className="text-2xl font-black text-emerald-400">
                {totalUnitsCount}
              </span>
            </div>
            <Package className="text-emerald-400" size={24} />
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400" size={18} />
            <input
              type="text"
              value={backlogSearch}
              onChange={(e) => setBacklogSearch(e.target.value)}
              placeholder="Filtrar pedido, cliente o código..."
              className="w-full h-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-white font-bold text-sm outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* LISTADO / CUADRÍCULA DE PEDIDOS EN EL ÁREA DE CONSULTA GENERAL */}
      {loadingRibi && groupedPedidos.length === 0 ? (
        <div className="theme-bg-card border-2 theme-border rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-black uppercase theme-text-main">
            Cargando pedidos del RIBI y Área Comercial desde Supabase...
          </h3>
        </div>
      ) : groupedPedidos.length === 0 ? (
        <div className="theme-bg-card border-2 border-dashed theme-border rounded-3xl p-12 text-center space-y-3">
          <FolderKanban size={48} className="mx-auto text-indigo-500 opacity-60" />
          <h3 className="text-lg font-black uppercase theme-text-main">
            No se encontraron pedidos con el filtro de mes o búsqueda actual
          </h3>
          <p className="text-sm font-medium theme-text-muted max-w-lg mx-auto">
            Puedes cambiar el filtro de mes a <strong>"Todos los Meses"</strong> o sincronizar el archivo Excel del RIBI desde el botón <strong>"+ Nuevo"</strong>.
          </p>
        </div>
      ) : (
        <div className={pedidosGridClass}>
          {groupedPedidos.map((group) => {
            const isExpanded = Boolean(expandedPedidos[group.pedidoNum]);
            const dLeft = getDaysLeft(group.fechaEntrega);
            const selectedDestArea =
              targetAreaByPedido[group.pedidoNum] || 'Diseño';
            const isGridCompact = gridColumns > 1 && !isExpanded;

            return (
              <div
                key={group.pedidoNum}
                className={`theme-bg-card border-2 theme-border rounded-3xl shadow-xl overflow-hidden flex flex-col justify-between transition-all hover:border-indigo-500/60 ${
                  isExpanded ? 'col-span-full' : ''
                }`}
              >
                {/* CABECERA DEL PEDIDO (ADAPTABLE A MODO CUADRÍCULA O MODO LISTA) */}
                <div
                  className={`p-4 sm:p-5 theme-bg-header ${
                    isExpanded ? 'border-b theme-border' : ''
                  } flex flex-col ${
                    isGridCompact ? 'gap-3 h-full justify-between' : 'xl:flex-row xl:items-center justify-between gap-4'
                  }`}
                >
                  <div
                    className="flex flex-col gap-2 cursor-pointer flex-1"
                    onClick={() =>
                      setExpandedPedidos((prev) => ({
                        ...prev,
                        [group.pedidoNum]: !isExpanded
                      }))
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="px-3.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-sm sm:text-base tracking-wide shadow">
                        PED #{group.pedidoNum}
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs">
                        {group.items.length} ÍTEM(S)
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-black uppercase theme-text-main leading-snug line-clamp-2">
                      {group.cliente}
                      {group.proyecto && group.proyecto !== group.cliente
                        ? ` — ${group.proyecto}`
                        : ''}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold theme-text-muted">
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
                          {dLeft !== null && ` (${dLeft}d)`}
                        </span>
                      ) : group.fechaGenera ? (
                        <span className="px-2 py-0.5 rounded bg-slate-500/15 text-slate-600 dark:text-slate-300 flex items-center gap-1 font-bold">
                          <Clock size={12} /> Fecha RIBI: {formatLocalDate(group.fechaGenera)}
                        </span>
                      ) : null}

                      <span className="text-[11px] underline text-indigo-600 dark:text-indigo-400 font-black">
                        {isExpanded ? '▲ Ocultar ítems y QRs' : '▼ Ver ítems y QRs SolidWorks'}
                      </span>
                    </div>
                  </div>

                  {/* ACCIONES MASIVAS DEL PEDIDO (DESCARGAR QRs + ENVIAR A PLANTA) */}
                  <div
                    className={`flex flex-wrap items-center gap-2 ${
                      isGridCompact ? 'pt-2 border-t theme-border justify-between' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleDownloadAllPedidoQrs(group)}
                      className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black uppercase flex items-center gap-1.5 border border-slate-700 shadow cursor-pointer"
                      title="Descargar todas las estampillas PNG (440x192px) de este pedido"
                    >
                      <Download size={14} />
                      <span>QRs ({group.items.length})</span>
                    </button>

                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border theme-border flex-1 sm:flex-initial justify-end">
                      <select
                        value={selectedDestArea}
                        onChange={(e) =>
                          setTargetAreaByPedido((prev) => ({
                            ...prev,
                            [group.pedidoNum]: e.target.value
                          }))
                        }
                        className="px-2 py-1.5 rounded-lg theme-bg-card theme-text-main font-black text-[11px] uppercase border theme-border outline-none cursor-pointer max-w-[150px] truncate"
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
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase flex items-center gap-1 shadow cursor-pointer shrink-0"
                      >
                        <span>Enviar</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* CUADRÍCULA DE ÍTEMS Y ESTAMPILLAS QR PARA SOLIDWORKS */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-black/5 dark:bg-black/20">
                    {group.items.map((item) => {
                      const itemDestArea =
                        targetAreaByItem[item.id] || 'Diseño';
                      const isCopied = copiedId === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.isFromPlantTable) {
                              setSelectedOrder(item);
                            }
                          }}
                          className="p-4 rounded-2xl theme-bg-main border-2 theme-border hover:border-indigo-500/60 transition-all flex flex-col justify-between gap-3 shadow-sm"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono font-black text-xs">
                                CÓD: {item.codArticulo || 'S/C'}
                              </span>
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black text-xs">
                                CANT: {item.cantidad || 1}
                              </span>
                            </div>

                            <h4 className="font-black text-sm sm:text-base uppercase theme-text-main leading-snug">
                              {item.nombre}
                            </h4>

                            {item.programador && (
                              <div className="text-[11px] font-bold theme-text-muted uppercase">
                                Programador: {item.programador}
                              </div>
                            )}
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
