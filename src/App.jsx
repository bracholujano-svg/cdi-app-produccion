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
import OrderCard from './components/orders/OrderCard';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import LoginScreen from './components/auth/LoginScreen';
import AdvancedExecutiveDashboard from './components/modals/AdvancedExecutiveDashboard';
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
    repDate, setRepDate,
    repSupervisor, setRepSupervisor,
    generatedReportData, setGeneratedReportData
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
        setTempTransferAreas(selectedOrder.areaActual ? [selectedOrder.areaActual] : []);
        setTempTransferDate(selectedOrder.fechaEntregaPrometida || "");
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

  const addShiftNote = () => {
    if (!selectedOrder) return;
    const newNote = { 
      id: Date.now(), supervisor: supervisorProfile?.name || "S/N", operario: tempOperario || "S/N", 
      actividad: tempShiftActivity, nota: shiftNoteText || "Sin novedades", foto: tempPhoto, fecha: new Date().toISOString() 
    };
    const updatedOrder = { ...selectedOrder, estadoInterno: tempShiftActivity, bitacoraTurnos: [...(selectedOrder.bitacoraTurnos || []), newNote] };
    const newOrdersList = orders.map(o => o?.id === selectedOrder.id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setShiftNoteText(""); setTempPhoto(null);
  };

  const addQualityNote = () => {
    if (!selectedOrder) return;
    const newNote = {
      id: Date.now(), supervisor: supervisorProfile?.name || "S/N", inspector: calidadInspector || "S/N",
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
                  historial: [...(order.historial || []), newHistoryEntry] 
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
                  historial: [...(order.historial || []), newHistoryEntry] 
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
                  historial: [...(order.historial || []), {
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
                  historial: [...(order.historial || []), {
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
              historial: [...(order.historial || []), newHistoryEntry]
          }
          : {
              ...order,
              areaActual: isPartial ? order.areaActual : targetArea,
              areas_compartidas: isPartial 
                 ? [...new Set([...(order.areas_compartidas || []), targetArea])] 
                 : [],
              estadoInterno: isPartial ? order.estadoInterno : (CONFIG_PROCESOS[targetArea]?.[0] || "En Espera"),
              transferenciaPendiente: null,
              historial: [...(order.historial || []), newHistoryEntry]
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
    if (!repSupervisor || !repDate) return;
    let entries = [];
    
    // Función para normalizar nombres y permitir búsquedas parciales (ignora mayúsculas y tildes)
    const normalizeName = (name) => name ? name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    
    const checkMatch = (savedName) => {
        if (repSupervisor === "TODOS") return true;
        const selParts = normalizeName(repSupervisor).split(" ").filter(p => p.trim() !== "");
        const savNorm = normalizeName(savedName);
        // Retorna verdadero si TODAS las palabras seleccionadas (ej. "Deyvis", "Bracho") están dentro del nombre completo guardado
        return selParts.every(part => savNorm.includes(part));
    };

    orders.forEach(order => {
      // Producción
      const tech = (order?.bitacoraTurnos || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && checkMatch(n?.supervisor));
      tech.forEach(n => entries.push({ ...n, type: 'PRODUCCIÓN', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.actividad}: ${n.nota}`, person: `OP: ${n.operario}`, status: 'AVANCE' }));
      
      // Calidad
      const cal = (order?.bitacoraCalidad || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && checkMatch(n?.supervisor));
      cal.forEach(n => entries.push({ ...n, type: 'CALIDAD', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `Obs: ${n.observacion}`, person: `INSP: ${n.inspector}`, status: n.estado }));
      
      // Entregas (Trazabilidad)
      const mov = (order?.historial || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && n?.accion?.includes('Entrega a') && checkMatch(n?.supervisor));
      mov.forEach(n => entries.push({ ...n, type: 'TRASLADO', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.accion} | Obs: ${n.nota || 'N/A'}`, person: `DE: ${n.entrega} A: ${n.recibe}`, status: 'ENTREGADO' }));
    });
    
    if(entries.length === 0) {
        alert("⚠️ No hay registros de actividades para este supervisor en la fecha seleccionada.");
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

    const matchArea = areaFilter === 'Todas' || o.areaActual === areaFilter || (Array.isArray(o.areas_compartidas) && o.areas_compartidas.includes(areaFilter));
    const filterUpper = clientFilter.toUpperCase();
    const matchClient = clientFilter === 'Todos' || String(o.cliente || "").toUpperCase().includes(filterUpper);

    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(o.fechaEntregaPrometida) === null || getDaysLeft(o.fechaEntregaPrometida) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && matchClient && o.estadoInterno === 'DESPACHADO';
    return matchSearch && matchArea && matchClient && o.estadoInterno !== 'DESPACHADO';
  });

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    if (!order) return acc;
    const pNum = order.pedidoNum || "S/N";
    
    // Si la alerta tiene una fecha de entrega, usarla como prioridad
    const alertMatch = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pNum.toUpperCase());
    const displayDate = alertMatch?.fechaEntrega || order.fechaEntregaPrometida;

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
      
      <Header />
      <Sidebar />
        <div className="theme-bg-input border-t theme-border p-2 flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-lg theme-bg-card font-bold text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex gap-2 flex-1 md:flex-none">
                <div className="flex-1 lg:w-48">
                    <input 
                        list="client-options" 
                        type="text"
                        placeholder="BUSCAR CLIENTE..."
                        className="w-full theme-bg-card px-2 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm lg:text-sm uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)] text-ellipsis overflow-hidden placeholder:normal-case placeholder:text-[10px] md:placeholder:text-xs" 
                        value={clientFilter === 'Todos' ? '' : clientFilter} 
                        onChange={(e) => setClientFilter(e.target.value.toUpperCase() || 'Todos')}
                        onFocus={(e) => e.target.select()}
                    />
                    <datalist id="client-options">
                        {uniqueClients.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>
                <select className="flex-1 lg:w-48 theme-bg-card px-2 py-2 md:py-2.5 rounded-lg font-black text-[10px] md:text-xs lg:text-sm uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)] cursor-pointer text-ellipsis overflow-hidden" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="ninguno">Orden Original</option>
                    <option value="pedido_asc">Pedido (Asc)</option>
                    <option value="pedido_desc">Pedido (Desc)</option>
                    <option value="fecha_asc">F. Entrega (Asc)</option>
                    <option value="fecha_desc">F. Entrega (Desc)</option>
                </select>
            </div>
            
            <div className="flex gap-2 justify-between">
                <select className="flex-1 md:w-48 theme-bg-card px-3 py-2 md:py-2.5 rounded-lg font-black text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm uppercase outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)] cursor-pointer" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                    <option value="Todas">Todas las Áreas</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <div className="flex theme-bg-card border theme-border rounded-lg p-0.5 gap-0.5 shrink-0">
                    <button type="button" onClick={()=>setGridColumns(1)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===1 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Lista">
                        <LayoutList size={"1.2em"} />
                    </button>
                    <button type="button" onClick={()=>setGridColumns(2)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===2 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Media">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(3)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>

                    <button type="button" onClick={()=>setGridColumns(3)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Grande">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(4)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===4 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Mediana">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(5)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===5 ? 'bg-[var(--primary)] text-[var(--card-bg)]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="4" height="18"></rect><rect x="8" y="3" width="4" height="18"></rect><rect x="14" y="3" width="4" height="18"></rect><rect x="20" y="3" width="4" height="18"></rect></svg>
                    </button>
                </div>
            </div>
        </div>

      <main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen flex flex-col">
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5 flex-1 content-start`}>
          {paginatedGroups.map(group => <OrderCard key={group.pedidoNum} group={group} />)}
          {groupedArray.length === 0 && (
            <div className="col-span-full text-center py-20 theme-text-muted">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 pb-10">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-6 py-3 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border theme-bg-card text-[var(--primary)] disabled:opacity-50 hover:bg-[var(--primary)] hover:text-[var(--card-bg)] transition-colors"
            >
              Anterior
            </button>
            <span className="font-bold text-xs md:text-sm lg:text-base text-[var(--primary)] px-2">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-6 py-3 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border theme-bg-card text-[var(--primary)] disabled:opacity-50 hover:bg-[var(--primary)] hover:text-[var(--card-bg)] transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}
      </main>

      <GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} />

      <RecetarioModal />
      <ReceptionModal processReception={processReception} />

      <AddOrderModal createOrder={createOrder} createBulkOrders={createBulkOrders} doExcelSearch={doExcelSearch} />

      <OrderDetailsModal 
        handleImageUpload={handleImageUpload}
        addShiftNote={addShiftNote}
        addQualityNote={addQualityNote}
        updateTransfer={updateTransfer}
        shareToWhatsApp={shareToWhatsApp}
        toggleMic={toggleMic}
      />

      {showDashboardModal && (
        <AdvancedExecutiveDashboard 
            orders={orders} 
            coordinationAlerts={coordinationAlerts} 
            onClose={() => setShowDashboardModal(false)} 
        />
      )}

      <CoordinationModal addItemToCoordList={addItemToCoordList} saveBatchCoordination={saveBatchCoordination} />

      <ReportPreviewModal />

      {showCoordViewModal && (() => {
        let filteredSortedAlerts = [...coordinationAlerts];
        if (coordSearchPedido) {
          filteredSortedAlerts = filteredSortedAlerts.filter(a => a.pedidoNum.toLowerCase().includes(coordSearchPedido.toLowerCase()));
        }
        if (coordSearchFecha) {
          filteredSortedAlerts = filteredSortedAlerts.filter(a => a.fechaEntrega === coordSearchFecha);
        }
        filteredSortedAlerts.sort((a, b) => {
          const dateA = new Date(a.fechaEntrega).getTime();
          const dateB = new Date(b.fechaEntrega).getTime();
          return coordSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        return (
          <div className="fixed inset-0 bg-black/80  z-[110] flex items-center justify-center p-0 md:p-4">
            <div className="theme-bg-card w-full h-full md:max-w-5xl md:h-auto md:max-h-[85vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
              <div className="p-5 bg-[var(--accent)] text-[var(--card-bg)] flex justify-between items-center shrink-0 shadow-sm z-10"><div className="flex items-center gap-3"><LayoutList size={20}/><h2 className="text-lg font-black uppercase">Plan Maestro de Despacho</h2></div><button type="button" onClick={() => setShowCoordViewModal(false)} className="p-2 bg-black/5 rounded-xl hover:bg-black/10 transition-colors">✕</button></div>
              
              <div className="p-4 bg-[var(--card-bg)] border-b theme-border flex flex-col md:flex-row gap-4 shrink-0">
                <input 
                  type="text" 
                  placeholder="🔎 Buscar Nº Pedido..." 
                  value={coordSearchPedido} 
                  onChange={(e) => setCoordSearchPedido(e.target.value)} 
                  className="flex-1 p-3 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] uppercase"
                />
                <div className="flex gap-4 flex-1">
                  <input 
                    type="date" 
                    value={coordSearchFecha} 
                    onChange={(e) => setCoordSearchFecha(e.target.value)} 
                    className="flex-1 p-3 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]"
                  />
                  <button 
                    type="button" 
                    onClick={() => setCoordSearchFecha('')} 
                    className="px-4 rounded-xl border border-[var(--border-color)] font-bold text-xs md:text-sm lg:text-base uppercase theme-text-muted hover:text-[var(--primary)] hover:bg-black/5 transition-colors"
                    title="Limpiar Fecha"
                  >
                    Limpiar
                  </button>
                </div>
                <button 
                  type="button" 
                  onClick={() => setCoordSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                  className="px-5 py-3 rounded-xl border border-[var(--border-color)] font-bold text-xs md:text-sm lg:text-base uppercase flex items-center justify-center gap-2 theme-text-muted hover:text-[var(--primary)] hover:bg-black/5 transition-colors"
                >
                  {coordSortOrder === 'asc' ? '⬇️ ASCENDENTE' : '⬆️ DESCENDENTE'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSortedAlerts.map(alertItem => (
                    <div key={alertItem.id} className="theme-bg-main p-5 rounded-[1.5rem] border-[3px] border-red-500/30 relative flex flex-col">
                      {supervisorProfile?.area === "Administrador / Todos" && (
                          <button type="button" onClick={() => deleteAlert(alertItem.id)} className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors"><Trash2 size={"1.2em"}/></button>
                      )}
                      <span className="text-lg font-black text-red-500 uppercase block leading-none pr-8">Ped: {alertItem.pedidoNum}</span>
                      <h4 className="text-sm font-black text-[var(--primary)] uppercase mt-1 truncate">{alertItem.cliente}</h4>
                      
                      {supervisorProfile?.area === "Administrador / Todos" ? (
                          <div className="mt-4 p-3 bg-[var(--card-bg)] rounded-xl border border-yellow-500/30 flex-1 flex flex-col justify-end">
                              <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-black text-yellow-500 uppercase block tracking-widest mb-1">Modificar Compromiso</span>
                              <input 
                                  type="date" 
                                  value={alertItem.fechaEntrega} 
                                  onChange={(e) => updateAlertDate(alertItem.id, e.target.value)}
                                  className="w-full p-2 bg-black/20 rounded-lg font-bold text-xs md:text-sm lg:text-base border border-yellow-500/50 outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--accent)]" 
                              />
                          </div>
                      ) : (
                          <div className="mt-4 p-3 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] flex-1 flex flex-col justify-end">
                              <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase block tracking-widest">Compromiso</span>
                              <p className="text-base font-black flex items-center gap-2 mt-0.5 text-[var(--accent)]"><Calendar size={"1.2em"} /> {formatLocalDate(alertItem.fechaEntrega)}</p>
                          </div>
                      )}
                    </div>
                  ))}
                  {filteredSortedAlerts.length === 0 && <p className="col-span-full text-center p-10 font-black uppercase text-[var(--primary)]/50">No hay resultados</p>}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {showReportConfigModal && (
        <div className="fixed inset-0 bg-black/80  z-[120] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header flex justify-between items-center border-b theme-border"><h2 className="font-black uppercase text-base text-[var(--primary)]">Reporte de Turno</h2><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--primary)]">✕</button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest">Supervisor</label><select value={repSupervisor} onChange={e=>setRepSupervisor(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)]"><option value="">Seleccione...</option><option value="TODOS">TODOS LOS SUPERVISORES</option>{SUPERVISORES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest">Fecha Operativa</label><input type="date" value={repDate} onChange={e=>setRepDate(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)]" /></div>
              <button type="button" onClick={generateShiftReport} className="w-full bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-4 rounded-xl border border-[var(--border-color)] transition-colors duration-200   hover:brightness-125 active:scale-95 mt-2">Generar Vista Previa</button>
            </div>
          </div>
        </div>
      )}

      

      {showMaterialsAlertModal && (
        (() => {
          const isNoMaterials = activeAlertMaterials.length === 0;
          const isModalAlert = activeAlertMaterials.some(m => m.faltante > 0);
          
          const filtered = activeAlertMaterials.filter(m => 
              !materialsSearchTerm || 
              m.descripcion?.toLowerCase().includes(materialsSearchTerm.toLowerCase()) || 
              m.id_referencia?.toLowerCase().includes(materialsSearchTerm.toLowerCase())
          );
          
          const faltantes = filtered.filter(m => m.faltante > 0);
          const disponibles = filtered.filter(m => m.faltante <= 0);

          return (
            <div className="fixed inset-0 bg-black/80  z-[150] flex items-center justify-center p-4">
              <div className={`w-full max-w-7xl theme-bg-card rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${isNoMaterials ? 'border-yellow-500/30' : isModalAlert ? 'border-orange-500/30' : 'border-green-500/30'}`}>
                <div className={`p-5 border-b flex justify-between items-center shrink-0 ${isNoMaterials ? 'bg-yellow-500/10 border-yellow-500/20' : isModalAlert ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                  <h2 className={`text-lg font-black uppercase flex items-center gap-2 ${isNoMaterials ? 'text-yellow-600' : isModalAlert ? 'text-orange-600' : 'text-[var(--accent)]'}`}>
                    {isNoMaterials ? <AlertTriangle size={20} /> : isModalAlert ? <AlertTriangle size={20} /> : <CheckCircle size={20} />} 
                    {isNoMaterials ? 'Pedidos Sin Insumos Requeridos' : isModalAlert ? 'Alerta de Insumos' : 'Inventario Suficiente'}
                  </h2>
                  <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isNoMaterials ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600' : isModalAlert ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' : 'bg-green-500/10 hover:bg-green-500/20 text-[var(--accent)]'}`}>✕</button>
                </div>
                
                <div className="p-4 border-b theme-border theme-bg-main">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]/50" size={20} />
                        <input 
                            type="text" 
                            placeholder="BUSCAR INSUMO O CÓDIGO..." 
                            value={materialsSearchTerm || ''} 
                            onChange={(e) => setMaterialsSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl theme-bg-input border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] font-bold uppercase text-xs md:text-sm lg:text-base text-[var(--primary)]"
                        />
                    </div>
                </div>

                <div className="px-4 md:px-5 pt-2 pb-2 theme-bg-card z-20 border-b theme-border shadow-sm flex flex-col">
                    <p className="text-xs md:text-sm lg:text-base font-bold text-slate-500 uppercase mb-4">
                      {isNoMaterials ? 'No se encontraron insumos registrados en base de datos para este pedido.' : isModalAlert ? 'Los siguientes materiales no cuentan con stock suficiente para este pedido.' : 'Este pedido cuenta con cobertura total de inventario para su ejecución.'}
                    </p>

                    {!isNoMaterials && (
                        <div className="grid grid-cols-2 gap-2 md:gap-6 pr-2 md:pr-4">
                            <h3 className="text-[14px] md:text-lg font-black text-orange-500 uppercase border-b-2 border-orange-500/30 pb-1">Materiales Faltantes</h3>
                            <h3 className="text-[14px] md:text-lg font-black text-green-500 uppercase border-b-2 border-green-500/30 pb-1">Materiales Disponibles</h3>
                        </div>
                    )}
                </div>

                <div className="px-4 md:px-5 py-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    
                    {isNoMaterials ? (
                        <div className="p-10 rounded-xl border border-dashed border-yellow-200 bg-yellow-50 text-center">
                           <AlertTriangle size={48} className="mx-auto mb-4 text-yellow-400 opacity-50" />
                           <span className="text-sm md:text-base font-black text-yellow-600 uppercase">Sin información de insumos</span>
                           <p className="text-xs md:text-sm font-bold text-yellow-500/80 mt-2">El sistema no detectó ningún requerimiento de material en Supabase asociado a este pedido y/o artículo.</p>
                        </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 md:gap-6">
                              <div className="space-y-3">
                                  {faltantes.length > 0 ? (
                                      faltantes.map((mat, i) => (
                                          <div key={'f'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-orange-200 bg-orange-50">
                                              <div className="flex justify-between items-start">
                                                  <span className="text-xs md:text-sm lg:text-base font-black uppercase px-2 py-1 bg-white border rounded-md border-orange-200 text-orange-700">Ref: {mat.id_referencia}</span>
                                                  {mat.sinOC && <span className="text-xs font-black uppercase text-red-600 flex items-center gap-1"><AlertCircle size={"1.2em"}/> Sin Orden Compra</span>}
                                              </div>
                                              <p className="font-bold text-xs md:text-sm lg:text-base uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-2 border-t pt-3 border-orange-200">
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Solicitada</span><span className="text-xs md:text-sm font-black text-slate-700">{Number(mat.requerida).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Asignada</span><span className="text-xs md:text-sm font-black text-slate-700">{Number(mat.asignada).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-orange-600 uppercase">Faltante</span><span className="text-xs md:text-sm font-black text-red-600">{Number.isFinite(mat.faltante) ? Number(mat.faltante).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1') : mat.faltante}</span></div>
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Stock Reman.</span><span className="text-xs md:text-sm font-black text-slate-500">{Number(mat.stockRestanteGlobal).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="p-4 rounded-xl border border-dashed border-orange-200 bg-orange-50/50 text-center">
                                          <span className="text-xs md:text-sm font-bold text-orange-400 uppercase">Ningún material faltante.</span>
                                      </div>
                                  )}
                              </div>

                              <div className="space-y-3">
                                  {disponibles.length > 0 ? (
                                      disponibles.map((mat, i) => (
                                          <div key={'d'+i} className="p-4 rounded-xl border flex flex-col gap-2 border-green-200 bg-green-50">
                                              <div className="flex justify-between items-start">
                                                  <span className="text-xs md:text-sm lg:text-base font-black uppercase px-2 py-1 bg-white border rounded-md border-green-200 text-green-700">Ref: {mat.id_referencia}</span>
                                              </div>
                                              <p className="font-bold text-xs md:text-sm lg:text-base uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mt-2 border-t pt-3 border-green-200">
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Solicitada</span><span className="text-xs md:text-sm font-black text-slate-700">{Number(mat.requerida).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Asignada</span><span className="text-xs md:text-sm font-black text-slate-700">{Number(mat.asignada).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                                  <div className="flex flex-col"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase">Stock Reman.</span><span className="text-xs md:text-sm font-black text-slate-500">{Number(mat.stockRestanteGlobal).toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1')}</span></div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="p-4 rounded-xl border border-dashed border-green-200 bg-green-50/50 text-center">
                                          <span className="text-xs md:text-sm font-bold text-green-400 uppercase">Ningún material disponible.</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                    )}
                </div>
                <div className="p-4 bg-black/5 border-t theme-border flex justify-end">
                    <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={`text-white font-black uppercase text-xs md:text-sm lg:text-base px-6 py-3 rounded-xl transition-colors duration-200 hover:brightness-125 active:scale-95 ${isNoMaterials ? 'bg-yellow-500 border border-yellow-700' : isModalAlert ? 'bg-orange-500 border border-orange-700' : 'bg-[var(--accent)] border border-green-700'}`}>Entendido</button>
                </div>
              </div>
            </div>
          );
        })()
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
