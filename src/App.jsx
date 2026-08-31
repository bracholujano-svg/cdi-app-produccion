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
import PlantPlannerModal from './components/modals/PlantPlannerModal';

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
    showPlantPlannerModal, setShowPlantPlannerModal,
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
    
    recognitionRef,
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
  const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
    if (target === 'transfer') setTransferNota(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'planta' || target === 'shift') setShiftNoteText(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'calidad') setCalidadNota(prev => (prev ? prev + ' ' : '') + text.trim());
    else if (target === 'coord') setInputManualDetalle(prev => (prev ? prev + ' ' : '') + text.trim());
  }, [setTransferNota, setShiftNoteText, setCalidadNota, setInputManualDetalle]));
  const { handleImageUpload } = useImageProcessor(setTempPhoto);
  const handleWhatsAppShare = (order) => shareToWhatsApp(order);

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

  const fillFormWithResult = (result, fillFn) => fillFormWithResultWrapper(result, fillFn);

  const doExcelSearch = async (term) => await executeExcelSearch(term);





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

    const updateTransfer = async (id, areas, date, operario, _, isPartial) => {
    try {
        const ids = Array.isArray(id) ? id : [id];
        const { updatedOrders, updatedAlerts, ordersToSync, alertsToSync } = executeTransfer(ids, {
            orders,
            coordinationAlerts,
            supervisorName: operario || supervisorProfile?.name || 'Desconocido',
            areas: Array.isArray(areas) ? areas : [areas],
            date: date || new Date().toISOString(),
            entrega: operario || supervisorProfile?.name || 'Desconocido',
            recibe: '',
            isPartial: isPartial,
            tempAssignedPersonnel,
            transferNota,
            transferPhoto
        });

        if (updatedOrders) setOrders(updatedOrders);
        if (updatedAlerts) setCoordinationAlerts(updatedAlerts);
        
        for (const o of (ordersToSync || [])) await syncOrderToSupabase(o);
        for (const a of (alertsToSync || [])) await syncAlertToSupabase(a);
        
        setTempAssignedPersonnel({});
        setTransferNota('');
        setTransferPhoto(null);
    } catch (err) {
        alert('Error en transferencia: ' + err.message);
    }
  };

  const handleBulkTransfer = async (ids, areas, date, operario, _, isPartial) => {
    await updateTransfer(ids, areas, date, operario, _, isPartial);
    setShowBulkModal(false);
  };

  const processReception = async (pedidoNum, isTotal = true, receptionName, receptionNotes, tempPhoto) => {
    try {
        const ids = Array.isArray(pedidoNum) ? pedidoNum : [pedidoNum];
        const { updatedOrders, updatedAlerts, ordersToSync, alertsToSync } = executeReception(ids, {
            orders,
            coordinationAlerts,
            supervisorName: supervisorProfile?.name || 'Desconocido',
            accepted: isTotal,
            receptionName: receptionName || supervisorProfile?.name || 'Desconocido',
            notes: receptionNotes || '',
            photo: tempPhoto || null
        });

        if (updatedOrders) setOrders(updatedOrders);
        if (updatedAlerts) setCoordinationAlerts(updatedAlerts);
        
        for (const o of (ordersToSync || [])) await syncOrderToSupabase(o);
        for (const a of (alertsToSync || [])) await syncAlertToSupabase(a);
    } catch (err) {
        alert('Error en recepción: ' + err.message);
    }
  };

  const processBulkReception = async (pedidos, isTotal = true, receptionName, receptionNotes, tempPhoto) => {
    await processReception(pedidos, isTotal, receptionName, receptionNotes, tempPhoto);
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
  // Avoid calling setState synchronously
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

      <GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} isListening={isListening} activeDictationTarget={activeDictationTarget} />

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
        isListening={isListening}
        activeDictationTarget={activeDictationTarget}
      />
      
      {showBulkModal && (
        <BulkOrderDetailsModal
          handleImageUpload={handleImageUpload}
          addShiftNote={(isTerminadoFlag) => handleBulkShiftNote(selectedBulkOrders.map(o => o.id), isTerminadoFlag)}
          addQualityNote={() => handleBulkQualityNote(selectedBulkOrders.map(o => o.id))}
          updateTransfer={handleBulkTransfer}
          toggleMic={toggleMic}
          isListening={isListening}
          activeDictationTarget={activeDictationTarget}
        />
      )}

      {showPlantPlannerModal && <PlantPlannerModal orders={orders} setShowPlantPlannerModal={setShowPlantPlannerModal} />}

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