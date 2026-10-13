import React, { useState, useRef } from 'react';
import { Plus, Camera, Image as ImageIcon, Loader2, AlertCircle, CheckCircle, Package, Layers, Calendar, User, FileText, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';
import { analizarCajetinConIA } from '../../services/cajetinScannerService';

const AddOrderModal = ({ createOrder, createBulkOrders }) => {
  const { 
    showAddModal, 
    setShowAddModal, 
    duplicateError, 
    setDuplicateError,
    supervisorProfile 
  } = useAppContext();

  const fileInputRef = useRef(null);

  // Estados del Escáner de Cajetines
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [scannedImage, setScannedImage] = useState(null);

  // Estados del Formulario de Revisión Humana
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

  const handleFileCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError('');
    setScanSuccess('');
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setScannedImage(base64);

      try {
        // Tarea 3: Extracción Lógica con IA de Visión y System Prompt Estricto
        const extracted = await analizarCajetinConIA(base64);

        // Parsear fecha DD/MM/AAAA a formato input YYYY-MM-DD si aplica
        let parsedDate = '';
        if (extracted.FECHA_DE_ENTREGA) {
          const parts = String(extracted.FECHA_DE_ENTREGA).split('/');
          if (parts.length === 3) {
            const [d, m, y] = parts;
            parsedDate = `${y.padStart(4, '20')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else {
            parsedDate = extracted.FECHA_DE_ENTREGA;
          }
        }

        // Tarea 4: Auto-rellenado de campos en el formulario de revisión humana
        setFormData(prev => ({
          ...prev,
          codArticulo: extracted.codigo_producto || '',
          nombre: extracted.nombre_producto || '',
          requisicion: extracted.REQUISICION || '',
          ordenProduccion: extracted.ORDEN_DE_PRODUCCION || '',
          pedidoNum: extracted.ORIGEN || '',
          cliente: extracted.CLIENTE || '',
          cantidad: extracted.CANT_TOTAL || 1,
          acabado: extracted.ACABADO || '',
          fechaEntrega: parsedDate || extracted.FECHA_DE_ENTREGA || '',
          entregaPersona: prev.entregaPersona || supervisorProfile?.name || ''
        }));

        setScanSuccess('✅ Cajetín analizado exitosamente con IA. Verifica y edita los campos antes de guardar.');
      } catch (err) {
        console.error("Error al analizar cajetín:", err);
        setScanError(`Error al procesar cajetín: ${err.message || 'No se pudo leer la imagen'}. Puedes ingresar los datos manualmente.`);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="theme-bg-card w-full h-full md:max-w-5xl md:max-h-[92vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
        
        {/* Cabecera del Modal */}
        <div className="p-4 md:p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--color-primary)]/20 rounded-xl text-[var(--color-primary)]">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black uppercase flex items-center gap-2 theme-text-main">
                Nuevo Pedido / Escáner de Cajetín
              </h2>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Modo Standalone Planta</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => { 
              setShowAddModal(false); 
              setScannedImage(null);
              setScanError('');
              setScanSuccess('');
              if (setDuplicateError) setDuplicateError('');
            }} 
            className="p-2.5 bg-black/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors theme-text-main"
          >
            ✕
          </button>
        </div>

        {/* Contenedor con Scroll */}
        <div className="overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
          
          {/* TAREA 2: Flujo de Captura con Escáner Visual (Cámara / Foto) */}
          <div className="bg-[var(--color-surface)] p-5 rounded-2xl border border-[var(--color-border)] shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl border border-indigo-500/20">
                  <Camera size={26} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase theme-text-main tracking-wide">
                    Escaneo Óptico de Plano Físico
                  </h3>
                  <p className="text-xs font-medium theme-text-muted mt-0.5">
                    Toma una foto clara del cajetín para extraer automáticamente cliente, código, nombre, RQ y acabados.
                  </p>
                </div>
              </div>

              {/* Input Cámara Oculto */}
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={fileInputRef}
                onChange={handleFileCapture} 
                className="hidden" 
              />

              {/* Botón Prominente de Escaneo */}
              <button 
                type="button" 
                disabled={isAnalyzing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs md:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Analizando cajetín con IA...</span>
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    <span>📷 Escanear Plano Físico</span>
                  </>
                )}
              </button>
            </div>

            {/* Mensajes de Estado del Escáner */}
            {isAnalyzing && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                <Loader2 size={20} className="animate-spin shrink-0" />
                <p className="text-xs font-bold uppercase tracking-wider">
                  Analizando cajetín con IA... Extrayendo especificaciones y codificación.
                </p>
              </div>
            )}

            {scanError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold">{scanError}</p>
              </div>
            )}

            {scanSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={18} className="shrink-0" />
                <p className="text-xs font-bold">{scanSuccess}</p>
              </div>
            )}

            {/* Previsualización del Cajetín Capturado */}
            {scannedImage && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black/20 flex-shrink-0">
                    <img src={scannedImage} alt="Cajetín escaneado" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                      Foto de Cajetín Registrada
                    </span>
                    <span className="text-[10px] theme-text-muted">
                      Compara los valores del formulario con tu plano físico.
                    </span>
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-indigo-500 hover:text-indigo-600 underline"
                >
                  Cambiar / Repetir Foto
                </button>
              </div>
            )}
          </div>

          {duplicateError && (
            <div className="bg-rose-500/10 border border-rose-500 text-rose-600 p-3 rounded-xl text-xs font-black uppercase flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0" /> {duplicateError}
            </div>
          )}

          {/* TAREA 4: Pantalla de Revisión Humana (Auto-Completado y Edición Manual) */}
          <form id="nuevoRegistroForm" onSubmit={createOrder} className="space-y-4">
            
            <div className="border-b border-[var(--color-border)] pb-2 flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider theme-text-main flex items-center gap-2">
                <FileText size={16} className="text-indigo-500" />
                Revisión y Confirmación de Datos del Producto
              </h4>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                Editable por Supervisor
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Código de Producto (Extraído solo la serie de números inicial) */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Código de Producto (Ítem) *
                </label>
                <input 
                  name="codArticulo" 
                  required 
                  value={formData.codArticulo}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
                  placeholder="Ej. 33009813..." 
                />
              </div>

              {/* Nombre de Producto (Texto alfabético posterior) */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Nombre del Producto / Artículo *
                </label>
                <input 
                  name="nombre" 
                  required 
                  value={formData.nombre}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
                  placeholder="Ej. TRESTLETABLE3..." 
                />
              </div>

              {/* Requisición (Código RQ) */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center gap-1">
                  Requisición (RQ) *
                </label>
                <input 
                  name="requisicion" 
                  value={formData.requisicion}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary text-indigo-600 dark:text-indigo-400" 
                  placeholder="Ej. RQ00215165" 
                />
              </div>

              {/* Orden de Producción (Solo si existe OP explícito) */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Orden de Producción (OP)
                </label>
                <input 
                  name="ordenProduccion" 
                  value={formData.ordenProduccion}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
                  placeholder="(Opcional si es distinta al RQ)" 
                />
              </div>

              {/* Origen (Nº Pedido) */}
              <div className="space-y-1">
                <label className="text-xs font-black theme-text-muted uppercase ml-1">
                  Nº Pedido / Origen *
                </label>
                <input 
                  name="pedidoNum" 
                  required 
                  value={formData.pedidoNum}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
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
                  className="w-full p-3 theme-bg-input rounded-xl font-black uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
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
                  className="w-full p-3 theme-bg-input rounded-xl font-black text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary text-center" 
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
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-sm border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
                />
              </div>

              {/* Acabado (Materiales y Colores - Crítico) */}
              <div className="space-y-1 md:col-span-2 lg:col-span-3">
                <label className="text-xs font-black theme-text-muted uppercase ml-1 flex items-center justify-between">
                  <span>Acabado / Materiales y Colores (Crítico)</span>
                  <span className="text-[10px] text-amber-600 font-bold">Verificar materiales y recubrimiento</span>
                </label>
                <textarea 
                  name="acabado" 
                  rows={2}
                  value={formData.acabado}
                  onChange={handleInputChange}
                  className="w-full p-3 theme-bg-input rounded-xl font-medium text-xs border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary resize-none uppercase" 
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
                  className="w-full p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs border outline-none shadow-sm cursor-pointer"
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
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
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
                  className="w-full p-3 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-indigo-500 theme-text-primary" 
                  placeholder="RESPONSABLE QUE RECIBE..." 
                />
              </div>

            </div>

            {/* Botón Definitivo de Guardado */}
            <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs theme-text-muted font-medium">
                * Al hacer clic, el producto se registrará en Supabase con los datos verificados.
              </p>
              
              <button 
                type="submit" 
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <span>💾 Guardar Producto en Base de Datos</span>
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
