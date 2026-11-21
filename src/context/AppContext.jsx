import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { safeStorage, safeSessionStorage } from '../utils/helpers';
import { resolveTrustedUserRole } from '../utils/security';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { useOrders } from '../hooks/useOrders';
import { useInventoryMRP } from '../hooks/useInventoryMRP';
import { supabase, purgeBrowserAuthArtifacts } from '../supabaseClient';

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {
  const { supabaseData, syncMrpDelta } = useSupabaseData();
  const {
    orders, setOrders,
    coordinationAlerts, setCoordinationAlerts,
    packingLists, setPackingLists,
    syncOrderToSupabase, syncAlertToSupabase, syncPackingListToSupabase,
    syncNowDelta, isSyncingOrders, realtimeStatus
  } = useOrders();
  const triggerManualDeltaSync = useCallback(async () => {
    await Promise.all([
      syncNowDelta ? syncNowDelta() : Promise.resolve(),
      syncMrpDelta ? syncMrpDelta() : Promise.resolve()
    ]);
  }, [syncNowDelta, syncMrpDelta]);
  const inventoryReservations = useInventoryMRP(orders, supabaseData);

  const [showMaterialsAlertModal, setShowMaterialsAlertModal] = useState(false);
  const [activeAlertMaterials, setActiveAlertMaterials] = useState([]);

  // Sesión estrictamente en memoria RAM (0 persistencia en localStorage / sessionStorage; prohíbe auto-login)
  const [supervisorProfile, setSupervisorProfile] = useState(null);

  // Purga inicial de artefactos de sesión en disco y escucha de cambios de autenticación en memoria
  useEffect(() => {
    purgeBrowserAuthArtifacts();

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setSupervisorProfile(null);
        purgeBrowserAuthArtifacts();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const trusted = resolveTrustedUserRole(session.user);
        const verifiedProfile = {
          id: session.user.id,
          name: trusted.name,
          email: session.user.email,
          area: trusted.area,
          appRoles: trusted.appRoles,
          isAdmin: trusted.isAdmin,
          isPaintSupervisor: trusted.isPaintSupervisor
        };
        setSupervisorProfile(verifiedProfile);
      }
    });

    return () => {
      authSub?.subscription?.unsubscribe();
    };
  }, []);

  // Cierre automático de sesión por inactividad (45 minutos) para evitar sesiones olvidadas en terminales de planta
  useEffect(() => {
    if (!supervisorProfile) return;
    const IDLE_TIMEOUT_MS = 45 * 60 * 1000;
    let idleTimer = null;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        await supabase.auth.signOut().catch(() => {});
        setSupervisorProfile(null);
        purgeBrowserAuthArtifacts();
      }, IDLE_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [supervisorProfile]);

  const [selectedGroupPedido, setSelectedGroupPedido] = useState(null); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBulkOrders, setSelectedBulkOrders] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Mantener `selectedOrder` actualizado en tiempo real cuando `orders` cambie desde otro computador
  useEffect(() => {
    if (!selectedOrder?.id || !Array.isArray(orders)) return;
    const latestMatch = orders.find((o) => o && o.id === selectedOrder.id);
    if (latestMatch && JSON.stringify(latestMatch) !== JSON.stringify(selectedOrder)) {
      setSelectedOrder(latestMatch);
    }
  }, [orders, selectedOrder]);
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
        const cleanup = async () => {
          for (const clone of clones) {
            try {
              // Borrar silenciosamente y en secuencia para no saturar la red (Failed to fetch) ni mostrar alertas
              await supabase.from('produccion_pedidos').delete().eq('id', clone.id);
            } catch (err) {
              console.error("Error al borrar clon:", err);
            }
          }
          console.log("Limpieza de clones terminada.");
        };
        cleanup();
      }
    }
  }, [orders?.length]);


  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecetarioModal, setShowRecetarioModal] = useState(false);
  const [showEtpSupervisorModal, setShowEtpSupervisorModal] = useState(false);
  const [showTVMonitor, setShowTVMonitor] = useState(false);
  const [recetarioMaximized, setRecetarioMaximized] = useState(true);
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [showCoordViewModal, setShowCoordViewModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReceptionModal, setShowReceptionModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showPlantPlannerModal, setShowPlantPlannerModal] = useState(false);
  const [showPackingListsModal, setShowPackingListsModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchOrders, setDispatchOrders] = useState([]);
  const [showQRScannerModal, setShowQRScannerModal] = useState(false);
  const [scannedQrTarget, setScannedQrTarget] = useState(null);

  const openDispatchModal = (ordersToDispatch) => {
    if (!ordersToDispatch) return;
    const list = Array.isArray(ordersToDispatch) ? ordersToDispatch : [ordersToDispatch];
    setDispatchOrders(list);
    setShowDispatchModal(true);
  };

  const closeDispatchModal = () => {
    setShowDispatchModal(false);
    setDispatchOrders([]);
  };
  
  const [dashboardTab, setDashboardTab] = useState('resumen');
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [appTheme, setAppTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'cine';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('dark-mode') === 'true';
  });
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('dark-mode', isDarkMode);
  }, [isDarkMode]);

  // Deshabilitado almacenamiento de usuarios recientes en el equipo por política de cero persistencia
  const [savedLogins, setSavedLogins] = useState([]);

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

  const [repDateStart, setRepDateStart] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [repTimeStart, setRepTimeStart] = useState('06:00');
  const [repDateEnd, setRepDateEnd] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [repTimeEnd, setRepTimeEnd] = useState('18:00');
  const [repSupervisor, setRepSupervisor] = useState("");
  const [generatedReportData, setGeneratedReportData] = useState([]);

  // Agrupamos el estado
  const contextValue = {
    supabase,
    supabaseData,
    orders, setOrders, coordinationAlerts, setCoordinationAlerts, packingLists, setPackingLists, syncOrderToSupabase, syncAlertToSupabase, syncPackingListToSupabase,
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
    showEtpSupervisorModal, setShowEtpSupervisorModal,
    showTVMonitor, setShowTVMonitor,
    recetarioMaximized, setRecetarioMaximized,
    showCoordinationModal, setShowCoordinationModal,
    showCoordViewModal, setShowCoordViewModal,
    showDashboardModal, setShowDashboardModal,
    showReceptionModal, setShowReceptionModal,
    showDossierModal, setShowDossierModal,
    showPlantPlannerModal, setShowPlantPlannerModal,
    showPackingListsModal, setShowPackingListsModal,
    showQualityModal, setShowQualityModal,
    dashboardTab, setDashboardTab,
    showReportConfigModal, setShowReportConfigModal,
    showReportPreviewModal, setShowReportPreviewModal,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    isDarkMode, setIsDarkMode,
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
    repDateStart, setRepDateStart,
    repTimeStart, setRepTimeStart,
    repDateEnd, setRepDateEnd,
    repTimeEnd, setRepTimeEnd,
    repSupervisor, setRepSupervisor,
    generatedReportData, setGeneratedReportData,
    showDispatchModal, setShowDispatchModal,
    dispatchOrders, setDispatchOrders,
    openDispatchModal, closeDispatchModal,
    showQRScannerModal, setShowQRScannerModal,
    scannedQrTarget, setScannedQrTarget,
    triggerManualDeltaSync,
    isSyncingOrders,
    realtimeStatus
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
