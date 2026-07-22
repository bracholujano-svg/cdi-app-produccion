import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { safeStorage, safeSessionStorage } from '../utils/helpers';
import { SESSION_SECRET } from '../utils/security';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useOrders } from '../hooks/useOrders';
import { useInventoryMRP } from '../hooks/useInventoryMRP';

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const { supabaseData } = useSupabaseData();
  const { orders, setOrders, coordinationAlerts, setCoordinationAlerts, syncOrderToSupabase, syncAlertToSupabase } = useOrders();
  const inventoryReservations = useInventoryMRP(orders, supabaseData);

  const [showMaterialsAlertModal, setShowMaterialsAlertModal] = useState(false);
  const [activeAlertMaterials, setActiveAlertMaterials] = useState([]);

  const [supervisorProfile, setSupervisorProfile] = useState(() => {
    const saved = safeSessionStorage.get('cdi_supervisor_session');
    try { 
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (parsed.profile && parsed.signature) {
            const expectedSig = CryptoJS.SHA256(JSON.stringify(parsed.profile) + SESSION_SECRET).toString();
            if (expectedSig === parsed.signature) {
                return parsed.profile;
            }
        }
        return null; 
    } catch(e) { return null; }
  });

  const [selectedGroupPedido, setSelectedGroupPedido] = useState(null); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBulkOrders, setSelectedBulkOrders] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [viewFilter, setViewFilter] = useState('TODOS'); 
  const [currentPage, setCurrentPage] = useState(1);
  const [gridColumns, setGridColumns] = useState(3);

  // LIMPIEZA TEMPORAL DE CLONES (BIFURCACIÓN ACCIDENTAL)
  useEffect(() => {
    if (orders && orders.length > 0) {
      const now = new Date();
      const clones = orders.filter(o => {
        if (!o.master_id) return false;
        if (!o.creadoEn) return true;
        const created = new Date(o.creadoEn);
        const hours = (now - created) / (1000 * 60 * 60);
        return hours < 48; // Solo clones de las ultimas 48 horas
      });
      if (clones.length > 0) {
        console.log(`Iniciando limpieza de ${clones.length} clones accidentales...`);
        clones.forEach(clone => {
          syncOrderToSupabase(clone, true);
        });
      }
    }
  }, [orders?.length]);


  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecetarioModal, setShowRecetarioModal] = useState(false);
  const [showTVMonitor, setShowTVMonitor] = useState(false);
  const [recetarioMaximized, setRecetarioMaximized] = useState(false);
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [showCoordViewModal, setShowCoordViewModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReceptionModal, setShowReceptionModal] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('resumen');
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [appTheme, setAppTheme] = useState('dark');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
    if (appTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appTheme]);

  const [savedLogins, setSavedLogins] = useState(() => {
    const saved = safeStorage.get('cdi_recent_logins');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(u => u && typeof u === 'object') : [];
    } catch(e) { return []; }
  });

  const [openSection, setOpenSection] = useState(null);
  const [showHistoryPlanta, setShowHistoryPlanta] = useState(false);
  const [showHistoryCalidad, setShowHistoryCalidad] = useState(false);
  const [showHistoryEntrega, setShowHistoryEntrega] = useState(false);
  
  const [tempTransferAreas, setTempTransferAreas] = useState([]);
  const [tempAssignedPersonnel, setTempAssignedPersonnel] = useState({});
  const [tempTransferDate, setTempTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferNota, setTransferNota] = useState("");
  const [transferPhoto, setTransferPhoto] = useState(null);
  const [tempIsPartial, setTempIsPartial] = useState(false);
  const [tempShiftActivity, setTempShiftActivity] = useState("");
  const [tempOperario, setTempOperario] = useState("");
  const [shiftNoteText, setShiftNoteText] = useState("");
  const [tempPhoto, setTempPhoto] = useState(null);
  
  const [calidadState, setCalidadState] = useState("APROBADO");
  const [calidadInspector, setCalidadInspector] = useState("");
  const [calidadNota, setCalidadNota] = useState("");
  const [calidadPhoto, setCalidadPhoto] = useState(null);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const activeDictationTarget = useRef(null);

  const [coordList, setCoordList] = useState([]);
  const [inputManualPedido, setInputManualPedido] = useState("");
  const [inputManualCliente, setInputManualCliente] = useState("");
  const [inputManualFecha, setInputManualFecha] = useState("");
  const [inputManualDetalle, setInputManualDetalle] = useState("");

  const [excelSearchPedido, setExcelSearchPedido] = useState("");
  const [excelSearchArticulo, setExcelSearchArticulo] = useState("");
  const [excelSearchLoading, setExcelSearchLoading] = useState(false);
  const [excelSearchError, setExcelSearchError] = useState("");
  const [excelSearchSuccess, setExcelSearchSuccess] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [showSearchSelector, setShowSearchSelector] = useState(false);

  const [duplicateError, setDuplicateError] = useState("");

  const [repDate, setRepDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [repSupervisor, setRepSupervisor] = useState("");
  const [generatedReportData, setGeneratedReportData] = useState([]);

  // Agrupamos el estado
  const contextValue = {
    supabaseData,
    orders, setOrders, coordinationAlerts, setCoordinationAlerts, syncOrderToSupabase, syncAlertToSupabase,
    inventoryReservations,
    showMaterialsAlertModal, setShowMaterialsAlertModal,
    activeAlertMaterials, setActiveAlertMaterials,
    supervisorProfile, setSupervisorProfile,
    selectedGroupPedido, setSelectedGroupPedido,
    selectedOrder, setSelectedOrder,
    selectedBulkOrders, setSelectedBulkOrders,
    showBulkModal, setShowBulkModal,
    areaFilter, setAreaFilter,
    viewFilter, setViewFilter,
    currentPage, setCurrentPage,
    gridColumns, setGridColumns,
    isSidebarOpen, setIsSidebarOpen,
    showAddModal, setShowAddModal,
    showRecetarioModal, setShowRecetarioModal,
    showTVMonitor, setShowTVMonitor,
    recetarioMaximized, setRecetarioMaximized,
    showCoordinationModal, setShowCoordinationModal,
    showCoordViewModal, setShowCoordViewModal,
    showDashboardModal, setShowDashboardModal,
    showReceptionModal, setShowReceptionModal,
    dashboardTab, setDashboardTab,
    showReportConfigModal, setShowReportConfigModal,
    showReportPreviewModal, setShowReportPreviewModal,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    savedLogins, setSavedLogins,
    openSection, setOpenSection,
    showHistoryPlanta, setShowHistoryPlanta,
    showHistoryCalidad, setShowHistoryCalidad,
    showHistoryEntrega, setShowHistoryEntrega,
    tempTransferAreas, setTempTransferAreas,
    tempAssignedPersonnel, setTempAssignedPersonnel,
    tempTransferDate, setTempTransferDate,
    transferNota, setTransferNota,
    transferPhoto, setTransferPhoto,
    tempIsPartial, setTempIsPartial,
    tempShiftActivity, setTempShiftActivity,
    tempOperario, setTempOperario,
    shiftNoteText, setShiftNoteText,
    tempPhoto, setTempPhoto,
    calidadState, setCalidadState,
    calidadInspector, setCalidadInspector,
    calidadNota, setCalidadNota,
    calidadPhoto, setCalidadPhoto,
    transferNota, setTransferNota,
    transferPhoto, setTransferPhoto,
    isListening, setIsListening,
    recognitionRef,
    activeDictationTarget,
    coordList, setCoordList,
    inputManualPedido, setInputManualPedido,
    inputManualCliente, setInputManualCliente,
    inputManualFecha, setInputManualFecha,
    inputManualDetalle, setInputManualDetalle,
    excelSearchPedido, setExcelSearchPedido,
    excelSearchArticulo, setExcelSearchArticulo,
    excelSearchLoading, setExcelSearchLoading,
    excelSearchError, setExcelSearchError,
    excelSearchSuccess, setExcelSearchSuccess,
    searchResults, setSearchResults,
    showSearchSelector, setShowSearchSelector,
    duplicateError, setDuplicateError,
    repDate, setRepDate,
    repSupervisor, setRepSupervisor,
    generatedReportData, setGeneratedReportData
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
