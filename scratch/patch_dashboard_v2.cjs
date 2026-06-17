const fs = require('fs');

const path = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add context import and hook
content = content.replace(
    "import InformeInteligenteIA from './InformeInteligenteIA';",
    "import InformeInteligenteIA from './InformeInteligenteIA';\nimport { useAppContext } from '../../context/AppContext';"
);

content = content.replace(
    "const AdvancedExecutiveDashboard = ({ orders, coordinationAlerts, onClose }) => {",
    "const AdvancedExecutiveDashboard = ({ orders: rawOrders, coordinationAlerts, onClose }) => {\n    const { setSearchTerm } = useAppContext();"
);

// 2. Add startDate and endDate state, and filter orders
content = content.replace(
    "const [showQualityObs, setShowQualityObs] = useState(false);\n    const chartsRef = useRef({});",
    `const [showQualityObs, setShowQualityObs] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const chartsRef = useRef({});

    const orders = rawOrders.filter(o => {
        if (!startDate && !endDate) return true;
        if (!o.fechaEntregaPrometida) return false;
        const orderDate = new Date(o.fechaEntregaPrometida);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;
        return true;
    });`
);

// 3. Move basePlanta up
content = content.replace(
    "const totalOrders = orders.length;",
    "const totalOrders = orders.length;\n    const basePlanta = totalOrders;"
);

// 4. Update ISO 9001 math and add ALL areas
content = content.replace(
    "const seccionesReprocesos = {};\n    orders.forEach(o => {",
    "const seccionesReprocesos = {};\n    AREAS.forEach(a => seccionesReprocesos[a] = { totalItems: 0, retrabajos: 0, causasRaw: [] });\n    orders.forEach(o => {"
);

content = content.replace(
    "const tasa = stats.totalItems > 0 ? (stats.retrabajos / stats.totalItems) * 100 : 0;",
    "const tasa = basePlanta > 0 ? (stats.retrabajos / basePlanta) * 100 : 0;"
);

content = content.replace(
    ".filter(s => s.retrabajos > 0) // Solo secciones con reprocesos reales",
    ""
);

content = content.replace(
    "const basePlanta = totalOrders; // Población Total de la Planta\n    const itemsInspeccionados",
    "const itemsInspeccionados"
);

// 5. Add dates to nav bar
content = content.replace(
    "</div>\n                            <button onClick={onClose}",
    `</div>
                            
                            <div className="flex items-center gap-2 ml-4 shrink-0 bg-gray-50 p-2 rounded-xl border border-gray-200">
                                <Calendar size={16} className="text-gray-400" />
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-gray-500 bg-transparent outline-none" title="Desde" />
                                <span className="text-gray-300">-</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold text-gray-500 bg-transparent outline-none" title="Hasta" />
                            </div>

                            <button onClick={onClose}`
);

// 6. Pass props to IA tab
content = content.replace(
    "<InformeInteligenteIA orders={orders} />",
    "<InformeInteligenteIA orders={orders} onClose={onClose} setSearchTerm={setSearchTerm} />"
);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched AdvancedExecutiveDashboard.jsx successfully.");
