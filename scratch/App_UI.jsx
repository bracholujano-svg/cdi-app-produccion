import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { deepSanitize } from './utils/security';
import { SUPERVISORES, CONFIG_PROCESOS, AREAS_RECEPCION, AREAS } from './utils/constants';
import { safeStorage, safeSessionStorage, getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from './utils/helpers';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useInventoryMRP } from './hooks/useInventoryMRP';
import { useOrders } from './hooks/useOrders';
import { searchInRibisoft, loginEnGoogle, registrarEnGoogle } from './services/api';
import { Plus, MessageSquare, Clock, ArrowRightLeft, Search, UserCheck, MapPin, History, Mic, MicOff, Calendar, FileText, Camera, User, AlertTriangle, Bell, Megaphone, Trash2, LayoutList, AlertCircle, BarChart2, Lock, LogOut, Info, Printer, Package, Sun, Moon, Image as ImageIcon, CheckCircle, ChevronDown, ChevronUp, FolderOpen, FlaskConical, Menu, X } from 'lucide-react';

import { AppContextProvider, useAppContext } from './context/AppContext';
import { useAppStore } from './store/useAppStore';

import GroupDetailsModal from './components/orders/GroupDetailsModal';
import AddOrderModal from './components/orders/AddOrderModal';
import RecetarioModal from './components/orders/RecetarioModal';
import ReceptionModal from './components/orders/ReceptionModal';
import CoordinationModal from './components/orders/CoordinationModal';
import ReportPreviewModal from './components/orders/ReportPreviewModal';
import OrderDetailsModal from './components/orders/OrderDetailsModal';
import BulkOrderDetailsModal from './components/orders/BulkOrderDetailsModal';
import OrderCard from './components/orders/OrderCard';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import LoginScreen from './components/auth/LoginScreen';
import AdvancedExecutiveDashboard from './components/modals/AdvancedExecutiveDashboard';
import DossierDashboard from './components/views/DossierDashboard';
import TVMonitorBoard from './components/views/TVMonitorBoard';
import { ErrorBoundary } from './components/ErrorBoundary';
function MainApp() {
  const [currentPage, setCurrentPage] = useState(1);
  const [coordSearchPedido, setCoordSearchPedido] = useState('');
  const [coordSearchFecha, setCoordSearchFecha] = useState('');
  const [coordSortOrder, setCoordSortOrder] = useState('asc');
const {
    supabaseData,
    orders, setOrders, coordinationAlerts, setCoordinationAlerts, syncOrderToSupabase, syncAlertToSupabase,
    inventoryReservations,
    showMaterialsAlertModal, setShowMaterialsAlertModal,
    activeAlertMaterials, setActiveAlertMaterials,
    supervisorProfile, setSupervisorProfile,
    selectedGroupPedido, setSelectedGroupPedido,
    selectedOrder, setSelectedOrder,
    areaFilter, setAreaFilter,
    viewFilter, setViewFilter,
    gridColumns, setGridColumns,
    isSidebarOpen, setIsSidebarOpen,
    showAddModal, setShowAddModal,
    showRecetarioModal, setShowRecetarioModal,
    recetarioMaximized, setRecetarioMaximized,
    showCoordinationModal, setShowCoordinationModal,
    showCoordViewModal, setShowCoordViewModal,
    showDashboardModal, setShowDashboardModal,
    showTVMonitor, setShowTVMonitor,
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
    repDateStart, setRepDateStart,
    repTimeStart, setRepTimeStart,
    repDateEnd, setRepDateEnd,
    repTimeEnd, setRepTimeEnd,
    repSupervisor, setRepSupervisor,
    generatedReportData, setGeneratedReportData,
    selectedBulkOrders, setSelectedBulkOrders,
    showBulkModal, setShowBulkModal,
    showDossierModal,
  } = useAppContext();

  const searchTerm = useAppStore(state => state.searchTerm);
  const setSearchTerm = useAppStore(state => state.setSearchTerm);
  const materialsSearchTerm = useAppStore(state => state.materialsSearchTerm);
  const setMaterialsSearchTerm = useAppStore(state => state.setMaterialsSearchTerm);
  const itemSearchTerm = useAppStore(state => state.itemSearchTerm);
  const setItemSearchTerm = useAppStore(state => state.setItemSearchTerm);
  const clientFilter = useAppStore(state => state.clientFilter);
  const setClientFilter = useAppStore(state => state.setClientFilter);
  const sortBy = useAppStore(state => state.sortBy);
  const setSortBy = useAppStore(state => state.setSortBy);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-CO';
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          if (activeDictationTarget.current === 'planta') setShiftNoteText(prev => (prev + " " + finalTranscript).trim());
          if (activeDictationTarget.current === 'calidad') setCalidadNota(prev => (prev + " " + finalTranscript).trim());
          if (activeDictationTarget.current === 'transfer') setTransferNota(prev => (prev + " " + finalTranscript).trim());
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      if(selectedOrder.isReadOnly) {
        setShowHistoryPlanta(true);
      } else {
        setShowHistoryPlanta(false); 
        setShowHistoryCalidad(false); 
        setShowHistoryEntrega(false);
        setTempTransferAreas([]);
        setTempTransferDate(getLocalYYYYMMDD(new Date()));
        setTempShiftActivity(CONFIG_PROCESOS[selectedOrder.areaActual]?.[0] || "");
        setTempOperario(""); setShiftNoteText(""); setTempPhoto(null);
        setCalidadState("APROBADO"); setCalidadInspector(""); setCalidadNota(""); setCalidadPhoto(null);
        setTransferNota(""); setTransferPhoto(null);
        setTempAssignedPersonnel({});
      }
    }
  }, [selectedOrder]);

  const fillFormWithResult = (result) => {
    const form = document.getElementById('nuevoRegistroForm');
    if (form) {
        form.pedidoNum.value = result.pedido || "";
        form.codArticulo.value = result.articulo || "";
        form.cliente.value = result.cliente || "";
        form.nombre.value = result.nombre || "";
        form.cantidad.value = result.cantidad || 1;
    }
  };

  const doExcelSearch = async () => {
      setExcelSearchLoading(true); setExcelSearchError(""); setExcelSearchSuccess("");
      setSearchResults([]); setShowSearchSelector(false);
      try {
          const results = await searchInRibisoft(excelSearchPedido, excelSearchArticulo);
          if (results && results.length === 1) {
              fillFormWithResult(results[0]);
              setExcelSearchSuccess(`✅ Extraído: ${results[0].nombre}`);
          } else if (results && results.length > 1) {
              setSearchResults(results);
              setShowSearchSelector(true);
              setExcelSearchSuccess(`💡 Se encontraron ${results.length} coincidencias. Selecciona la correcta abajo.`);
          }
      } catch (err) { 
          setExcelSearchError(err instanceof Error ? err.message : String(err)); 
      } finally { 
          setExcelSearchLoading(false); 
      }
  };



  const handleImageUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setter(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const toggleMic = (target) => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); } 
    else { activeDictationTarget.current = target; recognitionRef.current.start(); setIsListening(true); }
  };

  const deleteAlert = (alertId) => {
      const newAlerts = coordinationAlerts.filter(a => a?.id !== alertId);
      setCoordinationAlerts(newAlerts);
      syncAlertToSupabase({ id: alertId }, true);
  };

  const updateAlertDate = (alertId, newDate) => {
      if (!newDate) return;
      let alertToUpdate = null;
      const updatedAlerts = coordinationAlerts.map(a => {
          if (a.id === alertId) { alertToUpdate = { ...a, fechaEntrega: newDate }; return alertToUpdate; }
          return a;
      });
      setCoordinationAlerts(updatedAlerts);
      if (alertToUpdate) syncAlertToSupabase(alertToUpdate);

      const alertObj = coordinationAlerts.find(a => a.id === alertId);
      if (alertObj) {
          const updatedOrders = orders.map(o => 
              (o.pedidoNum || "").toUpperCase() === (alertObj.pedidoNum || "").toUpperCase() 
              ? { ...o, fechaEntregaPrometida: newDate } 
              : o
          );
          setOrders(updatedOrders);
          updatedOrders.forEach(o => {
              if ((o.pedidoNum || "").toUpperCase() === (alertObj.pedidoNum || "").toUpperCase()) {
                  syncOrderToSupabase(o);
              }
          });
      }
  };

  const createOrder = (e) => {
    e.preventDefault();
    const form = e.target;
    const pedNum = (form.pedidoNum.value || "").trim().toUpperCase();
    const codArt = (form.codArticulo.value || "").trim().toUpperCase();
    const areaIni = form.areaRecibe.value;
    
    setDuplicateError("");
    const isDuplicate = orders.some(o => (o?.pedidoNum || "").toUpperCase() === pedNum && (o?.codArticulo || "").toUpperCase() === codArt && o.estadoInterno !== 'DESPACHADO');
    if (isDuplicate) {
        setDuplicateError(`El artículo ${codArt} del pedido ${pedNum} ya se encuentra activo en producción.`);
        return;
    }

    const existingAlert = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pedNum);
    
    const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

    const newOrder = {
      id: generateUUID(),
      pedidoNum: pedNum,
      codArticulo: codArt,
      nombre: (form.nombre.value || "").trim().toUpperCase(),
      cantidad: Number(form.cantidad.value) || 1,
      cliente: (form.cliente.value || "").trim().toUpperCase(),
      areaActual: areaIni,
      estadoInterno: CONFIG_PROCESOS[areaIni]?.[0] || "En Espera",
      prioridad: existingAlert ? 'ALTA' : 'NORMAL',
      fechaIngresoArea: new Date().toISOString(), 
      fechaEntregaPrometida: existingAlert ? existingAlert.fechaEntrega : null,
      bitacoraTurnos: [],
      bitacoraCalidad: [],
      historial: [{
          fecha: new Date().toISOString(),
          accion: `Ingreso Inicial en ${areaIni}`,
          entrega: (form.entregaPersona.value || "S/N").toUpperCase(),
          recibe: (form.recibePersona.value || "S/N").toUpperCase()
      }]
    };
    
    const newOrdersList = [...orders, newOrder];
    setOrders(newOrdersList); 
    syncOrderToSupabase(newOrder);
    setShowAddModal(false);
  };

  const createBulkOrders = (productsToLoad, areaIni, entregaPersona, recibePersona) => {
    setDuplicateError("");
    const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
    
    const newOrders = [];
    let skippedCount = 0;

    for (const res of productsToLoad) {
      const pedNum = (res.pedido || "").trim().toUpperCase();
      const codArt = (res.articulo || "").trim().toUpperCase();
      
      const isDuplicate = orders.some(o => (o?.pedidoNum || "").toUpperCase() === pedNum && (o?.codArticulo || "").toUpperCase() === codArt && o.estadoInterno !== 'DESPACHADO') || newOrders.some(o => (o?.pedidoNum || "").toUpperCase() === pedNum && (o?.codArticulo || "").toUpperCase() === codArt);
      
      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      const existingAlert = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pedNum);

      const newOrder = {
        id: generateUUID(),
        pedidoNum: pedNum,
        codArticulo: codArt,
        nombre: (res.nombre || "").trim().toUpperCase(),
        cantidad: Number(res.cantidad) || 1,
        cliente: (res.cliente || "").trim().toUpperCase(),
        areaActual: areaIni,
        estadoInterno: CONFIG_PROCESOS[areaIni]?.[0] || "En Espera",
        prioridad: existingAlert ? 'ALTA' : 'NORMAL',
        fechaIngresoArea: new Date().toISOString(), 
        fechaEntregaPrometida: existingAlert ? existingAlert.fechaEntrega : null,
        bitacoraTurnos: [],
        bitacoraCalidad: [],
        historial: [{
            fecha: new Date().toISOString(),
            accion: `Ingreso Masivo en ${areaIni}`,
            entrega: (entregaPersona || "S/N").toUpperCase(),
            recibe: (recibePersona || "S/N").toUpperCase()
        }]
      };
      newOrders.push(newOrder);
    }

    if (newOrders.length === 0 && skippedCount > 0) {
      setDuplicateError(`Todos los productos seleccionados ya se encontraban activos en producción.`);
      return;
    }

    const newOrdersList = [...orders, ...newOrders];
    setOrders(newOrdersList);
    newOrders.forEach(o => syncOrderToSupabase(o));
    setShowAddModal(false);
    setExcelSearchSuccess(`✅ ${newOrders.length} productos cargados exitosamente. ${skippedCount > 0 ? `(${skippedCount} omitidos por estar duplicados)` : ''}`);
    setTimeout(() => setExcelSearchSuccess(""), 5000);
  };

  const addShiftNote = (isTerminadoFlag = null) => {
    if (!selectedOrder) return;
    const newNote = { 
      id: Date.now(), 
      area: selectedOrder.areaActual,
      supervisor: supervisorProfile?.name || "S/N", operario: tempOperario || "S/N", 
      actividad: tempShiftActivity, nota: shiftNoteText || "Sin novedades", foto: tempPhoto, fecha: new Date().toISOString() 
    };
    const updatedOrder = { ...selectedOrder, estadoInterno: tempShiftActivity, bitacoraTurnos: [...(selectedOrder.bitacoraTurnos || []), newNote] };
    if (typeof isTerminadoFlag === 'boolean') {
      updatedOrder.isTerminado = isTerminadoFlag;
    }
    const newOrdersList = orders.map(o => o?.id === selectedOrder.id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setShiftNoteText(""); setTempPhoto(null);
  };

  const addQualityNote = () => {
    if (!selectedOrder) return;
    const newNote = {
      id: Date.now(), 
      area: selectedOrder.areaActual,
      supervisor: supervisorProfile?.name || "S/N", inspector: calidadInspector || "S/N",
      estado: calidadState, observacion: calidadNota || "Sin observaciones", foto: calidadPhoto, fecha: new Date().toISOString()
    };
    const updatedOrder = { ...selectedOrder, bitacoraCalidad: [...(selectedOrder.bitacoraCalidad || []), newNote] };
    const newOrdersList = orders.map(o => o?.id === selectedOrder.id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setCalidadNota(""); setCalidadPhoto(null);
  };

  const updateTransfer = (id, areas, date, en, re, isPartial = false) => {
    const order = orders.find(o => o?.id === id);
    if (!order || !areas || areas.length === 0) return;
    
    let newOrdersList = [...orders];
    
    areas.forEach((area, index) => {
        const isDespacho = area === 'Despachos';
        const personalAsignado = tempAssignedPersonnel[area] || [];
        const asignadoText = personalAsignado.length > 0 ? ` (Asignado a: ${personalAsignado.join(', ')})` : "";
        const newHistoryEntry = { 
            fecha: new Date().toISOString(), 
            supervisor: supervisorProfile?.name || "S/N", 
            accion: isPartial ? `Entrega Parcial a ${area}${asignadoText}` : `Entrega a ${area}${asignadoText}`, 
            entrega: en, recibe: re, nota: transferNota, foto: transferPhoto 
        };
        
        let targetOrder;
        
        if (index === 0) {
            // El primer destino actualiza el master original
            targetOrder = isDespacho 
              ? { 
                  ...order, 
                  areaActual: area, 
                  estadoInterno: 'En Espera', // o despachado según config
                  fechaEntregaPrometida: date,
                  asignado_a: personalAsignado,
                  isTerminado: false, historial: [...(order.historial || []), newHistoryEntry] 
                }
              : { 
                  ...order, 
                  estadoInterno: isPartial ? `ENTREGA PARCIAL EN TRÁNSITO A ${area}` : `EN TRÁNSITO A ${area}`,
                  fechaEntregaPrometida: date,
                  asignado_a: personalAsignado,
                  transferenciaPendiente: {
                      haciaArea: area,
                      entregadoPor: en || supervisorProfile?.name || "S/N",
                      nota: transferNota,
                      fotoEntrega: transferPhoto,
                      fechaEnvio: new Date().toISOString(),
                      isPartial: isPartial
                  },
                  isTerminado: false, historial: [...(order.historial || []), newHistoryEntry] 
                };
                
            newOrdersList = newOrdersList.map(o => o?.id === id ? targetOrder : o);
        } else {
            // Los destinos adicionales generan Clones (Bifurcación)
            const cloneId = crypto.randomUUID();
            targetOrder = isDespacho 
              ? { 
                  ...order, 
                  id: cloneId,
                  master_id: order.id,
                  areaActual: area, 
                  estadoInterno: 'En Espera', 
                  fechaEntregaPrometida: date,
                  asignado_a: personalAsignado,
                  isTerminado: false, historial: [...(order.historial || []), {
                      ...newHistoryEntry,
                      accion: `Bifurcación hacia ${area}${asignadoText}`
                  }] 
                }
              : { 
                  ...order,
                  id: cloneId,
                  master_id: order.id,
                  areaActual: order.areaActual,
                  estadoInterno: `EN TRÁNSITO A ${area}`,
                  fechaEntregaPrometida: date,
                  asignado_a: personalAsignado,
                  transferenciaPendiente: {
                      haciaArea: area,
                      entregadoPor: en || supervisorProfile?.name || "S/N",
                      nota: transferNota,
                      fotoEntrega: transferPhoto,
                      fechaEnvio: new Date().toISOString(),
                      isPartial: false // Las bifurcaciones no son parciales en sí
                  },
                  isTerminado: false, historial: [...(order.historial || []), {
                      ...newHistoryEntry,
                      accion: `Bifurcación hacia ${area}${asignadoText}`
                  }] 
                };
            
            newOrdersList.push(targetOrder);
        }
        
        if (targetOrder.estadoInterno === 'DESPACHADO' || area === 'Despachos') {
            const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === targetOrder.pedidoNum);
            const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
            if (allDispatched) {
                const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (targetOrder.pedidoNum || "").toUpperCase());
                if (alertObj) {
                    const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                    setCoordinationAlerts(newAlerts);
                    syncAlertToSupabase(alertObj, true);
                }
            }
        }
        
        syncOrderToSupabase(targetOrder);
    });
    
    setOrders(newOrdersList); 
    setSelectedOrder(null); 
  };

  const handleBulkShiftNote = (ids, isTerminadoFlag = null) => {
      if (!ids || ids.length === 0) return;
      let newOrdersList = [...orders];
      const newNoteBase = { 
        supervisor: supervisorProfile?.name || "S/N", operario: tempOperario || "S/N", 
        actividad: tempShiftActivity, nota: shiftNoteText || "Sin novedades", foto: tempPhoto, fecha: new Date().toISOString() 
      };

      ids.forEach((id, index) => {
          const order = newOrdersList.find(o => o?.id === id);
          if(order) {
            const newNote = { ...newNoteBase, area: order.areaActual, id: Date.now() + index };
            const updatedOrder = { ...order, estadoInterno: tempShiftActivity, bitacoraTurnos: [...(order.bitacoraTurnos || []), newNote] };
            if (typeof isTerminadoFlag === 'boolean') {
              updatedOrder.isTerminado = isTerminadoFlag;
            }
            newOrdersList = newOrdersList.map(o => o?.id === id ? updatedOrder : o);
            syncOrderToSupabase(updatedOrder);
          }
      });
      setOrders(newOrdersList);
      setShiftNoteText(""); setTempPhoto(null);
      setShowBulkModal(false);
      setSelectedBulkOrders([]);
  };

  const handleBulkQualityNote = (ids) => {
      if (!ids || ids.length === 0) return;
      let newOrdersList = [...orders];
      const newNoteBase = {
        supervisor: supervisorProfile?.name || "S/N", inspector: calidadInspector || "S/N",
        estado: calidadState, observacion: calidadNota || "Sin observaciones", foto: calidadPhoto, fecha: new Date().toISOString()
      };

      ids.forEach((id, index) => {
          const order = newOrdersList.find(o => o?.id === id);
          if(order) {
            const newNote = { ...newNoteBase, id: Date.now() + index };
            const updatedOrder = { ...order, bitacoraCalidad: [...(order.bitacoraCalidad || []), newNote] };
            newOrdersList = newOrdersList.map(o => o?.id === id ? updatedOrder : o);
            syncOrderToSupabase(updatedOrder);
          }
      });
      setOrders(newOrdersList);
      setCalidadNota(""); setCalidadPhoto(null);
      setShowBulkModal(false);
      setSelectedBulkOrders([]);
  };

  const handleBulkTransfer = (ids, areas, date, en, re, isPartial = false) => {
      if (!ids || ids.length === 0 || !areas || areas.length === 0) return;
      let newOrdersList = [...orders];
      
      ids.forEach((id) => {
          const order = newOrdersList.find(o => o?.id === id);
          if (!order) return;
          
          areas.forEach((area, index) => {
              const isDespacho = area === 'Despachos';
              const personalAsignado = tempAssignedPersonnel[area] || [];
              const asignadoText = personalAsignado.length > 0 ? ` (Asignado a: ${personalAsignado.join(', ')})` : "";
              const newHistoryEntry = { 
                  fecha: new Date().toISOString(), 
                  supervisor: supervisorProfile?.name || "S/N", 
                  accion: isPartial ? `Entrega Parcial a ${area}${asignadoText}` : `Entrega a ${area}${asignadoText}`, 
                  entrega: en, recibe: re, nota: transferNota, foto: transferPhoto 
              };
              
              let targetOrder;
              if (index === 0) {
                  targetOrder = isDespacho 
                    ? { 
                        ...order, 
                        areaActual: area, 
                        estadoInterno: 'En Espera', 
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        isTerminado: false, historial: [...(order.historial || []), newHistoryEntry] 
                      }
                    : { 
                        ...order, 
                        estadoInterno: isPartial ? `ENTREGA PARCIAL EN TRÁNSITO A ${area}` : `EN TRÁNSITO A ${area}`,
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        transferenciaPendiente: {
                            haciaArea: area,
                            entregadoPor: en || supervisorProfile?.name || "S/N",
                            nota: transferNota,
                            fotoEntrega: transferPhoto,
                            fechaEnvio: new Date().toISOString(),
                            isPartial: isPartial
                        },
                        isTerminado: false, historial: [...(order.historial || []), newHistoryEntry] 
                      };
                      
                  newOrdersList = newOrdersList.map(o => o?.id === id ? targetOrder : o);
              } else {
                  const cloneId = crypto.randomUUID();
                  targetOrder = isDespacho 
                    ? { 
                        ...order, 
                        id: cloneId,
                        master_id: order.id,
                        areaActual: area, 
                        estadoInterno: 'En Espera', 
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        isTerminado: false, historial: [...(order.historial || []), { ...newHistoryEntry, accion: `Bifurcación hacia ${area}${asignadoText}` }] 
                      }
                    : { 
                        ...order,
                        id: cloneId,
                        master_id: order.id,
                        areaActual: order.areaActual,
                        estadoInterno: `EN TRÁNSITO A ${area}`,
                        fechaEntregaPrometida: date,
                        asignado_a: personalAsignado,
                        transferenciaPendiente: {
                            haciaArea: area,
                            entregadoPor: en || supervisorProfile?.name || "S/N",
                            nota: transferNota,
                            fotoEntrega: transferPhoto,
                            fechaEnvio: new Date().toISOString(),
                            isPartial: false
                        },
                        isTerminado: false, historial: [...(order.historial || []), { ...newHistoryEntry, accion: `Bifurcación hacia ${area}${asignadoText}` }] 
                      };
                  newOrdersList.push(targetOrder);
              }
              
              if (targetOrder.estadoInterno === 'DESPACHADO' || area === 'Despachos') {
                  const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === targetOrder.pedidoNum);
                  const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
                  if (allDispatched) {
                      const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (targetOrder.pedidoNum || "").toUpperCase());
                      if (alertObj) {
                          const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                          setCoordinationAlerts(newAlerts);
                          syncAlertToSupabase(alertObj, true);
                      }
                  }
              }
              syncOrderToSupabase(targetOrder);
          });
      });
      
      setOrders(newOrdersList);
      setShowBulkModal(false);
      setSelectedBulkOrders([]);
  };

  const processReception = (id, accepted, receptionName, notes, photo) => {
      const order = orders.find(o => o?.id === id);
      if (!order || !order.transferenciaPendiente) return;
      
      const isReject = !accepted;
      const targetArea = order.transferenciaPendiente.haciaArea;
      const isPartial = order.transferenciaPendiente.isPartial;
      
      const newHistoryEntry = {
          fecha: new Date().toISOString(),
          supervisor: supervisorProfile?.name || "S/N",
          accion: isReject ? `Rechazo de ${targetArea}` : (isPartial ? `Recepción Parcial en ${targetArea}` : `Recepción en ${targetArea}`),
          entrega: order.transferenciaPendiente.entregadoPor,
          recibe: receptionName,
          nota: notes,
          foto: photo
      };

      const updatedOrder = isReject
          ? {
              ...order,
              estadoInterno: isPartial ? `ENTREGA PARCIAL RECHAZADA POR ${targetArea}` : `RECHAZADO POR ${targetArea}`,
              transferenciaPendiente: null,
              isTerminado: false, historial: [...(order.historial || []), newHistoryEntry]
          }
          : {
              ...order,
              areaActual: isPartial ? order.areaActual : targetArea,
              areas_compartidas: isPartial 
                 ? [...new Set([...(order.areas_compartidas || []), targetArea])] 
                 : [],
              estadoInterno: isPartial ? order.estadoInterno : (CONFIG_PROCESOS[targetArea]?.[0] || "En Espera"),
              transferenciaPendiente: null,
              isTerminado: false, historial: [...(order.historial || []), newHistoryEntry]
          };

      const newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);

      if (!isReject && targetArea === 'Despachos') {
          const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === updatedOrder.pedidoNum);
          const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
          if (allDispatched) {
              const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (updatedOrder.pedidoNum || "").toUpperCase());
              if (alertObj) {
                  const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                  setCoordinationAlerts(newAlerts);
                  syncAlertToSupabase(alertObj, true);
              }
          }
      }

      setOrders(newOrdersList);
      syncOrderToSupabase(updatedOrder);
  };

  const processBulkReception = (ids, accepted, receptionName, notes, photo) => {
      if (!ids || ids.length === 0) return;
      let newOrdersList = [...orders];
      const updatedOrdersToSync = [];
      
      const isReject = !accepted;
      
      ids.forEach((id) => {
          const order = newOrdersList.find(o => o?.id === id);
          if (!order || !order.transferenciaPendiente) return;
          
          const targetArea = order.transferenciaPendiente.haciaArea;
          const isPartial = order.transferenciaPendiente.isPartial;
          
          const newHistoryEntry = {
              fecha: new Date().toISOString(),
              supervisor: supervisorProfile?.name || "S/N",
              accion: isReject ? `Rechazo de ${targetArea}` : (isPartial ? `Recepción Parcial en ${targetArea}` : `Recepción en ${targetArea}`),
              entrega: order.transferenciaPendiente.entregadoPor,
              recibe: receptionName,
              nota: notes,
              foto: photo
          };
          
          const updatedOrder = isReject
              ? {
                  ...order,
                  estadoInterno: isPartial ? `ENTREGA PARCIAL RECHAZADA POR ${targetArea}` : `RECHAZADO POR ${targetArea}`,
                  transferenciaPendiente: null,
                  isTerminado: false, historial: [...(order.historial || []), newHistoryEntry]
              }
              : {
                  ...order,
                  areaActual: isPartial ? order.areaActual : targetArea,
                  areas_compartidas: isPartial 
                     ? [...new Set([...(order.areas_compartidas || []), targetArea])] 
                     : [],
                  estadoInterno: isPartial ? order.estadoInterno : (CONFIG_PROCESOS[targetArea]?.[0] || "En Espera"),
                  transferenciaPendiente: null,
                  isTerminado: false, historial: [...(order.historial || []), newHistoryEntry]
              };
              
          newOrdersList = newOrdersList.map(o => o?.id === id ? updatedOrder : o);
          updatedOrdersToSync.push(updatedOrder);
          
          if (!isReject && targetArea === 'Despachos') {
              const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === updatedOrder.pedidoNum);
              const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
              if (allDispatched) {
                  const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (updatedOrder.pedidoNum || "").toUpperCase());
                  if (alertObj) {
                      const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                      setCoordinationAlerts(newAlerts);
                      syncAlertToSupabase(alertObj, true);
                  }
              }
          }
      });
      
      setOrders(newOrdersList);
      updatedOrdersToSync.forEach(o => syncOrderToSupabase(o));
  };

  const addItemToCoordList = () => {
    if (!inputManualPedido || !inputManualFecha || !inputManualCliente) return;
    const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
    const newItem = { id: generateUUID(), pedidoNum: inputManualPedido.trim().toUpperCase(), cliente: inputManualCliente.trim().toUpperCase(), fechaEntrega: inputManualFecha, detalle: inputManualDetalle ? inputManualDetalle.trim() : '', creadoEn: new Date().toISOString() };
    setCoordList([...coordList, newItem]);
    setInputManualPedido(""); setInputManualCliente(""); setInputManualDetalle("");
  };

  const saveBatchCoordination = () => {
    const newAlerts = [...coordinationAlerts, ...coordList];
    setCoordinationAlerts(newAlerts); coordList.forEach(a => syncAlertToSupabase(a));
    
    let updatedOrders = [...orders];
    coordList.forEach(item => {
        updatedOrders = updatedOrders.map(o => (o?.pedidoNum || "").toUpperCase() === item.pedidoNum ? { ...o, prioridad: 'ALTA', fechaEntregaPrometida: item.fechaEntrega } : o);
    });
    setOrders(updatedOrders); updatedOrders.filter(o => coordList.some(c => c.pedidoNum === o.pedidoNum)).forEach(o => syncOrderToSupabase(o));
    
    setCoordList([]); setShowCoordinationModal(false);
  };

  const shareToWhatsApp = (type, savedLog = null) => {
    if (!selectedOrder) return;
    
    let text = `🏢 *CDI EXHIBICIONES | REPORTE OFICIAL* 🏢\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 *PEDIDO:* ${selectedOrder.pedidoNum || 'S/N'}\n`;
    text += `🏷️ *CÓDIGO:* ${selectedOrder.codArticulo || 'S/N'}\n`;
    text += `🛋️ *PRODUCTO:* ${selectedOrder.nombre || 'S/N'}\n`;
    text += `🏢 *CLIENTE:* ${selectedOrder.cliente || 'S/N'}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (type === 'tech') {
        const log = savedLog || { supervisor: supervisorProfile?.name, operario: tempOperario, actividad: tempShiftActivity, nota: shiftNoteText };
        text += `🏭 *AVANCE DE PRODUCCIÓN*\n`;
        text += `🔹 *Fase / Actividad:* ${log.actividad}\n`;
        text += `👷 *Operario Asignado:* ${log.operario}\n`;
        text += `📝 *Novedades / Faltantes:* _${log.nota || 'Sin novedades'}_\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
    } else if (type === 'trazabilidad') {
        text += `🔄 *ACTA DE ENTREGA DE SECCIÓN*\n`;
        text += `🔹 *Movimiento:* ${savedLog.accion}\n`;
        text += `📤 *Entrega:* ${savedLog.entrega}\n`;
        text += `📥 *Recibe:* ${savedLog.recibe}\n`;
        text += `👨‍💼 *Supervisa:* ${savedLog.supervisor || supervisorProfile?.name || 'S/N'}\n`;
        text += `📝 *Observaciones:* _${savedLog.nota || 'Sin observaciones'}_\n`;
    } else if (type === 'calidad') {
        const log = savedLog || { estado: calidadState, inspector: calidadInspector, observacion: calidadNota, supervisor: supervisorProfile?.name };
        const iconoEstado = log.estado === 'APROBADO' ? '✅' : log.estado === 'RETRABAJO' ? '⚠️' : '❌';
        text += `🔍 *INSPECCIÓN DE CALIDAD*\n`;
        text += `${iconoEstado} *DICTAMEN:* *${log.estado}*\n`;
        text += `🕵️ *Inspector:* ${log.inspector}\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
        text += `📝 *Observaciones:* _${log.observacion || 'Ninguna'}_\n`;
    }

    text += `\n⏱️ _Reporte generado: ${new Date().toLocaleString('es-CO')}_\n`;
    text += `📱 *Sistema CDI Planta*`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, 'whatsapp_cdi_tab');
  };

  const generateShiftReport = () => {
    if (!repSupervisor || !repDateStart || !repTimeStart || !repDateEnd || !repTimeEnd) return;
    let entries = [];
    
    // Parsear fechas de inicio y fin para filtrado
    const startDateTime = new Date(`${repDateStart}T${repTimeStart}:00`).getTime();
    const endDateTime = new Date(`${repDateEnd}T${repTimeEnd}:00`).getTime();
    
    // Función para normalizar nombres y permitir búsquedas parciales (ignora mayúsculas y tildes)
    const normalizeName = (name) => name ? name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    
    const checkMatch = (savedName) => {
        if (repSupervisor === "TODOS") return true;
        const selParts = normalizeName(repSupervisor).split(" ").filter(p => p.trim() !== "");
        const savNorm = normalizeName(savedName);
        return selParts.every(part => savNorm.includes(part));
    };

    orders.forEach(order => {
      // Producción
      const tech = (order?.bitacoraTurnos || []).filter(n => {
        const t = new Date(n?.fecha).getTime();
        return t >= startDateTime && t <= endDateTime && checkMatch(n?.supervisor);
      });
      tech.forEach(n => entries.push({ ...n, area: order?.areaActual || 'DESCONOCIDA', type: 'PRODUCCIÓN', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.actividad}: ${n.nota}`, person: `OP: ${n.operario}`, status: 'AVANCE' }));
      
      // Calidad
      const cal = (order?.bitacoraCalidad || []).filter(n => {
        const t = new Date(n?.fecha).getTime();
        return t >= startDateTime && t <= endDateTime && checkMatch(n?.supervisor);
      });
      cal.forEach(n => entries.push({ ...n, area: order?.areaActual || 'DESCONOCIDA', type: 'CALIDAD', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `Obs: ${n.observacion}`, person: `INSP: ${n.inspector}`, status: n.estado }));
      
      // Entregas (Trazabilidad)
      const mov = (order?.historial || []).filter(n => {
        const t = new Date(n?.fecha).getTime();
        return t >= startDateTime && t <= endDateTime && n?.accion?.includes('Entrega a') && checkMatch(n?.supervisor);
      });
      mov.forEach(n => entries.push({ ...n, area: order?.areaActual || 'DESCONOCIDA', type: 'TRASLADO', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.accion} | Obs: ${n.nota || 'N/A'}`, person: `DE: ${n.entrega} A: ${n.recibe}`, status: 'ENTREGADO' }));
    });
    
    if(entries.length === 0) {
        alert("⚠️ No hay registros de actividades para este supervisor en el rango seleccionado.");
        return;
    }
    
    setGeneratedReportData(entries.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)));
    setShowReportConfigModal(false); setShowReportPreviewModal(true);
  };

  const uniqueClients = React.useMemo(() => {
    const clients = orders.map(o => o?.cliente).filter(c => c && c.trim() !== "");
    return [...new Set(clients)].sort();
  }, [orders]);

  const filteredOrders = orders.filter(o => {
    if (!o) return false;
    
    // Ocultar clones (bifurcaciones) que ya llegaron a áreas de convergencia
    if (o.master_id && ['Ensamble', 'Empaque', 'Despachos'].includes(o.areaActual)) {
        return false;
    }
    
    const st = searchTerm.toLowerCase().trim();
    const searchTerms = st ? st.split(/\s+/) : [];
    
    const matchSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (String(o.pedidoNum || "")).toLowerCase().includes(term) || 
        (String(o.nombre || "")).toLowerCase().includes(term) || 
        (String(o.codArticulo || "")).toLowerCase().includes(term) ||
        (String(o.cliente || "")).toLowerCase().includes(term)
    );

    const matchArea = areaFilter === 'Todas' || 
                      areaFilter === 'Administrador / Todos' || 
                      o.areaActual === areaFilter || 
                      (Array.isArray(o.areas_compartidas) && o.areas_compartidas.includes(areaFilter)) ||
                      o.transferenciaPendiente?.haciaArea === areaFilter;
    const filterUpper = clientFilter.toUpperCase();
    const matchClient = clientFilter === 'Todos' || String(o.cliente || "").toUpperCase().includes(filterUpper);
    
    const alertMatch = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (o.pedidoNum || "").toUpperCase());
    const effectiveDate = alertMatch?.fechaEntrega;

    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(effectiveDate) !== null && getDaysLeft(effectiveDate) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(effectiveDate) === null || getDaysLeft(effectiveDate) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && matchClient && o.estadoInterno === 'DESPACHADO';
    return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO';
  });

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    if (!order) return acc;
    const pNum = order.pedidoNum || "S/N";
    
    // Si la alerta tiene una fecha de entrega, usarla como prioridad
    const alertMatch = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pNum.toUpperCase());
    const displayDate = alertMatch?.fechaEntrega;

    if (!acc[pNum]) acc[pNum] = { pedidoNum: pNum, cliente: order.cliente, fechaEntregaPrometida: displayDate, products: [] };
    acc[pNum].products.push(order);
    return acc;
  }, {});
  const groupedArray = Object.values(groupedOrders);
  let finalGroupedArray = [...groupedArray];

  if (sortBy === 'pedido_asc') {
    finalGroupedArray.sort((a, b) => String(a.pedidoNum).localeCompare(String(b.pedidoNum), undefined, {numeric: true}));
  } else if (sortBy === 'pedido_desc') {
    finalGroupedArray.sort((a, b) => String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, {numeric: true}));
  } else if (sortBy === 'fecha_asc') {
    finalGroupedArray.sort((a, b) => {
      if (!a.fechaEntregaPrometida) return 1;
      if (!b.fechaEntregaPrometida) return -1;
      return new Date(a.fechaEntregaPrometida) - new Date(b.fechaEntregaPrometida);
    });
  } else if (sortBy === 'fecha_desc') {
    finalGroupedArray.sort((a, b) => {
      if (!a.fechaEntregaPrometida) return 1;
      if (!b.fechaEntregaPrometida) return -1;
      return new Date(b.fechaEntregaPrometida) - new Date(a.fechaEntregaPrometida);
    });
  }

  const activeGroupObj = finalGroupedArray.find(g => g?.pedidoNum === selectedGroupPedido) || null;

  // Pagination logic
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, areaFilter, viewFilter, clientFilter, sortBy]);

  const itemsPerPage = 15;
  const totalPages = Math.ceil(finalGroupedArray.length / itemsPerPage) || 1;
  const paginatedGroups = finalGroupedArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  let gridColsClass = 'grid-cols-1 md:grid-cols-3';
  if (gridColumns === 2) gridColsClass = 'grid-cols-2 lg:grid-cols-3';
  if (gridColumns === 3) gridColsClass = 'grid-cols-3 lg:grid-cols-3';
  if (gridColumns === 4) gridColsClass = 'grid-cols-3 lg:grid-cols-4';
  if (gridColumns === 5) gridColsClass = 'grid-cols-3 lg:grid-cols-5';

  if (!supervisorProfile) return <LoginScreen />;

  return (
    <div className="min-h-screen font-sans pb-20 transition-colors duration-300 theme-bg-main" data-theme={appTheme}>
      
      <div className="sticky top-0 z-40 bg-[var(--color-base)] shadow-sm border-b theme-border">
        <Header />
        <FilterControls uniqueClients={uniqueClients} />
      </div>
      <Sidebar />

      <OrderGrid 
        gridColsClass={gridColsClass} 
        paginatedGroups={paginatedGroups} 
        groupedArray={groupedArray} 
        totalPages={totalPages} 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
      />

      <GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} />

      <RecetarioModal />
      <ReceptionModal processReception={processReception} processBulkReception={processBulkReception} />

      <AddOrderModal createOrder={createOrder} createBulkOrders={createBulkOrders} doExcelSearch={doExcelSearch} />

      <OrderDetailsModal 
        handleImageUpload={handleImageUpload}
        addShiftNote={addShiftNote}
        addQualityNote={addQualityNote}
        updateTransfer={updateTransfer}
        shareToWhatsApp={shareToWhatsApp}
        toggleMic={toggleMic}
      />
      
      {showBulkModal && (
        <BulkOrderDetailsModal
          handleImageUpload={handleImageUpload}
          addShiftNote={(isTerminadoFlag) => handleBulkShiftNote(selectedBulkOrders.map(o => o.id), isTerminadoFlag)}
          addQualityNote={() => handleBulkQualityNote(selectedBulkOrders.map(o => o.id))}
          updateTransfer={handleBulkTransfer}
          toggleMic={toggleMic}
        />
      )}

      {showDashboardModal && (
        <AdvancedExecutiveDashboard 
            orders={orders} 
            coordinationAlerts={coordinationAlerts} 
            onClose={() => setShowDashboardModal(false)} 
        />
      )}

      {showDossierModal && (
        <DossierDashboard />
      )}

      {showTVMonitor && (
        <TVMonitorBoard 
            allOrders={orders} 
            coordinationAlerts={coordinationAlerts}
            onClose={() => setShowTVMonitor(false)} 
        />
      )}

      <CoordinationModal addItemToCoordList={addItemToCoordList} saveBatchCoordination={saveBatchCoordination} />

      <ReportPreviewModal />

      {showCoordViewModal && <CoordViewModal deleteAlert={deleteAlert} />}

      {showReportConfigModal && (
        <ReportConfigModal 
          repSupervisor={repSupervisor} setRepSupervisor={setRepSupervisor}
          repDateStart={repDateStart} setRepDateStart={setRepDateStart}
          repTimeStart={repTimeStart} setRepTimeStart={setRepTimeStart}
          repDateEnd={repDateEnd} setRepDateEnd={setRepDateEnd}
          repTimeEnd={repTimeEnd} setRepTimeEnd={setRepTimeEnd}
          generateShiftReport={generateShiftReport}
          setShowReportConfigModal={setShowReportConfigModal}
        />
      )}

      

      {showMaterialsAlertModal && (
        <MaterialsAlertModal 
          activeAlertMaterials={activeAlertMaterials} 
          setShowMaterialsAlertModal={setShowMaterialsAlertModal} 
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContextProvider>
        <MainApp />
      </AppContextProvider>
    </ErrorBoundary>
  );
}
