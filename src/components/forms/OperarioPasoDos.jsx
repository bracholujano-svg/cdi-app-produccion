import React, { useState } from 'react';
import { Layers, Droplet, CheckCircle, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const OperarioPasoDos = ({ colorBorradorId, onClose, onGuardarExitoso }) => {
  // Estado local para los campos físicos aplicados por el operario
  const [formData, setFormData] = useState({
    sustrato_muestra: 'MDF crudo lijado',
    tolerancia_delta_e: '0.8',
    porcentaje_pasta_mateante: '0',
    catalizador_tipo: 'CAT-50',
    catalizador_pct: '50',
    disolvente_tipo: 'PU Estándar',
    disolvente_pct: '15',
    procedimiento_preparacion: 'Lijado grano 220, 2 manos base blanca.'
  });
  const [imagenMuestra, setImagenMuestra] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('colores_aprobados')
        .update({ 
           sustrato_muestra: formData.sustrato_muestra,
           tolerancia_delta_e: formData.tolerancia_delta_e,
           porcentaje_pasta_mateante: Number(formData.porcentaje_pasta_mateante) || 0,
           catalizador_tipo: `${formData.catalizador_pct}% (Ref: ${formData.catalizador_tipo})`,
           disolvente_tipo: `${formData.disolvente_pct}% (${formData.disolvente_tipo})`,
           procedimiento_preparacion: {
             preparacion: formData.procedimiento_preparacion,
             fondo: '',
             color: '',
             acabado: '',
             imagen_muestra: imagenMuestra
           },
           estado_aprobacion: 'pendiente_revision' 
        })
        .eq('id', colorBorradorId);
        
      if (error) throw error;

      setIsSubmitting(false);
      if (onGuardarExitoso) onGuardarExitoso();
    } catch (error) {
      console.error("Error al guardar:", error);
      setIsSubmitting(false);
      alert("Hubo un error al enviar a revisión.");
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Cabecera del Modal */}
        <header className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Paso 2 de 2</span>
            </div>
            <h2 className="text-lg font-bold mt-1">Declaración de Muestra Física</h2>
            <p className="text-xs text-slate-400">Complete los datos reales de aplicación para enviar a revisión.</p>
          </div>
        </header>

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scroll flex-grow space-y-6">
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-xs text-blue-800 leading-relaxed">
              La fórmula del entonador ha sido guardada como <strong>BORRADOR</strong>. Para notificar al supervisor y solicitar la aprobación para producción, debe declarar sobre qué sustrato y con qué parámetros aplicó la muestra que el colorímetro acaba de leer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Sección: Sustrato y Tolerancia */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2">
                <Layers size={14} className="text-slate-500"/> 1. Base y Medición
              </h3>
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sustrato de la Muestra (Real)</label>
                <select name="sustrato_muestra" value={formData.sustrato_muestra} onChange={handleChange} className="w-full px-3 py-2 rounded-md bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none">
                  <option value="MDF crudo lijado">MDF Crudo Lijado</option>
                  <option value="Base Blanca">Mera Base Blanca</option>
                  <option value="PU Blanco">Poliuretano Blanco</option>
                  <option value="Primer Gris">Primer Gris Claro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tolerancia (Delta E) del Colorímetro</label>
                <div className="relative">
                  <input type="number" step="0.1" name="tolerancia_delta_e" value={formData.tolerancia_delta_e} onChange={handleChange} className="w-full pl-3 pr-10 py-2 rounded-md bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none font-bold" />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">ΔE</span>
                </div>
              </div>
            </div>

            {/* Sección: Mezcla y Catálisis */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2">
                <Droplet size={14} className="text-slate-500"/> 2. Mezcla de Aplicación
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tipo Catalizador</label>
                  <input type="text" name="catalizador_tipo" value={formData.catalizador_tipo} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Catalizador</label>
                  <input type="number" name="catalizador_pct" value={formData.catalizador_pct} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tipo Disolvente</label>
                  <input type="text" name="disolvente_tipo" value={formData.disolvente_tipo} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Disolvente</label>
                  <input type="number" name="disolvente_pct" value={formData.disolvente_pct} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Pasta Mateante (Si aplica)</label>
                <input type="number" name="porcentaje_pasta_mateante" value={formData.porcentaje_pasta_mateante} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs focus:border-blue-500 outline-none" />
              </div>
            </div>
          </div>
          
          <div>
             <label className="block text-xs font-semibold text-slate-600 mb-1">Procedimiento de Preparación Utilizado</label>
             <textarea name="procedimiento_preparacion" value={formData.procedimiento_preparacion} onChange={handleChange} rows="2" className="w-full p-3 rounded-md bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none resize-none" placeholder="Describa brevemente cómo preparó la pieza..."></textarea>
          </div>

          {/* Botones de acción */}
          <div className="pt-4 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3 sticky bottom-0 bg-white p-4 -mx-6 -mb-6 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cerrar (Quedará en Borrador)
            </button>
            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
              {isSubmitting ? <span className="animate-pulse">Enviando...</span> : <><CheckCircle size={16} /> Enviar a Revisión de Supervisor</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OperarioPasoDos;
