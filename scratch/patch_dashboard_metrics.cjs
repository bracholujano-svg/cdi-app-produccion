const fs = require('fs');

function patchMetrics() {
    const p = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
    let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    let newLines = [];
    
    let insideEficiencia = false;
    let insideCycleTimes = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 1. Import AREAS_RECEPCION
        if (line.includes("import { AREAS } from '../../utils/constants';")) {
            newLines.push("import { AREAS, AREAS_RECEPCION } from '../../utils/constants';");
            continue;
        }

        // 2. Replace Eficiencia Global Logic
        if (line.includes("const eficiencia = totalOrders > 0 ? Math.round((aTiempoCount / totalOrders) * 100) : 100;")) {
            const phiLogic = `
    // --- NUEVO ALGORITMO: ÍNDICE DE SALUD DE PLANTA (PHI) ---
    const LEAD_TIME_ESTIMADO = 45; // Días
    const getAreaProgress = (area) => {
        if (!area) return 0;
        const a = area.toLowerCase();
        if (a.includes('administrador') || a.includes('comercial')) return 0.05;
        if (a.includes('programación') || a.includes('diseño')) return 0.15;
        if (a.includes('corte') || a.includes('mecanizado')) return 0.35;
        if (a.includes('soldadura') || a.includes('torno') || a.includes('ebanistería')) return 0.55;
        if (a.includes('pintura')) return 0.75;
        if (a.includes('ensamble') || a.includes('armado')) return 0.85;
        if (a.includes('empaque')) return 0.95;
        if (a.includes('despacho') || a.includes('entregado')) return 1.0;
        return 0.1; // fallback
    };

    let totalHealth = 0;
    let healthCount = 0;

    orders.forEach(o => {
        if (!o.fechaEntregaPrometida) return;
        
        if (o.estadoInterno === 'DESPACHADO') {
            totalHealth += 100;
            healthCount++;
            return;
        }
        
        const daysLeft = getDaysLeft(o.fechaEntregaPrometida);
        const progress = getAreaProgress(o.areaActual);
        
        if (daysLeft === null || daysLeft < 0) {
            totalHealth += 0; // Atrasado o sin fecha
        } else {
            const daysNeeded = (1 - progress) * LEAD_TIME_ESTIMADO;
            if (daysLeft >= daysNeeded) {
                totalHealth += 100;
            } else {
                const score = (daysLeft / daysNeeded) * 100;
                totalHealth += score;
            }
        }
        healthCount++;
    });

    const eficiencia = healthCount > 0 ? Math.round(totalHealth / healthCount) : 100;
    // --------------------------------------------------------`;
            newLines.push(phiLogic);
            continue;
        }

        // 3. Update the text label for Eficiencia Global
        if (line.includes("<p className=\"text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-green-600\">Eficiencia Global</p>")) {
            newLines.push("                                      <p className=\"text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-green-600\" title=\"Índice de Salud de Planta (Evalúa tiempo restante vs. avance físico)\">Índice de Salud (PHI)</p>");
            continue;
        }

        // 4. Cycle Times Logic Replacement
        if (line.includes("const calcAreaTime = (areaKey) => {")) {
            insideCycleTimes = true;
            // Insert the new logic right here
            const newCycleLogic = `
                                            const areasData = AREAS_RECEPCION.map(areaKey => {
                                                const act = orders.filter(o => o?.areaActual === areaKey && o?.estadoInterno !== 'DESPACHADO');
                                                if (act.length === 0) return { label: areaKey, time: 0, text: '0 Artículos en Proceso', status: 'empty' };
                                                
                                                let totalMs = 0;
                                                act.forEach(o => {
                                                    let entryMs = Date.now();
                                                    if (o.historial && o.historial.length > 0) {
                                                        const lastH = o.historial[o.historial.length - 1];
                                                        if (lastH && lastH.fecha) entryMs = new Date(lastH.fecha).getTime();
                                                    }
                                                    totalMs += (Date.now() - entryMs);
                                                });
                                                const avgMs = totalMs / act.length;
                                                const d = avgMs / (1000 * 60 * 60 * 24);
                                                
                                                let status = 'normal';
                                                if (d > 4) status = 'critical';
                                                else if (d > 2) status = 'warning';
                                                
                                                return { label: areaKey, time: d, text: \`\${d.toFixed(1)} Días\`, status };
                                            }).filter(a => a.status !== 'empty'); // Opcional: mostrar todas o solo las activas. Dejemos todas para que se vea el flujo completo, así que quitamos este filter si queremos.
                                            
                                            // Renderizaremos TODAS para que vean el estatus real
                                            const activeAreasData = areasData; // o areasData.filter(a => a.status !== 'empty') si queremos limpiar. Dejaremos todas.
                                            
                                            const maxTime = Math.max(...activeAreasData.map(d => d.time), 1);`;
            
            newLines.push(newCycleLogic);
            continue;
        }

        if (insideCycleTimes) {
            // We need to skip lines until we hit `const maxTime` or `return areasData.map`
            if (line.includes("return areasData.map((item, idx) => (")) {
                insideCycleTimes = false; // Stop skipping
                
                // Replace the map function to use the new status colors
                newLines.push("                                            return activeAreasData.map((item, idx) => {");
                newLines.push("                                                let bgClass = 'bg-slate-200';");
                newLines.push("                                                let textClass = 'text-slate-500';");
                newLines.push("                                                let icon = null;");
                newLines.push("                                                if (item.status === 'normal') { bgClass = 'bg-green-500'; textClass = 'text-white'; }");
                newLines.push("                                                if (item.status === 'warning') { bgClass = 'bg-orange-400'; textClass = 'text-white'; icon = <Clock size={12} className=\"inline mr-1\" />; }");
                newLines.push("                                                if (item.status === 'critical') { bgClass = 'bg-red-600 animate-pulse'; textClass = 'text-white'; icon = <AlertTriangle size={12} className=\"inline mr-1\" />; }");
                newLines.push("");
                newLines.push("                                                return (");
                newLines.push("                                                <div key={idx} className=\"\">");
                newLines.push("                                                    <div className=\"flex justify-between text-xs font-bold mb-1\">");
                newLines.push("                                                        <span className=\"text-slate-600 truncate mr-2\">{item.label}</span>");
                newLines.push("                                                        <span className={item.status === 'critical' ? 'text-red-600' : 'text-slate-400'}>{icon}{item.text}</span>");
                newLines.push("                                                    </div>");
                newLines.push("                                                    <div className=\"w-full bg-slate-100 rounded-full h-2.5 overflow-hidden\">");
                newLines.push("                                                        <div className={`h-2.5 rounded-full transition-all duration-1000 ${bgClass}`} style={{ width: `${item.time > 0 ? Math.max((item.time / maxTime) * 100, 5) : 0}%` }}></div>");
                newLines.push("                                                    </div>");
                newLines.push("                                                </div>");
                newLines.push("                                            )});");
                continue;
            } else {
                // Skip the old code blocks
                continue;
            }
        }

        // Just push the line if it's not matching anything
        newLines.push(line);
    }

    fs.writeFileSync(p, newLines.join('\n'), 'utf8');
}

try {
    patchMetrics();
    console.log("Patched PHI logic and cycle times successfully.");
} catch(e) {
    console.error(e);
}
