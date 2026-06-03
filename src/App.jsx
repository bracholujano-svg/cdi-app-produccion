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
          {groupedArray.map(group => {
             const daysLeft = getDaysLeft(group?.fechaEntregaPrometida);
             const isAtrasado = daysLeft !== null && daysLeft < 0 && viewFilter !== 'DESPACHADOS';
             const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && viewFilter !== 'DESPACHADOS';
             const isCumplido = (daysLeft !== null && daysLeft > 3) || viewFilter === 'DESPACHADOS';

             // LOGICA DE ALERTAS SUPABASE (DYNAMIC RESERVATION)
             const todosRequerimientos = inventoryReservations[group.pedidoNum] || [];
             const faltantes = todosRequerimientos.filter(f => f.faltante > 0);
             
             const hasAlert = faltantes.length > 0 && viewFilter !== 'DESPACHADOS';
             const isSufficient = todosRequerimientos.length > 0 && faltantes.length === 0 && viewFilter !== 'DESPACHADOS';

             return (
              <div key={group.pedidoNum} onClick={() => { setSelectedGroupPedido(group.pedidoNum); setItemSearchTerm(''); }} className={`rounded-[1.5rem] p-4 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${hasAlert ? 'border-orange-500/80 animate-pulse' : (isSufficient ? 'border-[var(--accent)]/50' : isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50 animate-pulse-red' : 'theme-border')} flex flex-col min-w-0`}>
                
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex flex-col gap-1 w-full">
                    <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base px-1.5 py-1 ${isAtrasado ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isUrgent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'}`}>
                      {isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D` : (viewFilter === 'DESPACHADOS' ? '✅ DESPACHADO' : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES` : 'S/F'))}
                    </div>
                    {hasAlert && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base px-1.5 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20 transition-colors flex items-center justify-between">
                        <span>⚠️ Insumos Insuficientes</span>
                        <ChevronDown size={"1.2em"} />
                      </button>
                    )}
                    {isSufficient && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base px-1.5 py-1 bg-green-500/10 text-[var(--accent)] border border-green-500/30 hover:bg-green-500/20 transition-colors flex items-center justify-between">
                        <span>✅ Material Completo</span>
                        <FolderOpen size={"1.2em"} />
                      </button>
                    )}
                  </div>
                  <FolderOpen size={"1.2em"} className={`${isAtrasado || isUrgent || hasAlert ? 'text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
                </div>
                
                <h3 title={group.pedidoNum} className={`text-sm md:text-base font-black uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-500' : 'text-[var(--primary)]'}`}>
                  PED: {group.pedidoNum}
                </h3>
                <p title={group.cliente} className={`font-black theme-text-muted uppercase mt-0.5 truncate text-xs md:text-sm lg:text-base`}>{group.cliente}</p>
                
                <div className="mt-3 pt-3 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-2">
                  <span className={`px-2 py-1 theme-bg-input rounded-md font-black text-[var(--primary)] text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm`}>{group.products?.length || 0} PROD.</span>
                </div>
              </div>
            );
          })}
          {groupedArray.length === 0 && (
            <div className="col-span-full text-center py-20 theme-text-muted">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
            </div>
          )}
        </div>
      </main>

      {activeGroupObj && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl theme-bg-main h-[85vh] sm:h-[80vh] rounded-[2rem] flex flex-col border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                 <h2 className="text-xl font-black text-[var(--primary)] truncate">ORDEN: {activeGroupObj.pedidoNum}</h2>
                 <p className="text-xs md:text-sm lg:text-base font-bold theme-text-muted uppercase truncate">{activeGroupObj.cliente}</p>
              </div>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">✕</button>
            </div>

            <div className="p-4 border-b theme-border bg-black/5 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={"1.2em"} />
                    <input 
                        type="text" 
                        placeholder="🔍 Filtrar artículo o producto (Ej: 1234)..." 
                        className="w-full pl-9 pr-4 py-3 rounded-xl theme-bg-card font-bold text-xs md:text-sm lg:text-base outline-none border theme-border focus:ring-2 focus:ring-[var(--primary)] text-current"
                        value={itemSearchTerm} 
                        onChange={(e) => setItemSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 custom-scrollbar">
              {(activeGroupObj.products || []).filter(p => {
                  const st = itemSearchTerm.toLowerCase().trim();
                  if (!st) return true;
                  return (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st);
              }).map(p => (
                <div key={p.id} onClick={() => setSelectedOrder(p)} className="theme-bg-card p-4 rounded-2xl border-[2px] theme-border cursor-pointer hover:border-[var(--primary)] shadow-sm transition-all active:scale-95 bg-[var(--card-bg)]">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded border border-[var(--primary)]/30 font-black truncate">CÓD: {p.codArticulo}</span>
                  </div>
                  <h4 className="font-black text-xs md:text-sm lg:text-base uppercase leading-tight text-[var(--primary)]">{p.nombre}</h4>
                  <div className="mt-4 p-2 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)]">
                    <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] uppercase flex items-center gap-1 truncate"><MapPin size={"1.2em"}/> {p.areaActual}</p>
                    <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase flex items-center gap-1 mt-1 truncate"><Clock size={"1.2em"}/> {p.estadoInterno}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRecetarioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4 animate-fade-in">
          <div className={`theme-bg-card overflow-hidden flex flex-col shadow-2xl border theme-border relative transition-all duration-300 ${recetarioMaximized ? 'w-full h-full rounded-none' : 'w-full h-full md:max-w-6xl md:h-[85vh] md:rounded-[2rem]'}`}>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <SCEntonacion supabase={supabase} inventario={supabaseData.inventario} onClose={() => setShowRecetarioModal(false)} supervisorProfile={supervisorProfile} />
            </div>
            <div className="p-4 md:p-6 border-t theme-border flex justify-end gap-3 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button 
                onClick={() => setRecetarioMaximized(!recetarioMaximized)} 
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm"
              >
                {recetarioMaximized ? 'RESTAURAR' : 'MAXIMIZAR'}
              </button>
              <button 
                onClick={() => setShowRecetarioModal(false)} 
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-red-500/20"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-2xl md:h-[75vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
              <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2 text-[var(--primary)]"><Plus size={20} /> Nuevo Registro Planta</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setSearchResults([]); setShowSearchSelector(false); }} className="p-2.5 bg-black/5 hover:bg-black/10 rounded-xl transition-all text-[var(--primary)]">✕</button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-8 custom-scrollbar">
                <div className="bg-[var(--card-bg)] p-5 rounded-[1.5rem] border border-[var(--border-color)] shadow-inner mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-[var(--primary)]/20 rounded-lg"><Search size={"1.2em"} className="text-[var(--primary)]"/></div>
                        <p className="text-xs md:text-sm lg:text-base font-black uppercase text-[var(--primary)] tracking-widest">Puente Ribisoft (Autocompletar)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input value={excelSearchPedido} onChange={e=>setExcelSearchPedido(e.target.value)} placeholder="Nº PEDIDO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase placeholder:text-black/30" />
                        <input value={excelSearchArticulo} onChange={e=>setExcelSearchArticulo(e.target.value)} placeholder="ÚLT. DÍGITOS ARTÍCULO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase placeholder:text-black/30" />
                        <button type="button" onClick={doExcelSearch} disabled={excelSearchLoading} className="bg-[var(--accent)] text-[var(--card-bg)] px-6 py-3.5 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase shadow-sm border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95 disabled:opacity-50 shrink-0">
                            {excelSearchLoading ? '...' : 'BUSCAR'}
                        </button>
                    </div>
                    {excelSearchError && <p className="text-red-400 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase mt-3 flex items-center gap-1"><AlertCircle size={"1.2em"}/>{excelSearchError}</p>}
                    {excelSearchSuccess && <p className="text-green-400 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase mt-3 flex items-center gap-1"><CheckCircle size={"1.2em"}/>{excelSearchSuccess}</p>}

                    {showSearchSelector && searchResults.length > 0 && (
                      <div className="mt-4 p-3 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] max-h-52 overflow-y-auto space-y-2 custom-scrollbar text-left animate-in slide-in-from-top-2">
                        <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] uppercase tracking-wider mb-2">Se encontraron varios pedidos. Toca el correcto:</p>
                        {searchResults.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              fillFormWithResult(res);
                              setShowSearchSelector(false);
                              setExcelSearchSuccess(`✅ Seleccionado: ${res.nombre} (Pedido ${res.pedido})`);
                            }}
                            className="p-2.5 bg-[var(--card-bg)] hover:bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] cursor-pointer transition-colors flex flex-col"
                          >
                            <div className="flex justify-between text-xs md:text-sm lg:text-base font-black uppercase text-[var(--primary)]">
                              <span>PEDIDO: {res.pedido}</span>
                              <span>ART: {res.articulo}</span>
                            </div>
                            <span className="text-xs md:text-sm lg:text-base font-bold text-white uppercase truncate mt-1">{res.nombre}</span>
                            <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-slate-400 uppercase mt-0.5">CLIENTE: {res.cliente}</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {duplicateError && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-xl text-xs md:text-sm lg:text-base font-black uppercase mb-4 flex items-center gap-2"><AlertCircle size={"1.2em"} className="shrink-0"/> {duplicateError}</div>}

                <form id="nuevoRegistroForm" onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Nombre del Producto / Proyecto</label>
                    <input name="nombre" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE AUTOMÁTICO..." /></div>
                    
                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Nº Pedido</label>
                    <input name="pedidoNum" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="EJ: 12345" /></div>

                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Código de Artículo</label>
                    <input name="codArticulo" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="CÓDIGO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Marca / Cliente</label>
                    <input name="cliente" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="CLIENTE AUTOMÁTICO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1 mt-2">
                        <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase ml-1">Área de Recepción Inicial (Producción)</label>
                        <select name="areaRecibe" className="w-full p-4 bg-[var(--primary)] text-[var(--card-bg)] rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border  outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-white">
                            {AREAS_RECEPCION.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Firma Entrega</label>
                    <input name="entregaPersona" required defaultValue={supervisorProfile.name} className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="QUIEN ENTREGA..." /></div>
                    
                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Firma Recibe</label>
                    <input name="recibePersona" required className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="QUIEN RECIBE..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Cantidad a Producir</label>
                    <input name="cantidad" type="number" required className="w-full p-4 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="CANTIDAD..." /></div>
                    
                    <button type="submit" className="md:col-span-2 mt-4 bg-[var(--primary)] text-[var(--card-bg)] py-5 rounded-[1.5rem] font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border-b-[4px]   active:translate-y-[4px]">INICIAR PRODUCCIÓN</button>
                </form>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[420px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                <h2 className="text-base font-black uppercase truncate text-[var(--primary)]">PED: {selectedOrder.pedidoNum}</h2>
                <p className="text-xs md:text-sm lg:text-base font-bold uppercase truncate theme-text-muted mt-0.5">{selectedOrder.nombre}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-all text-[var(--primary)] shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none text-[var(--primary)]">{CONFIG_PROCESOS[selectedOrder.areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addShiftNote} className="col-span-4 bg-[var(--accent)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Guardar Avance</button>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryPlanta(!showHistoryPlanta)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Producción ({selectedOrder.bitacoraTurnos?.length || 0})</span>
                                {showHistoryPlanta ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryPlanta && (selectedOrder.bitacoraTurnos || []).slice().reverse().map((n, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('tech', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase">{n.actividad}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.nota}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-[var(--primary)]">OP: {n.operario}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Calidad */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'calidad' ? null : 'calidad')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><UserCheck size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Inspección Calidad</span>
                    </div>
                    {openSection === 'calidad' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'calidad' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        <div className="flex gap-2">
                            <button type="button" onClick={()=>setCalidadState('APROBADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='APROBADO' ? 'bg-green-500 text-white border-green-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>APROBADO</button>
                            <button type="button" onClick={()=>setCalidadState('RETRABAJO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RETRABAJO' ? 'bg-yellow-500 text-white border-yellow-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>RETRABAJO</button>
                            <button type="button" onClick={()=>setCalidadState('RECHAZADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RECHAZADO' ? 'bg-red-500 text-white border-red-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>RECHAZADO</button>
                        </div>
                        <input value={calidadInspector} onChange={e=>setCalidadInspector(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE INSPECTOR..." />
                        <div className="relative">
                            <textarea value={calidadNota} onChange={e=>setCalidadNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="OBSERVACIONES DE CALIDAD..."></textarea>
                            <button type="button" onClick={()=>toggleMic('calidad')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'calidad' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'calidad' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                        </div>
                        {calidadPhoto && <img src={calidadPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addQualityNote} className="col-span-4 bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Guardar Inspección</button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryCalidad(!showHistoryCalidad)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Calidad ({selectedOrder.bitacoraCalidad?.length || 0})</span>
                                {showHistoryCalidad ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryCalidad && (selectedOrder.bitacoraCalidad || []).slice().reverse().map((n, i) => (
                                <div key={i} className={`theme-bg-input p-3 rounded-xl border relative animate-in slide-in-from-top-2 ${n.estado==='APROBADO' ? 'border-green-500/30' : n.estado==='RETRABAJO' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
                                    <button type="button" onClick={() => shareToWhatsApp('calidad', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className={`text-xs md:text-sm lg:text-base font-black uppercase ${n.estado==='APROBADO' ? 'text-green-500' : n.estado==='RETRABAJO' ? 'text-yellow-500' : 'text-red-500'}`}>{n.estado}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.observacion}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-[var(--primary)]">INSP: {n.inspector}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        <select value={tempTransferArea} onChange={e=>setTempTransferArea(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)]">{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]" />
                        <div className="grid grid-cols-2 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile.name} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="FIRMA ENTREGA" />
                            <input id="recibidoPor" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="FIRMA RECIBE" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <button type="button" onClick={()=>{
                            const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                            const re = document.getElementById('recibidoPor').value.trim().toUpperCase();
                            if(en && re && tempTransferDate) updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, re);
                        }} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryEntrega(!showHistoryEntrega)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Entregas ({selectedOrder.historial?.length || 0})</span>
                                {showHistoryEntrega ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryEntrega && (selectedOrder.historial || []).slice().reverse().map((h, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('trazabilidad', h)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-2 pr-8"><span className="bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase border border-[var(--primary)]/30">{h.accion}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(h.fecha).toLocaleString()}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase bg-black/10 p-2 rounded-lg"><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] text-[var(--primary)] block uppercase">ENTREGA</span>{h.entrega}</div><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] text-[var(--primary)] block uppercase">RECIBE</span>{h.recibe}</div></div>
                                    {h.nota && <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm italic theme-text-muted mt-2">Obs: "{h.nota}"</p>}
                                    {h.foto && <button type="button" onClick={()=>window.open(h.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Acta Firmada</button>}
                                    <div className="flex justify-end items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {h.supervisor || 'S/N'}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDashboardModal && (
        <AdvancedExecutiveDashboard 
            orders={orders} 
            coordinationAlerts={coordinationAlerts} 
            onClose={() => setShowDashboardModal(false)} 
        />
      )}

      {showCoordinationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border flex flex-col max-h-[90vh]">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><Megaphone size={20} className="text-[var(--accent)]" /><h2 className="text-lg font-black uppercase text-[var(--primary)]">Coordinación Logística</h2></div><button type="button" onClick={() => setShowCoordinationModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--primary)]">✕</button></div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div className="theme-bg-main p-5 rounded-2xl border theme-border">
                <h3 className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase tracking-widest mb-4">Agregar Pedido a Alertas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={inputManualPedido} onChange={e=>setInputManualPedido(e.target.value)} placeholder="Nº PEDIDO" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" />
                  <input value={inputManualCliente} onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" />
                  <input type="date" value={inputManualFecha} onChange={e=>setInputManualFecha(e.target.value)} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]" />
                  <div className="md:col-span-2"><input value={inputManualDetalle} onChange={e=>setInputManualDetalle(e.target.value)} placeholder="OBSERVACIÓN (Opcional)" className="w-full p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" /></div>
                  <button type="button" onClick={addItemToCoordList} className="bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base rounded-xl py-3 border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Añadir a Lista</button>
                </div>
              </div>
              {coordList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs md:text-sm lg:text-base font-black text-[var(--accent)] uppercase tracking-widest">Lista Pendiente por Guardar</h3>
                  {coordList.map(item => (
                    <div key={item.id} className="flex justify-between items-center theme-bg-main p-3.5 rounded-xl border theme-border">
                      <div><span className="font-black uppercase text-xs md:text-sm lg:text-base block text-[var(--primary)]">{item.pedidoNum} - {item.cliente}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm theme-text-muted font-bold">Entrega: {item.fechaEntrega}</span></div>
                      <button type="button" onClick={() => setCoordList(coordList.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={"1.2em"}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={saveBatchCoordination} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95 mt-4 disabled:opacity-50">Confirmar y Guardar Alertas</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {showReportPreviewModal && (
        <div className="fixed inset-0 bg-white z-[130] flex flex-col overflow-y-auto text-black">
          <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h2 className="text-lg md:text-xl font-black uppercase text-slate-800">Vista Previa Impresión</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => { try { window.print(); } catch(e) { } }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200 border-blue-800  hover:brightness-125 active:scale-95 flex items-center gap-2"><Printer size={"1.2em"}/> Imprimir</button>
                <button type="button" onClick={() => setShowReportPreviewModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-800 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border border-[var(--border-color)] transition-all duration-200 border-slate-300  hover:brightness-125 active:scale-95">Cerrar</button>
              </div>
            </div>
            <div className="border-2 border-slate-900 p-6 md:p-10 bg-white print:border-0 print:p-0 text-xs md:text-sm lg:text-base w-full overflow-hidden block">
              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
                <div><h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">Reporte de Turno</h1><h2 className="text-sm font-bold uppercase text-slate-500 mt-1">CDI EXHIBICIONES</h2></div>
                <div className="text-right text-slate-900"><p className="text-xs md:text-sm lg:text-base font-black uppercase">Sup: {repSupervisor}</p><p className="text-xs md:text-sm lg:text-base font-black uppercase">Fecha: {repDate}</p></div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse min-w-[700px] text-slate-900 text-xs md:text-sm lg:text-base">
                  <thead><tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                    <th className="p-2 font-black uppercase border border-slate-700 w-16">Tipo</th><th className="p-2 font-black uppercase border border-slate-700 w-12">Hora</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Pedido</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Artículo</th><th className="p-2 font-black uppercase border border-slate-700">Producto / Detalle</th><th className="p-2 font-black uppercase border border-slate-700 w-24">Involucrado</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Estado</th>
                  </tr></thead>
                  <tbody>{generatedReportData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-300 break-inside-avoid">
                      <td className="p-2 font-black border-x border-slate-300">{item.type}</td><td className="p-2 font-bold border-x border-slate-300">{item.time.substring(0,5)}</td><td className="p-2 font-black text-red-700 border-x border-slate-300">{item.orderOC}</td><td className="p-2 font-black text-blue-700 border-x border-slate-300">{item.codArticulo}</td><td className="p-2 border-x border-slate-300"><span className="font-bold block truncate max-w-[150px]">{item.orderName}</span><span className="italic text-slate-600">{item.detail}</span></td><td className="p-2 font-bold border-x border-slate-300 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm">{item.person}</td><td className="p-2 font-black border-x border-slate-300">{item.status}</td>
                    </tr>
                  ))}
                  {generatedReportData.length === 0 && <tr><td colSpan="7" className="p-6 text-center font-black uppercase text-slate-400 border border-slate-200">Sin actividades registradas</td></tr>}
                  </tbody>
                </table>
              </div>
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
