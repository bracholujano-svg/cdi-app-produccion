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
  Truck
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../supabaseClient';
import { formatLocalDate, getDaysLeft } from '../../utils/helpers';
import { cleanErpCode, normalizeProductName } from '../../services/ribisoftExcelImporter';
import erpDeliveryDatesMap from '../../utils/erpDeliveryDatesMap.json';
import CDILogo from '../ui/CDILogo';
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
  const [filterMode, setFilterMode] = useState('GENERACION');
  const [selectedMonth, setSelectedMonth] = useState('TODOS'); // 'TODOS' | 'YYYY-MM'
  const [selectedWeek, setSelectedWeek] = useState('TODAS'); // 'TODAS' | '1' | '2' | '3' | '4' | '5'
  const [selectedYear, setSelectedYear] = useState('TODOS'); // 'TODOS' | '2025' | '2026' | '2027'
  const [minPedidoNum, setMinPedidoNum] = useState(0); // 0 = Todos los pedidos (para incluir Enero, Febrero, Marzo y Diciembre sin excluir por número)
  const [expandedPedidos, setExpandedPedidos] = useState({});
  const [copiedId, setCopiedId] = useState(null);

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
   * Unifica en una sola estructura los ítems de Consulta General, RIBI (`ribisoft_pedidos`)
   * y Alertas de Coordinación (`coordinacion_alertas`), conservando de manera explícita:
   * - fechaGeneracion (fecha de generación RIBI / registro)
   * - fechaDespacho (fecha de entrega comercial)
   * - coordAlert / coordFechaEntrega (alerta de coordinación de planta)
   */
  const unifiedConsultaItems = useMemo(() => {
    const itemsMap = new Map();
    const plantStartedSet = new Set();
    const touchedPedidosSet = new Set();

    // 1. Procesar órdenes existentes en `produccion_pedidos`
    (orders || []).forEach((ord) => {
      if (!ord || !ord.pedidoNum) return;
      const ped = String(ord.pedidoNum).replace(/^#/, '').trim().toUpperCase();
      const cod = cleanErpCode(ord.codArticulo || ord.codigo_item || '') || '';
      const normName = normalizeProductName(ord.nombre || ord.descripcion || '');
      const key = `${ped}__${normName || cod || ord.id}`;

      const coordAlert = alertsMap.get(ped) || null;
      const isNeutral = isOrderInNeutralBacklog(ord, alertsMap);
      const mappedCommercialDelivery = customDeliveryDatesMap?.[ped] ?? erpDeliveryDatesMap?.[ped] ?? null;

      const parsedGen = parseCommercialDeliveryDate(
        ord.fecha_genera_ped ?? ord['Fecha Genera Ped.'] ?? ord['Fecha Genera Ped'] ?? ord.fechaGeneraPed ?? null
      );

      // Evitar que `fechaEntregaPrometida` inyectada por una alerta de coordinación contamine `fechaDespacho`
      const coordRawDate = coordAlert?.fechaEntrega || null;
      const ordPrometidaRaw = ord.fechaEntregaPrometida || null;
      const isPrometidaFromCoordOnly = Boolean(
        coordRawDate &&
        ordPrometidaRaw &&
        String(ordPrometidaRaw).trim() === String(coordRawDate).trim() &&
        !ord.fecha_entrega &&
        !ord['Fecha Entrega'] &&
        !ord.fecha_despacho
      );
      const rawDespOrd =
        ord['Fecha Entrega'] ??
        ord.fecha_entrega ??
        ord['Fecha de Entrega'] ??
        ord['Fecha Despacho'] ??
        ord.fecha_despacho ??
        (!isPrometidaFromCoordOnly ? ordPrometidaRaw : null) ??
        mappedCommercialDelivery ??
        ord.fecha_asigna ??
        ord['Fecha asigna'] ??
        ord['Fecha Asigna'] ??
        null;
      const parsedDesp = parseCommercialDeliveryDate(rawDespOrd);
      const parsedCoordDate = parseCommercialDeliveryDate(coordAlert?.fechaEntrega || coordAlert?.creadoEn);

      if (isNeutral || (coordAlert && ord.estadoInterno !== 'DESPACHADO')) {
        touchedPedidosSet.add(ped);
        itemsMap.set(key, {
          ...ord,
          pedidoNum: ped,
          codArticulo: (cod || ord.codArticulo || 'S/C').toUpperCase(),
          fechaGeneracion: parsedGen?.isoDate || null,
          fechaDespacho: parsedDesp?.isoDate || null,
          coordFechaEntrega: parsedCoordDate?.isoDate || null,
          hasCoordAlert: Boolean(coordAlert),
          coordAlertNota: coordAlert?.notas || coordAlert?.detalle || null,
          isInActivePlantArea: !isNeutral,
          isFromPlantTable: true
        });
      }

      if (!isNeutral) {
        if (cod) plantStartedSet.add(`${ped}__CODE__${cod.toUpperCase()}`);
        if (normName) plantStartedSet.add(`${ped}__NAME__${normName}`);
      }
    });

    // 2. Incorporar todos los pedidos de `ribisoft_pedidos` (Excel RIBI)
    const minNumVal = Number(minPedidoNum) || 0;

    (ribisoftRows || []).forEach((r, idx) => {
      if (!r || typeof r !== 'object') return;
      const rawPed = cleanErpCode(r['PedidoSIN'] ?? r['pedido_sin'] ?? r['pedidosin'] ?? r['Pedido']);
      if (!rawPed) return;
      const ped = String(rawPed).replace(/^#/, '').trim().toUpperCase();

      const numMatch = ped.match(/\d+/);
      const pedNumber = numMatch ? Number(numMatch[0]) : 0;

      const coordAlert = alertsMap.get(ped) || null;

      if (minNumVal > 0 && pedNumber > 0 && pedNumber < minNumVal && !coordAlert) {
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

      const alreadyStartedInPlant =
        (cod && plantStartedSet.has(`${ped}__CODE__${codUpper}`)) ||
        (normName && plantStartedSet.has(`${ped}__NAME__${normName}`));

      // Si ya entró a una sección productiva de planta y no tiene alerta de coordinación pendiente, omitirlo de Consulta General
      if (alreadyStartedInPlant) {
        return;
      }

      const rawFechaGen =
        r['fecha_genera_ped'] ??
        r['Fecha Genera Ped.'] ??
        r['Fecha Genera Ped'] ??
        r['Fecha Genera'] ??
        r['fecha_creacion'] ??
        null;

      // Fecha de Despacho Comercial: prioriza columnas de entrega comercial y diccionario ERP (nunca Alertas de Coordinación)
      const mappedCommercialDelivery = customDeliveryDatesMap?.[ped] ?? erpDeliveryDatesMap?.[ped] ?? null;
      const rawFechaDespacho =
        r['Fecha Entrega'] ??
        r['fecha_entrega'] ??
        r['Fecha de Entrega'] ??
        r['Fecha Despacho'] ??
        r['fecha_despacho'] ??
        r['fecha_entrega_prometida'] ??
        r['fechaEntregaPrometida'] ??
        mappedCommercialDelivery ??
        r['fecha_asigna'] ??
        r['Fecha asigna'] ??
        r['Fecha Asigna'] ??
        null;

      const parsedGen = parseCommercialDeliveryDate(rawFechaGen);
      const parsedDesp = parseCommercialDeliveryDate(rawFechaDespacho);
      const parsedCoordDate = parseCommercialDeliveryDate(coordAlert?.fechaEntrega || coordAlert?.creadoEn);

      const key = `${ped}__${normName || codUpper}`;
      const existing = itemsMap.get(key);

      if (
        !existing ||
        ((!existing.codArticulo || existing.codArticulo === 'S/C') && cod) ||
        (!existing.fechaGeneracion && parsedGen?.isoDate) ||
        (!existing.fechaDespacho && parsedDesp?.isoDate)
      ) {
        const deterministicId = existing?.id || `RIBI_${ped}_${codUpper !== 'S/C' ? codUpper : idx + 1}`;
        touchedPedidosSet.add(ped);

        itemsMap.set(key, {
          ...(existing || {}),
          id: deterministicId,
          pedidoNum: ped,
          pedidoNumeric: pedNumber,
          codArticulo: codUpper !== 'S/C' ? codUpper : existing?.codArticulo || 'S/C',
          codigo_item: codUpper !== 'S/C' ? codUpper : existing?.codigo_item || 'S/C',
          qr_plano_payload:
            existing?.qr_plano_payload ||
            buildProductBlueprintQrPayload({
              id: deterministicId,
              pedidoNum: ped,
              codArticulo: codUpper
            }),
          nombre: normName || existing?.nombre || 'PRODUCTO RIBI',
          cantidad: Number(r['Cantidad'] ?? r['cantidad']) || existing?.cantidad || 1,
          cliente: String(
            r['Cliente'] ??
              r['cliente'] ??
              r['Nombre Proyecto'] ??
              existing?.cliente ??
              coordAlert?.cliente ??
              'CLIENTE GENERAL'
          )
            .trim()
            .toUpperCase(),
          nombre_proyecto: String(r['Nombre Proyecto'] ?? r['nombre_proyecto'] ?? existing?.nombre_proyecto ?? '')
            .trim()
            .toUpperCase(),
          programador: String(r['Programador'] ?? r['programador'] ?? existing?.programador ?? '')
            .trim()
            .toUpperCase(),
          area: existing?.area || 'AREA_NEUTRA',
          areaActual: existing?.areaActual || 'Área de Consulta General',
          estado: existing?.estado || 'PENDIENTE_INGENIERIA',
          estadoInterno: existing?.estadoInterno || r['Estado'] || 'EN CONSULTA GENERAL (RIBI)',
          fechaGeneracion: parsedGen?.isoDate || existing?.fechaGeneracion || null,
          fechaDespacho: parsedDesp?.isoDate || existing?.fechaDespacho || null,
          fechaEntregaPrometida: parsedDesp?.isoDate || existing?.fechaEntregaPrometida || null,
          fechaGeneraPed: parsedGen?.isoDate || existing?.fechaGeneraPed || null,
          hasCoordAlert: Boolean(coordAlert) || Boolean(existing?.hasCoordAlert),
          coordFechaEntrega: parsedCoordDate?.isoDate || existing?.coordFechaEntrega || null,
          coordAlertNota: coordAlert?.notas || coordAlert?.detalle || existing?.coordAlertNota || null,
          dim_1: r['dim_1'] ?? r['Dim.1'] ?? existing?.dim_1 ?? null,
          dim_2: r['dim_2'] ?? r['Dim.2'] ?? existing?.dim_2 ?? null,
          dim_3: r['dim_3'] ?? r['Dim.3'] ?? existing?.dim_3 ?? null,
          acabado_1: r['acabado_1'] ?? r['Acabado1'] ?? existing?.acabado_1 ?? null,
          acabado_2: r['acabado_2'] ?? r['Acabado2'] ?? existing?.acabado_2 ?? null,
          acabado_3: r['acabado_3'] ?? r['Acabado3'] ?? existing?.acabado_3 ?? null,
          caracteristicas: r['caracteristicas'] ?? r['Características'] ?? existing?.caracteristicas ?? null,
          categoria: r['categoria'] ?? r['Categoria'] ?? existing?.categoria ?? null,
          notas: r['notas'] ?? r['Notas'] ?? existing?.notas ?? null,
          observaciones_erp: r['observaciones_erp'] ?? r['Observaciones'] ?? existing?.observaciones_erp ?? null,
          isInActivePlantArea: Boolean(existing?.isInActivePlantArea),
          isFromPlantTable: Boolean(existing?.isFromPlantTable)
        });
      }
    });

    // 3. Garantizar que cualquier Alerta de Coordinación en `coordinacion_alertas` sin filas en RIBI/Planta también sea visible en ALERTAS_COORD
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
        areaActual: 'Área de Consulta General',
        estado: 'PENDIENTE_INGENIERIA',
        estadoInterno: 'ALERTA DE COORDINACIÓN DE PLANTA',
        fechaGeneracion: null,
        fechaDespacho: null,
        fechaEntregaPrometida: null,
        fechaGeneraPed: null,
        hasCoordAlert: true,
        coordFechaEntrega: parsedCoordDate?.isoDate || alertObj.fechaEntrega || null,
        coordAlertNota: alertObj.notas || alertObj.detalle || null,
        isInActivePlantArea: false,
        isFromPlantTable: false
      });
    });

    return Array.from(itemsMap.values());
  }, [orders, ribisoftRows, alertsMap, prodToCodptMap, minPedidoNum, customDeliveryDatesMap]);

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
    return parseCommercialDeliveryDate(item.fechaGeneracion);
  };

  // Lista base según el modo seleccionado (estricto por fuente de fecha)
  const modeScopedItems = useMemo(() => {
    return unifiedConsultaItems.filter((item) => {
      if (filterMode === 'ALERTAS_COORD') {
        return Boolean(item.hasCoordAlert);
      }
      if (filterMode === 'DESPACHO') {
        return !item.isInActivePlantArea && Boolean(item.fechaDespacho);
      }
      return !item.isInActivePlantArea && Boolean(item.fechaGeneracion);
    });
  }, [unifiedConsultaItems, filterMode]);

  // Años disponibles dinámicamente (incluyendo siempre 2026 y 2027 para planeación comercial)
  const availableYears = useMemo(() => {
    const yearsSet = new Set([2026, 2027]);
    modeScopedItems.forEach((item) => {
      const parsed = getFilterModeDateInfo(item);
      if (parsed?.year) yearsSet.add(parsed.year);
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [modeScopedItems, filterMode]);

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

  // Agrupación por Pedido y Ordenamiento dinámico conectado con `sortBy`
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

    const list = Array.from(map.values()).map((g) => {
      const firstItemIso = g.items?.[0] ? getFilterModeDateInfo(g.items[0])?.isoDate : null;
      return {
        ...g,
        effectiveIsoDate: firstItemIso || getEffectiveIsoDate(g)
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

  const totalUnitsCount = useMemo(
    () => filteredItems.reduce((acc, o) => acc + (Number(o.cantidad) || 1), 0),
    [filteredItems]
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

  // Tarjeta compartida por pedido (solo consulta, planificación y descarga/copia de QR SolidWorks; sin envíos a planta)
  const renderPedidoCard = (group) => {
    const isExpanded = Boolean(expandedPedidos[group.pedidoNum]);
    const dLeftDesp = group.fechaDespacho ? getDaysLeft(group.fechaDespacho) : null;
    const dLeftCoord = group.coordFechaEntrega ? getDaysLeft(group.coordFechaEntrega) : null;
    const isGridCompact = gridColumns > 1 && !isExpanded;

    return (
      <div
        key={group.pedidoNum}
        className={`theme-bg-card border-2 ${
          group.hasCoordAlert ? 'border-orange-500/70' : 'theme-border'
        } rounded-3xl shadow-lg overflow-hidden flex flex-col justify-between transition-all hover:border-[var(--color-primary)] ${
          isExpanded ? 'col-span-full' : ''
        }`}
      >
        {/* CABECERA DEL PEDIDO */}
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
              <span className="px-3.5 py-1 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] font-black text-sm sm:text-base tracking-wide shadow">
                PED #{group.pedidoNum}
              </span>

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

              {group.areaActual && (
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-black text-[11px] uppercase">
                  En: {group.areaActual}
                </span>
              )}
            </div>

            {group.coordAlertNota && (
              <div className="text-[11px] font-bold text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-lg px-2 py-1 line-clamp-2">
                Nota Coord.: {group.coordAlertNota}
              </div>
            )}

            <span className="text-[11px] underline theme-text-primary font-black">
              {isExpanded ? '▲ Ocultar ítems y QRs' : '▼ Ver ítems y QRs SolidWorks'}
            </span>
          </div>

          {/* ACCIÓN SOLO DE CONSULTA: DESCARGA MASIVA DE QRs SOLIDWORKS */}
          <div
            className={`flex flex-wrap items-center gap-2 ${
              isGridCompact ? 'pt-2 border-t theme-border justify-between' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => handleDownloadAllPedidoQrs(group)}
              className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] text-[11px] font-black uppercase flex items-center gap-1.5 shadow cursor-pointer hover:brightness-110"
              title="Descargar todas las estampillas PNG (440x192px) de este pedido"
            >
              <Download size={14} />
              <span>QRs ({group.items.length})</span>
            </button>
          </div>
        </div>

        {/* CUADRÍCULA DE ÍTEMS Y ESTAMPILLAS QR PARA SOLIDWORKS */}
        {isExpanded && (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-black/5 dark:bg-black/20">
            {group.items.map((item) => {
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.isFromPlantTable) {
                      setSelectedOrder(item);
                    }
                  }}
                  className="p-4 rounded-2xl theme-bg-main border-2 theme-border hover:border-[var(--color-primary)] transition-all flex flex-col justify-between gap-3 shadow-sm"
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

          {/* Selector Rápido de Columnas de Cuadrícula y Rango de Pedido */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1 theme-bg-main border theme-border rounded-xl p-1">
              <span className="text-[10px] font-black uppercase theme-text-muted px-2">
                Cuadrícula:
              </span>
              {[1, 2, 3, 4, 5].map((cols) => (
                <button
                  key={cols}
                  type="button"
                  onClick={() => setGridColumns(cols)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                    gridColumns === cols
                      ? 'bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm'
                      : 'theme-text-muted hover:bg-black/10 dark:hover:bg-white/10'
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
              className="px-3 py-2 rounded-xl theme-bg-card theme-text-main border theme-border font-black text-xs uppercase outline-none cursor-pointer"
            >
              <option value={0}>Todos los Pedidos RIBI</option>
              <option value={64000}>Desde Pedido #64000</option>
              <option value={63500}>Desde Pedido #63500</option>
              <option value={63000}>Desde Pedido #63000</option>
            </select>
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
                onClick={() => {
                  setFilterMode('GENERACION');
                  setSelectedYear('TODOS');
                  setSelectedMonth('TODOS');
                }}
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
                onClick={() => {
                  setFilterMode('DESPACHO');
                  setSelectedYear('TODOS');
                  setSelectedMonth('TODOS');
                }}
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
                onClick={() => {
                  setFilterMode('ALERTAS_COORD');
                  setSelectedYear('TODOS');
                  setSelectedMonth('TODOS');
                }}
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
                onClick={() => {
                  setSelectedMonth('TODOS');
                  setSelectedYear('TODOS');
                }}
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
                {filteredItems.length}
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
    </div>
  );
}
