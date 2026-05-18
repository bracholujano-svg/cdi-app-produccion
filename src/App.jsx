import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, MessageSquare, Clock, ArrowRightLeft, Search, UserCheck, 
  MapPin, History, Mic, MicOff, Calendar, FileText, Camera, User, 
  AlertTriangle, Bell, Megaphone, Trash2, LayoutList, AlertCircle, 
  BarChart2, Lock, LogOut, Info, Printer, Package, Sun, Moon,
  Image as ImageIcon, CheckCircle, ChevronDown, ChevronUp, FolderOpen
} from 'lucide-react';

const SUPERVISORES = [
  "Deyvis Bracho", "Juan Esteban", "Guillermo Alzate", "Alejandro", 
  "Elquin", "Eliana Soto", "Diana", "Cristian Osa", "Cristina", 
  "Marilu Osa", "Yoni", "Elexander Alzate", "Eddy"
];

const CONFIG_PROCESOS = {
  "Administrador / Todos": ["Control Total"],
  "Comercial / Ventas": ["Ingreso de Pedido", "Validación Técnica"],
  "Programación y Diseño": ["En Espera", "Diseño", "Elaboración de Planos", "Programación de Máquinas CNC"],
  "Corte y Mecanizado CNC de Madera": ["En Espera", "Corte Seccionadora", "Corte Escuadradora", "Mecanizado Venture", "Mecanizado BMG", "Mecanizado 612", "Enchape de Cantos"],
  "Ebanistería": ["En Espera", "Banco de Ebanistería", "Enchape", "Conformado", "Armado de Corian"],
  "Pintura Líquida": ["En Espera", "Pulido en Crudo", "Base 1", "Pulido de Base 1", "Base 2", "Pulido de Base 2", "Sellado", "Acabado"],
  "Corte y Dobles de Lámina y Tubería CNC": ["En Espera", "Corte Láser", "Punzonado", "Dobles", "Conformados Especiales"],
  "Área de Soldadura": ["En Espera", "Proceso de Soldadura", "Rolado y Soldadura", "Pulido y Grateado"],
  "Área de Torno Convencional y CNC": ["En Espera", "En Proceso"],
  "Pintura en Polvo": ["Limpieza", "Decapado", "Lavado Toran", "Para Pintar"],
  "Ensamble": ["En Espera", "En Banco de Ensamble", "Termo Conformado", "Láser de Acrílico"],
  "Corte y Mecanizado de Vidrio": ["En Espera", "Corte", "Mecanizado y Biselado", "Almacenado"],
  "Empaque": ["En Espera", "Para Empacar"],
  "Despachos": ["En Espera para Despacho", "DESPACHADO"]
};

const AREAS_RECEPCION = Object.keys(CONFIG_PROCESOS).filter(a => a !== "Administrador / Todos" && a !== "Comercial / Ventas");
const AREAS = Object.keys(CONFIG_PROCESOS);

const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch(e) { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch(e) {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch(e) {} }
};

const getLocalYYYYMMDD = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch(e) { return ""; }
};

const formatLocalDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  try {
    if (String(dateString).includes("T")) return new Date(dateString).toLocaleDateString();
    return new Date(`${dateString}T12:00:00`).toLocaleDateString();
  } catch(e) { return String(dateString); }
};

const getDaysLeft = (targetDate) => {
  if (!targetDate) return null;
  try {
    const today = new Date(); today.setHours(0,0,0,0); 
    let target = String(targetDate).includes('T') ? new Date(targetDate) : new Date(targetDate + 'T12:00:00');
    target.setHours(0,0,0,0);
    if (isNaN(target.getTime())) return null;
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  } catch(e) { return null; }
};

// ⚠️ TU URL MAESTRA DEL SCRIPT
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhcbHCuH4qeys0TkvwTdzZ4F10EFXSZcANLm7wbl3dWmZSsVt4usY6Joy6E2JB5s8Uaw/execec"; 

const searchInRibisoft = async (pedidoBusqueda, articuloBusqueda) => {
  return new Promise(async (resolve, reject) => {
    const pTerm = (pedidoBusqueda || "").trim();
    const aTerm = (articuloBusqueda || "").trim();
    if (!pTerm && !aTerm) return reject("INGRESAR PEDIDO O ÚLTIMOS DÍGITOS DEL ARTÍCULO.");
    if (aTerm && aTerm.length < 3) return reject("INGRESA AL MENOS 3 DÍGITOS DEL ARTÍCULO.");

    try {
      const urlParams = new URLSearchParams({ pedido: pTerm, articulo: aTerm });
      const response = await fetch(`${SCRIPT_URL}?${urlParams.toString()}`);
      const data = await response.json();
      if (data.success) resolve(data.results || [data.result]); 
      else reject(data.error || "❌ NO SE ENCONTRÓ EL ARTÍCULO O PEDIDO.");
    } catch (error) { reject("ERROR DE CONEXIÓN CON GOOGLE SCRIPT."); }
  });
};

const loginEnGoogle = async (usuario, clave) => {
  try {
    const urlParams = new URLSearchParams({ action: 'login', usuario, clave });
    const response = await fetch(`${SCRIPT_URL}?${urlParams.toString()}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: "Error de conexión con el servidor de seguridad." };
  }
};

const registrarEnGoogle = async (usuario, clave, nombre, area) => {
  if (!usuario.endsWith('@cdiexhibiciones.co')) {
    return { success: false, error: "❌ SÓLO SE PERMITEN CORREOS CORPORATIVOS (@cdiexhibiciones.co)" };
  }
  try {
    const urlParams = new URLSearchParams({ action: 'register', usuario, clave, nombre, rol: area });
    const response = await fetch(`${SCRIPT_URL}?${urlParams.toString()}`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { success: false, error: "Error al registrar en el servidor." };
  }
};

export default function App() {
  const [supervisorProfile, setSupervisorProfile] = useState(() => {
    const saved = safeStorage.get('cdi_supervisor_session');
    try { return saved ? JSON.parse(saved) : null; } catch(e) { return null; }
  });
  
  const [orders, setOrders] = useState(() => {
    const saved = safeStorage.get('cdi_local_orders');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(o => o && typeof o === 'object') : [];
    } catch(e) { return []; }
  });
  
  const [coordinationAlerts, setCoordinationAlerts] = useState(() => {
    const saved = safeStorage.get('cdi_local_alerts');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(a => a && typeof a === 'object') : [];
    } catch(e) { return []; }
  });

  const [selectedGroupPedido, setSelectedGroupPedido] = useState(null); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [viewFilter, setViewFilter] = useState('TODOS'); 
  const [gridColumns, setGridColumns] = useState(3);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [showCoordViewModal, setShowCoordViewModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [appTheme, setAppTheme] = useState('dark');
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
  
  const [tempTransferArea, setTempTransferArea] = useState("");
  const [tempTransferDate, setTempTransferDate] = useState("");
  const [tempShiftActivity, setTempShiftActivity] = useState("");
  const [tempOperario, setTempOperario] = useState("");
  const [shiftNoteText, setShiftNoteText] = useState("");
  const [tempPhoto, setTempPhoto] = useState(null);
  
  const [calidadState, setCalidadState] = useState("APROBADO");
  const [calidadInspector, setCalidadInspector] = useState("");
  const [calidadNota, setCalidadNota] = useState("");
  const [calidadPhoto, setCalidadPhoto] = useState(null);
  
  const [transferNota, setTransferNota] = useState("");
  const [transferPhoto, setTransferPhoto] = useState(null);

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

  const [repDate, setRepDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [repSupervisor, setRepSupervisor] = useState("");
  const [generatedReportData, setGeneratedReportData] = useState([]);

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
          if (results.length === 1) {
              fillFormWithResult(results[0]);
              setExcelSearchSuccess(`✅ Extraído: ${results[0].nombre}`);
          } else {
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

  const handleVirtualLogin = async (e) => {
    e.preventDefault(); 
    setAuthError(""); 
    const userStr = e.target.username.value.trim().toLowerCase();
    const passStr = e.target.password.value.trim();
    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;

    setAuthError("⏳ VERIFICANDO CREDENCIALES EN GOOGLE...");

    const res = await loginEnGoogle(emailFull, passStr);
    
    if (res.success) {
      setAuthError("");
      const newProfile = { 
        name: res.result.nombre, 
        email: emailFull, 
        area: res.result.rol
      };
      setSupervisorProfile(newProfile);
      safeStorage.set('cdi_supervisor_session', JSON.stringify(newProfile));
      
      const newRecent = [{ username: userStr, name: newProfile.name }, ...savedLogins.filter(u => u?.username !== userStr)].slice(0, 3);
      setSavedLogins(newRecent); 
      safeStorage.set('cdi_recent_logins', JSON.stringify(newRecent));
      
      if (newProfile.area !== "Administrador / Todos" && AREAS.includes(newProfile.area)) {
        setAreaFilter(newProfile.area);
      }
    } else {
      setAuthError(res.error);
    }
  };

  const handleVirtualRegister = async (e) => {
    e.preventDefault(); 
    setAuthError("");
    const name = e.target.name.value.trim().toUpperCase();
    const userStr = e.target.username.value.trim().toLowerCase();
    const pass = e.target.password.value.trim();
    const area = e.target.area ? e.target.area.value : 'Pendiente';
    
    if (!/^\d+$/.test(pass) || pass.length < 4) {
      setAuthError("El PIN debe ser numérico y mínimo de 4 dígitos."); 
      return;
    }

    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;
    setAuthError("⏳ REGISTRANDO EN LA BÓVEDA DE GOOGLE...");

    const res = await registrarEnGoogle(emailFull, pass, name, area);
    
    if (res.success) {
      setAuthError("");
      alert("🎉 ¡REGISTRO CORRECTO!\n\nTu perfil se creó con éxito. Quedaste en estado 'Pendiente de Aprobación'. Infórmale al administrador para que te asigne tu rol desde el Excel.");
      setIsRegistering(false);
    } else {
      setAuthError(res.error);
    }
  };

  const handleLogout = () => { setSupervisorProfile(null); safeStorage.remove('cdi_supervisor_session'); setAreaFilter('Todas'); };

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
      safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));
  };

  const createOrder = (e) => {
    e.preventDefault();
    const form = e.target;
    const pedNum = (form.pedidoNum.value || "").trim().toUpperCase();
    const areaIni = form.areaRecibe.value;
    const existingAlert = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pedNum);
    
    const newOrder = {
      id: Date.now().toString(),
      pedidoNum: pedNum,
      codArticulo: (form.codArticulo.value || "").trim().toUpperCase(),
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
    safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));
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
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));
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
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));
    setCalidadNota(""); setCalidadPhoto(null);
  };

  const updateTransfer = (id, area, date, en, re) => {
    const order = orders.find(o => o?.id === id);
    if (!order) return;
    const newHistoryEntry = { fecha: new Date().toISOString(), accion: `Entrega a ${area}`, entrega: en, recibe: re, nota: transferNota, foto: transferPhoto };
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
                safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));
            }
        }
    }

    setOrders(newOrdersList); setSelectedOrder(null); safeStorage.set('cdi_local_orders', JSON.stringify(newOrdersList));
  };

  const addItemToCoordList = () => {
    if (!inputManualPedido || !inputManualFecha || !inputManualCliente) return;
    const newItem = { id: Date.now(), pedidoNum: inputManualPedido.trim().toUpperCase(), cliente: inputManualCliente.trim().toUpperCase(), fechaEntrega: inputManualFecha, detalle: inputManualDetalle ? inputManualDetalle.trim() : '', creadoEn: new Date().toISOString() };
    setCoordList([...coordList, newItem]);
    setInputManualPedido(""); setInputManualCliente(""); setInputManualDetalle("");
  };

  const saveBatchCoordination = () => {
    const newAlerts = [...coordinationAlerts, ...coordList];
    setCoordinationAlerts(newAlerts); safeStorage.set('cdi_local_alerts', JSON.stringify(newAlerts));
    
    let updatedOrders = [...orders];
    coordList.forEach(item => {
        updatedOrders = updatedOrders.map(o => (o?.pedidoNum || "").toUpperCase() === item.pedidoNum ? { ...o, prioridad: 'ALTA', fechaEntregaPrometida: item.fechaEntrega } : o);
    });
    setOrders(updatedOrders); safeStorage.set('cdi_local_orders', JSON.stringify(updatedOrders));
    
    setCoordList([]); setShowCoordinationModal(false);
  };

  const shareToWhatsApp = (type, savedLog = null) => {
    if (!selectedOrder) return;
    let text = `📦 *REPORTE CDI - PEDIDO ${selectedOrder.pedidoNum || ''}*\n*Artículo:* ${selectedOrder.codArticulo || ''}\n*Producto:* ${selectedOrder.nombre || ''}\n\n`;
    if (type === 'tech') {
        const log = savedLog || { supervisor: supervisorProfile?.name, operario: tempOperario, actividad: tempShiftActivity, nota: shiftNoteText };
        text += `🏭 *AVANCE PRODUCCIÓN*\n*Actividad:* ${log.actividad}\n*Op:* ${log.operario}\n*Novedad:* ${log.nota}`;
    } else if (type === 'trazabilidad') {
        text += `🔄 *ENTREGA SECCIÓN*\n*Acción:* ${savedLog.accion}\n*Entrega:* ${savedLog.entrega}\n*Recibe:* ${savedLog.recibe}\n*Obs:* ${savedLog.nota || 'N/A'}`;
    } else if (type === 'calidad') {
        const log = savedLog || { estado: calidadState, inspector: calidadInspector, observacion: calidadNota };
        text += `🔍 *INSPECCIÓN CALIDAD*\n*Estado:* ${log.estado}\n*Inspector:* ${log.inspector}\n*Obs:* ${log.observacion}`;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, 'whatsapp_cdi_tab');
  };

  const generateShiftReport = () => {
    if (!repSupervisor || !repDate) return;
    let entries = [];
    orders.forEach(order => {
      const tech = (order?.bitacoraTurnos || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && n?.supervisor === repSupervisor);
      tech.forEach(n => entries.push({ ...n, type: 'Producción', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, client: order?.cliente, time: new Date(n.fecha).toLocaleTimeString(), nota: n.nota, operario: n.operario }));
    });
    setGeneratedReportData(entries.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)));
    setShowReportConfigModal(false); setShowReportPreviewModal(true);
  };

  const filteredOrders = orders.filter(o => {
    if (!o) return false;
    const matchSearch = (o.pedidoNum || "").toLowerCase().includes(searchTerm.toLowerCase()) || (o.nombre || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchArea = areaFilter === 'Todas' || o.areaActual === areaFilter;
    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0 && o.estadoInterno !== 'DESPACHADO';
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

  const totalOrders = orders.length;
  const atrasadosCount = orders.filter(o => o && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0 && o.estadoInterno !== 'DESPACHADO').length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;
  const cumplidosCount = totalOrders - atrasadosCount - despachadosCount;

  const urgentOrdersForMarquee = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) <= 3).sort((a, b) => getDaysLeft(a?.fechaEntregaPrometida) - getDaysLeft(b?.fechaEntregaPrometida));
  const mostUrgentOrder = urgentOrdersForMarquee.length > 0 ? urgentOrdersForMarquee[0] : null;

  let gridColsClass = 'lg:grid-cols-3';
  if (gridColumns === 4) gridColsClass = 'lg:grid-cols-4';
  if (gridColumns === 5) gridColsClass = 'lg:grid-cols-5';

  if (!supervisorProfile) return (
    <div className="min-h-screen theme-bg-main flex flex-col items-center justify-center p-4 transition-colors duration-300" data-theme={appTheme}>
      <div className="w-full max-w-md theme-bg-card rounded-[3rem] border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-500">
        <div className="p-8 text-center border-b theme-border theme-bg-header relative">
          <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="absolute top-4 right-4 p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all">{appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="flex items-center justify-center gap-2 mb-4 select-none">
             <span className="text-5xl font-normal tracking-[-0.04em] leading-none text-[#a1bdc2] transform scale-y-[1.1]" style={{ fontFamily: "Impact, 'Oswald', sans-serif" }}>CDI</span>
             <div className="w-[3px] h-[40px] bg-current opacity-30 rounded-full mx-2"></div>
             <div className="flex flex-col text-left justify-center">
               <span className="text-[9px] font-bold leading-none tracking-[0.2em] theme-text-muted mb-[2px]">DISEÑO EN</span>
               <span className="text-[12px] font-black leading-none tracking-[0.05em] text-[#a1bdc2]">EXHIBICIÓN</span>
             </div>
          </div>
          <h2 className="text-[#eadcba] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2"><Lock size={16}/> {isRegistering ? 'Registro Seguro' : 'Acceso Planta'}</h2>
        </div>
        
        <form onSubmit={isRegistering ? handleVirtualRegister : handleVirtualLogin} className="p-8 space-y-5">
          {savedLogins.length > 0 && !isRegistering && (
             <div className="flex flex-wrap gap-2 justify-center mb-4">
               {savedLogins.map((u, i) => (
                 <button type="button" key={i} onClick={() => { document.getElementsByName('username')[0].value = u.username; }} className="bg-[#a1bdc2]/10 text-[#a1bdc2] px-3 py-1.5 rounded-xl text-[10px] font-black border border-[#a1bdc2]/30 hover:bg-[#a1bdc2]/20 transition-colors">
                   {u?.name?.split(' ')[0]}
                 </button>
               ))}
             </div>
          )}

          {authError && <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-300 p-3 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2"><AlertCircle size={14} className="shrink-0"/><span>{authError}</span></div>}
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Nombre Completo</label>
              <input name="name" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase focus:ring-2 focus:ring-[#eadcba]" placeholder="EJ: JUAN PEREZ" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Usuario Corporativo</label>
            <div className="flex theme-bg-input rounded-2xl overflow-hidden border theme-border focus-within:ring-2 focus-within:ring-[#eadcba] transition-all">
              <input name="username" type="text" required className="w-full p-4 bg-transparent outline-none font-bold" placeholder="nombre.apellido" />
              <div className="px-3 sm:px-4 theme-bg-header theme-text-muted font-black text-[10px] sm:text-xs flex items-center select-none border-l theme-border">@cdiexhibiciones.co</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black theme-text-muted uppercase">Clave / PIN</label>
              <span className="text-[8px] font-bold text-[#eadcba] uppercase flex items-center gap-1"><Info size={10}/> Mín. 4 dígitos</span>
            </div>
            <input name="password" type="password" inputMode="numeric" pattern="\d*" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold tracking-widest text-lg focus:ring-2 focus:ring-[#eadcba]" placeholder="••••" />
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Área Asignada (Solo Registro)</label>
              <select name="area" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase text-xs focus:ring-2 focus:ring-[#eadcba]">
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <button type="submit" className="w-full bg-[#eadcba] text-[#1e293b] font-black uppercase py-4 rounded-2xl shadow-xl hover:brightness-110 active:translate-y-1 border-b-4 border-[#bdae91] transition-all">
            {isRegistering ? 'Crear Perfil Seguro' : 'Ingresar al Sistema'}
          </button>
          <p className="text-center text-[10px] font-black theme-text-muted uppercase tracking-widest cursor-pointer hover:text-[#eadcba] transition-colors" onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}>
            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿Nuevo supervisor? Registrarse'}
          </p>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans pb-20 transition-colors duration-300 theme-bg-main" data-theme={appTheme}>
      
      {mostUrgentOrder && (
        <div className="bg-red-600 text-white py-2 sticky top-0 z-[60] shadow-md border-b border-red-800 whitespace-nowrap overflow-hidden">
          <div className="flex animate-marquee items-center text-[10px] md:text-xs font-black uppercase tracking-widest w-max pr-[100vw]">
            <span className="flex items-center gap-2"><AlertTriangle size={14} /> PEDIDO PRÓXIMO: {mostUrgentOrder.cliente} (Pedido: {mostUrgentOrder.pedidoNum}) - FALTAN {getDaysLeft(mostUrgentOrder.fechaEntregaPrometida)} DÍAS</span>
          </div>
        </div>
      )}

      <header className={`theme-bg-header p-3 md:p-4 sticky ${mostUrgentOrder ? 'top-[36px]' : 'top-0'} z-50 shadow-md border-b theme-border transition-all`}>
        <div className="max-w-[1600px] mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 select-none cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <span className="text-[34px] md:text-[42px] font-normal tracking-[-0.04em] leading-none text-[#a1bdc2] transform scale-y-[1.1] scale-x-[0.95]" style={{ fontFamily: "Impact, 'Oswald', sans-serif" }}>CDI</span>
              <div className="w-[2px] h-[28px] md:h-[34px] bg-current opacity-30 rounded-full mx-1"></div>
              <div className="flex flex-col justify-center">
                <span className="text-[7px] md:text-[8px] font-bold leading-none tracking-[0.2em] theme-text-muted mb-[1px]">DISEÑO EN</span>
                <span className="text-[9px] md:text-[11px] font-black leading-none tracking-[0.05em] text-[#a1bdc2]">EXHIBICIÓN</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all"><Sun size={18} /></button>
            <button type="button" onClick={handleLogout} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"><LogOut size={18} /></button>
            <div className="w-px h-6 bg-current opacity-20 mx-1"></div>
            
            <button type="button" className="bg-[#eadcba] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px]" title="Ingresos">
              <Package size={16} /><span className="hidden md:inline">Ingresos</span>
            </button>
            
            <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={`p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm border-b-[3px] active:border-b-0 active:translate-y-[3px] transition-all ${viewFilter === 'DESPACHADOS' ? 'bg-[#a1bdc2] text-[#1e293b] border-[#7d969b]' : 'theme-bg-input theme-text-muted border-transparent opacity-70'}`}>
              <CheckCircle size={16} /><span className="hidden md:inline">Ped. Despachados</span>
            </button>
            
            <button type="button" onClick={() => setShowDashboardModal(true)} className="bg-[#a1bdc2] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">
              <BarChart2 size={16} /><span className="hidden md:inline">Indicadores</span>
            </button>
            <button type="button" onClick={() => setShowCoordinationModal(true)} className="bg-[#eadcba] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px]">
              <Megaphone size={16} /><span className="hidden md:inline">Coord</span>
            </button>
            <button type="button" onClick={() => { setShowAddModal(true); setSearchResults([]); setShowSearchSelector(false); }} className="bg-[#a1bdc2] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">
              <Plus size={16} strokeWidth={3} /><span className="hidden md:inline">Nuevo</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`theme-bg-card border-b theme-border shadow-sm sticky ${mostUrgentOrder ? 'top-[104px]' : 'top-[68px]'} z-40`}>
        <div className="max-w-[1600px] mx-auto p-2 md:p-3 flex gap-3 overflow-x-auto whitespace-nowrap items-center px-4 custom-scrollbar">
          
          <div className="flex flex-col text-left border-r-2 theme-border pr-4 mr-1 shrink-0">
            <span className="text-[11px] font-black text-[#eadcba] uppercase leading-none">{supervisorProfile.name}</span>
            <span className="text-[8px] font-bold theme-text-muted uppercase mt-1">{supervisorProfile.area}</span>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 shrink-0">
             <button type="button" onClick={() => setViewFilter('TODOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewFilter === 'TODOS' ? 'bg-[#a1bdc2] text-[#1e293b] shadow-sm' : 'theme-text-muted hover:text-[#a1bdc2]'}`}>
               Producción ({totalOrders - despachadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('ATRASADOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewFilter === 'ATRASADOS' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 dark:text-red-500/70 hover:text-red-500'}`}>
               Atrasos ({atrasadosCount})
             </button>
          </div>
          
          <div className="w-px h-6 bg-current opacity-20 mx-1 shrink-0"></div>

          <button type="button" onClick={() => setShowCoordViewModal(true)} className="flex items-center gap-2 text-[10px] font-black uppercase theme-text-muted hover:text-[#a1bdc2] transition-colors py-4 px-2">
            <Bell size={14} className={coordinationAlerts.length > 0 ? 'animate-bounce text-[#eadcba]' : ''} /><span>Alertas ({coordinationAlerts.length})</span>
          </button>

          <button type="button" onClick={() => setShowReportConfigModal(true)} className="flex items-center gap-2 text-[10px] font-black uppercase theme-text-muted hover:text-[#a1bdc2] transition-colors py-4 px-2">
            <FileText size={14} /><span>Reporte</span>
          </button>

        </div>

        <div className="theme-bg-input border-t theme-border p-2 px-4 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-card font-bold text-xs outline-none border theme-border focus:ring-2 focus:ring-[#a1bdc2]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex gap-2">
                <select disabled={supervisorProfile.area !== "Administrador / Todos"} className="flex-1 md:w-48 theme-bg-card px-4 py-3 rounded-xl font-black text-[10px] uppercase outline-none border theme-border focus:ring-2 focus:ring-[#a1bdc2] disabled:opacity-70 cursor-pointer" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                    <option value="Todas">Todas las Áreas</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <div className="hidden md:flex theme-bg-card border theme-border rounded-xl p-1 gap-1">
                    <button type="button" onClick={()=>setGridColumns(3)} className={`p-2 rounded-lg transition-colors ${gridColumns===3 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Grande">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(4)} className={`p-2 rounded-lg transition-colors ${gridColumns===4 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Mediana">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(5)} className={`p-2 rounded-lg transition-colors ${gridColumns===5 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="4" height="18"></rect><rect x="8" y="3" width="4" height="18"></rect><rect x="14" y="3" width="4" height="18"></rect><rect x="20" y="3" width="4" height="18"></rect></svg>
                    </button>
                </div>
            </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 min-h-screen">
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5`}>
          {groupedArray.map(group => {
             const daysLeft = getDaysLeft(group?.fechaEntregaPrometida);
             const isAtrasado = daysLeft !== null && daysLeft < 0 && viewFilter !== 'DESPACHADOS';
             const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && viewFilter !== 'DESPACHADOS';
             const isCumplido = (daysLeft !== null && daysLeft > 3) || viewFilter === 'DESPACHADOS';

             const titleSize = gridColumns === 5 ? 'text-base md:text-lg' : gridColumns === 4 ? 'text-lg md:text-xl' : 'text-xl md:text-2xl';
             const badgeSize = gridColumns === 5 ? 'text-[7px] px-1.5 py-0.5' : 'text-[9px] px-2 py-1';
             const paddingSize = gridColumns === 5 ? 'p-4' : 'p-5 md:p-6';
             const bottomTextSize = gridColumns === 5 ? 'text-[8px]' : 'text-[10px]';
             const pedidoPrefix = gridColumns === 5 ? 'PED:' : 'PEDIDO:';

             return (
              <div key={group.pedidoNum} onClick={() => setSelectedGroupPedido(group.pedidoNum)} className={`rounded-3xl ${paddingSize} cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50 animate-pulse-red' : 'theme-border'}`}>
                
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis ${badgeSize} ${isAtrasado ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isUrgent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[#a1bdc2]/10 text-[#a1bdc2] border border-[#a1bdc2]/20'}`}>
                    {isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D` : (viewFilter === 'DESPACHADOS' ? '✅ DESPACHADO' : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES` : 'S/F'))}
                  </div>
                  <FolderOpen size={16} className={`${isAtrasado || isUrgent ? 'text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
                </div>
                
                <h3 title={group.pedidoNum} className={`${titleSize} font-black uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-500' : 'text-[#a1bdc2]'}`}>
                  {pedidoPrefix} {group.pedidoNum}
                </h3>
                <p title={group.cliente} className={`font-black theme-text-muted uppercase mt-0.5 truncate ${titleSize}`}>{group.cliente}</p>
                
                <div className="mt-4 pt-4 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-2">
                  <span className={`px-2.5 py-1 theme-bg-input rounded-md font-black text-[#a1bdc2] ${bottomTextSize}`}>{group.products?.length || 0} PROD.</span>
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
              <div>
                 <h2 className="text-xl font-black text-[#a1bdc2]">ORDEN: {activeGroupObj.pedidoNum}</h2>
                 <p className="text-[10px] font-bold theme-text-muted uppercase">{activeGroupObj.cliente}</p>
              </div>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[#a1bdc2]">✕</button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 custom-scrollbar">
              {(activeGroupObj.products || []).map(p => (
                <div key={p.id} onClick={() => setSelectedOrder(p)} className="theme-bg-card p-4 rounded-2xl border-[2px] theme-border cursor-pointer hover:border-[#a1bdc2] shadow-sm transition-all active:scale-95 bg-[#1e293b]">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] bg-[#a1bdc2]/20 text-[#a1bdc2] px-2 py-1 rounded border border-[#a1bdc2]/30 font-black truncate">CÓD: {p.codArticulo}</span>
                  </div>
                  <h4 className="font-black text-xs uppercase leading-tight text-[#a1bdc2]">{p.nombre}</h4>
                  <div className="mt-4 p-2 bg-[#2b3746] rounded-xl border border-[#4a5c70]">
                    <p className="text-[9px] font-black text-[#eadcba] uppercase flex items-center gap-1 truncate"><MapPin size={10}/> {p.areaActual}</p>
                    <p className="text-[9px] font-black theme-text-muted uppercase flex items-center gap-1 mt-1 truncate"><Clock size={10}/> {p.estadoInterno}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-2xl md:h-[75vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
              <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2 text-[#a1bdc2]"><Plus size={20} /> Nuevo Registro Planta</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setSearchResults([]); setShowSearchSelector(false); }} className="p-2.5 bg-black/5 hover:bg-black/10 rounded-xl transition-all text-[#a1bdc2]">✕</button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-8 custom-scrollbar">
                <div className="bg-[#1e293b] p-5 rounded-[1.5rem] border border-[#4a5c70] shadow-inner mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-[#a1bdc2]/20 rounded-lg"><Search size={14} className="text-[#a1bdc2]"/></div>
                        <p className="text-[10px] font-black uppercase text-[#a1bdc2] tracking-widest">Puente Ribisoft (Autocompletar)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input value={excelSearchPedido} onChange={e=>setExcelSearchPedido(e.target.value)} placeholder="Nº PEDIDO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] uppercase placeholder:text-black/30" />
                        <input value={excelSearchArticulo} onChange={e=>setExcelSearchArticulo(e.target.value)} placeholder="ÚLT. DÍGITOS ARTÍCULO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] uppercase placeholder:text-black/30" />
                        <button type="button" onClick={doExcelSearch} disabled={excelSearchLoading} className="bg-[#eadcba] text-[#1e293b] px-6 py-3.5 rounded-xl font-black text-xs uppercase shadow-sm border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px] disabled:opacity-50 shrink-0">
                            {excelSearchLoading ? '...' : 'BUSCAR'}
                        </button>
                    </div>
                    {excelSearchError && <p className="text-red-400 text-[9px] font-black uppercase mt-3 flex items-center gap-1"><AlertCircle size={12}/>{excelSearchError}</p>}
                    {excelSearchSuccess && <p className="text-green-400 text-[9px] font-black uppercase mt-3 flex items-center gap-1"><CheckCircle size={12}/>{excelSearchSuccess}</p>}

                    {showSearchSelector && searchResults.length > 0 && (
                      <div className="mt-4 p-3 bg-[#2b3746] rounded-xl border border-[#4a5c70] max-h-52 overflow-y-auto space-y-2 custom-scrollbar text-left animate-in slide-in-from-top-2">
                        <p className="text-[9px] font-black text-[#eadcba] uppercase tracking-wider mb-2">Se encontraron varios pedidos. Toca el correcto:</p>
                        {searchResults.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              fillFormWithResult(res);
                              setShowSearchSelector(false);
                              setExcelSearchSuccess(`✅ Seleccionado: ${res.nombre} (Pedido ${res.pedido})`);
                            }}
                            className="p-2.5 bg-[#1e293b] hover:bg-[#374657] rounded-lg border border-[#4a5c70] cursor-pointer transition-colors flex flex-col"
                          >
                            <div className="flex justify-between text-[10px] font-black uppercase text-[#a1bdc2]">
                              <span>PEDIDO: {res.pedido}</span>
                              <span>ART: {res.articulo}</span>
                            </div>
                            <span className="text-[10px] font-bold text-white uppercase truncate mt-1">{res.nombre}</span>
                            <span className="text-[8px] text-slate-400 uppercase mt-0.5">CLIENTE: {res.cliente}</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <form id="nuevoRegistroForm" onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Nombre del Producto / Proyecto</label>
                    <input name="nombre" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE AUTOMÁTICO..." /></div>
                    
                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Nº Pedido</label>
                    <input name="pedidoNum" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="EJ: 12345" /></div>

                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Código de Artículo</label>
                    <input name="codArticulo" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CÓDIGO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Marca / Cliente</label>
                    <input name="cliente" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CLIENTE AUTOMÁTICO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1 mt-2">
                        <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Área de Recepción Inicial (Producción)</label>
                        <select name="areaRecibe" className="w-full p-4 bg-[#a1bdc2] text-[#1e293b] rounded-xl font-black uppercase text-xs border border-[#7d969b] outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-white">
                            {AREAS_RECEPCION.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Firma Entrega</label>
                    <input name="entregaPersona" required defaultValue={supervisorProfile.name} className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="QUIEN ENTREGA..." /></div>
                    
                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Firma Recibe</label>
                    <input name="recibePersona" required className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="QUIEN RECIBE..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Cantidad a Producir</label>
                    <input name="cantidad" type="number" required className="w-full p-4 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CANTIDAD..." /></div>
                    
                    <button type="submit" className="md:col-span-2 mt-4 bg-[#a1bdc2] text-[#1e293b] py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-sm border-b-[4px] border-[#7d969b] active:border-b-0 active:translate-y-[4px]">INICIAR PRODUCCIÓN</button>
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
                <h2 className="text-base font-black uppercase truncate text-[#a1bdc2]">PED: {selectedOrder.pedidoNum}</h2>
                <p className="text-[10px] font-bold uppercase truncate theme-text-muted mt-0.5">{selectedOrder.nombre}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-all text-[#a1bdc2] shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center gap-3 bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                    <span className="font-black text-xs uppercase tracking-wide">Avance en Planta</span>
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs uppercase outline-none text-[#a1bdc2]">{CONFIG_PROCESOS[selectedOrder.areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <Camera size={16}/> {tempPhoto ? 'FOTO LISTA' : 'ADJUNTAR FOTO'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addShiftNote} className="col-span-3 bg-[#eadcba] text-[#1e293b] font-black uppercase text-[10px] py-3.5 rounded-xl border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px]">Guardar Avance</button>
                            <button type="button" onClick={() => shareToWhatsApp('tech')} className="col-span-1 bg-[#25D366] text-white flex items-center justify-center rounded-xl border-b-[3px] border-[#1a9e4b] active:border-b-0 active:translate-y-[3px]"><MessageSquare size={18}/></button>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryPlanta(!showHistoryPlanta)} className="w-full flex justify-between items-center bg-black/10 p-2.5 rounded-xl hover:bg-black/20 transition-colors">
                                <span className="text-[9px] font-black theme-text-muted uppercase tracking-widest flex items-center gap-2"><History size={12}/> Histórico Producción ({(selectedOrder.bitacoraTurnos || []).length})</span>
                                {showHistoryPlanta ? <ChevronUp size={14} className="theme-text-muted"/> : <ChevronDown size={14} className="theme-text-muted"/>}
                            </button>
                            {showHistoryPlanta && (selectedOrder.bitacoraTurnos || []).slice().reverse().map((n, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group">
                                    <button type="button" onClick={() => shareToWhatsApp('tech', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className="text-[10px] font-black text-[#a1bdc2] uppercase">{n.actividad}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-[10px] italic theme-text-muted my-1">"{n.nota}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-[9px] font-black uppercase text-[#a1bdc2]">OP: {n.operario}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'calidad' ? null : 'calidad')} className="w-full p-4 flex items-center gap-3 bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="p-2 bg-black/20 rounded-lg"><UserCheck size={18}/></div>
                    <span className="font-black text-xs uppercase tracking-wide">Inspección Calidad</span>
                 </button>
                 {openSection === 'calidad' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <div className="flex gap-2">
                            <button type="button" onClick={()=>setCalidadState('APROBADO')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-b-[3px] active:border-b-0 active:translate-y-[3px] ${calidadState==='APROBADO' ? 'bg-green-500 text-white border-green-700' : 'bg-black/20 text-[#a1bdc2] border-transparent'}`}>APROBADO</button>
                            <button type="button" onClick={()=>setCalidadState('RECHAZADO')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-b-[3px] active:border-b-0 active:translate-y-[3px] ${calidadState==='RECHAZADO' ? 'bg-red-500 text-white border-red-700' : 'bg-black/20 text-[#a1bdc2] border-transparent'}`}>RECHAZADO</button>
                        </div>
                        <input value={calidadInspector} onChange={e=>setCalidadInspector(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE INSPECTOR..." />
                        <div className="relative">
                            <textarea value={calidadNota} onChange={e=>setCalidadNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="OBSERVACIONES DE CALIDAD..."></textarea>
                            <button type="button" onClick={()=>toggleMic('calidad')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'calidad' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'calidad' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <Camera size={16}/> {calidadPhoto ? 'FOTO LISTA' : 'ADJUNTAR FOTO'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                        </div>
                        {calidadPhoto && <img src={calidadPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addQualityNote} className="col-span-3 bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-[10px] py-3.5 rounded-xl border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">Guardar Inspección</button>
                            <button type="button" onClick={() => shareToWhatsApp('calidad')} className="col-span-1 bg-[#25D366] text-white flex items-center justify-center rounded-xl border-b-[3px] border-[#1a9e4b] active:border-b-0 active:translate-y-[3px]"><MessageSquare size={18}/></button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryCalidad(!showHistoryCalidad)} className="w-full flex justify-between items-center bg-black/10 p-2.5 rounded-xl hover:bg-black/20 transition-colors">
                                <span className="text-[9px] font-black theme-text-muted uppercase tracking-widest flex items-center gap-2"><UserCheck size={12}/> Histórico Calidad ({(selectedOrder.bitacoraCalidad || []).length})</span>
                                {showHistoryCalidad ? <ChevronUp size={14} className="theme-text-muted"/> : <ChevronDown size={14} className="theme-text-muted"/>}
                            </button>
                            {showHistoryCalidad && (selectedOrder.bitacoraCalidad || []).slice().reverse().map((n, i) => (
                                <div key={i} className={`theme-bg-input p-3 rounded-xl border relative ${n.estado==='APROBADO' ? 'border-green-500/30' : 'border-red-500/30'}`}>
                                    <button type="button" onClick={() => shareToWhatsApp('calidad', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className={`text-[10px] font-black uppercase ${n.estado==='APROBADO' ? 'text-green-500' : 'text-red-500'}`}>{n.estado}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-[10px] italic theme-text-muted my-1">"{n.observacion}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-[9px] font-black uppercase text-[#a1bdc2]">INSP: {n.inspector}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center gap-3 bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                    <span className="font-black text-xs uppercase tracking-wide">Entregas Sección</span>
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <select value={tempTransferArea} onChange={e=>setTempTransferArea(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2]">{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2]" />
                        <div className="grid grid-cols-2 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile.name} className="p-3.5 theme-bg-input rounded-xl font-bold text-[10px] uppercase border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="FIRMA ENTREGA" />
                            <input id="recibidoPor" className="p-3.5 theme-bg-input rounded-xl font-bold text-[10px] uppercase border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="FIRMA RECIBE" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <Camera size={16}/> {transferPhoto ? 'FOTO LISTA' : 'ADJUNTAR ACTA / FOTO'}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <button type="button" onClick={()=>{
                            const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                            const re = document.getElementById('recibidoPor').value.trim().toUpperCase();
                            if(en && re && tempTransferDate) updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, re);
                        }} className="w-full bg-[#eadcba] text-[#1e293b] py-4 rounded-xl font-black uppercase text-[10px] shadow-sm border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px]">Confirmar Entrega de Sección</button>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryEntrega(!showHistoryEntrega)} className="w-full flex justify-between items-center bg-black/10 p-2.5 rounded-xl hover:bg-black/20 transition-colors">
                                <span className="text-[9px] font-black theme-text-muted uppercase tracking-widest flex items-center gap-2"><ArrowRightLeft size={12}/> Trazabilidad Custodia ({(selectedOrder.historial || []).length})</span>
                                {showHistoryEntrega ? <ChevronUp size={14} className="theme-text-muted"/> : <ChevronDown size={14} className="theme-text-muted"/>}
                            </button>
                            {showHistoryEntrega && (selectedOrder.historial || []).slice().reverse().map((h, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group">
                                    <button type="button" onClick={() => shareToWhatsApp('trazabilidad', h)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-2 pr-8"><span className="bg-[#a1bdc2]/20 text-[#a1bdc2] px-2 py-0.5 rounded text-[9px] font-black uppercase border border-[#a1bdc2]/30">{h.accion}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(h.fecha).toLocaleString()}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase bg-black/10 p-2 rounded-lg"><div><span className="text-[7px] text-[#a1bdc2] block uppercase">ENTREGA</span>{h.entrega}</div><div><span className="text-[7px] text-[#a1bdc2] block uppercase">RECIBE</span>{h.recibe}</div></div>
                                    {h.nota && <p className="text-[9px] italic theme-text-muted mt-2">Obs: "{h.nota}"</p>}
                                    {h.foto && <button type="button" onClick={()=>window.open(h.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Acta Firmada</button>}
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center"><div className="flex items-center gap-3"><BarChart2 size={20} className="text-[#eadcba]" /><h2 className="text-lg font-black uppercase text-[#a1bdc2]">Indicadores Globales</h2></div><button type="button" onClick={() => setShowDashboardModal(false)} className="p-2 bg-black/10 rounded-xl text-[#a1bdc2]">✕</button></div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="px-4 py-3 bg-blue-500/10 border-b-[3px] border-blue-500/30 rounded-xl flex flex-col items-center"><span className="text-2xl font-black text-blue-400 leading-none">{totalOrders}</span><span className="text-[9px] font-bold uppercase mt-1 text-blue-400">Total</span></div>
              <div className="px-4 py-3 bg-green-500/10 border-b-[3px] border-green-500/30 rounded-xl flex flex-col items-center"><span className="text-2xl font-black text-green-400 leading-none">{cumplidosCount}</span><span className="text-[9px] font-bold uppercase mt-1 text-green-400">A Tiempo</span></div>
              <div className="px-4 py-3 bg-red-500/10 border-b-[3px] border-red-500/30 rounded-xl flex flex-col items-center"><span className="text-2xl font-black text-red-400 leading-none">{atrasadosCount}</span><span className="text-[9px] font-bold uppercase mt-1 text-red-400">Atrasados</span></div>
              <div className="px-4 py-3 bg-[#eadcba]/10 border-b-[3px] border-[#eadcba]/30 rounded-xl flex flex-col items-center"><span className="text-2xl font-black text-[#eadcba] leading-none">{totalOrders ? Math.round((cumplidosCount/totalOrders)*100) : 0}%</span><span className="text-[9px] font-bold uppercase mt-1 text-[#eadcba]">Eficiencia</span></div>
            </div>
          </div>
        </div>
      )}

      {showCoordinationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border flex flex-col max-h-[90vh]">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><Megaphone size={20} className="text-[#eadcba]" /><h2 className="text-lg font-black uppercase text-[#a1bdc2]">Coordinación Logística</h2></div><button type="button" onClick={() => setShowCoordinationModal(false)} className="p-2 bg-black/10 rounded-xl text-[#a1bdc2]">✕</button></div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div className="theme-bg-main p-5 rounded-2xl border theme-border">
                <h3 className="text-[10px] font-black text-[#a1bdc2] uppercase tracking-widest mb-4">Agregar Pedido a Alertas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={inputManualPedido} onChange={e=>setInputManualPedido(e.target.value)} placeholder="Nº PEDIDO" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" />
                  <input value={inputManualCliente} onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" />
                  <input type="date" value={inputManualFecha} onChange={e=>setInputManualFecha(e.target.value)} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2]" />
                  <div className="md:col-span-2"><input value={inputManualDetalle} onChange={e=>setInputManualDetalle(e.target.value)} placeholder="OBSERVACIÓN (Opcional)" className="w-full p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" /></div>
                  <button type="button" onClick={addItemToCoordList} className="bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-[10px] rounded-xl py-3 border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">Añadir a Lista</button>
                </div>
              </div>
              {coordList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-[#eadcba] uppercase tracking-widest">Lista Pendiente por Guardar</h3>
                  {coordList.map(item => (
                    <div key={item.id} className="flex justify-between items-center theme-bg-main p-3.5 rounded-xl border theme-border">
                      <div><span className="font-black uppercase text-xs block text-[#a1bdc2]">{item.pedidoNum} - {item.cliente}</span><span className="text-[9px] theme-text-muted font-bold">Entrega: {item.fechaEntrega}</span></div>
                      <button type="button" onClick={() => setCoordList(coordList.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={saveBatchCoordination} className="w-full bg-[#eadcba] text-[#1e293b] py-4 rounded-xl font-black uppercase text-xs shadow-sm border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px] mt-4 disabled:opacity-50">Confirmar y Guardar Alertas</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCoordViewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-4xl md:h-auto md:max-h-[85vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 bg-[#eadcba] text-[#1e293b] flex justify-between items-center shrink-0 shadow-sm z-10"><div className="flex items-center gap-3"><LayoutList size={20}/><h2 className="text-lg font-black uppercase">Plan Maestro de Despacho</h2></div><button type="button" onClick={() => setShowCoordViewModal(false)} className="p-2 bg-black/5 rounded-xl hover:bg-black/10 transition-all">✕</button></div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coordinationAlerts.map(alertItem => (
                  <div key={alertItem.id} className="theme-bg-main p-5 rounded-[1.5rem] border-[3px] border-red-500/30 relative">
                     {supervisorProfile?.area === "Administrador / Todos" && (
                         <button type="button" onClick={() => deleteAlert(alertItem.id)} className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={16}/></button>
                     )}
                     <span className="text-lg font-black text-red-500 uppercase block leading-none pr-8">Ped: {alertItem.pedidoNum}</span>
                     <h4 className="text-sm font-black text-[#a1bdc2] uppercase mt-1 truncate">{alertItem.cliente}</h4>
                     <div className="mt-4 p-3 bg-[#1e293b] rounded-xl border border-[#4a5c70]"><span className="text-[8px] font-black theme-text-muted uppercase block tracking-widest">Compromiso</span><p className="text-base font-black flex items-center gap-2 mt-0.5 text-[#eadcba]"><Calendar size={16} /> {formatLocalDate(alertItem.fechaEntrega)}</p></div>
                  </div>
                ))}
                {coordinationAlerts.length === 0 && <p className="col-span-full text-center p-10 font-black uppercase text-[#a1bdc2]/50">No hay alertas logísticas activas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header flex justify-between items-center border-b theme-border"><h2 className="font-black uppercase text-base text-[#a1bdc2]">Reporte de Turno</h2><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-black/10 rounded-xl text-[#a1bdc2]">✕</button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Supervisor</label><select value={repSupervisor} onChange={e=>setRepSupervisor(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs uppercase outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2]"><option value="">Seleccione...</option>{SUPERVISORES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Fecha Operativa</label><input type="date" value={repDate} onChange={e=>setRepDate(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2]" /></div>
              <button type="button" onClick={generateShiftReport} className="w-full bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-xs py-4 rounded-xl border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px] mt-2">Generar Vista Previa</button>
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
                <button type="button" onClick={() => { try { window.print(); } catch(e) { } }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm border-b-[3px] border-blue-800 active:border-b-0 active:translate-y-[3px] flex items-center gap-2"><Printer size={14}/> Imprimir</button>
                <button type="button" onClick={() => setShowReportPreviewModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-800 rounded-xl font-black uppercase text-[10px] border-b-[3px] border-slate-300 active:border-b-0 active:translate-y-[3px]">Cerrar</button>
              </div>
            </div>
            <div className="border-2 border-slate-900 p-6 md:p-10 bg-white print:border-0 print:p-0 text-xs">
              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
                <div><h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">Reporte de Turno</h1><h2 className="text-sm font-bold uppercase text-slate-500 mt-1">CDI EXHIBICIONES</h2></div>
                <div className="text-right text-slate-900"><p className="text-[10px] font-black uppercase">Sup: {repSupervisor}</p><p className="text-[10px] font-black uppercase">Fecha: {repDate}</p></div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px] text-slate-900 text-[10px]">
                  <thead><tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                    <th className="p-2 font-black uppercase border border-slate-700 w-12">Hora</th><th className="p-2 font-black uppercase border border-slate-700 w-20">Pedido</th><th className="p-2 font-black uppercase border border-slate-700 w-20">Artículo</th><th className="p-2 font-black uppercase border border-slate-700">Producto</th><th className="p-2 font-black uppercase border border-slate-700">Actividad</th><th className="p-2 font-black uppercase border border-slate-700 w-20">Operario</th>
                  </tr></thead>
                  <tbody>{generatedReportData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-300">
                      <td className="p-2 font-bold border-x border-slate-300">{item.time.substring(0,5)}</td><td className="p-2 font-black text-red-700 border-x border-slate-300">{item.orderOC}</td><td className="p-2 font-black text-blue-700 border-x border-slate-300">{item.codArticulo}</td><td className="p-2 font-bold border-x border-slate-300 truncate max-w-[150px]">{item.orderName}</td><td className="p-2 italic border-x border-slate-300">{item.actividad}: {item.nota}</td><td className="p-2 font-bold border-x border-slate-300">{item.operario}</td>
                    </tr>
                  ))}
                  {generatedReportData.length === 0 && <tr><td colSpan="6" className="p-6 text-center font-black uppercase text-slate-400 border border-slate-200">Sin actividades registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Oswald:wght@700&display=swap');
        
        :root, [data-theme="light"] {
            --bg-main: #f1f5f9; --bg-card: #ffffff; --bg-header: #e2e8f0; --bg-input: #f8fafc; --text-main: #0f172a; --text-muted: #475569; --border-color: #cbd5e1;
        }
        [data-theme="dark"] {
            --bg-main: #2b3746; --bg-card: #374657; --bg-header: #222c39; --bg-input: #1e293b; --text-main: #f8fafc; --text-muted: #a1bdc2; --border-color: #4a5c70;
        }

        .theme-bg-main { background-color: var(--bg-main); color: var(--text-main); }
        .theme-bg-card { background-color: var(--bg-card); color: var(--text-main); }
        .theme-bg-header { background-color: var(--bg-header); color: var(--text-main); }
        .theme-bg-input { background-color: var(--bg-input); color: var(--text-main); }
        .theme-border { border-color: var(--border-color); }
        .theme-text-muted { color: var(--text-muted); }

        body, input, button, select, textarea { font-family: 'Montserrat', sans-serif !important; }
        body { background-color: var(--bg-main); color: var(--text-main); }
        
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: inline-block; animation: marquee 20s linear infinite; }
        
        @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 50% { box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.4); } }
        .animate-pulse-red { animation: pulse-red 2s infinite; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
      `}</style>
    </div>
  );
}