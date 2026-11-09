import { supabase } from '../supabaseClient';
import { isUnassignedErpBulkImport } from '../hooks/useOrders';
import {
    escapePostgrestFilter,
    validateCorporateEmail,
    validateSafeText,
    checkRateLimit,
    recordRateLimitAttempt,
    resetRateLimit,
    formatSafeErrorMessage
} from '../utils/security';

export { isUnassignedErpBulkImport };

export const searchInRibisoft = async (pedidoBusqueda, articuloBusqueda) => {
    return new Promise(async (resolve, reject) => {
        const pTerm = escapePostgrestFilter(pedidoBusqueda || "", 40);
        const aTerm = escapePostgrestFilter(articuloBusqueda || "", 40);
        if (!pTerm && !aTerm) return reject("INGRESAR PEDIDO O ÚLTIMOS DÍGITOS DEL ARTÍCULO.");
        if (aTerm && aTerm.length < 3) return reject("INGRESA AL MENOS 3 DÍGITOS DEL ARTÍCULO.");

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                return reject("🔒 SESIÓN EXPIRADA O NO AUTORIZADA. POR FAVOR INICIA SESIÓN.");
            }

            const rl = checkRateLimit('erp_search', session.user.email || 'user', {
                maxAttempts: 25,
                windowMs: 60 * 1000,
                lockoutMs: 30 * 1000
            });
            if (!rl.allowed) return reject(rl.error);
            recordRateLimitAttempt('erp_search', session.user.email || 'user', {
                maxAttempts: 25,
                windowMs: 60 * 1000,
                lockoutMs: 30 * 1000
            });

            let query = supabase.from('ribisoft_pedidos').select('*').limit(100);
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
        } catch (error) {
            reject(formatSafeErrorMessage(error, "ERROR DE CONEXIÓN AL CONSULTAR EL PEDIDO."));
        }
    });
};

export const loginEnGoogle = async (usuario, clave) => {
    const emailValidation = validateCorporateEmail(usuario);
    if (!emailValidation.valid) {
        return { success: false, error: `⚠️ ${emailValidation.error.toUpperCase()}` };
    }
    const cleanEmail = emailValidation.email;
    const cleanPass = String(clave || '').trim();
    if (!cleanPass || cleanPass.length < 6) {
        return { success: false, error: "⚠️ CREDENCIALES INCORRECTAS O USUARIO NO ENCONTRADO." };
    }

    const rl = checkRateLimit('auth_login', cleanEmail, {
        maxAttempts: 5,
        windowMs: 5 * 60 * 1000,
        lockoutMs: 3 * 60 * 1000
    });
    if (!rl.allowed) {
        return { success: false, error: rl.error.toUpperCase() };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: cleanPass,
        });
        if (error || !data?.user) {
            recordRateLimitAttempt('auth_login', cleanEmail, {
                maxAttempts: 5,
                windowMs: 5 * 60 * 1000,
                lockoutMs: 3 * 60 * 1000
            });
            return { success: false, error: "⚠️ CREDENCIALES INCORRECTAS O USUARIO NO ENCONTRADO." };
        }

        resetRateLimit('auth_login', cleanEmail);
        
        // El perfil del usuario viaja firmado en data.user.user_metadata
        const profile = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            nombre: validateSafeText(data.user.user_metadata?.nombre || 'Usuario', 80),
            rol: validateSafeText(data.user.user_metadata?.rol || 'GENERAL', 60),
            estado: 'Activo'
        };

        return { success: true, result: profile };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN AL SERVICIO DE AUTENTICACIÓN." };
    }
};

export const registrarEnGoogle = async (usuario, clave, nombre, area) => {
    const emailValidation = validateCorporateEmail(usuario);
    if (!emailValidation.valid) {
        return { success: false, error: "❌ SÓLO SE PERMITEN CORREOS CORPORATIVOS VÁLIDOS (@cdiexhibiciones.co)" };
    }
    const cleanEmail = emailValidation.email;
    const cleanPass = String(clave || '').trim();
    const cleanNombre = validateSafeText(nombre, 80).toUpperCase();
    const cleanArea = validateSafeText(area, 60);

    if (!cleanNombre || cleanNombre.length < 3) {
        return { success: false, error: "❌ INGRESA UN NOMBRE COMPLETO VÁLIDO." };
    }
    if (cleanPass.length < 6) {
        return { success: false, error: "❌ LA CLAVE DEBE TENER AL MENOS 6 CARACTERES." };
    }

    const rl = checkRateLimit('auth_register', cleanEmail, {
        maxAttempts: 3,
        windowMs: 15 * 60 * 1000,
        lockoutMs: 15 * 60 * 1000
    });
    if (!rl.allowed) {
        return { success: false, error: rl.error.toUpperCase() };
    }

    try {
        recordRateLimitAttempt('auth_register', cleanEmail, {
            maxAttempts: 3,
            windowMs: 15 * 60 * 1000,
            lockoutMs: 15 * 60 * 1000
        });
        const { error } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
            options: {
                data: {
                    nombre: cleanNombre,
                    rol: cleanArea
                }
            }
        });
        if (error) {
            return {
                success: false,
                error: "⚠️ NO SE PUDO COMPLETAR EL REGISTRO. VERIFICA LOS DATOS O SI LA CUENTA YA EXISTE."
            };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN AL REGISTRAR EL USUARIO." };
    }
};
