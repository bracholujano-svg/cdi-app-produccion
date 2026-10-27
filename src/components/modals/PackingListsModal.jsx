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
  AlertOctagon
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

  // Exclusión explícita de productos despachados o entregados
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

  // Condición obligatoria: área actual estrictamente 'EMPAQUE'
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
    const cantBulto = Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 1;
    const cantTotalItem = Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;
    lines.push(`${idx + 1}. [${cod}] ${nom}`);
    lines.push(`   Contenido en este bulto: ${cantBulto} de ${cantTotalItem} unds`);
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

  // Pestaña activa de lista de empaque
  const [activeListId, setActiveListId] = useState(() => {
    const firstActive = (packingLists || []).find((l) => l.estadoLista !== 'TERMINADA');
    return firstActive ? firstActive.id : packingLists?.[0]?.id || null;
  });

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
  const [historyStatusFilter, setHistoryStatusFilter] = useState('TODAS'); // 'TODAS' | 'TERMINADAS' | 'ACTIVAS'

  // Estado del Modal Rojo Grande de Notificación cuando faltan productos por empacar/despachar al intentar cerrar
  const [incompleteCloseWarningModal, setIncompleteCloseWarningModal] = useState(null);

  // Estado de la Calculadora de Fraccionamiento y Agrupación por ítem
  const [itemCalculators, setItemCalculators] = useState({});

  // Modal de vista ampliada de Código QR
  const [qrPreviewPkg, setQrPreviewPkg] = useState(null);

  // Listas activas (no cerradas como terminadas) vs todas las listas en historial
  const activeWorkingLists = useMemo(() => {
    return (packingLists || []).filter((l) => l.estadoLista !== 'TERMINADA');
  }, [packingLists]);

  // Lista de empaque activa seleccionada en la mesa de trabajo
  const activePackingList = useMemo(() => {
    if (!packingLists || packingLists.length === 0) return null;
    const found = packingLists.find((l) => l.id === activeListId);
    if (found) return found;
    return activeWorkingLists[0] || packingLists[0];
  }, [packingLists, activeListId, activeWorkingLists]);

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

    // Primero agrupamos cuántos productos totales tiene cada pedido en planta
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
   * PANORAMA COMPLETO DEL PEDIDO ACTIVO:
   * - ¿Cuántos productos tiene el pedido en total (ej. 58 productos)?
   * - ¿Cuántos están en Empaque / Empacados / Despachos (ej. 20 productos)?
   * - ¿Cuántos FALTAN por llegar a Empaque (ej. 38 productos) y en qué área de la planta están ubicados?
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
        // Producto del pedido que AÚN NO HA LLEGADO A EMPAQUE (está en Ensamble, Pintura, Ebanistería, CNC, Diseño, etc.)
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

    // Verificar si en `ribisoft_pedidos` (ERP) existen líneas adicionales de este pedido que aún no han bajado a planta
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

    // Agrupar productos pendientes por llegar según su Área Actual
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

    // Si hay bultos generados cuyos ítems no estaban en plantOrdersForPed (ej. pedidos antiguos), considerarlos en el conteo
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
          (s, it) => s + (Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
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

  // Filtrado de la tabla de productos que faltan por llegar a Empaque
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
        const qty = Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0;
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

  // Inicializar valores por defecto de la calculadora para cada ítem pendiente en Empaque
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
            mode: 'LOTES_IGUALES',
            tipoEmpaque: 'Paquete',
            numBultos: item.cantidadPendiente <= 10 ? item.cantidadPendiente : 1,
            undsPorBulto: item.cantidadPendiente <= 10 ? 1 : item.cantidadPendiente,
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
          mode: 'LOTES_IGUALES',
          tipoEmpaque: 'Paquete',
          numBultos: 1,
          undsPorBulto: 1,
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

  // Estadísticas globales de empaque del pedido activo (incluyendo unidades ya en bultos transferidos)
  const packingStats = useMemo(() => {
    const totalReferenciasEnEmpaque = orderProductsInEmpaque.length;
    const referenciasCompletas = completedEmpaqueProductsReadyForDispatch.length;
    const referenciasPendientesCount = pendingEmpaqueProducts.length;

    const totalUnitsInGeneratedPackages = (activePackingList?.packages || []).reduce(
      (acc, p) =>
        acc +
        (p.items || []).reduce(
          (s, it) => s + (Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
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

  // Crear o abrir una Lista de Empaque
  const handleCreateOrOpenPackingList = (pedidoNumRaw, clienteRaw = '') => {
    const pedNum = String(pedidoNumRaw || '').trim().toUpperCase();
    if (!pedNum) return;

    const existing = (packingLists || []).find(
      (l) => String(l.pedidoNum || '').trim().toUpperCase() === pedNum
    );
    if (existing) {
      setActiveListId(existing.id);
      setMainViewTab('ACTIVAS');
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
      estadoLista: 'ACTIVA', // 'ACTIVA' | 'ACTIVA_PARCIAL' | 'TERMINADA'
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      creadoPor: supervisorProfile?.nombre || supervisorProfile?.name || 'PLANTA / EMPAQUE',
      nextConsecutive: 1,
      packages: []
    };

    const updated = [newList, ...(packingLists || [])];
    setPackingLists(updated);
    syncPackingListToSupabase(newList);
    setActiveListId(newList.id);
    setMainViewTab('ACTIVAS');
    setSearchPedidoInput('');
    setShowNewListDropdown(false);
  };

  /**
   * FLUJO DE CIERRE / FINALIZACIÓN DE LISTA DE EMPAQUE CON NOTIFICACIÓN ROJA GRANDE:
   * - Si aún faltan productos del pedido por llegar a Empaque (en otras áreas), por empacar en bultos o por transferir a Despachos:
   *   Muestra una NOTIFICACIÓN ROJA, GRANDE Y VISIBLE con botón "ACEPTAR".
   *   Y AUNQUE SE LE DÉ A ACEPTAR, LA LISTA DE EMPAQUE NO SE DA POR CERRADA/TERMINADA, SINO QUE QUEDA ACTIVA
   *   (guardada en el historial como ACTIVA / DESPACHO PARCIAL para poder despachar hoy los productos listos y mañana el resto).
   * - Si el 100% de los productos del pedido ya están empacados y en Despachos/Despachados:
   *   Se guarda como TERMINADA en el Historial de Listas de Empaque.
   */
  const handleAttemptClosePackingList = () => {
    if (!activePackingList) return;

    const faltanPorLlegarCount = orderPanorama.pendingArrivalItems.length;
    const faltanPorEmpacarCount = pendingEmpaqueProducts.length;
    const faltanPorPasarADespachosCount = completedEmpaqueProductsReadyForDispatch.length;
    const totalFaltantes =
      faltanPorLlegarCount + faltanPorEmpacarCount + faltanPorPasarADespachosCount;

    if (totalFaltantes > 0) {
      // Guardar avance parcial en Supabase pero MANTENER LA LISTA ACTIVA (NO CERRARLA COMO TERMINADA)
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

      // Abrir la Notificación Roja Grande y Visible que pide darle a ACEPTAR manteniendo la lista activa
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

    // Si todos los productos del pedido están 100% empacados y en Despachos, se marca como TERMINADA y se archiva en Historial
    const finishedList = {
      ...activePackingList,
      estadoLista: 'TERMINADA',
      fechaCierre: new Date().toISOString(),
      cerradoPor: supervisorProfile?.nombre || supervisorProfile?.name || 'EMPAQUE',
      actualizadoEn: new Date().toISOString()
    };

    setPackingLists((prev) =>
      prev.map((l) => (l.id === finishedList.id ? finishedList : l))
    );
    syncPackingListToSupabase(finishedList);

    alert(
      `✅ Lista de Empaque del Pedido #${finishedList.pedidoNum} finalizada al 100% y almacenada en el Historial de Listas de Empaque.`
    );
    setMainViewTab('HISTORIAL');
  };

  // Reactivar una lista de empaque desde el Historial para seguir trabajando en ella
  const handleReopenPackingList = (listObj) => {
    if (!listObj) return;
    const reopened = {
      ...listObj,
      estadoLista: 'ACTIVA',
      actualizadoEn: new Date().toISOString()
    };
    setPackingLists((prev) => prev.map((l) => (l.id === reopened.id ? reopened : l)));
    syncPackingListToSupabase(reopened);
    setActiveListId(reopened.id);
    setMainViewTab('ACTIVAS');
  };

  // Eliminar una lista de empaque
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
    setPackingLists(remaining);
    syncPackingListToSupabase(listObj, true);
    if (activeListId === listObj.id) {
      setActiveListId(remaining[0]?.id || null);
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

  const handleGenerateBultosForItem = (prod) => {
    if (!activePackingList || !prod) return;
    const calc = itemCalculators[prod.itemKey] || {
      mode: 'LOTES_IGUALES',
      tipoEmpaque: 'Paquete',
      numBultos: 1,
      undsPorBulto: prod.cantidadPendiente,
      manualQty: prod.cantidadPendiente,
      targetPkgId: 'NUEVO',
      observaciones: ''
    };

    const currentPackages = Array.isArray(activePackingList.packages)
      ? [...activePackingList.packages]
      : [];

    const tipoUpper = String(calc.tipoEmpaque || 'Paquete').trim().toUpperCase();
    const obsClean = String(calc.observaciones || '').trim().toUpperCase();

    if (calc.mode === 'LOTES_IGUALES') {
      const numBultos = Math.floor(Number(calc.numBultos) || 0);
      const undsPorBulto = Math.floor(Number(calc.undsPorBulto) || 0);
      const totalUnidadesAGenerar = numBultos * undsPorBulto;

      if (numBultos <= 0 || undsPorBulto <= 0) {
        alert('⚠️ La cantidad de bultos y las unidades por bulto deben ser mayores a 0.');
        return;
      }

      if (totalUnidadesAGenerar > prod.cantidadPendiente) {
        alert(
          `❌ Error de Saldo Matemático:\nIntentas distribuir ${numBultos} bultos × ${undsPorBulto} unds = ${totalUnidadesAGenerar} unidades, pero el producto [${prod.codArticulo}] solo tiene ${prod.cantidadPendiente} unidades disponibles por empacar (Total del pedido: ${prod.cantidadTotalPedido} unds).`
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
              cantidadTotalItem: prod.cantidadTotalPedido,
              cantidadTotalPedido: prod.cantidadTotalPedido,
              textoContenidoBulto: `${undsPorBulto} de ${prod.cantidadTotalPedido} unds`,
              areaOrigen: 'Empaque'
            }
          ]
        });
      }
    } else {
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
            (Number(existingItems[sameItemIdx].cantidadEnEsteBulto ?? existingItems[sameItemIdx].cantidadEmpacada) || 0) +
            manualQty;
          existingItems[sameItemIdx] = {
            ...existingItems[sameItemIdx],
            cantidadEnEsteBulto: updatedQtyInBulto,
            cantidadEmpacada: updatedQtyInBulto,
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
      calc.mode === 'LOTES_IGUALES'
        ? (Number(calc.numBultos) || 1) * (Number(calc.undsPorBulto) || 1)
        : Number(calc.manualQty) || 1;
    const remainingAfter = Math.max(0, prod.cantidadPendiente - usedUnits);

    if (remainingAfter > 0) {
      updateItemCalc(prod.itemKey, {
        numBultos: 1,
        undsPorBulto: remainingAfter,
        manualQty: remainingAfter,
        observaciones: ''
      });
    }
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
    if (
      !window.confirm(
        '¿Deseas eliminar este bulto de la lista? Las unidades regresarán al saldo pendiente por empacar.'
      )
    ) {
      return;
    }
    const filtered = (activePackingList.packages || []).filter((p) => p.id !== pkgId);
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

  // Impresión de Etiquetas QR o Lista de Empaque Oficial (admite pasar una lista específica desde el Historial)
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
              const cantBulto = Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 1;
              const cantTotalItem = Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;
              return `
                <div style="border-bottom: 1px dashed #cbd5e1; padding: 6px 0; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <div style="font-size: 12px; font-weight: 800; color: #0f172a;">
                    <span style="background: #0f172a; color: #fff; padding: 1px 6px; border-radius: 4px; font-family: monospace; margin-right: 5px;">${it.codArticulo || 'S/C'}</span>
                    ${it.nombre || ''}
                  </div>
                  <div style="font-size: 13px; font-weight: 900; background: #fef3c7; border: 1.5px solid #f59e0b; color: #92400e; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
                    Contenido en este bulto: ${cantBulto} de ${cantTotalItem} unds
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
                  <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #334155; margin-bottom: 4px;">
                    Contenido Exacto de este Bulto Físico:
                  </div>
                  ${itemsRows}
                  ${
                    pkg.observaciones
                      ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 800; color: #b45309;">OBSERVACIÓN: ${pkg.observaciones}</div>`
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

    // MODO LISTA DE EMPAQUE OFICIAL COMPLETA
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
            const cantBulto = Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 1;
            const cantTotalItem = Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;

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

  // Enriquecer todas las listas de empaque para la vista de Historial
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
              (s, it) => s + (Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
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
          className={`bg-[var(--color-base)] border border-[var(--color-border)] flex flex-col overflow-hidden transition-all duration-200 ${
            isMaximized
              ? 'w-screen h-screen rounded-none'
              : 'w-[90vw] h-[85vh] rounded-2xl shadow-2xl'
          }`}
        >
          {/* CABECERA PRINCIPAL CON SELECTOR DE LAS 2 VISTAS (MESA DE EMPAQUE ACTIVA vs HISTORIAL DE LISTAS) */}
          <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-inner">
                <Package size={24} strokeWidth={2.3} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg md:text-xl font-black uppercase tracking-tight theme-text-main">
                    Módulo de Lista de Empaque y Fraccionamiento de Bultos / QR
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Trazabilidad de Pedido Completo + QR
                  </span>
                </div>
                <p className="text-xs theme-text-muted font-medium">
                  Fracciona en bultos los productos en EMPAQUE, consulta qué productos faltan por llegar desde planta y revisa el historial de listas.
                </p>
              </div>
            </div>

            {/* PESTAÑAS PRINCIPALES: 1) MESA DE EMPAQUE ACTIVA | 2) HISTORIAL DE LISTAS DE EMPAQUE */}
            <div className="flex items-center gap-1.5 bg-[var(--color-base)] p-1 rounded-2xl border border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setMainViewTab('ACTIVAS')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
                  mainViewTab === 'ACTIVAS'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'theme-text-muted hover:text-white'
                }`}
              >
                <Package size={15} />
                <span>Mesa de Empaque ({activeWorkingLists.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setMainViewTab('HISTORIAL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
                  mainViewTab === 'HISTORIAL'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'theme-text-muted hover:text-white'
                }`}
              >
                <History size={15} />
                <span>Historial de Listas ({(packingLists || []).length})</span>
              </button>
            </div>

            {/* BUSCADOR DE PEDIDOS CON PRODUCTOS EN 'EMPAQUE' + CONTROLES DE VENTANA */}
            <div className="flex items-center gap-2 relative">
              <div className="relative">
                <div className="flex items-center bg-[var(--color-base)] border-2 border-amber-500/50 rounded-xl px-3 py-1.5 focus-within:border-amber-500">
                  <Search size={16} className="text-amber-500 mr-2 shrink-0" />
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
                    className="bg-transparent text-xs md:text-sm font-bold theme-text-main focus:outline-none w-44 md:w-56"
                  />
                  {searchPedidoInput && (
                    <button
                      type="button"
                      onClick={() => setSearchPedidoInput('')}
                      className="theme-text-muted hover:text-white ml-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showNewListDropdown && (
                  <div className="absolute right-0 mt-1.5 w-80 md:w-96 max-h-80 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-50 p-2">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        Pedidos con productos en Área EMPAQUE ({filteredOrderSuggestions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewListDropdown(false)}
                        className="text-xs theme-text-muted hover:text-white"
                      >
                        Cerrar
                      </button>
                    </div>

                    {filteredOrderSuggestions.length === 0 ? (
                      <div className="p-3 text-xs theme-text-muted text-center">
                        No hay pedidos con productos actualmente en el área de <strong>EMPAQUE</strong>.
                      </div>
                    ) : (
                      filteredOrderSuggestions.map((sug) => {
                        const alreadyOpen = (packingLists || []).some(
                          (l) => l.pedidoNum === sug.pedidoNum
                        );
                        return (
                          <button
                            key={sug.pedidoNum}
                            type="button"
                            onClick={() =>
                              handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)
                            }
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between gap-2 border-b border-[var(--color-border)]/40 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-amber-400">
                                  #{sug.pedidoNum}
                                </span>
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                  {sug.empaqueItemsCount} de {sug.totalOrderItemsInPlant} prod en EMPAQUE
                                </span>
                              </div>
                              <div className="text-[11px] font-bold theme-text-main truncate">
                                {sug.cliente}
                              </div>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-[var(--color-base)] border border-[var(--color-border)] theme-text-muted shrink-0">
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
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.8} />
                <span className="hidden xl:inline">Pedidos en Empaque</span>
              </button>

              <WindowControls
                isMaximized={isMaximized}
                onToggleMaximize={() => setIsMaximized((prev) => !prev)}
                onMinimize={() => setIsMinimized(true)}
                onClose={() => setShowPackingListsModal(false)}
              />
            </div>
          </div>

          {/* ==================================================================================== */}
          {/* VISTA 2: HISTORIAL DE LISTAS DE EMPAQUE CREADAS Y TERMINADAS                         */}
          {/* ==================================================================================== */}
          {mainViewTab === 'HISTORIAL' ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 md:p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-black uppercase theme-text-main flex items-center gap-2">
                      <History className="text-indigo-400" size={22} />
                      <span>Archivo e Historial de Listas de Empaque Creadas y Terminadas</span>
                    </h3>
                    <p className="text-xs theme-text-muted mt-0.5">
                      Consulta todas las listas de empaque elaboradas, verifica cuántos productos se han empacado o faltan por llegar, reimprime documentos o reabre una lista activa.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-3 py-1.5">
                      <Search size={15} className="text-slate-400 mr-2" />
                      <input
                        type="text"
                        value={historySearchTerm}
                        onChange={(e) => setHistorySearchTerm(e.target.value)}
                        placeholder="Buscar # pedido o cliente..."
                        className="bg-transparent text-xs font-bold theme-text-main focus:outline-none w-48"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--color-base)] p-1 rounded-xl border border-[var(--color-border)]">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                            historyStatusFilter === tab.id
                              ? 'bg-indigo-600 text-white shadow'
                              : 'theme-text-muted hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {enrichedHistoryLists.length === 0 ? (
                  <div className="p-10 text-center rounded-2xl bg-[var(--color-base)] border border-[var(--color-border)]">
                    <History size={38} className="mx-auto mb-2 text-slate-500" />
                    <div className="text-sm font-black uppercase theme-text-main">
                      No se encontraron listas de empaque en el historial con este filtro
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {enrichedHistoryLists.map((list) => (
                      <div
                        key={list.id}
                        className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all shadow-md ${
                          list.isTerminada
                            ? 'bg-emerald-950/15 border-emerald-500/40'
                            : 'bg-[var(--color-base)] border-amber-500/40'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-lg font-black text-amber-400">
                                  PEDIDO #{list.pedidoNum}
                                </span>
                                {list.isTerminada ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                    ✓ Lista Terminada
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    ⏳ Activa / En Curso
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-extrabold theme-text-main mt-0.5">
                                {list.cliente}
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-amber-300 font-black text-xs border border-amber-500/30 shrink-0">
                              {list.pkgCount} {list.pkgCount === 1 ? 'Bulto QR' : 'Bultos QR'}
                            </span>
                          </div>

                          {/* Panorama rápido del pedido dentro de la tarjeta de historial */}
                          <div className="grid grid-cols-3 gap-2 bg-[var(--color-surface)] p-2.5 rounded-xl border border-[var(--color-border)] text-center">
                            <div>
                              <div className="text-[10px] font-bold theme-text-muted uppercase">
                                Unds en Bultos
                              </div>
                              <div className="text-sm font-black text-emerald-400">
                                {list.totalPackedUnits} unds
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold theme-text-muted uppercase">
                                En Empaque Hoy
                              </div>
                              <div className="text-sm font-black text-amber-400">
                                {list.inEmpaqueNowCount} prod
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold theme-text-muted uppercase">
                                Faltan por Llegar
                              </div>
                              <div
                                className={`text-sm font-black ${
                                  list.pendingOtherAreasCount > 0
                                    ? 'text-rose-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {list.pendingOtherAreasCount} prod
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] theme-text-muted flex items-center justify-between">
                            <span>
                              Actualizado:{' '}
                              {list.actualizadoEn
                                ? new Date(list.actualizadoEn).toLocaleString('es-CO')
                                : 'Reciente'}
                            </span>
                            <span>Por: {list.creadoPor || 'Empaque'}</span>
                          </div>
                        </div>

                        {/* Botonera de la tarjeta de Historial */}
                        <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveListId(list.id);
                              setMainViewTab('ACTIVAS');
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={14} />
                            <span>
                              {list.isTerminada ? 'Consultar / Abrir' : 'Continuar Empaque'}
                            </span>
                          </button>

                          {list.isTerminada && (
                            <button
                              type="button"
                              onClick={() => handleReopenPackingList(list)}
                              className="py-2 px-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-black text-xs uppercase flex items-center gap-1 cursor-pointer"
                              title="Reactivar lista de empaque como Activa"
                            >
                              <RotateCcw size={14} />
                              <span>Reactivar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handlePrint('LISTA_COMPLETA', null, list)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 cursor-pointer"
                            title="Imprimir Lista de Empaque Oficial"
                          >
                            <Printer size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePrint('ROTULOS_QR', null, list)}
                            className="p-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 border border-indigo-500/40 cursor-pointer"
                            title="Imprimir Etiquetas QR de esta Lista"
                          >
                            <QrCode size={15} />
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
              {/* BARRA DE PESTAÑAS DE LISTAS DE EMPAQUE ACTIVAS */}
              <div className="bg-[var(--color-surface)]/70 border-b border-[var(--color-border)] px-4 md:px-6 py-2.5 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    type="button"
                    onClick={() => setIsTabsExpanded(!isTabsExpanded)}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-wider theme-text-muted hover:text-white cursor-pointer"
                  >
                    <FolderOpen size={15} className="text-amber-500" />
                    <span>
                      Listas de Empaque en Mesa de Trabajo ({(packingLists || []).length})
                    </span>
                    {isTabsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainViewTab('HISTORIAL')}
                    className="text-xs font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                  >
                    <History size={14} />
                    <span>Ver Historial Completo de Listas ({(packingLists || []).length})</span>
                  </button>
                </div>

                {isTabsExpanded && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {(packingLists || []).length === 0 ? (
                      <div className="text-xs theme-text-muted py-1.5 px-3 rounded-xl border border-dashed border-[var(--color-border)]">
                        Selecciona arriba un pedido que tenga productos en el área de{' '}
                        <strong>EMPAQUE</strong> para iniciar su fraccionamiento de bultos y códigos QR.
                      </div>
                    ) : (
                      (packingLists || []).map((list) => {
                        const isActive = activePackingList?.id === list.id;
                        const pkgCount = Array.isArray(list.packages) ? list.packages.length : 0;
                        const totalPackedUnits = (list.packages || []).reduce(
                          (acc, p) =>
                            acc +
                            (p.items || []).reduce(
                              (s, it) =>
                                s +
                                (Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 0),
                              0
                            ),
                          0
                        );

                        return (
                          <div
                            key={list.id}
                            onClick={() => setActiveListId(list.id)}
                            className={`group cursor-pointer rounded-2xl px-3.5 py-2 border transition-all flex items-center gap-3 shrink-0 ${
                              isActive
                                ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                                : 'bg-[var(--color-base)] border-[var(--color-border)] theme-text-muted hover:border-amber-500/40 hover:text-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-amber-400">
                                  PEDIDO #{list.pedidoNum}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-amber-300 border border-amber-500/30">
                                  {pkgCount} {pkgCount === 1 ? 'Bulto QR' : 'Bultos QR'}
                                </span>
                                {list.estadoLista === 'TERMINADA' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                                    Terminada
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-bold truncate max-w-[180px] theme-text-main">
                                {list.cliente}
                              </div>
                              <div className="text-[10px] theme-text-muted font-semibold">
                                {totalPackedUnits} unds en bultos
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePackingList(list, e)}
                              title="Eliminar esta lista de empaque"
                              className="opacity-60 hover:opacity-100 hover:text-red-400 p-1 rounded-lg transition-opacity"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* CUERPO PRINCIPAL DE LA LISTA DE EMPAQUE ACTIVA */}
              {!activePackingList ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
                    <Package size={42} />
                  </div>
                  <h3 className="text-xl font-black uppercase theme-text-main mb-2">
                    Pedidos Disponibles en el Área de EMPAQUE
                  </h3>
                  <p className="text-sm theme-text-muted max-w-xl mb-6">
                    Selecciona un pedido para empacar sus productos en <strong>EMPAQUE</strong> y visualizar al mismo tiempo cuántos productos de ese pedido faltan por llegar desde otras áreas de la planta.
                  </p>
                  {eligibleEmpaqueOrdersSummary.length === 0 ? (
                    <div className="px-5 py-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs theme-text-muted max-w-md">
                      Actualmente no hay ningún producto ubicado en el área de{' '}
                      <strong>EMPAQUE</strong>. Puedes consultar listas anteriores en la pestaña{' '}
                      <strong>Historial de Listas</strong> arriba.
                    </div>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl">
                      {eligibleEmpaqueOrdersSummary.map((sug) => (
                        <button
                          key={sug.pedidoNum}
                          type="button"
                          onClick={() =>
                            handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)
                          }
                          className="px-4 py-3 rounded-2xl bg-[var(--color-surface)] hover:bg-amber-500/15 border border-[var(--color-border)] hover:border-amber-500/50 transition-all text-left shadow cursor-pointer"
                        >
                          <div className="font-black text-sm text-amber-400">
                            Pedido #{sug.pedidoNum}
                          </div>
                          <div className="text-xs font-bold theme-text-main truncate max-w-[200px]">
                            {sug.cliente}
                          </div>
                          <div className="text-[10px] font-extrabold text-emerald-400 mt-1">
                            {sug.empaqueItemsCount} de {sug.totalOrderItemsInPlant} prod en EMPAQUE ({sug.empaqueTotalUnits} unds)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
                  {/* BARRA DE RESUMEN DEL PEDIDO COMPLETO Y BOTONES DE ACCIÓN / CIERRE */}
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-2xl font-black text-amber-400">
                            PEDIDO #{activePackingList.pedidoNum}
                          </span>
                          <span className="text-sm md:text-base font-extrabold theme-text-main uppercase">
                            • {activePackingList.cliente}
                          </span>
                          {activePackingList.estadoLista === 'TERMINADA' ? (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              ✓ Lista de Empaque Terminada
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              ⏳ Lista de Empaque Activa
                            </span>
                          )}
                        </div>
                        <p className="text-xs theme-text-muted mt-1">
                          Bultos físicos generados con QR individual:{' '}
                          <strong className="text-amber-400">
                            {(activePackingList.packages || []).length} bultos (
                            {packingStats.totalUnidadesEmpacadas} unds empacadas)
                          </strong>
                        </p>
                      </div>

                      {/* ACCIONES GLOBALES: TRANSFERIR A DESPACHOS, IMPRIMIR Y CERRAR LISTA DE EMPAQUE */}
                      <div className="flex flex-wrap items-center gap-2">
                        {completedEmpaqueProductsReadyForDispatch.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleTransferToDespachos(
                                completedEmpaqueProductsReadyForDispatch
                              )
                            }
                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all animate-pulse cursor-pointer"
                          >
                            <Truck size={16} />
                            <span>
                              Transferir {completedEmpaqueProductsReadyForDispatch.length}{' '}
                              Producto(s) a DESPACHOS
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePrint('ROTULOS_QR')}
                          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                          <QrCode size={16} />
                          <span>
                            Imprimir {(activePackingList.packages || []).length} Etiquetas QR
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePrint('LISTA_COMPLETA')}
                          className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                          <Printer size={16} />
                          <span>Imprimir Lista de Empaque</span>
                        </button>

                        {activePackingList.estadoLista === 'TERMINADA' ? (
                          <button
                            type="button"
                            onClick={() => handleReopenPackingList(activePackingList)}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
                          >
                            <RotateCcw size={16} />
                            <span>Reactivar Lista</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleAttemptClosePackingList}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer border border-emerald-400/40"
                            title="Verifica si el pedido está completo o si aún faltan productos por despachar"
                          >
                            <CheckCircle2 size={16} />
                            <span>Cerrar / Finalizar Lista de Empaque</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 4 TARJETAS DE PANORAMA DEL PEDIDO COMPLETO (TOTAL vs RECIBIDOS EN EMPAQUE vs FALTAN POR LLEGAR) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase theme-text-muted">
                            Total Productos del Pedido
                          </div>
                          <div className="text-lg font-black theme-text-main mt-0.5">
                            {orderPanorama.totalOrderItemsCount} productos
                          </div>
                          <div className="text-[11px] font-bold text-slate-400">
                            {orderPanorama.totalOrderUnitsCount} unidades totales
                          </div>
                        </div>
                        <Package className="text-slate-400" size={26} />
                      </div>

                      <div className="bg-[var(--color-base)] border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-emerald-400">
                            Ya Empacados / En Despachos
                          </div>
                          <div className="text-lg font-black text-emerald-400 mt-0.5">
                            {orderPanorama.packedOrDispatchedItemsCount +
                              completedEmpaqueProductsReadyForDispatch.length}{' '}
                            productos
                          </div>
                          <div className="text-[11px] font-bold text-emerald-300/80">
                            {(activePackingList.packages || []).length} bultos QR (
                            {packingStats.totalUnidadesEmpacadas} unds)
                          </div>
                        </div>
                        <CheckCircle className="text-emerald-400" size={26} />
                      </div>

                      <div className="bg-[var(--color-base)] border border-amber-500/40 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase text-amber-400">
                            En Área EMPAQUE (Por Empacar)
                          </div>
                          <div className="text-lg font-black text-amber-400 mt-0.5">
                            {pendingEmpaqueProducts.length} productos
                          </div>
                          <div className="text-[11px] font-bold text-amber-300/80">
                            {packingStats.totalUnidadesPendientes} unds listas para empacar
                          </div>
                        </div>
                        <Calculator className="text-amber-400" size={26} />
                      </div>

                      <div
                        onClick={() => setIsPendingArrivalExpanded(true)}
                        className={`rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all border ${
                          orderPanorama.pendingArrivalItems.length > 0
                            ? 'bg-rose-950/30 border-rose-500/60 hover:bg-rose-950/50'
                            : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}
                        title="Haz clic para ver qué productos faltan por llegar a Empaque y en qué área están"
                      >
                        <div>
                          <div
                            className={`text-[10px] font-black uppercase ${
                              orderPanorama.pendingArrivalItems.length > 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            Faltan por Llegar a Empaque
                          </div>
                          <div
                            className={`text-lg font-black mt-0.5 ${
                              orderPanorama.pendingArrivalItems.length > 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {orderPanorama.pendingArrivalItems.length} productos
                          </div>
                          <div className="text-[11px] font-bold text-slate-300">
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
                          size={26}
                        />
                      </div>
                    </div>

                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className={`h-full transition-all duration-300 ${
                          packingStats.pctUnidades === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${packingStats.pctUnidades}%` }}
                      />
                    </div>
                  </div>

                  {/* SECCIÓN 1: CALCULADORA DE FRACCIONAMIENTO Y AGRUPACIÓN (SOLO PRODUCTOS EN 'EMPAQUE' CON SALDO PENDIENTE) */}
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-4 py-3 bg-amber-500/10 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calculator size={18} className="text-amber-400" />
                        <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                          1. Productos en Área 'EMPAQUE' Pendientes por Asignar a Bultos / Guacales ({pendingEmpaqueProducts.length})
                        </h3>
                      </div>
                      <input
                        type="text"
                        value={filterProductSearch}
                        onChange={(e) => setFilterProductSearch(e.target.value)}
                        placeholder="Filtrar por código o nombre..."
                        className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-3 py-1 text-xs theme-text-main focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="p-4 space-y-4">
                      {pendingEmpaqueProducts.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-[var(--color-base)] border border-[var(--color-border)] text-center space-y-2">
                          <CheckCircle size={32} className="text-emerald-400 mx-auto" />
                          <div className="text-sm font-black uppercase theme-text-main">
                            No hay productos pendientes por empacar actualmente en el área 'EMPAQUE'
                          </div>
                          <p className="text-xs theme-text-muted max-w-2xl mx-auto">
                            Todos los productos que ya habían ingresado a <strong>EMPAQUE</strong> tienen sus bultos generados.
                            {orderPanorama.pendingArrivalItems.length > 0 && (
                              <span className="text-rose-400 font-black block mt-1">
                                ⚠️ Atención: Aún faltan {orderPanorama.pendingArrivalItems.length} producto(s) de este pedido por llegar a Empaque desde otras áreas (ver Sección 2 abajo).
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        pendingEmpaqueProducts.map((prod) => {
                          const calc = itemCalculators[prod.itemKey] || {
                            mode: 'LOTES_IGUALES',
                            tipoEmpaque: 'Paquete',
                            numBultos: 1,
                            undsPorBulto: prod.cantidadPendiente,
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

                          const totalUnitsToAssign =
                            calc.mode === 'LOTES_IGUALES' ? numBultos * undsPorBulto : manualQty;
                          const exceedsBalance = totalUnitsToAssign > prod.cantidadPendiente;
                          const isZeroOrInvalid = totalUnitsToAssign <= 0;
                          const isValidMath = !exceedsBalance && !isZeroOrInvalid;

                          return (
                            <div
                              key={prod.itemKey}
                              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-base)] p-4 shadow-md space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="font-mono text-xs md:text-sm font-black px-2.5 py-1 rounded-lg bg-slate-800 text-amber-300 border border-slate-700">
                                    {prod.codArticulo}
                                  </span>
                                  <span className="text-sm md:text-base font-black theme-text-main">
                                    {prod.nombre}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    📍 Área Actual: EMPAQUE
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="px-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-amber-500/40 text-xs font-black">
                                    <span className="theme-text-muted">Empacado: </span>
                                    <span className="text-emerald-400">
                                      {prod.cantidadEmpacada}
                                    </span>
                                    <span className="theme-text-muted"> / Total: </span>
                                    <span className="text-white">
                                      {prod.cantidadTotalPedido} unidades
                                    </span>
                                  </div>
                                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs font-black text-amber-300">
                                    Saldo Pendiente: {prod.cantidadPendiente} unds
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="inline-flex rounded-xl bg-[var(--color-surface)] p-1 border border-[var(--color-border)]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemCalc(prod.itemKey, { mode: 'LOTES_IGUALES' })
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
                                      calc.mode === 'LOTES_IGUALES'
                                        ? 'bg-amber-500 text-slate-950 shadow'
                                        : 'theme-text-muted hover:text-white'
                                    }`}
                                  >
                                    <SplitSquareVertical size={14} />
                                    <span>Modo A: Distribución Automática / Lotes Iguales</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateItemCalc(prod.itemKey, {
                                        mode: 'AGRUPACION_MANUAL'
                                      })
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
                                      calc.mode === 'AGRUPACION_MANUAL'
                                        ? 'bg-amber-500 text-slate-950 shadow'
                                        : 'theme-text-muted hover:text-white'
                                    }`}
                                  >
                                    <Layers size={14} />
                                    <span>Modo B: Agrupación Manual / Caja Mixta</span>
                                  </button>
                                </div>

                                {calc.mode === 'LOTES_IGUALES' && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItemCalc(prod.itemKey, {
                                          numBultos: prod.cantidadPendiente,
                                          undsPorBulto: 1
                                        })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 text-[11px] font-black uppercase"
                                    >
                                      ⚡ 1 Paquete por Unidad ({prod.cantidadPendiente} bultos × 1 und)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateItemCalc(prod.itemKey, {
                                          numBultos: 1,
                                          undsPorBulto: prod.cantidadPendiente
                                        })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-black uppercase"
                                    >
                                      📦 Todo en 1 Bulto (1 × {prod.cantidadPendiente} unds)
                                    </button>
                                  </div>
                                )}
                              </div>

                              {calc.mode === 'LOTES_IGUALES' ? (
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                      Tipo de Embalaje
                                    </label>
                                    <select
                                      value={calc.tipoEmpaque}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          tipoEmpaque: e.target.value
                                        })
                                      }
                                      className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-2.5 py-2 text-xs font-bold theme-text-main"
                                    >
                                      <option value="Paquete">Paquete</option>
                                      <option value="Guacal">Guacal</option>
                                      <option value="Caja">Caja</option>
                                      <option value="Estiba">Estiba</option>
                                    </select>
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-amber-400 mb-1">
                                      Cantidad de Bultos (N)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={prod.cantidadPendiente}
                                      value={calc.numBultos}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          numBultos: e.target.value
                                        })
                                      }
                                      className="w-full bg-[var(--color-base)] border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-black theme-text-main text-center"
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-amber-400 mb-1">
                                      Unidades por Bulto (X)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={prod.cantidadPendiente}
                                      value={calc.undsPorBulto}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          undsPorBulto: e.target.value
                                        })
                                      }
                                      className="w-full bg-[var(--color-base)] border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-black theme-text-main text-center"
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                      Observación del Bulto (Opcional)
                                    </label>
                                    <input
                                      type="text"
                                      value={calc.observaciones}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          observaciones: e.target.value
                                        })
                                      }
                                      placeholder="Ej. Frágil / Con herrajes"
                                      className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold theme-text-main"
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <button
                                      type="button"
                                      disabled={!isValidMath}
                                      onClick={() => handleGenerateBultosForItem(prod)}
                                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-all ${
                                        isValidMath
                                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                          : 'bg-red-950/50 border border-red-500/40 text-red-300 cursor-not-allowed'
                                      }`}
                                    >
                                      <QrCode size={15} />
                                      <span>
                                        Generar {numBultos} {numBultos === 1 ? 'Bulto' : 'Bultos'}{' '}
                                        ({totalUnitsToAssign} unds)
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                                  <div className="md:col-span-3">
                                    <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                      Destino del Empaque Manual
                                    </label>
                                    <select
                                      value={calc.targetPkgId || 'NUEVO'}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          targetPkgId: e.target.value
                                        })
                                      }
                                      className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-2.5 py-2 text-xs font-bold theme-text-main"
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

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                      Tipo de Embalaje
                                    </label>
                                    <select
                                      value={calc.tipoEmpaque}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          tipoEmpaque: e.target.value
                                        })
                                      }
                                      disabled={calc.targetPkgId && calc.targetPkgId !== 'NUEVO'}
                                      className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-2.5 py-2 text-xs font-bold theme-text-main"
                                    >
                                      <option value="Caja">Caja</option>
                                      <option value="Paquete">Paquete</option>
                                      <option value="Guacal">Guacal</option>
                                      <option value="Estiba">Estiba</option>
                                    </select>
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase text-amber-400 mb-1">
                                      Unidades a Incluir
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={prod.cantidadPendiente}
                                      value={calc.manualQty}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          manualQty: e.target.value
                                        })
                                      }
                                      className="w-full bg-[var(--color-base)] border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-black theme-text-main text-center"
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                      Nota (Opcional)
                                    </label>
                                    <input
                                      type="text"
                                      value={calc.observaciones}
                                      onChange={(e) =>
                                        updateItemCalc(prod.itemKey, {
                                          observaciones: e.target.value
                                        })
                                      }
                                      placeholder="Nota..."
                                      className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold theme-text-main"
                                    />
                                  </div>

                                  <div className="md:col-span-3">
                                    <button
                                      type="button"
                                      disabled={!isValidMath}
                                      onClick={() => handleGenerateBultosForItem(prod)}
                                      className={`w-full py-2.5 px-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md transition-all ${
                                        isValidMath
                                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                                          : 'bg-red-950/50 border border-red-500/40 text-red-300 cursor-not-allowed'
                                      }`}
                                    >
                                      <Plus size={15} />
                                      <span>
                                        {calc.targetPkgId && calc.targetPkgId !== 'NUEVO'
                                          ? `Incluir ${manualQty} unds en Bulto`
                                          : `Crear Bulto con ${manualQty} unds`}
                                      </span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between text-xs px-1">
                                {exceedsBalance ? (
                                  <span className="text-red-400 font-black flex items-center gap-1.5">
                                    <AlertTriangle size={14} />
                                    Validación de Saldo: Intentas asignar {totalUnitsToAssign}{' '}
                                    unidades, pero el saldo disponible por empacar es de{' '}
                                    {prod.cantidadPendiente} unidades (Total pedido:{' '}
                                    {prod.cantidadTotalPedido}).
                                  </span>
                                ) : (
                                  <span className="theme-text-muted font-semibold">
                                    {calc.mode === 'LOTES_IGUALES' ? (
                                      <>
                                        Resultado: Se generarán{' '}
                                        <strong className="text-amber-400">
                                          {numBultos} registros de{' '}
                                          {calc.tipoEmpaque.toUpperCase()} independientes
                                        </strong>{' '}
                                        con códigos QR únicos, cada uno indicando{' '}
                                        <strong className="text-emerald-400">
                                          "{undsPorBulto} de {prod.cantidadTotalPedido} unds"
                                        </strong>
                                        . Saldo restante tras aplicar:{' '}
                                        <strong>
                                          {prod.cantidadPendiente - totalUnitsToAssign} unds
                                        </strong>
                                        .
                                      </>
                                    ) : (
                                      <>
                                        Resultado: Se asignarán{' '}
                                        <strong className="text-emerald-400">
                                          {manualQty} de {prod.cantidadTotalPedido} unds
                                        </strong>
                                        . Saldo restante tras aplicar:{' '}
                                        <strong>
                                          {prod.cantidadPendiente - totalUnitsToAssign} unds
                                        </strong>
                                        .
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECCIÓN DE PRODUCTOS EN EMPAQUE 100% EMPACADOS LISTOS PARA TRANSFERIR A DESPACHOS */}
                  {completedEmpaqueProductsReadyForDispatch.length > 0 && (
                    <div className="bg-emerald-950/20 border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <PackageCheck size={20} className="text-emerald-400" />
                          <div>
                            <h3 className="text-sm font-black uppercase text-emerald-400">
                              Productos con Empaque 100% Completado — Listos para Transferir a DESPACHOS ({completedEmpaqueProductsReadyForDispatch.length})
                            </h3>
                            <p className="text-xs theme-text-muted">
                              Estos ítems ya tienen el 100% de sus unidades asignadas a bultos/QR. Transfiérelos a Despachos (En Espera).
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleTransferToDespachos(completedEmpaqueProductsReadyForDispatch)
                          }
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer"
                        >
                          <Truck size={16} />
                          <span>Transferir Todos a DESPACHOS (En Espera)</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {completedEmpaqueProductsReadyForDispatch.map((item) => (
                          <div
                            key={item.itemKey}
                            className="p-3 rounded-xl bg-[var(--color-surface)] border border-emerald-500/30 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                                  {item.codArticulo}
                                </span>
                                <span className="text-xs font-extrabold theme-text-main truncate">
                                  {item.nombre}
                                </span>
                              </div>
                              <div className="text-[11px] text-emerald-400 font-black mt-1">
                                ✓ Empacado: {item.cantidadEmpacada} / Total:{' '}
                                {item.cantidadTotalPedido} unidades ({item.bultosGenerados} bultos QR)
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTransferToDespachos([item])}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-black text-[11px] uppercase flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                            >
                              <span>Pasar a Despachos</span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ==================================================================================== */}
                  {/* SECCIÓN 2 (NUEVA): PRODUCTOS DEL PEDIDO PENDIENTES POR LLEGAR A EMPAQUE Y SU ÁREA    */}
                  {/* ==================================================================================== */}
                  <div
                    className={`bg-[var(--color-surface)] border-2 rounded-2xl overflow-hidden shadow-lg transition-all ${
                      orderPanorama.pendingArrivalItems.length > 0
                        ? 'border-rose-500/50'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    <div
                      onClick={() => setIsPendingArrivalExpanded(!isPendingArrivalExpanded)}
                      className={`px-4 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 cursor-pointer ${
                        orderPanorama.pendingArrivalItems.length > 0
                          ? 'bg-rose-500/10'
                          : 'bg-emerald-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin
                          size={19}
                          className={
                            orderPanorama.pendingArrivalItems.length > 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        />
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                            2. Productos del Pedido Pendientes por Llegar a Empaque y su Ubicación en Planta ({orderPanorama.pendingArrivalItems.length} de {orderPanorama.totalOrderItemsCount})
                          </h3>
                          <p className="text-xs theme-text-muted">
                            {orderPanorama.pendingArrivalItems.length > 0
                              ? `De los ${orderPanorama.totalOrderItemsCount} productos del Pedido #${activePackingList.pedidoNum}, ya recibiste ${orderPanorama.inEmpaqueOrDispatchedCount} en Empaque/Despachos y aún faltan ${orderPanorama.pendingArrivalItems.length} producto(s) por llegar.`
                              : `Todos los ${orderPanorama.totalOrderItemsCount} productos del Pedido #${activePackingList.pedidoNum} ya llegaron al área de Empaque / Despachos.`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black uppercase ${
                            orderPanorama.pendingArrivalItems.length > 0
                              ? 'bg-rose-500 text-white'
                              : 'bg-emerald-500 text-slate-950'
                          }`}
                        >
                          {orderPanorama.pendingArrivalItems.length > 0
                            ? `Faltan ${orderPanorama.pendingArrivalItems.length} Prod por Llegar`
                            : '0 Pendientes en Planta'}
                        </span>
                        {isPendingArrivalExpanded ? (
                          <ChevronUp size={18} className="theme-text-muted" />
                        ) : (
                          <ChevronDown size={18} className="theme-text-muted" />
                        )}
                      </div>
                    </div>

                    {isPendingArrivalExpanded && (
                      <div className="p-4 space-y-4">
                        {orderPanorama.pendingArrivalItems.length === 0 ? (
                          <div className="p-5 rounded-xl bg-[var(--color-base)] border border-emerald-500/30 text-center">
                            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-1.5" />
                            <div className="text-xs font-black uppercase text-emerald-400">
                              ¡Pedido 100% recibido en Empaque / Despachos! No quedan productos rezagados en otras áreas de la planta.
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* CHIPS DE RESUMEN POR ÁREA DONDE SE ENCUENTRAN LOS PRODUCTOS FALTANTES */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedPendingAreaFilter('TODAS')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                                    selectedPendingAreaFilter === 'TODAS'
                                      ? 'bg-rose-500 text-white border-rose-400 shadow'
                                      : 'bg-[var(--color-base)] theme-text-muted border-[var(--color-border)] hover:text-white'
                                  }`}
                                >
                                  Todas las Áreas ({orderPanorama.pendingArrivalItems.length})
                                </button>

                                {orderPanorama.pendingByAreaList.map((areaStat) => (
                                  <button
                                    key={areaStat.area}
                                    type="button"
                                    onClick={() => setSelectedPendingAreaFilter(areaStat.area)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border transition-all flex items-center gap-1.5 cursor-pointer ${
                                      selectedPendingAreaFilter === areaStat.area
                                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                                        : 'bg-[var(--color-base)] text-amber-300 border-amber-500/30 hover:border-amber-400'
                                    }`}
                                  >
                                    <MapPin size={13} />
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
                                className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs theme-text-main focus:outline-none focus:border-rose-500"
                              />
                            </div>

                            {/* TABLA DETALLADA DE LOS PRODUCTOS QUE FALTAN POR LLEGAR A EMPAQUE */}
                            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                              <table className="w-full border-collapse text-left">
                                <thead>
                                  <tr className="bg-[var(--color-base)] border-b border-[var(--color-border)] text-[11px] font-black uppercase tracking-wider theme-text-muted">
                                    <th className="py-2.5 px-4 border-r border-[var(--color-border)] w-36">
                                      Código
                                    </th>
                                    <th className="py-2.5 px-4 border-r border-[var(--color-border)]">
                                      Producto que Falta por Llegar a Empaque
                                    </th>
                                    <th className="py-2.5 px-4 border-r border-[var(--color-border)] w-32 text-center">
                                      Cantidad
                                    </th>
                                    <th className="py-2.5 px-4 border-r border-[var(--color-border)] w-64">
                                      📍 Área Actual en Planta
                                    </th>
                                    <th className="py-2.5 px-4 w-56">Estado / Seguimiento</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                                  {filteredPendingArrivalItems.map((it) => (
                                    <tr
                                      key={it.id}
                                      className="hover:bg-white/[0.02] transition-colors"
                                    >
                                      <td className="py-2.5 px-4 border-r border-[var(--color-border)] font-mono font-black text-amber-300">
                                        {it.codArticulo}
                                      </td>
                                      <td className="py-2.5 px-4 border-r border-[var(--color-border)] font-bold theme-text-main">
                                        {it.nombre}
                                      </td>
                                      <td className="py-2.5 px-4 border-r border-[var(--color-border)] text-center font-black theme-text-main">
                                        {it.cantidad} unds
                                      </td>
                                      <td className="py-2.5 px-4 border-r border-[var(--color-border)]">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-black text-xs uppercase">
                                          <MapPin size={13} />
                                          {it.areaActual}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 font-semibold theme-text-muted">
                                        <div className="flex items-center gap-1.5">
                                          <Clock size={13} className="text-amber-400 shrink-0" />
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

                  {/* SECCIÓN 3: TABLA DE BULTOS FÍSICOS GENERADOS Y ETIQUETAS QR INDIVIDUALES */}
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-4 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText size={18} className="text-emerald-400" />
                        <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                          3. Bultos Físicos Generados y Códigos QR Individuales ({(activePackingList.packages || []).length} Bultos)
                        </h3>
                      </div>
                      <span className="text-xs theme-text-muted">
                        Cada bulto físico tiene su propio Consecutivo (Bulto X de N) y su etiqueta QR imprimible con la cantidad exacta contenida en ese bulto
                      </span>
                    </div>

                    {(activePackingList.packages || []).length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm font-bold theme-text-muted">
                          Aún no se han generado bultos para este pedido. Usa la calculadora de distribución en la Sección 1 para fraccionar o agrupar los productos en Empaque.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-[var(--color-base)] border-b border-[var(--color-border)] text-[11px] font-black uppercase tracking-wider theme-text-muted">
                              <th className="py-3 px-4 border-r border-[var(--color-border)] w-52">
                                Tipo y Consecutivo de Bulto
                              </th>
                              <th className="py-3 px-4 border-r border-[var(--color-border)] w-40">
                                Código de Producto
                              </th>
                              <th className="py-3 px-4 border-r border-[var(--color-border)]">
                                Nombre del Producto
                              </th>
                              <th className="py-3 px-4 border-r border-[var(--color-border)] w-52 text-center">
                                Cantidad en ESTE Bulto
                              </th>
                              <th className="py-3 px-4 w-56 text-center">
                                Etiqueta QR Individual / Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)] text-xs">
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
                                  Number(item.cantidadEnEsteBulto ?? item.cantidadEmpacada) || 1;
                                const cantTotalItem =
                                  Number(item.cantidadTotalItem ?? item.cantidadTotalPedido) ||
                                  cantBulto;

                                return (
                                  <tr
                                    key={`${pkg.id}_${itemIdx}`}
                                    className="hover:bg-white/[0.02] transition-colors"
                                  >
                                    {isFirstItemOfPkg && (
                                      <td
                                        rowSpan={rowSpanCount}
                                        className="p-4 border-r border-[var(--color-border)] align-top bg-[var(--color-base)]/40"
                                      >
                                        <div className="flex flex-col gap-1.5">
                                          <div className="inline-flex items-center gap-2 flex-wrap">
                                            <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs md:text-sm shadow">
                                              {tipoUpper} #{numPadded}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-amber-300 font-black text-[11px] border border-amber-500/30">
                                              Bulto {pkgIdx + 1} de {totalPackages}
                                            </span>
                                          </div>
                                          <div className="text-[10px] font-mono theme-text-muted">
                                            ID:{' '}
                                            {pkg.codigoUnicoPedido ||
                                              `${activePackingList.pedidoNum}-B${numPadded}`}
                                          </div>
                                          {pkg.observaciones && (
                                            <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-1 rounded-lg mt-1">
                                              Obs: {pkg.observaciones}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    )}

                                    <td className="p-3.5 border-r border-[var(--color-border)] font-mono font-black text-amber-300 align-middle">
                                      {item.codArticulo || 'S/C'}
                                    </td>

                                    <td className="p-3.5 border-r border-[var(--color-border)] font-bold theme-text-main align-middle">
                                      <div>{item.nombre}</div>
                                      {item.transferidoADespachos ? (
                                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                          ✓ Transferido a Despachos (EN ESPERA)
                                        </span>
                                      ) : (
                                        <span className="inline-block mt-1 text-[10px] theme-text-muted font-semibold">
                                          Origen: Área de Empaque
                                        </span>
                                      )}
                                    </td>

                                    <td className="p-3.5 border-r border-[var(--color-border)] text-center align-middle">
                                      <div className="inline-flex flex-col items-center">
                                        <span className="px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-black text-xs md:text-sm">
                                          {cantBulto} de {cantTotalItem} unds
                                        </span>
                                        <span className="text-[10px] theme-text-muted font-bold mt-0.5">
                                          Contenido en este bulto
                                        </span>
                                        {items.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveItemFromPackage(pkg.id, itemIdx)
                                            }
                                            className="text-[10px] text-red-400 hover:underline mt-1"
                                          >
                                            Quitar de este bulto
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    {isFirstItemOfPkg && (
                                      <td
                                        rowSpan={rowSpanCount}
                                        className="p-3.5 align-middle text-center bg-[var(--color-base)]/20"
                                      >
                                        <div className="flex flex-col items-center justify-center gap-2">
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
                                            <QRCodeSVG value={qrPayload} size={84} />
                                            <div className="mt-1 text-[10px] font-black text-indigo-400 group-hover:underline flex items-center justify-center gap-1">
                                              <Eye size={12} /> Ver QR Bulto #{numPadded}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => handlePrint('ROTULOS_QR', pkg)}
                                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
                                            >
                                              <Printer size={12} /> Etiqueta QR
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeletePackage(pkg.id)}
                                              className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-[10px] font-black uppercase transition-colors"
                                              title="Eliminar este bulto"
                                            >
                                              <Trash2 size={12} />
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
                  <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase bg-red-500 text-white tracking-wider">
                    ALERTA PREVENTIVA DE EMPAQUE Y DESPACHOS
                  </span>
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white mt-1">
                    ¡AÚN FALTAN PRODUCTOS DE ESTE PEDIDO POR DESPACHAR!
                  </h3>
                </div>
              </div>

              <div className="bg-red-900/60 border-2 border-red-400/50 rounded-2xl p-4 space-y-3">
                <p className="text-sm md:text-base font-bold text-red-100 leading-relaxed">
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

                <div className="space-y-2 text-xs md:text-sm font-bold bg-black/30 p-3.5 rounded-xl border border-red-400/30">
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

              <div className="bg-amber-500/20 border-2 border-amber-400 rounded-2xl p-4 text-xs md:text-sm font-black text-amber-200 leading-relaxed">
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
                  <span className="text-[10px] font-black uppercase text-amber-400">
                    Etiqueta QR Individual • Bulto {qrPreviewPkg.pkgIdx + 1} de{' '}
                    {qrPreviewPkg.totalPackages}
                  </span>
                  <h4 className="text-lg font-black theme-text-main">
                    PEDIDO #{activePackingList.pedidoNum} • {qrPreviewPkg.pkg.codigoPaquete}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setQrPreviewPkg(null)}
                  className="p-1.5 rounded-xl bg-[var(--color-base)] theme-text-muted hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={qrPreviewPkg.qrPayload}
                  size={230}
                  className="shadow-xl border-4 border-white"
                />
              </div>

              <div className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-2xl p-3 text-left">
                <div className="text-[10px] font-black uppercase text-amber-400 mb-1">
                  Payload del QR (Visible al escanear este bulto físico):
                </div>
                <pre className="text-[11px] font-mono theme-text-main whitespace-pre-wrap leading-relaxed">
                  {qrPreviewPkg.qrPayload}
                </pre>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handlePrint('ROTULOS_QR', qrPreviewPkg.pkg)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Imprimir Etiqueta QR de este Bulto
                </button>
                <button
                  type="button"
                  onClick={() => setQrPreviewPkg(null)}
                  className="px-4 py-2.5 rounded-xl bg-[var(--color-base)] border border-[var(--color-border)] theme-text-main font-black text-xs uppercase"
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
