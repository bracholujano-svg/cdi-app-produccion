import React, { useState, useRef } from 'react';
import { 
  Plus, 
  Camera, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Package, 
  FileText, 
  ArrowRight, 
  Search, 
  Database, 
  Sparkles 
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';
import { analizarCajetinConGemini } from '../../services/cajetinScannerService';

const AddOrderModal = ({ createOrder, createBulkOrders, doExcelSearch }) => {
  const { 
    showAddModal, 
    setShowAddModal, 
    duplicateError, 
    setDuplicateError,
    supervisorProfile,
    excelSearchPedido, 
    setExcelSearchPedido, 
    excelSearchArticulo, 
    setExcelSearchArticulo,
    excelSearchLoading, 
    excelSearchError, 
    excelSearchSuccess, 
    setExcelSearchSuccess,
    showSearchSelector, 
    setShowSearchSelector, 
    searchResults, 
    setSearchResults
  } = useAppContext();

  const fileInputRef = useRef(null);

  // Sistema de Pestañas Duales (Opción por defecto: Buscar en Base de Datos)
  const [activeTab, setActiveTab] = useState('database'); // 'database' | 'scanner'

  // Estados del Escáner de Cajetines (Gemini Vision)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusText, setScanStatusText] = useState('');
  const [scanError, setScanError] = useState('');
  const [scanWarning, setScanWarning] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [scannedImage, setScannedImage] = useState(null);

  // Estados del Formulario Unificado de Revisión Humana
  const [formData, setFormData] = useState({
    nombre: '',
    codArticulo: '',
    requisicion: '',
    ordenProduccion: '',
    pedidoNum: '',
    cliente: '',
    cantidad: 1,
    acabado: '',
    fechaEntrega: '',
    areaRecibe: AREAS_RECEPCION[0] || 'CORTE',
    entregaPersona: supervisorProfile?.name || '',
    recibePersona: ''
  });

  if (!showAddModal) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Rellenar formulario a partir de un resultado de búsqueda de Supabase/Ribisoft (Tab 1)
  const fillFormWithResult = (res) => {
    setFormData(prev => ({
      ...prev,
      pedidoNum: res.pedido || '',
      codArticulo: res.articulo || '',
      cliente: res.cliente || '',
      nombre: res.nombre || res.descripcion || '',
      cantidad: res.cantidad || 1
    }));
  };

  // Ejecuta la consulta real a Supabase (doExcelSearch en App.jsx) desde el botón o con Enter
  const handleDatabaseSearch = async () => {
    if (excelSearchLoading || typeof doExcelSearch !== 'function') return;
    const results = await doExcelSearch();
    if (Array.isArray(results) && results.length === 1) {
      fillFormWithResult(results[0]);
      setExcelSearchSuccess(`✅ Extraído: ${results[0].nombre || results[0].descripcion || ''} (Pedido ${results[0].pedido || ''})`);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDatabaseSearch();
    }
  };

  // Captura y análisis con Gemini Multimodal (Tab 2)
  const handleFileCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError('');
    setScanSuccess('');
    setScanWarning('');
    setScanProgress(10);
    setScanStatusText('Comprimiendo imagen...');
    setIsAnalyzing(true);

    try {
      const extracted = await analizarCajetinConGemini(file, (progress, status) => {
        setScanProgress(progress);
        if (status) setScanStatusText(status);
      });

      if (extracted.compressedDataUrl) {
        setScannedImage(extracted.compressedDataUrl);
      }

      setFormData(prev => ({
        ...prev,
        codArticulo: extracted.codigo_producto || prev.codArticulo,
        nombre: extracted.nombre_producto || prev.nombre,
        requisicion: extracted.requisicion_rq || prev.requisicion,
        ordenProduccion: extracted.seccion || prev.ordenProduccion,
        pedidoNum: extracted.origen_pedido || prev.pedidoNum,
        cliente: extracted.cliente || prev.cliente,
        cantidad: extracted.cantidad || prev.cantidad || 1,
        acabado: extracted.acabado || prev.acabado,
        fechaEntrega: extracted.fecha_entrega || prev.fechaEntrega,
        entregaPersona: prev.entregaPersona || supervisorProfile?.name || ''
      }));

      if (extracted.fieldsFilledCount >= 3) {
        setScanSuccess('✅ Datos extraídos del plano con Gemini IA. Verifique y confirme las casillas antes de guardar.');
      } else if (extracted.fieldsFilledCount > 0) {
        setScanWarning('⚠️ Se extrajeron algunos datos del cajetín. Por favor complete las casillas restantes manualmente.');
      } else {
        setScanWarning('⚠️ No se reconocieron casillas legibles en el plano. Puede ingresar los datos manualmente a continuación.');
      }
    } catch (err) {
      console.error("Error al analizar cajetín:", err);
      setScanError(err.message || 'Error al procesar el cajetín con IA.');
    } finally {
      setIsAnalyzing(false);
      setScanProgress(0);
      setScanStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="theme-bg-card w-full h-full md:max-w-5xl md:max-h-[92vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
        
        {/* Cabecera del Modal */}
        <div className="p-4 md:p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--color-primary)]/20 rounded-xl text-[var(--color-primary)]">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black uppercase flex items-center gap-2 theme-text-main">
                Nuevo Registro / Ingreso a Planta
              </h2>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Sistema de Ingreso Dual</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => { 
              setShowAddModal(false); 
              setScannedImage(null);
              setScanError('');
              setScanWarning('');
              setScanSuccess('');
              if (setSearchResults) setSearchResults([]);
              if (setShowSearchSelector) setShowSearchSelector(false);
              if (setDuplicateError) setDuplicateError('');
            }} 
            className="p-2.5 bg-black/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors theme-text-main cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Barra de Pestañas (Tabs) Duales */}
        <div className="flex border-b border-[var(--color-border)] px-4 md:px-6 bg-black/5 dark:bg-white/5 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            className={`py-3 px-4 text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-surface)] shadow-sm'
                : 'border-transparent theme-text-muted hover:theme-text-main'
            }`}
          >
            <Database size={16} />
            <span>Buscar en Base de Datos</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`py-3 px-4 text-xs md:text-sm font-black uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'scanner'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-[var(--color-surface)] shadow-sm'
                : 'border-transparent theme-text-muted hover:theme-text-main'
            }`}
          >
            <Camera size={16} />
            <span>Escanear Plano (IA Gemini)</span>
          </button>
        </div>

        {/* Contenedor con Scroll */}
        <div className="overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
          
          {/* PESTAÑA 1: Búsqueda y Autocompletado de Supabase / Ribisoft */}
          {activeTab === 'database' && (
            <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[var(--color-primary)]/20 rounded-xl text-[var(--color-primary)]">
                  <Search size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase theme-text-main tracking-wide">
                    Puente Ribisoft / Supabase (Autocompletar)
                  </h3>
                  <p className="text-xs font-medium theme-text-muted">
                    Ingresa el número de pedido o artículo para traer los registros de producción existentes.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  value={excelSearchPedido || ''} 
                  onChange={e => setExcelSearchPedido(e.target.value)} 
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Nº PEDIDO" 
                  className="flex-1 p-3.5 theme-bg-card theme-text-primary rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] uppercase border theme-border" 
                />
                <input 
                  value={excelSearchArticulo || ''} 
                  onChange={e => setExcelSearchArticulo(e.target.value)} 
                  onKeyDown={handleSearchKeyDown}
                  placeholder="ÚLT. DÍGITOS ARTÍCULO" 
                  className="flex-1 p-3.5 theme-bg-card theme-text-primary rounded-xl font-black text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] uppercase border theme-border" 
                />
                <button 
                  type="button" 
                  onClick={handleDatabaseSearch} 
                  disabled={excelSearchLoading} 
                  className="bg-[var(--color-primary)] text-[var(--color-surface)] px-6 py-3.5 rounded-xl font-black text-sm uppercase shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {excelSearchLoading ? 'BUSCANDO...' : 'BUSCAR'}
                </button>
              </div>

              {excelSearchError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{excelSearchError}</span>
                </div>
              )}

              {excelSearchSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle size={16} className="shrink-0" />
                  <span>{excelSearchSuccess}</span>
                </div>
              )}

              {showSearchSelector && searchResults && searchResults.length > 0 && (
                <div className="mt-4 animate-in slide-in-from-top-2 space-y-3">
                  <button 
                    type="button" 
                    onClick={() => {
                      const areaIni = formData.areaRecibe;
                      const entrega = formData.entregaPersona;
                      const recibe = formData.recibePersona;
                      createBulkOrders(searchResults, areaIni, entrega, recibe);
                    }}
                    className="w-full p-3.5 bg-[var(--color-primary)] text-[var(--color-surface)] rounded-xl font-black uppercase text-sm hover:brightness-110 active:scale-95 transition-all flex justify-center items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Package size={18} />
                    CARGAR EL PEDIDO COMPLETO ({searchResults.length} PRODUCTOS)
                  </button>

                  <div className="p-3 bg-[var(--color-base)] rounded-xl border border-[var(--color-border)] max-h-56 overflow-y-auto space-y-2 custom-scrollbar text-left">
                    <p className="text-xs font-black theme-text-main uppercase tracking-wider mb-2">
                      O selecciona un producto individual para rellenar el formulario:
                    </p>
                    {searchResults.map((res, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => {
                          fillFormWithResult(res);
                          setShowSearchSelector(false);
                          setExcelSearchSuccess(`✅ Seleccionado: ${res.nombre || res.descripcion || ''} (Pedido ${res.pedido || ''})`);
                        }}
                        className="p-3 bg-[var(--color-surface)] hover:bg-[var(--color-primary)]/10 rounded-xl border border-[var(--color-border)] cursor-pointer transition-colors flex flex-col"
                      >
                        <div className="flex justify-between text-xs font-black uppercase theme-text-main">
                          <span>PEDIDO: {res.pedido || 'S/N'}</span>
                          <span>ART: {res.articulo || 'S/N'}</span>
                        </div>
                        <span className="text-sm font-bold theme-text-primary uppercase truncate mt-1">
                          {res.nombre || res.descripcion || 'Sin descripción'}
                        </span>
                        <span className="text-xs text-slate-400 uppercase mt-0.5">
                          CLIENTE: {res.cliente || 'S/N'} {res.cantidad ? `| CANT: ${res.cantidad}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA 2: Escaneo de Cajetín con IA Multimodal (Gemini) */}
          {activeTab === 'scanner' && (
            <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-sm space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-purple-500/10 text-purple-600 rounded-2xl border border-purple-500/20">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase theme-text-main tracking-wide flex items-center gap-2">
                      <span>Escáner de Cajetines con Gemini</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">Multimodal</span>
                    </h3>
                    <p className="text-xs font-medium theme-text-muted mt-0.5">
                      Toma o sube una foto del cajetín industrial para extraer automáticamente RQ, Código, Pedido, Cliente y Acabado.
                    </p>
                  </div>
                </div>

                {/* Input Cámara / Archivo Oculto */}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  ref={fileInputRef}
                  onChange={handleFileCapture} 
                  className="hidden" 
                />

                {/* Botón de Escaneo */}
                <button 
                  type="button" 
                  disabled={isAnalyzing}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full md:w-auto px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{scanStatusText || 'Analizando con Gemini...'} {scanProgress > 0 ? `(${scanProgress}%)` : ''}</span>
                    </>
                  ) : (
                    <>
                      <Camera size={18} />
                      <span>📷 Tomar Foto / Escanear</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mensajes de Estado del Escáner */}
              {isAnalyzing && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-3 text-purple-700 dark:text-purple-300">
                  <Loader2 size={20} className="animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider truncate">
                      {scanStatusText || 'Procesando plano con Gemini...'}
                    </p>
                    {scanProgress > 0 && (
                      <div className="w-full bg-purple-200/50 dark:bg-purple-950/50 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div 
                          className="bg-purple-600 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {scanError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {scanWarning && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-bold">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{scanWarning}</span>
                </div>
              )}

              {scanSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle size={18} className="shrink-0" />
                  <span>{scanSuccess}</span>
                </div>
              )}

              {/* Previsualización del Cajetín Capturado */}
              {scannedImage && (
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/20 shrink-0">
                      <img src={scannedImage} alt="Cajetín escaneado" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                        Imagen de Cajetín Registrada
                      </span>
                      <span className="text-[10px] theme-text-muted">
                        Comprueba y afina los campos en el formulario antes de guardar.
                      </span>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    Repetir / Cambiar Foto
                  </button>
                </div>
              )}
            </div>
          )}

          {duplicateError && (
            <div className="bg-rose-500/10 border border-rose-500 text-rose-600 p-3 rounded-xl text-xs font-black uppercase flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" /> {duplicateError}
            </div>
          )}

          {/* Formulario Unificado de Revisión Humana y Confirmación */}
          <form id="nuevoRegistroForm" onSubmit={createOrder} className="space-y-4">
            
            <div className="border-b border-[var(--color-border)] pb-2 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider theme-text-main flex items-center gap-2">
                <FileText size={16} className="text-[var(--color-primary)]" />
                Datos del Producto a Registrar
              </h4>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                Editable por Supervisor
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Código de Producto */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Código de Producto (Ítem) *
                </label>
                <input 
                  name="codArticulo" 
                  required 
                  value={formData.codArticulo}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="Ej. 33009813..." 
                />
              </div>

              {/* Nombre de Producto */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Nombre del Producto / Artículo *
                </label>
                <input 
                  name="nombre" 
                  required 
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="Ej. TRESTLETABLE3..." 
                />
              </div>

              {/* Requisición (Código RQ) */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Requisición (RQ)
                </label>
                <input 
                  name="requisicion" 
                  value={formData.requisicion}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary text-indigo-600 dark:text-indigo-400" 
                  placeholder="Ej. RQ00215165" 
                />
              </div>

              {/* Orden de Producción / Sección */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Orden de Prod. / Sección
                </label>
                <input 
                  name="ordenProduccion" 
                  value={formData.ordenProduccion}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="(Opcional)" 
                />
              </div>

              {/* Nº Pedido / Origen */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Nº Pedido / Origen *
                </label>
                <input 
                  name="pedidoNum" 
                  required 
                  value={formData.pedidoNum}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="Ej. 63918" 
                />
              </div>

              {/* Cliente */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Cliente / Proyecto *
                </label>
                <input 
                  name="cliente" 
                  required 
                  value={formData.cliente}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="NOMBRE DEL CLIENTE O PROYECTO..." 
                />
              </div>

              {/* Cantidad Total */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Cantidad a Producir (Total) *
                </label>
                <input 
                  name="cantidad" 
                  type="number" 
                  required 
                  min="1"
                  value={formData.cantidad}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary text-center" 
                  placeholder="1" 
                />
              </div>

              {/* Fecha de Entrega Prometida */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Fecha de Entrega
                </label>
                <input 
                  name="fechaEntrega" 
                  type="date"
                  value={formData.fechaEntrega}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                />
              </div>

              {/* Acabado (Materiales y Colores) */}
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center justify-between">
                  <span>Acabado / Materiales y Colores</span>
                  <span className="text-[10px] text-amber-600 font-bold">Verificar acabados de plano</span>
                </label>
                <textarea 
                  name="acabado" 
                  rows={2}
                  value={formData.acabado}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-medium text-xs border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary resize-none uppercase" 
                  placeholder="ESPECIFICACIONES DE MATERIALES, PINTURA, COLORES O TRATAMIENTOS..."
                />
              </div>

              {/* Área de Recepción Inicial */}
              <div className="space-y-1 md:col-span-2 lg:col-span-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Área de Recepción Inicial *
                </label>
                <select 
                  name="areaRecibe" 
                  value={formData.areaRecibe}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-[var(--color-primary)] hover:brightness-110 text-[var(--color-surface)] rounded-xl font-black uppercase text-xs border outline-none shadow-sm cursor-pointer"
                >
                  {AREAS_RECEPCION.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Quien Entrega */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Firma Entrega
                </label>
                <input 
                  name="entregaPersona" 
                  required 
                  value={formData.entregaPersona}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="SUPERVISOR QUE ENTREGA..." 
                />
              </div>

              {/* Quien Recibe */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Firma Recibe
                </label>
                <input 
                  name="recibePersona" 
                  required 
                  value={formData.recibePersona}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" 
                  placeholder="RESPONSABLE QUE RECIBE..." 
                />
              </div>

            </div>

            {/* Botón Definitivo de Guardado */}
            <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs theme-text-muted font-medium">
                * El pedido se registrará en la base de datos de producción con los datos confirmados.
              </p>
              
              <button 
                type="submit" 
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <span>INICIAR PRODUCCIÓN</span>
                <ArrowRight size={18} />
              </button>
            </div>

          </form>

        </div>
      </div>
    </div>
  );
};

export default AddOrderModal;
