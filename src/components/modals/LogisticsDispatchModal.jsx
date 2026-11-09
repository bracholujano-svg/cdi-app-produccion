import React, { useState, useEffect } from 'react';
import { Truck, X, Calendar, User, FileText, CheckCircle2, AlertCircle, Shield, Package, Printer } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import {
  LABEL_PAGE_PRESETS,
  printDispatchLabelsOrSheet,
  getNextPackingAndRemisionConsecutives
} from '../../utils/colorQrHelper';

export default function LogisticsDispatchModal({
  isOpen,
  orders = [],
  onClose,
  onConfirm
}) {
  const { supervisorProfile, packingLists, orders: allPlantOrders } = useAppContext();

  const [fechaDespacho, setFechaDespacho] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipoTransporte, setTipoTransporte] = useState('Propio');
  const [empresaTransporte, setEmpresaTransporte] = useState('');
  const [nombreChofer, setNombreChofer] = useState('');
  const [cedulaChofer, setCedulaChofer] = useState('');
  const [placaMarca, setPlacaMarca] = useState('');
  const [precintoSeguridad, setPrecintoSeguridad] = useState('');
  const [guiaRemesa, setGuiaRemesa] = useState('');
  const [numeroEmpaque, setNumeroEmpaque] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState(supervisorProfile?.name || '');
  const [nota, setNota] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Configuración de Impresión de Despachos (Térmica 100×80 vs Hoja Carta / A4 Láser)
  const [dispatchPaperPreset, setDispatchPaperPreset] = useState('100x80');
  const [dispatchOrientation, setDispatchOrientation] = useState('landscape');
  const [dispatchScalePct, setDispatchScalePct] = useState(100);
  const [autoPrintOnConfirm, setAutoPrintOnConfirm] = useState(true);

  useEffect(() => {
    if (isOpen && orders && orders.length > 0) {
      setFechaDespacho(new Date().toISOString().split('T')[0]);
      setAutorizadoPor(supervisorProfile?.name || '');
      setErrorMsg('');

      const firstOrd = orders[0] || {};
      const targetPed = firstOrd.pedidoNum || firstOrd.order_no || firstOrd.orden || '';
      const consec = getNextPackingAndRemisionConsecutives(
        packingLists,
        allPlantOrders || orders,
        targetPed
      );

      setGuiaRemesa(
        firstOrd.resumenEmpaque?.codigoRemision ||
          firstOrd.guia_despacho ||
          consec.codigoRemision ||
          'REM-0001'
      );
      setNumeroEmpaque(
        firstOrd.resumenEmpaque?.numeroEmpaque ||
          firstOrd.datos_logistica?.numeroEmpaque ||
          consec.numeroEmpaque ||
          'EMP-0001'
      );
    }
  }, [isOpen, supervisorProfile, orders, packingLists, allPlantOrders]);

  if (!isOpen || !orders || orders.length === 0) return null;

  const handlePrintDispatch = (dispatchMode = 'ETIQUETAS_DESPACHO', overridePreset = null) => {
    const presetToUse = overridePreset || dispatchPaperPreset;
    const first = orders[0] || {};
    printDispatchLabelsOrSheet(
      {
        order_no: first.pedidoNum || first.order_no || 'S/O',
        client_name: first.cliente || first.client_name || 'CLIENTE CDI',
        project_name: first.nombre_proyecto || first.project_name || 'DESPACHO PLANTA',
        remision: guiaRemesa.trim() || 'REM-0001',
        numero_empaque: numeroEmpaque.trim() || 'EMP-0001',
        carrier: empresaTransporte.trim() || tipoTransporte || 'Transporte CDI',
        plate: placaMarca.trim() || 'S/P',
        driver_name: nombreChofer.trim().toUpperCase() || 'CONDUCTOR AUTORIZADO',
        destination: first.cliente || 'CLIENTE CDI',
        receiver_name: first.cliente || 'CLIENTE CDI',
        observations: nota.trim(),
        dispatched_at: fechaDespacho,
        items: orders.map((o) => ({
          order_no: o.pedidoNum || o.order_no,
          item_code: o.codArticulo || o.item_code || 'S/C',
          part_description: o.nombre || o.part_description || 'PIEZA DESPACHADA',
          quantity: Number(o.cantidad || o.quantity || 1),
          area: 'DESPACHOS'
        }))
      },
      {
        dispatchMode,
        presetId: presetToUse,
        orientation:
          presetToUse === 'letter' || presetToUse === 'a4'
            ? dispatchMode === 'REMISION_DESPACHO'
              ? 'portrait'
              : dispatchOrientation
            : dispatchOrientation,
        scalePct: dispatchScalePct
      }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nombreChofer.trim()) {
      setErrorMsg('El nombre del chofer o responsable del transporte es obligatorio.');
      return;
    }

    const logisticaData = {
      tipoTransporte,
      empresaTransporte: empresaTransporte.trim(),
      nombreChofer: nombreChofer.trim().toUpperCase(),
      cedulaChofer: cedulaChofer.trim(),
      placaMarca: placaMarca.trim().toUpperCase(),
      precintoSeguridad: precintoSeguridad.trim(),
      guiaRemesa: guiaRemesa.trim() || 'REM-0001',
      numeroEmpaque: numeroEmpaque.trim() || 'EMP-0001'
    };

    if (autoPrintOnConfirm) {
      handlePrintDispatch('REMISION_DESPACHO', 'letter');
    }

    if (onConfirm) {
      onConfirm({
        ids: orders.map((o) => o.id),
        date: fechaDespacho,
        logisticaData,
        supervisor:
          autorizadoPor.trim().toUpperCase() ||
          supervisorProfile?.name ||
          'SUPERVISOR DESPACHOS',
        nota: nota.trim()
      });
    }
  };

  const totalUnidades = orders.reduce((sum, o) => sum + (parseInt(o.cantidad) || 1), 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="theme-bg-card w-full max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl border theme-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 sm:p-5 border-b theme-border flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-600/30">
              <Truck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black uppercase text-white tracking-tight">
                  Registrar Despacho Logístico
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/30 border border-sky-400/50 text-sky-200 text-xs font-black uppercase">
                  {guiaRemesa || 'REM-0001'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-black uppercase">
                  {numeroEmpaque || 'EMP-0001'}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {orders.length === 1
                  ? `Pedido #${orders[0]?.pedidoNum} — ${orders[0]?.nombre || ''} (${orders[0]?.cantidad || 1} und)`
                  : `${orders.length} productos seleccionados (${totalUnidades} unidades en total)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Cancelar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen de Productos y Consecutivos Automáticos */}
        <div className="px-5 py-3 bg-[var(--color-base)] border-b theme-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold theme-text-muted uppercase flex items-center gap-1.5">
            <Package size={14} className="text-purple-500" />
            Consecutivo Oficial:{' '}
            <strong className="theme-text-main">
              {guiaRemesa || 'REM-0001'} • {numeroEmpaque || 'EMP-0001'}
            </strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-black border border-amber-500/30">
            Pasa de "EN ESPERA" a "DESPACHADO"
          </span>
        </div>

        {/* Formulario Logístico */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bloque Destacado: Consecutivo Automático de Remisión y Número de Empaque */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/30 border-2 border-indigo-500/40 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-black uppercase text-sky-400 block mb-1">
                Código de Remisión (Consecutivo Automático) *
              </label>
              <input
                type="text"
                value={guiaRemesa}
                onChange={(e) => setGuiaRemesa(e.target.value.toUpperCase())}
                placeholder="REM-0001"
                className="w-full p-2.5 rounded-xl theme-bg-input border-2 border-sky-500/50 font-black text-sm outline-none theme-text-main uppercase"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-black uppercase text-amber-400 block mb-1">
                Número de Empaque (Consecutivo Automático) *
              </label>
              <input
                type="text"
                value={numeroEmpaque}
                onChange={(e) => setNumeroEmpaque(e.target.value.toUpperCase())}
                placeholder="EMP-0001"
                className="w-full p-2.5 rounded-xl theme-bg-input border-2 border-amber-500/50 font-black text-sm outline-none theme-text-main uppercase"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Fecha de Salida */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Fecha Oficial de Salida *
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm">
                <Calendar size={16} className="theme-text-muted" />
                <input
                  type="date"
                  value={fechaDespacho}
                  onChange={(e) => setFechaDespacho(e.target.value)}
                  className="bg-transparent outline-none w-full theme-text-main font-bold"
                  required
                />
              </div>
            </div>

            {/* Tipo de Transporte */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Tipo de Transporte *
              </label>
              <select
                value={tipoTransporte}
                onChange={(e) => setTipoTransporte(e.target.value)}
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-black text-sm outline-none theme-text-main cursor-pointer"
              >
                <option value="Propio">Vehículo Propio (CDI)</option>
                <option value="Contratado por CDI">Transporte Contratado por CDI</option>
                <option value="Cliente">Retira el Cliente</option>
              </select>
            </div>

            {/* Empresa de Transporte */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Empresa de Transporte
              </label>
              <input
                type="text"
                value={empresaTransporte}
                onChange={(e) => setEmpresaTransporte(e.target.value)}
                placeholder="Ej. Servientrega, Envia, Propia..."
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

            {/* Nombre del Chofer (Requerido) */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Nombre del Chofer / Transportista *
              </label>
              <input
                type="text"
                value={nombreChofer}
                onChange={(e) => {
                  setNombreChofer(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Nombre y apellido completo"
                className="w-full p-2.5 rounded-xl theme-bg-input border-2 border-purple-500/40 font-bold text-sm outline-none theme-text-main focus:border-purple-600 placeholder:theme-text-muted/50"
                required
              />
            </div>

            {/* Cédula del Chofer */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Cédula / Documento de Identidad
              </label>
              <input
                type="text"
                value={cedulaChofer}
                onChange={(e) => setCedulaChofer(e.target.value)}
                placeholder="Nº Cédula o Pasaporte"
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

            {/* Placa y Marca del Vehículo */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Placa y Marca del Vehículo
              </label>
              <input
                type="text"
                value={placaMarca}
                onChange={(e) => setPlacaMarca(e.target.value)}
                placeholder="Ej. WOB-456 Chevrolet NPR"
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

            {/* Precinto de Seguridad */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Nº Contenedor / Precinto de Seguridad
              </label>
              <input
                type="text"
                value={precintoSeguridad}
                onChange={(e) => setPrecintoSeguridad(e.target.value)}
                placeholder="Ej. PREC-98471"
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

            {/* Supervisor que autoriza */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Supervisor / Despachador que Autoriza Salida
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm">
                <User size={16} className="theme-text-muted" />
                <input
                  type="text"
                  value={autorizadoPor}
                  onChange={(e) => setAutorizadoPor(e.target.value)}
                  placeholder="Nombre del supervisor"
                  className="bg-transparent outline-none w-full theme-text-main font-bold"
                />
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-xs font-black uppercase theme-text-muted block mb-1">
              Observaciones de Entrega en Muelle
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Detalles sobre el embalaje, condiciones de carga o instrucciones al transportista..."
              className="w-full p-3 rounded-xl theme-bg-input border theme-border font-medium text-xs sm:text-sm h-16 outline-none theme-text-main placeholder:theme-text-muted/50"
            />
          </div>

          {/* Configuración de Impresión de Etiquetas de Despacho y Remisión (Con Logo CDI y Consecutivo) */}
          <div className="p-4 rounded-2xl bg-purple-950/20 border-2 border-purple-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase theme-text-main flex items-center gap-1.5">
                <Printer size={15} className="text-purple-500" />
                Impresión Oficial CDI ({guiaRemesa || 'REM-0001'} • {numeroEmpaque || 'EMP-0001'})
              </span>
              <label className="flex items-center gap-1.5 text-[11px] font-black theme-text-main cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrintOnConfirm}
                  onChange={(e) => setAutoPrintOnConfirm(e.target.checked)}
                  className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                />
                Imprimir Remisión de Empaque al confirmar salida
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label className="text-[11px] font-black uppercase theme-text-muted block mb-1">
                  Tamaño de Papel / Etiqueta:
                </label>
                <select
                  value={dispatchPaperPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDispatchPaperPreset(val);
                    const found = LABEL_PAGE_PRESETS.find((p) => p.id === val);
                    if (found?.defaultOrientation) setDispatchOrientation(found.defaultOrientation);
                  }}
                  className="w-full p-2 rounded-xl theme-bg-input border theme-border font-black text-xs theme-text-main cursor-pointer"
                >
                  <optgroup label="🏷️ Impresora Térmica (Etiquetas Pequeñas)">
                    {LABEL_PAGE_PRESETS.filter((p) => p.category === 'termica').map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📄 Impresora Láser Normal (Hoja Carta / A4)">
                    {LABEL_PAGE_PRESETS.filter((p) => p.category === 'hoja').map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-black uppercase theme-text-muted block mb-1">
                  Orientación:
                </label>
                <select
                  value={dispatchOrientation}
                  onChange={(e) => setDispatchOrientation(e.target.value)}
                  className="w-full p-2 rounded-xl theme-bg-input border theme-border font-black text-xs theme-text-main cursor-pointer"
                >
                  <option value="landscape">▭ Horizontal</option>
                  <option value="portrait">▯ Vertical</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-[11px] font-black uppercase theme-text-muted block mb-1">
                  Escala ({dispatchScalePct}%):
                </label>
                <input
                  type="number"
                  min={65}
                  max={150}
                  step={5}
                  value={dispatchScalePct}
                  onChange={(e) => setDispatchScalePct(Number(e.target.value) || 100)}
                  className="w-full p-2 rounded-xl theme-bg-input border theme-border font-black text-xs text-center theme-text-main"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handlePrintDispatch('ETIQUETAS_DESPACHO')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <Printer size={15} /> Imprimir Remisión de Paquete ({dispatchPaperPreset === 'letter' ? 'Hoja Carta' : dispatchPaperPreset})
              </button>
              <button
                type="button"
                onClick={() => handlePrintDispatch('REMISION_DESPACHO', dispatchPaperPreset === '100x80' ? 'letter' : dispatchPaperPreset)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow cursor-pointer"
              >
                <FileText size={15} /> Imprimir Remisión de Empaque (Carta / Láser)
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              className="sm:w-1/3 py-3.5 px-4 rounded-xl border theme-border font-black text-xs uppercase hover:bg-black/10 dark:hover:bg-white/10 transition-colors theme-text-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="sm:w-2/3 py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-95"
            >
              <Truck size={18} /> Confirmar Salida y Marcar como Despachado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
