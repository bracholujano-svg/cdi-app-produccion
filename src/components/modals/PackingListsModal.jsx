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
  Box,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  Eye,
  Calculator,
  ArrowRight,
  Truck,
  SplitSquareVertical,
  PackageCheck
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { generateQRMatrix } from '../../utils/qrGenerator';

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
 * Verifica estrictamente si una orden es elegible para ser listada como pendiente en el Módulo de Empaque:
 * - CONDICIÓN OBLIGATORIA: Su área actual debe ser estrictamente 'EMPAQUE'.
 * - EXCLUSIÓN TOTAL: Se excluye cualquier registro con estado 'DESPACHADO' / 'ENTREGADO'
 *   o que se encuentre en 'ENSAMBLE', 'PINTURA LÍQUIDA', 'PINTURA EN POLVO', 'EBANISTERÍA', 'DESPACHOS' u otra área.
 */
export const isOrderStrictlyInEmpaque = (orderObj) => {
  if (!orderObj || typeof orderObj !== 'object') return false;

  const estadoInterno = String(orderObj.estadoInterno || '').trim().toUpperCase();
  const estadoGeneral = String(orderObj.estado || '').trim().toUpperCase();

  // Exclusión explícita de productos ya despachados o entregados
  if (
    estadoInterno === 'DESPACHADO' ||
    estadoGeneral === 'DESPACHADO' ||
    estadoGeneral === 'ENTREGADO'
  ) {
    return false;
  }

  // Condición obligatoria: área actual estrictamente 'EMPAQUE'
  const areaNorm = normalizeArea(orderObj.areaActual);
  return areaNorm === 'EMPAQUE';
};

/**
 * Renderiza un Código QR ISO/IEC 18004 en SVG vectorial nítido
 */
const QRCodeSVG = ({ value, size = 128, className = '' }) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value || 'CDI');
    } catch (e) {
      console.error('Error generando QR:', e);
      return [[true]];
    }
  }, [value]);

  const moduleCount = matrix.length;
  const quietZone = 2;
  const totalSize = moduleCount + quietZone * 2;

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`bg-white rounded-lg p-1 ${className}`}
    >
      <rect width={totalSize} height={totalSize} fill="#ffffff" />
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
 * Construye el payload oficial del Código QR de un bulto físico individual:
 * - Pedido / Origen y Cliente
 * - Tipo y Consecutivo: Ej. GUACAL #01 (Bulto 1 de 3) o PAQUETE #02 (Bulto 2 de 3)
 * - Código y Nombre del Producto
 * - Cantidad exacta contenida en ESE bulto (ej. Contenido en este bulto: 50 de 150 unds o 1 de 3 unds)
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

  // Pestaña activa de lista de empaque
  const [activeListId, setActiveListId] = useState(() => {
    return packingLists && packingLists.length > 0 ? packingLists[0].id : null;
  });

  // Buscador de pedidos elegibles (estrictamente con ítems en EMPAQUE)
  const [searchPedidoInput, setSearchPedidoInput] = useState('');
  const [showNewListDropdown, setShowNewListDropdown] = useState(false);
  const [isTabsExpanded, setIsTabsExpanded] = useState(true);
  const [filterProductSearch, setFilterProductSearch] = useState('');

  // Estado de la Calculadora de Fraccionamiento y Agrupación por ítem
  // Guardamos un mapa por itemKey con su configuración en tiempo real:
  // { mode: 'LOTES_IGUALES' | 'AGRUPACION_MANUAL', tipoEmpaque: 'Paquete' | 'Guacal' | 'Caja' | 'Estiba', numBultos: 1, undsPorBulto: 1, manualQty: 1, targetPkgId: 'NUEVO', observaciones: '' }
  const [itemCalculators, setItemCalculators] = useState({});

  // Modal de vista ampliada de Código QR
  const [qrPreviewPkg, setQrPreviewPkg] = useState(null);

  // Lista de empaque activa seleccionada
  const activePackingList = useMemo(() => {
    if (!packingLists || packingLists.length === 0) return null;
    const found = packingLists.find((l) => l.id === activeListId);
    return found || packingLists[0];
  }, [packingLists, activeListId]);

  /**
   * 1. FILTRADO ESTRICTO DE PEDIDOS Y PRODUCTOS ELEGIBLES:
   * Solo se listan pedidos cuyos productos están actualmente en el área 'EMPAQUE'
   * y NO tienen estado 'DESPACHADO'.
   */
  const eligibleEmpaqueOrdersSummary = useMemo(() => {
    const map = new Map();

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
          empaqueTotalUnits: 0
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

  // Sugerencias en el buscador superior (solo pedidos con productos en 'EMPAQUE')
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
   * Catálogo estricto de productos del pedido activo:
   * - Incluye únicamente los productos del pedido que están estrictamente en 'EMPAQUE'
   *   (excluyendo 'DESPACHADO', 'ENSAMBLE', 'PINTURA LÍQUIDA', 'EBANISTERÍA', etc.)
   * - También conserva la referencia de los ítems de esta lista que ya fueron 100% empacados
   *   y transferidos a 'DESPACHOS' desde este módulo para mostrar su estado completado,
   *   pero NUNCA como pendientes por empacar.
   */
  const orderProductsInEmpaque = useMemo(() => {
    if (!activePackingList?.pedidoNum) return [];
    const targetPed = String(activePackingList.pedidoNum).trim().toUpperCase();

    // Filtrar estrictamente órdenes de este pedido cuya área actual sea 'EMPAQUE'
    const strictEmpaqueOrders = (orders || []).filter(
      (o) =>
        String(o.pedidoNum || '').trim().toUpperCase() === targetPed &&
        isOrderStrictlyInEmpaque(o)
    );

    const catalogMap = new Map();

    strictEmpaqueOrders.forEach((o) => {
      const cod = String(o.codArticulo || o.codigo_item || 'S/C').trim().toUpperCase();
      const nom = String(o.nombre || 'PRODUCTO SIN NOMBRE').trim().toUpperCase();
      // Usamos el ID de la orden para precisión exacta por registro en Empaque
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

    // Calcular unidades ya asignadas a bultos en esta lista de empaque
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
            mode: 'LOTES_IGUALES', // 'LOTES_IGUALES' (Modo A) | 'AGRUPACION_MANUAL' (Modo B)
            tipoEmpaque: 'Paquete',
            numBultos: item.cantidadPendiente <= 10 ? item.cantidadPendiente : 1,
            undsPorBulto: item.cantidadPendiente <= 10 ? 1 : item.cantidadPendiente,
            manualQty: item.cantidadPendiente,
            targetPkgId: 'NUEVO',
            observaciones: ''
          };
        } else {
          // Ajustar automáticamente si el saldo pendiente disminuyó luego de generar paquetes
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

  // Actualizar un campo de la calculadora de un ítem específico
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

  // Separación estricta:
  // 1) Productos pendientes por empacar en el área 'EMPAQUE' (cantidadPendiente > 0)
  // 2) Productos en 'EMPAQUE' con 100% de sus bultos/QR generados, listos para transferir a 'DESPACHOS'
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

  // Estadísticas globales de empaque del pedido activo
  const packingStats = useMemo(() => {
    const totalReferenciasEnEmpaque = orderProductsInEmpaque.length;
    const referenciasCompletas = completedEmpaqueProductsReadyForDispatch.length;
    const referenciasPendientesCount = pendingEmpaqueProducts.length;

    const totalUnidadesEnEmpaque = orderProductsInEmpaque.reduce(
      (acc, i) => acc + i.cantidadTotalPedido,
      0
    );
    const totalUnidadesEmpacadas = orderProductsInEmpaque.reduce(
      (acc, i) => acc + i.cantidadEmpacada,
      0
    );
    const totalUnidadesPendientes = orderProductsInEmpaque.reduce(
      (acc, i) => acc + i.cantidadPendiente,
      0
    );

    const pctUnidades =
      totalUnidadesEnEmpaque > 0
        ? Math.min(100, Math.round((totalUnidadesEmpacadas / totalUnidadesEnEmpaque) * 100))
        : (activePackingList?.packages || []).length > 0
        ? 100
        : 0;

    return {
      totalReferenciasEnEmpaque,
      referenciasCompletas,
      referenciasPendientesCount,
      totalUnidadesEnEmpaque,
      totalUnidadesEmpacadas,
      totalUnidadesPendientes,
      pctUnidades
    };
  }, [
    orderProductsInEmpaque,
    completedEmpaqueProductsReadyForDispatch,
    pendingEmpaqueProducts,
    activePackingList
  ]);

  // Crear o abrir una Lista de Empaque validando que el pedido tenga ítems en 'EMPAQUE'
  const handleCreateOrOpenPackingList = (pedidoNumRaw, clienteRaw = '') => {
    const pedNum = String(pedidoNumRaw || '').trim().toUpperCase();
    if (!pedNum) return;

    const existing = (packingLists || []).find(
      (l) => String(l.pedidoNum || '').trim().toUpperCase() === pedNum
    );
    if (existing) {
      setActiveListId(existing.id);
      setSearchPedidoInput('');
      setShowNewListDropdown(false);
      return;
    }

    // Verificar que el pedido tenga al menos 1 producto en área 'EMPAQUE' (y no despachado)
    const eligibleSummary = eligibleEmpaqueOrdersSummary.find(
      (s) => s.pedidoNum === pedNum
    );
    if (!eligibleSummary) {
      alert(
        `⚠️ Filtrado Estricto de Planta:\nEl pedido #${pedNum} no tiene productos actualmente en el área de 'EMPAQUE' (pueden estar aún en áreas previas como Ensamble/Pintura o ya fueron Despachados).\n\nSolo se pueden generar listas de empaque para productos ubicados físicamente en 'EMPAQUE'.`
      );
      return;
    }

    const newList = {
      id: `PACKLIST_${pedNum}_${Date.now()}`,
      tipoRegistro: 'PACKING_LIST',
      pedidoNum: pedNum,
      cliente: clienteRaw || eligibleSummary.cliente || 'CLIENTE GENERAL',
      proyecto: eligibleSummary.proyecto || '',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      creadoPor: supervisorProfile?.nombre || 'PLANTA / EMPAQUE',
      nextConsecutive: 1,
      packages: []
    };

    const updated = [newList, ...(packingLists || [])];
    setPackingLists(updated);
    syncPackingListToSupabase(newList);
    setActiveListId(newList.id);
    setSearchPedidoInput('');
    setShowNewListDropdown(false);
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

  /**
   *Re-indexa todos los consecutivos de los paquetes del pedido para que siempre sean
   * consecutivos limpios (#01, #02, #03...) con su etiqueta `Bulto X de Total`.
   */
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
   * 2, 3 y 4. EJECUTAR FRACCIONAMIENTO O AGRUPACIÓN PARA UN PRODUCTO EN 'EMPAQUE':
   * - MODO A ("LOTES_IGUALES"): Genera `N` registros de paquete independientes (ej. 3 paquetes de 1 und, o 3 paquetes de 50 unds),
   *   cada uno con su propio consecutivo y Código QR único indicando `X de Total unds`.
   * - MODO B ("AGRUPACION_MANUAL"): Agrega manualmente `M` unidades del producto dentro de un paquete específico existente o en una nueva Caja/Guacal Mixto.
   * - VALIDACIÓN MATEMÁTICA DE SALDOS: Bloquea cualquier asignación que supere `cantidadPendiente` (`cantidadTotalPedido - cantidadEmpacada`).
   */
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

      // VALIDACIÓN MATEMÁTICA ESTRICTA DE SALDOS
      if (totalUnidadesAGenerar > prod.cantidadPendiente) {
        alert(
          `❌ Error de Saldo Matemático:\nIntentas distribuir ${numBultos} bultos × ${undsPorBulto} unds = ${totalUnidadesAGenerar} unidades, pero el producto [${prod.codArticulo}] solo tiene ${prod.cantidadPendiente} unidades disponibles por empacar (Total del pedido: ${prod.cantidadTotalPedido} unds).`
        );
        return;
      }

      // Generar N registros de bulto físico INDEPENDIENTES, cada uno con su propio QR individual
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

    // Actualizar saldo remanente en la calculadora del ítem
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

  /**
   * 5. TRANSICIÓN DIRECTA A DESPACHOS:
   * Una vez completada y confirmada la Lista de Empaque del producto (100% de sus unidades asignadas a bultos/QR),
   * transfiere los ítems al área de 'Despachos' con estadoInterno 'EN ESPERA' de salida logística.
   */
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

      // Encontrar qué bultos contienen este producto
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

    // Marcar en los ítems de los paquetes que ya fueron transferidos a Despachos
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

  // Eliminar un ítem de un bulto o eliminar el bulto completo
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

  /**
   * 4. IMPRESIÓN DE ETIQUETAS QR POR CADA BULTO FÍSICO Y LISTA DE EMPAQUE OFICIAL:
   * - Genera 1 Etiqueta con Código QR imprimible por cada bulto físico generado
   *   (si de 1 ítem salieron 3 paquetes, se imprimen 3 etiquetas QR distintas).
   * - Cada etiqueta muestra claramente:
   *   * Pedido / Origen y Cliente
   *   * Tipo y Consecutivo: Ej. GUACAL #01 (Bulto 1 de 3) o PAQUETE #02 (Bulto 2 de 3)
   *   * Código y Nombre del Producto
   *   * Cantidad exacta contenida en ESE bulto: "Contenido en este bulto: 50 de 150 unds" o "1 de 3 unds"
   */
  const handlePrint = (mode = 'LISTA_COMPLETA', singlePkg = null) => {
    if (!activePackingList) return;
    const allPackages = activePackingList.packages || [];
    const packagesToPrint = singlePkg ? [singlePkg] : allPackages;

    if (packagesToPrint.length === 0) {
      alert('Aún no hay bultos/paquetes generados en esta lista de empaque para imprimir.');
      return;
    }

    const totalPackagesCount = allPackages.length;

    const renderQRInlineSVG = (text, pxSize = 115) => {
      const mat = generateQRMatrix(text || 'CDI');
      const mCount = mat.length;
      const qz = 2;
      const tot = mCount + qz * 2;
      let rects = `<rect width="${tot}" height="${tot}" fill="#ffffff"/>`;
      for (let r = 0; r < mCount; r++) {
        for (let c = 0; c < mCount; c++) {
          if (mat[r][c]) {
            rects += `<rect x="${c + qz}" y="${r + qz}" width="1" height="1" fill="#000000"/>`;
          }
        }
      }
      return `<svg viewBox="0 0 ${tot} ${tot}" width="${pxSize}" height="${pxSize}" shape-rendering="crispEdges">${rects}</svg>`;
    };

    const printWindow = window.open('', '_blank', 'width=1050,height=820');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir las etiquetas QR o la lista de empaque.');
      return;
    }

    if (mode === 'ROTULOS_QR') {
      const labelsHtml = packagesToPrint
        .map((pkg) => {
          const realIndex = allPackages.findIndex((p) => p.id === pkg.id);
          const idxNumber = realIndex >= 0 ? realIndex : 0;
          const qrText = buildPackageQRText(activePackingList, pkg, idxNumber, totalPackagesCount);
          const qrSvg = renderQRInlineSVG(qrText, 168);
          const tipo = String(pkg.tipoEmpaque || 'PAQUETE').toUpperCase();
          const numPadded = String(pkg.consecutivo || idxNumber + 1).padStart(2, '0');

          const itemsRows = (pkg.items || [])
            .map((it) => {
              const cantBulto = Number(it.cantidadEnEsteBulto ?? it.cantidadEmpacada) || 1;
              const cantTotalItem = Number(it.cantidadTotalItem ?? it.cantidadTotalPedido) || cantBulto;
              return `
                <tr>
                  <td style="font-family: monospace; font-weight: 900; padding: 6px; border-bottom: 1px solid #cbd5e1; font-size: 12px;">
                    ${it.codArticulo || 'S/C'}
                  </td>
                  <td style="padding: 6px; border-bottom: 1px solid #cbd5e1; font-weight: 800; font-size: 12px;">
                    ${it.nombre}
                  </td>
                  <td style="padding: 6px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 900; font-size: 13px; background: #f8fafc;">
                    Contenido en este bulto:<br/>
                    <span style="font-size: 15px; color: #0f172a;">${cantBulto} de ${cantTotalItem} unds</span>
                  </td>
                </tr>
              `;
            })
            .join('');

          return `
            <div class="label-card">
              <div class="label-header">
                <div>
                  <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: #334155;">
                    CDI PRODUCCIÓN • ORIGEN: ÁREA DE EMPAQUE → DESPACHOS
                  </div>
                  <div style="font-size: 26px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                    PEDIDO #${activePackingList.pedidoNum}
                  </div>
                  <div style="font-size: 14px; font-weight: 800; color: #1e293b;">
                    CLIENTE: ${activePackingList.cliente}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="background: #0f172a; color: #ffffff; padding: 8px 14px; border-radius: 10px; font-size: 22px; font-weight: 900;">
                    ${tipo} #${numPadded} (${idxNumber + 1} de ${totalPackagesCount})
                  </div>
                  <div style="font-size: 12px; font-weight: 900; color: #334155; margin-top: 5px;">
                    BULTO FÍSICO ${idxNumber + 1} DE ${totalPackagesCount} DEL PEDIDO
                  </div>
                </div>
              </div>
              <div class="label-body">
                <div class="qr-box">
                  ${qrSvg}
                  <div style="font-size: 9px; font-weight: 900; text-align: center; color: #0f172a; margin-top: 4px;">
                    ESCANEAR QR DEL BULTO #${numPadded}
                  </div>
                </div>
                <div class="items-box">
                  <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #0f172a; padding-bottom: 3px;">
                    DETALLE DE PRODUCTOS CONTENIDOS EN ESTE BULTO FÍSICO
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #e2e8f0;">
                        <th style="text-align: left; padding: 5px 6px; font-size: 10px; width: 22%;">CÓDIGO</th>
                        <th style="text-align: left; padding: 5px 6px; font-size: 10px; width: 46%;">NOMBRE DEL PRODUCTO</th>
                        <th style="text-align: center; padding: 5px 6px; font-size: 10px; width: 32%;">CANTIDAD EN ESTE BULTO</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                  ${
                    pkg.observaciones
                      ? `<div style="margin-top: 8px; font-size: 11px; font-weight: 800; background: #fef3c7; border: 1px solid #f59e0b; padding: 5px 8px; border-radius: 6px;">OBSERVACIÓN: ${pkg.observaciones}</div>`
                      : ''
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Etiquetas QR por Bulto - Pedido #${activePackingList.pedidoNum}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 12px; color: #0f172a; }
              .label-card {
                border: 2.5px solid #0f172a;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 18px;
                page-break-inside: avoid;
              }
              .label-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 8px;
                margin-bottom: 10px;
              }
              .label-body {
                display: flex;
                gap: 16px;
                align-items: flex-start;
              }
              .qr-box {
                flex-shrink: 0;
                border: 1.5px solid #94a3b8;
                padding: 6px;
                border-radius: 8px;
                background: #ffffff;
                width: 178px;
              }
              .items-box {
                flex: 1;
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
        const qrText = buildPackageQRText(activePackingList, pkg, pkgIdx, totalPackagesCount);
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
                        ${pkg.observaciones ? `<div style="font-size: 9px; color: #b45309; margin-top: 3px;">${pkg.observaciones}</div>` : ''}
                      </td>`
                    : ''
                }
                <td style="border: 1px solid #94a3b8; padding: 8px; font-family: monospace; font-weight: 900; font-size: 12px;">
                  ${it.codArticulo || 'S/C'}
                </td>
                <td style="border: 1px solid #94a3b8; padding: 8px; font-weight: 700; font-size: 12px;">
                  ${it.nombre}
                </td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center; font-weight: 900; font-size: 13px;">
                  <div>${cantBulto} de ${cantTotalItem} unds</div>
                  <div style="font-size: 10px; color: #475569; font-weight: 700;">Contenido en este bulto</div>
                </td>
                ${
                  isFirstRow
                    ? `<td rowspan="${rowSpan}" style="border: 1px solid #94a3b8; padding: 6px; text-align: center; vertical-align: middle;">
                        ${qrSvg}
                        <div style="font-size: 9px; font-weight: 800; color: #334155;">Bulto ${pkgIdx + 1}/${totalPackagesCount}</div>
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
      <html>
        <head>
          <title>Lista de Empaque Oficial - Pedido #${activePackingList.pedidoNum}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #0f172a; }
            .header-box {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #0f172a; color: #ffffff; padding: 10px 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
            tr { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #475569;">CDI PRODUCCIÓN • ORIGEN: EMPAQUE → DESPACHOS</div>
              <div style="font-size: 24px; font-weight: 900;">LISTA DE EMPAQUE OFICIAL — PEDIDO #${activePackingList.pedidoNum}</div>
              <div style="font-size: 14px; font-weight: 800; color: #1e293b;">CLIENTE: ${activePackingList.cliente}</div>
            </div>
            <div style="text-align: right; font-size: 12px; font-weight: 700;">
              <div>TOTAL BULTOS FÍSICOS GENERADOS: <strong>${totalPackagesCount}</strong></div>
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

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-5 overflow-hidden">
      <div className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-3xl w-full max-w-[1460px] h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABECERA PRINCIPAL */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
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
                  Filtro Estricto: Solo Área EMPAQUE → DESPACHOS
                </span>
              </div>
              <p className="text-xs theme-text-muted font-medium">
                Solo lista productos ubicados en EMPAQUE (excluye Despachados y áreas previas). Fracciona cantidades en múltiples bultos/guacales con QR individual.
              </p>
            </div>
          </div>

          {/* BUSCADOR DE PEDIDOS CON PRODUCTOS EN 'EMPAQUE' */}
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
                  className="bg-transparent text-xs md:text-sm font-bold theme-text-main focus:outline-none w-52 md:w-64"
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
                          onClick={() => handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between gap-2 border-b border-[var(--color-border)]/40 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-amber-400">#{sug.pedidoNum}</span>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                {sug.empaqueItemsCount} ref ({sug.empaqueTotalUnits} unds) en EMPAQUE
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
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Plus size={16} strokeWidth={2.8} />
              <span>Pedidos en Empaque</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPackingListsModal(false)}
              className="p-2 rounded-xl bg-[var(--color-base)] border border-[var(--color-border)] theme-text-muted hover:text-white hover:border-red-500/50 transition-colors ml-1"
              title="Cerrar Módulo de Empaque"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE PESTAÑAS DE LISTAS DE EMPAQUE ACTIVAS */}
        <div className="bg-[var(--color-surface)]/70 border-b border-[var(--color-border)] px-4 md:px-6 py-2.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setIsTabsExpanded(!isTabsExpanded)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider theme-text-muted hover:text-white"
            >
              <FolderOpen size={15} className="text-amber-500" />
              <span>Listas de Empaque Activas ({(packingLists || []).length})</span>
              {isTabsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <span className="text-[11px] theme-text-muted hidden sm:inline">
              Exclusión activa: No se listan ítems Despachados ni en Ensamble, Pintura o Ebanistería
            </span>
          </div>

          {isTabsExpanded && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {(packingLists || []).length === 0 ? (
                <div className="text-xs theme-text-muted py-1.5 px-3 rounded-xl border border-dashed border-[var(--color-border)]">
                  Selecciona arriba un pedido que tenga productos en el área de <strong>EMPAQUE</strong> para iniciar su fraccionamiento de bultos y códigos QR.
                </div>
              ) : (
                (packingLists || []).map((list) => {
                  const isActive = activePackingList?.id === list.id;
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

        {/* CUERPO PRINCIPAL */}
        {!activePackingList ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
              <Package size={42} />
            </div>
            <h3 className="text-xl font-black uppercase theme-text-main mb-2">
              Pedidos Disponibles en el Área de EMPAQUE
            </h3>
            <p className="text-sm theme-text-muted max-w-xl mb-6">
              Solo aparecen aquí los productos cuya área actual es estrictamente <strong>EMPAQUE</strong> (listos para limpiar, empacar, etiquetar con QR y transferir a <strong>DESPACHOS</strong>).
            </p>
            {eligibleEmpaqueOrdersSummary.length === 0 ? (
              <div className="px-5 py-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs theme-text-muted max-w-md">
                Actualmente no hay ningún producto ubicado en el área de <strong>EMPAQUE</strong>. Cuando un producto ingrese a Empaque desde planta, aparecerá aquí automáticamente.
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl">
                {eligibleEmpaqueOrdersSummary.map((sug) => (
                  <button
                    key={sug.pedidoNum}
                    type="button"
                    onClick={() => handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)}
                    className="px-4 py-3 rounded-2xl bg-[var(--color-surface)] hover:bg-amber-500/15 border border-[var(--color-border)] hover:border-amber-500/50 transition-all text-left shadow"
                  >
                    <div className="font-black text-sm text-amber-400">Pedido #{sug.pedidoNum}</div>
                    <div className="text-xs font-bold theme-text-main truncate max-w-[200px]">
                      {sug.cliente}
                    </div>
                    <div className="text-[10px] font-extrabold text-emerald-400 mt-1">
                      {sug.empaqueItemsCount} producto(s) • {sug.empaqueTotalUnits} unds en EMPAQUE
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
            {/* BARRA DE RESUMEN DEL PEDIDO Y BOTONES DE IMPRESIÓN / TRANSFERENCIA A DESPACHOS */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-2xl font-black text-amber-400">
                      PEDIDO #{activePackingList.pedidoNum}
                    </span>
                    <span className="text-sm md:text-base font-extrabold theme-text-main uppercase">
                      • {activePackingList.cliente}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Empacado: {packingStats.totalUnidadesEmpacadas} / Total en Empaque: {packingStats.totalUnidadesEnEmpaque} unds
                    </span>
                  </div>
                  <p className="text-xs theme-text-muted mt-1">
                    Bultos físicos generados con QR individual:{' '}
                    <strong className="text-amber-400">
                      {(activePackingList.packages || []).length} bultos
                    </strong>{' '}
                    • Productos pendientes por empacar en área EMPAQUE:{' '}
                    <strong className="theme-text-main">
                      {packingStats.referenciasPendientesCount}
                    </strong>
                  </p>
                </div>

                {/* ACCIONES GLOBALES: TRANSFERIR A DESPACHOS E IMPRIMIR ETIQUETAS QR */}
                <div className="flex flex-wrap items-center gap-2">
                  {completedEmpaqueProductsReadyForDispatch.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleTransferToDespachos(completedEmpaqueProductsReadyForDispatch)
                      }
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all animate-pulse"
                    >
                      <Truck size={16} />
                      <span>
                        Transferir {completedEmpaqueProductsReadyForDispatch.length} Producto(s) 100% Empacados a DESPACHOS
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handlePrint('ROTULOS_QR')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all"
                  >
                    <QrCode size={16} />
                    <span>
                      Imprimir {(activePackingList.packages || []).length} Etiquetas QR Individuales
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrint('LISTA_COMPLETA')}
                    className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all"
                  >
                    <Printer size={16} />
                    <span>Imprimir Lista de Empaque</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-slate-700">
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
                      No hay productos pendientes por empacar en el área 'EMPAQUE' para este pedido
                    </div>
                    <p className="text-xs theme-text-muted max-w-xl mx-auto">
                      Todos los ítems que estaban en <strong>EMPAQUE</strong> ya tienen el 100% de sus bultos generados o ya fueron entregados a <strong>DESPACHOS</strong>. (Los productos en áreas previas como Ensamble/Pintura o ya Despachados quedan excluidos).
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
                    const undsPorBulto = Math.max(0, Math.floor(Number(calc.undsPorBulto) || 0));
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
                        {/* ENCABEZADO DEL ÍTEM + INDICADOR VISUAL EN TIEMPO REAL */}
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

                          {/* INDICADOR DE SALDO EN TIEMPO REAL: Empacado: X / Total: Y unidades */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="px-3 py-1.5 rounded-xl bg-[var(--color-surface)] border border-amber-500/40 text-xs font-black">
                              <span className="theme-text-muted">Empacado: </span>
                              <span className="text-emerald-400">{prod.cantidadEmpacada}</span>
                              <span className="theme-text-muted"> / Total: </span>
                              <span className="text-white">{prod.cantidadTotalPedido} unidades</span>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs font-black text-amber-300">
                              Saldo Pendiente: {prod.cantidadPendiente} unds
                            </div>
                          </div>
                        </div>

                        {/* SELECTOR DE MODO DE DISTRIBUCIÓN (MODO A vs MODO B) */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex rounded-xl bg-[var(--color-surface)] p-1 border border-[var(--color-border)]">
                            <button
                              type="button"
                              onClick={() => updateItemCalc(prod.itemKey, { mode: 'LOTES_IGUALES' })}
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
                                updateItemCalc(prod.itemKey, { mode: 'AGRUPACION_MANUAL' })
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

                          {/* ATAJOS RÁPIDOS DE PLANTA PARA MODO A */}
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
                                title="Genera 1 paquete independiente con QR único por cada unidad (ej. 3 muebles -> 3 paquetes de 1 und)"
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

                        {/* CONTROLES DE LA CALCULADORA SEGÚN EL MODO */}
                        {calc.mode === 'LOTES_IGUALES' ? (
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                Tipo de Embalaje
                              </label>
                              <select
                                value={calc.tipoEmpaque}
                                onChange={(e) =>
                                  updateItemCalc(prod.itemKey, { tipoEmpaque: e.target.value })
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
                                  updateItemCalc(prod.itemKey, { numBultos: e.target.value })
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
                                  updateItemCalc(prod.itemKey, { undsPorBulto: e.target.value })
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
                                  updateItemCalc(prod.itemKey, { observaciones: e.target.value })
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
                                  Generar {numBultos} {numBultos === 1 ? 'Bulto' : 'Bultos'} ({totalUnitsToAssign} unds)
                                </span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* MODO B: AGRUPACIÓN MANUAL / CAJA MIXTA */
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-[var(--color-surface)] p-3 rounded-xl border border-[var(--color-border)]">
                            <div className="md:col-span-3">
                              <label className="block text-[10px] font-black uppercase theme-text-muted mb-1">
                                Destino del Empaque Manual
                              </label>
                              <select
                                value={calc.targetPkgId || 'NUEVO'}
                                onChange={(e) =>
                                  updateItemCalc(prod.itemKey, { targetPkgId: e.target.value })
                                }
                                className="w-full bg-[var(--color-base)] border border-[var(--color-border)] rounded-xl px-2.5 py-2 text-xs font-bold theme-text-main"
                              >
                                <option value="NUEVO">+ Crear Nuevo Bulto / Caja Mixta</option>
                                {(activePackingList.packages || []).map((p, idx) => (
                                  <option key={p.id} value={p.id}>
                                    Agregar a {p.codigoPaquete} (Bulto {idx + 1} — {(p.items || []).length} ítems)
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
                                  updateItemCalc(prod.itemKey, { tipoEmpaque: e.target.value })
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
                                  updateItemCalc(prod.itemKey, { manualQty: e.target.value })
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
                                  updateItemCalc(prod.itemKey, { observaciones: e.target.value })
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

                        {/* MENSAJE DE VALIDACIÓN MATEMÁTICA EN TIEMPO REAL */}
                        <div className="flex items-center justify-between text-xs px-1">
                          {exceedsBalance ? (
                            <span className="text-red-400 font-black flex items-center gap-1.5">
                              <AlertTriangle size={14} />
                              Validación de Saldo: Intentas asignar {totalUnitsToAssign} unidades, pero el saldo disponible por empacar es de {prod.cantidadPendiente} unidades (Total pedido: {prod.cantidadTotalPedido}).
                            </span>
                          ) : (
                            <span className="theme-text-muted font-semibold">
                              {calc.mode === 'LOTES_IGUALES' ? (
                                <>
                                  Resultado: Se generarán{' '}
                                  <strong className="text-amber-400">
                                    {numBultos} registros de {calc.tipoEmpaque.toUpperCase()} independientes
                                  </strong>{' '}
                                  con códigos QR únicos, cada uno indicando{' '}
                                  <strong className="text-emerald-400">
                                    "{undsPorBulto} de {prod.cantidadTotalPedido} unds"
                                  </strong>
                                  . Saldo restante tras aplicar:{' '}
                                  <strong>{prod.cantidadPendiente - totalUnitsToAssign} unds</strong>.
                                </>
                              ) : (
                                <>
                                  Resultado: Se asignarán{' '}
                                  <strong className="text-emerald-400">
                                    {manualQty} de {prod.cantidadTotalPedido} unds
                                  </strong>
                                  . Saldo restante tras aplicar:{' '}
                                  <strong>{prod.cantidadPendiente - totalUnitsToAssign} unds</strong>.
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
                        Estos ítems ya tienen el 100% de sus unidades asignadas a bultos/QR y ya no aparecen como pendientes por empacar. Transfiérelos a Despachos (En Espera).
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleTransferToDespachos(completedEmpaqueProductsReadyForDispatch)
                    }
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md"
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
                          ✓ Empacado: {item.cantidadEmpacada} / Total: {item.cantidadTotalPedido} unidades ({item.bultosGenerados} bultos QR)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTransferToDespachos([item])}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-black text-[11px] uppercase flex items-center gap-1 shrink-0 transition-all"
                      >
                        <span>Pasar a Despachos</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 2: TABLA DE BULTOS FÍSICOS GENERADOS Y ETIQUETAS QR INDIVIDUALES */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                    2. Bultos Físicos Generados y Códigos QR Individuales ({(activePackingList.packages || []).length} Bultos)
                  </h3>
                </div>
                <span className="text-xs theme-text-muted">
                  Cada bulto físico tiene su propio Consecutivo (Bulto X de N) y su etiqueta QR imprimible con la cantidad exacta contenida en ese bulto
                </span>
              </div>

              {(activePackingList.packages || []).length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold theme-text-muted">
                    Aún no se han generado bultos para este pedido. Usa la calculadora de distribución arriba para fraccionar o agrupar los productos en Empaque.
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
                        const numPadded = String(pkg.consecutivo || pkgIdx + 1).padStart(2, '0');

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
                                      ID: {pkg.codigoUnicoPedido || `${activePackingList.pedidoNum}-B${numPadded}`}
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
                                      onClick={() => handleRemoveItemFromPackage(pkg.id, itemIdx)}
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
      </div>

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
                  Etiqueta QR Individual • Bulto {qrPreviewPkg.pkgIdx + 1} de {qrPreviewPkg.totalPackages}
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
  );
};

export default PackingListsModal;
