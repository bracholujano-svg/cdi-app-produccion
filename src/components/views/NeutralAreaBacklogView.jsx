import React, { useState, useMemo, useEffect, useRef } from 'react';
import localforage from 'localforage';
import {
  Layers,
  Search,
  Calendar,
  Package,
  Copy,
  Download,
  CheckCircle2,
  Clock,
  FileCode2,
  FolderKanban,
  ArrowUpDown,
  AlertTriangle,
  Truck,
  PieChart,
  History,
  Factory,
  LayoutList
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../supabaseClient';
import { formatLocalDate, getDaysLeft } from '../../utils/helpers';
import { cleanErpCode, normalizeProductName } from '../../services/ribisoftExcelImporter';
import erpDeliveryDatesMap from '../../utils/erpDeliveryDatesMap.json';
import CDILogo from '../ui/CDILogo';
import { PedidoDashboardModal, ProductTraceabilityModal } from '../modals/PedidoConsultaModals';
import {
  SolidWorksStampPreview,
  copyBlueprintQrToClipboard,
  downloadBlueprintQrPng,
  buildProductBlueprintQrPayload
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

const DISENO_PROG_AREAS_UPPER = new Set([
  'DISEÑO',
  'DISENO',
  'PROGRAMACIÓN',
  'PROGRAMACION',
  'PROGRAMACIÓN CNC',
  'PROGRAMACION CNC',
  'PROGRAMACIÓN Y DISEÑO',
  'PROGRAMACION Y DISENO'
]);

const NEUTRAL_COMERCIAL_AREAS_UPPER = new Set([
  'ÁREA DE CONSULTA GENERAL',
  'AREA DE CONSULTA GENERAL',
  'ÁREA NEUTRA / BACKLOG',
  'AREA NEUTRA / BACKLOG',
  'AREA_NEUTRA',
  'COMERCIAL / VENTAS',
  'COMERCIAL'
]);

const classifyOrderInstanceStage = (ord) => {
  if (!ord) return 'COMERCIAL';
  if (ord.estadoInterno === 'DESPACHADO' || ord.isTerminado) return 'PRODUCCION';
  const areaAct = String(ord.areaActual || '').trim().toUpperCase();
  if (areaAct && DISENO_PROG_AREAS_UPPER.has(areaAct)) return 'DISENO_PROG';
  if (areaAct && !NEUTRAL_COMERCIAL_AREAS_UPPER.has(areaAct)) return 'PRODUCCION';
  if (String(ord.programador || '').trim()) return 'DISENO_PROG';
  return 'COMERCIAL';
};

const buildMergedPlantFamily = (matchedOrders = []) => {
  const areaSet = new Set();
  const histSeen = new Set();
  const turnoSeen = new Set();
  const calSeen = new Set();
  const unifiedHistorial = [];
  const unifiedBitacoraTurnos = [];
  const unifiedBitacoraCalidad = [];
  let hasProd = false;
  let hasDisenoProg = false;
  let allFinished = matchedOrders.length > 0;
  let hasTurnos = false;
  let primaryOrder = matchedOrders[0] || null;

  matchedOrders.forEach((o) => {
    if (!o) return;
    const instStage = classifyOrderInstanceStage(o);
    if (instStage === 'PRODUCCION') hasProd = true;
    else if (instStage === 'DISENO_PROG') hasDisenoProg = true;

    const isDone = o.estadoInterno === 'DESPACHADO' || Boolean(o.isTerminado) || String(o.areaActual || '').toUpperCase().includes('DESPACHO');
    if (!isDone) allFinished = false;

    if (o.estadoInterno === 'DESPACHADO') {
      areaSet.add('Despachos (Despachado)');
    } else if (o.areaActual && !NEUTRAL_COMERCIAL_AREAS_UPPER.has(String(o.areaActual).trim().toUpperCase())) {
      areaSet.add(String(o.areaActual).trim());
    }

    (o.historial || []).forEach((h) => {
      if (!h) return;
      const sig = `${h.fecha || ''}|${h.accion || ''}|${h.entrega || ''}|${h.recibe || ''}`;
      if (!histSeen.has(sig)) {
        histSeen.add(sig);
        unifiedHistorial.push(h);
      }
    });

    (o.bitacoraTurnos || []).forEach((t) => {
      if (!t) return;
      hasTurnos = true;
      const sig = `${t.fecha || ''}|${t.actividad || ''}|${t.operario || ''}|${t.area || ''}`;
      if (!turnoSeen.has(sig)) {
        turnoSeen.add(sig);
        unifiedBitacoraTurnos.push(t);
      }
    });

    (o.bitacoraCalidad || []).forEach((q) => {
      if (!q) return;
      const sig = `${q.fecha || ''}|${q.estado || ''}|${q.inspector || ''}`;
      if (!calSeen.has(sig)) {
        calSeen.add(sig);
        unifiedBitacoraCalidad.push(q);
      }
    });

    if (!primaryOrder || (classifyOrderInstanceStage(o) === 'PRODUCCION' && classifyOrderInstanceStage(primaryOrder) !== 'PRODUCCION')) {
      primaryOrder = o;
    }
  });

  return {
    primaryOrder,
    activePlantAreas: Array.from(areaSet),
    unifiedHistorial,
    unifiedBitacoraTurnos,
    unifiedBitacoraCalidad,
    hasProd,
    hasDisenoProg,
    allFinished,
    hasTurnos
  };
};

const resolveItemStageAndAreas = ({
  plantFamily = null,
  programador = '',
  estadoErp = ''
}) => {
  const progClean = String(programador || plantFamily?.primaryOrder?.programador || '').trim();
  const estadoUpper = String(estadoErp || '').trim().toUpperCase();
  const areas = plantFamily?.activePlantAreas || [];

  if (plantFamily?.hasProd) {
    const pct = plantFamily.allFinished ? 100 : plantFamily.hasTurnos ? 85 : 70;
    return {
      stage: 'PRODUCCION',
      stageLabel: 'En Producción',
      stageAreaLabel: areas[0] || 'Producción en Planta',
      activeAreas: areas.length > 0 ? areas : ['Producción en Planta'],
      progressPct: pct
    };
  }

  if (
    plantFamily?.hasDisenoProg ||
    Boolean(progClean) ||
    ['ASIG', 'PROG', 'DISE', 'PRODUCCION', 'PRODUCCIÓN'].some((k) => estadoUpper.includes(k))
  ) {
    const defaultLabel = areas[0] || (progClean ? `Diseño / Prog. CNC (${progClean})` : 'Diseño / Prog. CNC');
    return {
      stage: 'DISENO_PROG',
      stageLabel: 'Diseño y Prog. CNC',
      stageAreaLabel: defaultLabel,
      activeAreas: areas.length > 0 ? areas : ['Diseño / Prog. CNC'],
      progressPct: 30
    };
  }

  return {
    stage: 'COMERCIAL',
    stageLabel: 'En Comercial',
    stageAreaLabel: 'Comercial',
    activeAreas: ['Comercial'],
    progressPct: 0
  };
};

const getMonthWeekInfo = (isoDateStr) => {
  const parsed = parseCommercialDeliveryDate(isoDateStr);
  if (!parsed) return null;
  const weekNum = Math.min(5, Math.ceil(parsed.day / 7));
  const lastDayOfMonth = new Date(parsed.year, parsed.month, 0).getDate();
  const ranges = {
    1: { start: 1, end: 7 },
    2: { start: 8, end: 14 },
    3: { start: 15, end: 21 },
    4: { start: 22, end: 28 },
    5: { start: 29, end: Math.max(29, lastDayOfMonth) }
  };
  const r = ranges[weekNum];
  const mInfo = MONTH_NAMES.find((m) => m.num === parsed.month);
  const mName = mInfo ? mInfo.name : String(parsed.month);
  const mShort = mInfo ? mInfo.short : String(parsed.month);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    weekNum,
    key: String(weekNum),
    shortLabel: `Semana ${weekNum} (${pad(r.start)}-${pad(r.end)} ${mShort})`,
    fullTitle: `Semana ${weekNum} de ${mName} ${parsed.year}`,
    rangeLabel: `Del ${pad(r.start)} al ${pad(r.end)} de ${mName} ${parsed.year}`
  };
};

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
    coordinationAlerts,
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
  const [customDeliveryDatesMap, setCustomDeliveryDatesMap] = useState({});
  const hasSyncedDecMapRef = useRef(false);
  const [backlogSearch, setBacklogSearch] = useState('');

  // 3 Modos de filtrado por fecha/origen:
  // 'GENERACION' -> Fecha de Generación
  // 'DESPACHO' -> Fecha de Despacho
  // 'ALERTAS_COORD' -> Alertas de Coordinación
  const currentYearStr = String(new Date().getFullYear());
  const [filterMode, setFilterMode] = useState('GENERACION');
  const [stageFilter, setStageFilter] = useState('TODOS'); // 'TODOS' | 'PRODUCCION' | 'DISENO_PROG' | 'COMERCIAL' | 'ALERTA_REZAGO'
  const [selectedMonth, setSelectedMonth] = useState('TODOS'); // 'TODOS' | 'YYYY-MM'
  const [selectedWeek, setSelectedWeek] = useState('TODAS'); // 'TODAS' | '1' | '2' | '3' | '4' | '5'
  const [selectedYear, setSelectedYear] = useState(currentYearStr); // Por defecto el año actual; permite elegir 'TODOS' o cualquier año histórico
  const [expandedPedidos, setExpandedPedidos] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [dashboardPedidoGroup, setDashboardPedidoGroup] = useState(null);
  const [traceabilityItem, setTraceabilityItem] = useState(null);

  const alertsMap = useMemo(() => {
    const map = new Map();
    (coordinationAlerts || []).forEach((a) => {
      if (!a || a.tipoRegistro === 'PACKING_LIST') return;
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

    const loadCustomDeliveryDates = async () => {
      try {
        const cachedDates = await localforage.getItem('cdi_ribisoft_delivery_dates_v1');
        if (isMounted && cachedDates && typeof cachedDates === 'object') {
          setCustomDeliveryDatesMap(cachedDates);
        }
      } catch (err) {
        console.warn('Aviso cargando fechas comerciales cacheadas:', err);
      }
    };

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

          // Sincronizar silenciosamente en Supabase una sola vez los pedidos de Diciembre 2026 / 2027
          // presentes en `erpDeliveryDatesMap` cuya `fecha_asigna` aún no refleje esa fecha de entrega comercial
          if (!hasSyncedDecMapRef.current && allRows.length > 0) {
            hasSyncedDecMapRef.current = true;
            const pendingPedUpdates = new Map();
            allRows.forEach((row) => {
              const ped = cleanErpCode(row['PedidoSIN'] ?? row['pedido_sin'] ?? row['Pedido']);
              if (!ped) return;
              const pedKey = String(ped).replace(/^#/, '').trim().toUpperCase();
              const mappedIso = erpDeliveryDatesMap?.[pedKey];
              if (!mappedIso) return;
              if (!mappedIso.startsWith('2026-12') && !mappedIso.startsWith('2027')) return;
              const currentDay = row.fecha_asigna ? String(row.fecha_asigna).slice(0, 10) : '';
              if (currentDay !== mappedIso) {
                pendingPedUpdates.set(pedKey, `${mappedIso}T12:00:00.000Z`);
              }
            });

            if (pendingPedUpdates.size > 0) {
              const entries = Array.from(pendingPedUpdates.entries());
              for (let i = 0; i < entries.length; i += 10) {
                const slice = entries.slice(i, i + 10);
                await Promise.all(
                  slice.map(([pedSin, isoTs]) =>
                    supabase
                      .from('ribisoft_pedidos')
                      .update({ fecha_asigna: isoTs })
                      .eq('PedidoSIN', pedSin)
                  )
                ).catch(() => {});
              }
            }
          }
        }
      } catch (err) {
        console.error('Error cargando pedidos desde ribisoft_pedidos:', err);
      } finally {
        if (isMounted) setLoadingRibi(false);
      }
    };

    loadCustomDeliveryDates();
    loadRibisoftPedidos();

    let realtimeTimer = null;
    const handleErpSynced = () => {
      loadCustomDeliveryDates();
      loadRibisoftPedidos();
    };
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        handleErpSynced();
      }
    };
    const scheduleRibiReload = () => {
      clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        handleErpSynced();
      }, 1500);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('cdi-erp-synced', handleErpSynced);
      window.addEventListener('cdi-force-sync', handleErpSynced);
      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    const ribiChannel = supabase
      .channel('consulta-general-ribi-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ribisoft_pedidos' }, scheduleRibiReload)
      .subscribe();

    return () => {
      isMounted = false;
      clearTimeout(realtimeTimer);
      supabase.removeChannel(ribiChannel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('cdi-erp-synced', handleErpSynced);
        window.removeEventListener('cdi-force-sync', handleErpSynced);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
    };
  }, []);

  /**
   * Unifica en una sola estructura TODOS los ítems de la base de datos:
   * `produccion_pedidos`, `ribisoft_pedidos` y `coordinacion_alertas`, sin excluir los que ya entraron a producción,
   * clasificando cada ítem en VERDE (`PRODUCCION`), AMARILLO (`DISENO_PROG`) o ROJO (`COMERCIAL`)
   * y consolidando sus áreas activas y su historial completo de trazabilidad.
   */
  const unifiedConsultaItems = useMemo(() => {
    const itemsMap = new Map();
    const plantByPedCode = new Map();
    const plantByPedName = new Map();
    const touchedPlantOrderIds = new Set();
    const touchedPedidosSet = new Set();

    // 1. Indexar todas las órdenes de `produccion_pedidos` (incluidas bifurcaciones) por Pedido+Código y Pedido+Nombre
    (orders || []).forEach((ord) => {
      if (!ord || !ord.pedidoNum) return;
      const ped = String(ord.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      const cod = (cleanErpCode(ord.codArticulo || ord.codigo_item || '') || '').toUpperCase();
      const normName = normalizeProductName(ord.nombre || ord.descripcion || '');

      if (cod && cod !== 'S/C') {
        const kCode = `${ped}__CODE__${cod}`;
        if (!plantByPedCode.has(kCode)) plantByPedCode.set(kCode, []);
        plantByPedCode.get(kCode).push(ord);
      }
      if (normName) {
        const kName = `${ped}__NAME__${normName}`;
        if (!plantByPedName.has(kName)) plantByPedName.set(kName, []);
        plantByPedName.get(kName).push(ord);
      }
    });

    // 2. Recorrer TODOS los registros de `ribisoft_pedidos` (sin excluir los que ya entraron a planta) y fusionar con `produccion_pedidos`
    (ribisoftRows || []).forEach((r, idx) => {
      if (!r || typeof r !== 'object') return;
      const rawPed = cleanErpCode(r['PedidoSIN'] ?? r['pedido_sin'] ?? r['pedidosin'] ?? r['Pedido']);
      if (!rawPed) return;
      const ped = String(rawPed).replace(/^#/, '').trim().toUpperCase();

      const numMatch = ped.match(/\d+/);
      const pedNumber = numMatch ? Number(numMatch[0]) : 0;
      const coordAlert = alertsMap.get(ped) || null;

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

      // Buscar coincidencias en `produccion_pedidos`
      const matchedSet = new Map();
      if (codUpper !== 'S/C' && plantByPedCode.has(`${ped}__CODE__${codUpper}`)) {
        plantByPedCode.get(`${ped}__CODE__${codUpper}`).forEach((mo) => matchedSet.set(mo.id, mo));
      }
      if (normName && plantByPedName.has(`${ped}__NAME__${normName}`)) {
        plantByPedName.get(`${ped}__NAME__${normName}`).forEach((mo) => matchedSet.set(mo.id, mo));
      }
      const matchedPlantOrders = Array.from(matchedSet.values());
      matchedPlantOrders.forEach((mo) => touchedPlantOrderIds.add(mo.id));

      const plantFamily = matchedPlantOrders.length > 0 ? buildMergedPlantFamily(matchedPlantOrders) : null;
      const primaryOrd = plantFamily?.primaryOrder || null;

      const rawFechaGen =
        r['fecha_genera_ped'] ??
        r['Fecha Genera Ped.'] ??
        r['Fecha Genera Ped'] ??
        r['Fecha Genera'] ??
        r['fecha_creacion'] ??
        primaryOrd?.fecha_genera_ped ??
        primaryOrd?.fechaGeneraPed ??
        null;

      const mappedCommercialDelivery = customDeliveryDatesMap?.[ped] ?? erpDeliveryDatesMap?.[ped] ?? null;
      const coordRawDate = coordAlert?.fechaEntrega || null;
      const ordPrometidaRaw = primaryOrd?.fechaEntregaPrometida || null;
      const isPrometidaFromCoordOnly = Boolean(
        coordRawDate &&
        ordPrometidaRaw &&
        String(ordPrometidaRaw).trim() === String(coordRawDate).trim() &&
        !primaryOrd?.fecha_entrega &&
        !primaryOrd?.['Fecha Entrega'] &&
        !primaryOrd?.fecha_despacho
      );

      const rawFechaDespacho =
        r['Fecha Entrega'] ??
        r['fecha_entrega'] ??
        r['Fecha de Entrega'] ??
        r['Fecha Despacho'] ??
        r['fecha_despacho'] ??
        r['fecha_entrega_prometida'] ??
        r['fechaEntregaPrometida'] ??
        mappedCommercialDelivery ??
        (!isPrometidaFromCoordOnly ? ordPrometidaRaw : null) ??
        r['fecha_asigna'] ??
        r['Fecha asigna'] ??
        r['Fecha Asigna'] ??
        primaryOrd?.fecha_asigna ??
        null;

      const parsedGen = parseCommercialDeliveryDate(rawFechaGen);
      const parsedDesp = parseCommercialDeliveryDate(rawFechaDespacho);
      const parsedCoordDate = parseCommercialDeliveryDate(coordAlert?.fechaEntrega || coordAlert?.creadoEn);

      const progStr = String(r['Programador'] ?? r['programador'] ?? primaryOrd?.programador ?? '')
        .trim()
        .toUpperCase();
      const estadoErpStr = String(r['Estado'] ?? r['estado'] ?? '').trim();

      const stageInfo = resolveItemStageAndAreas({
        plantFamily,
        programador: progStr,
        estadoErp: estadoErpStr
      });

      const key = `${ped}__${normName || codUpper}`;
      const existing = itemsMap.get(key);
      if (
        !existing ||
        ((!existing.codArticulo || existing.codArticulo === 'S/C') && codUpper !== 'S/C') ||
        (!existing.isFromPlantTable && Boolean(primaryOrd)) ||
        (!existing.fechaGeneracion && parsedGen?.isoDate) ||
        (!existing.fechaDespacho && parsedDesp?.isoDate)
      ) {
        const deterministicId =
          primaryOrd?.id ||
          existing?.id ||
          `RIBI_${ped}_${codUpper !== 'S/C' ? codUpper : idx + 1}`;
        touchedPedidosSet.add(ped);

        itemsMap.set(key, {
          ...(existing || {}),
          ...(primaryOrd || {}),
          id: deterministicId,
          pedidoNum: ped,
          pedidoNumeric: pedNumber,
          codArticulo: codUpper !== 'S/C' ? codUpper : existing?.codArticulo || primaryOrd?.codArticulo || 'S/C',
          codigo_item: codUpper !== 'S/C' ? codUpper : existing?.codigo_item || primaryOrd?.codigo_item || 'S/C',
          qr_plano_payload:
            primaryOrd?.qr_plano_payload ||
            existing?.qr_plano_payload ||
            buildProductBlueprintQrPayload({
              id: deterministicId,
              pedidoNum: ped,
              codArticulo: codUpper
            }),
          nombre: normName || primaryOrd?.nombre || existing?.nombre || 'PRODUCTO RIBI',
          cantidad: Number(r['Cantidad'] ?? r['cantidad'] ?? primaryOrd?.cantidad) || existing?.cantidad || 1,
          cliente: String(
            primaryOrd?.cliente ??
              r['Cliente'] ??
              r['cliente'] ??
              r['Nombre Proyecto'] ??
              existing?.cliente ??
              coordAlert?.cliente ??
              'CLIENTE GENERAL'
          )
            .trim()
            .toUpperCase(),
          nombre_proyecto: String(
            r['Nombre Proyecto'] ?? r['nombre_proyecto'] ?? primaryOrd?.nombre_proyecto ?? existing?.nombre_proyecto ?? ''
          )
            .trim()
            .toUpperCase(),
          programador: progStr || existing?.programador || '',
          fechaAsignaRaw: r['fecha_asigna'] ?? r['Fecha asigna'] ?? null,
          area: primaryOrd?.area || (stageInfo.stage === 'PRODUCCION' ? stageInfo.stageAreaLabel : 'AREA_NEUTRA'),
          areaActual: primaryOrd?.areaActual || stageInfo.stageAreaLabel,
          estado: primaryOrd?.estado || (stageInfo.stage === 'PRODUCCION' ? 'EN_PRODUCCION' : 'PENDIENTE_INGENIERIA'),
          estadoInterno: primaryOrd?.estadoInterno || estadoErpStr || stageInfo.stageLabel.toUpperCase(),
          fechaGeneracion: parsedGen?.isoDate || existing?.fechaGeneracion || null,
          fechaDespacho: parsedDesp?.isoDate || existing?.fechaDespacho || null,
          fechaEntregaPrometida: parsedDesp?.isoDate || existing?.fechaEntregaPrometida || null,
          fechaGeneraPed: parsedGen?.isoDate || existing?.fechaGeneraPed || null,
          hasCoordAlert: Boolean(coordAlert) || Boolean(existing?.hasCoordAlert),
          coordFechaEntrega: parsedCoordDate?.isoDate || existing?.coordFechaEntrega || null,
          coordAlertNota: coordAlert?.notas || coordAlert?.detalle || existing?.coordAlertNota || null,
          stage: stageInfo.stage,
          stageLabel: stageInfo.stageLabel,
          stageAreaLabel: stageInfo.stageAreaLabel,
          activeAreas: stageInfo.activeAreas,
          progressPct: stageInfo.progressPct,
          unifiedHistorial: plantFamily?.unifiedHistorial || existing?.unifiedHistorial || [],
          unifiedBitacoraTurnos: plantFamily?.unifiedBitacoraTurnos || existing?.unifiedBitacoraTurnos || [],
          unifiedBitacoraCalidad: plantFamily?.unifiedBitacoraCalidad || existing?.unifiedBitacoraCalidad || [],
          isInActivePlantArea: stageInfo.stage === 'PRODUCCION',
          isFromPlantTable: Boolean(primaryOrd) || Boolean(existing?.isFromPlantTable)
        });
      }
    });

    // 3. Incorporar órdenes creadas directamente en `produccion_pedidos` que no tuvieran fila en `ribisoft_pedidos`
    const remainingByKey = new Map();
    (orders || []).forEach((ord) => {
      if (!ord || !ord.pedidoNum || touchedPlantOrderIds.has(ord.id)) return;
      const ped = String(ord.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      const cod = (cleanErpCode(ord.codArticulo || ord.codigo_item || '') || '').toUpperCase();
      const normName = normalizeProductName(ord.nombre || ord.descripcion || '');
      const key = `${ped}__${normName || cod || ord.id}`;
      if (!remainingByKey.has(key)) remainingByKey.set(key, []);
      remainingByKey.get(key).push(ord);
    });

    remainingByKey.forEach((groupOrders, key) => {
      const ord = groupOrders[0];
      const ped = String(ord.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      const numMatch = ped.match(/\d+/);
      const pedNumber = numMatch ? Number(numMatch[0]) : 0;
      const coordAlert = alertsMap.get(ped) || null;

      const plantFamily = buildMergedPlantFamily(groupOrders);
      const primaryOrd = plantFamily.primaryOrder || ord;
      const mappedCommercialDelivery = customDeliveryDatesMap?.[ped] ?? erpDeliveryDatesMap?.[ped] ?? null;

      const parsedGen = parseCommercialDeliveryDate(
        primaryOrd.fecha_genera_ped ?? primaryOrd['Fecha Genera Ped.'] ?? primaryOrd.fechaGeneraPed ?? primaryOrd.creadoEn ?? null
      );
      const coordRawDate = coordAlert?.fechaEntrega || null;
      const ordPrometidaRaw = primaryOrd.fechaEntregaPrometida || null;
      const isPrometidaFromCoordOnly = Boolean(
        coordRawDate &&
        ordPrometidaRaw &&
        String(ordPrometidaRaw).trim() === String(coordRawDate).trim() &&
        !primaryOrd.fecha_entrega &&
        !primaryOrd['Fecha Entrega'] &&
        !primaryOrd.fecha_despacho
      );
      const rawDespOrd =
        primaryOrd['Fecha Entrega'] ??
        primaryOrd.fecha_entrega ??
        primaryOrd['Fecha de Entrega'] ??
        primaryOrd['Fecha Despacho'] ??
        primaryOrd.fecha_despacho ??
        (!isPrometidaFromCoordOnly ? ordPrometidaRaw : null) ??
        mappedCommercialDelivery ??
        primaryOrd.fecha_asigna ??
        null;
      const parsedDesp = parseCommercialDeliveryDate(rawDespOrd);
      const parsedCoordDate = parseCommercialDeliveryDate(coordAlert?.fechaEntrega || coordAlert?.creadoEn);

      const stageInfo = resolveItemStageAndAreas({
        plantFamily,
        programador: primaryOrd.programador,
        estadoErp: primaryOrd.estadoInterno || primaryOrd.estado
      });

      touchedPedidosSet.add(ped);
      itemsMap.set(key, {
        ...primaryOrd,
        pedidoNum: ped,
        pedidoNumeric: pedNumber,
        codArticulo: (cleanErpCode(primaryOrd.codArticulo || primaryOrd.codigo_item || '') || 'S/C').toUpperCase(),
        fechaGeneracion: parsedGen?.isoDate || null,
        fechaDespacho: parsedDesp?.isoDate || null,
        coordFechaEntrega: parsedCoordDate?.isoDate || null,
        hasCoordAlert: Boolean(coordAlert),
        coordAlertNota: coordAlert?.notas || coordAlert?.detalle || null,
        stage: stageInfo.stage,
        stageLabel: stageInfo.stageLabel,
        stageAreaLabel: stageInfo.stageAreaLabel,
        activeAreas: stageInfo.activeAreas,
        progressPct: stageInfo.progressPct,
        unifiedHistorial: plantFamily.unifiedHistorial,
        unifiedBitacoraTurnos: plantFamily.unifiedBitacoraTurnos,
        unifiedBitacoraCalidad: plantFamily.unifiedBitacoraCalidad,
        isInActivePlantArea: stageInfo.stage === 'PRODUCCION',
        isFromPlantTable: true
      });
    });

    // 4. Garantizar que cualquier Alerta de Coordinación sin filas en RIBI/Planta también sea visible en ALERTAS_COORD
    alertsMap.forEach((alertObj, pedKey) => {
      if (touchedPedidosSet.has(pedKey)) return;
      const parsedCoordDate = parseCommercialDeliveryDate(alertObj.fechaEntrega || alertObj.creadoEn);
      const deterministicId = `COORD_${pedKey}`;
      itemsMap.set(`${pedKey}__COORD_ONLY`, {
        id: deterministicId,
        pedidoNum: pedKey,
        codArticulo: `PED-${pedKey}`,
        codigo_item: `PED-${pedKey}`,
        qr_plano_payload: buildProductBlueprintQrPayload({
          id: deterministicId,
          pedidoNum: pedKey,
          codArticulo: `PED-${pedKey}`
        }),
        nombre: String(alertObj.notas || alertObj.detalle || `PEDIDO EN COORDINACIÓN #${pedKey}`).toUpperCase(),
        cantidad: 1,
        cliente: String(alertObj.cliente || 'CLIENTE COMERCIAL').trim().toUpperCase(),
        nombre_proyecto: '',
        programador: '',
        area: 'AREA_NEUTRA',
        areaActual: 'Comercial',
        estado: 'PENDIENTE_INGENIERIA',
        estadoInterno: 'ALERTA DE COORDINACIÓN DE PLANTA',
        fechaGeneracion: null,
        fechaDespacho: null,
        fechaEntregaPrometida: null,
        fechaGeneraPed: null,
        hasCoordAlert: true,
        coordFechaEntrega: parsedCoordDate?.isoDate || alertObj.fechaEntrega || null,
        coordAlertNota: alertObj.notas || alertObj.detalle || null,
        stage: 'COMERCIAL',
        stageLabel: 'En Comercial',
        stageAreaLabel: 'Comercial',
        activeAreas: ['Comercial'],
        progressPct: 0,
        unifiedHistorial: [],
        unifiedBitacoraTurnos: [],
        unifiedBitacoraCalidad: [],
        isInActivePlantArea: false,
        isFromPlantTable: false
      });
    });

    return Array.from(itemsMap.values());
  }, [orders, ribisoftRows, alertsMap, prodToCodptMap, customDeliveryDatesMap]);

  /**
   * Extrae la fecha activa del ítem según el `filterMode` seleccionado por el usuario:
   * - 'GENERACION' -> fechaGeneracion (RIBI)
   * - 'DESPACHO' -> fechaDespacho (Comercial)
   * - 'ALERTAS_COORD' -> coordFechaEntrega (solo ítems con hasCoordAlert === true)
   */
  const getFilterModeDateInfo = (item, mode = filterMode) => {
    if (!item) return null;
    if (mode === 'ALERTAS_COORD') {
      if (!item.hasCoordAlert) return null;
      return parseCommercialDeliveryDate(item.coordFechaEntrega);
    }
    if (mode === 'DESPACHO') {
      return parseCommercialDeliveryDate(item.fechaDespacho);
    }
    return parseCommercialDeliveryDate(item.fechaGeneracion || item.fechaDespacho);
  };

  // Lista base según el modo seleccionado: muestra TODOS los pedidos (Comercial + Diseño/CNC + Producción)
  const modeScopedItems = useMemo(() => {
    return unifiedConsultaItems.filter((item) => {
      if (filterMode === 'ALERTAS_COORD') {
        return Boolean(item.hasCoordAlert);
      }
      if (filterMode === 'DESPACHO') {
        return Boolean(item.fechaDespacho);
      }
      return Boolean(item.fechaGeneracion || item.fechaDespacho);
    });
  }, [unifiedConsultaItems, filterMode]);

  // Cambiar criterio de filtro priorizando el año actual si existen registros en ese año para ese modo
  const handleSelectFilterMode = (newMode) => {
    setFilterMode(newMode);
    setSelectedMonth('TODOS');
    const hasCurrentYearInMode = unifiedConsultaItems.some((item) => {
      if (newMode === 'ALERTAS_COORD' && !item.hasCoordAlert) return false;
      if (newMode === 'DESPACHO' && !item.fechaDespacho) return false;
      if (newMode === 'GENERACION' && !item.fechaGeneracion && !item.fechaDespacho) return false;
      const parsed = getFilterModeDateInfo(item, newMode);
      return parsed && String(parsed.year) === currentYearStr;
    });
    setSelectedYear(hasCurrentYearInMode ? currentYearStr : 'TODOS');
  };

  // Años disponibles: rango continuo desde el registro histórico más antiguo (al menos 2021) hasta el próximo año
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    let minY = Math.min(currentY, 2021);
    let maxY = currentY + 1;

    const pushDate = (rawVal) => {
      const parsed = parseCommercialDeliveryDate(rawVal);
      if (parsed?.year && parsed.year >= 2000 && parsed.year <= 2100) {
        if (parsed.year < minY) minY = parsed.year;
        if (parsed.year > maxY) maxY = parsed.year;
      }
    };

    unifiedConsultaItems.forEach((item) => {
      pushDate(item.fechaGeneracion);
      pushDate(item.fechaDespacho);
      pushDate(item.coordFechaEntrega);
      pushDate(item.fechaAsignaRaw);
      pushDate(item.fechaIngresoArea);
    });

    (ribisoftRows || []).forEach((r) => {
      if (!r || typeof r !== 'object') return;
      pushDate(r['fecha_genera_ped']);
      pushDate(r['Fecha Genera Ped.']);
      pushDate(r['Fecha Genera Ped']);
      pushDate(r['Fecha Genera']);
      pushDate(r['fecha_asigna']);
      pushDate(r['Fecha Entrega']);
      pushDate(r['fecha_entrega']);
      pushDate(r['fecha_creacion']);
    });

    (orders || []).forEach((o) => {
      if (!o) return;
      pushDate(o.fechaGeneraPed);
      pushDate(o.fecha_genera_ped);
      pushDate(o.fechaCreacion);
      pushDate(o.fechaIngresoArea);
      pushDate(o.fechaEntregaPrometida);
    });

    const years = [];
    for (let y = minY; y <= maxY; y++) {
      years.push(y);
    }
    return years;
  }, [unifiedConsultaItems, ribisoftRows, orders]);

  // Meses disponibles dinámicamente: SOLO son visibles los meses donde realmente existen pedidos en la fecha seleccionada
  const availableMonthsList = useMemo(() => {
    const ymMap = new Map();
    modeScopedItems.forEach((item) => {
      const parsed = getFilterModeDateInfo(item);
      if (!parsed) return;
      if (selectedYear !== 'TODOS' && String(parsed.year) !== String(selectedYear)) {
        return;
      }
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
      ymMap.get(ymKey).pedidosSet.add(String(item.pedidoNum || '').trim().toUpperCase());
    });

    return Array.from(ymMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [modeScopedItems, filterMode, selectedYear]);

  // Resetear mes si el mes seleccionado deja de existir al cambiar de año o modo
  useEffect(() => {
    if (selectedMonth !== 'TODOS' && !availableMonthsList.some((m) => m.key === selectedMonth)) {
      setSelectedMonth('TODOS');
    }
  }, [availableMonthsList, selectedMonth]);

  // Reiniciar el filtro semanal al cambiar de mes, año o criterio de fecha
  useEffect(() => {
    setSelectedWeek('TODAS');
  }, [filterMode, selectedYear, selectedMonth]);

  // Semanas disponibles dentro del mes seleccionado (Semanas 1..5 con pedidos existentes)
  const availableWeeksInSelectedMonth = useMemo(() => {
    if (selectedMonth === 'TODOS') return [];
    const weekMap = new Map();
    modeScopedItems.forEach((item) => {
      const parsed = getFilterModeDateInfo(item);
      if (!parsed) return;
      if (selectedYear !== 'TODOS' && String(parsed.year) !== String(selectedYear)) {
        return;
      }
      const ymKey = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      if (ymKey !== selectedMonth) return;

      const wInfo = getMonthWeekInfo(parsed.isoDate);
      if (!wInfo) return;
      if (!weekMap.has(wInfo.key)) {
        weekMap.set(wInfo.key, {
          ...wInfo,
          pedidosSet: new Set(),
          itemsCount: 0,
          unitsCount: 0
        });
      }
      const bucket = weekMap.get(wInfo.key);
      bucket.pedidosSet.add(String(item.pedidoNum || '').trim().toUpperCase());
      bucket.itemsCount += 1;
      bucket.unitsCount += Number(item.cantidad) || 1;
    });

    return Array.from(weekMap.values()).sort((a, b) => a.weekNum - b.weekNum);
  }, [modeScopedItems, filterMode, selectedYear, selectedMonth]);

  // Filtrado completo por buscador, cliente, año, mes, semana y modo
  const filteredItems = useMemo(() => {
    const qLocal = backlogSearch.trim().toLowerCase();
    const qGlobal = (globalSearchTerm || '').trim().toLowerCase();
    const clientUpper =
      globalClientFilter && globalClientFilter !== 'Todos'
        ? globalClientFilter.trim().toUpperCase()
        : '';

    return modeScopedItems.filter((item) => {
      const parsedDate = getFilterModeDateInfo(item);

      if (selectedYear !== 'TODOS') {
        if (!parsedDate || String(parsedDate.year) !== String(selectedYear)) {
          return false;
        }
      }

      if (selectedMonth !== 'TODOS') {
        if (!parsedDate) return false;
        const ymKey = `${parsedDate.year}-${String(parsedDate.month).padStart(2, '0')}`;
        if (ymKey !== selectedMonth) return false;

        if (selectedWeek !== 'TODAS') {
          const wInfo = getMonthWeekInfo(parsedDate.isoDate);
          if (!wInfo || wInfo.key !== String(selectedWeek)) return false;
        }
      }

      if (clientUpper) {
        const cliStr = String(item.cliente || '').toUpperCase();
        const proyStr = String(item.nombre_proyecto || '').toUpperCase();
        if (!cliStr.includes(clientUpper) && !proyStr.includes(clientUpper)) {
          return false;
        }
      }

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
    modeScopedItems,
    backlogSearch,
    globalSearchTerm,
    globalClientFilter,
    selectedMonth,
    selectedWeek,
    selectedYear,
    filterMode
  ]);

  // Agrupación por Pedido, cálculo de etapas semáforo, áreas activas, alertas de rezago y ordenamiento
  const allGroupedPedidosBeforeStage = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((ord) => {
      const ped = String(ord.pedidoNum || 'S/N').replace(/^#/, '').trim().toUpperCase();
      if (!map.has(ped)) {
        const alertObj = alertsMap.get(ped);
        map.set(ped, {
          pedidoNum: ped,
          cliente: ord.cliente || alertObj?.cliente || 'CLIENTE GENERAL',
          proyecto: ord.nombre_proyecto || '',
          fechaGeneracion: ord.fechaGeneracion || null,
          fechaDespacho: ord.fechaDespacho || null,
          hasCoordAlert: Boolean(ord.hasCoordAlert || alertObj),
          coordFechaEntrega: ord.coordFechaEntrega || alertObj?.fechaEntrega || null,
          coordAlertNota: ord.coordAlertNota || alertObj?.notas || alertObj?.detalle || null,
          areaActual: ord.isInActivePlantArea ? ord.areaActual : null,
          items: []
        });
      }
      const g = map.get(ped);
      if (!g.fechaGeneracion && ord.fechaGeneracion) g.fechaGeneracion = ord.fechaGeneracion;
      if (!g.fechaDespacho && ord.fechaDespacho) g.fechaDespacho = ord.fechaDespacho;
      if (!g.coordFechaEntrega && ord.coordFechaEntrega) g.coordFechaEntrega = ord.coordFechaEntrega;
      g.items.push(ord);
    });

    const getEffectiveIsoDate = (group) => {
      if (filterMode === 'ALERTAS_COORD') {
        return parseCommercialDeliveryDate(group.coordFechaEntrega)?.isoDate || null;
      }
      if (filterMode === 'DESPACHO') {
        return parseCommercialDeliveryDate(group.fechaDespacho)?.isoDate || null;
      }
      return parseCommercialDeliveryDate(group.fechaGeneracion)?.isoDate || null;
    };

    const stageRank = { PRODUCCION: 0, DISENO_PROG: 1, COMERCIAL: 2 };

    const list = Array.from(map.values()).map((g) => {
      const firstItemIso = g.items?.[0] ? getFilterModeDateInfo(g.items[0])?.isoDate : null;
      let prodCount = 0;
      let disenoProgCount = 0;
      let comercialCount = 0;
      let progressSum = 0;
      const rawLagging = [];
      const areaMap = new Map();

      g.items.forEach((it) => {
        const st = it.stage || 'COMERCIAL';
        const qty = Number(it.cantidad) || 1;
        progressSum += Number(it.progressPct) || 0;

        if (st === 'PRODUCCION') {
          prodCount += 1;
        } else if (st === 'DISENO_PROG') {
          disenoProgCount += 1;
          rawLagging.push(it);
        } else {
          comercialCount += 1;
          rawLagging.push(it);
        }

        const areasForItem =
          Array.isArray(it.activeAreas) && it.activeAreas.length > 0
            ? it.activeAreas
            : [it.stageAreaLabel || 'Comercial'];

        areasForItem.forEach((arName) => {
          const cleanName = String(arName || 'Comercial').trim();
          const upperName = cleanName.toUpperCase();
          let arStage = 'PRODUCCION';
          if (st === 'COMERCIAL' || upperName === 'COMERCIAL') {
            arStage = 'COMERCIAL';
          } else if (
            DISENO_PROG_AREAS_UPPER.has(upperName) ||
            upperName.includes('DISEÑO') ||
            upperName.includes('PROG')
          ) {
            arStage = 'DISENO_PROG';
          }

          if (!areaMap.has(cleanName)) {
            areaMap.set(cleanName, {
              areaName: cleanName,
              itemsCount: 0,
              unitsCount: 0,
              stage: arStage
            });
          }
          const entry = areaMap.get(cleanName);
          entry.itemsCount += 1;
          entry.unitsCount += qty;
        });
      });

      const areaBreakdown = Array.from(areaMap.values()).sort((a, b) => {
        const sr = (stageRank[a.stage] ?? 9) - (stageRank[b.stage] ?? 9);
        if (sr !== 0) return sr;
        return b.itemsCount - a.itemsCount;
      });

      const groupStage =
        prodCount > 0 ? 'PRODUCCION' : disenoProgCount > 0 ? 'DISENO_PROG' : 'COMERCIAL';
      const hasLaggingDesignItems = prodCount > 0 && (disenoProgCount > 0 || comercialCount > 0);
      const productionProgressPct = Math.round(progressSum / Math.max(1, g.items.length));

      return {
        ...g,
        effectiveIsoDate: firstItemIso || getEffectiveIsoDate(g),
        prodCount,
        disenoProgCount,
        comercialCount,
        groupStage,
        hasLaggingDesignItems,
        laggingItems: hasLaggingDesignItems ? rawLagging : [],
        areaBreakdown,
        productionProgressPct
      };
    });

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
        const dA = a.effectiveIsoDate;
        const dB = b.effectiveIsoDate;
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
        const dA = a.effectiveIsoDate;
        const dB = b.effectiveIsoDate;
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
      list.sort((a, b) =>
        String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, { numeric: true })
      );
    }

    return list;
  }, [filteredItems, alertsMap, sortBy, filterMode]);

  const stageCounts = useMemo(() => {
    const counts = {
      todos: allGroupedPedidosBeforeStage.length,
      produccion: 0,
      disenoProg: 0,
      comercial: 0,
      alertaRezago: 0
    };
    allGroupedPedidosBeforeStage.forEach((g) => {
      if (g.groupStage === 'PRODUCCION') counts.produccion += 1;
      else if (g.groupStage === 'DISENO_PROG') counts.disenoProg += 1;
      else counts.comercial += 1;
      if (g.hasLaggingDesignItems) counts.alertaRezago += 1;
    });
    return counts;
  }, [allGroupedPedidosBeforeStage]);

  const groupedPedidos = useMemo(() => {
    if (stageFilter === 'TODOS') return allGroupedPedidosBeforeStage;
    if (stageFilter === 'ALERTA_REZAGO') {
      return allGroupedPedidosBeforeStage.filter((g) => g.hasLaggingDesignItems);
    }
    return allGroupedPedidosBeforeStage.filter((g) => g.groupStage === stageFilter);
  }, [allGroupedPedidosBeforeStage, stageFilter]);

  // Agrupación automática por semanas cuando el usuario selecciona un mes puntual
  const weeklySections = useMemo(() => {
    if (selectedMonth === 'TODOS') return [];
    const secMap = new Map();
    groupedPedidos.forEach((group) => {
      const wInfo = getMonthWeekInfo(group.effectiveIsoDate);
      const wKey = wInfo ? wInfo.key : '0';
      if (!secMap.has(wKey)) {
        secMap.set(wKey, {
          key: wKey,
          weekNum: wInfo ? wInfo.weekNum : 99,
          shortLabel: wInfo ? wInfo.shortLabel : 'Sin Semana',
          fullTitle: wInfo ? wInfo.fullTitle : 'Sin Fecha de Semana',
          rangeLabel: wInfo ? wInfo.rangeLabel : '',
          pedidos: [],
          itemsCount: 0,
          unitsCount: 0
        });
      }
      const sec = secMap.get(wKey);
      sec.pedidos.push(group);
      sec.itemsCount += group.items.length;
      sec.unitsCount += group.items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
    });
    return Array.from(secMap.values()).sort((a, b) => a.weekNum - b.weekNum);
  }, [groupedPedidos, selectedMonth]);

  const filteredItemsCount = useMemo(
    () => groupedPedidos.reduce((acc, g) => acc + g.items.length, 0),
    [groupedPedidos]
  );

  const totalUnitsCount = useMemo(
    () =>
      groupedPedidos.reduce(
        (acc, g) => acc + g.items.reduce((s, o) => s + (Number(o.cantidad) || 1), 0),
        0
      ),
    [groupedPedidos]
  );

  // Cuadrícula dinámica sincronizada con `gridColumns` (1, 2, 3, 4 o 5 columnas)
  const pedidosGridClass = useMemo(() => {
    if (gridColumns === 1) return 'grid grid-cols-1 gap-4';
    if (gridColumns === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-4';
    if (gridColumns === 4) return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';
    if (gridColumns === 5) return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4';
    return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
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

  // Tarjeta compartida por pedido (solo consulta, planificación y trazabilidad)
  const renderPedidoCard = (group) => {
    const isExpanded = Boolean(expandedPedidos[group.pedidoNum]);
    const dLeftDesp = group.fechaDespacho ? getDaysLeft(group.fechaDespacho) : null;
    const dLeftCoord = group.coordFechaEntrega ? getDaysLeft(group.coordFechaEntrega) : null;
    const isGridCompact = gridColumns > 1 && !isExpanded;

    const stageStylesMap = {
      PRODUCCION: {
        border: group.hasLaggingDesignItems
          ? 'border-emerald-500/80 ring-2 ring-amber-400/60'
          : 'border-emerald-500/75',
        headerTint: 'bg-emerald-500/[0.06]',
        badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
        dot: 'bg-emerald-500',
        label: `En Producción (${group.productionProgressPct}%)`,
        pedBg: 'bg-emerald-600 text-white'
      },
      DISENO_PROG: {
        border: 'border-amber-500/80',
        headerTint: 'bg-amber-500/[0.07]',
        badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
        dot: 'bg-amber-500',
        label: 'Diseño y Prog. CNC',
        pedBg: 'bg-amber-500 text-slate-950'
      },
      COMERCIAL: {
        border: 'border-rose-500/75',
        headerTint: 'bg-rose-500/[0.06]',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
        dot: 'bg-rose-500',
        label: 'En Comercial',
        pedBg: 'bg-rose-600 text-white'
      }
    };
    const stMeta = stageStylesMap[group.groupStage] || stageStylesMap.COMERCIAL;

    return (
      <div
        key={group.pedidoNum}
        className={`theme-bg-card border-2 ${
          group.hasCoordAlert && !group.hasLaggingDesignItems
            ? 'border-orange-500/80'
            : stMeta.border
        } rounded-3xl shadow-lg overflow-hidden flex flex-col justify-between transition-all hover:border-[var(--color-primary)] ${
          isExpanded ? 'col-span-full' : ''
        }`}
      >
        {/* CABECERA DEL PEDIDO */}
        <div
          className={`p-4 sm:p-5 theme-bg-header ${stMeta.headerTint} ${
            isExpanded ? 'border-b theme-border' : ''
          } flex flex-col ${
            isGridCompact ? 'gap-3 h-full justify-between' : 'xl:flex-row xl:items-center justify-between gap-4'
          }`}
        >
          <div
            className="flex flex-col gap-2 cursor-pointer flex-1 min-w-0"
            onClick={() =>
              setExpandedPedidos((prev) => ({
                ...prev,
                [group.pedidoNum]: !isExpanded
              }))
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-3.5 py-1 rounded-xl ${stMeta.pedBg} font-black text-sm sm:text-base tracking-wide shadow`}>
                  PED #{group.pedidoNum}
                </span>

                <span
                  className={`px-2.5 py-1 rounded-lg border font-black text-[10px] uppercase flex items-center gap-1.5 ${stMeta.badge}`}
                >
                  <span className={`w-2 h-2 rounded-full ${stMeta.dot}`} />
                  <span>{stMeta.label}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {group.hasCoordAlert && (
                  <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/40 font-black text-[10px] uppercase flex items-center gap-1">
                    <AlertTriangle size={11} /> Coord.
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs">
                  {group.items.length} ÍTEM(S)
                </span>
              </div>
            </div>

            <h3 className="text-sm sm:text-base font-black uppercase theme-text-main leading-snug line-clamp-2">
              {group.cliente}
              {group.proyecto && group.proyecto !== group.cliente
                ? ` — ${group.proyecto}`
                : ''}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold theme-text-muted">
              {group.fechaGeneracion && (
                <span className="px-2 py-0.5 rounded theme-bg-main border theme-border flex items-center gap-1 font-bold">
                  <Clock size={12} /> Gen: {formatLocalDate(group.fechaGeneracion)}
                </span>
              )}

              {group.fechaDespacho && (
                <span
                  className={`px-2 py-0.5 rounded flex items-center gap-1 font-black ${
                    dLeftDesp !== null && dLeftDesp < 0
                      ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <Calendar size={12} />
                  Desp: {formatLocalDate(group.fechaDespacho)}
                  {dLeftDesp !== null && ` (${dLeftDesp}d)`}
                </span>
              )}

              {group.coordFechaEntrega && (filterMode === 'ALERTAS_COORD' || !group.fechaDespacho) && (
                <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/30 flex items-center gap-1 font-black">
                  <AlertTriangle size={12} />
                  Coord: {formatLocalDate(group.coordFechaEntrega)}
                  {dLeftCoord !== null && ` (${dLeftCoord}d)`}
                </span>
              )}
            </div>

            {/* ALERTA DESTACADA: PEDIDO YA EN PRODUCCIÓN CON ÍTEMS REZAGADOS EN DISEÑO / PROG. CNC / COMERCIAL */}
            {group.hasLaggingDesignItems && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPedidos((prev) => ({ ...prev, [group.pedidoNum]: true }));
                }}
                className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/60 border-l-4 border-l-amber-500 text-amber-900 dark:text-amber-200 flex items-start gap-2 cursor-pointer hover:bg-amber-500/20 transition-colors"
                title="Haz clic para expandir y revisar los productos rezagados"
              >
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-snug">
                  <span className="font-black uppercase block">
                    ¡Alerta de Rezago! {group.laggingItems.length} ítem(s) sin entrar a planta
                  </span>
                  <span className="font-semibold opacity-95 block mt-0.5">
                    {group.disenoProgCount > 0 && `${group.disenoProgCount} en Diseño/Prog. CNC`}
                    {group.disenoProgCount > 0 && group.comercialCount > 0 && ' · '}
                    {group.comercialCount > 0 && `${group.comercialCount} aún en Comercial`}
                    {' — '}
                    <span className="underline font-bold">
                      {group.laggingItems
                        .slice(0, 2)
                        .map((li) => `${li.codArticulo || 'S/C'} (${li.nombre})`)
                        .join(', ')}
                      {group.laggingItems.length > 2 ? ` +${group.laggingItems.length - 2} más` : ''}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* DISTRIBUCIÓN ACTUAL POR ÁREAS (ESTILO PRODUCCIÓN) */}
            {group.areaBreakdown && group.areaBreakdown.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {group.areaBreakdown.map((ab) => {
                  const areaBadgeStyle =
                    ab.stage === 'PRODUCCION'
                      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/35'
                      : ab.stage === 'DISENO_PROG'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35';
                  return (
                    <span
                      key={ab.areaName}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-tight ${areaBadgeStyle}`}
                      title={`${ab.itemsCount} ítem(s) / ${ab.unitsCount} und(s) en ${ab.areaName}`}
                    >
                      {ab.itemsCount} {ab.areaName}
                    </span>
                  );
                })}
              </div>
            )}

            {group.coordAlertNota && (
              <div className="text-[11px] font-bold text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2 py-1 line-clamp-2">
                Nota Coord.: {group.coordAlertNota}
              </div>
            )}

            <span className="text-[11px] underline theme-text-primary font-black">
              {isExpanded ? '▲ Ocultar ítems, trazabilidad y QRs' : '▼ Ver ítems, trazabilidad y QRs SolidWorks'}
            </span>
          </div>

          {/* ACCIÓN DE CONSULTA: DASHBOARD TORTA */}
          <div
            className={`flex flex-wrap items-center gap-2 ${
              isGridCompact ? 'pt-2 border-t theme-border justify-end' : ''
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDashboardPedidoGroup(group);
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white border border-slate-700 dark:border-indigo-500 text-[11px] font-black uppercase flex items-center gap-1.5 shadow cursor-pointer hover:brightness-110 transition-all"
              title="Abrir Dashboard del pedido con gráfico de torta y carga de planta"
            >
              <PieChart size={14} className="text-emerald-400 dark:text-emerald-200" />
              <span>Dashboard</span>
            </button>
          </div>
        </div>

        {/* CUADRÍCULA DE ÍTEMS, ÁREAS ACTUALES, TRAZABILIDAD Y ESTAMPILLAS QR PARA SOLIDWORKS */}
        {isExpanded && (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-black/5 dark:bg-black/20">
            {group.items.map((item) => {
              const isCopied = copiedId === item.id;
              const isLaggingItem = group.hasLaggingDesignItems && item.stage !== 'PRODUCCION';

              const itemStageMap = {
                PRODUCCION: {
                  border: 'border-emerald-500/60',
                  badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
                  dot: 'bg-emerald-500',
                  text: `En Producción (${item.progressPct || 70}%)`
                },
                DISENO_PROG: {
                  border: isLaggingItem ? 'border-amber-500 ring-2 ring-amber-500/35' : 'border-amber-500/70',
                  badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40',
                  dot: 'bg-amber-500',
                  text: 'Diseño / Prog. CNC'
                },
                COMERCIAL: {
                  border: isLaggingItem ? 'border-rose-500 ring-2 ring-amber-500/35' : 'border-rose-500/65',
                  badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40',
                  dot: 'bg-rose-500',
                  text: 'En Comercial'
                }
              };
              const itMeta = itemStageMap[item.stage] || itemStageMap.COMERCIAL;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.isFromPlantTable) {
                      setSelectedOrder(item);
                    }
                  }}
                  className={`p-4 rounded-2xl theme-bg-main border-2 ${itMeta.border} hover:border-[var(--color-primary)] transition-all flex flex-col justify-between gap-3 shadow-sm`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-lg border font-black text-[10px] uppercase flex items-center gap-1.5 ${itMeta.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${itMeta.dot}`} />
                        <span>{itMeta.text}</span>
                      </span>

                      {isLaggingItem && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 shadow-sm">
                          <AlertTriangle size={11} /> Rezagado
                        </span>
                      )}
                    </div>

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

                    {/* ÁREAS ACTUALES DEL PRODUCTO */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(item.activeAreas || [item.stageAreaLabel || 'Comercial']).map((areaName) => (
                        <span
                          key={areaName}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border flex items-center gap-1 ${itMeta.badge}`}
                        >
                          <Factory size={10} />
                          <span>{areaName}</span>
                        </span>
                      ))}
                    </div>

                    {item.programador && (
                      <div className="text-[11px] font-bold theme-text-muted uppercase">
                        Programador: {item.programador}
                      </div>
                    )}
                  </div>

                  {/* BOTÓN DE HISTORIAL / TRAZABILIDAD COMPLETA DEL PRODUCTO */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTraceabilityItem({ item, group });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/40 font-black text-[11px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Ver trazabilidad completa: Comercial → Diseño → Prog. CNC → Áreas de Producción"
                  >
                    <History size={14} />
                    <span>Ver Trazabilidad Completa</span>
                  </button>

                  {/* VISTA PREVIA FIEL 1:1 (220x96px) DE LA ESTAMPILLA DE SOLIDWORKS */}
                  <div
                    className="theme-bg-card p-2.5 rounded-xl border theme-border flex flex-col items-center gap-2"
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
                            : 'bg-[var(--color-primary)] text-[var(--color-surface)] hover:brightness-110 active:scale-95'
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
                        className="py-2 px-2.5 rounded-xl theme-bg-main border theme-border theme-text-main hover:brightness-95 font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow active:scale-95 transition-all cursor-pointer"
                        title="Descargar PNG en alta resolución (440x192 px)"
                      >
                        <Download size={14} />
                        <span>Descargar PNG</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-[96vw] mx-auto px-2 sm:px-4 py-4 space-y-5 animate-in fade-in duration-200">
      {/* CABECERA CONGRUENTE CON LOS TEMAS DE LA APLICACIÓN Y CON EL NUEVO LOGO OFICIAL CDI */}
      <div className="theme-bg-card border-2 theme-border rounded-3xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Lado Izquierdo: Logo Oficial Nuevo sin fondo + Título Limpio */}
          <div className="flex flex-wrap items-center gap-4">
            <CDILogo heightClass="h-9 sm:h-11" />
            <div className="h-8 w-[2px] bg-[var(--color-border)] hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm shrink-0">
                <FolderKanban size={22} />
              </div>
              <h2 className="text-lg sm:text-2xl font-black uppercase tracking-tight theme-text-main">
                Área de Consulta General
              </h2>
            </div>
          </div>

          {/* Selector Rápido de Columnas de Cuadrícula (Símbolos Visuales) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1 theme-bg-main border theme-border rounded-xl p-1">
              <span className="text-[10px] font-black uppercase theme-text-muted px-2">
                Vista:
              </span>
              {[
                {
                  cols: 1,
                  title: 'Vista Tipo Lista (1 columna)',
                  icon: <LayoutList size={16} />
                },
                {
                  cols: 2,
                  title: 'Cuadrícula de 2 Columnas',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7.5" height="18" rx="1.5" />
                      <rect x="13.5" y="3" width="7.5" height="18" rx="1.5" />
                    </svg>
                  )
                },
                {
                  cols: 3,
                  title: 'Cuadrícula de 3 Columnas',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="5" height="18" rx="1.2" />
                      <rect x="9.5" y="3" width="5" height="18" rx="1.2" />
                      <rect x="17" y="3" width="5" height="18" rx="1.2" />
                    </svg>
                  )
                },
                {
                  cols: 4,
                  title: 'Cuadrícula de 4 Columnas',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="3.5" height="18" rx="1" />
                      <rect x="7.5" y="3" width="3.5" height="18" rx="1" />
                      <rect x="13" y="3" width="3.5" height="18" rx="1" />
                      <rect x="18.5" y="3" width="3.5" height="18" rx="1" />
                    </svg>
                  )
                },
                {
                  cols: 5,
                  title: 'Cuadrícula de 5 Columnas',
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1.5" y="3" width="2.5" height="18" rx="0.8" />
                      <rect x="6" y="3" width="2.5" height="18" rx="0.8" />
                      <rect x="10.75" y="3" width="2.5" height="18" rx="0.8" />
                      <rect x="15.5" y="3" width="2.5" height="18" rx="0.8" />
                      <rect x="20" y="3" width="2.5" height="18" rx="0.8" />
                    </svg>
                  )
                }
              ].map(({ cols, title, icon }) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => setGridColumns(cols)}
                  className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    gridColumns === cols
                      ? 'bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm'
                      : 'theme-text-muted hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                  title={title}
                  aria-label={title}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MODO DE FILTRADO DE FECHAS Y ALERTAS DE COORDINACIÓN */}
        <div className="mt-4 pt-4 border-t theme-border flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 3 Modos de Filtro */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider theme-text-muted mr-1">
                Criterio de Filtrado:
              </span>

              <button
                type="button"
                onClick={() => handleSelectFilterMode('GENERACION')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
                  filterMode === 'GENERACION'
                    ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border-[var(--color-primary)] shadow-sm'
                    : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                }`}
              >
                <Calendar size={14} />
                <span>Fecha de Generación</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFilterMode('DESPACHO')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
                  filterMode === 'DESPACHO'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                }`}
              >
                <Truck size={14} />
                <span>Fecha de Despacho</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFilterMode('ALERTAS_COORD')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
                  filterMode === 'ALERTAS_COORD'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                    : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                }`}
              >
                <AlertTriangle size={14} />
                <span>Alertas de Coordinación ({alertsMap.size})</span>
              </button>
            </div>

            {/* Selector directo de Ordenamiento sincronizado con `sortBy` */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-black uppercase theme-text-muted flex items-center gap-1">
                <ArrowUpDown size={13} /> Ordenar:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-xl theme-bg-card theme-text-main border theme-border font-black text-xs uppercase outline-none cursor-pointer"
              >
                <option value="ninguno">Pedido Más Reciente (Desc)</option>
                <option value="pedido_desc">Nº Pedido (Descendente)</option>
                <option value="pedido_asc">Nº Pedido (Ascendente)</option>
                <option value="fecha_asc">Fecha Activa (Ascendente)</option>
                <option value="fecha_desc">Fecha Activa (Descendente)</option>
              </select>
            </div>
          </div>

          {/* Filtro por Año y Meses (SOLO muestra meses con pedidos existentes) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider theme-text-main flex items-center gap-1 mr-1">
              <Calendar size={14} />
              {filterMode === 'DESPACHO'
                ? 'Meses con Fecha de Despacho:'
                : filterMode === 'ALERTAS_COORD'
                ? 'Meses con Alertas de Coordinación:'
                : 'Meses con Pedidos Generados:'}
            </span>

            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedMonth('TODOS');
              }}
              className="px-3 py-1.5 rounded-xl theme-bg-card theme-text-main border theme-border font-black text-xs uppercase outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los Años</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  Año {y}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl theme-bg-card theme-text-main border theme-border font-black text-xs uppercase outline-none cursor-pointer"
            >
              <option value="TODOS">🗓️ Todos los Meses ({availableMonthsList.length})</option>
              {availableMonthsList.map((ym) => (
                <option key={ym.key} value={ym.key}>
                  {ym.label} ({ym.pedidosSet.size} pedidos)
                </option>
              ))}
            </select>

            {/* Píldoras dinámicas: únicamente meses con pedidos existentes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedMonth('TODOS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase border transition-all cursor-pointer ${
                  selectedMonth === 'TODOS' && selectedYear === 'TODOS'
                    ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border-[var(--color-primary)]'
                    : 'theme-bg-main theme-text-muted theme-border hover:brightness-95'
                }`}
              >
                Todos
              </button>
              {availableMonthsList.map((ym) => (
                <button
                  key={ym.key}
                  type="button"
                  onClick={() => setSelectedMonth(ym.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase border transition-all cursor-pointer ${
                    selectedMonth === ym.key
                      ? 'bg-[var(--color-primary)] text-[var(--color-surface)] border-[var(--color-primary)] shadow-sm'
                      : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                  }`}
                >
                  {ym.label} ({ym.pedidosSet.size})
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por Semanas dentro del Mes seleccionado */}
          {selectedMonth !== 'TODOS' && availableWeeksInSelectedMonth.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed theme-border">
              <span className="text-[11px] font-black uppercase tracking-wider theme-text-main flex items-center gap-1 mr-1">
                <Calendar size={14} />
                Semanas del Mes:
              </span>

              <button
                type="button"
                onClick={() => setSelectedWeek('TODAS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase border transition-all cursor-pointer ${
                  selectedWeek === 'TODAS'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                }`}
              >
                Todas las Semanas (Separadas)
              </button>

              {availableWeeksInSelectedMonth.map((wk) => (
                <button
                  key={wk.key}
                  type="button"
                  onClick={() => setSelectedWeek(wk.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase border transition-all cursor-pointer ${
                    selectedWeek === wk.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'theme-bg-main theme-text-main theme-border hover:brightness-95'
                  }`}
                >
                  {wk.shortLabel} ({wk.pedidosSet.size})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* FILTRO SEMÁFORO POR ETAPA Y ALERTA DE ARTÍCULOS REZAGADOS */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t theme-border">
          <span className="text-[11px] font-black uppercase tracking-wider theme-text-muted mr-1">
            Estado Semáforo:
          </span>
          {[
            {
              id: 'TODOS',
              label: `Todos (${stageCounts.todos})`,
              dot: 'bg-slate-400',
              active: 'bg-[var(--color-primary)] text-[var(--color-surface)] border-transparent shadow',
              inactive: 'theme-bg-main theme-text-main theme-border hover:border-[var(--color-primary)]'
            },
            {
              id: 'PRODUCCION',
              label: `En Producción (${stageCounts.produccion})`,
              dot: 'bg-emerald-500',
              active: 'bg-emerald-600 text-white border-emerald-600 shadow',
              inactive: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/20'
            },
            {
              id: 'DISENO_PROG',
              label: `Diseño y Prog. CNC (${stageCounts.disenoProg})`,
              dot: 'bg-amber-500',
              active: 'bg-amber-500 text-slate-950 border-amber-500 shadow',
              inactive: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/35 hover:bg-amber-500/20'
            },
            {
              id: 'COMERCIAL',
              label: `En Comercial (${stageCounts.comercial})`,
              dot: 'bg-rose-500',
              active: 'bg-rose-600 text-white border-rose-600 shadow',
              inactive: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/35 hover:bg-rose-500/20'
            },
            {
              id: 'ALERTA_REZAGO',
              label: `Con Rezagados en Diseño/CNC (${stageCounts.alertaRezago})`,
              dot: 'bg-amber-500 ring-2 ring-rose-500/60',
              active: 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-rose-500/60 shadow',
              inactive:
                stageCounts.alertaRezago > 0
                  ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/60 hover:bg-amber-500/30 font-black'
                  : 'theme-bg-main theme-text-muted theme-border opacity-60'
            }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setStageFilter(btn.id)}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                stageFilter === btn.id ? btn.active : btn.inactive
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${btn.dot}`} />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        {/* KPIs RÁPIDOS + BUSCADOR (Adaptados a los temas) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t theme-border">
          <div className="theme-bg-main border theme-border rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider theme-text-muted block">
                Pedidos Filtrados
              </span>
              <span className="text-2xl font-black theme-text-main">
                {groupedPedidos.length}
              </span>
            </div>
            <Layers className="theme-text-primary opacity-80" size={24} />
          </div>

          <div className="theme-bg-main border theme-border rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider theme-text-muted block">
                Ítems Listados
              </span>
              <span className="text-2xl font-black theme-text-main">
                {filteredItemsCount}
              </span>
            </div>
            <FileCode2 className="theme-text-primary opacity-80" size={24} />
          </div>

          <div className="theme-bg-main border theme-border rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider theme-text-muted block">
                Total Unidades
              </span>
              <span className="text-2xl font-black theme-text-main">
                {totalUnitsCount}
              </span>
            </div>
            <Package className="theme-text-primary opacity-80" size={24} />
          </div>

          <div className="relative flex items-center">
            <Search className="absolute left-3.5 theme-text-muted" size={18} />
            <input
              type="text"
              value={backlogSearch}
              onChange={(e) => setBacklogSearch(e.target.value)}
              placeholder="Buscar pedido, cliente o código..."
              className="w-full h-full pl-10 pr-4 py-2.5 rounded-2xl theme-bg-main border theme-border theme-text-main font-bold text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:theme-text-muted"
            />
          </div>
        </div>
      </div>

      {/* LISTADO / CUADRÍCULA DE PEDIDOS (SEPARADO AUTOMÁTICAMENTE POR SEMANAS AL ELEGIR UN MES) */}
      {loadingRibi && groupedPedidos.length === 0 ? (
        <div className="theme-bg-card border-2 theme-border rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-black uppercase theme-text-main">
            Cargando pedidos del RIBI y Área Comercial...
          </h3>
        </div>
      ) : groupedPedidos.length === 0 ? (
        <div className="theme-bg-card border-2 border-dashed theme-border rounded-3xl p-12 text-center space-y-3">
          <FolderKanban size={48} className="mx-auto theme-text-muted opacity-60" />
          <h3 className="text-lg font-black uppercase theme-text-main">
            No se encontraron pedidos con el filtro actual
          </h3>
          <p className="text-sm font-medium theme-text-muted max-w-lg mx-auto">
            Prueba seleccionar <strong>"Todos los Meses"</strong> o cambiar el criterio entre Fecha de Generación, Fecha de Despacho o Alertas de Coordinación.
          </p>
        </div>
      ) : selectedMonth !== 'TODOS' ? (
        <div className="space-y-6">
          {weeklySections.map((sec) => (
            <div key={`week_sec_${sec.key}`} className="space-y-3">
              {/* CABECERA AUTOMÁTICA DE LA SEMANA */}
              <div className="theme-bg-card border-2 border-[var(--color-primary)]/40 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wide theme-text-main">
                      {sec.fullTitle}
                    </h3>
                    {sec.rangeLabel && (
                      <p className="text-xs font-bold theme-text-muted">
                        {sec.rangeLabel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase">
                  <span className="px-3 py-1 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30">
                    {sec.pedidos.length} Pedido(s)
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {sec.itemsCount} Ítem(s)
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {sec.unitsCount} Unidades
                  </span>
                </div>
              </div>

              <div className={pedidosGridClass}>
                {sec.pedidos.map(renderPedidoCard)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={pedidosGridClass}>
          {groupedPedidos.map(renderPedidoCard)}
        </div>
      )}

      {dashboardPedidoGroup && (
        <PedidoDashboardModal
          pedidoGroup={dashboardPedidoGroup}
          allPlantOrders={orders}
          onClose={() => setDashboardPedidoGroup(null)}
          onSelectTraceability={(ctx) => setTraceabilityItem(ctx)}
        />
      )}

      {traceabilityItem && (
        <ProductTraceabilityModal
          contextData={traceabilityItem}
          onClose={() => setTraceabilityItem(null)}
        />
      )}
    </div>
  );
}
