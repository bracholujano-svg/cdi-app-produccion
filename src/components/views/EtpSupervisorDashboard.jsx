import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Beaker, AlertCircle, CheckCircle2, Search, X } from 'lucide-react';
import EtpCopilotForm from '../forms/EtpCopilotForm';
import CDILogo from '../ui/CDILogo';
import { validatePlantSubmissionText, sanitizeColorEtpPayload } from '../../utils/inputSecurity';

const ETP_PENDING_LIGHT_COLS = 'id, sistema_color, codigo_objetivo, color_hexadecimal, estado_aprobacion, created_at';

export default function EtpSupervisorDashboard({ supervisorProfile }) {
    const [pendientes, setPendientes] = useState([]);
    const [selectedColor, setSelectedColor] = useState(null);
    const [loadingDetailId, setLoadingDetailId] = useState(null);

    useEffect(() => {
        fetchPendientes();

        const channel = supabase
            .channel('etp_pendientes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colores_aprobados' }, payload => {
                if (payload.eventType === 'DELETE' && payload.old?.id) {
                    setPendientes(prev => prev.filter(c => c.id !== payload.old.id));
                    return;
                }
                const row = payload.new;
                if (!row?.id) return;
                const lightRow = {
                    id: row.id,
                    sistema_color: row.sistema_color,
                    codigo_objetivo: row.codigo_objetivo,
                    color_hexadecimal: row.color_hexadecimal,
                    estado_aprobacion: row.estado_aprobacion,
                    created_at: row.created_at
                };
                if (row.estado_aprobacion === 'pendiente_revision') {
                    setPendientes(prev => {
                        const exists = prev.some(c => c.id === row.id);
                        return exists
                            ? prev.map(c => (c.id === row.id ? lightRow : c))
                            : [lightRow, ...prev];
                    });
                } else {
                    setPendientes(prev => prev.filter(c => c.id !== row.id));
                }
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
                .select(ETP_PENDING_LIGHT_COLS)
                .eq('estado_aprobacion', 'pendiente_revision')
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (error) throw error;
            setPendientes(data || []);
        } catch (err) {
            console.error("Error fetching ETP pendientes", err);
        }
    };

    // Cargar la ficha completa (incluyendo procedimiento_preparacion e imagen Base64) únicamente bajo demanda al abrir 1 registro
    const handleSelectPendingColor = async (lightColor) => {
        if (!lightColor?.id) return;
        setLoadingDetailId(lightColor.id);
        try {
            const { data, error } = await supabase
                .from('colores_aprobados')
                .select('*')
                .eq('id', lightColor.id)
                .single();
            if (error) throw error;
            setSelectedColor(data || lightColor);
        } catch (err) {
            console.error("Error cargando detalle de ETP:", err);
            setSelectedColor(lightColor);
        } finally {
            setLoadingDetailId(null);
        }
    };

    const handleAprobar = async (etpData) => {
        try {
            const checks = [
                validatePlantSubmissionText(etpData?.cliente, { fieldLabel: 'cliente', maxLength: 140, allowNewlines: false }),
                validatePlantSubmissionText(etpData?.textoPreparacion, { fieldLabel: 'texto de preparación', maxLength: 1000, allowNewlines: true }),
                validatePlantSubmissionText(etpData?.textoFondo, { fieldLabel: 'texto de fondo', maxLength: 1000, allowNewlines: true }),
                validatePlantSubmissionText(etpData?.textoColor, { fieldLabel: 'texto de color', maxLength: 1000, allowNewlines: true }),
                validatePlantSubmissionText(etpData?.textoAcabado, { fieldLabel: 'texto de acabado', maxLength: 1000, allowNewlines: true }),
                validatePlantSubmissionText(etpData?.catalizador, { fieldLabel: 'catalizador', maxLength: 150, allowNewlines: false }),
                validatePlantSubmissionText(etpData?.disolvente, { fieldLabel: 'disolvente', maxLength: 150, allowNewlines: false })
            ];
            const failed = checks.find((c) => !c.valid);
            if (failed) {
                alert(failed.error);
                return;
            }

            const safeUpdatePayload = sanitizeColorEtpPayload({
                sustrato_muestra: checks[1].value,
                tolerancia_delta_e: etpData.deltaE,
                catalizador_tipo: checks[5].value,
                disolvente_tipo: checks[6].value,
                procedimiento_preparacion: {
                    cliente: checks[0].value,
                    preparacion: checks[1].value,
                    fondo: checks[2].value,
                    color: checks[3].value,
                    acabado: checks[4].value,
                    viscosidad: etpData.viscosidad,
                    presion: etpData.presion,
                    boquilla: etpData.boquilla,
                    manos: etpData.manos,
                    brillo: etpData.glossLevel,
                    fondoObligatorio: etpData.fondoRequired
                },
                sistema_color: etpData.colorSystem,
                aprobado_por_id: supervisorProfile?.id || null,
                estado_aprobacion: 'aprobado_produccion'
            });

            const { error } = await supabase.from('colores_aprobados')
                .update(safeUpdatePayload)
                .eq('id', selectedColor.id);
            
            if (error) throw error;
            alert("✅ ETP Aprobada y liberada para producción.");
            const approvedId = selectedColor.id;
            setSelectedColor(null);
            setPendientes(prev => prev.filter(c => c.id !== approvedId));
        } catch (err) {
            alert("Error al aprobar: " + err.message);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-black theme-text-main mb-6 flex items-center gap-3 flex-wrap">
                <CDILogo heightClass="h-9 md:h-11" />
                <span className="h-7 w-px bg-current opacity-20 hidden sm:block"></span>
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
                                <div key={color.id} onClick={() => handleSelectPendingColor(color)} className="p-5 border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/10 rounded-2xl cursor-pointer hover:shadow-md transition-all">
                                    <h3 className="font-black text-lg theme-text-main">{color.codigo_objetivo}</h3>
                                    <p className="text-sm theme-text-muted">Sistema: {color.sistema_color}</p>
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="text-xs text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md inline-block">Pendiente</span>
                                        <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                                            {loadingDetailId === color.id ? 'Cargando ficha...' : 'Revisar / Elaborar ETP →'}
                                        </span>
                                    </div>
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
                                <p className="theme-text-muted">Revise los parámetros técnicos enviados por el formulador y complete la hoja de ruta para producción.</p>
                            </div>
                        </div>
                        <EtpCopilotForm 
                            colorId={selectedColor.id}
                            initialData={selectedColor}
                            supervisorProfile={supervisorProfile}
                            isSupervisorView={true}
                            onCancel={() => setSelectedColor(null)}
                            onSave={() => {
                                const savedId = selectedColor.id;
                                setSelectedColor(null);
                                setPendientes(prev => prev.filter(c => c.id !== savedId));
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
