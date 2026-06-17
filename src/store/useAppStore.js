import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // ---------------------------------------------------------
  // 1. VOLATILE SEARCH & INPUT STATES (Causes massive re-renders if in Context)
  // ---------------------------------------------------------
  searchTerm: '',
  setSearchTerm: (term) => set({ searchTerm: term }),

  materialsSearchTerm: '',
  setMaterialsSearchTerm: (term) => set({ materialsSearchTerm: term }),

  itemSearchTerm: '',
  setItemSearchTerm: (term) => set({ itemSearchTerm: term }),

  excelSearchPedido: '',
  setExcelSearchPedido: (term) => set({ excelSearchPedido: term }),
  
  excelSearchArticulo: '',
  setExcelSearchArticulo: (term) => set({ excelSearchArticulo: term }),

  inputManualPedido: '',
  setInputManualPedido: (term) => set({ inputManualPedido: term }),
  
  inputManualCliente: '',
  setInputManualCliente: (term) => set({ inputManualCliente: term }),
  
  inputManualFecha: '',
  setInputManualFecha: (term) => set({ inputManualFecha: term }),
  
  inputManualDetalle: '',
  setInputManualDetalle: (term) => set({ inputManualDetalle: term }),

  // ---------------------------------------------------------
  // 2. FILTERS & PAGINATION
  // ---------------------------------------------------------
  areaFilter: 'Todas',
  setAreaFilter: (filter) => set({ areaFilter: filter }),

  clientFilter: 'Todos',
  setClientFilter: (filter) => set({ clientFilter: filter }),

  sortBy: 'ninguno',
  setSortBy: (sort) => set({ sortBy: sort }),

  viewFilter: 'TODOS',
  setViewFilter: (filter) => set({ viewFilter: filter }),

  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  gridColumns: 3,
  setGridColumns: (cols) => set({ gridColumns: cols }),

  // ---------------------------------------------------------
  // 3. UI TOGGLES & MODALS
  // ---------------------------------------------------------
  isSidebarOpen: false,
  setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),

  showAddModal: false,
  setShowAddModal: (show) => set({ showAddModal: show }),

  showRecetarioModal: false,
  setShowRecetarioModal: (show) => set({ showRecetarioModal: show }),

  recetarioMaximized: false,
  setRecetarioMaximized: (maximized) => set({ recetarioMaximized: maximized }),

  showCoordinationModal: false,
  setShowCoordinationModal: (show) => set({ showCoordinationModal: show }),

  showCoordViewModal: false,
  setShowCoordViewModal: (show) => set({ showCoordViewModal: show }),

  showDashboardModal: false,
  setShowDashboardModal: (show) => set({ showDashboardModal: show }),

  showReceptionModal: false,
  setShowReceptionModal: (show) => set({ showReceptionModal: show }),

  showMaterialsAlertModal: false,
  setShowMaterialsAlertModal: (show) => set({ showMaterialsAlertModal: show }),

  showReportConfigModal: false,
  setShowReportConfigModal: (show) => set({ showReportConfigModal: show }),

  showReportPreviewModal: false,
  setShowReportPreviewModal: (show) => set({ showReportPreviewModal: show }),

  showSearchSelector: false,
  setShowSearchSelector: (show) => set({ showSearchSelector: show }),

  dashboardTab: 'resumen',
  setDashboardTab: (tab) => set({ dashboardTab: tab }),

  openSection: null,
  setOpenSection: (section) => set({ openSection: section }),
}));
