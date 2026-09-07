import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Beaker, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import EtpCopilotForm from '../forms/EtpCopilotForm';

export default function EtpSupervisorDashboard({ supervisorProfile }) {
    const [pendientes, setPendientes] = useState([]);
    const [selectedColor, setSelectedColor] = useState(null);

    useEffect(() => {
        fetchPendientes();

        const channel = supabase
            .channel('etp_pendientes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colores_aprobados', filter: "estado_aprobacion=eq.'pendiente_revision'" }, payload => {
                fetchPendientes();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchPendientes = async () => {
        try {
            const { data, error } = await supabase
                .from('colores_aprobados')
                .select('*')
                .eq('estado_aprobacion', 'pendiente_revision')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setPendientes(data || []);
        } catch (err) {
            console.error("Error fetching ETP pendientes", err);
        }
    };

    const handleAprobar = async (etpData) => {
        try {
            const { error } = await supabase.from('colores_aprobados')
                .update({
                    sustrato_muestra: etpData.textoPreparacion,
                    tolerancia_delta_e: etpData.deltaE,
                    catalizador_tipo: etpData.catalizador,
                    disolvente_tipo: etpData.disolvente,
                    procedimiento_preparacion: {
                        preparacion: etpData.textoPreparacion,
                        fondo: etpData.textoFondo,
                        color: etpData.textoColor,
                        acabado: etpData.textoAcabado
                    },
                    aprobado_por_id: supervisorProfile?.id || null,
                    estado_aprobacion: 'aprobado_produccion'
                })
                .eq('id', selectedColor.id);
            
            if (error) throw error;
            alert("✅ ETP Aprobada y liberada para producción.");
            setSelectedColor(null);
            fetchPendientes();
        } catch (err) {
            alert("Error al aprobar: " + err.message);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-black theme-text-main mb-6 flex items-center gap-3">
                <Beaker className="w-8 h-8 text-blue-500" />
                Auditoría ETP (Pintura Líquida)
            </h1>

            {!selectedColor ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 theme-text-main">
                        <AlertCircle className="w-6 h-6 text-orange-500" />
                        Nuevos Colores Pendientes de Aprobación ({pendientes.length})
                    </h2>
                    
                    {pendientes.length === 0 ? (
                        <div className="text-center py-10">
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
                            <p className="text-lg theme-text-muted">No hay fórmulas pendientes de revisión.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendientes.map(color => (
                                <div key={color.id} onClick={() => setSelectedColor(color)} className="p-5 border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 rounded-2xl cursor-pointer hover:shadow-md transition-all">
                                    <h3 className="font-black text-lg theme-text-main">{color.codigo_objetivo}</h3>
                                    <p className="text-sm theme-text-muted">Sistema: {color.sistema_color}</p>
                                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-3 font-bold bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md inline-block">Requiere Auditoría Técnica</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative">
                    <button onClick={() => setSelectedColor(null)} className="mb-4 flex items-center gap-2 text-blue-500 hover:text-blue-600 font-bold">
                        &larr; Volver a la lista
                    </button>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl relative border border-slate-200 dark:border-slate-800 p-6">
                        <div className="mb-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black theme-text-main uppercase">Auditar ETP: {selectedColor.codigo_objetivo}</h2>
                                <p className="theme-text-muted">Revise los parámetros enviados por el formulador o ejecute el análisis IA para obtener sugerencias del fabricante.</p>
                            </div>
                        </div>
                        <EtpCopilotForm 
                            colorId={selectedColor.id}
                            initialData={selectedColor}
                            isSupervisorView={true}
                            onCancel={() => setSelectedColor(null)}
                            onSave={handleAprobar}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
