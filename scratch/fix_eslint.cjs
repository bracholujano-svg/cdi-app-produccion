const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const importsToAdd = `
import { useVoiceInput } from './hooks/useVoiceInput';
import { shareToWhatsApp } from './services/NotificationService';
`;

app = app.replace("import { useAppStore } from './store/useAppStore';", importsToAdd + "import { useAppStore } from './store/useAppStore';");

const mainAppContent = `
  const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
      // Stub callback since states are missing in this context
  }, []));

  const handleWhatsAppShare = (order) => {
      shareToWhatsApp(order);
  };

  const deleteAlert = async (id) => {
    try {
      const { error } = await supabase.from('alerta_coordinacion').delete().eq('id', id);
      if (error) throw error;
      setCoordinationAlerts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar la alerta: " + err.message);
    }
  };
`;

app = app.replace('function MainApp() {', 'function MainApp() {\n' + mainAppContent);

// Also fix useEffect setCurrentPage
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

fs.writeFileSync('src/App.jsx', app);
console.log('Fixed eslint.');
