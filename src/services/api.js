import { supabase } from '../supabaseClient';

export const searchInRibisoft = async (pedidoBusqueda, articuloBusqueda) => {
    return new Promise(async (resolve, reject) => {
        const pTerm = (pedidoBusqueda || "").trim();
        const aTerm = (articuloBusqueda || "").trim();
        if (!pTerm && !aTerm) return reject("INGRESAR PEDIDO O ÚLTIMOS DÍGITOS DEL ARTÍCULO.");
        if (aTerm && aTerm.length < 3) return reject("INGRESA AL MENOS 3 DÍGITOS DEL ARTÍCULO.");

        try {
            await supabase.auth.getSession(); let query = supabase.from('ribisoft_pedidos').select('*');
            if (pTerm) query = query.ilike('PedidoSIN', `%${pTerm}%`);
            if (aTerm) query = query.ilike('Código Ítem', `%${aTerm}%`);
            
            const { data, error } = await query;
            if (error) throw error;
            if (data && data.length > 0) {
                const cleanCode = (v) => {
                    if (v === undefined || v === null || String(v).trim() === '') return '';
                    const n = Number(v);
                    if (!Number.isNaN(n) && Number.isFinite(n)) return String(Math.trunc(n)).trim();
                    return String(v).replace(/\.0+$/, '').trim();
                };
                const rawMappedData = data.map(item => ({
                    pedido: cleanCode(item['PedidoSIN'] ?? item['pedido_sin']),
                    articulo: cleanCode(item['codigo_item'] ?? item['Código Ítem']),
                    descripcion: item['Descripción'] ?? item['descripcion'] ?? '',
                    cliente: item['Cliente'] || item['Nombre Proyecto'] || item['nombre_proyecto'] || 'CLIENTE NO REGISTRADO',
                    nombre: item['Descripción'] ?? item['descripcion'] ?? '',
                    proyecto: item['Nombre Proyecto'] ?? item['nombre_proyecto'] ?? '',
                    cantidad: item['Cantidad'] ?? item['cantidad'] ?? 1,
                    dim_1: item['dim_1'] ?? null,
                    dim_2: item['dim_2'] ?? null,
                    dim_3: item['dim_3'] ?? null,
                    acabado_1: item['acabado_1'] ?? null,
                    acabado_2: item['acabado_2'] ?? null,
                    acabado_3: item['acabado_3'] ?? null,
                    caracteristicas: item['caracteristicas'] ?? null,
                    programador: item['programador'] ?? item['Programador'] ?? null,
                    categoria: item['categoria'] ?? null,
                    notas: item['notas'] ?? null,
                    observaciones_erp: item['observaciones_erp'] ?? null
                }));

                // Deduplicar por (pedido + descripción normalizada) priorizando la fila que SÍ tiene código de artículo
                const dedupMap = new Map();
                for (const row of rawMappedData) {
                    const normDesc = String(row.descripcion || '').trim().toUpperCase().replace(/\s+/g, ' ');
                    const key = `${row.pedido}__${normDesc || row.articulo}`;
                    const existing = dedupMap.get(key);
                    if (!existing || (!existing.articulo && row.articulo)) {
                        dedupMap.set(key, row);
                    }
                }
                resolve(Array.from(dedupMap.values()));
            }
            else reject("❌ NO SE ENCONTRÓ EL ARTÍCULO O PEDIDO.");
        } catch (error) { reject("ERROR DE CONEXIÓN CON SUPABASE."); }
    });
};

export const loginEnGoogle = async (usuario, clave) => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: usuario,
            password: clave,
        });
        if (error || !data.user) return { success: false, error: "⚠️ CREDENCIALES INCORRECTAS O USUARIO NO ENCONTRADO." };
        
        // El perfil del usuario viaja en data.user.user_metadata
        const profile = {
            nombre: data.user.user_metadata.nombre || 'Usuario',
            rol: data.user.user_metadata.rol || 'GENERAL',
            estado: 'Activo' // Auth maneja la activación
        };

        return { success: true, result: profile };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN A SUPABASE AUTH." };
    }
};

export const registrarEnGoogle = async (usuario, clave, nombre, area) => {
    if (!usuario.endsWith('@cdiexhibiciones.co')) {
        return { success: false, error: "❌ SÓLO SE PERMITEN CORREOS CORPORATIVOS (@cdiexhibiciones.co)" };
    }
    if (clave.length < 6) {
        return { success: false, error: "❌ EL PIN DEBE TENER AL MENOS 6 DÍGITOS." };
    }
    try {
        const { data, error } = await supabase.auth.signUp({
            email: usuario,
            password: clave,
            options: {
                data: {
                    nombre: nombre,
                    rol: area
                }
            }
        });
        if (error) return { success: false, error: "⚠️ EL USUARIO YA EXISTE O HUBO UN ERROR EN EL REGISTRO: " + error.message };
        return { success: true };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN A SUPABASE AUTH." };
    }
};
