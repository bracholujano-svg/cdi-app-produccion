const fs = require('fs');
const path = require('path');

const headerFilePath = path.join(__dirname, '..', 'src', 'components', 'layout', 'Header.jsx');
let headerContent = fs.readFileSync(headerFilePath, 'utf-8');

// 1. Añadir Bell a imports
headerContent = headerContent.replace(
    /import \{ Sun, Moon, AlertTriangle, FileText, LogOut \} from 'lucide-react';/,
    `import { Sun, Moon, AlertTriangle, FileText, LogOut, Bell } from 'lucide-react';`
);

// 2. Extraer areaFilter, showReceptionModal, setShowReceptionModal de useAppContext
headerContent = headerContent.replace(
    /setShowCoordViewModal,\n  \} = useAppContext\(\);/,
    `setShowCoordViewModal,\n    showReceptionModal, setShowReceptionModal,\n    areaFilter\n  } = useAppContext();`
);

// 3. Añadir conteo de notificaciones antes del return
const returnStr = `  return (
    <>`;
const calcStr = `  const pendingReceptions = orders.filter(o => 
    o?.transferenciaPendiente && 
    (areaFilter === 'Todas' || o.transferenciaPendiente.haciaArea === areaFilter)
  ).length;

  const rejectedReceptions = orders.filter(o => 
    o && (areaFilter === 'Todas' || o.areaActual === areaFilter) &&
    (o.estadoInterno || "").startsWith("RECHAZADO POR")
  ).length;

  const totalNotifications = pendingReceptions + rejectedReceptions;

  return (
    <>`;
if (!headerContent.includes('const totalNotifications')) {
    headerContent = headerContent.replace(returnStr, calcStr);
}

// 4. Añadir botón al lado de Coord
const coordBtnStr = `             <button type="button" onClick={() => setShowCoordViewModal(true)} className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-[10px] md:text-xs font-black uppercase transition-all \${coordinationAlerts.length > 0 ? 'text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white' : 'theme-text-muted hover:text-[var(--primary)]'}\`}>
               <AlertTriangle size={"1.2em"} /> Coord ({coordinationAlerts.length})
             </button>`;

const newBtnsStr = `             <button type="button" onClick={() => setShowCoordViewModal(true)} className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-[10px] md:text-xs font-black uppercase transition-all \${coordinationAlerts.length > 0 ? 'text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white' : 'theme-text-muted hover:text-[var(--primary)]'}\`}>
               <AlertTriangle size={"1.2em"} /> Coord ({coordinationAlerts.length})
             </button>
             <button type="button" onClick={() => setShowReceptionModal(true)} className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-[10px] md:text-xs font-black uppercase transition-all relative \${totalNotifications > 0 ? 'text-red-500 hover:bg-red-500 hover:text-white' : 'theme-text-muted hover:text-[var(--primary)]'}\`}>
               <Bell size={"1.2em"} className={totalNotifications > 0 ? 'animate-pulse' : ''} /> Recepciones
               {totalNotifications > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{totalNotifications}</span>}
             </button>`;

headerContent = headerContent.replace(coordBtnStr, newBtnsStr);

fs.writeFileSync(headerFilePath, headerContent, 'utf-8');
console.log('Header.jsx restaurado con Campanita.');
