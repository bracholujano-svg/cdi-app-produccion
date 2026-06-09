import { parseNumber } from '../utils/helpers';

// Helper local ya que no podemos importar fácilmente de otros archivos que usen dependencias del DOM
const safeParseNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let strVal = String(val).trim();
    if (strVal.includes(',') && !strVal.includes('.')) {
        strVal = strVal.replace(/,/g, '.');
    } else if (strVal.includes(',') && strVal.includes('.')) {
        const lastComma = strVal.lastIndexOf(',');
        const lastDot = strVal.lastIndexOf('.');
        if (lastComma > lastDot) {
            strVal = strVal.replace(/\\./g, '').replace(/,/g, '.');
        } else {
            strVal = strVal.replace(/,/g, '');
        }
    }
    const num = Number(strVal);
    return isNaN(num) ? 0 : num;
};

self.onmessage = function(e) {
    const { action, payload } = e.data;

    if (action === 'PROCESS_DATA') {
        try {
            const { inv, req } = payload;

            const invMap = inv ? inv.map(item => ({
                id_referencia: item['Id Referencia'],
                descripcion: item['Referencia'],
                cantidad_disponible: safeParseNumber(item['Saldo'])
            })) : [];

            const reqRaw = req ? req.map(item => ({
                pedido_num: item['pedidosin'],
                id_referencia: item['Id Referencia'],
                cantidad_requerida: safeParseNumber(item['Cantidad']),
                cantidad_oc: safeParseNumber(item['Cant.OC']),
                descripcion: item['Descripcion']
            })) : [];

            // Agrupar requerimientos por pedido y por referencia
            const groupedReqs = {};
            reqRaw.forEach(item => {
                const key = `${item.pedido_num}_${item.id_referencia}`;
                if (!groupedReqs[key]) {
                    groupedReqs[key] = { ...item };
                } else {
                    groupedReqs[key].cantidad_requerida += item.cantidad_requerida;
                    groupedReqs[key].cantidad_oc += item.cantidad_oc;
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
