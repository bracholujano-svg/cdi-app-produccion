const fs = require('fs');

const path = './src/components/modals/AdvancedExecutiveDashboard.jsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(
  "import { X, Search, Filter, AlertTriangle, Clock, Calendar, CheckCircle, Package, BarChart2, Activity, Truck, ChevronUp, ChevronDown } from 'lucide-react';",
  "import { Sun, Moon, X, Search, Filter, AlertTriangle, Clock, Calendar, CheckCircle, Package, BarChart2, Activity, Truck, ChevronUp, ChevronDown } from 'lucide-react';"
);

// Context variables
content = content.replace(
  "const { setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal, dashboardTab, setDashboardTab } = useAppContext();",
  "const { setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal, dashboardTab, setDashboardTab, appTheme, setAppTheme } = useAppContext();"
);

// Theme replacements
content = content.replace(/bg-\[\#f1f5f9\]/g, 'theme-bg-main');
content = content.replace(/bg-white/g, 'theme-bg-card');
content = content.replace(/bg-gray-50/g, 'theme-bg-card');
content = content.replace(/border-gray-200/g, 'theme-border');
content = content.replace(/border-gray-100/g, 'theme-border');
content = content.replace(/border-gray-50/g, 'theme-border');
content = content.replace(/text-slate-800/g, 'text-[var(--text-main)]');
content = content.replace(/text-slate-900/g, 'text-[var(--text-main)]');
content = content.replace(/text-gray-500/g, 'theme-text-muted');
content = content.replace(/text-gray-400/g, 'theme-text-muted');
content = content.replace(/text-slate-500/g, 'theme-text-muted');

// Add toggle button to nav
const targetNavEnd = `                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors ml-2 shrink-0">✕</button>`;

const replacementNavEnd = `                            </div>
                            <div className="flex items-center shrink-0 ml-4">
                                <div 
                                    onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} 
                                    className={\`relative w-14 h-7 flex items-center bg-black/10 dark:bg-black/30 rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner \${appTheme === 'dark' ? 'border border-blue-500/30' : 'border border-black/10'}\`}
                                >
                                    <div 
                                        className={\`absolute w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out \${appTheme === 'dark' ? 'translate-x-7 bg-blue-500 shadow-[0_0_10px_#3b82f6,0_0_20px_#3b82f6]' : 'translate-x-0'}\`}
                                    >
                                        {appTheme === 'dark' ? <Moon size={12} color="white" /> : <Sun size={12} color="#f59e0b" />}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors ml-2 shrink-0 text-black">✕</button>`;

content = content.replace(targetNavEnd, replacementNavEnd);

fs.writeFileSync(path, content);
console.log('Dashboard updated!');
