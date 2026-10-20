import { useMemo } from 'react';

export const normalizeErpCode = (val) => {
    if (val === undefined || val === null || String(val).trim() === '') return '';
    const str = String(val).trim();
    if (/^\d+\.0+$/.test(str)) {
        return String(Math.trunc(Number(str))).trim();
    }
    const num = Number(str);
    if (!Number.isNaN(num) && Number.isFinite(num) && str.includes('.')) {
        return String(Math.trunc(num)).trim();
    }
    return str.toUpperCase();
};

export const useInventoryMRP = (orders, supabaseData) => {
    return useMemo(() => {
        const inventoryStockMap = {};
        const inventoryDescMap = {};
        const inventoryUbicacionMap = {};
        const inventoryUnidadMap = {};

        if (supabaseData?.inventario) {
            supabaseData.inventario.forEach(inv => {
                const normId = normalizeErpCode(inv.idreferencia ?? inv.id_referencia);
                if (normId) {
                    const disp = Number(inv.existencia ?? inv.cantidad_disponible ?? 0) || 0;
                    inventoryStockMap[normId] = disp;
                    inventoryDescMap[normId] = inv.referencia || inv.descripcion || '';
                    if (inv.ubicacion) inventoryUbicacionMap[normId] = inv.ubicacion;
                    if (inv.idunidad) inventoryUnidadMap[normId] = inv.idunidad;
                }
            });
        }

        // Agrupar todos los requerimientos por pedido_sin normalizado
        const reqsByPedido = {};
        if (supabaseData?.pedidosInsumos) {
            supabaseData.pedidosInsumos.forEach(req => {
                const pNum = normalizeErpCode(req.pedido_sin ?? req.pedido_num);
                if (!pNum) return;

                const idRef = normalizeErpCode(req.idreferencia ?? req.id_referencia);
                const codpt = req.codpt ? normalizeErpCode(req.codpt) : null;
                const pedidaReser = Number(req.pedida_reser ?? req.cantidad_requerida ?? 0) || 0;
                const cantOc = Number(req.cant_oc ?? req.cantidad_oc ?? 0) || 0;
                const entregada = Number(req.entregada ?? 0) || 0;

                const rawPendiente = req.pendiente !== undefined && req.pendiente !== null
                    ? Number(req.pendiente) || 0
                    : Math.max(0, pedidaReser - entregada);

                // Regla de completitud: pendiente === 0 o entregada >= pedida_reser (cuando pedida_reser > 0)
                const isMaterialComplete = rawPendiente <= 0 || (pedidaReser > 0 && entregada >= pedidaReser);
                const effectivePendiente = isMaterialComplete ? 0 : rawPendiente;

                const existencia = req.existencia !== null && req.existencia !== undefined
                    ? Number(req.existencia) || 0
                    : (inventoryStockMap[idRef] ?? 0);

                const ubicacion = req.ubicacion || inventoryUbicacionMap[idRef] || 'S/U';
                const referencia = req.referencia || req.descripcion || inventoryDescMap[idRef] || idRef;
                const numero_rq = req.numero_rq || 'S/N';
                const idunidad = req.idunidad || inventoryUnidadMap[idRef] || '';

                // Clasificación individual del material
                let estadoInsumo = 'COMPLETO';
                if (effectivePendiente > 0) {
                    if (existencia <= 0) {
                        estadoInsumo = 'SIN_STOCK'; // Crítico: pendiente > 0 y existencia <= 0
                    } else {
                        estadoInsumo = 'PENDIENTE_ENTREGA'; // Ámbar: pendiente > 0 y existencia > 0
                    }
                }

                const enrichedMat = {
                    ...req,
                    numero_rq,
                    pedido_sin: pNum,
                    pedido_num: pNum,
                    codpt,
                    producto: req.producto || '',
                    idreferencia: idRef,
                    id_referencia: idRef,
                    referencia,
                    descripcion: referencia,
                    idunidad,
                    pedida_reser: pedidaReser,
                    cant_oc: cantOc,
                    entregada,
                    pendiente: effectivePendiente,
                    existencia,
                    ubicacion,
                    estadoInsumo,
                    // Propiedades de compatibilidad con componentes previos
                    requerida: pedidaReser,
                    asignada: entregada,
                    faltante: effectivePendiente,
                    stockRestanteGlobal: existencia,
                    sinOC: cantOc <= 0 && effectivePendiente > 0 && existencia <= 0
                };

                if (!reqsByPedido[pNum]) reqsByPedido[pNum] = [];
                reqsByPedido[pNum].push(enrichedMat);
            });
        }

        const orderMaterialStatus = {};

        // Poblar orderMaterialStatus[pedidoNum] con todos los requerimientos del pedido
        Object.keys(reqsByPedido).forEach(pNum => {
            orderMaterialStatus[pNum] = reqsByPedido[pNum];
        });

        (orders || []).forEach(o => {
            if (!o || !o.pedidoNum) return;
            const rawPNum = String(o.pedidoNum);
            const normPNum = normalizeErpCode(rawPNum);
            if (!orderMaterialStatus[rawPNum]) {
                orderMaterialStatus[rawPNum] = reqsByPedido[normPNum] || [];
            }
        });

        const normalizeProdName = (str) =>
            String(str || '')
                .trim()
                .toUpperCase()
                .replace(/\s+/g, ' ');

        /**
         * NIVEL 1: Evaluación Individual por Producto (codpt === codigo_item o producto === nombre dentro de pedido_sin)
         */
        const getProductMaterials = (pedidoNum, codArticulo, nombreProducto = '') => {
            const normPNum = normalizeErpCode(pedidoNum);
            const normCodArt = normalizeErpCode(codArticulo);
            const normProdName = normalizeProdName(nombreProducto);
            const orderReqs = reqsByPedido[normPNum] || [];

            if (orderReqs.length === 0) {
                return {
                    status: 'SIN_REQUERIMIENTOS',
                    badgeText: 'SIN INSUMOS REQ.',
                    materials: [],
                    faltantes: [],
                    sinStockCount: 0,
                    pendienteEntregaCount: 0
                };
            }

            // Buscar materiales donde coincidan pedido_sin Y codpt === codigo_item (o nombre/código contenido en producto)
            const specificMaterials = orderReqs.filter(m => {
                if (normCodArt && m.codpt && m.codpt === normCodArt) return true;
                const normMatProd = normalizeProdName(m.producto);
                if (normProdName && normMatProd && normMatProd === normProdName) return true;
                if (normCodArt && normCodArt.length >= 5 && normMatProd && normMatProd.includes(normCodArt)) return true;
                if (normProdName && normProdName.length >= 6 && normMatProd && (normMatProd.includes(normProdName) || normProdName.includes(normMatProd))) return true;
                return false;
            });

            // Materiales genéricos del pedido con codpt nulo y sin nombre de producto específico
            const genericMaterials = orderReqs.filter(m => !m.codpt && !m.producto);

            // Si el producto encontró sus materiales específicos por codpt/producto, evaluarlo estrictamente con ellos;
            // si el pedido solo tiene materiales genéricos sin codpt, usar los genéricos
            const hasAnySpecificInOrder = orderReqs.some(m => Boolean(m.codpt) || Boolean(m.producto));
            const productMaterials = specificMaterials.length > 0
                ? specificMaterials
                : (hasAnySpecificInOrder ? genericMaterials : orderReqs);

            if (productMaterials.length === 0) {
                return {
                    status: 'SIN_REQUERIMIENTOS',
                    badgeText: 'SIN INSUMOS REQ.',
                    materials: [],
                    faltantes: [],
                    sinStockCount: 0,
                    pendienteEntregaCount: 0
                };
            }

            const sinStockList = productMaterials.filter(m => m.estadoInsumo === 'SIN_STOCK');
            const pendienteEntregaList = productMaterials.filter(m => m.estadoInsumo === 'PENDIENTE_ENTREGA');
            const faltantes = productMaterials.filter(m => m.pendiente > 0);

            if (sinStockList.length > 0) {
                return {
                    status: 'SIN_STOCK',
                    badgeText: 'SIN STOCK EN ALMACÉN',
                    materials: productMaterials,
                    faltantes,
                    sinStockCount: sinStockList.length,
                    pendienteEntregaCount: pendienteEntregaList.length
                };
            }

            if (pendienteEntregaList.length > 0) {
                return {
                    status: 'PENDIENTE_ENTREGA',
                    badgeText: 'PENDIENTE ENTREGA ALMACÉN',
                    materials: productMaterials,
                    faltantes,
                    sinStockCount: 0,
                    pendienteEntregaCount: pendienteEntregaList.length
                };
            }

            return {
                status: 'COMPLETO',
                badgeText: 'INSUMOS COMPLETOS',
                materials: productMaterials,
                faltantes: [],
                sinStockCount: 0,
                pendienteEntregaCount: 0
            };
        };

        /**
         * NIVEL 2: Resumen Inteligente en la Tarjeta Principal del Pedido
         * Evalúa el estado real de sus productos hijos (por codpt / codArticulo / nombre).
         */
        const getOrderSummary = (pedidoNum, groupProducts = []) => {
            const normPNum = normalizeErpCode(pedidoNum);
            const allOrderMaterials = reqsByPedido[normPNum] || [];

            if (allOrderMaterials.length === 0) {
                return {
                    status: 'SIN_REQUERIMIENTOS',
                    label: '⚠️ Sin Insumos Req.',
                    sinStockProductsCount: 0,
                    pendienteProductsCount: 0,
                    completeProductsCount: 0,
                    materials: []
                };
            }

            let sinStockProductsCount = 0;
            let pendienteProductsCount = 0;
            let completeProductsCount = 0;

            if (Array.isArray(groupProducts) && groupProducts.length > 0) {
                const evaluatedKeys = new Set();
                groupProducts.forEach(p => {
                    if (!p) return;
                    const code = normalizeErpCode(p.codArticulo || p.codigo_item);
                    const name = normalizeProdName(p.nombre || p.descripcion);
                    const uniqueKey = `${code}__${name}`;
                    if (evaluatedKeys.has(uniqueKey)) return;
                    evaluatedKeys.add(uniqueKey);

                    const evalProd = getProductMaterials(normPNum, code, name);
                    if (evalProd.status === 'SIN_STOCK') {
                        sinStockProductsCount++;
                    } else if (evalProd.status === 'PENDIENTE_ENTREGA') {
                        pendienteProductsCount++;
                    } else if (evalProd.status === 'COMPLETO') {
                        completeProductsCount++;
                    }
                });
            }

            // Si no se pasaron productos en planta o ninguno coincidió con codpt, evaluar por cada codpt único del pedido en requerimientos_pedido
            if (sinStockProductsCount === 0 && pendienteProductsCount === 0 && completeProductsCount === 0) {
                const codptSet = new Set();
                allOrderMaterials.forEach(m => {
                    if (m.codpt) codptSet.add(m.codpt);
                });

                if (codptSet.size > 0) {
                    codptSet.forEach(code => {
                        const evalProd = getProductMaterials(normPNum, code, '');
                        if (evalProd.status === 'SIN_STOCK') {
                            sinStockProductsCount++;
                        } else if (evalProd.status === 'PENDIENTE_ENTREGA') {
                            pendienteProductsCount++;
                        } else if (evalProd.status === 'COMPLETO') {
                            completeProductsCount++;
                        }
                    });
                } else {
                    const hasSinStock = allOrderMaterials.some(m => m.estadoInsumo === 'SIN_STOCK');
                    const hasPendiente = allOrderMaterials.some(m => m.estadoInsumo === 'PENDIENTE_ENTREGA');
                    if (hasSinStock) sinStockProductsCount = 1;
                    else if (hasPendiente) pendienteProductsCount = 1;
                    else completeProductsCount = 1;
                }
            }

            if (sinStockProductsCount > 0) {
                const word = sinStockProductsCount === 1 ? 'PRODUCTO' : 'PRODUCTOS';
                return {
                    status: 'SIN_STOCK',
                    label: `⚠️ ${sinStockProductsCount} ${word} SIN MATERIA PRIMA (STOCK 0)`,
                    sinStockProductsCount,
                    pendienteProductsCount,
                    completeProductsCount,
                    materials: allOrderMaterials
                };
            }

            if (pendienteProductsCount > 0) {
                const word = pendienteProductsCount === 1 ? 'PRODUCTO' : 'PRODUCTOS';
                return {
                    status: 'PENDIENTE_ENTREGA',
                    label: `⚠️ ${pendienteProductsCount} ${word} CON INSUMOS PENDIENTES`,
                    sinStockProductsCount: 0,
                    pendienteProductsCount,
                    completeProductsCount,
                    materials: allOrderMaterials
                };
            }

            return {
                status: 'COMPLETO',
                label: '✅ INSUMOS COMPLETOS',
                sinStockProductsCount: 0,
                pendienteProductsCount: 0,
                completeProductsCount,
                materials: allOrderMaterials
            };
        };

        /**
         * NIVEL 3: Motor Anti-Error Humano de Ruta de Fabricación por Producto (codpt + Insumos RQ + Acabados ERP)
         * Deduce automáticamente por cuáles áreas de planta debe pasar un producto aunque el programador
         * de diseño haya olvidado marcarlas manualmente en Ribisoft.
         */
        const getProductRouting = (pedidoNum, codArticulo, productObj = null) => {
            const normPNum = normalizeErpCode(pedidoNum);
            const normCodArt = normalizeErpCode(codArticulo || productObj?.codArticulo || productObj?.codigo_item);
            const prodName = productObj?.nombre || productObj?.descripcion || '';

            const matEval = getProductMaterials(normPNum, normCodArt, prodName);
            const materials = matEval.materials || [];

            const reasonsByArea = {};
            const addAreaReason = (areaName, reasonText) => {
                if (!reasonsByArea[areaName]) reasonsByArea[areaName] = [];
                if (reasonText && !reasonsByArea[areaName].includes(reasonText) && reasonsByArea[areaName].length < 3) {
                    reasonsByArea[areaName].push(reasonText);
                }
            };

            // 1. Analizar cada insumo cargado en requerimientos_pedido (RQ de Almacén)
            materials.forEach(m => {
                const ref = String(m.referencia || m.descripcion || '').toUpperCase();
                if (!ref) return;

                // Pintura Líquida
                if (/\b(CATALIZADOR|POLIURETANO|LACA|SELLADOR|THINNER|TINTE|BARNIZ|FONDO PU|PINTURA LIQUIDA|PINTURA LÍQUIDA|ESMALTE|ACRILICO LIQUIDO|MASILLA)\b/.test(ref)) {
                    addAreaReason('Pintura Líquida', `Insumo RQ: ${ref}`);
                }

                // Pintura en Polvo
                if (/\b(PINTURA EN POLVO|ELECTROSTATICA|ELECTROSTÁTICA|POLVO|GOFRADO|MICROTEXTURIZADO|EPOXICO|EPÓXICO|FOSFATIZANTE|DESENGRASANTE)\b/.test(ref)) {
                    addAreaReason('Pintura en Polvo', `Insumo RQ: ${ref}`);
                }

                // Madera / Tableros -> Corte CNC Madera + Ebanistería
                if (/\b(MADECOR|MDF|TRIPLEX|TABLEX|AGLOMERADO|MELAMINA|CANTO|TAPACANTO|FORMICA|FÓRMICA|CHAPA|MADERA|ROBLE|CEDRO|PINO|CORIAN|COLBON|PEGANTE)\b/.test(ref)) {
                    addAreaReason('Corte y Mecanizado CNC de Madera', `Insumo RQ: ${ref}`);
                    addAreaReason('Ebanistería', `Insumo RQ: ${ref}`);
                }

                // Metalmecánica / Cerrajería -> Corte y Dobles CNC + Soldadura
                if (/\b(LAMINA|LÁMINA|TUBO|TUBERIA|TUBERÍA|COLD ROLLED|PLATINA|ANGULO|ÁNGULO|VARILLA|SOLDADURA|MIG|TIG|ELECTRODO|ACERO|HIERRO|PERFIL METALICO|PERFIL METÁLICO)\b/.test(ref)) {
                    addAreaReason('Corte y Dobles de Lámina y Tubería CNC', `Insumo RQ: ${ref}`);
                    addAreaReason('Área de Soldadura', `Insumo RQ: ${ref}`);
                }

                // Torno
                if (/\b(TORNO|TORNEADO|EJE |BUJE|MACIZO|BARRA REDONDA|BARRA MACIZA|BRONCE|NYLON|TEFLON|TEFLÓN)\b/.test(ref)) {
                    addAreaReason('Área de Torno', `Insumo RQ: ${ref}`);
                }

                // Vidrio
                if (/\b(VIDRIO|ESPEJO|CRISTAL|TEMPLADO|LAMINADO)\b/.test(ref)) {
                    addAreaReason('Corte y Mecanizado de Vidrio', `Insumo RQ: ${ref}`);
                }
            });

            // 2. Analizar Acabados y Características ERP del Producto (acabado_1..3, caracteristicas, nombre)
            const textFields = [
                productObj?.acabado_1,
                productObj?.acabado_2,
                productObj?.acabado_3,
                productObj?.caracteristicas,
                productObj?.observaciones_erp,
                productObj?.notas,
                productObj?.categoria,
                prodName
            ]
                .filter(Boolean)
                .map(s => String(s).toUpperCase())
                .join(' | ');

            if (textFields) {
                if (/\b(POLIURETANO|LACA|PINTURA LIQUIDA|PINTURA LÍQUIDA|CATALIZADOR|TINTE|BARNIZ|SELLADOR|CRUDO PINTADO|MDF PINTADO)\b/.test(textFields)) {
                    addAreaReason('Pintura Líquida', 'Ficha/Acabado ERP (Poliuretano/Pintura Líquida)');
                }
                if (/\b(ELECTROSTATICA|ELECTROSTÁTICA|PINTURA EN POLVO|PINTURA POLVO|GOFRADO|MICROTEXTURIZADO|EPOXICA|EPÓXICA)\b/.test(textFields)) {
                    addAreaReason('Pintura en Polvo', 'Ficha/Acabado ERP (Pintura Electrostática/Polvo)');
                }
                if (/\b(MADECOR|MDF|MELAMINA|ENCHAPE|FORMICA|FÓRMICA|MADERA|EBANISTERIA|EBANISTERÍA|CORIAN|CANTO)\b/.test(textFields)) {
                    addAreaReason('Corte y Mecanizado CNC de Madera', 'Ficha/Acabado ERP (Madera/Tablero)');
                    addAreaReason('Ebanistería', 'Ficha/Acabado ERP (Ebanistería/Enchape)');
                }
                if (/\b(CERRAJERIA|CERRAJERÍA|SOLDADURA|METAL|METÁLICO|METALICO|TUBO|TUBERÍA|TUBERIA|LAMINA|LÁMINA|ACERO|HIERRO)\b/.test(textFields)) {
                    addAreaReason('Corte y Dobles de Lámina y Tubería CNC', 'Ficha/Acabado ERP (Lámina/Tubería)');
                    addAreaReason('Área de Soldadura', 'Ficha/Acabado ERP (Cerrajería/Soldadura)');
                }
                if (/\b(TORNO|TORNEADO|PIEZA TORNEADA|BUJE|EJE TORNEADO)\b/.test(textFields)) {
                    addAreaReason('Área de Torno', 'Ficha/Acabado ERP (Torno)');
                }
                if (/\b(VIDRIO|ESPEJO|CRISTAL)\b/.test(textFields)) {
                    addAreaReason('Corte y Mecanizado de Vidrio', 'Ficha/Acabado ERP (Vidrio/Espejo)');
                }
            }

            // Si tiene múltiples procesos de transformación o al menos 1 área detectada, converge en Ensamble
            const detectedAreasList = Object.keys(reasonsByArea);
            if (detectedAreasList.length > 0) {
                addAreaReason('Ensamble', 'Reunión y armado final de componentes');
            }

            const ORDERED_FLOW = [
                'Corte y Mecanizado CNC de Madera',
                'Corte y Dobles de Lámina y Tubería CNC',
                'Área de Torno',
                'Corte y Mecanizado de Vidrio',
                'Ebanistería',
                'Área de Soldadura',
                'Pintura Líquida',
                'Pintura en Polvo',
                'Ensamble'
            ];

            const requiredAreas = ORDERED_FLOW.filter(a => Boolean(reasonsByArea[a]));

            return {
                requiredAreas,
                reasonsByArea
            };
        };

        Object.defineProperty(orderMaterialStatus, 'getProductMaterials', {
            value: getProductMaterials,
            enumerable: false
        });

        Object.defineProperty(orderMaterialStatus, 'getOrderSummary', {
            value: getOrderSummary,
            enumerable: false
        });

        Object.defineProperty(orderMaterialStatus, 'getProductRouting', {
            value: getProductRouting,
            enumerable: false
        });

        return orderMaterialStatus;
    }, [orders, supabaseData]);
};
