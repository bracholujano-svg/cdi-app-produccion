import { supabase } from '../supabaseClient';

export const searchInRibisoft = async (pedidoBusqueda, articuloBusqueda) => {
    return new Promise(async (resolve, reject) => {
        const pTerm = (pedidoBusqueda || "").trim();
        const aTerm = (articuloBusqueda || "").trim();
        if (!pTerm && !aTerm) return reject("INGRESAR PEDIDO O ÚLTIMOS DÍGITOS DEL ARTÍCULO.");
        if (aTerm && aTerm.length < 3) return reject("INGRESA AL MENOS 3 DÍGITOS DEL ARTÍCULO.");

        try {
            let query = supabase.from('ribisoft_pedidos').select('*');
            if (pTerm) query = query.ilike('PedidoSIN', `%${pTerm}%`);
            if (aTerm) query = query.ilike('Código Ítem', `%${aTerm}%`);
            
            const { data, error } = await query;
            if (error) throw error;
            if (data && data.length > 0) {
                const mappedData = data.map(item => ({
                    pedido: item['PedidoSIN'],
                    articulo: item['Código Ítem'],
                    descripcion: item['Descripción'],
                    cliente: item['Cliente'] || item['Nombre Proyecto'] || 'CLIENTE NO REGISTRADO',
                    nombre: item['Descripción'],
                    proyecto: item['Nombre Proyecto'],
                    cantidad: item['Cantidad']
                }));
                resolve(mappedData);
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
