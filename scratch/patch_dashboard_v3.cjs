const fs = require('fs');

const path = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
let lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

let newLines = [];
let foundFirstBasePlanta = false;

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 1. Add context import
    if (line.includes("import InformeInteligenteIA from './InformeInteligenteIA';")) {
        newLines.push(line);
        newLines.push("import { useAppContext } from '../../context/AppContext';");
        continue;
    }

    // 2. Add setSearchTerm
    if (line.includes("const AdvancedExecutiveDashboard = ({ orders, coordinationAlerts, onClose }) => {")) {
        newLines.push("const AdvancedExecutiveDashboard = ({ orders: rawOrders, coordinationAlerts, onClose }) => {");
        newLines.push("    const { setSearchTerm } = useAppContext();");
        continue;
    }

    // 3. Add startDate and endDate, filter orders
    if (line.includes("const [showQualityObs, setShowQualityObs] = useState(false);")) {
        newLines.push("    const [showQualityObs, setShowQualityObs] = useState(false);");
        newLines.push("    const [startDate, setStartDate] = useState('');");
        newLines.push("    const [endDate, setEndDate] = useState('');");
        continue;
    }

    if (line.includes("const totalOrders = orders.length;")) {
        newLines.push("    const orders = rawOrders.filter(o => {");
        newLines.push("        if (!startDate && !endDate) return true;");
        newLines.push("        if (!o.fechaEntregaPrometida) return false;");
        newLines.push("        const orderDate = new Date(o.fechaEntregaPrometida);");
        newLines.push("        const start = startDate ? new Date(startDate) : null;");
        newLines.push("        const end = endDate ? new Date(endDate) : null;");
        newLines.push("        if (start) start.setHours(0,0,0,0);");
        newLines.push("        if (end) end.setHours(23,59,59,999);");
        newLines.push("        if (start && orderDate < start) return false;");
        newLines.push("        if (end && orderDate > end) return false;");
        newLines.push("        return true;");
        newLines.push("    });");
        newLines.push("");
        newLines.push(line);
        newLines.push("    const basePlanta = totalOrders;");
        continue;
    }

    // 4. Update ISO 9001 math and add ALL areas
    if (line.includes("const seccionesReprocesos = {};")) {
        newLines.push(line);
        newLines.push("    AREAS.forEach(a => seccionesReprocesos[a] = { totalItems: 0, retrabajos: 0, causasRaw: [] });");
        continue;
    }

    if (line.includes("const tasa = stats.totalItems > 0 ? (stats.retrabajos / stats.totalItems) * 100 : 0;")) {
        newLines.push("            const tasa = basePlanta > 0 ? (stats.retrabajos / basePlanta) * 100 : 0;");
        continue;
    }

    if (line.includes(".filter(s => s.retrabajos > 0)")) {
        // Skip it!
        continue;
    }

    if (line.includes("const basePlanta = totalOrders; // Población Total de la Planta")) {
        // Skip duplicate basePlanta!
        continue;
    }

    // 5. Add dates to nav bar
    if (line.includes("<button onClick={onClose}") && lines[i-1].includes("</div>")) {
        newLines.push('                            <div className="flex items-center gap-2 ml-4 shrink-0 bg-gray-50 p-2 rounded-xl border border-gray-200">');
        newLines.push('                                <Calendar size={16} className="text-gray-400" />');
        newLines.push('                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-gray-500 bg-transparent outline-none" title="Desde" />');
        newLines.push('                                <span className="text-gray-300">-</span>');
        newLines.push('                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold text-gray-500 bg-transparent outline-none" title="Hasta" />');
        newLines.push('                            </div>');
        newLines.push(line);
        continue;
    }

    // 6. Pass props to IA tab
    if (line.includes("<InformeInteligenteIA orders={orders} />")) {
        newLines.push("                        <InformeInteligenteIA orders={orders} onClose={onClose} setSearchTerm={setSearchTerm} />");
        continue;
    }

    // If no match, just keep the line
    newLines.push(line);
}

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log("Patched AdvancedExecutiveDashboard.jsx successfully with robust line-by-line method.");
