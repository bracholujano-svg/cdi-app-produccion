export const shareToWhatsApp = (order, contextData) => {
    const { type, savedLog, supervisorName, tempOperario, tempShiftActivity, shiftNoteText, calidadState, calidadInspector, calidadNota } = contextData;
    let text = '🏢 *CDI EXHIBICIONES | REPORTE OFICIAL* 🏢\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━\n';
    text += `📦 *PEDIDO:* ${order.pedidoNum || 'S/N'}\n`;
    text += `🏷️ *CÓDIGO:* ${order.codArticulo || 'S/N'}\n`;
    text += `🛋️ *PRODUCTO:* ${order.nombre || 'S/N'}\n`;
    text += `🏢 *CLIENTE:* ${order.cliente || 'S/N'}\n`;
    text += '━━━━━━━━━━━━━━━━━━━━━━\n\n';

    if (type === 'tech') {
        const log = savedLog || { supervisor: supervisorName, operario: tempOperario, actividad: tempShiftActivity, nota: shiftNoteText };
        text += '🏭 *AVANCE DE PRODUCCIÓN*\n';
        text += `🔹 *Fase / Actividad:* ${log.actividad}\n`;
        text += `👷 *Operario Asignado:* ${log.operario}\n`;
        text += `📝 *Novedades / Faltantes:* _${log.nota || 'Sin novedades'}_\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
    } else if (type === 'trazabilidad') {
        text += '🔄 *ACTA DE ENTREGA DE SECCIÓN*\n';
        text += `🔹 *Movimiento:* ${savedLog.accion}\n`;
        text += `📤 *Entrega:* ${savedLog.entrega}\n`;
        text += `📥 *Recibe:* ${savedLog.recibe}\n`;
        text += `👨‍💼 *Supervisa:* ${savedLog.supervisor || supervisorName || 'S/N'}\n`;
        text += `📝 *Observaciones:* _${savedLog.nota || 'Sin observaciones'}_\n`;
    } else if (type === 'calidad') {
        const log = savedLog || { estado: calidadState, inspector: calidadInspector, observacion: calidadNota, supervisor: supervisorName };
        const iconoEstado = log.estado === 'APROBADO' ? '✅' : log.estado === 'RETRABAJO' ? '⚠️' : '❌';
        text += '🔍 *INSPECCIÓN DE CALIDAD*\n';
        text += `${iconoEstado} *DICTAMEN:* *${log.estado}*\n`;
        text += `🕵️ *Inspector:* ${log.inspector}\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
        text += `📝 *Observaciones:* _${log.observacion || 'Ninguna'}_\n`;
    }

    text += '\n⏱️ _Reporte generado: ' + new Date().toLocaleString('es-CO') + '_\n';
    text += '📱 *Sistema CDI Planta*';

    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(text);
    window.open(url, 'whatsapp_cdi_tab');
};
