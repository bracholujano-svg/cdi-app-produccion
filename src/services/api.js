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
                    cliente: item['Nombre Proyecto'] || item['Cliente'],
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
        const { data, error } = await supabase.from('usuarios').select('*').eq('usuario', usuario).eq('clave', clave).single();
        if (error || !data) return { success: false, error: "⚠️ CREDENCIALES INCORRECTAS O USUARIO NO ENCONTRADO." };
        if (data.estado === 'Pendiente') return { success: false, error: "⚠️ TU PERFIL ESTÁ PENDIENTE DE APROBACIÓN POR EL ADMINISTRADOR." };
        return { success: true, result: data };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN A SUPABASE." };
    }
};

export const registrarEnGoogle = async (usuario, clave, nombre, area) => {
    if (!usuario.endsWith('@cdiexhibiciones.co')) {
        return { success: false, error: "❌ SÓLO SE PERMITEN CORREOS CORPORATIVOS (@cdiexhibiciones.co)" };
    }
    try {
        const { error } = await supabase.from('usuarios').insert([{ usuario, clave, nombre, rol: area, estado: 'Pendiente' }]);
        if (error) return { success: false, error: "⚠️ EL USUARIO YA EXISTE O HUBO UN ERROR EN LA BASE DE DATOS." };
        return { success: true };
    } catch (error) {
        return { success: false, error: "❌ ERROR DE CONEXIÓN A SUPABASE." };
    }
};
