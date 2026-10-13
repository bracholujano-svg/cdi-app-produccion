import React, { useState, useEffect } from 'react';
import { Truck, X, Calendar, User, FileText, CheckCircle2, AlertCircle, Shield, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function LogisticsDispatchModal({
  isOpen,
  orders = [],
  onClose,
  onConfirm
}) {
  const { supervisorProfile } = useAppContext();

  const [fechaDespacho, setFechaDespacho] = useState(() => new Date().toISOString().split('T')[0]);
  const [tipoTransporte, setTipoTransporte] = useState('Propio');
  const [empresaTransporte, setEmpresaTransporte] = useState('');
  const [nombreChofer, setNombreChofer] = useState('');
  const [cedulaChofer, setCedulaChofer] = useState('');
  const [placaMarca, setPlacaMarca] = useState('');
  const [precintoSeguridad, setPrecintoSeguridad] = useState('');
  const [guiaRemesa, setGuiaRemesa] = useState('');
  const [autorizadoPor, setAutorizadoPor] = useState(supervisorProfile?.name || '');
  const [nota, setNota] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFechaDespacho(new Date().toISOString().split('T')[0]);
      setAutorizadoPor(supervisorProfile?.name || '');
      setErrorMsg('');
    }
  }, [isOpen, supervisorProfile]);

  if (!isOpen || !orders || orders.length === 0) return null;

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
      guiaRemesa: guiaRemesa.trim()
    };

    if (onConfirm) {
      onConfirm({
        ids: orders.map(o => o.id),
        date: fechaDespacho,
        logisticaData,
        supervisor: autorizadoPor.trim().toUpperCase() || supervisorProfile?.name || 'SUPERVISOR DESPACHOS',
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
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black uppercase text-white tracking-tight">
                  Registrar Despacho Logístico
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/30 border border-purple-400/40 text-purple-200 text-xs font-black uppercase">
                  Salida de Planta
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

        {/* Resumen de Productos */}
        <div className="px-5 py-3 bg-[var(--color-base)] border-b theme-border flex items-center justify-between text-xs">
          <span className="font-bold theme-text-muted uppercase flex items-center gap-1.5">
            <Package size={14} className="text-purple-500" /> 
            Destino del Lote: <strong className="theme-text-main">Área Despachos</strong>
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
                  onChange={e => setFechaDespacho(e.target.value)}
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
                onChange={e => setTipoTransporte(e.target.value)}
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
                onChange={e => setEmpresaTransporte(e.target.value)}
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
                onChange={e => { setNombreChofer(e.target.value); setErrorMsg(''); }}
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
                onChange={e => setCedulaChofer(e.target.value)}
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
                onChange={e => setPlacaMarca(e.target.value)}
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
                onChange={e => setPrecintoSeguridad(e.target.value)}
                placeholder="Ej. PREC-98471"
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

            {/* Guía o Remesa */}
            <div>
              <label className="text-xs font-black uppercase theme-text-muted block mb-1">
                Nº de Guía de Remisión / Remesa
              </label>
              <input 
                type="text"
                value={guiaRemesa}
                onChange={e => setGuiaRemesa(e.target.value)}
                placeholder="Ej. GR-2026-00421"
                className="w-full p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-sm outline-none theme-text-main placeholder:theme-text-muted/50"
              />
            </div>

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
                onChange={e => setAutorizadoPor(e.target.value)}
                placeholder="Nombre del supervisor"
                className="bg-transparent outline-none w-full theme-text-main font-bold"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-xs font-black uppercase theme-text-muted block mb-1">
              Observaciones de Entrega en Muelle
            </label>
            <textarea 
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Detalles sobre el embalaje, condiciones de carga o instrucciones al transportista..."
              className="w-full p-3 rounded-xl theme-bg-input border theme-border font-medium text-xs sm:text-sm h-20 outline-none theme-text-main placeholder:theme-text-muted/50"
            />
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
