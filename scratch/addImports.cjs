const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

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

app = app.replace("import { useAppStore } from './store/useAppStore';", importsToAdd + "\nimport { useAppStore } from './store/useAppStore';");
fs.writeFileSync('src/App.jsx', app);
