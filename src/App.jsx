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

import GroupDetailsModal from './components/orders/GroupDetailsModal';
import AddOrderModal from './components/orders/AddOrderModal';
import RecetarioModal from './components/orders/RecetarioModal';
import CoordinationModal from './components/orders/CoordinationModal';
import ReportPreviewModal from './components/orders/ReportPreviewModal';
import OrderDetailsModal from './components/orders/OrderDetailsModal';
import OrderCard from './components/orders/OrderCard';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import LoginScreen from './components/auth/LoginScreen';
import AdvancedExecutiveDashboard from './components/modals/AdvancedExecutiveDashboard';
function MainApp() {
const {
    supabaseData,
    orders, setOrders, coordinationAlerts, setCoordinationAlerts, syncOrderToSupabase, syncAlertToSupabase,
    inventoryReservations,
    showMaterialsAlertModal, setShowMaterialsAlertModal,
    activeAlertMaterials, setActiveAlertMaterials,
    supervisorProfile, setSupervisorProfile,
    selectedGroupPedido, setSelectedGroupPedido,
    selectedOrder, setSelectedOrder,
    searchTerm, setSearchTerm,
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
    tempTransferArea, setTempTransferArea,
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
    itemSearchTerm, setItemSearchTerm,
    duplicateError, setDuplicateError,
    repDate, setRepDate,
    repSupervisor, setRepSupervisor,
    generatedReportData, setGeneratedReportData
  } = useAppContext();

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
      setOpenSection(null);
      setShowHistoryPlanta(false); 
      setShowHistoryCalidad(false); 
      setShowHistoryEntrega(false);
      setTempTransferArea(selectedOrder.areaActual || "");
      setTempTransferDate(selectedOrder.fechaEntregaPrometida || "");
      setTempShiftActivity(CONFIG_PROCESOS[selectedOrder.areaActual]?.[0] || "");
      setTempOperario(""); setShiftNoteText(""); setTempPhoto(null);
      setCalidadState("APROBADO"); setCalidadInspector(""); setCalidadNota(""); setCalidadPhoto(null);
      setTransferNota(""); setTransferPhoto(null);
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

  const updateTransfer = (id, area, date, en, re) => {
    const order = orders.find(o => o?.id === id);
    if (!order) return;
    const newHistoryEntry = { fecha: new Date().toISOString(), supervisor: supervisorProfile?.name || "S/N", accion: `Entrega a ${area}`, entrega: en, recibe: re, nota: transferNota, foto: transferPhoto };
    const updatedOrder = { ...order, areaActual: area, estadoInterno: CONFIG_PROCESOS[area]?.[0] || "En Espera", fechaEntregaPrometida: date, historial: [...(order.historial || []), newHistoryEntry] };
    let newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);
    
    if (updatedOrder.estadoInterno === 'DESPACHADO' || area === 'Despachos') {
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

    setOrders(newOrdersList); setSelectedOrder(null); syncOrderToSupabase(updatedOrder);
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

  const filteredOrders = orders.filter(o => {
    if (!o) return false;
    
    const st = searchTerm.toLowerCase().trim();
    const searchTerms = st ? st.split(/\s+/) : [];
    
    const matchSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (String(o.pedidoNum || "")).toLowerCase().includes(term) || 
        (String(o.nombre || "")).toLowerCase().includes(term) || 
        (String(o.codArticulo || "")).toLowerCase().includes(term) ||
        (String(o.cliente || "")).toLowerCase().includes(term)
    );

    const matchArea = areaFilter === 'Todas' || o.areaActual === areaFilter;
    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(o.fechaEntregaPrometida) === null || getDaysLeft(o.fechaEntregaPrometida) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && o.estadoInterno === 'DESPACHADO';
    return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO';
  });

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    if (!order) return acc;
    const pNum = order.pedidoNum || "S/N";
    if (!acc[pNum]) acc[pNum] = { pedidoNum: pNum, cliente: order.cliente, fechaEntregaPrometida: order.fechaEntregaPrometida, products: [] };
    acc[pNum].products.push(order);
    return acc;
  }, {});
  const groupedArray = Object.values(groupedOrders);
  const activeGroupObj = groupedArray.find(g => g?.pedidoNum === selectedGroupPedido) || null;



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
        <div className="theme-bg-input border-t theme-border p-2 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-lg theme-bg-card font-bold text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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

      <main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen">
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5`}>
          {groupedArray.map(group => <OrderCard key={group.pedidoNum} group={group} />)}
          {groupedArray.length === 0 && (
            <div className="col-span-full text-center py-20 theme-text-muted">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
            </div>
          )}
        </div>
      </main>

      <GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} />

      <RecetarioModal />

      <AddOrderModal createOrder={createOrder} doExcelSearch={doExcelSearch} />

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

      {showCoordViewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-4xl md:h-auto md:max-h-[85vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 bg-[var(--accent)] text-[var(--card-bg)] flex justify-between items-center shrink-0 shadow-sm z-10"><div className="flex items-center gap-3"><LayoutList size={20}/><h2 className="text-lg font-black uppercase">Plan Maestro de Despacho</h2></div><button type="button" onClick={() => setShowCoordViewModal(false)} className="p-2 bg-black/5 rounded-xl hover:bg-black/10 transition-all">✕</button></div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coordinationAlerts.map(alertItem => (
                  <div key={alertItem.id} className="theme-bg-main p-5 rounded-[1.5rem] border-[3px] border-red-500/30 relative flex flex-col">
                     {supervisorProfile?.area === "Administrador / Todos" && (
                         <button type="button" onClick={() => deleteAlert(alertItem.id)} className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={"1.2em"}/></button>
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
                {coordinationAlerts.length === 0 && <p className="col-span-full text-center p-10 font-black uppercase text-[var(--primary)]/50">No hay alertas logísticas activas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header flex justify-between items-center border-b theme-border"><h2 className="font-black uppercase text-base text-[var(--primary)]">Reporte de Turno</h2><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--primary)]">✕</button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest">Supervisor</label><select value={repSupervisor} onChange={e=>setRepSupervisor(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)]"><option value="">Seleccione...</option><option value="TODOS">TODOS LOS SUPERVISORES</option>{SUPERVISORES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest">Fecha Operativa</label><input type="date" value={repDate} onChange={e=>setRepDate(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)]" /></div>
              <button type="button" onClick={generateShiftReport} className="w-full bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-4 rounded-xl border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95 mt-2">Generar Vista Previa</button>
            </div>
          </div>
        </div>
      )}

      

      {showMaterialsAlertModal && (
        (() => {
          const isModalAlert = activeAlertMaterials.some(m => m.faltante > 0);
          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
              <div className={`w-full max-w-lg theme-bg-card rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${isModalAlert ? 'border-orange-500/30' : 'border-green-500/30'}`}>
                <div className={`p-5 border-b flex justify-between items-center shrink-0 ${isModalAlert ? 'bg-orange-500/10 border-orange-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                  <h2 className={`text-lg font-black uppercase flex items-center gap-2 ${isModalAlert ? 'text-orange-600' : 'text-[var(--accent)]'}`}>
                    {isModalAlert ? <AlertTriangle size={20} /> : <CheckCircle size={20} />} 
                    {isModalAlert ? 'Alerta de Insumos' : 'Inventario Suficiente'}
                  </h2>
                  <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={`p-2.5 rounded-xl transition-colors shrink-0 ${isModalAlert ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600' : 'bg-green-500/10 hover:bg-green-500/20 text-[var(--accent)]'}`}>✕</button>
                </div>
                <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <p className="text-xs md:text-sm lg:text-base font-bold text-slate-500 uppercase mb-4">
                      {isModalAlert ? 'Los siguientes materiales no cuentan con stock suficiente para este pedido.' : 'Este pedido cuenta con cobertura total de inventario para su ejecución.'}
                    </p>
                    <div className="space-y-3">
                        {activeAlertMaterials.map((mat, i) => {
                            const isDeficit = mat.faltante > 0;
                            return (
                            <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${isDeficit ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs md:text-sm lg:text-base font-black uppercase px-2 py-1 bg-white border rounded-md ${isDeficit ? 'border-orange-200 text-orange-700' : 'border-green-200 text-green-700'}`}>Ref: {mat.id_referencia}</span>
                                    {mat.sinOC && isDeficit && <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-red-600 flex items-center gap-1"><AlertCircle size={"1.2em"}/> Sin Orden Compra</span>}
                                </div>
                                <p className="font-bold text-xs md:text-sm lg:text-base uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                                <div className={`flex gap-4 mt-1 border-t pt-2 flex-wrap ${isDeficit ? 'border-orange-200' : 'border-green-200'}`}>
                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Solicitada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.requerida}</span></div>
                                    <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Asignada</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-700">{mat.asignada}</span></div>
                                    {isDeficit && <div className="flex flex-col"><span className="text-[10px] md:text-xs font-black text-orange-600 uppercase">Faltante x Comprar</span><span className="text-xs md:text-sm lg:text-base font-black text-red-600">{mat.faltante}</span></div>}
                                    <div className="flex flex-col ml-auto"><span className="text-[10px] md:text-xs font-black text-slate-400 uppercase">Stock Remanente</span><span className="text-xs md:text-sm lg:text-base font-black text-slate-500">{mat.stockRestanteGlobal}</span></div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>
                <div className="p-4 bg-black/5 border-t theme-border flex justify-end">
                    <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className={`text-white font-black uppercase text-xs md:text-sm lg:text-base px-6 py-3 rounded-xl transition-all duration-200 hover:brightness-125 active:scale-95 ${isModalAlert ? 'bg-orange-500 border border-orange-700' : 'bg-[var(--accent)] border border-green-700'}`}>Entendido</button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700;800&family=Space+Grotesk:wght@600;700;800&display=swap');
        
        :root, [data-theme="light"], [data-theme="dark"] {
            /* Forced Dark Mode - Digital Banking Pro Max */
            --bg-main: #0B0F19; 
            --card-bg: #1E293B; 
            --bg-header: rgba(11, 15, 25, 0.85); 
            --bg-input: #0F172A; 
            --text-main: #FFFFFF; 
            --text-muted: #94A3B8; 
            --border-color: rgba(148, 163, 184, 0.15); 
            
            /* Vibrant Accents */
            --primary: #3B82F6; /* Electric Blue */
            --accent: #10B981; /* Neon Green */
            --danger: #EF4444; 
        }

        .theme-bg-main { background-color: var(--bg-main); color: var(--text-main); }
        .theme-bg-card { 
           background-color: var(--card-bg); 
           color: var(--text-main);
           border: 1px solid var(--border-color);
           box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
           border-radius: 16px; /* rounded-2xl */
        }
        .theme-bg-header { 
           background-color: var(--bg-header); 
           color: var(--text-main); 
           backdrop-filter: blur(12px); 
           -webkit-backdrop-filter: blur(12px);
           border-bottom: 1px solid var(--border-color);
        }
        .theme-bg-input { 
           background-color: var(--bg-input); 
           color: var(--text-main); 
           border: 1px solid var(--border-color);
           transition: all 0.2s ease;
        }
        .theme-bg-input:focus-within {
           border-color: var(--primary);
           box-shadow: 0 0 0 1px var(--primary);
        }
        .theme-border { border-color: var(--border-color); }
        .theme-text-muted { color: var(--text-muted); }

        /* Typography - Strict hierarchy */
        body, input, button, select, textarea { font-family: 'Outfit', sans-serif !important; }
        h1, h2, h3, h4, .font-oswald { font-family: 'Space Grotesk', sans-serif !important; font-weight: 700; letter-spacing: -0.02em; color: #FFFFFF; }
        
        body { background-color: var(--bg-main); color: var(--text-main); }
        
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: inline-block; animation: marquee 20s linear infinite; }
        
        @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 50% { box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.4); } }
        .animate-pulse-red { animation: pulse-red 2s infinite; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
        
        @media print {
            body * { visibility: hidden; }
            .fixed.inset-0.bg-white.z-\[130\] { position: absolute; left: 0; top: 0; right: 0; visibility: visible; height: auto !important; overflow: visible !important; }
            .fixed.inset-0.bg-white.z-\[130\] * { visibility: visible; }
            .print\:hidden { display: none !important; }
            .print\:border-0 { border: none !important; }
            .print\:p-0 { padding: 0 !important; }
            .print\:bg-slate-200 { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
            .print\:text-black { color: #000 !important; }
        }
`}</style>
    </div>
  );
}

export default function App() {
  return (
    <AppContextProvider>
      <MainApp />
    </AppContextProvider>
  );
}
