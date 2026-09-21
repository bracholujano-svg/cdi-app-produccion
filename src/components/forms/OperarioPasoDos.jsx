import React, { useState } from 'react';
import { Layers, Droplet, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const OperarioPasoDos = ({ colorBorradorId, onClose, onGuardarExitoso }) => {
  const [formData, setFormData] = useState({
    // 1. Base y Sustrato
    sustrato_muestra: 'MDF crudo lijado',
    base_tipo: 'Poliuretano Blanco',
    base_color: 'Blanco',
    base_manos: '2 Manos',
    base_catalizador_tipo: 'CAT-PU-Estandar',
    base_catalizador_pct: '50',
    base_disolvente_pct: '20',
    
    // 2. Color / Acabado
    catalizador_tipo: 'CAT-50',
    catalizador_pct: '50',
    disolvente_tipo: 'PU Estándar',
    disolvente_pct: '15',
    porcentaje_pasta_mateante: '0',
    procedimiento_preparacion: 'Lijado grano 220, aplicación de fondo y color.',
    
    // 3. Resultado
    tolerancia_delta_e: '0.8'
  });
  const [imagenMuestra, setImagenMuestra] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };

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
             fondo: {
                tipo: formData.base_tipo,
                color: formData.base_color,
                manos: formData.base_manos,
                catalizador: `${formData.base_catalizador_pct}% (${formData.base_catalizador_tipo})`,
                disolvente: `${formData.base_disolvente_pct}%`
             },
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
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera */}
        <header className="bg-slate-900 text-white p-4 md:p-5 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Paso 2 de 2</span>
            </div>
            <h2 className="text-lg font-bold mt-1">Declaración de Muestra Física</h2>
            <p className="text-xs text-slate-400">Parámetros reales de aplicación del fondo, color y medición.</p>
          </div>
        </header>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 overflow-y-auto custom-scroll flex-grow">
          
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 mb-6">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-xs text-blue-800 leading-relaxed">
              La fórmula fue guardada exitosamente. Para solicitar la aprobación de esta muestra, declare los detalles del <strong>fondo aplicado</strong>, la mezcla del <strong>color</strong>, y adjunte la evidencia colorimétrica.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* COLUMNA IZQUIERDA: Sustrato y Base */}
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2">
                <Layers size={16} className="text-slate-500"/> 1. Preparación de Base / Fondo
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Material de la Muestra</label>
                  <input type="text" name="sustrato_muestra" value={formData.sustrato_muestra} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" placeholder="Ej: MDF, Metal, Madera..." />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tipo de Base</label>
                  <select name="base_tipo" value={formData.base_tipo} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none">
                    <option value="Poliuretano Blanco">Poliuretano Blanco</option>
                    <option value="Base Catalizada">Base Catalizada</option>
                    <option value="Primer Automotriz">Primer Automotriz</option>
                    <option value="Madera Directa (Sellador)">Mera Madera (Sellador)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Color de Base</label>
                  <input type="text" name="base_color" value={formData.base_color} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" placeholder="Ej: Blanco, Gris Oscuro..." />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Acabado de Base</label>
                  <select name="base_manos" value={formData.base_manos} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none">
                    <option value="1 Mano">1 Mano</option>
                    <option value="2 Manos">2 Manos</option>
                    <option value="3 Manos">3 Manos</option>
                  </select>
                </div>

                <div className="col-span-2 grid grid-cols-3 gap-2 p-3 bg-slate-100 rounded-lg border border-slate-200">
                    <div className="col-span-3"><span className="text-[10px] font-bold text-slate-500 uppercase">Mezcla de la Base</span></div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Catalizador</label>
                      <input type="text" name="base_catalizador_tipo" value={formData.base_catalizador_tipo} onChange={handleChange} className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" placeholder="Ref/Marca" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">% Cat.</label>
                      <input type="number" name="base_catalizador_pct" value={formData.base_catalizador_pct} onChange={handleChange} className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">% Disolv.</label>
                      <input type="number" name="base_disolvente_pct" value={formData.base_disolvente_pct} onChange={handleChange} className="w-full px-2 py-1.5 rounded border border-slate-300 text-xs focus:border-blue-500 outline-none" />
                    </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Mezcla de Color y Resultado */}
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2">
                <Droplet size={16} className="text-slate-500"/> 2. Mezcla de Color (Pintura Final)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Pasta Mateante (Si aplica)</label>
                   <input type="number" name="porcentaje_pasta_mateante" value={formData.porcentaje_pasta_mateante} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Catalizador Color</label>
                  <input type="text" name="catalizador_tipo" value={formData.catalizador_tipo} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" placeholder="Ref" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Cat. Color</label>
                  <input type="number" name="catalizador_pct" value={formData.catalizador_pct} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Disolvente Color</label>
                  <input type="text" name="disolvente_tipo" value={formData.disolvente_tipo} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" placeholder="Ref" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">% Disolv. Color</label>
                  <input type="number" name="disolvente_pct" value={formData.disolvente_pct} onChange={handleChange} className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2 pt-4">
                <Camera size={16} className="text-slate-500"/> 3. Evidencia Colorimétrica
              </h3>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Resultado (ΔE Real)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-600">ΔE =</span>
                    <input type="text" name="tolerancia_delta_e" value={formData.tolerancia_delta_e} onChange={handleChange} className="w-full pl-10 pr-3 py-2 rounded-lg bg-emerald-50 border border-emerald-300 text-sm font-bold text-emerald-800 focus:border-emerald-500 outline-none" placeholder="0.8" required />
                  </div>
                </div>
                
                <div className="flex-1">
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-blue-400 rounded-lg h-[68px] hover:bg-blue-50 transition-colors bg-white overflow-hidden relative">
                    {imagenMuestra ? (
                      <img src={imagenMuestra} alt="Muestra" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600 text-center px-2">Cargar Foto de la Lectura</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

            </div>
          </div>
          
          <div className="mt-6">
             <label className="block text-xs font-semibold text-slate-600 mb-1">Observaciones / Procedimiento Adicional</label>
             <textarea name="procedimiento_preparacion" value={formData.procedimiento_preparacion} onChange={handleChange} rows="2" className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:border-blue-500 outline-none resize-none" placeholder="Describa brevemente detalles adicionales..."></textarea>
          </div>

          {/* Botones de acción */}
          <div className="pt-6 mt-4 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3 sticky bottom-0 bg-white shadow-[0_-20px_20px_-10px_rgba(255,255,255,0.9)]">
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
