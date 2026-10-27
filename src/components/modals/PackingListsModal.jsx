import React, { useState, useMemo } from 'react';
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
  MapPin,
  FileText,
  Sparkles,
  CheckSquare,
  Square,
  FolderOpen,
  Eye
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { generateQRMatrix } from '../../utils/qrGenerator';

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
 * Construye el texto estructurado que verán los instaladores y el cliente al escanear el QR del paquete
 */
export const buildPackageQRText = (packingList, pkg, pkgIndex, totalPackages) => {
  const pedNum = String(packingList?.pedidoNum || '').trim();
  const cliente = String(packingList?.cliente || 'CLIENTE GENERAL').trim();
  const consecutivo = pkg?.codigoPaquete || `PAQ-${String(pkgIndex + 1).padStart(2, '0')}`;
  const tipoEmpaque = pkg?.tipoEmpaque || 'PAQUETE';
  const items = Array.isArray(pkg?.items) ? pkg.items : [];
  const totalUnidadesPaquete = items.reduce((acc, it) => acc + (Number(it.cantidadEmpacada) || 0), 0);

  const lines = [
    `CDI - CONTROL DE EMPAQUE`,
    `PEDIDO: ${pedNum}`,
    `CLIENTE: ${cliente.slice(0, 38)}`,
    `PAQUETE: ${consecutivo} (${pkgIndex + 1}/${totalPackages}) [${tipoEmpaque}]`,
    `ITEMS EN PAQUETE: ${items.length} REF (${totalUnidadesPaquete} UND)`,
    `--- CONTENIDO ---`
  ];

  items.forEach((it, idx) => {
    const cod = String(it.codArticulo || 'S/C').trim();
    const nom = String(it.nombre || 'PRODUCTO').trim().slice(0, 34);
    const cant = Number(it.cantidadEmpacada) || 1;
    lines.push(`${idx + 1}. [${cod}] ${nom} x${cant}`);
  });

  if (pkg?.observaciones) {
    lines.push(`NOTA: ${String(pkg.observaciones).trim().slice(0, 40)}`);
  }

  return lines.join('\n');
};

const PackingListsModal = () => {
  const {
    orders,
    supabaseData,
    packingLists,
    setPackingLists,
    syncPackingListToSupabase,
    supervisorProfile,
    setShowPackingListsModal
  } = useAppContext();

  // Estado de la pestaña/etiqueta de lista de empaque activa
  const [activeListId, setActiveListId] = useState(() => {
    return packingLists && packingLists.length > 0 ? packingLists[0].id : null;
  });

  // Buscador para abrir o crear nueva lista de empaque por pedido
  const [searchPedidoInput, setSearchPedidoInput] = useState('');
  const [showNewListDropdown, setShowNewListDropdown] = useState(false);

  // Estado para colapsar/desplegar paneles informativos
  const [showPendingPanel, setShowPendingPanel] = useState(true);
  const [showBuilderPanel, setShowBuilderPanel] = useState(true);
  const [isTabsExpanded, setIsTabsExpanded] = useState(true);

  // Estado para armar paquetes progresivamente
  const [selectedItemsMap, setSelectedItemsMap] = useState({});
  const [packingMode, setPackingMode] = useState('AGRUPADO'); // 'AGRUPADO' | 'INDIVIDUAL' | 'EXISTENTE'
  const [targetExistingPkgId, setTargetExistingPkgId] = useState('');
  const [tipoEmpaqueInput, setTipoEmpaqueInput] = useState('GUACAL / PAQUETE');
  const [observacionesPaquete, setObservacionesPaquete] = useState('');
  const [filterProductSearch, setFilterProductSearch] = useState('');

  // Modal de vista previa de Código QR individual
  const [qrPreviewPkg, setQrPreviewPkg] = useState(null);

  // Sincronizar selección de pestaña si cambia packingLists
  const activePackingList = useMemo(() => {
    if (!packingLists || packingLists.length === 0) return null;
    const found = packingLists.find((l) => l.id === activeListId);
    return found || packingLists[0];
  }, [packingLists, activeListId]);

  // Agrupar todos los pedidos disponibles (tanto en planta `orders` como en ERP `supabaseData.pedidos`)
  const availableOrdersSummary = useMemo(() => {
    const map = new Map();

    // 1. Primero cargar desde `orders` (productos activos en planta)
    (orders || []).forEach((o) => {
      const ped = String(o.pedidoNum || '').trim().toUpperCase();
      if (!ped) return;
      if (!map.has(ped)) {
        map.set(ped, {
          pedidoNum: ped,
          cliente: o.cliente || 'SIN CLIENTE',
          proyecto: o.nombre_proyecto || '',
          plantCount: 0,
          despachosCount: 0
        });
      }
      const entry = map.get(ped);
      entry.plantCount += 1;
      if (o.areaActual === 'Despachos') entry.despachosCount += 1;
    });

    // 2. Complementar con `supabaseData.pedidos` (ERP Ribisoft)
    const erpPedidos = Array.isArray(supabaseData?.pedidos) ? supabaseData.pedidos : [];
    erpPedidos.forEach((row) => {
      const ped = String(row.pedido || row.PEDIDO || row.pedido_num || '').trim().toUpperCase();
      if (!ped) return;
      if (!map.has(ped)) {
        map.set(ped, {
          pedidoNum: ped,
          cliente: String(row.cliente || row.CLIENTE || 'SIN CLIENTE').trim().toUpperCase(),
          proyecto: String(row.proyecto || row.PROYECTO || row.nombre_proyecto || '').trim().toUpperCase(),
          plantCount: 0,
          despachosCount: 0
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.despachosCount - a.despachosCount || b.plantCount - a.plantCount);
  }, [orders, supabaseData]);

  // Filtrar sugerencias al buscar pedido para crear lista de empaque
  const filteredOrderSuggestions = useMemo(() => {
    const q = searchPedidoInput.trim().toUpperCase();
    if (!q) {
      return availableOrdersSummary.slice(0, 12);
    }
    return availableOrdersSummary
      .filter(
        (item) =>
          item.pedidoNum.includes(q) ||
          (item.cliente && item.cliente.toUpperCase().includes(q))
      )
      .slice(0, 15);
  }, [availableOrdersSummary, searchPedidoInput]);

  /**
   * Construye el catálogo maestro de productos del pedido activo, combinando:
   * - Lo que está en `orders` (con su `areaActual` exacta en planta y `areas_compartidas`)
   * - Lo que está en el listado de `supabaseData.pedidos` (por si algún ítem del pedido aún no ha sido ingresado a planta)
   */
  const orderProductsCatalog = useMemo(() => {
    if (!activePackingList?.pedidoNum) return [];
    const targetPed = String(activePackingList.pedidoNum).trim().toUpperCase();

    const plantItems = (orders || []).filter(
      (o) => String(o.pedidoNum || '').trim().toUpperCase() === targetPed
    );

    const erpItems = (Array.isArray(supabaseData?.pedidos) ? supabaseData.pedidos : []).filter(
      (r) => String(r.pedido || r.PEDIDO || r.pedido_num || '').trim().toUpperCase() === targetPed
    );

    // Consolidar productos únicos del pedido
    const catalogMap = new Map();

    // Agregar primero los productos que están en planta (`orders`)
    plantItems.forEach((o) => {
      const cod = String(o.codArticulo || o.codigo_item || '').trim().toUpperCase();
      const nom = String(o.nombre || '').trim().toUpperCase();
      const key = `${cod}__${nom}`;

      const areasActivas = new Set();
      if (o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO') {
        areasActivas.add('Despachado');
      } else if (o.areaActual) {
        areasActivas.add(o.areaActual);
      }
      if (Array.isArray(o.areas_compartidas)) {
        o.areas_compartidas.forEach((a) => {
          if (a) areasActivas.add(a);
        });
      }

      if (!catalogMap.has(key)) {
        catalogMap.set(key, {
          itemKey: key,
          orderId: o.id,
          codArticulo: cod || 'S/C',
          nombre: nom || 'PRODUCTO SIN NOMBRE',
          cantidadTotalPedido: Number(o.cantidad) || 1,
          areasPlanta: Array.from(areasActivas),
          estadoInterno: o.estadoInterno || 'En Proceso',
          inPlant: true
        });
      } else {
        const existing = catalogMap.get(key);
        existing.cantidadTotalPedido += Number(o.cantidad) || 1;
        areasActivas.forEach((a) => {
          if (!existing.areasPlanta.includes(a)) existing.areasPlanta.push(a);
        });
      }
    });

    // Verificar si en el ERP (`supabaseData.pedidos`) hay productos de este pedido que aún no estén en `orders`
    // Agrupamos primero el ERP por código+nombre para comparar cantidades
    const erpGrouped = new Map();
    erpItems.forEach((r) => {
      const cod = String(r.articulo || r.ARTICULO || r.codigo_item || r.codArticulo || '').trim().toUpperCase();
      const nom = String(r.nombre || r.NOMBRE || r.descripcion || '').trim().toUpperCase();
      if (!cod && !nom) return;
      const key = `${cod}__${nom}`;
      const cant = Number(r.cantidad || r.CANTIDAD) || 1;
      if (!erpGrouped.has(key)) {
        erpGrouped.set(key, {
          codArticulo: cod || 'S/C',
          nombre: nom || 'PRODUCTO ERP',
          cantidadErp: cant
        });
      } else {
        erpGrouped.get(key).cantidadErp += cant;
      }
    });

    erpGrouped.forEach((erpVal, key) => {
      if (!catalogMap.has(key)) {
        // Intentar cruce solo por nombre si en planta se registró sin código
        const matchByName = Array.from(catalogMap.values()).find(
          (c) => c.nombre === erpVal.nombre
        );
        if (matchByName) {
          if (matchByName.codArticulo === 'S/C' && erpVal.codArticulo !== 'S/C') {
            matchByName.codArticulo = erpVal.codArticulo;
          }
          if (erpVal.cantidadErp > matchByName.cantidadTotalPedido) {
            matchByName.cantidadTotalPedido = erpVal.cantidadErp;
          }
        } else {
          catalogMap.set(key, {
            itemKey: key,
            orderId: null,
            codArticulo: erpVal.codArticulo,
            nombre: erpVal.nombre,
            cantidadTotalPedido: erpVal.cantidadErp,
            areasPlanta: ['En Programación / Sin ingresar a planta'],
            estadoInterno: 'Pendiente Ingreso',
            inPlant: false
          });
        }
      } else {
        const existing = catalogMap.get(key);
        if (erpVal.cantidadErp > existing.cantidadTotalPedido) {
          existing.cantidadTotalPedido = erpVal.cantidadErp;
        }
      }
    });

    // Calcular cuánto se ha empacado ya de cada producto en los paquetes de esta lista
    const packedCountByKey = new Map();
    const packages = Array.isArray(activePackingList?.packages) ? activePackingList.packages : [];
    packages.forEach((pkg) => {
      (pkg.items || []).forEach((it) => {
        const k = it.itemKey || `${String(it.codArticulo || '').trim().toUpperCase()}__${String(it.nombre || '').trim().toUpperCase()}`;
        packedCountByKey.set(k, (packedCountByKey.get(k) || 0) + (Number(it.cantidadEmpacada) || 0));
      });
    });

    return Array.from(catalogMap.values()).map((item) => {
      const cantidadEmpacada = packedCountByKey.get(item.itemKey) || 0;
      const cantidadPendiente = Math.max(0, item.cantidadTotalPedido - cantidadEmpacada);
      return {
        ...item,
        cantidadEmpacada,
        cantidadPendiente,
        isFullyPacked: cantidadPendiente === 0 && item.cantidadTotalPedido > 0
      };
    });
  }, [activePackingList, orders, supabaseData]);

  // Estadísticas globales del pedido activo (Conteo de Empaque vs Pendientes por Área)
  const packingStats = useMemo(() => {
    const totalReferencias = orderProductsCatalog.length;
    const referenciasCompletas = orderProductsCatalog.filter((i) => i.isFullyPacked).length;
    const referenciasPendientes = orderProductsCatalog.filter((i) => i.cantidadPendiente > 0);

    const totalUnidadesPedido = orderProductsCatalog.reduce((acc, i) => acc + i.cantidadTotalPedido, 0);
    const totalUnidadesEmpacadas = orderProductsCatalog.reduce((acc, i) => acc + i.cantidadEmpacada, 0);
    const totalUnidadesPendientes = orderProductsCatalog.reduce((acc, i) => acc + i.cantidadPendiente, 0);

    // Desglose de productos pendientes por área actual
    const pendingByArea = {};
    referenciasPendientes.forEach((item) => {
      const areas = item.areasPlanta && item.areasPlanta.length > 0 ? item.areasPlanta : ['Despachos'];
      areas.forEach((area) => {
        pendingByArea[area] = (pendingByArea[area] || 0) + item.cantidadPendiente;
      });
    });

    const pctUnidades =
      totalUnidadesPedido > 0
        ? Math.min(100, Math.round((totalUnidadesEmpacadas / totalUnidadesPedido) * 100))
        : 0;

    return {
      totalReferencias,
      referenciasCompletas,
      referenciasPendientes,
      totalUnidadesPedido,
      totalUnidadesEmpacadas,
      totalUnidadesPendientes,
      pendingByArea,
      pctUnidades
    };
  }, [orderProductsCatalog]);

  // Crear o abrir una lista de empaque para un número de pedido
  const handleCreateOrOpenPackingList = (pedidoNumRaw, clienteRaw = '') => {
    const pedNum = String(pedidoNumRaw || '').trim().toUpperCase();
    if (!pedNum) return;

    // Verificar si ya existe una lista para este pedido
    const existing = (packingLists || []).find(
      (l) => String(l.pedidoNum || '').trim().toUpperCase() === pedNum
    );
    if (existing) {
      setActiveListId(existing.id);
      setSearchPedidoInput('');
      setShowNewListDropdown(false);
      setSelectedItemsMap({});
      return;
    }

    // Buscar datos del cliente desde orders o ERP
    const summaryInfo = availableOrdersSummary.find((s) => s.pedidoNum === pedNum);
    const resolvedCliente =
      clienteRaw ||
      summaryInfo?.cliente ||
      'CLIENTE GENERAL';

    const newList = {
      id: `PACKLIST_${pedNum}_${Date.now()}`,
      tipoRegistro: 'PACKING_LIST',
      pedidoNum: pedNum,
      cliente: resolvedCliente,
      proyecto: summaryInfo?.proyecto || '',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      creadoPor: supervisorProfile?.nombre || 'PLANTA / EMPAQUE',
      nextConsecutive: 1,
      packages: [] // Inicia vacío para ir agregando a medida que se van empacando
    };

    const updated = [newList, ...(packingLists || [])];
    setPackingLists(updated);
    syncPackingListToSupabase(newList);
    setActiveListId(newList.id);
    setSearchPedidoInput('');
    setShowNewListDropdown(false);
    setSelectedItemsMap({});
  };

  // Eliminar una lista de empaque completa
  const handleDeletePackingList = (listObj, e) => {
    if (e) e.stopPropagation();
    if (!listObj) return;
    const confirmDelete = window.confirm(
      `¿Estás seguro de eliminar la Lista de Empaque del pedido #${listObj.pedidoNum}?`
    );
    if (!confirmDelete) return;

    const remaining = (packingLists || []).filter((l) => l.id !== listObj.id);
    setPackingLists(remaining);
    syncPackingListToSupabase(listObj, true);
    if (activeListId === listObj.id) {
      setActiveListId(remaining[0]?.id || null);
    }
  };

  // Seleccionar/deseleccionar un producto pendiente para empacar
  const toggleSelectProductToPack = (product) => {
    if (product.cantidadPendiente <= 0) return;
    setSelectedItemsMap((prev) => {
      const next = { ...prev };
      if (next[product.itemKey]) {
        delete next[product.itemKey];
      } else {
        next[product.itemKey] = product.cantidadPendiente;
      }
      return next;
    });
  };

  const updateSelectedQty = (itemKey, newQty, maxPending) => {
    const num = Math.max(1, Math.min(Number(maxPending) || 1, Number(newQty) || 1));
    setSelectedItemsMap((prev) => ({
      ...prev,
      [itemKey]: num
    }));
  };

  // Agregar los productos seleccionados como Paquete(s) a la Lista de Empaque activa
  const handleCreatePackagesFromSelection = () => {
    if (!activePackingList) return;
    const selectedKeys = Object.keys(selectedItemsMap);
    if (selectedKeys.length === 0) {
      alert('Selecciona al menos un producto pendiente para empacar.');
      return;
    }

    const itemsToPack = selectedKeys
      .map((key) => {
        const prod = orderProductsCatalog.find((p) => p.itemKey === key);
        if (!prod || prod.cantidadPendiente <= 0) return null;
        const qty = Math.min(prod.cantidadPendiente, Number(selectedItemsMap[key]) || 1);
        return {
          itemKey: prod.itemKey,
          codArticulo: prod.codArticulo,
          nombre: prod.nombre,
          cantidadTotalPedido: prod.cantidadTotalPedido,
          cantidadEmpacada: qty,
          areaOrigen: (prod.areasPlanta || []).join(', ')
        };
      })
      .filter(Boolean);

    if (itemsToPack.length === 0) return;

    const currentPackages = Array.isArray(activePackingList.packages)
      ? [...activePackingList.packages]
      : [];
    let nextNum = Number(activePackingList.nextConsecutive) || currentPackages.length + 1;

    if (packingMode === 'EXISTENTE' && targetExistingPkgId) {
      const pkgIdx = currentPackages.findIndex((p) => p.id === targetExistingPkgId);
      if (pkgIdx === -1) {
        alert('Selecciona un paquete existente válido.');
        return;
      }
      const updatedPkg = { ...currentPackages[pkgIdx] };
      const existingItems = Array.isArray(updatedPkg.items) ? [...updatedPkg.items] : [];

      itemsToPack.forEach((newItem) => {
        const sameIdx = existingItems.findIndex((i) => i.itemKey === newItem.itemKey);
        if (sameIdx >= 0) {
          existingItems[sameIdx] = {
            ...existingItems[sameIdx],
            cantidadEmpacada:
              (Number(existingItems[sameIdx].cantidadEmpacada) || 0) + newItem.cantidadEmpacada
          };
        } else {
          existingItems.push(newItem);
        }
      });

      updatedPkg.items = existingItems;
      if (observacionesPaquete.trim()) {
        updatedPkg.observaciones = observacionesPaquete.trim().toUpperCase();
      }
      currentPackages[pkgIdx] = updatedPkg;
    } else if (packingMode === 'INDIVIDUAL') {
      // Un paquete consecutivo por cada producto seleccionado
      itemsToPack.forEach((item) => {
        const codeStr = `PAQ-${String(nextNum).padStart(2, '0')}`;
        currentPackages.push({
          id: `PKG_${activePackingList.pedidoNum}_${nextNum}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          consecutivo: nextNum,
          codigoPaquete: codeStr,
          codigoUnicoPedido: `${activePackingList.pedidoNum}-${codeStr}`,
          tipoEmpaque: tipoEmpaqueInput || 'PAQUETE INDIVIDUAL',
          observaciones: observacionesPaquete.trim().toUpperCase(),
          fechaEmpaque: new Date().toISOString(),
          empacadoPor: supervisorProfile?.nombre || 'EMPAQUE',
          items: [item]
        });
        nextNum += 1;
      });
    } else {
      // Modo AGRUPADO: todos los productos seleccionados van juntos en un mismo Paquete / Guacal
      const codeStr = `PAQ-${String(nextNum).padStart(2, '0')}`;
      currentPackages.push({
        id: `PKG_${activePackingList.pedidoNum}_${nextNum}_${Date.now()}`,
        consecutivo: nextNum,
        codigoPaquete: codeStr,
        codigoUnicoPedido: `${activePackingList.pedidoNum}-${codeStr}`,
        tipoEmpaque: tipoEmpaqueInput || 'GUACAL / PAQUETE',
        observaciones: observacionesPaquete.trim().toUpperCase(),
        fechaEmpaque: new Date().toISOString(),
        empacadoPor: supervisorProfile?.nombre || 'EMPAQUE',
        items: itemsToPack
      });
      nextNum += 1;
    }

    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: nextNum,
      packages: currentPackages
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);
    setSelectedItemsMap({});
    setObservacionesPaquete('');
  };

  // Eliminar un ítem específico de un paquete o el paquete completo si queda vacío
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

    // Re-enumerar consecutivos limpios PAQ-01, PAQ-02... para mantener orden consecutivo del pedido
    const reindexedPackages = updatedPackages.map((pkg, idx) => {
      const num = idx + 1;
      const codeStr = `PAQ-${String(num).padStart(2, '0')}`;
      return {
        ...pkg,
        consecutivo: num,
        codigoPaquete: codeStr,
        codigoUnicoPedido: `${activePackingList.pedidoNum}-${codeStr}`
      };
    });

    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: reindexedPackages.length + 1,
      packages: reindexedPackages
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);
  };

  // Eliminar un paquete entero
  const handleDeletePackage = (pkgId) => {
    if (!activePackingList) return;
    if (!window.confirm('¿Deseas desarmar y eliminar este paquete de la lista? Los productos volverán a quedar pendientes por empacar.')) {
      return;
    }
    const updatedPackages = (activePackingList.packages || [])
      .filter((p) => p.id !== pkgId)
      .map((pkg, idx) => {
        const num = idx + 1;
        const codeStr = `PAQ-${String(num).padStart(2, '0')}`;
        return {
          ...pkg,
          consecutivo: num,
          codigoPaquete: codeStr,
          codigoUnicoPedido: `${activePackingList.pedidoNum}-${codeStr}`
        };
      });

    const updatedList = {
      ...activePackingList,
      actualizadoEn: new Date().toISOString(),
      nextConsecutive: updatedPackages.length + 1,
      packages: updatedPackages
    };

    setPackingLists((prev) => prev.map((l) => (l.id === updatedList.id ? updatedList : l)));
    syncPackingListToSupabase(updatedList);
  };

  // Imprimir Lista de Empaque Oficial o Rótulos QR
  const handlePrint = (mode = 'LISTA_COMPLETA', singlePkg = null) => {
    if (!activePackingList) return;
    const packages = singlePkg ? [singlePkg] : activePackingList.packages || [];
    if (packages.length === 0) {
      alert('Aún no hay paquetes registrados en esta lista de empaque para imprimir.');
      return;
    }

    const totalPackagesCount = (activePackingList.packages || []).length;

    const renderQRInlineSVG = (text, pxSize = 110) => {
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

    const printWindow = window.open('', '_blank', 'width=1050,height=800');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para imprimir los rótulos o la lista de empaque.');
      return;
    }

    if (mode === 'ROTULOS_QR') {
      const labelsHtml = packages
        .map((pkg) => {
          const realIndex = (activePackingList.packages || []).findIndex((p) => p.id === pkg.id);
          const idxNumber = realIndex >= 0 ? realIndex : 0;
          const qrText = buildPackageQRText(activePackingList, pkg, idxNumber, totalPackagesCount);
          const qrSvg = renderQRInlineSVG(qrText, 165);
          const totalUnds = (pkg.items || []).reduce((acc, it) => acc + (Number(it.cantidadEmpacada) || 0), 0);

          const itemsRows = (pkg.items || [])
            .map(
              (it) => `
              <tr>
                <td style="font-family: monospace; font-weight: 800; padding: 4px 6px; border-bottom: 1px solid #cbd5e1; font-size: 11px;">${it.codArticulo || 'S/C'}</td>
                <td style="padding: 4px 6px; border-bottom: 1px solid #cbd5e1; font-weight: 700; font-size: 11px;">${it.nombre}</td>
                <td style="padding: 4px 6px; border-bottom: 1px solid #cbd5e1; text-align: center; font-weight: 900; font-size: 12px;">${it.cantidadEmpacada}</td>
              </tr>`
            )
            .join('');

          return `
            <div class="label-card">
              <div class="label-header">
                <div>
                  <div style="font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #334155;">CDI PRODUCCIÓN • RÓTULO DE EMPAQUE</div>
                  <div style="font-size: 24px; font-weight: 900; color: #0f172a;">PEDIDO #${activePackingList.pedidoNum}</div>
                  <div style="font-size: 13px; font-weight: 800; color: #1e293b;">CLIENTE: ${activePackingList.cliente}</div>
                </div>
                <div style="text-align: right;">
                  <div style="background: #0f172a; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 22px; font-weight: 900;">
                    ${pkg.codigoPaquete}
                  </div>
                  <div style="font-size: 11px; font-weight: 800; color: #475569; margin-top: 4px;">
                    PAQUETE ${idxNumber + 1} DE ${totalPackagesCount} • ${pkg.tipoEmpaque || 'PAQUETE'}
                  </div>
                </div>
              </div>
              <div class="label-body">
                <div class="qr-box">
                  ${qrSvg}
                  <div style="font-size: 9px; font-weight: 800; text-align: center; color: #334155; margin-top: 4px;">
                    ESCANEAR PARA VERIFICAR CONTENIDO
                  </div>
                </div>
                <div class="items-box">
                  <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin-bottom: 4px; border-bottom: 2px solid #0f172a; padding-bottom: 2px;">
                    CONTENIDO DEL PAQUETE (${(pkg.items || []).length} PRODUCTOS / ${totalUnds} UNIDADES)
                  </div>
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background: #f1f5f9;">
                        <th style="text-align: left; padding: 4px 6px; font-size: 10px;">CÓDIGO</th>
                        <th style="text-align: left; padding: 4px 6px; font-size: 10px;">PRODUCTO</th>
                        <th style="text-align: center; padding: 4px 6px; font-size: 10px;">CANT.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                  ${pkg.observaciones ? `<div style="margin-top: 6px; font-size: 11px; font-weight: 700; background: #fef3c7; padding: 4px 8px; border-radius: 4px;">OBS: ${pkg.observaciones}</div>` : ''}
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Rótulos QR - Pedido #${activePackingList.pedidoNum}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 12px; color: #0f172a; }
              .label-card {
                border: 2.5px solid #0f172a;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 16px;
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
                gap: 14px;
                align-items: flex-start;
              }
              .qr-box {
                flex-shrink: 0;
                border: 1px solid #cbd5e1;
                padding: 6px;
                border-radius: 8px;
                background: #ffffff;
                width: 175px;
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

    // MODO LISTA DE EMPAQUE OFICIAL COMPLETA (TABLA SEPARADA POR COLUMNAS)
    const tableRowsHtml = (activePackingList.packages || [])
      .map((pkg, pkgIdx) => {
        const items = pkg.items || [];
        const qrText = buildPackageQRText(activePackingList, pkg, pkgIdx, totalPackagesCount);
        const qrSvg = renderQRInlineSVG(qrText, 78);

        return items
          .map((it, itemIdx) => {
            const isFirstRow = itemIdx === 0;
            const rowSpan = items.length;
            return `
              <tr>
                ${
                  isFirstRow
                    ? `<td rowspan="${rowSpan}" style="border: 1px solid #94a3b8; padding: 8px; text-align: center; vertical-align: middle; background: #f8fafc;">
                        <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${pkg.codigoPaquete}</div>
                        <div style="font-size: 10px; font-weight: 700; color: #475569; margin-top: 2px;">${pkg.tipoEmpaque || 'PAQUETE'}</div>
                        <div style="font-size: 10px; font-weight: 800; color: #0284c7; margin-top: 2px;">${items.length} ítem(s)</div>
                        ${pkg.observaciones ? `<div style="font-size: 9px; color: #b45309; margin-top: 3px;">${pkg.observaciones}</div>` : ''}
                      </td>`
                    : ''
                }
                <td style="border: 1px solid #94a3b8; padding: 8px; font-family: monospace; font-weight: 800; font-size: 12px;">
                  ${it.codArticulo || 'S/C'}
                </td>
                <td style="border: 1px solid #94a3b8; padding: 8px; font-weight: 700; font-size: 12px;">
                  ${it.nombre}
                </td>
                <td style="border: 1px solid #94a3b8; padding: 8px; text-align: center; font-weight: 900; font-size: 14px;">
                  ${it.cantidadEmpacada}
                </td>
                ${
                  isFirstRow
                    ? `<td rowspan="${rowSpan}" style="border: 1px solid #94a3b8; padding: 6px; text-align: center; vertical-align: middle;">
                        ${qrSvg}
                        <div style="font-size: 9px; font-weight: 800; color: #334155;">${pkg.codigoUnicoPedido}</div>
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
            th { background: #0f172a; color: #ffffff; padding: 10px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #0f172a; }
            tr { page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #475569;">CDI PRODUCCIÓN • CONTROL LOGÍSTICO Y DESPACHOS</div>
              <div style="font-size: 26px; font-weight: 900;">LISTA DE EMPAQUE OFICIAL — PEDIDO #${activePackingList.pedidoNum}</div>
              <div style="font-size: 14px; font-weight: 800; color: #1e293b;">CLIENTE: ${activePackingList.cliente}</div>
            </div>
            <div style="text-align: right; font-size: 12px; font-weight: 700;">
              <div>TOTAL PAQUETES / GUACALES: <strong>${totalPackagesCount}</strong></div>
              <div>UNIDADES EMPACADAS: <strong>${packingStats.totalUnidadesEmpacadas} / ${packingStats.totalUnidadesPedido}</strong></div>
              <div>FECHA: ${new Date().toLocaleDateString('es-CO')}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 16%;">N° PAQUETE / CONSECUTIVO</th>
                <th style="width: 18%; text-align: left;">CÓDIGO DE PRODUCTO</th>
                <th style="width: 42%; text-align: left;">NOMBRE DEL PRODUCTO</th>
                <th style="width: 10%;">CANTIDAD</th>
                <th style="width: 14%;">CÓDIGO QR PAQUETE</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <div style="margin-top: 32px; display: flex; justify-content: space-between; gap: 30px; font-size: 12px; font-weight: 700;">
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              ELABORADO POR (EMPAQUE / PLANTA)
            </div>
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              VERIFICADO POR (DESPACHOS / CALIDAD)
            </div>
            <div style="flex: 1; border-top: 1.5px solid #334155; padding-top: 6px; text-align: center;">
              RECIBIDO CONFORME (TRANSPORTADOR / CLIENTE)
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

  // Productos pendientes filtrados en el constructor de paquetes
  const filteredPendingProducts = useMemo(() => {
    const q = filterProductSearch.trim().toUpperCase();
    return orderProductsCatalog.filter((item) => {
      if (item.cantidadPendiente <= 0) return false;
      if (!q) return true;
      return (
        item.codArticulo.toUpperCase().includes(q) ||
        item.nombre.toUpperCase().includes(q) ||
        (item.areasPlanta || []).some((a) => a.toUpperCase().includes(q))
      );
    });
  }, [orderProductsCatalog, filterProductSearch]);

  const selectedCount = Object.keys(selectedItemsMap).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-5 overflow-hidden">
      <div className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-3xl w-full max-w-[1440px] h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* CABECERA PRINCIPAL */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-inner">
              <Package size={24} strokeWidth={2.3} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight theme-text-main">
                  Módulo de Listas de Empaque y Rótulos QR
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  Control Anti-Olvido • Planta y Despachos
                </span>
              </div>
              <p className="text-xs theme-text-muted font-medium">
                Gestiona varias listas de empaque simultáneamente, agrupa productos por paquete o guacal y genera códigos QR para instaladores y clientes.
              </p>
            </div>
          </div>

          {/* BUSCADOR PARA CREAR O ABRIR LISTA DE EMPAQUE POR PEDIDO */}
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
                  placeholder="N° Pedido (ej. 63577) o Cliente..."
                  className="bg-transparent text-xs md:text-sm font-bold theme-text-main focus:outline-none w-48 md:w-64"
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

              {/* DESPLEGABLE DE SUGERENCIAS DE PEDIDOS */}
              {showNewListDropdown && (
                <div className="absolute right-0 mt-1.5 w-80 md:w-96 max-h-80 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-50 p-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--color-border)] mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider theme-text-muted">
                      Selecciona un Pedido para Crear / Abrir su Lista
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewListDropdown(false)}
                      className="text-xs theme-text-muted hover:text-white"
                    >
                      Cerrar
                    </button>
                  </div>
                  {searchPedidoInput.trim() && (
                    <button
                      type="button"
                      onClick={() => handleCreateOrOpenPackingList(searchPedidoInput)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 text-xs font-black flex items-center justify-between mb-1.5"
                    >
                      <span>+ Abrir / Crear Lista para Pedido #{searchPedidoInput.trim().toUpperCase()}</span>
                      <Plus size={15} />
                    </button>
                  )}
                  {filteredOrderSuggestions.map((sug) => {
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
                            {alreadyOpen && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                Lista Activa
                              </span>
                            )}
                            {sug.despachosCount > 0 && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                {sug.despachosCount} en Despachos
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold theme-text-main truncate">
                            {sug.cliente}
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-1 rounded-lg bg-[var(--color-base)] border border-[var(--color-border)] theme-text-muted shrink-0">
                          {alreadyOpen ? 'Abrir' : '+ Crear Lista'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (searchPedidoInput.trim()) {
                  handleCreateOrOpenPackingList(searchPedidoInput);
                } else {
                  setShowNewListDropdown((prev) => !prev);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition-all"
            >
              <Plus size={16} strokeWidth={2.8} />
              <span>Nueva Lista</span>
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

        {/* BARRA DE ETIQUETAS / PESTAÑAS DESPLEGABLES DE LISTAS DE EMPAQUE SIMULTÁNEAS */}
        <div className="bg-[var(--color-surface)]/70 border-b border-[var(--color-border)] px-4 md:px-6 py-2.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setIsTabsExpanded(!isTabsExpanded)}
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider theme-text-muted hover:text-white"
            >
              <FolderOpen size={15} className="text-amber-500" />
              <span>
                Etiquetas de Listas de Empaque Activas ({(packingLists || []).length})
              </span>
              {isTabsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <span className="text-[11px] theme-text-muted hidden sm:inline">
              Haz clic en cualquier etiqueta para alternar entre los pedidos que se están empacando al mismo tiempo
            </span>
          </div>

          {isTabsExpanded && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {(packingLists || []).length === 0 ? (
                <div className="text-xs theme-text-muted py-1.5 px-3 rounded-xl border border-dashed border-[var(--color-border)] flex items-center gap-2">
                  <span>No hay listas de empaque abiertas. Usa el buscador superior para abrir un pedido (ej. 63577 o 63870).</span>
                </div>
              ) : (
                (packingLists || []).map((list) => {
                  const isActive = activePackingList?.id === list.id;
                  const pkgCount = Array.isArray(list.packages) ? list.packages.length : 0;
                  const totalPackedUnits = (list.packages || []).reduce(
                    (acc, p) =>
                      acc +
                      (p.items || []).reduce((s, it) => s + (Number(it.cantidadEmpacada) || 0), 0),
                    0
                  );

                  return (
                    <div
                      key={list.id}
                      onClick={() => {
                        setActiveListId(list.id);
                        setSelectedItemsMap({});
                      }}
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
                            {pkgCount} {pkgCount === 1 ? 'Paquete' : 'Paquetes'}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold truncate max-w-[180px] theme-text-main">
                          {list.cliente}
                        </div>
                        <div className="text-[10px] theme-text-muted font-semibold">
                          {totalPackedUnits} unds empacadas
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
              Selecciona o Crea una Lista de Empaque
            </h3>
            <p className="text-sm theme-text-muted max-w-lg mb-6">
              Escribe el número de pedido arriba o selecciona uno de los pedidos activos en Despachos / Planta para iniciar el empaque progresivo y generar sus códigos QR por paquete.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
              {availableOrdersSummary.slice(0, 8).map((sug) => (
                <button
                  key={sug.pedidoNum}
                  type="button"
                  onClick={() => handleCreateOrOpenPackingList(sug.pedidoNum, sug.cliente)}
                  className="px-4 py-2.5 rounded-2xl bg-[var(--color-surface)] hover:bg-amber-500/15 border border-[var(--color-border)] hover:border-amber-500/50 transition-all text-left"
                >
                  <div className="font-black text-sm text-amber-400">Pedido #{sug.pedidoNum}</div>
                  <div className="text-xs font-bold theme-text-main truncate max-w-[190px]">
                    {sug.cliente}
                  </div>
                  <div className="text-[10px] font-extrabold text-emerald-400 mt-0.5">
                    {sug.despachosCount > 0
                      ? `${sug.despachosCount} en Despachos`
                      : `${sug.plantCount} en Planta`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
            {/* TARJETA DE RESUMEN DEL PEDIDO ACTIVO + ALERTA ANTI-OLVIDO */}
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
                    {packingStats.totalUnidadesPendientes === 0 && packingStats.totalUnidadesPedido > 0 ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle size={14} /> Pedido 100% Empacado Completo
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                        <AlertTriangle size={14} /> Faltan {packingStats.totalUnidadesPendientes} Unidades ({packingStats.referenciasPendientes.length} Productos) por Empacar
                      </span>
                    )}
                  </div>
                  <p className="text-xs theme-text-muted mt-1">
                    Avance del pedido:{' '}
                    <strong className="theme-text-main">
                      {packingStats.totalUnidadesEmpacadas} de {packingStats.totalUnidadesPedido} unidades empacadas
                    </strong>{' '}
                    ({packingStats.referenciasCompletas} de {packingStats.totalReferencias} referencias listas en{' '}
                    <strong className="text-amber-400">
                      {(activePackingList.packages || []).length} paquetes/guacales
                    </strong>
                    ).
                  </p>
                </div>

                {/* BOTONES DE IMPRESIÓN RÁPIDA */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrint('ROTULOS_QR')}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all"
                  >
                    <QrCode size={16} />
                    <span>Imprimir Rótulos QR ({(activePackingList.packages || []).length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrint('LISTA_COMPLETA')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all"
                  >
                    <Printer size={16} />
                    <span>Imprimir Lista de Empaque</span>
                  </button>
                </div>
              </div>

              {/* BARRA DE PROGRESO */}
              <div className="mt-3 w-full bg-slate-800/80 h-3 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-300 ${
                    packingStats.pctUnidades === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${packingStats.pctUnidades}%` }}
                />
              </div>

              {/* DESGLOSE DE DÓNDE ESTÁN LOS PRODUCTOS QUE FALTAN POR EMPACAR */}
              {packingStats.referenciasPendientes.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1">
                      <MapPin size={14} /> Ubicación actual de lo que falta por empacar:
                    </span>
                    {Object.entries(packingStats.pendingByArea).map(([areaName, count]) => (
                      <span
                        key={areaName}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[var(--color-base)] border border-[var(--color-border)] theme-text-main"
                      >
                        {count} unds en <strong className="text-amber-400 uppercase">{areaName}</strong>
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPendingPanel(!showPendingPanel)}
                    className="text-xs font-black text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <span>{showPendingPanel ? 'Ocultar detalle de pendientes' : 'Ver productos pendientes'}</span>
                    {showPendingPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* SECCIÓN 1: CONSTRUCTOR DE PAQUETES Y CONTROL DE PRODUCTOS PENDIENTES POR EMPACAR */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
              <div
                onClick={() => setShowBuilderPanel(!showBuilderPanel)}
                className="px-4 py-3 bg-amber-500/10 border-b border-[var(--color-border)] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Box size={18} className="text-amber-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                    1. Armar Nuevo Paquete / Guacal (Productos Pendientes por Empacar del Pedido #{activePackingList.pedidoNum})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-amber-400">
                    Próximo Consecutivo: PAQ-{String(activePackingList.nextConsecutive || (activePackingList.packages || []).length + 1).padStart(2, '0')}
                  </span>
                  {showBuilderPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {showBuilderPanel && (
                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* COLUMNA IZQUIERDA (7 cols): PRODUCTOS PENDIENTES DEL PEDIDO Y SU ÁREA ACTUAL */}
                  <div className="lg:col-span-7 flex flex-col border border-[var(--color-border)] rounded-2xl bg-[var(--color-base)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div>
                        <h4 className="text-xs font-black uppercase theme-text-main">
                          Productos Pendientes por Empacar ({filteredPendingProducts.length})
                        </h4>
                        <p className="text-[11px] theme-text-muted">
                          Marca los productos que vas a meter en el paquete o guacal a medida que los empacas:
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={filterProductSearch}
                          onChange={(e) => setFilterProductSearch(e.target.value)}
                          placeholder="Filtrar por código, nombre o área..."
                          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-2.5 py-1 text-xs theme-text-main focus:outline-none focus:border-amber-500"
                        />
                        {filteredPendingProducts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (selectedCount === filteredPendingProducts.length) {
                                setSelectedItemsMap({});
                              } else {
                                const all = {};
                                filteredPendingProducts.forEach((p) => {
                                  all[p.itemKey] = p.cantidadPendiente;
                                });
                                setSelectedItemsMap(all);
                              }
                            }}
                            className="px-2.5 py-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-extrabold theme-text-main hover:border-amber-500"
                          >
                            {selectedCount === filteredPendingProducts.length ? 'Desmarcar' : 'Marcar Todos'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {filteredPendingProducts.length === 0 ? (
                        <div className="p-6 text-center text-xs theme-text-muted">
                          {orderProductsCatalog.length === 0
                            ? 'No se encontraron productos registrados para este pedido en planta ni en el ERP.'
                            : '¡Excelente! Todos los productos de este pedido ya han sido incluidos en paquetes.'}
                        </div>
                      ) : (
                        filteredPendingProducts.map((prod) => {
                          const isSelected = Boolean(selectedItemsMap[prod.itemKey]);
                          const selectedQty = selectedItemsMap[prod.itemKey] || prod.cantidadPendiente;

                          return (
                            <div
                              key={prod.itemKey}
                              onClick={() => toggleSelectProductToPack(prod)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500'
                                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-amber-500/40'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className="mt-0.5 text-amber-400 shrink-0">
                                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                                      {prod.codArticulo}
                                    </span>
                                    <span className="text-xs font-extrabold theme-text-main">
                                      {prod.nombre}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {(prod.areasPlanta || []).map((area) => (
                                      <span
                                        key={area}
                                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                          area === 'Despachos'
                                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                            : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                        }`}
                                      >
                                        📍 Área actual: {area}
                                      </span>
                                    ))}
                                    <span className="text-[11px] theme-text-muted font-bold">
                                      Pendiente: <strong className="text-amber-400">{prod.cantidadPendiente}</strong> de {prod.cantidadTotalPedido} unds
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* SELECTOR DE CANTIDAD A EMPACAR EN ESTE PAQUETE */}
                              {isSelected && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 bg-[var(--color-base)] px-2 py-1 rounded-xl border border-amber-500/50 shrink-0"
                                >
                                  <span className="text-[10px] font-black uppercase text-amber-400">
                                    Cant:
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={prod.cantidadPendiente}
                                    value={selectedQty}
                                    onChange={(e) =>
                                      updateSelectedQty(prod.itemKey, e.target.value, prod.cantidadPendiente)
                                    }
                                    className="w-14 bg-transparent text-center font-black text-xs theme-text-main focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA (5 cols): OPCIONES DE AGRUPACIÓN DEL PAQUETE / GUACAL */}
                  <div className="lg:col-span-5 flex flex-col justify-between border border-[var(--color-border)] rounded-2xl bg-[var(--color-base)] p-4 space-y-3">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                        <Layers size={15} /> Configuración del Empaque ({selectedCount} productos seleccionados)
                      </h4>

                      {/* MODO DE AGRUPACIÓN */}
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setPackingMode('AGRUPADO')}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            packingMode === 'AGRUPADO'
                              ? 'bg-amber-500/20 border-amber-500 text-white'
                              : 'bg-[var(--color-surface)] border-[var(--color-border)] theme-text-muted'
                          }`}
                        >
                          <div className="text-xs font-black uppercase">
                            📦 Agrupar seleccionados en UN SOLO Paquete / Guacal
                          </div>
                          <div className="text-[11px] opacity-80">
                            Todos los ítems marcados viajarán juntos bajo el mismo consecutivo (ej. PAQ-{String(activePackingList.nextConsecutive || 1).padStart(2, '0')}).
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPackingMode('INDIVIDUAL')}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            packingMode === 'INDIVIDUAL'
                              ? 'bg-amber-500/20 border-amber-500 text-white'
                              : 'bg-[var(--color-surface)] border-[var(--color-border)] theme-text-muted'
                          }`}
                        >
                          <div className="text-xs font-black uppercase">
                            🔢 Crear Paquete Individual por cada Producto
                          </div>
                          <div className="text-[11px] opacity-80">
                            Genera automáticamente un consecutivo distinto para cada producto marcado (PAQ-01, PAQ-02...).
                          </div>
                        </button>

                        {(activePackingList.packages || []).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPackingMode('EXISTENTE');
                              if (!targetExistingPkgId && activePackingList.packages[0]) {
                                setTargetExistingPkgId(activePackingList.packages[0].id);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                              packingMode === 'EXISTENTE'
                                ? 'bg-amber-500/20 border-amber-500 text-white'
                                : 'bg-[var(--color-surface)] border-[var(--color-border)] theme-text-muted'
                            }`}
                          >
                            <div className="text-xs font-black uppercase">
                              ➕ Incluir dentro de un Paquete ya creado
                            </div>
                            <div className="text-[11px] opacity-80">
                              Agrega estos productos a un paquete o guacal existente de este pedido.
                            </div>
                          </button>
                        )}
                      </div>

                      {packingMode === 'EXISTENTE' && (
                        <div>
                          <label className="block text-[11px] font-black uppercase theme-text-muted mb-1">
                            Seleccionar Paquete Destino:
                          </label>
                          <select
                            value={targetExistingPkgId}
                            onChange={(e) => setTargetExistingPkgId(e.target.value)}
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold theme-text-main"
                          >
                            {(activePackingList.packages || []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.codigoPaquete} — {p.tipoEmpaque} ({(p.items || []).length} productos)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-black uppercase theme-text-muted mb-1">
                            Tipo de Empaque:
                          </label>
                          <select
                            value={tipoEmpaqueInput}
                            onChange={(e) => setTipoEmpaqueInput(e.target.value)}
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold theme-text-main"
                          >
                            <option value="GUACAL / PAQUETE">GUACAL / PAQUETE</option>
                            <option value="PAQUETE">PAQUETE</option>
                            <option value="GUACAL DE MADERA">GUACAL DE MADERA</option>
                            <option value="CAJA">CAJA</option>
                            <option value="ESTIBA / PALLET">ESTIBA / PALLET</option>
                            <option value="MUEBLE ARMADO">MUEBLE ARMADO</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase theme-text-muted mb-1">
                            Nota / Observación (Opcional):
                          </label>
                          <input
                            type="text"
                            value={observacionesPaquete}
                            onChange={(e) => setObservacionesPaquete(e.target.value)}
                            placeholder="Ej. Incluye herrajes / Vidrio frágil"
                            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-bold theme-text-main"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={selectedCount === 0}
                      onClick={handleCreatePackagesFromSelection}
                      className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                        selectedCount > 0
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <QrCode size={18} />
                      <span>
                        {packingMode === 'EXISTENTE'
                          ? `Agregar ${selectedCount} Producto(s) al Paquete`
                          : packingMode === 'INDIVIDUAL'
                          ? `Generar ${selectedCount} Paquete(s) Consecutivos con QR`
                          : `Registrar Paquete PAQ-${String(activePackingList.nextConsecutive || 1).padStart(2, '0')} con Código QR`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: TABLA OFICIAL DE LISTA DE EMPAQUE SEPARADA POR COLUMNAS */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-black uppercase tracking-wider theme-text-main">
                    2. Tabla de Lista de Empaque — Pedido #{activePackingList.pedidoNum} ({(activePackingList.packages || []).length} Paquetes Generados)
                  </h3>
                </div>
                <span className="text-xs theme-text-muted">
                  Cada paquete tiene su propio código consecutivo y Código QR para verificación en obra por instaladores y cliente
                </span>
              </div>

              {(activePackingList.packages || []).length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-bold theme-text-muted">
                    Esta lista de empaque aún no tiene paquetes registrados. Selecciona arriba los productos que vayas empacando para generar el primer paquete (`PAQ-01`).
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[var(--color-base)] border-b border-[var(--color-border)] text-[11px] font-black uppercase tracking-wider theme-text-muted">
                        <th className="py-3 px-4 border-r border-[var(--color-border)] w-48">
                          Paquete / Consecutivo
                        </th>
                        <th className="py-3 px-4 border-r border-[var(--color-border)] w-44">
                          Código de Producto
                        </th>
                        <th className="py-3 px-4 border-r border-[var(--color-border)]">
                          Nombre del Producto
                        </th>
                        <th className="py-3 px-4 border-r border-[var(--color-border)] w-32 text-center">
                          Cantidades
                        </th>
                        <th className="py-3 px-4 w-56 text-center">
                          Código QR / Acciones
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

                        return items.map((item, itemIdx) => {
                          const isFirstItemOfPkg = itemIdx === 0;
                          const rowSpanCount = items.length;

                          return (
                            <tr
                              key={`${pkg.id}_${itemIdx}`}
                              className="hover:bg-white/[0.02] transition-colors"
                            >
                              {/* COLUMNA 1: PAQUETE / CONSECUTIVO (AGRUPADO SI HAY VARIOS PRODUCTOS EN EL MISMO PAQUETE) */}
                              {isFirstItemOfPkg && (
                                <td
                                  rowSpan={rowSpanCount}
                                  className="p-4 border-r border-[var(--color-border)] align-top bg-[var(--color-base)]/40"
                                >
                                  <div className="flex flex-col gap-1.5">
                                    <div className="inline-flex items-center gap-2">
                                      <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-sm shadow">
                                        {pkg.codigoPaquete}
                                      </span>
                                      <span className="text-[11px] font-black theme-text-muted">
                                        ({pkgIdx + 1} de {totalPackages})
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-extrabold text-amber-400 uppercase">
                                      {pkg.tipoEmpaque || 'PAQUETE'}
                                    </div>
                                    <div className="text-[10px] font-mono theme-text-muted">
                                      ID: {pkg.codigoUnicoPedido}
                                    </div>
                                    <div className="text-[11px] font-bold text-emerald-400">
                                      {items.length} {items.length === 1 ? 'producto' : 'productos agrupados'}
                                    </div>
                                    {pkg.observaciones && (
                                      <div className="text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-1 rounded-lg mt-1">
                                        Nota: {pkg.observaciones}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}

                              {/* COLUMNA 2: CÓDIGO DE PRODUCTO */}
                              <td className="p-3.5 border-r border-[var(--color-border)] font-mono font-black text-amber-300 align-middle">
                                {item.codArticulo || 'S/C'}
                              </td>

                              {/* COLUMNA 3: NOMBRE DEL PRODUCTO */}
                              <td className="p-3.5 border-r border-[var(--color-border)] font-bold theme-text-main align-middle">
                                <div>{item.nombre}</div>
                                {item.areaOrigen && (
                                  <div className="text-[10px] theme-text-muted font-semibold mt-0.5">
                                    Origen en planta: {item.areaOrigen}
                                  </div>
                                )}
                              </td>

                              {/* COLUMNA 4: CANTIDADES */}
                              <td className="p-3.5 border-r border-[var(--color-border)] text-center align-middle">
                                <div className="inline-flex flex-col items-center">
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-black text-sm">
                                    {item.cantidadEmpacada} und
                                  </span>
                                  {items.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItemFromPackage(pkg.id, itemIdx)}
                                      className="text-[10px] text-red-400 hover:underline mt-1"
                                    >
                                      Quitar ítem
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* COLUMNA 5: CÓDIGO QR DEL PAQUETE Y ACCIONES */}
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
                                      title="Haz clic para ampliar y escanear el Código QR de este paquete"
                                    >
                                      <QRCodeSVG value={qrPayload} size={84} />
                                      <div className="mt-1 text-[10px] font-black text-indigo-400 group-hover:underline flex items-center justify-center gap-1">
                                        <Eye size={12} /> Ver QR Grande
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handlePrint('ROTULOS_QR', pkg)}
                                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10px] font-black uppercase flex items-center gap-1 transition-colors"
                                      >
                                        <Printer size={12} /> Rótulo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePackage(pkg.id)}
                                        className="px-2 py-1 rounded-lg bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 text-[10px] font-black uppercase transition-colors"
                                        title="Eliminar paquete"
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

      {/* MODAL DE VISTA AMPLIADA DEL CÓDIGO QR DEL PAQUETE */}
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
                  Rótulo QR de Verificación en Obra / Despacho
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
              <QRCodeSVG value={qrPreviewPkg.qrPayload} size={230} className="shadow-xl border-4 border-white" />
            </div>

            <div className="bg-[var(--color-base)] border border-[var(--color-border)] rounded-2xl p-3 text-left">
              <div className="text-[10px] font-black uppercase text-amber-400 mb-1">
                Información codificada en el QR (Visible al escanear):
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
                <Printer size={16} /> Imprimir Este Rótulo QR
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
