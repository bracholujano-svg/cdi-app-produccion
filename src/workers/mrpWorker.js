// src/workers/mrpWorker.js

const safeParseNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    let strVal = String(val).trim();
    if (strVal.includes(',') && !strVal.includes('.')) {
        strVal = strVal.replace(/,/g, '.');
    } else if (strVal.includes(',') && strVal.includes('.')) {
        const lastComma = strVal.lastIndexOf(',');
        const lastDot = strVal.lastIndexOf('.');
        if (lastComma > lastDot) {
            strVal = strVal.replace(/\./g, '').replace(/,/g, '.');
        } else {
            strVal = strVal.replace(/,/g, '');
        }
    }
    const num = Number(strVal);
    return isNaN(num) ? 0 : num;
};

const cleanErpCode = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') return null;
    const num = Number(val);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
        return String(Math.trunc(num)).trim();
    }
    return String(val).replace(/\.0+$/, '').trim();
};

const firstNonEmpty = (...vals) => {
    for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            return String(v).trim();
        }
    }
    return '';
};

self.onmessage = function(e) {
    const { action, payload } = e.data;

    if (action === 'PROCESS_DATA') {
        try {
            const { inv, req } = payload;

            const invByRef = {};
            const invMap = inv ? inv.map(item => {
                const idRef = cleanErpCode(firstNonEmpty(item['idreferencia'], item['Id Referencia'], item['id_referencia']));
                const refDesc = firstNonEmpty(item['referencia'], item['Referencia'], item['descripcion']);
                const exist = safeParseNumber(item['existencia'] ?? item['Saldo'] ?? item['cantidad_disponible']);
                const ubic = firstNonEmpty(item['ubicacion'], item['Ubicacion'], item['Ubicación']);
                const mappedInv = {
                    id_referencia: idRef,
                    idreferencia: idRef,
                    descripcion: refDesc,
                    referencia: refDesc,
                    cantidad_disponible: exist,
                    existencia: exist,
                    ubicacion: ubic,
                    grupo: firstNonEmpty(item['grupo'], item['Grupo']),
                    subgrupo: firstNonEmpty(item['subgrupo'], item['Subgrupo']),
                    linea: firstNonEmpty(item['linea'], item['Linea']),
                    idunidad: firstNonEmpty(item['idunidad'], item['Id Unidad']),
                    embalaje: firstNonEmpty(item['embalaje'], item['Embalaje'])
                };
                if (idRef) {
                    invByRef[idRef] = mappedInv;
                }
                return mappedInv;
            }) : [];

            const reqRaw = req ? req.map(item => {
                // Ignorar filas huérfanas pre-migración que no tienen `pedido_sin` o `idreferencia` poblados
                const hasModernSchema = item['pedido_sin'] !== null && item['pedido_sin'] !== undefined && String(item['pedido_sin']).trim() !== ''
                    && item['idreferencia'] !== null && item['idreferencia'] !== undefined && String(item['idreferencia']).trim() !== '';
                if (!hasModernSchema) return null;

                const pedidoSin = cleanErpCode(firstNonEmpty(item['pedido_sin'], item['pedidosin'], item['PedidoSIN']));
                const rawCodPt = item['codpt'];
                const codpt = rawCodPt !== undefined && rawCodPt !== null && String(rawCodPt).trim() !== ''
                    ? (Number.isNaN(Number(rawCodPt)) ? String(rawCodPt).replace(/\.0+$/, '').trim() : String(Math.trunc(Number(rawCodPt))).trim())
                    : null;

                const idRef = cleanErpCode(firstNonEmpty(item['idreferencia'], item['Id Referencia'], item['id_referencia']));
                const catalogItem = idRef ? invByRef[idRef] : null;
                const refDesc = firstNonEmpty(
                    item['referencia'],
                    item['Descripcion'],
                    item['Descripción'],
                    catalogItem?.referencia,
                    catalogItem?.descripcion
                );
                const pedidaReser = safeParseNumber(item['pedida_reser'] ?? item['pedida(reser)'] ?? item['Cantidad']);
                const cantOc = safeParseNumber(item['cant_oc'] ?? item['Cant.OC']);
                const entregada = safeParseNumber(item['entregada']);

                const hasExplicitPendiente = item['pendiente'] !== undefined && item['pendiente'] !== null && item['pendiente'] !== '';
                const pendiente = hasExplicitPendiente
                    ? safeParseNumber(item['pendiente'])
                    : Math.max(0, pedidaReser - entregada);

                const hasExplicitExistencia = item['existencia'] !== undefined && item['existencia'] !== null && item['existencia'] !== '';
                const existencia = hasExplicitExistencia ? safeParseNumber(item['existencia']) : null;

                return {
                    numero_rq: firstNonEmpty(item['numero_rq'], item['numero']),
                    pedido_cot: cleanErpCode(firstNonEmpty(item['pedido_cot'], item['pedido'])) ?? '',
                    pedido_sin: pedidoSin,
                    pedido_num: pedidoSin,
                    codpt: codpt && codpt !== 'NaN' ? codpt : null,
                    producto: firstNonEmpty(item['producto']),
                    idreferencia: idRef,
                    id_referencia: idRef,
                    referencia: refDesc,
                    descripcion: refDesc,
                    idunidad: firstNonEmpty(item['idunidad'], item['Id Unidad'], catalogItem?.idunidad),
                    fecha_solicitud: item['fecha_solicitud'] ?? item['Fecha Solicitud'] ?? null,
                    pedida_reser: pedidaReser,
                    cantidad_requerida: pedidaReser,
                    cant_oc: cantOc,
                    cantidad_oc: cantOc,
                    entregada,
                    pendiente,
                    existencia,
                    ubicacion: firstNonEmpty(item['ubicacion'], item['Ubicación'], item['Ubicacion'], catalogItem?.ubicacion)
                };
            }).filter(r => r && r.pedido_sin && r.idreferencia) : [];

            // Agrupar requerimientos por pedido_sin + codpt + producto + idreferencia + numero_rq
            // evitando duplicar cantidades si el mismo archivo se cargó varias veces
            const groupedReqs = {};
            reqRaw.forEach(item => {
                const key = `${item.pedido_sin}_${item.codpt || 'GENERAL'}_${item.producto || ''}_${item.idreferencia}_${item.numero_rq || ''}`;
                if (!groupedReqs[key]) {
                    groupedReqs[key] = { ...item };
                } else {
                    groupedReqs[key].pedida_reser = Math.max(groupedReqs[key].pedida_reser, item.pedida_reser);
                    groupedReqs[key].cantidad_requerida = groupedReqs[key].pedida_reser;
                    groupedReqs[key].cant_oc = Math.max(groupedReqs[key].cant_oc, item.cant_oc);
                    groupedReqs[key].cantidad_oc = groupedReqs[key].cant_oc;
                    groupedReqs[key].entregada = Math.max(groupedReqs[key].entregada, item.entregada);
                    groupedReqs[key].pendiente = item.pendiente;
                    if (item.referencia && !groupedReqs[key].referencia) {
                        groupedReqs[key].referencia = item.referencia;
                        groupedReqs[key].descripcion = item.referencia;
                    }
                    if (item.existencia !== null) {
                        groupedReqs[key].existencia = item.existencia;
                    }
                    if (item.ubicacion && !groupedReqs[key].ubicacion) {
                        groupedReqs[key].ubicacion = item.ubicacion;
                    }
                }
            });
            const reqMap = Object.values(groupedReqs);

            self.postMessage({
                status: 'success',
                data: {
                    inventario: invMap,
                    pedidosInsumos: reqMap
                }
            });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
};
