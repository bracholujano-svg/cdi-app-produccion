import { searchInRibisoft } from './api';

export const executeExcelSearch = async (pedido, articulo) => {
    try {
        const results = await searchInRibisoft(pedido, articulo);
        return { success: true, results };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
};

export const fillFormWithResult = (result) => {
    const form = document.getElementById('nuevoRegistroForm');
    if (form) {
        if(form.pedidoNum) form.pedidoNum.value = result.pedido || "";
        if(form.codArticulo) form.codArticulo.value = result.articulo || "";
        if(form.cliente) form.cliente.value = result.cliente || "";
        if(form.nombre) form.nombre.value = result.nombre || "";
        if(form.cantidad) form.cantidad.value = result.cantidad || 1;
    }
};
