export const safeStorage = {
    get: (key) => { try { return localStorage.getItem(key); } catch(e) { return null; } },
    set: (key, val) => { try { localStorage.setItem(key, val); } catch(e) {} },
    remove: (key) => { try { localStorage.removeItem(key); } catch(e) {} }
};

export const safeSessionStorage = {
    get: (key) => { try { return sessionStorage.getItem(key); } catch(e) { return null; } },
    set: (key, val) => { try { sessionStorage.setItem(key, val); } catch(e) {} },
    remove: (key) => { try { sessionStorage.removeItem(key); } catch(e) {} }
};

export const getLocalYYYYMMDD = (isoString) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return "";
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    } catch(e) { return ""; }
};

export const formatLocalDate = (dateString) => {
    if (!dateString) return "Sin fecha";
    try {
        if (String(dateString).includes("T")) return new Date(dateString).toLocaleDateString();
        return new Date(`${dateString}T12:00:00`).toLocaleDateString();
    } catch(e) { return String(dateString); }
};

export const getDaysLeft = (targetDate) => {
    if (!targetDate) return null;
    try {
        const today = new Date(); today.setHours(0,0,0,0); 
        let target = String(targetDate).includes('T') ? new Date(targetDate) : new Date(targetDate + 'T12:00:00');
        target.setHours(0,0,0,0);
        if (isNaN(target.getTime())) return null;
        return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    } catch(e) { return null; }
};

export const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    
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

export const calcAreaTime = (areaKey, orders) => {
    const act = orders.filter(o => o?.areaActual === areaKey && o?.estadoInterno !== 'DESPACHADO');
    if (act.length === 0) return { time: 0, text: 'Sin cola' };
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
    return { time: d, text: d.toFixed(1) + ' Días' };
};
