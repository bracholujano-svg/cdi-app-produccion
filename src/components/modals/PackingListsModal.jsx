import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Package,
  Plus,
  QrCode,
  Printer,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Search,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Eye,
  Calculator,
  ArrowRight,
  Truck,
  SplitSquareVertical,
  PackageCheck,
  History,
  MapPin,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertOctagon,
  Boxes
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { generateQRMatrix } from '../../utils/qrGenerator';
import { WindowControls, MinimizedWindowDock } from '../ui/WindowControls';
import { supabase } from '../../supabaseClient';

/**
 * Normaliza el nombre de un área para comparaciones estrictas sin errores de tildes o espacios
 */
const normalizeArea = (areaStr) =>
  String(areaStr || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Verifica estrictamente si una orden es elegible para ser listada como pendiente de empacar en el Módulo de Empaque:
 * - CONDICIÓN OBLIGATORIA: Su área actual debe ser estrictamente 'EMPAQUE'.
 * - EXCLUSIÓN TOTAL: Se excluye cualquier registro con estado 'DESPACHADO' / 'ENTREGADO'
 *   o que se encuentre en 'ENSAMBLE', 'PINTURA LÍQUIDA', 'PINTURA EN POLVO', 'EBANISTERÍA', 'DESPACHOS' u otra área.
 */
export const isOrderStrictlyInEmpaque = (orderObj) => {
  if (!orderObj || typeof orderObj !== 'object') return false;

  const area = normalizeArea(orderObj.areaActual);
  const estadoInterno = normalizeArea(orderObj.estadoInterno);
  const estadoGlobal = normalizeArea(orderObj.estadoGlobal);
  const status = normalizeArea(orderObj.status);

  if (
    area === 'DESPACHADO' ||
    area === 'DESPACHADOS' ||
    area === 'DESPACHOS' ||
    estadoInterno === 'DESPACHADO' ||
    estadoInterno === 'ENTREGADO' ||
    estadoGlobal === 'DESPACHADO' ||
    estadoGlobal === 'ENTREGADO' ||
    status === 'DESPACHADO'
  ) {
    return false;
  }

  return area === 'EMPAQUE';
};

/**
 * Verifica si una orden ya pasó por Empaque y se encuentra en Despachos o Despachado
 */
const isOrderInDespachosOrDispatched = (orderObj) => {
  if (!orderObj || typeof orderObj !== 'object') return false;
  const area = normalizeArea(orderObj.areaActual);
  const estadoInterno = normalizeArea(orderObj.estadoInterno);
  const estadoGlobal = normalizeArea(orderObj.estadoGlobal);
  return (
    area === 'DESPACHOS' ||
    area === 'DESPACHADO' ||
    area === 'DESPACHADOS' ||
    estadoInterno === 'DESPACHADO' ||
    estadoInterno === 'ENTREGADO' ||
    estadoGlobal === 'DESPACHADO' ||
    estadoGlobal === 'ENTREGADO' ||
    Boolean(orderObj.packingListCompletada)
  );
};

/**
 * Componente SVG que dibuja un Código QR 2D real 100% escaneable
 */
const QRCodeSVG = ({ value, size = 128, className = '' }) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value || 'CDI-PACK');
    } catch (e) {
      console.error('Error generando QR:', e);
      return [[1]];
    }
  }, [value]);

  const N = matrix.length;
  const quietZone = 3;
  const totalModules = N + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalModules} ${totalModules}`}
      shapeRendering="crispEdges"
      className={`bg-white rounded-lg p-1 ${className}`}
    >
      <rect width={totalModules} height={totalModules} fill="#ffffff" />
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + quietZone}
              y={rIdx + quietZone}
              width={1}
              height={1}
              fill="#000000"
            />
          ) : null
        )
      )}
    </svg>
  );
};

/**
 * Construye el payload oficial del Código QR de un bulto físico individual
 */
export const buildPackageQRText = (packingList, pkg, pkgIndex, totalPackages) => {
  const pedNum = String(packingList?.pedidoNum || '').trim();
  const cliente = String(packingList?.cliente || 'CLIENTE GENERAL').trim();
  const tipo = String(pkg?.tipoEmpaque || 'PAQUETE').trim().toUpperCase();
  const numStr = String(pkg?.consecutivo || pkgIndex + 1).padStart(2, '0');
  const tituloBulto = `${tipo} #${numStr} (Bulto ${pkgIndex + 1} de ${totalPackages})`;
  const items = Array.isArray(pkg?.items) ? pkg.items : [];

  const lines = [
    `CDI PRODUCCION - ETIQUETA DE EMPAQUE`,
    `PEDIDO: #${pedNum} | ORIGEN: EMPAQUE`,
    `CLIENTE: ${cliente.slice(0, 38)}`,
    `CONSECUTIVO: ${tituloBulto}`,
    `--- DETALLE DE ESTE BULTO ---`
  ];

  items.forEach((it, idx) => {
    const cod = String(it.codArticulo || 'S/C').trim();
    const nom = String(it.nombre || 'PRODUCTO').trim().slice(0, 34);
    const cantBulto = Number(it.cantidadMostradaBulto ?? it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 1;
    const cantTotalItem = Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;
    lines.push(`${idx + 1}. [${cod}] ${nom}`);
    if (it.subpaqueteLabel) {
      lines.push(`   Contenido: ${cantBulto} de ${cantTotalItem} unds (${it.subpaqueteLabel})`);
    } else {
      lines.push(`   Contenido en este bulto: ${cantBulto} de ${cantTotalItem} unds`);
    }
  });

  if (pkg?.observaciones) {
    lines.push(`OBS: ${String(pkg.observaciones).trim().slice(0, 42)}`);
  }

  return lines.join('\n');
};

const PackingListsModal = () => {
  const {
    orders,
    setOrders,
    syncOrderToSupabase,
    packingLists,
    setPackingLists,
    syncPackingListToSupabase,
    supervisorProfile,
    setShowPackingListsModal
  } = useAppContext();

  // Vista principal del módulo: 'ACTIVAS' (Mesa de Empaque) vs 'HISTORIAL' (Listas Creadas y Terminadas)
  const [mainViewTab, setMainViewTab] = useState('ACTIVAS');

  // Pestaña activa de lista de empaque (solo listas activas por defecto)
  const [activeListId, setActiveListId] = useState(() => {
    const firstActive = (packingLists || []).find((l) => l.estadoLista !== 'TERMINADA');
    return firstActive ? firstActive.id : null;
  });

  // Estado temporal cuando el usuario consulta desde el Historial una lista que ya está cerrada/terminada sin meterla a las pestañas de la Mesa de Trabajo
  const [consultingClosedListId, setConsultingClosedListId] = useState(null);

  // Estado de Ventana Multitarea (Pantalla Completa por defecto y Minimizable)
  const [isMaximized, setIsMaximized] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Buscador de pedidos elegibles y filtros
  const [searchPedidoInput, setSearchPedidoInput] = useState('');
  const [showNewListDropdown, setShowNewListDropdown] = useState(false);
  const [isTabsExpanded, setIsTabsExpanded] = useState(true);
  const [filterProductSearch, setFilterProductSearch] = useState('');

  // Estados para la sección de "Productos del Pedido Pendientes por Llegar a Empaque"
  const [isPendingArrivalExpanded, setIsPendingArrivalExpanded] = useState(true);
  const [selectedPendingAreaFilter, setSelectedPendingAreaFilter] = useState('TODAS');
  const [pendingArrivalSearch, setPendingArrivalSearch] = useState('');
  const [erpOrderRows, setErpOrderRows] = useState([]);

  // Estados para la Vista de Historial de Listas de Empaque
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('TODAS');

  // Estado del Modal Rojo Grande de Notificación cuando faltan productos por empacar/despachar al intentar cerrar
  const [incompleteCloseWarningModal, setIncompleteCloseWarningModal] = useState(null);

  // Estado de la Calculadora de Fraccionamiento y Agrupación por ítem
  // { openPanel: null | 'LOTES_IGUALES' | 'SUBPAQUETES' | 'AGRUPACION_MANUAL', tipoEmpaque: 'Paquete', numBultos: 1, undsPorBulto: 1, numSubpaquetes: 2, manualQty: 1, targetPkgId: 'NUEVO', observaciones: '' }
  const [itemCalculators, setItemCalculators] = useState({});

  // Modal de vista ampliada de Código QR
  const [qrPreviewPkg, setQrPreviewPkg] = useState(null);

  // Listas activas (no cerradas como terminadas) vs todas las listas en historial
  const activeWorkingLists = useMemo(() => {
    return (packingLists || []).filter((l) => l.estadoLista !== 'TERMINADA');
  }, [packingLists]);

  // Lista de empaque activa seleccionada en la mesa de trabajo (excluye terminadas salvo consulta puntual desde el Historial)
  const activePackingList = useMemo(() => {
    if (!packingLists || packingLists.length === 0) return null;
    if (consultingClosedListId) {
      const closedFound = packingLists.find((l) => l.id === consultingClosedListId);
      if (closedFound) return closedFound;
    }
    const foundActive = activeWorkingLists.find((l) => l.id === activeListId);
    if (foundActive) return foundActive;
    return activeWorkingLists[0] || null;
  }, [packingLists, activeListId, activeWorkingLists, consultingClosedListId]);

  // Cargar líneas de `ribisoft_pedidos` del pedido activo para detectar también ítems que aún estén en Administración/ERP
  useEffect(() => {
    let isMounted = true;
    const targetPed = String(activePackingList?.pedidoNum || '').trim();
    if (!targetPed) {
      setErpOrderRows([]);
      return;
    }

    const fetchErpItemsForOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('ribisoft_pedidos')
          .select('*')
          .eq('pedido_sin', targetPed);
        if (!error && Array.isArray(data) && isMounted) {
          setErpOrderRows(data);
        }
      } catch (e) {
        console.error('Error consultando líneas ERP para pedido en Empaque:', e);
      }
    };

    fetchErpItemsForOrder();
    return () => {
      isMounted = false;
    };
  }, [activePackingList?.pedidoNum]);

  /**
   * 1. FILTRADO DE PEDIDOS CON PRODUCTOS EN 'EMPAQUE' (Y TOTAL DEL PEDIDO EN PLANTA):
   */
  const eligibleEmpaqueOrdersSummary = useMemo(() => {
    const map = new Map();

    const totalByPedidoMap = new Map();
    (orders || []).forEach((o) => {
      if (!o || !o.pedidoNum) return;
      const ped = String(o.pedidoNum || '').trim().toUpperCase();
      if (!ped) return;
      totalByPedidoMap.set(ped, (totalByPedidoMap.get(ped) || 0) + 1);
    });

    (orders || []).forEach((o) => {
      if (!isOrderStrictlyInEmpaque(o)) return;
      const ped = String(o.pedidoNum || '').trim().toUpperCase();
      if (!ped) return;

      if (!map.has(ped)) {
        map.set(ped, {
          pedidoNum: ped,
          cliente: o.cliente || 'SIN CLIENTE',
          proyecto: o.nombre_proyecto || '',
          empaqueItemsCount: 0,
          empaqueTotalUnits: 0,
          totalOrderItemsInPlant: totalByPedidoMap.get(ped) || 0
        });
      }
      const entry = map.get(ped);
      entry.empaqueItemsCount += 1;
      entry.empaqueTotalUnits += Number(o.cantidad) || 1;
    });

    return Array.from(map.values()).sort(
      (a, b) => b.empaqueItemsCount - a.empaqueItemsCount
    );
  }, [orders]);

  // Sugerencias en el buscador superior
  const filteredOrderSuggestions = useMemo(() => {
    const q = searchPedidoInput.trim().toUpperCase();
    if (!q) return eligibleEmpaqueOrdersSummary;
    return eligibleEmpaqueOrdersSummary.filter(
      (item) =>
        item.pedidoNum.includes(q) ||
        (item.cliente && item.cliente.toUpperCase().includes(q))
    );
  }, [eligibleEmpaqueOrdersSummary, searchPedidoInput]);

  /**
   * PANORAMA COMPLETO DEL PEDIDO ACTIVO
   */
  const orderPanorama = useMemo(() => {
    if (!activePackingList?.pedidoNum) {
      return {
        totalOrderItemsCount: 0,
        totalOrderUnitsCount: 0,
        inEmpaqueItemsCount: 0,
        packedOrDispatchedItemsCount: 0,
        inEmpaqueOrDispatchedCount: 0,
        pendingArrivalItems: [],
        pendingByAreaList: []
      };
    }

    const targetPed = String(activePackingList.pedidoNum).trim().toUpperCase();
    const plantOrdersForPed = (orders || []).filter(
      (o) => o && String(o.pedidoNum || '').trim().toUpperCase() === targetPed
    );

    const inEmpaqueArr = [];
    const packedOrDispatchedArr = [];
    const pendingInOtherPlantAreasArr = [];

    plantOrdersForPed.forEach((o) => {
      const cod = String(o.codArticulo || o.codigo_item || 'S/C').trim().toUpperCase();
      const nom = String(o.nombre || o.descripcion || 'PRODUCTO SIN NOMBRE').trim().toUpperCase();
      const cant = Number(o.cantidad) || 1;

      if (isOrderStrictlyInEmpaque(o)) {
        inEmpaqueArr.push({
          id: o.id,
          codArticulo: cod,
          nombre: nom,
          cantidad: cant,
          areaActual: 'Empaque',
          estadoInterno: o.estadoInterno || 'En Empaque'
        });
      } else if (isOrderInDespachosOrDispatched(o)) {
        packedOrDispatchedArr.push({
          id: o.id,
          codArticulo: cod,
          nombre: nom,
          cantidad: cant,
          areaActual: o.areaActual || 'Despachos',
          estadoInterno: o.estadoInterno || 'En Despachos'
        });
      } else {
        const areaDisplay = String(o.areaActual || 'En Planta').trim();
        const transitoHacia = o.transferenciaPendiente?.haciaArea
          ? `En Tránsito hacia ${o.transferenciaPendiente.haciaArea}`
          : o.estadoInterno || 'En Proceso en Sección';

        pendingInOtherPlantAreasArr.push({
          id: o.id,
          codArticulo: cod,
          nombre: nom,
          cantidad: cant,
          areaActual: areaDisplay,
          estadoDetalle: transitoHacia,
          responsable: o.operarioAsignado || o.supervisor || ''
        });
      }
    });

    const seenErpKeys = new Set();
    (erpOrderRows || []).forEach((erpRow, idx) => {
      const codErp = String(erpRow.codigo_item ?? erpRow.articulo ?? '').trim().toUpperCase();
      const nomErp = String(erpRow.descripcion ?? erpRow.nombre ?? '').trim().toUpperCase();
      if (!codErp && !nomErp) return;

      const dedupKey = `${codErp}__${nomErp}`;
      if (seenErpKeys.has(dedupKey)) return;
      seenErpKeys.add(dedupKey);

      const alreadyInPlant = plantOrdersForPed.some((p) => {
        const pCod = String(p.codArticulo || p.codigo_item || '').trim().toUpperCase();
        const pNom = String(p.nombre || p.descripcion || '').trim().toUpperCase();
        if (codErp && pCod && codErp === pCod) return true;
        if (nomErp && pNom && nomErp === pNom) return true;
        return false;
      });

      if (!alreadyInPlant) {
        pendingInOtherPlantAreasArr.push({
          id: `ERP_${targetPed}_${idx}`,
          codArticulo: codErp || 'S/C',
          nombre: nomErp || 'PRODUCTO ERP',
          cantidad: Number(erpRow.cantidad) || 1,
          areaActual: 'Administración / Sin Iniciar en Planta',
          estadoDetalle: 'Pendiente por bajar a Producción',
          responsable: erpRow.programador || 'ERP'
        });
      }
    });

    const byAreaMap = new Map();
    pendingInOtherPlantAreasArr.forEach((item) => {
      const areaKey = item.areaActual || 'En Planta';
      if (!byAreaMap.has(areaKey)) {
        byAreaMap.set(areaKey, {
          area: areaKey,
          itemsCount: 0,
          unitsCount: 0
        });
      }
      const entry = byAreaMap.get(areaKey);
      entry.itemsCount += 1;
      entry.unitsCount += Number(item.cantidad) || 1;
    });

    const pendingByAreaList = Array.from(byAreaMap.values()).sort(
      (a, b) => b.itemsCount - a.itemsCount
    );

    const uniquePackedOrderIds = new Set(packedOrDispatchedArr.map((x) => x.id));
    (activePackingList?.packages || []).forEach((pkg) => {
      (pkg.items || []).forEach((it) => {
        if (it.orderId && !inEmpaqueArr.some((e) => e.id === it.orderId)) {
          uniquePackedOrderIds.add(it.orderId);
        }
      });
    });

    const packedOrDispatchedCount = Math.max(
      packedOrDispatchedArr.length,
      uniquePackedOrderIds.size
    );
    const inEmpaqueOrDispatchedCount = inEmpaqueArr.length + packedOrDispatchedCount;
    const totalOrderItemsCount =
      inEmpaqueOrDispatchedCount + pendingInOtherPlantAreasArr.length;

    const totalUnitsInPackages = (activePackingList?.packages || []).reduce(
      (acc, p) =>
        acc +
        (p.items || []).reduce(
          (s, it) =>
            s +
            (it.esSubpaqueteAdicional
              ? 0
              : Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
          0
        ),
      0
    );

    const totalUnitsPlantAndErp =
      inEmpaqueArr.reduce((s, i) => s + i.cantidad, 0) +
      Math.max(
        packedOrDispatchedArr.reduce((s, i) => s + i.cantidad, 0),
        totalUnitsInPackages
      ) +
      pendingInOtherPlantAreasArr.reduce((s, i) => s + i.cantidad, 0);

    return {
      totalOrderItemsCount,
      totalOrderUnitsCount: totalUnitsPlantAndErp,
      inEmpaqueItemsCount: inEmpaqueArr.length,
      packedOrDispatchedItemsCount: packedOrDispatchedCount,
      inEmpaqueOrDispatchedCount,
      pendingArrivalItems: pendingInOtherPlantAreasArr,
      pendingByAreaList
    };
  }, [activePackingList, orders, erpOrderRows]);

  const filteredPendingArrivalItems = useMemo(() => {
    const q = pendingArrivalSearch.trim().toUpperCase();
    return (orderPanorama.pendingArrivalItems || []).filter((item) => {
      if (
        selectedPendingAreaFilter !== 'TODAS' &&
        item.areaActual !== selectedPendingAreaFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.codArticulo.toUpperCase().includes(q) ||
        item.nombre.toUpperCase().includes(q) ||
        item.areaActual.toUpperCase().includes(q)
      );
    });
  }, [orderPanorama.pendingArrivalItems, selectedPendingAreaFilter, pendingArrivalSearch]);

  /**
   * Catálogo estricto de productos en 'EMPAQUE' listos para asignar a bultos/QR
   */
  const orderProductsInEmpaque = useMemo(() => {
    if (!activePackingList?.pedidoNum) return [];
    const targetPed = String(activePackingList.pedidoNum).trim().toUpperCase();

    const strictEmpaqueOrders = (orders || []).filter(
      (o) =>
        String(o.pedidoNum || '').trim().toUpperCase() === targetPed &&
        isOrderStrictlyInEmpaque(o)
    );

    const catalogMap = new Map();

    strictEmpaqueOrders.forEach((o) => {
      const cod = String(o.codArticulo || o.codigo_item || 'S/C').trim().toUpperCase();
      const nom = String(o.nombre || 'PRODUCTO SIN NOMBRE').trim().toUpperCase();
      const key = `${o.id}__${cod}`;

      catalogMap.set(key, {
        itemKey: key,
        orderId: o.id,
        codArticulo: cod,
        nombre: nom,
        cantidadTotalPedido: Number(o.cantidad) || 1,
        areaActual: 'Empaque',
        estadoInterno: o.estadoInterno || 'En Espera',
        packingListCompletada: Boolean(o.packingListCompletada)
      });
    });

    const packedUnitsByKey = new Map();
    const bultosCountByKey = new Map();
    const packages = Array.isArray(activePackingList?.packages) ? activePackingList.packages : [];

    packages.forEach((pkg) => {
      (pkg.items || []).forEach((it) => {
        const k = it.itemKey;
        const qty = it.esSubpaqueteAdicional
          ? 0
          : Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0;
        if (k) {
          packedUnitsByKey.set(k, (packedUnitsByKey.get(k) || 0) + qty);
          bultosCountByKey.set(k, (bultosCountByKey.get(k) || 0) + 1);
        }
      });
    });

    return Array.from(catalogMap.values()).map((item) => {
      const cantidadEmpacada = packedUnitsByKey.get(item.itemKey) || 0;
      const cantidadPendiente = Math.max(0, item.cantidadTotalPedido - cantidadEmpacada);
      const bultosGenerados = bultosCountByKey.get(item.itemKey) || 0;
      const isFullyPacked =
        (cantidadPendiente === 0 && item.cantidadTotalPedido > 0) ||
        item.packingListCompletada;

      return {
        ...item,
        cantidadEmpacada,
        cantidadPendiente,
        bultosGenerados,
        isFullyPacked
      };
    });
  }, [activePackingList, orders]);

  // Inicializar valores por defecto de la calculadora para cada ítem pendiente en Empaque (Sin abrir paneles avanzados por defecto para no sobrecargar)
  useEffect(() => {
    setItemCalculators((prev) => {
      const next = { ...prev };
      let changed = false;

      orderProductsInEmpaque.forEach((item) => {
        if (item.cantidadPendiente <= 0) return;
        const curr = next[item.itemKey];
        if (!curr) {
          changed = true;
          next[item.itemKey] = {
            openPanel: null, // null (Vista limpia con botones directos) | 'LOTES_IGUALES' | 'SUBPAQUETES' | 'AGRUPACION_MANUAL'
            mode: 'LOTES_IGUALES',
            tipoEmpaque: 'Paquete',
            numBultos: 1,
            undsPorBulto: item.cantidadPendiente,
            numSubpaquetes: 2,
            unidadesParaSubpaquetes: 1,
            manualQty: item.cantidadPendiente,
            targetPkgId: 'NUEVO',
            observaciones: ''
          };
        } else {
          const totalAsignadoCalc =
            (Number(curr.numBultos) || 1) * (Number(curr.undsPorBulto) || 1);
          if (totalAsignadoCalc > item.cantidadPendiente && curr.numBultos === 1) {
            changed = true;
            next[item.itemKey] = {
              ...curr,
              undsPorBulto: item.cantidadPendiente,
              manualQty: Math.min(Number(curr.manualQty) || 1, item.cantidadPendiente)
            };
          }
        }
      });

      return changed ? next : prev;
    });
  }, [orderProductsInEmpaque]);

  const updateItemCalc = (itemKey, patch) => {
    setItemCalculators((prev) => ({
      ...prev,
      [itemKey]: {
        ...(prev[itemKey] || {
          openPanel: null,
          mode: 'LOTES_IGUALES',
          tipoEmpaque: 'Paquete',
          numBultos: 1,
          undsPorBulto: 1,
          numSubpaquetes: 2,
          unidadesParaSubpaquetes: 1,
          manualQty: 1,
          targetPkgId: 'NUEVO',
          observaciones: ''
        }),
        ...patch
      }
    }));
  };

  const pendingEmpaqueProducts = useMemo(() => {
    const q = filterProductSearch.trim().toUpperCase();
    return orderProductsInEmpaque.filter((item) => {
      if (item.isFullyPacked || item.cantidadPendiente <= 0) return false;
      if (!q) return true;
      return (
        item.codArticulo.toUpperCase().includes(q) ||
        item.nombre.toUpperCase().includes(q)
      );
    });
  }, [orderProductsInEmpaque, filterProductSearch]);

  const completedEmpaqueProductsReadyForDispatch = useMemo(() => {
    return orderProductsInEmpaque.filter((item) => item.isFullyPacked);
  }, [orderProductsInEmpaque]);

  const packingStats = useMemo(() => {
    const totalReferenciasEnEmpaque = orderProductsInEmpaque.length;
    const referenciasCompletas = completedEmpaqueProductsReadyForDispatch.length;
    const referenciasPendientesCount = pendingEmpaqueProducts.length;

    const totalUnitsInGeneratedPackages = (activePackingList?.packages || []).reduce(
      (acc, p) =>
        acc +
        (p.items || []).reduce(
          (s, it) =>
            s +
            (it.esSubpaqueteAdicional
              ? 0
              : Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
          0
        ),
      0
    );

    const totalUnidadesPendientesEnEmpaque = orderProductsInEmpaque.reduce(
      (acc, i) => acc + i.cantidadPendiente,
      0
    );

    const totalUnidadesEnEmpaqueYEmpacadas =
      totalUnitsInGeneratedPackages + totalUnidadesPendientesEnEmpaque;

    const pctUnidades =
      orderPanorama.totalOrderItemsCount > 0
        ? Math.min(
            100,
            Math.round(
              ((orderPanorama.packedOrDispatchedItemsCount + referenciasCompletas) /
                orderPanorama.totalOrderItemsCount) *
                100
            )
          )
        : totalUnidadesEnEmpaqueYEmpacadas > 0
        ? Math.min(
            100,
            Math.round(
              (totalUnitsInGeneratedPackages / totalUnidadesEnEmpaqueYEmpacadas) * 100
            )
          )
        : 0;

    return {
      totalReferenciasEnEmpaque,
      referenciasCompletas,
      referenciasPendientesCount,
      totalUnidadesEnEmpaque: totalUnidadesEnEmpaqueYEmpacadas,
      totalUnidadesEmpacadas: totalUnitsInGeneratedPackages,
      totalUnidadesPendientes: totalUnidadesPendientesEnEmpaque,
      pctUnidades
    };
  }, [
    orderProductsInEmpaque,
    completedEmpaqueProductsReadyForDispatch,
    pendingEmpaqueProducts,
    activePackingList,
    orderPanorama
  ]);

  const handleCreateOrOpenPackingList = (pedidoNumRaw, clienteRaw = '') => {
    const pedNum = String(pedidoNumRaw || '').trim().toUpperCase();
    if (!pedNum) return;

    const existing = (packingLists || []).find(
      (l) => String(l.pedidoNum || '').trim().toUpperCase() === pedNum
    );
    if (existing) {
      if (existing.estadoLista === 'TERMINADA') {
        const hasMoreInEmpaque = eligibleEmpaqueOrdersSummary.some(
          (s) => s.pedidoNum === pedNum
        );
        if (hasMoreInEmpaque) {
          const reopened = {
            ...existing,
            estadoLista: 'ACTIVA',
            actualizadoEn: new Date().toISOString()
          };
          setPackingLists((prev) =>
            prev.map((l) => (l.id === reopened.id ? reopened : l))
          );
          syncPackingListToSupabase(reopened);
          setConsultingClosedListId(null);
          setActiveListId(reopened.id);
          setMainViewTab('ACTIVAS');
        } else {
          setConsultingClosedListId(existing.id);
          setMainViewTab('ACTIVAS');
        }
      } else {
        setConsultingClosedListId(null);
        setActiveListId(existing.id);
        setMainViewTab('ACTIVAS');
      }
      setSearchPedidoInput('');
      setShowNewListDropdown(false);
      return;
    }

    const eligibleSummary = eligibleEmpaqueOrdersSummary.find(
      (s) => s.pedidoNum === pedNum
    );
    if (!eligibleSummary) {
      alert(
        `⚠️ Filtrado Estricto de Planta:\nEl pedido #${pedNum} aún no tiene productos en el área de 'EMPAQUE'.\n\nSolo se pueden iniciar listas de empaque cuando al menos 1 producto del pedido haya ingresado físicamente a 'EMPAQUE'.`
      );
      return;
    }

    const newList = {
      id: `PACKLIST_${pedNum}_${Date.now()}`,
      tipoRegistro: 'PACKING_LIST',
      pedidoNum: pedNum,
      cliente: clienteRaw || eligibleSummary.cliente || 'CLIENTE GENERAL',
      proyecto: eligibleSummary.proyecto || '',
      estadoLista: 'ACTIVA',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      creadoPor: supervisorProfile?.nombre || supervisorProfile?.name || 'PLANTA / EMPAQUE',
      nextConsecutive: 1,
      packages: []
    };

    const updated = [newList, ...(packingLists || [])];
    setPackingLists(updated);
    syncPackingListToSupabase(newList);
    setConsultingClosedListId(null);
    setActiveListId(newList.id);
    setMainViewTab('ACTIVAS');
    setSearchPedidoInput('');
    setShowNewListDropdown(false);
  };

  /**
   * CIERRE / FINALIZACIÓN DE LISTA DE EMPAQUE CON NOTIFICACIÓN ROJA GRANDE PREVENTIVA
   */
  const handleAttemptClosePackingList = () => {
    if (!activePackingList) return;

    const faltanPorLlegarCount = orderPanorama.pendingArrivalItems.length;
    const faltanPorEmpacarCount = pendingEmpaqueProducts.length;
    const faltanPorPasarADespachosCount = completedEmpaqueProductsReadyForDispatch.length;
    const totalFaltantes =
      faltanPorLlegarCount + faltanPorEmpacarCount + faltanPorPasarADespachosCount;

    if (totalFaltantes > 0) {
      const updatedActiveList = {
        ...activePackingList,
        estadoLista: 'ACTIVA_PARCIAL',
        actualizadoEn: new Date().toISOString(),
        ultimoResumenPendientes: {
          totalPedido: orderPanorama.totalOrderItemsCount,
          faltanPorLlegar: faltanPorLlegarCount,
          faltanPorEmpacar: faltanPorEmpacarCount,
          faltanPorTransferirDespachos: faltanPorPasarADespachosCount
        }
      };

      setPackingLists((prev) =>
        prev.map((l) => (l.id === updatedActiveList.id ? updatedActiveList : l))
      );
      syncPackingListToSupabase(updatedActiveList);

      setIncompleteCloseWarningModal({
        pedidoNum: activePackingList.pedidoNum,
        cliente: activePackingList.cliente,
        totalPedidoItems: orderPanorama.totalOrderItemsCount,
        empacadosCount: orderPanorama.packedOrDispatchedItemsCount,
        bultosCount: (activePackingList.packages || []).length,
        faltanPorLlegarCount,
        faltanPorEmpacarCount,
        faltanPorPasarADespachosCount,
        totalFaltantes,
        areasSummary: orderPanorama.pendingByAreaList
      });
      return;
    }

    if ((activePackingList.packages || []).length === 0) {
      alert('No puedes finalizar una lista de empaque que aún no tiene bultos generados.');
      return;
    }

    const finishedList = {
      ...activePackingList,
      estadoLista: 'TERMINADA',
      fechaCierre: new Date().toISOString(),
      cerradoPor: supervisorProfile?.nombre || supervisorProfile?.name || 'EMPAQUE',
      actualizadoEn: new Date().toISOString()
    };

    const nextActive = activeWorkingLists.find((l) => l.id !== finishedList.id);

    setPackingLists((prev) =>
      prev.map((l) => (l.id === finishedList.id ? finishedList : l))
    );
    syncPackingListToSupabase(finishedList);
    setConsultingClosedListId(null);
    setActiveListId(nextActive ? nextActive.id : null);

    alert(
      `✅ Lista de Empaque del Pedido #${finishedList.pedidoNum} finalizada al 100%, retirada de la Mesa de Trabajo activa y almacenada en el Historial de Listas de Empaque.`
    );
    setMainViewTab('HISTORIAL');
  };

  const handleReopenPackingList = (listObj) => {
    if (!listObj) return;
    const reopened = {
      ...listObj,
      estadoLista: 'ACTIVA',
      actualizadoEn: new Date().toISOString()
    };
    setPackingLists((prev) => prev.map((l) => (l.id === reopened.id ? reopened : l)));
    syncPackingListToSupabase(reopened);
    setConsultingClosedListId(null);
    setActiveListId(reopened.id);
    setMainViewTab('ACTIVAS');
  };

  /**
   * Abrir o consultar una lista desde el Historial:
   * - Si la lista está activa: la selecciona en la Mesa de Trabajo.
   * - Si la lista está TERMINADA:
   *   * Si el pedido tiene productos pendientes por empacar en EMPAQUE, la reactiva como ACTIVA para seguir empacando.
   *   * Si ya no tiene productos por empacar (quedó cerrado), se abre solo en modo consulta sin aparecer como pestaña activa en la Mesa de Trabajo.
   */
  const handleOpenOrConsultFromHistory = (listObj) => {
    if (!listObj) return;
    if (listObj.estadoLista !== 'TERMINADA') {
      setConsultingClosedListId(null);
      setActiveListId(listObj.id);
      setMainViewTab('ACTIVAS');
      return;
    }

    const pedNum = String(listObj.pedidoNum || '').trim().toUpperCase();
    const hasPendingInEmpaque = (orders || []).some(
      (o) =>
        o &&
        String(o.pedidoNum || '').trim().toUpperCase() === pedNum &&
        isOrderStrictlyInEmpaque(o) &&
        !o.packingListCompletada
    );

    if (hasPendingInEmpaque) {
      handleReopenPackingList(listObj);
    } else {
      setConsultingClosedListId(listObj.id);
      setMainViewTab('ACTIVAS');
    }
  };

  const handleDeletePackingList = (listObj, e) => {
    if (e) e.stopPropagation();
    if (!listObj) return;
    if (
      !window.confirm(
        `¿Estás seguro de eliminar la Lista de Empaque del pedido #${listObj.pedidoNum}?`
      )
    ) {
      return;
    }
    const remaining = (packingLists || []).filter((l) => l.id !== listObj.id);
    const remainingActive = remaining.filter((l) => l.estadoLista !== 'TERMINADA');
    setPackingLists(remaining);
    syncPackingListToSupabase(listObj, true);
    if (consultingClosedListId === listObj.id) {
      setConsultingClosedListId(null);
    }
    if (activeListId === listObj.id) {
      setActiveListId(remainingActive[0]?.id || null);
    }
  };

  const reindexPackagesList = (packagesArr, pedidoNum) => {
    const total = packagesArr.length;
    return packagesArr.map((pkg, idx) => {
      const consec = idx + 1;
      const numPadded = String(consec).padStart(2, '0');
      const tipoUpper = String(pkg.tipoEmpaque || 'PAQUETE').trim().toUpperCase();
      return {
        ...pkg,
        consecutivo: consec,
        codigoPaquete: `${tipoUpper} #${numPadded}`,
        bultoPositionText: `Bulto ${consec} de ${total}`,
        codigoUnicoPedido: `${pedidoNum}-B${numPadded}`
      };
    });
  };

  /**
   * GENERACIÓN DE BULTOS RÁPIDA O AVANZADA:
   * Soporta:
   * 1) Acción Rápida Directa (`quickOverride`: ej. Todo en 1 paquete o 1 paquete por unidad)
   * 2) División de Cantidad en Lotes (`LOTES_IGUALES`: ej. 500 flautas -> 10 paquetes de 50 unds)
   * 3) Separación de un Producto Grande en Subpaquetes / Partes (`SUBPAQUETES`: ej. 1 mueble grande -> 3 subpaquetes con QR individual)
   * 4) Agrupación Manual en Caja / Guacal Mixto (`AGRUPACION_MANUAL`)
   */
  const handleGenerateBultosForItem = (prod, quickOverride = null) => {
    if (!activePackingList || !prod) return;
    const baseCalc = itemCalculators[prod.itemKey] || {
      openPanel: null,
      mode: 'LOTES_IGUALES',
      tipoEmpaque: 'Paquete',
      numBultos: 1,
      undsPorBulto: prod.cantidadPendiente,
      numSubpaquetes: 2,
      unidadesParaSubpaquetes: 1,
      manualQty: prod.cantidadPendiente,
      targetPkgId: 'NUEVO',
      observaciones: ''
    };

    const calc = quickOverride ? { ...baseCalc, ...quickOverride } : baseCalc;

    const currentPackages = Array.isArray(activePackingList.packages)
      ? [...activePackingList.packages]
      : [];

    const tipoUpper = String(calc.tipoEmpaque || 'Paquete').trim().toUpperCase();
    const obsClean = String(calc.observaciones || '').trim().toUpperCase();

    if (calc.mode === 'SUBPAQUETES') {
      // MODO ESPECIAL: DIVIDIR 1 PRODUCTO GRANDE EN MÚLTIPLES SUBPAQUETES / PARTES (Ej. 1 mueble en 3 subpaquetes)
      const numSubpaquetes = Math.floor(Number(calc.numSubpaquetes) || 0);
      const unidadesProducto = Math.max(
        1,
        Math.min(
          prod.cantidadPendiente,
          Math.floor(Number(calc.unidadesParaSubpaquetes) || 1)
        )
      );

      if (numSubpaquetes < 2) {
        alert('⚠️ Para separar un producto grande en subpaquetes, indica al menos 2 subpaquetes.');
        return;
      }

      if (unidadesProducto > prod.cantidadPendiente) {
        alert(
          `❌ Solo tienes ${prod.cantidadPendiente} unidad(es) pendiente(s) de este producto.`
        );
        return;
      }

      const subGroupId = `SUBGRP_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      for (let i = 0; i < numSubpaquetes; i++) {
        const nextNum = currentPackages.length + 1;
        const numPadded = String(nextNum).padStart(2, '0');
        const subLabel = `SUBPAQUETE ${i + 1} DE ${numSubpaquetes}`;

        currentPackages.push({
          id: `PKG_${activePackingList.pedidoNum}_${Date.now()}_SUB_${i}_${Math.random().toString(36).slice(2, 7)}`,
          consecutivo: nextNum,
          codigoPaquete: `${tipoUpper} #${numPadded}`,
          tipoEmpaque: tipoUpper,
          observaciones: obsClean ? `${subLabel} - ${obsClean}` : subLabel,
          fechaEmpaque: new Date().toISOString(),
          empacadoPor: supervisorProfile?.nombre || 'EMPAQUE',
          subpaqueteGroupId: subGroupId,
          loteFraccionadoInfo: subLabel,
          items: [
            {
              itemKey: prod.itemKey,
              orderId: prod.orderId,
              codArticulo: prod.codArticulo,
              nombre: prod.nombre,
              // Solo el primer subpaquete descuenta las unidades del saldo matemático para no duplicar el conteo de inventario
              cantidadEnEsteBulto: i === 0 ? unidadesProducto : 0,
              cantidadEmpacada: i === 0 ? unidadesProducto : 0,
              cantidadMostradaBulto: unidadesProducto,
              esSubpaqueteAdicional: i > 0,
              subpaqueteGroupId: subGroupId,
              subpaqueteLabel: subLabel,
              cantidadTotalItem: prod.cantidadTotalPedido,
              cantidadTotalPedido: prod.cantidadTotalPedido,
              textoContenidoBulto: `${unidadesProducto} de ${prod.cantidadTotalPedido} unds (${subLabel})`,
              areaOrigen: 'Empaque'
            }
          ]
        });
      }
    } else if (calc.mode === 'LOTES_IGUALES') {
      const numBultos = Math.floor(Number(calc.numBultos) || 0);
      const undsPorBulto = Math.floor(Number(calc.undsPorBulto) || 0);
      const totalUnidadesAGenerar = numBultos * undsPorBulto;

      if (numBultos <= 0 || undsPorBulto <= 0) {
        alert('⚠️ La cantidad de paquetes y las unidades por paquete deben ser mayores a 0.');
        return;
      }

      if (totalUnidadesAGenerar > prod.cantidadPendiente) {
        alert(
          `❌ Error de Saldo Matemático:\nIntentas distribuir ${numBultos} paquetes × ${undsPorBulto} unds = ${totalUnidadesAGenerar} unidades, pero el producto [${prod.codArticulo}] solo tiene ${prod.cantidadPendiente} unidades disponibles por empacar (Total del pedido: ${prod.cantidadTotalPedido} unds).`
        );
        return;
      }

      for (let i = 0; i < numBultos; i++) {
        const nextNum = currentPackages.length + 1;
        const numPadded = String(nextNum).padStart(2, '0');
        currentPackages.push({
          id: `PKG_${activePackingList.pedidoNum}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          consecutivo: nextNum,
          codigoPaquete: `${tipoUpper} #${numPadded}`,
          tipoEmpaque: tipoUpper,
          observaciones: obsClean,
          fechaEmpaque: new Date().toISOString(),
          empacadoPor: supervisorProfile?.nombre || 'EMPAQUE',
          loteFraccionadoInfo: `${i + 1} de ${numBultos}`,
          items: [
            {
              itemKey: prod.itemKey,
              orderId: prod.orderId,
              codArticulo: prod.codArticulo,
              nombre: prod.nombre,
              cantidadEnEsteBulto: undsPorBulto,
              cantidadEmpacada: undsPorBulto,
              cantidadMostradaBulto: undsPorBulto,
              cantidadTotalItem: prod.cantidadTotalPedido,
              cantidadTotalPedido: prod.cantidadTotalPedido,
              textoContenidoBulto: `${undsPorBulto} de ${prod.cantidadTotalPedido} unds`,
              areaOrigen: 'Empaque'
            }
          ]
        });
      }
    } else {
      // MODO B: AGRUPACIÓN MANUAL / CAJA MIXTA
      const manualQty = Math.floor(Number(calc.manualQty) || 0);
      if (manualQty <= 0) {
        alert('⚠️ Ingresa una cantidad de unidades válida mayor a 0.');
        return;
      }
      if (manualQty > prod.cantidadPendiente) {
        alert(
          `❌ Error de Saldo Matemático:\nIntentas agregar ${manualQty} unidades, pero solo quedan ${prod.cantidadPendiente} unidades pendientes de las ${prod.cantidadTotalPedido} totales del producto.`
        );
        return;
      }

      const newItemPayload = {
        itemKey: prod.itemKey,
        orderId: prod.orderId,
        codArticulo: prod.codArticulo,
        nombre: prod.nombre,
        cantidadEnEsteBulto: manualQty,
        cantidadEmpacada: manualQty,
        cantidadMostradaBulto: manualQty,
        cantidadTotalItem: prod.cantidadTotalPedido,
        cantidadTotalPedido: prod.cantidadTotalPedido,
        textoContenidoBulto: `${manualQty} de ${prod.cantidadTotalPedido} unds`,
        areaOrigen: 'Empaque'
      };

      if (calc.targetPkgId && calc.targetPkgId !== 'NUEVO') {
        const pkgIdx = currentPackages.findIndex((p) => p.id === calc.targetPkgId);
        if (pkgIdx === -1) {
          alert('Selecciona un bulto/caja existente válido o elige "Crear Nuevo Bulto Mixto".');
          return;
        }
        const targetPkg = { ...currentPackages[pkgIdx] };
        const existingItems = Array.isArray(targetPkg.items) ? [...targetPkg.items] : [];
        const sameItemIdx = existingItems.findIndex((i) => i.itemKey === prod.itemKey);

        if (sameItemIdx >= 0) {
          const updatedQtyInBulto =
            (Number(
              existingItems[sameItemIdx].cantidadEnEsteBulto ??
                existingItems[sameItemIdx].cantidadEmpacada
            ) || 0) + manualQty;
          existingItems[sameItemIdx] = {
            ...existingItems[sameItemIdx],
            cantidadEnEsteBulto: updatedQtyInBulto,
            cantidadEmpacada: updatedQtyInBulto,
            cantidadMostradaBulto: updatedQtyInBulto,
            textoContenidoBulto: `${updatedQtyInBulto} de ${prod.cantidadTotalPedido} unds`
          };
        } else {
          existingItems.push(newItemPayload);
        }

        targetPkg.items = existingItems;
        if (obsClean) targetPkg.observaciones = obsClean;
        currentPackages[pkgIdx] = targetPkg;
      } else {
        const nextNum = currentPackages.length + 1;
        const numPadded = String(nextNum).padStart(2, '0');
        currentPackages.push({
          id: `PKG_${activePackingList.pedidoNum}_${Date.now()}_MIX_${Math.random().toString(36).slice(2, 7)}`,
          consecutivo: nextNum,
          codigoPaquete: `${tipoUpper} #${numPadded}`,
          tipoEmpaque: tipoUpper,
          observaciones: obsClean,
          fechaEmpaque: new Date().toISOString(),
          empacadoPor: supervisorProfile?.nombre || 'EMPAQUE',
          items: [newItemPayload]
        });
      }
    }

    const reindexed = reindexPackagesList(currentPackages, activePackingList.pedidoNum);
    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: reindexed.length + 1,
      packages: reindexed
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);

    const usedUnits =
      calc.mode === 'SUBPAQUETES'
        ? Math.max(1, Math.floor(Number(calc.unidadesParaSubpaquetes) || 1))
        : calc.mode === 'LOTES_IGUALES'
        ? (Number(calc.numBultos) || 1) * (Number(calc.undsPorBulto) || 1)
        : Number(calc.manualQty) || 1;
    const remainingAfter = Math.max(0, prod.cantidadPendiente - usedUnits);

    updateItemCalc(prod.itemKey, {
      openPanel: remainingAfter > 0 ? calc.openPanel : null,
      numBultos: 1,
      undsPorBulto: Math.max(1, remainingAfter),
      manualQty: Math.max(1, remainingAfter),
      observaciones: ''
    });
  };

  const handleTransferToDespachos = async (itemsToTransfer) => {
    const validItems = (Array.isArray(itemsToTransfer) ? itemsToTransfer : [itemsToTransfer]).filter(
      (it) => it && it.orderId && it.isFullyPacked
    );

    if (validItems.length === 0) {
      alert('Solo se pueden transferir a Despachos los productos que tengan el 100% de sus unidades asignadas a bultos con QR.');
      return;
    }

    const totalPackagesOrder = (activePackingList?.packages || []).length;
    const confirmMsg =
      validItems.length === 1
        ? `¿Confirmas transferir el producto [${validItems[0].codArticulo}] ${validItems[0].nombre} (${validItems[0].cantidadTotalPedido} unds empacadas) al área de DESPACHOS (Estado: EN ESPERA)?`
        : `¿Confirmas transferir ${validItems.length} productos 100% empacados del Pedido #${activePackingList?.pedidoNum} al área de DESPACHOS (Estado: EN ESPERA)?`;

    if (!window.confirm(confirmMsg)) return;

    const targetOrderIds = new Set(validItems.map((i) => i.orderId));
    const ordersToSync = [];

    const updatedOrders = (orders || []).map((ord) => {
      if (!targetOrderIds.has(ord.id)) return ord;

      const bultosDeEsteItem = (activePackingList?.packages || [])
        .filter((pkg) => (pkg.items || []).some((it) => it.orderId === ord.id))
        .map((pkg) => pkg.codigoPaquete);

      const historyEntry = {
        fecha: new Date().toISOString(),
        supervisor: supervisorProfile?.nombre || 'EMPAQUE',
        accion: `Lista de Empaque Completada (${bultosDeEsteItem.join(', ') || `${totalPackagesOrder} bultos`}) -> Transferido a Despachos (EN ESPERA)`,
        entrega: 'EMPAQUE',
        recibe: 'DESPACHOS',
        nota: `Empaque 100% verificado con QR (${ord.cantidad} unds)`
      };

      const updatedOrd = {
        ...ord,
        areaActual: 'Despachos',
        estadoInterno: 'EN ESPERA',
        transferenciaPendiente: null,
        packingListCompletada: true,
        resumenEmpaque: {
          pedidoNum: activePackingList?.pedidoNum,
          totalBultosPedido: totalPackagesOrder,
          bultosProducto: bultosDeEsteItem,
          fechaTransferenciaDespachos: new Date().toISOString()
        },
        historial: [...(ord.historial || []), historyEntry]
      };

      ordersToSync.push(updatedOrd);
      return updatedOrd;
    });

    setOrders(updatedOrders);
    for (const oSync of ordersToSync) {
      await syncOrderToSupabase(oSync);
    }

    if (activePackingList) {
      const updatedPackages = (activePackingList.packages || []).map((pkg) => ({
        ...pkg,
        items: (pkg.items || []).map((it) =>
          targetOrderIds.has(it.orderId)
            ? { ...it, transferidoADespachos: true, fechaTransferencia: new Date().toISOString() }
            : it
        )
      }));

      const updatedList = {
        ...activePackingList,
        actualizadoEn: new Date().toISOString(),
        packages: updatedPackages
      };

      setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
      syncPackingListToSupabase(updatedList);
    }
  };

  const handleRemoveItemFromPackage = (pkgId, itemIdx) => {
    if (!activePackingList) return;
    const currentPackages = Array.isArray(activePackingList.packages)
      ? [...activePackingList.packages]
      : [];
    const pkgIndex = currentPackages.findIndex((p) => p.id === pkgId);
    if (pkgIndex === -1) return;

    const targetPkg = { ...currentPackages[pkgIndex] };
    const newItems = (targetPkg.items || []).filter((_, idx) => idx !== itemIdx);

    let updatedPackages;
    if (newItems.length === 0) {
      updatedPackages = currentPackages.filter((p) => p.id !== pkgId);
    } else {
      targetPkg.items = newItems;
      currentPackages[pkgIndex] = targetPkg;
      updatedPackages = currentPackages;
    }

    const reindexed = reindexPackagesList(updatedPackages, activePackingList.pedidoNum);
    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: reindexed.length + 1,
      packages: reindexed
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);
  };

  const handleDeletePackage = (pkgId) => {
    if (!activePackingList) return;
    const targetPkg = (activePackingList.packages || []).find((p) => p.id === pkgId);
    const isSubpkgGroup = Boolean(targetPkg?.subpaqueteGroupId);

    if (
      !window.confirm(
        isSubpkgGroup
          ? 'Este bulto forma parte de un producto dividido en subpaquetes. ¿Deseas eliminar todos los subpaquetes de este producto para que regrese al saldo pendiente?'
          : '¿Deseas eliminar este bulto de la lista? Las unidades regresarán al saldo pendiente por empacar.'
      )
    ) {
      return;
    }

    const filtered = (activePackingList.packages || []).filter((p) =>
      isSubpkgGroup
        ? p.subpaqueteGroupId !== targetPkg.subpaqueteGroupId
        : p.id !== pkgId
    );
    const reindexed = reindexPackagesList(filtered, activePackingList.pedidoNum);

    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: reindexed.length + 1,
      packages: reindexed
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);
  };

  const handlePrint = (mode = 'LISTA_COMPLETA', singlePkg = null, customListObj = null) => {
    const targetList = customListObj || activePackingList;
    if (!targetList) return;
    const allPackages = targetList.packages || [];
    const packagesToPrint = singlePkg ? [singlePkg] : allPackages;

    if (packagesToPrint.length === 0) {
      alert('Aún no hay bultos/paquetes generados en esta lista de empaque para imprimir.');
      return;
    }

    const totalPackagesCount = allPackages.length;

    const renderQRInlineSVG = (text, pxSize = 115) => {
      const mat = generateQRMatrix(text || 'CDI');
      const N = mat.length;
      const qz = 3;
      const tot = N + qz * 2;
      let rects = '';
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (mat[r][c]) {
            rects += `<rect x="${c + qz}" y="${r + qz}" width="1" height="1" fill="#000"/>`;
          }
        }
      }
      return `<svg width="${pxSize}" height="${pxSize}" viewBox="0 0 ${tot} ${tot}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${tot}" height="${tot}" fill="#fff"/>${rects}</svg>`;
    };

    const printWindow = window.open('', '_blank', 'width=1020,height=780');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes para imprimir.');
      return;
    }

    if (mode === 'ROTULOS_QR') {
      const labelsHtml = packagesToPrint
        .map((pkg) => {
          const realIdx = allPackages.findIndex((p) => p.id === pkg.id);
          const idxToUse = realIdx >= 0 ? realIdx : 0;
          const qrText = buildPackageQRText(targetList, pkg, idxToUse, totalPackagesCount);
          const qrSvg = renderQRInlineSVG(qrText, 145);
          const tipo = String(pkg.tipoEmpaque || 'PAQUETE').toUpperCase();
          const numPadded = String(pkg.consecutivo || idxToUse + 1).padStart(2, '0');

          const itemsRows = (pkg.items || [])
            .map((it) => {
              const cantBulto =
                Number(it.cantidadMostradaBulto ?? it.cantidadEnEsteBulto ?? it.cantidadEmpacada) ||
                1;
              const cantTotalItem =
                Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;
              return `
                <div style="border-bottom: 1px dashed #cbd5e1; padding: 6px 0; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                    <span style="background: #0f172a; color: #fff; padding: 2px 7px; border-radius: 4px; font-family: monospace; margin-right: 5px;">${it.codArticulo || 'S/C'}</span>
                    ${it.nombre || ''}
                  </div>
                  <div style="font-size: 13px; font-weight: 900; background: #fef3c7; border: 1.5px solid #f59e0b; color: #92400e; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                    ${
                      it.subpaqueteLabel
                        ? `${cantBulto} de ${cantTotalItem} unds (${it.subpaqueteLabel})`
                        : `Contenido en este bulto: ${cantBulto} de ${cantTotalItem} unds`
                    }
                  </div>
                </div>
              `;
            })
            .join('');

          return `
            <div class="qr-label-card">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px;">
                <div>
                  <div style="font-size: 11px; font-weight: 900; letter-spacing: 1px; color: #475569;">CDI EXHIBICIONES • CONTROL DE EMPAQUE Y DESPACHOS</div>
                  <div style="font-size: 24px; font-weight: 900; color: #0f172a;">PEDIDO #${targetList.pedidoNum}</div>
                  <div style="font-size: 13px; font-weight: 800; color: #1e293b;">CLIENTE: ${targetList.cliente}</div>
                </div>
                <div style="text-align: right; background: #0f172a; color: #fff; padding: 8px 14px; border-radius: 10px;">
                  <div style="font-size: 20px; font-weight: 900; color: #fbbf24;">${tipo} #${numPadded}</div>
                  <div style="font-size: 12px; font-weight: 800;">BULTO ${idxToUse + 1} DE ${totalPackagesCount}</div>
                </div>
              </div>
              <div style="display: flex; gap: 14px; align-items: center;">
                <div style="border: 2px solid #0f172a; border-radius: 10px; padding: 6px; background: #fff; text-align: center;">
                  ${qrSvg}
                  <div style="font-size: 9px; font-weight: 900; font-family: monospace; margin-top: 2px;">${targetList.pedidoNum}-B${numPadded}</div>
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 4px;">
                    Contenido Exacto de este Bulto Físico:
                  </div>
                  ${itemsRows}
                  ${
                    pkg.observaciones
                      ? `<div style="margin-top: 6px; font-size: 12px; font-weight: 800; color: #b45309;">OBSERVACIÓN: ${pkg.observaciones}</div>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Etiquetas QR - Pedido #${targetList.pedidoNum}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 12px; color: #0f172a; }
              .qr-label-card {
                border: 2.5px solid #0f172a;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 16px;
                page-break-inside: avoid;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() { window.print(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    const tableRowsHtml = allPackages
      .map((pkg, pkgIdx) => {
        const items = pkg.items || [];
        const qrText = buildPackageQRText(targetList, pkg, pkgIdx, totalPackagesCount);
        const qrSvg = renderQRInlineSVG(qrText, 82);
        const tipo = String(pkg.tipoEmpaque || 'PAQUETE').toUpperCase();
        const numPadded = String(pkg.consecutivo || pkgIdx + 1).padStart(2, '0');

        return items
          .map((it, itemIdx) => {
            const isFirstRow = itemIdx === 0;
            const rowSpan = items.length;
            const cantBulto =
              Number(it.cantidadMostradaBulto ?? it.cantidadEnEsteBulto ?? it.cantidadEmpacada) ||
              1;
            const cantTotalItem =
              Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;

            return `
              <tr>
                ${
                  isFirstRow
                    ? `<td rowspan="${rowSpan}" style="border: 1px solid #94a3b8; padding: 8px; text-align: center; vertical-align: middle; background: #f8fafc;">
                        <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${tipo} #${numPadded}</div>
                        <div style="font-size: 11px; font-weight: 800; color: #0284c7; margin-top: 2px;">Bulto ${pkgIdx + 1} de ${totalPackagesCount}</div>
                        ${pkg.observaciones ? `<div style="font-size: 10px; color: #b45309; margin-top: 4px; font-weight: 700;">Obs: ${pkg.observaciones}</div>` : ''}
                      </td>`
                    : ''
                }
                <td style="border: 1px solid #94a3b8; padding: 8px; font-family: monospace; font-weight: 800; font-size: 12px;">${it.codArticulo || 'S/C'}</td>
                <td style="border: 1px solid #94a3b8; padding: 8px; font-weight: 700; font-size: 12px;">${it.nombre || ''}</td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center; font-weight: 900; font-size: 12px; background: #fefce8;">
                  ${cantBulto} de ${cantTotalItem} unds
                  ${it.subpaqueteLabel ? `<div style="font-size: 10px; color: #7c3aed; margin-top: 2px;">${it.subpaqueteLabel}</div>` : ''}
                </td>
                ${
                  isFirstRow
                    ? `<td rowspan="${rowSpan}" style="border: 1px solid #94a3b8; padding: 6px; text-align: center; vertical-align: middle;">
                        ${qrSvg}
                        <div style="font-size: 9px; font-family: monospace; font-weight: 800;">#${targetList.pedidoNum}-B${numPadded}</div>
                      </td>`
                    : ''
                }
              </tr>
            `;
          })
          .join('');
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Lista de Empaque Oficial - Pedido #${targetList.pedidoNum}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 18px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { background: #0f172a; color: #fff; padding: 9px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 10px;">
            <div>
              <div style="font-size: 12px; font-weight: 900; color: #475569;">CDI EXHIBICIONES • LISTA DE EMPAQUE OFICIAL CON TRAZABILIDAD QR</div>
              <div style="font-size: 24px; font-weight: 900; margin-top: 2px;">PEDIDO #${targetList.pedidoNum}</div>
              <div style="font-size: 14px; font-weight: 800; color: #1e293b;">CLIENTE: ${targetList.cliente}</div>
            </div>
            <div style="text-align: right; font-size: 12px; font-weight: 700;">
              <div>TOTAL BULTOS FÍSICOS GENERADOS: <strong>${totalPackagesCount}</strong></div>
              <div>ESTADO LISTA: <strong>${targetList.estadoLista === 'TERMINADA' ? 'TERMINADA / COMPLETA' : 'ACTIVA / EN CURSO'}</strong></div>
              <div>FECHA: ${new Date().toLocaleDateString('es-CO')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 18%;">TIPO Y CONSECUTIVO</th>
                <th style="width: 16%; text-align: left;">CÓDIGO</th>
                <th style="width: 38%; text-align: left;">NOMBRE DEL PRODUCTO</th>
                <th style="width: 16%;">CONTENIDO EN ESTE BULTO</th>
                <th style="width: 12%;">QR INDIVIDUAL</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 32px; display: flex; justify-content: space-between; gap: 30px; font-size: 12px; font-weight: 700;">
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              ENTREGADO POR (ÁREA DE EMPAQUE)
            </div>
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              RECIBIDO EN DESPACHOS (EN ESPERA DE SALIDA)
            </div>
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              VERIFICACIÓN CLIENTE / INSTALACIÓN
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const enrichedHistoryLists = useMemo(() => {
    const q = historySearchTerm.trim().toUpperCase();
    return (packingLists || [])
      .map((list) => {
        const pedNum = String(list.pedidoNum || '').trim().toUpperCase();
        const plantOrdersForPed = (orders || []).filter(
          (o) => o && String(o.pedidoNum || '').trim().toUpperCase() === pedNum
        );

        const pendingOtherAreas = plantOrdersForPed.filter(
          (o) => !isOrderStrictlyInEmpaque(o) && !isOrderInDespachosOrDispatched(o)
        );
        const inEmpaqueNow = plantOrdersForPed.filter((o) => isOrderStrictlyInEmpaque(o));
        const inDespachosOrDone = plantOrdersForPed.filter((o) =>
          isOrderInDespachosOrDispatched(o)
        );

        const pkgCount = Array.isArray(list.packages) ? list.packages.length : 0;
        const totalPackedUnits = (list.packages || []).reduce(
          (acc, p) =>
            acc +
            (p.items || []).reduce(
              (s, it) =>
                s +
                (it.esSubpaqueteAdicional
                  ? 0
                  : Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
              0
            ),
          0
        );

        const isTerminada = list.estadoLista === 'TERMINADA';

        return {
          ...list,
          pkgCount,
          totalPackedUnits,
          totalPlantItems: plantOrdersForPed.length,
          pendingOtherAreasCount: pendingOtherAreas.length,
          inEmpaqueNowCount: inEmpaqueNow.length,
          inDespachosOrDoneCount: inDespachosOrDone.length,
          isTerminada
        };
      })
      .filter((item) => {
        if (historyStatusFilter === 'TERMINADAS' && !item.isTerminada) return false;
        if (historyStatusFilter === 'ACTIVAS' && item.isTerminada) return false;
        if (!q) return true;
        return (
          String(item.pedidoNum || '').toUpperCase().includes(q) ||
          String(item.cliente || '').toUpperCase().includes(q)
        );
      });
  }, [packingLists, orders, historySearchTerm, historyStatusFilter]);

  return (
    <>
      <MinimizedWindowDock
        isMinimized={isMinimized}
        title="Lista de Empaque"
        subtitle={
          activePackingList
            ? `Pedido #${activePackingList.pedidoNum} • En segundo plano`
            : 'Bultos y QR en segundo plano'
        }
        icon={Package}
        accentClass="bg-amber-500 text-slate-950"
        onRestore={() => setIsMinimized(false)}
        onClose={() => setShowPackingListsModal(false)}
      />

      <div
        className={`${
          isMinimized
            ? 'hidden'
            : 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center overflow-hidden'
        } ${isMaximized ? 'p-0' : 'p-2 md:p-5'}`}
      >
        <div
          className={`bg-[var(--color-base)] border-2 border-[var(--color-border)] flex flex-col overflow-hidden transition-all duration-200 ${
            isMaximized
              ? 'w-screen h-screen rounded-none'
              : 'w-[90vw] h-[85vh] rounded-2xl shadow-2xl'
          }`}
        >
          {/* CABECERA PRINCIPAL: CONTROLES DE VENTANA FIJOS EN LA ESQUINA SUPERIOR DERECHA DE LA VENTANA */}
          <div className="bg-[var(--color-surface)] border-b-2 border-[var(--color-border)] px-4 md:px-6 py-3.5 flex flex-col gap-3 shrink-0">
            {/* FILA SUPERIOR: TÍTULO A LA IZQUIERDA + PESTAÑAS Y CONTROLES DE VENTANA EN ESQUINA SUPERIOR DERECHA */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border-2 border-amber-500/50 flex items-center justify-center text-amber-500 shadow-inner shrink-0">
                  <Package size={26} strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight theme-text-main">
                      Módulo de Lista de Empaque y Fraccionamiento de Bultos / QR
                    </h2>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-600 text-white border border-emerald-400 shadow-sm">
                      Trazabilidad de Pedido Completo + QR
                    </span>
                  </div>
                  <p className="text-xs md:text-sm theme-text-muted font-bold mt-0.5">
                    Organiza bultos en EMPAQUE, divide productos grandes en subpaquetes o cantidades en lotes y consulta el historial.
                  </p>
                </div>
              </div>

              {/* ESQUINA SUPERIOR DERECHA DE LA VENTANA: SELECTOR DE VISTA + BARRA DE MINIMIZAR / AMPLIAR / CERRAR */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 bg-[var(--color-base)] p-1.5 rounded-2xl border-2 border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setConsultingClosedListId(null);
                      setMainViewTab('ACTIVAS');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-2 ${
                      mainViewTab === 'ACTIVAS'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-[var(--color-surface)] theme-text-main border-[var(--color-border)] hover:border-amber-500 hover:bg-amber-500/15'
                    }`}
                  >
                    <Package size={17} />
                    <span>Mesa de Empaque ({activeWorkingLists.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConsultingClosedListId(null);
                      setMainViewTab('HISTORIAL');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black uppercase flex items-center gap-2 transition-all cursor-pointer border-2 ${
                      mainViewTab === 'HISTORIAL'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-[var(--color-surface)] theme-text-main border-[var(--color-border)] hover:border-indigo-500 hover:bg-indigo-500/15'
                    }`}
                  >
                    <History size={17} />
                    <span>Historial de Listas ({(packingLists || []).length})</span>
                  </button>
                </div>

                <WindowControls
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                  onMinimize={() => setIsMinimized(true)}
                  onClose={() => setShowPackingListsModal(false)}
                />
              </div>
            </div>

            {/* FILA INFERIOR DE CABECERA: BUSCADOR DE PEDIDOS EN EMPAQUE */}
            <div className="flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2.5 relative">
                <div className="relative">
                  <div className="flex items-center bg-[var(--color-base)] border-2 border-amber-500/80 rounded-xl px-3.5 py-2 focus-within:border-amber-400">
                    <Search size={18} className="text-amber-600 dark:text-amber-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchPedidoInput}
                      onFocus={() => setShowNewListDropdown(true)}
                      onChange={(e) => {
                        setSearchPedidoInput(e.target.value);
                        setShowNewListDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchPedidoInput.trim()) {
                          handleCreateOrOpenPackingList(searchPedidoInput);
                        }
                      }}
                      placeholder="Pedido en Empaque (ej. 63577)..."
                      className="bg-transparent text-sm md:text-base font-bold theme-text-main placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none w-48 md:w-60"
                    />
                    {searchPedidoInput && (
                      <button
                        type="button"
                        onClick={() => setSearchPedidoInput('')}
                        className="theme-text-main hover:text-red-500 ml-1"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {showNewListDropdown && (
                    <div className="absolute left-0 mt-2 w-88 md:w-[420px] max-h-96 overflow-y-auto bg-[var(--color-surface)] border-2 border-amber-500 rounded-2xl shadow-2xl z-50 p-3">
                      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--color-border)] mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Pedidos con productos en Área EMPAQUE ({filteredOrderSuggestions.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNewListDropdown(false)}
                          className="text-xs md:text-sm font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 theme-text-main hover:bg-red-500 hover:text-white"
                        >
                          Cerrar
                        </button>
                      </div>

                      {filteredOrderSuggestions.length === 0 ? (
                        <div className="p-4 text-sm font-bold theme-text-main text-center">
                          No hay pedidos con productos actualmente en el área de <strong>EMPAQUE</strong>.
                        </div>
                      ) : (
                        filteredOrderSuggestions.map((sug) => {
                          const alreadyOpen = activeWorkingLists.some(
                            (l) => l.pedidoNum === sug.pedidoNum
                          );
                          return (
                            <button
                              key={sug.pedidoNum}
                              type="button"
                              onClick={() =>
                                handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)
                              }
                              className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-amber-500/15 transition-colors flex items-center justify-between gap-2 border-b border-[var(--color-border)]/60 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-base text-amber-700 dark:text-amber-400">
                                    #{sug.pedidoNum}
                                  </span>
                                  <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/40">
                                    {sug.empaqueItemsCount} de {sug.totalOrderItemsInPlant} prod en EMPAQUE
                                  </span>
                                </div>
                                <div className="text-xs md:text-sm font-bold theme-text-main truncate mt-0.5">
                                  {sug.cliente}
                                </div>
                              </div>
                              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 border border-amber-400 shrink-0 shadow-sm">
                                {alreadyOpen ? 'Abrir' : '+ Iniciar'}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewListDropdown((prev) => !prev)}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-lg border-2 border-amber-400 transition-all cursor-pointer"
                >
                  <Plus size={17} strokeWidth={2.8} />
                  <span>Pedidos en Empaque</span>
                </button>
              </div>
            </div>
          </div>

          {/* ==================================================================================== */}
          {/* VISTA 2: HISTORIAL DE LISTAS DE EMPAQUE CREADAS Y TERMINADAS                         */}
          {/* ==================================================================================== */}
          {mainViewTab === 'HISTORIAL' ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
              <div className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-xl font-black uppercase theme-text-main flex items-center gap-2.5">
                      <History className="text-indigo-600 dark:text-indigo-400" size={24} />
                      <span>Archivo e Historial de Listas de Empaque Creadas y Terminadas</span>
                    </h3>
                    <p className="text-sm font-bold theme-text-muted mt-1">
                      Consulta todas las listas de empaque elaboradas, verifica cuántos productos se han empacado o faltan por llegar, reimprime documentos o reabre una lista activa.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3.5 py-2">
                      <Search size={17} className="theme-text-muted mr-2" />
                      <input
                        type="text"
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                        placeholder="Buscar # pedido o cliente..."
                        className="bg-transparent text-sm font-bold theme-text-main placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none w-52"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-[var(--color-base)] p-1.5 rounded-xl border-2 border-[var(--color-border)]">
                      {[
                        { id: 'TODAS', label: `Todas (${(packingLists || []).length})` },
                        {
                          id: 'ACTIVAS',
                          label: `Activas / Parciales (${activeWorkingLists.length})`
                        },
                        {
                          id: 'TERMINADAS',
                          label: `Terminadas (${
                            (packingLists || []).filter((l) => l.estadoLista === 'TERMINADA')
                              .length
                          })`
                        }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setHistoryStatusFilter(tab.id)}
                          className={`px-3.5 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all cursor-pointer border ${
                            historyStatusFilter === tab.id
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow'
                              : 'bg-[var(--color-surface)] theme-text-main border-[var(--color-border)] hover:border-indigo-500'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {enrichedHistoryLists.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[var(--color-base)] border-2 border-[var(--color-border)]">
                    <History size={42} className="mx-auto mb-2.5 theme-text-muted" />
                    <div className="text-base font-black uppercase theme-text-main">
                      No se encontraron listas de empaque en el historial con este filtro
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {enrichedHistoryLists.map((list) => (
                      <div
                        key={list.id}
                        className={`rounded-2xl border-2 p-5 flex flex-col justify-between gap-4 transition-all shadow-md ${
                          list.isTerminada
                            ? 'bg-[var(--color-base)] border-emerald-500/70'
                            : 'bg-[var(--color-base)] border-amber-500/70'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                                  PEDIDO #{list.pedidoNum}
                                </span>
                                {list.isTerminada ? (
                                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-600 text-white border border-emerald-400">
                                    ✓ Lista Terminada
                                  </span>
                                ) : (
                                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500 text-slate-950 border border-amber-400">
                                    ⏳ Activa / En Curso
                                  </span>
                                )}
                              </div>
                              <div className="text-sm font-extrabold theme-text-main mt-1">
                                {list.cliente}
                              </div>
                            </div>

                            <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-300 font-black text-xs md:text-sm border border-amber-500/50 shrink-0">
                              {list.pkgCount} {list.pkgCount === 1 ? 'Bulto QR' : 'Bultos QR'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)] text-center">
                            <div>
                              <div className="text-xs font-bold theme-text-muted uppercase">
                                Unds en Bultos
                              </div>
                              <div className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                                {list.totalPackedUnits} unds
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-bold theme-text-muted uppercase">
                                En Empaque Hoy
                              </div>
                              <div className="text-base font-black text-amber-700 dark:text-amber-400 mt-0.5">
                                {list.inEmpaqueNowCount} prod
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-bold theme-text-muted uppercase">
                                Faltan por Llegar
                              </div>
                              <div
                                className={`text-base font-black mt-0.5 ${
                                  list.pendingOtherAreasCount > 0
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {list.pendingOtherAreasCount} prod
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-bold theme-text-muted flex items-center justify-between">
                            <span>
                              Actualizado:{' '}
                              {list.actualizadoEn
                                ? new Date(list.actualizadoEn).toLocaleString('es-CO')
                                : 'Reciente'}
                            </span>
                            <span>Por: {list.creadoPor || 'Empaque'}</span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenOrConsultFromHistory(list)}
                            className="flex-1 py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow"
                          >
                            <Eye size={16} />
                            <span>
                              {list.isTerminada ? 'Consultar / Abrir' : 'Continuar Empaque'}
                            </span>
                          </button>

                          {list.isTerminada && (
                            <button
                              type="button"
                              onClick={() => handleReopenPackingList(list)}
                              className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-indigo-400 font-black text-xs md:text-sm uppercase flex items-center gap-1.5 cursor-pointer shadow"
                              title="Reactivar lista de empaque como Activa"
                            >
                              <RotateCcw size={15} />
                              <span>Reactivar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePrint('LISTA_COMPLETA', null, list)}
                            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-600 cursor-pointer"
                            title="Imprimir Lista de Empaque Oficial"
                          >
                            <Printer size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrint('ROTULOS_QR', null, list)}
                            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-indigo-400 cursor-pointer"
                            title="Imprimir Etiquetas QR de esta Lista"
                          >
                            <QrCode size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ==================================================================================== */
            /* VISTA 1: MESA DE TRABAJO DE LISTAS DE EMPAQUE ACTIVAS                                */
            /* ==================================================================================== */
            <>
              <div className="bg-[var(--color-surface)]/80 border-b-2 border-[var(--color-border)] px-4 md:px-6 py-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setIsTabsExpanded(!isTabsExpanded)}
                    className="flex items-center gap-2 text-xs md:text-sm font-black uppercase tracking-wider theme-text-main hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
                  >
                    <FolderOpen size={17} className="text-amber-600 dark:text-amber-400" />
                    <span>
                      Listas de Empaque en Mesa de Trabajo ({activeWorkingLists.length})
                    </span>
                    {isTabsExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultingClosedListId(null);
                      setMainViewTab('HISTORIAL');
                    }}
                    className="px-3 py-1 rounded-xl bg-indigo-600/15 dark:bg-indigo-600/25 border border-indigo-500/50 text-xs md:text-sm font-black uppercase text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <History size={16} />
                    <span>Ver Historial Completo de Listas ({(packingLists || []).length})</span>
                  </button>
                </div>

                {isTabsExpanded && (
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                    {activeWorkingLists.length === 0 ? (
                      <div className="text-sm font-bold theme-text-main py-2.5 px-4 rounded-xl bg-[var(--color-base)] border-2 border-dashed border-[var(--color-border)]">
                        No hay listas de empaque activas abiertas en este momento. Selecciona arriba un pedido con productos en{' '}
                        <strong>EMPAQUE</strong> o consulta listas cerradas en el{' '}
                        <strong>Historial de Listas</strong>.
                      </div>
                    ) : (
                      activeWorkingLists.map((list) => {
                        const isActive =
                          !consultingClosedListId && activePackingList?.id === list.id;
                        const pkgCount = Array.isArray(list.packages) ? list.packages.length : 0;
                        const totalPackedUnits = (list.packages || []).reduce(
                          (acc, p) =>
                            acc +
                            (p.items || []).reduce(
                              (s, it) =>
                                s +
                                (it.esSubpaqueteAdicional
                                  ? 0
                                  : Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
                              0
                            ),
                          0
                        );

                        return (
                          <div
                            key={list.id}
                            onClick={() => {
                              setConsultingClosedListId(null);
                              setActiveListId(list.id);
                            }}
                            className={`group cursor-pointer rounded-2xl px-4 py-2.5 border-2 transition-all flex items-center gap-3.5 shrink-0 ${
                              isActive
                                ? 'bg-amber-500/20 border-amber-500 theme-text-main shadow-md'
                                : 'bg-[var(--color-base)] border-[var(--color-border)] theme-text-main hover:border-amber-500'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-base text-amber-700 dark:text-amber-400">
                                  PEDIDO #{list.pedidoNum}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-900 text-amber-300 border border-amber-500/50">
                                  {pkgCount} {pkgCount === 1 ? 'Bulto QR' : 'Bultos QR'}
                                </span>
                              </div>
                              <div className="text-xs md:text-sm font-extrabold truncate max-w-[200px] theme-text-main mt-0.5">
                                {list.cliente}
                              </div>
                              <div className="text-xs theme-text-muted font-bold">
                                {totalPackedUnits} unds en bultos
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePackingList(list, e)}
                              title="Eliminar esta lista de empaque"
                              className="text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-600 hover:text-white border border-red-500/30 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {!activePackingList ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/50 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                    <Package size={44} />
                  </div>
                  <h3 className="text-2xl font-black uppercase theme-text-main mb-2">
                    Pedidos Disponibles en el Área de EMPAQUE
                  </h3>
                  <p className="text-base font-bold theme-text-muted max-w-xl mb-6">
                    Selecciona un pedido para empacar sus productos en <strong>EMPAQUE</strong> y visualizar al mismo tiempo cuántos productos de ese pedido faltan por llegar desde otras áreas de la planta.
                  </p>
                  {eligibleEmpaqueOrdersSummary.length === 0 ? (
                    <div className="px-6 py-5 rounded-2xl bg-[var(--color-surface)] border-2 border-[var(--color-border)] text-sm font-bold theme-text-main max-w-md">
                      Actualmente no hay ningún producto ubicado en el área de{' '}
                      <strong>EMPAQUE</strong>. Puedes consultar listas anteriores en la pestaña{' '}
                      <strong>Historial de Listas</strong> arriba.
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-3 max-w-3xl">
                      {eligibleEmpaqueOrdersSummary.map((sug) => (
                        <button
                          key={sug.pedidoNum}
                          type="button"
                          onClick={() =>
                            handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)
                          }
                          className="px-5 py-3.5 rounded-2xl bg-[var(--color-surface)] hover:bg-amber-500/15 border-2 border-[var(--color-border)] hover:border-amber-500 transition-all text-left shadow cursor-pointer"
                        >
                          <div className="font-black text-base text-amber-700 dark:text-amber-400">
                            Pedido #{sug.pedidoNum}
                          </div>
                          <div className="text-sm font-extrabold theme-text-main truncate max-w-[220px]">
                            {sug.cliente}
                          </div>
                          <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                            {sug.empaqueItemsCount} de {sug.totalOrderItemsInPlant} prod en EMPAQUE ({sug.empaqueTotalUnits} unds)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
                  {consultingClosedListId && activePackingList.estadoLista === 'TERMINADA' && (
                    <div className="bg-indigo-900 border-2 border-indigo-400 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white shadow-md">
                      <div className="flex items-center gap-2.5 text-xs md:text-sm font-black uppercase text-white">
                        <Eye size={18} className="text-amber-300 shrink-0" />
                        <span>
                          Consultando Lista de Empaque Cerrada del Historial (Pedido #{activePackingList.pedidoNum}) — No permanece abierta en la Mesa de Trabajo
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConsultingClosedListId(null);
                          setMainViewTab('HISTORIAL');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer shadow"
                      >
                        ← Volver al Historial de Listas
                      </button>
                    </div>
                  )}

                  {/* BARRA DE RESUMEN DEL PEDIDO COMPLETO Y BOTONES DE ACCIÓN GRANDES Y VISIBLES */}
                  <div className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl p-5 shadow-lg space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-2xl md:text-3xl font-black text-amber-700 dark:text-amber-400">
                            PEDIDO #{activePackingList.pedidoNum}
                          </span>
                          <span className="text-base md:text-lg font-black theme-text-main uppercase">
                            • {activePackingList.cliente}
                          </span>
                          {activePackingList.estadoLista === 'TERMINADA' ? (
                            <span className="px-3.5 py-1 rounded-full text-xs md:text-sm font-black uppercase bg-emerald-600 text-white border-2 border-emerald-400">
                              ✓ Lista de Empaque Terminada
                            </span>
                          ) : (
                            <span className="px-3.5 py-1 rounded-full text-xs md:text-sm font-black uppercase bg-amber-500 text-slate-950 border-2 border-amber-400">
                              ⏳ Lista de Empaque Activa
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold theme-text-muted mt-1">
                          Bultos físicos generados con QR individual:{' '}
                          <strong className="text-amber-700 dark:text-amber-400">
                            {(activePackingList.packages || []).length} bultos (
                            {packingStats.totalUnidadesEmpacadas} unds empacadas)
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {completedEmpaqueProductsReadyForDispatch.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleTransferToDespachos(
                                completedEmpaqueProductsReadyForDispatch
                              )
                            }
                            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-lg border-2 border-emerald-300 transition-all animate-pulse cursor-pointer"
                          >
                            <Truck size={18} />
                            <span>
                              Transferir {completedEmpaqueProductsReadyForDispatch.length}{' '}
                              Producto(s) a DESPACHOS
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePrint('ROTULOS_QR')}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-md border-2 border-indigo-400 transition-all cursor-pointer"
                        >
                          <QrCode size={18} />
                          <span>
                            Imprimir {(activePackingList.packages || []).length} Etiquetas QR
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrint('LISTA_COMPLETA')}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-md border-2 border-slate-600 transition-all cursor-pointer"
                        >
                          <Printer size={18} />
                          <span>Imprimir Lista de Empaque</span>
                        </button>

                        {activePackingList.estadoLista === 'TERMINADA' ? (
                          <button
                            type="button"
                            onClick={() => handleReopenPackingList(activePackingList)}
                            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-md border-2 border-amber-300 transition-all cursor-pointer"
                          >
                            <RotateCcw size={18} />
                            <span>Reactivar Lista</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAttemptClosePackingList}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer border-2 border-emerald-400"
                            title="Verifica si el pedido está completo o si aún faltan productos por despachar"
                          >
                            <CheckCircle2 size={18} />
                            <span>Cerrar / Finalizar Lista de Empaque</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 TARJETAS DE PANORAMA DEL PEDIDO COMPLETO CON LETRA Y BORDES MÁS VISIBLES */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      <div className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-2xl p-3.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black uppercase theme-text-muted">
                            Total Productos del Pedido
                          </div>
                          <div className="text-xl font-black theme-text-main mt-0.5">
                            {orderPanorama.totalOrderItemsCount} productos
                          </div>
                          <div className="text-xs md:text-sm font-bold theme-text-muted">
                            {orderPanorama.totalOrderUnitsCount} unidades totales
                          </div>
                        </div>
                        <Package className="theme-text-muted" size={30} />
                      </div>

                      <div className="bg-[var(--color-base)] border-2 border-emerald-500/70 rounded-2xl p-3.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">
                            Ya Empacados / En Despachos
                          </div>
                          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {orderPanorama.packedOrDispatchedItemsCount +
                              completedEmpaqueProductsReadyForDispatch.length}{' '}
                            productos
                          </div>
                          <div className="text-xs md:text-sm font-bold text-emerald-800 dark:text-emerald-300">
                            {(activePackingList.packages || []).length} bultos QR (
                            {packingStats.totalUnidadesEmpacadas} unds)
                          </div>
                        </div>
                        <CheckCircle className="text-emerald-600 dark:text-emerald-400" size={30} />
                      </div>

                      <div className="bg-[var(--color-base)] border-2 border-amber-500/70 rounded-2xl p-3.5 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">
                            En Área EMPAQUE (Por Empacar)
                          </div>
                          <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5">
                            {pendingEmpaqueProducts.length} productos
                          </div>
                          <div className="text-xs md:text-sm font-bold text-amber-800 dark:text-amber-300">
                            {packingStats.totalUnidadesPendientes} unds listas para empacar
                          </div>
                        </div>
                        <Calculator className="text-amber-600 dark:text-amber-400" size={30} />
                      </div>

                      <div
                        onClick={() => setIsPendingArrivalExpanded(true)}
                        className={`rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all border-2 ${
                          orderPanorama.pendingArrivalItems.length > 0
                            ? 'bg-rose-500/10 dark:bg-rose-950/40 border-rose-500 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500'
                        }`}
                        title="Haz clic para ver qué productos faltan por llegar a Empaque y en qué área están"
                      >
                        <div>
                          <div
                            className={`text-xs font-black uppercase ${
                              orderPanorama.pendingArrivalItems.length > 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            Faltan por Llegar a Empaque
                          </div>
                          <div
                            className={`text-xl font-black mt-0.5 ${
                              orderPanorama.pendingArrivalItems.length > 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {orderPanorama.pendingArrivalItems.length} productos
                          </div>
                          <div className="text-xs md:text-sm font-bold theme-text-main">
                            {orderPanorama.pendingArrivalItems.length > 0
                              ? `En ${orderPanorama.pendingByAreaList.length} área(s) de planta`
                              : '✓ 100% ya llegó a Empaque'}
                          </div>
                        </div>
                        <MapPin
                          className={
                            orderPanorama.pendingArrivalItems.length > 0
                              ? 'text-rose-400 animate-bounce'
                              : 'text-emerald-400'
                          }
                          size={30}
                        />
                      </div>
                    </div>

                    <div className="w-full bg-slate-800/80 h-3 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className={`h-full transition-all duration-300 ${
                          packingStats.pctUnidades === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${packingStats.pctUnidades}%` }}
                      />
                    </div>
                  </div>

                  {/* ==================================================================================== */}
                  {/* SECCIÓN 1: PRODUCTOS EN ÁREA 'EMPAQUE' CON INTERFAZ LIMPIA Y OPCIONES BAJO DEMANDA   */}
                  {/* ==================================================================================== */}
                  <div className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-5 py-3.5 bg-amber-500/10 border-b-2 border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Calculator size={22} className="text-amber-400" />
                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider theme-text-main">
                          1. Productos en Área 'EMPAQUE' Pendientes por Asignar a Bultos / Guacales ({pendingEmpaqueProducts.length})
                        </h3>
                      </div>
                      <input
                        type="text"
                        value={filterProductSearch}
                        onChange={(e) => setFilterProductSearch(e.target.value)}
                        placeholder="Filtrar por código o nombre..."
                        className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3.5 py-1.5 text-sm font-bold theme-text-main focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="p-4 md:p-5 space-y-4">
                      {pendingEmpaqueProducts.length === 0 ? (
                        <div className="p-7 rounded-2xl bg-[var(--color-base)] border-2 border-[var(--color-border)] text-center space-y-2.5">
                          <CheckCircle size={38} className="text-emerald-400 mx-auto" />
                          <div className="text-base md:text-lg font-black uppercase theme-text-main">
                            No hay productos pendientes por empacar actualmente en el área 'EMPAQUE'
                          </div>
                          <p className="text-sm font-bold theme-text-muted max-w-2xl mx-auto">
                            Todos los productos que ya habían ingresado a <strong>EMPAQUE</strong> tienen sus bultos generados.
                            {orderPanorama.pendingArrivalItems.length > 0 && (
                              <span className="text-rose-400 font-black block mt-1.5 text-sm md:text-base">
                                ⚠️ Atención: Aún faltan {orderPanorama.pendingArrivalItems.length} producto(s) de este pedido por llegar a Empaque desde otras áreas (ver Sección 2 abajo).
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        pendingEmpaqueProducts.map((prod) => {
                          const calc = itemCalculators[prod.itemKey] || {
                            openPanel: null,
                            mode: 'LOTES_IGUALES',
                            tipoEmpaque: 'Paquete',
                            numBultos: 1,
                            undsPorBulto: prod.cantidadPendiente,
                            numSubpaquetes: 2,
                            unidadesParaSubpaquetes: 1,
                            manualQty: prod.cantidadPendiente,
                            targetPkgId: 'NUEVO',
                            observaciones: ''
                          };

                          const numBultos = Math.max(0, Math.floor(Number(calc.numBultos) || 0));
                          const undsPorBulto = Math.max(
                            0,
                            Math.floor(Number(calc.undsPorBulto) || 0)
                          );
                          const manualQty = Math.max(0, Math.floor(Number(calc.manualQty) || 0));
                          const numSubpaquetes = Math.max(
                            2,
                            Math.floor(Number(calc.numSubpaquetes) || 2)
                          );

                          const totalUnitsToAssign =
                            calc.openPanel === 'SUBPAQUETES'
                              ? Math.max(
                                  1,
                                  Math.min(
                                    prod.cantidadPendiente,
                                    Math.floor(Number(calc.unidadesParaSubpaquetes) || 1)
                                  )
                                )
                              : calc.openPanel === 'AGRUPACION_MANUAL'
                              ? manualQty
                              : numBultos * undsPorBulto;

                          const exceedsBalance = totalUnitsToAssign > prod.cantidadPendiente;
                          const isZeroOrInvalid = totalUnitsToAssign <= 0;
                          const isValidMath = !exceedsBalance && !isZeroOrInvalid;

                          return (
                            <div
                              key={prod.itemKey}
                              className="rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-base)] p-4 md:p-5 shadow-md space-y-4"
                            >
                              {/* ENCABEZADO DEL PRODUCTO CON LETRA GRANDE Y CLARA */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--color-border)] pb-3.5">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="font-mono text-sm md:text-base font-black px-3 py-1.5 rounded-xl bg-slate-900 text-amber-300 border-2 border-amber-500/50">
                                    {prod.codArticulo}
                                  </span>
                                  <span className="text-base md:text-lg font-black theme-text-main">
                                    {prod.nombre}
                                  </span>
                                  <span className="px-3 py-1 rounded-lg text-xs font-black uppercase bg-emerald-600 text-white border border-emerald-400">
                                    📍 Área Actual: EMPAQUE
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <div className="px-3.5 py-2 rounded-xl bg-[var(--color-surface)] border-2 border-amber-500/60 text-xs md:text-sm font-black">
                                    <span className="theme-text-muted">Empacado: </span>
                                    <span className="text-emerald-700 dark:text-emerald-400">
                                      {prod.cantidadEmpacada}
                                    </span>
                                    <span className="theme-text-muted"> / Total: </span>
                                    <span className="theme-text-main">
                                      {prod.cantidadTotalPedido} unidades
                                    </span>
                                  </div>
                                  <div className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 border-2 border-amber-400 text-xs md:text-sm font-black shadow-sm">
                                    Saldo Pendiente: {prod.cantidadPendiente} unds
                                  </div>
                                </div>
                              </div>

                              {/* BARRA PRINCIPAL LIMPIA (SIN SOBRECARGAR): TIPO DE EMBALAJE + BOTONES RÁPIDOS + BOTONES PARA ABRIR DIVISIÓN */}
                              <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)] p-3.5 rounded-2xl border-2 border-[var(--color-border)]">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div>
                                    <label className="block text-xs font-black uppercase theme-text-muted mb-1">
                                      Tipo de Embalaje
                                    </label>
                                    <select
                                      value={calc.tipoEmpaque}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          tipoEmpaque: e.target.value
                                        })
                                      }
                                      className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-black theme-text-main cursor-pointer"
                                    >
                                      <option value="Paquete">Paquete</option>
                                      <option value="Guacal">Guacal</option>
                                      <option value="Caja">Caja</option>
                                      <option value="Estiba">Estiba</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-black uppercase theme-text-muted mb-1">
                                      Nota / Observación (Opcional)
                                    </label>
                                    <input
                                      type="text"
                                      value={calc.observaciones}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          observaciones: e.target.value
                                        })
                                      }
                                      placeholder="Ej. Frágil / Con herrajes..."
                                      className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm font-bold theme-text-main placeholder:text-slate-500 dark:placeholder:text-slate-400 w-52 md:w-64"
                                    />
                                  </div>
                                </div>

                                {/* BOTONES DE ACCIÓN DIRECTA (1 CLIC) */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGenerateBultosForItem(prod, {
                                        mode: 'LOTES_IGUALES',
                                        numBultos: 1,
                                        undsPorBulto: prod.cantidadPendiente
                                      })
                                    }
                                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm uppercase flex items-center gap-2 shadow-md border-2 border-amber-300 transition-all cursor-pointer"
                                  >
                                    <QrCode size={17} />
                                    <span>
                                      📦 Empacar Todo en 1 {calc.tipoEmpaque} ({prod.cantidadPendiente} unds)
                                    </span>
                                  </button>

                                  {prod.cantidadPendiente > 1 && prod.cantidadPendiente <= 50 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleGenerateBultosForItem(prod, {
                                          mode: 'LOTES_IGUALES',
                                          numBultos: prod.cantidadPendiente,
                                          undsPorBulto: 1
                                        })
                                      }
                                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs md:text-sm uppercase flex items-center gap-2 shadow-md border-2 border-indigo-400 transition-all cursor-pointer"
                                    >
                                      <SplitSquareVertical size={17} />
                                      <span>
                                        ⚡ 1 {calc.tipoEmpaque} por Unidad ({prod.cantidadPendiente} bultos × 1 und)
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* BOTONES PARA HABILITAR OPCIONES DE DIVISIÓN SOLO CUANDO SE NECESITEN (ALTO CONTRASTE ESTÁTICO) */}
                              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                                <span className="text-xs md:text-sm font-black uppercase theme-text-main mr-1">
                                  Opciones de División Especial:
                                </span>

                                {/* OPCIÓN 1: SEPARAR 1 PRODUCTO GRANDE EN SUBPAQUETES / PARTES */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCalc(prod.itemKey, {
                                      openPanel:
                                        calc.openPanel === 'SUBPAQUETES' ? null : 'SUBPAQUETES',
                                      mode: 'SUBPAQUETES',
                                      numSubpaquetes: calc.numSubpaquetes || 2,
                                      unidadesParaSubpaquetes: 1
                                    })
                                  }
                                  className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black uppercase flex items-center gap-2 border-2 transition-all cursor-pointer shadow-sm ${
                                    calc.openPanel === 'SUBPAQUETES'
                                      ? 'bg-purple-600 text-white border-purple-300 shadow-lg'
                                      : 'bg-purple-600/15 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-500/70 hover:bg-purple-600 hover:text-white'
                                  }`}
                                >
                                  <Boxes size={16} />
                                  <span>
                                    🧩 Separar Producto Grande en Subpaquetes / Partes
                                  </span>
                                </button>

                                {/* OPCIÓN 2: SOLO SE HABILITA CUANDO EL PRODUCTO TIENE VARIAS CANTIDADES (Ej. 500 flautas -> 10 paquetes de 50) */}
                                {prod.cantidadPendiente > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const defaultUndsPorPaquete =
                                        prod.cantidadPendiente >= 10
                                          ? Math.ceil(prod.cantidadPendiente / 2)
                                          : 1;
                                      const defaultPaquetes = Math.max(
                                        1,
                                        Math.floor(prod.cantidadPendiente / defaultUndsPorPaquete)
                                      );
                                      updateItemCalc(prod.itemKey, {
                                        openPanel:
                                          calc.openPanel === 'LOTES_IGUALES'
                                            ? null
                                            : 'LOTES_IGUALES',
                                        mode: 'LOTES_IGUALES',
                                        numBultos: defaultPaquetes,
                                        undsPorBulto: defaultUndsPorPaquete
                                      });
                                    }}
                                    className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black uppercase flex items-center gap-2 border-2 transition-all cursor-pointer shadow-sm ${
                                      calc.openPanel === 'LOTES_IGUALES'
                                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg'
                                        : 'bg-amber-500/20 dark:bg-amber-950/70 text-amber-950 dark:text-amber-200 border-amber-500/80 hover:bg-amber-500 hover:text-slate-950'
                                    }`}
                                  >
                                    <SplitSquareVertical size={16} />
                                    <span>
                                      ➗ Dividir {prod.cantidadPendiente} Unidades en Varios Paquetes (Ej. X paquetes de Y unds)
                                    </span>
                                  </button>
                                )}

                                {/* OPCIÓN 3: AGRUPAR EN CAJA / GUACAL MIXTO */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateItemCalc(prod.itemKey, {
                                      openPanel:
                                        calc.openPanel === 'AGRUPACION_MANUAL'
                                          ? null
                                          : 'AGRUPACION_MANUAL',
                                      mode: 'AGRUPACION_MANUAL'
                                    })
                                  }
                                  className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black uppercase flex items-center gap-2 border-2 transition-all cursor-pointer shadow-sm ${
                                    calc.openPanel === 'AGRUPACION_MANUAL'
                                      ? 'bg-sky-600 text-white border-sky-300 shadow-lg'
                                      : 'bg-sky-600/15 dark:bg-sky-950/70 text-sky-900 dark:text-sky-200 border-sky-500/70 hover:bg-sky-600 hover:text-white'
                                  }`}
                                >
                                  <Layers size={16} />
                                  <span>➕ Agrupar en Caja / Guacal Mixto</span>
                                </button>
                              </div>

                              {/* PANEL DESPLEGABLE 1: SEPARAR 1 PRODUCTO GRANDE EN SUBPAQUETES (MUEBLE GRANDE DESARMADO) */}
                              {calc.openPanel === 'SUBPAQUETES' && (
                                <div className="bg-purple-500/10 dark:bg-purple-950/40 border-2 border-purple-500 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm md:text-base font-black text-purple-800 dark:text-purple-200 uppercase flex items-center gap-2">
                                      <Boxes size={18} />
                                      <span>
                                        Dividir 1 Producto Grande en Múltiples Subpaquetes con QR Individual
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItemCalc(prod.itemKey, { openPanel: null })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-black uppercase theme-text-main hover:bg-red-600 hover:text-white cursor-pointer"
                                    >
                                      Ocultar ✕
                                    </button>
                                  </div>

                                  <p className="text-xs md:text-sm font-bold theme-text-main">
                                    Ideal cuando un mueble o estructura grande se desarma en varias partes o paquetes físicos. Se generará 1 etiqueta QR por cada subpaquete (Subpaquete 1 de N, 2 de N...).
                                  </p>

                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                                    <div className="md:col-span-4">
                                      <label className="block text-xs md:text-sm font-black uppercase text-purple-800 dark:text-purple-200 mb-1">
                                        ¿En cuántos paquetes / partes vas a dividir este producto?
                                      </label>
                                      <input
                                        type="number"
                                        min={2}
                                        max={50}
                                        value={calc.numSubpaquetes ?? 2}
                                        onChange={(e) =>
                                          updateItemCalc(prod.itemKey, {
                                            numSubpaquetes: e.target.value,
                                            mode: 'SUBPAQUETES'
                                          })
                                        }
                                        className="w-full bg-[var(--color-base)] border-2 border-purple-500 rounded-xl px-3.5 py-2.5 text-base font-black theme-text-main text-center"
                                      />
                                    </div>

                                    <div className="md:col-span-4">
                                      <label className="block text-xs md:text-sm font-black uppercase theme-text-main mb-1">
                                        Detalle de las partes (Opcional)
                                      </label>
                                      <input
                                        type="text"
                                        value={calc.observaciones}
                                        onChange={(e) =>
                                          updateItemCalc(prod.itemKey, {
                                            observaciones: e.target.value
                                          })
                                        }
                                        placeholder="Ej. Base + Cuerpo + Vidrios..."
                                        className="w-full bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm font-bold theme-text-main"
                                      />
                                    </div>

                                    <div className="md:col-span-4">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleGenerateBultosForItem(prod, {
                                            mode: 'SUBPAQUETES'
                                          })
                                        }
                                        className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg border-2 border-purple-400 cursor-pointer"
                                      >
                                        <QrCode size={18} />
                                        <span>
                                          Generar {numSubpaquetes} Subpaquetes con QR Individual
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* PANEL DESPLEGABLE 2: DIVIDIR MUCHAS UNIDADES EN PAQUETES (Ej. 500 flautas -> 10 paquetes de 50 unds) */}
                              {calc.openPanel === 'LOTES_IGUALES' && (
                                <div className="bg-amber-500/10 dark:bg-amber-950/35 border-2 border-amber-500 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm md:text-base font-black text-amber-800 dark:text-amber-300 uppercase flex items-center gap-2">
                                      <SplitSquareVertical size={18} />
                                      <span>
                                        Distribuir {prod.cantidadPendiente} Unidades en Paquetes (Ej. 10 paquetes de 50 unidades)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItemCalc(prod.itemKey, { openPanel: null })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-black uppercase theme-text-main hover:bg-red-600 hover:text-white cursor-pointer"
                                    >
                                      Ocultar ✕
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                                    <div className="md:col-span-4">
                                      <label className="block text-xs md:text-sm font-black uppercase text-amber-800 dark:text-amber-300 mb-1">
                                        ¿Cuántas unidades van en cada paquete?
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={prod.cantidadPendiente}
                                        value={calc.undsPorBulto}
                                        onChange={(e) => {
                                          const valUnds = Math.max(
                                            1,
                                            Math.floor(Number(e.target.value) || 1)
                                          );
                                          const autoPackages = Math.max(
                                            1,
                                            Math.floor(prod.cantidadPendiente / valUnds)
                                          );
                                          updateItemCalc(prod.itemKey, {
                                            undsPorBulto: e.target.value,
                                            numBultos: autoPackages,
                                            mode: 'LOTES_IGUALES'
                                          });
                                        }}
                                        className="w-full bg-[var(--color-base)] border-2 border-amber-500 rounded-xl px-3.5 py-2.5 text-base font-black theme-text-main text-center"
                                      />
                                    </div>

                                    <div className="md:col-span-4">
                                      <label className="block text-xs md:text-sm font-black uppercase text-amber-800 dark:text-amber-300 mb-1">
                                        Cantidad de Paquetes a Generar
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={prod.cantidadPendiente}
                                        value={calc.numBultos}
                                        onChange={(e) =>
                                          updateItemCalc(prod.itemKey, {
                                            numBultos: e.target.value,
                                            mode: 'LOTES_IGUALES'
                                          })
                                        }
                                        className="w-full bg-[var(--color-base)] border-2 border-amber-500 rounded-xl px-3.5 py-2.5 text-base font-black theme-text-main text-center"
                                      />
                                    </div>

                                    <div className="md:col-span-4">
                                      <button
                                        type="button"
                                        disabled={!isValidMath}
                                        onClick={() =>
                                          handleGenerateBultosForItem(prod, {
                                            mode: 'LOTES_IGUALES'
                                          })
                                        }
                                        className={`w-full py-3 px-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg border-2 transition-all ${
                                          isValidMath
                                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer'
                                            : 'bg-red-950/80 border-red-500 text-red-200 cursor-not-allowed'
                                        }`}
                                      >
                                        <QrCode size={18} />
                                        <span>
                                          Generar {numBultos}{' '}
                                          {numBultos === 1 ? 'Paquete' : 'Paquetes'} de{' '}
                                          {undsPorBulto} unds ({totalUnitsToAssign} unds)
                                        </span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="text-xs md:text-sm font-bold px-1">
                                    {exceedsBalance ? (
                                      <span className="text-red-600 dark:text-red-400 font-black flex items-center gap-1.5">
                                        <AlertTriangle size={16} />
                                        Intentas asignar {totalUnitsToAssign} unidades ({numBultos} ×{' '}
                                        {undsPorBulto}), pero el saldo disponible es de{' '}
                                        {prod.cantidadPendiente} unidades.
                                      </span>
                                    ) : (
                                      <span className="theme-text-main">
                                        Resultado: Se crearán{' '}
                                        <strong className="text-amber-700 dark:text-amber-400">
                                          {numBultos} paquetes independientes con QR único
                                        </strong>
                                        , cada uno con{' '}
                                        <strong className="text-emerald-700 dark:text-emerald-400">
                                          {undsPorBulto} de {prod.cantidadTotalPedido} unidades
                                        </strong>
                                        . Saldo restante tras aplicar:{' '}
                                        <strong>
                                          {prod.cantidadPendiente - totalUnitsToAssign} unidades
                                        </strong>
                                        .
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* PANEL DESPLEGABLE 3: AGRUPACIÓN MANUAL EN CAJA MIXTA */}
                              {calc.openPanel === 'AGRUPACION_MANUAL' && (
                                <div className="bg-sky-500/10 dark:bg-sky-950/35 border-2 border-sky-500 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm md:text-base font-black text-sky-800 dark:text-sky-300 uppercase flex items-center gap-2">
                                      <Layers size={18} />
                                      <span>
                                        Agrupar Unidades en Caja / Guacal Mixto con Otros Productos
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItemCalc(prod.itemKey, { openPanel: null })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-[var(--color-base)] border border-[var(--color-border)] text-xs font-black uppercase theme-text-main hover:bg-red-600 hover:text-white cursor-pointer"
                                    >
                                      Ocultar ✕
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                                    <div className="md:col-span-5">
                                      <label className="block text-xs md:text-sm font-black uppercase text-sky-800 dark:text-sky-300 mb-1">
                                        Destino del Empaque Manual
                                      </label>
                                      <select
                                        value={calc.targetPkgId || 'NUEVO'}
                                        onChange={(e) =>
                                          updateItemCalc(prod.itemKey, {
                                            targetPkgId: e.target.value,
                                            mode: 'AGRUPACION_MANUAL'
                                          })
                                        }
                                        className="w-full bg-[var(--color-base)] border-2 border-sky-500 rounded-xl px-3.5 py-2.5 text-sm font-black theme-text-main"
                                      >
                                        <option value="NUEVO">
                                          + Crear Nuevo Bulto / Caja Mixta
                                        </option>
                                        {(activePackingList.packages || []).map((p, idx) => (
                                          <option key={p.id} value={p.id}>
                                            Agregar a {p.codigoPaquete} (Bulto {idx + 1} —{' '}
                                            {(p.items || []).length} ítems)
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="md:col-span-3">
                                      <label className="block text-xs md:text-sm font-black uppercase text-sky-800 dark:text-sky-300 mb-1">
                                        Unidades a Incluir
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={prod.cantidadPendiente}
                                        value={calc.manualQty}
                                        onChange={(e) =>
                                          updateItemCalc(prod.itemKey, {
                                            manualQty: e.target.value,
                                            mode: 'AGRUPACION_MANUAL'
                                          })
                                        }
                                        className="w-full bg-[var(--color-base)] border-2 border-sky-500 rounded-xl px-3.5 py-2.5 text-base font-black theme-text-main text-center"
                                      />
                                    </div>

                                    <div className="md:col-span-4">
                                      <button
                                        type="button"
                                        disabled={!isValidMath}
                                        onClick={() =>
                                          handleGenerateBultosForItem(prod, {
                                            mode: 'AGRUPACION_MANUAL'
                                          })
                                        }
                                        className={`w-full py-3 px-4 rounded-xl font-black text-sm uppercase flex items-center justify-center gap-2 shadow-lg border-2 transition-all ${
                                          isValidMath
                                            ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 cursor-pointer'
                                            : 'bg-red-950/80 border-red-500 text-red-200 cursor-not-allowed'
                                        }`}
                                      >
                                        <Plus size={18} />
                                        <span>
                                          {calc.targetPkgId && calc.targetPkgId !== 'NUEVO'
                                            ? `Incluir ${manualQty} unds en Bulto`
                                            : `Crear Bulto Mixto (${manualQty} unds)`}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECCIÓN DE PRODUCTOS EN EMPAQUE 100% EMPACADOS LISTOS PARA TRANSFERIR A DESPACHOS */}
                  {completedEmpaqueProductsReadyForDispatch.length > 0 && (
                    <div className="bg-emerald-500/10 dark:bg-emerald-950/30 border-2 border-emerald-500 rounded-2xl p-5 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <PackageCheck size={24} className="text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <h3 className="text-base md:text-lg font-black uppercase text-emerald-800 dark:text-emerald-300">
                              Productos con Empaque 100% Completado — Listos para Transferir a DESPACHOS ({completedEmpaqueProductsReadyForDispatch.length})
                            </h3>
                            <p className="text-xs md:text-sm font-bold theme-text-muted">
                              Estos ítems ya tienen el 100% de sus unidades asignadas a bultos/QR. Transfiérelos a Despachos (En Espera).
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleTransferToDespachos(completedEmpaqueProductsReadyForDispatch)
                          }
                          className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs md:text-sm uppercase tracking-wider flex items-center gap-2 shadow-md border-2 border-emerald-300 cursor-pointer"
                        >
                          <Truck size={18} />
                          <span>Transferir Todos a DESPACHOS (En Espera)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {completedEmpaqueProductsReadyForDispatch.map((item) => (
                          <div
                            key={item.itemKey}
                            className="p-3.5 rounded-xl bg-[var(--color-surface)] border-2 border-emerald-500/50 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs md:text-sm font-black px-2.5 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-700">
                                  {item.codArticulo}
                                </span>
                                <span className="text-sm font-extrabold theme-text-main truncate">
                                  {item.nombre}
                                </span>
                              </div>
                              <div className="text-xs md:text-sm text-emerald-700 dark:text-emerald-400 font-black mt-1">
                                ✓ Empacado: {item.cantidadEmpacada} / Total:{' '}
                                {item.cantidadTotalPedido} unidades ({item.bultosGenerados} bultos QR)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTransferToDespachos([item])}
                              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-emerald-400 font-black text-xs uppercase flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow"
                            >
                              <span>Pasar a Despachos</span>
                              <ArrowRight size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ==================================================================================== */}
                  {/* SECCIÓN 2: PRODUCTOS DEL PEDIDO PENDIENTES POR LLEGAR A EMPAQUE Y SU ÁREA            */}
                  {/* ==================================================================================== */}
                  <div
                    className={`bg-[var(--color-surface)] border-2 rounded-2xl overflow-hidden shadow-lg transition-all ${
                      orderPanorama.pendingArrivalItems.length > 0
                        ? 'border-rose-500/60'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    <div
                      onClick={() => setIsPendingArrivalExpanded(!isPendingArrivalExpanded)}
                      className={`px-5 py-3.5 border-b-2 border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 cursor-pointer ${
                        orderPanorama.pendingArrivalItems.length > 0
                          ? 'bg-rose-500/10'
                          : 'bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MapPin
                          size={22}
                          className={
                            orderPanorama.pendingArrivalItems.length > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }
                        />
                        <div>
                          <h3 className="text-base md:text-lg font-black uppercase tracking-wider theme-text-main">
                            2. Productos del Pedido Pendientes por Llegar a Empaque y su Ubicación en Planta ({orderPanorama.pendingArrivalItems.length} de {orderPanorama.totalOrderItemsCount})
                          </h3>
                          <p className="text-xs md:text-sm font-bold theme-text-muted">
                            {orderPanorama.pendingArrivalItems.length > 0
                              ? `De los ${orderPanorama.totalOrderItemsCount} productos del Pedido #${activePackingList.pedidoNum}, ya recibiste ${orderPanorama.inEmpaqueOrDispatchedCount} en Empaque/Despachos y aún faltan ${orderPanorama.pendingArrivalItems.length} producto(s) por llegar.`
                              : `Todos los ${orderPanorama.totalOrderItemsCount} productos del Pedido #${activePackingList.pedidoNum} ya llegaron al área de Empaque / Despachos.`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-black uppercase ${
                            orderPanorama.pendingArrivalItems.length > 0
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {orderPanorama.pendingArrivalItems.length > 0
                            ? `Faltan ${orderPanorama.pendingArrivalItems.length} Prod por Llegar`
                            : '0 Pendientes en Planta'}
                        </span>
                        {isPendingArrivalExpanded ? (
                          <ChevronUp size={20} className="theme-text-muted" />
                        ) : (
                          <ChevronDown size={20} className="theme-text-muted" />
                        )}
                      </div>
                    </div>

                    {isPendingArrivalExpanded && (
                      <div className="p-4 md:p-5 space-y-4">
                        {orderPanorama.pendingArrivalItems.length === 0 ? (
                          <div className="p-6 rounded-xl bg-[var(--color-base)] border-2 border-emerald-500/40 text-center">
                            <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                            <div className="text-sm md:text-base font-black uppercase text-emerald-700 dark:text-emerald-400">
                              ¡Pedido 100% recibido en Empaque / Despachos! No quedan productos rezagados en otras áreas de la planta.
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPendingAreaFilter('TODAS')}
                                  className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black uppercase border-2 transition-all cursor-pointer ${
                                    selectedPendingAreaFilter === 'TODAS'
                                      ? 'bg-rose-600 text-white border-rose-400 shadow'
                                      : 'bg-[var(--color-base)] theme-text-main border-[var(--color-border)] hover:border-rose-500'
                                  }`}
                                >
                                  Todas las Áreas ({orderPanorama.pendingArrivalItems.length})
                                </button>

                                {orderPanorama.pendingByAreaList.map((areaStat) => (
                                  <button
                                    key={areaStat.area}
                                    type="button"
                                    onClick={() => setSelectedPendingAreaFilter(areaStat.area)}
                                    className={`px-3.5 py-2 rounded-xl text-xs md:text-sm font-black uppercase border-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                                      selectedPendingAreaFilter === areaStat.area
                                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                                        : 'bg-[var(--color-base)] text-amber-800 dark:text-amber-300 border-amber-500/60 hover:border-amber-400'
                                    }`}
                                  >
                                    <MapPin size={15} />
                                    <span>
                                      {areaStat.area}: {areaStat.itemsCount} prod ({areaStat.unitsCount} unds)
                                    </span>
                                  </button>
                                ))}
                              </div>

                              <input
                                type="text"
                                value={pendingArrivalSearch}
                                onChange={(e) => setPendingArrivalSearch(e.target.value)}
                                placeholder="Buscar producto o área..."
                                className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-xl px-3.5 py-2 text-sm font-bold theme-text-main focus:outline-none focus:border-rose-500"
                              />
                            </div>

                            <div className="overflow-x-auto rounded-xl border-2 border-[var(--color-border)]">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="bg-[var(--color-base)] border-b-2 border-[var(--color-border)] text-xs md:text-sm font-black uppercase tracking-wider theme-text-muted">
                                    <th className="py-3 px-4 border-r border-[var(--color-border)] w-40">
                                      Código
                                    </th>
                                    <th className="py-3 px-4 border-r border-[var(--color-border)]">
                                      Producto que Falta por Llegar a Empaque
                                    </th>
                                    <th className="py-3 px-4 border-r border-[var(--color-border)] w-36 text-center">
                                      Cantidad
                                    </th>
                                    <th className="py-3 px-4 border-r border-[var(--color-border)] w-68">
                                      📍 Área Actual en Planta
                                    </th>
                                    <th className="py-3 px-4 w-60">Estado / Seguimiento</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border)] text-sm">
                                  {filteredPendingArrivalItems.map((it) => (
                                    <tr
                                      key={it.id}
                                      className="hover:bg-amber-500/[0.04] transition-colors"
                                    >
                                      <td className="py-3 px-4 border-r border-[var(--color-border)] font-mono font-black text-amber-700 dark:text-amber-300">
                                        {it.codArticulo}
                                      </td>
                                      <td className="py-3 px-4 border-r border-[var(--color-border)] font-extrabold theme-text-main">
                                        {it.nombre}
                                      </td>
                                      <td className="py-3 px-4 border-r border-[var(--color-border)] text-center font-black theme-text-main">
                                        {it.cantidad} unds
                                      </td>
                                      <td className="py-3 px-4 border-r border-[var(--color-border)]">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/15 border-2 border-rose-500/50 text-rose-700 dark:text-rose-300 font-black text-xs md:text-sm uppercase">
                                          <MapPin size={15} />
                                          {it.areaActual}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 font-bold theme-text-muted">
                                        <div className="flex items-center gap-1.5">
                                          <Clock size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                          <span>{it.estadoDetalle}</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ==================================================================================== */}
                  {/* SECCIÓN 3: TABLA DE BULTOS FÍSICOS GENERADOS Y ETIQUETAS QR INDIVIDUALES             */}
                  {/* ==================================================================================== */}
                  <div className="bg-[var(--color-surface)] border-2 border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-5 py-3.5 border-b-2 border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <FileText size={22} className="text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-base md:text-lg font-black uppercase tracking-wider theme-text-main">
                          3. Bultos Físicos Generados y Códigos QR Individuales ({(activePackingList.packages || []).length} Bultos)
                        </h3>
                      </div>
                      <span className="text-xs md:text-sm font-bold theme-text-muted">
                        Cada bulto físico tiene su propio Consecutivo (Bulto X de N) y su etiqueta QR imprimible
                      </span>
                    </div>

                    {(activePackingList.packages || []).length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-base font-bold theme-text-muted">
                          Aún no se han generado bultos para este pedido. Usa los botones de empaque en la Sección 1 arriba.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-[var(--color-base)] border-b-2 border-[var(--color-border)] text-xs md:text-sm font-black uppercase tracking-wider theme-text-muted">
                              <th className="py-3.5 px-4 border-r border-[var(--color-border)] w-56">
                                Tipo y Consecutivo de Bulto
                              </th>
                              <th className="py-3.5 px-4 border-r border-[var(--color-border)] w-44">
                                Código de Producto
                              </th>
                              <th className="py-3.5 px-4 border-r border-[var(--color-border)]">
                                Nombre del Producto y Notas
                              </th>
                              <th className="py-3.5 px-4 border-r border-[var(--color-border)] w-60 text-center">
                                Cantidad en ESTE Bulto
                              </th>
                              <th className="py-3.5 px-4 w-64 text-center">
                                Etiqueta QR Individual / Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)] text-sm">
                            {(activePackingList.packages || []).map((pkg, pkgIdx) => {
                              const items = Array.isArray(pkg.items) ? pkg.items : [];
                              const totalPackages = (activePackingList.packages || []).length;
                              const qrPayload = buildPackageQRText(
                                activePackingList,
                                pkg,
                                pkgIdx,
                                totalPackages
                              );
                              const tipoUpper = String(pkg.tipoEmpaque || 'PAQUETE').toUpperCase();
                              const numPadded = String(pkg.consecutivo || pkgIdx + 1).padStart(
                                2,
                                '0'
                              );

                              return items.map((item, itemIdx) => {
                                const isFirstItemOfPkg = itemIdx === 0;
                                const rowSpanCount = items.length;
                                const cantBulto =
                                  Number(
                                    item.cantidadMostradaBulto ??
                                      item.cantidadEnEsteBulto ??
                                      item.cantidadEmpacada
                                  ) || 1;
                                const cantTotalItem =
                                  Number(item.cantidadTotalItem ?? item.cantidadTotalPedido) ||
                                  cantBulto;

                                return (
                                  <tr
                                    key={`${pkg.id}_${itemIdx}`}
                                    className="hover:bg-amber-500/[0.04] transition-colors"
                                  >
                                    {isFirstItemOfPkg && (
                                      <td
                                        rowSpan={rowSpanCount}
                                        className="p-4 border-r border-[var(--color-border)] align-top bg-[var(--color-base)]/40"
                                      >
                                        <div className="flex flex-col gap-2">
                                          <div className="inline-flex items-center gap-2 flex-wrap">
                                            <span className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm md:text-base shadow">
                                              {tipoUpper} #{numPadded}
                                            </span>
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-black text-xs border border-amber-500/40">
                                              Bulto {pkgIdx + 1} de {totalPackages}
                                            </span>
                                          </div>
                                          <div className="text-xs font-mono font-bold theme-text-muted">
                                            ID:{' '}
                                            {pkg.codigoUnicoPedido ||
                                              `${activePackingList.pedidoNum}-B${numPadded}`}
                                          </div>
                                          {pkg.observaciones && (
                                            <div className="text-xs md:text-sm font-bold bg-amber-500/15 border border-amber-500/50 text-amber-800 dark:text-amber-300 px-2.5 py-1.5 rounded-xl mt-1">
                                              Nota: {pkg.observaciones}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    )}

                                    <td className="p-4 border-r border-[var(--color-border)] font-mono font-black text-sm md:text-base text-amber-700 dark:text-amber-300 align-middle">
                                      {item.codArticulo || 'S/C'}
                                    </td>

                                    <td className="p-4 border-r border-[var(--color-border)] font-extrabold text-sm md:text-base theme-text-main align-middle">
                                      <div>{item.nombre}</div>
                                      {item.subpaqueteLabel && (
                                        <span className="inline-block mt-1 mr-2 px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/50">
                                          🧩 {item.subpaqueteLabel}
                                        </span>
                                      )}
                                      {item.transferidoADespachos ? (
                                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg text-xs font-black uppercase bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50">
                                          ✓ Transferido a Despachos (EN ESPERA)
                                        </span>
                                      ) : (
                                        <span className="inline-block mt-1 text-xs theme-text-muted font-bold">
                                          Origen: Área de Empaque
                                        </span>
                                      )}
                                    </td>

                                    <td className="p-4 border-r border-[var(--color-border)] text-center align-middle">
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 font-black text-sm md:text-base">
                                          {cantBulto} de {cantTotalItem} unds
                                        </span>
                                        <span className="text-xs theme-text-muted font-bold mt-1">
                                          {item.subpaqueteLabel
                                            ? item.subpaqueteLabel
                                            : 'Contenido en este bulto'}
                                        </span>
                                        {items.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveItemFromPackage(pkg.id, itemIdx)
                                            }
                                            className="text-xs font-black text-red-600 dark:text-red-400 hover:underline mt-1.5 cursor-pointer"
                                          >
                                            Quitar de este bulto
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    {isFirstItemOfPkg && (
                                      <td
                                        rowSpan={rowSpanCount}
                                        className="p-4 align-middle text-center bg-[var(--color-base)]/20"
                                      >
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                          <div
                                            onClick={() =>
                                              setQrPreviewPkg({
                                                pkg,
                                                pkgIdx,
                                                totalPackages,
                                                qrPayload
                                              })
                                            }
                                            className="cursor-pointer group relative inline-block"
                                            title="Haz clic para ver e imprimir el Código QR individual de este bulto"
                                          >
                                            <QRCodeSVG value={qrPayload} size={88} />
                                            <div className="mt-1.5 text-xs font-black text-indigo-700 dark:text-indigo-400 group-hover:underline flex items-center justify-center gap-1">
                                              <Eye size={14} /> Ver QR Bulto #{numPadded}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handlePrint('ROTULOS_QR', pkg)}
                                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border-2 border-indigo-400 text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer shadow"
                                            >
                                              <Printer size={14} /> Etiqueta QR
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeletePackage(pkg.id)}
                                              className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white border-2 border-red-400 text-xs font-black uppercase transition-colors cursor-pointer shadow"
                                              title="Eliminar este bulto"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              });
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ==================================================================================== */}
        {/* NOTIFICACIÓN ROJA, GRANDE Y VISIBLE AL INTENTAR CERRAR LISTA CON PRODUCTOS FALTANTES */}
        {/* ==================================================================================== */}
        {incompleteCloseWarningModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[140] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-red-950 border-4 border-red-500 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl text-white space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-4 border-b border-red-500/40 pb-4">
                <div className="w-16 h-16 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg border-2 border-red-300 animate-pulse">
                  <AlertOctagon size={40} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-red-500 text-white tracking-wider">
                    ALERTA PREVENTIVA DE EMPAQUE Y DESPACHOS
                  </span>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-1">
                    ¡AÚN FALTAN PRODUCTOS DE ESTE PEDIDO POR DESPACHAR!
                  </h3>
                </div>
              </div>

              <div className="bg-red-900/60 border-2 border-red-400/50 rounded-2xl p-4 space-y-3">
                <p className="text-base font-bold text-red-100 leading-relaxed">
                  El <strong className="text-amber-300">PEDIDO #{incompleteCloseWarningModal.pedidoNum}</strong> ({incompleteCloseWarningModal.cliente}) tiene un total de{' '}
                  <strong className="text-white underline">
                    {incompleteCloseWarningModal.totalPedidoItems} productos
                  </strong>
                  , pero todavía faltan{' '}
                  <strong className="text-amber-300 text-lg">
                    {incompleteCloseWarningModal.totalFaltantes} producto(s)
                  </strong>{' '}
                  por completar el proceso de empaque y despacho:
                </p>

                <div className="space-y-2.5 text-sm md:text-base font-bold bg-black/30 p-4 rounded-xl border border-red-400/30">
                  {incompleteCloseWarningModal.faltanPorLlegarCount > 0 && (
                    <div className="flex items-start gap-2 text-amber-300">
                      <span>•</span>
                      <span>
                        <strong>
                          {incompleteCloseWarningModal.faltanPorLlegarCount} producto(s) aún NO han llegado al área de Empaque
                        </strong>{' '}
                        (Ubicados actualmente en:{' '}
                        {incompleteCloseWarningModal.areasSummary
                          .map((a) => `${a.area} [${a.itemsCount}]`)
                          .join(', ')}
                        ).
                      </span>
                    </div>
                  )}

                  {incompleteCloseWarningModal.faltanPorEmpacarCount > 0 && (
                    <div className="flex items-start gap-2 text-red-200">
                      <span>•</span>
                      <span>
                        <strong>
                          {incompleteCloseWarningModal.faltanPorEmpacarCount} producto(s) están en el área de Empaque
                        </strong>{' '}
                        pero aún tienen unidades sin asignar a bultos/QR.
                      </span>
                    </div>
                  )}

                  {incompleteCloseWarningModal.faltanPorPasarADespachosCount > 0 && (
                    <div className="flex items-start gap-2 text-emerald-300">
                      <span>•</span>
                      <span>
                        <strong>
                          {incompleteCloseWarningModal.faltanPorPasarADespachosCount} producto(s) ya tienen bultos QR
                        </strong>{' '}
                        pero aún no han sido transferidos a Despachos.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-500/20 border-2 border-amber-400 rounded-2xl p-4 text-sm md:text-base font-black text-amber-200 leading-relaxed">
                📌 PROTECCIÓN DE LISTA DE EMPAQUE (DESPACHO PARCIAL PERMITIDO):
                <span className="block font-bold text-white mt-1">
                  Puedes despachar hoy los productos que ya están empacados ({incompleteCloseWarningModal.bultosCount} bultos QR). Al darle clic en &quot;ACEPTAR&quot;, el progreso queda guardado pero{' '}
                  <u className="text-amber-300 font-black">
                    LA LISTA DE EMPAQUE NO SE CIERRA COMO TERMINADA SINO QUE PERMANECE ACTIVA
                  </u>{' '}
                  para que puedas empacar los productos restantes cuando lleguen.
                </span>
              </div>

              <button
                type="button"
                autoFocus
                onClick={() => setIncompleteCloseWarningModal(null)}
                className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-black uppercase tracking-widest text-base md:text-lg shadow-xl border-2 border-white/40 transition-all cursor-pointer"
              >
                ACEPTAR (MANTENER LISTA DE EMPAQUE ACTIVA)
              </button>
            </div>
          </div>
        )}

        {/* MODAL DE VISTA AMPLIADA DEL CÓDIGO QR DEL BULTO FÍSICO */}
        {qrPreviewPkg && activePackingList && (
          <div
            className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4"
            onClick={() => setQrPreviewPkg(null)}
          >
            <div
              className="bg-[var(--color-surface)] border-2 border-amber-500 rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div className="text-left">
                  <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-400">
                    Etiqueta QR Individual • Bulto {qrPreviewPkg.pkgIdx + 1} de{' '}
                    {qrPreviewPkg.totalPackages}
                  </span>
                  <h4 className="text-xl font-black theme-text-main">
                    PEDIDO #{activePackingList.pedidoNum} • {qrPreviewPkg.pkg.codigoPaquete}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setQrPreviewPkg(null)}
                  className="p-1.5 rounded-xl bg-[var(--color-base)] border border-[var(--color-border)] theme-text-main hover:bg-red-600 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={qrPreviewPkg.qrPayload}
                  size={230}
                  className="shadow-xl border-4 border-white"
                />
              </div>

              <div className="bg-[var(--color-base)] border-2 border-[var(--color-border)] rounded-2xl p-3.5 text-left">
                <div className="text-xs font-black uppercase text-amber-700 dark:text-amber-400 mb-1">
                  Payload del QR (Visible al escanear este bulto físico):
                </div>
                <pre className="text-xs font-mono font-bold theme-text-main whitespace-pre-wrap leading-relaxed">
                  {qrPreviewPkg.qrPayload}
                </pre>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrint('ROTULOS_QR', qrPreviewPkg.pkg)}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs md:text-sm uppercase flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={17} /> Imprimir Etiqueta QR de este Bulto
                </button>
                <button
                  type="button"
                  onClick={() => setQrPreviewPkg(null)}
                  className="px-4 py-3 rounded-xl bg-[var(--color-base)] border-2 border-[var(--color-border)] theme-text-main font-black text-xs md:text-sm uppercase cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PackingListsModal;
