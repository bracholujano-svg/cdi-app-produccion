const fs = require('fs');
let app = fs.readFileSync('scratch/App_Functions.jsx', 'utf8');

const importsToAdd = `
import { useVoiceInput } from './hooks/useVoiceInput';
import { useImageProcessor } from './hooks/useImageProcessor';
import { executeTransfer, executeReception } from './services/OrderOperationsService';
import { shareToWhatsApp } from './services/NotificationService';
import { executeExcelSearch, fillFormWithResult as fillFormWithResultWrapper } from './services/ExternalSearchService';

import FilterControls from './components/ui/FilterControls';
import OrderGrid from './components/lists/OrderGrid';
import MaterialsAlertModal from './components/modals/MaterialsAlertModal';
import CoordViewModal from './components/modals/CoordViewModal';
import ReportConfigModal from './components/modals/ReportConfigModal';
`;

// Insert imports
if (!app.includes('executeTransfer')) {
    app = app.replace("import { useAppStore } from './store/useAppStore';", importsToAdd + "\nimport { useAppStore } from './store/useAppStore';");
}

// Add the useVoiceInput call at the start of MainApp
const mainAppContent = `
  const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
      // Logic handled via hook
  }, []));
  const { handleImageUpload } = useImageProcessor(setTempPhoto);
  const handleWhatsAppShare = (order) => shareToWhatsApp(order);
`;

app = app.replace('function MainApp() {', 'function MainApp() {\n' + mainAppContent);

// Fix the pagination useEffect
app = app.replace(`useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, areaFilter, viewFilter, clientFilter, sortBy]);`, `// Avoid calling setState synchronously
  const prevFilters = useRef({ searchTerm, areaFilter, viewFilter, clientFilter, sortBy });
  useEffect(() => {
    if (
        prevFilters.current.searchTerm !== searchTerm ||
        prevFilters.current.areaFilter !== areaFilter ||
        prevFilters.current.viewFilter !== viewFilter ||
        prevFilters.current.clientFilter !== clientFilter ||
        prevFilters.current.sortBy !== sortBy
    ) {
        setCurrentPage(1);
        prevFilters.current = { searchTerm, areaFilter, viewFilter, clientFilter, sortBy };
    }
  }, [searchTerm, areaFilter, viewFilter, clientFilter, sortBy]);`);

// Wait, I need to remove `isListening, setIsListening` from useAppContext or local state?
// In line 106, `const { isListening, setIsListening, ... } = useAppContext();`
// We should remove `isListening, setIsListening,` to avoid the "already declared" error.
app = app.replace('isListening, setIsListening,', '');

fs.writeFileSync('src/App.jsx', app);
console.log('Final transformations complete. Saved to src/App.jsx.');
