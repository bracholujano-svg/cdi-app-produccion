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
        <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs px-5 py-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3.5">
                    <CDILogo heightClass="h-11 w-auto" />
                    <span className="h-7 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></span>
                    <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                            Laboratorio de Colorimetría • Control de Calidad
                        </span>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                            Auditoría ETP (Pintura Líquida)
                        </h1>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tabular-nums bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {pendientes.length} pendientes de revisión
                </span>
            </div>

            {!selectedColor ? (
                <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-xs border border-slate-200 dark:border-slate-800 p-6">
                    <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        Nuevos Colores Pendientes de Aprobación
                        <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {pendientes.length}
                        </span>
                    </h2>
                    
                    {pendientes.length === 0 ? (
                        <div className="text-center py-10">
                            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3 opacity-60" />
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay fórmulas pendientes de revisión.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendientes.map(color => (
                                <div
                                    key={color.id}
                                    onClick={() => handleSelectPendingColor(color)}
                                    className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] hover:border-[#2E435B] dark:hover:border-slate-700 rounded-xl cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span
                                                className="w-9 h-9 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs shrink-0"
                                                style={{ backgroundColor: color.color_hexadecimal || '#CBD5E1' }}
                                            />
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-base tabular-nums text-slate-900 dark:text-slate-100 truncate">
                                                    {color.codigo_objetivo}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    Sistema: {color.sistema_color}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-semibold bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full shrink-0">
                                            Pendiente
                                        </span>
                                    </div>
                                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                                        <span className="text-xs font-semibold text-[#1E293B] dark:text-slate-200">
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
                    <button
                        onClick={() => setSelectedColor(null)}
                        className="mb-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#111827] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                    >
                        &larr; Volver a la lista
                    </button>
                    <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-sm relative border border-slate-200 dark:border-slate-800 p-5 md:p-6">
                        <div className="mb-5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase tabular-nums">
                                    Auditar ETP: {selectedColor.codigo_objetivo}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Revise los parámetros técnicos enviados por el formulador y complete la hoja de ruta para producción.
                                </p>
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
