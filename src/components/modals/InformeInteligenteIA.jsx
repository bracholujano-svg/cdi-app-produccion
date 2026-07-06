import React, { useEffect, useRef, useState } from 'react';
import { getDaysLeft } from '../../utils/helpers';
import { Download, Share2, BrainCircuit, AlertTriangle, CheckCircle, Package, Clock, Activity, Search } from 'lucide-react';

const InformeInteligenteIA = ({ orders, onClose, setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal }) => {
    const chartsRef = useRef({});
    const [isExporting, setIsExporting] = useState(false);

    // AI Logic (Data Processing)
    const totalOrders = orders.length;
    const activos = orders.filter(o => o.estadoInterno !== 'DESPACHADO');
    const activosCount = activos.length;

    // Atrasos Críticos Agrupados
    const delayedOrdersRaw = activos.filter(o => {
        const days = getDaysLeft(o.fechaEntregaPrometida);
        return days !== null && days < 0;
    }).map(o => ({
        ...o,
        daysLate: Math.abs(getDaysLeft(o.fechaEntregaPrometida))
    }));

    const groupedDelaysMap = {};
    delayedOrdersRaw.forEach(o => {
        if (!groupedDelaysMap[o.pedidoNum]) {
            groupedDelaysMap[o.pedidoNum] = { 
                pedidoNum: o.pedidoNum, 
                cliente: o.cliente, 
                count: 0, 
                maxDaysLate: 0, 
                areas: new Set() 
            };
        }
        groupedDelaysMap[o.pedidoNum].count++;
        groupedDelaysMap[o.pedidoNum].areas.add(o.areaActual);
        if (o.daysLate > groupedDelaysMap[o.pedidoNum].maxDaysLate) {
            groupedDelaysMap[o.pedidoNum].maxDaysLate = o.daysLate;
        }
    });
    const delayedOrders = Object.values(groupedDelaysMap).sort((a, b) => b.maxDaysLate - a.maxDaysLate);

    // Carga de Trabajo por Área
    const areasCount = {};
    activos.forEach(o => {
        if(o.areaActual) {
            areasCount[o.areaActual] = (areasCount[o.areaActual] || 0) + 1;
        }
    });
    const bottleneckArea = Object.keys(areasCount).length > 0 
        ? Object.keys(areasCount).reduce((a, b) => areasCount[a] > areasCount[b] ? a : b) 
        : 'N/A';

    // Fallos de Calidad Agrupados
    let lastQualityIssuesRaw = [];
    orders.forEach(o => {
        (o.bitacoraCalidad || []).forEach(q => {
            if(q.estado === 'RECHAZADO' || q.estado === 'RETRABAJO') {
                lastQualityIssuesRaw.push({
                    pedido: o.pedidoNum,
                    cliente: o.cliente,
                    articulo: o.codArticulo,
                    estado: q.estado,
                    observacion: q.observacion,
                    fecha: new Date(q.fecha)
                });
            }
        });
    });
    lastQualityIssuesRaw.sort((a, b) => b.fecha - a.fecha);

    const groupedQualityMap = {};
    lastQualityIssuesRaw.forEach(q => {
        if (!groupedQualityMap[q.pedido]) {
            groupedQualityMap[q.pedido] = { 
                pedido: q.pedido, 
                cliente: q.cliente, 
                fallos: [] 
            };
        }
        groupedQualityMap[q.pedido].fallos.push(q);
    });
    // Solo tomamos los primeros 5 pedidos con problemas
    const topQualityIssues = Object.values(groupedQualityMap).slice(0, 5);

    // WhatsApp export logic
    const handleWhatsAppShare = () => {
        const text = `*Reporte Inteligente de Planta CDI*%0A%0A` +
        `📦 *Pedidos Activos:* ${activosCount}%0A` +
        `🚨 *Pedidos Atrasados:* ${delayedOrders.length}%0A` +
        `🛑 *Cuello de Botella Actual:* ${bottleneckArea} (${areasCount[bottleneckArea] || 0} productos)%0A%0A` +
        `*Atención Requerida:*%0A` +
        (delayedOrders.length > 0 ? `El pedido más atrasado es el #${delayedOrders[0].pedidoNum} (${delayedOrders[0].cliente}) con ${delayedOrders[0].maxDaysLate} días de retraso.%0A` : `No hay atrasos críticos.%0A`) +
        `%0A📌 Por favor, descarga el PDF detallado en el sistema para ver gráficos y reportes de calidad.`;
        
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    // Deep Linking Handler
    const handleDeepLink = (pedidoNum) => {
        if (setSelectedGroupPedido && setShowDashboardModal) {
            setSelectedGroupPedido(String(pedidoNum));
            setShowDashboardModal(false);
        }
    };

    const handleProductDeepLink = (pedidoNum, articulo) => {
        if (setSelectedOrder && setShowDashboardModal) {
            // Buscamos el producto exacto
            const product = orders.find(o => String(o.pedidoNum) === String(pedidoNum) && String(o.codArticulo) === String(articulo));
            if (product) {
                setSelectedOrder(product);
                setShowDashboardModal(false);
            }
        }
    };

    // PDF export logic
    const handleDownloadPDF = async () => {
        setIsExporting(true);
        if (!window.html2pdf) {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            document.head.appendChild(script);
            await new Promise(r => script.onload = r);
        }
        
        const element = document.getElementById('informe-pdf-content');
        
        // Esconder elementos interactivos para el PDF (como los iconos de "click here")
        const interactiveIcons = document.querySelectorAll('.hide-on-pdf');
        interactiveIcons.forEach(el => el.style.display = 'none');

        const opt = {
            margin:       10,
            filename:     `Reporte_Inteligente_Planta_${new Date().toISOString().slice(0,10)}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        window.html2pdf().set(opt).from(element).save().then(() => {
            interactiveIcons.forEach(el => el.style.display = '');
            setIsExporting(false);
        });
    };

    // Charts
    useEffect(() => {
        const loadChart = async () => {
            if (!window.Chart) {
                const chartScript = document.createElement('script');
                chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
                document.head.appendChild(chartScript);
                await new Promise(r => chartScript.onload = r);
            }
            drawCharts();
        };

        const drawCharts = () => {
            if (!window.Chart) return;
            Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());
            
            const ctxAreas = document.getElementById('aiChartAreas');
            if (ctxAreas) {
                const labels = Object.keys(areasCount);
                const data = Object.values(areasCount);
                chartsRef.current.areas = new window.Chart(ctxAreas, {
                    type: 'doughnut',
                    data: {
                        labels: labels.length > 0 ? labels : ['Sin Datos'],
                        datasets: [{
                            data: data.length > 0 ? data : [1],
                            backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'],
                            borderWidth: 0
                        }]
                    },
                    options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
                });
            }
        };
        loadChart();
        return () => Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());
    }, [orders]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {/* Controles de Exportación */}
            <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center text-slate-900">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase text-slate-800" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Reporte de Inteligencia Artificial</h2>
                        <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Generado en tiempo real</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={handleWhatsAppShare} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl font-black uppercase text-sm hover:bg-green-100 transition-colors border border-green-200">
                        <Share2 size={18} /> WhatsApp
                    </button>
                    <button onClick={handleDownloadPDF} disabled={isExporting} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[var(--primary)] text-slate-900 px-4 py-3 rounded-xl font-black uppercase text-sm hover:brightness-110 transition-colors shadow-sm">
                        <Download size={18} /> {isExporting ? 'Generando...' : 'Descargar PDF'}
                    </button>
                </div>
            </div>

            {/* Contenedor del PDF */}
            <div id="informe-pdf-content" className="bg-white p-6 md:p-12 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-10">
                
                {/* Header del Reporte */}
                <div className="border-b-2 border-gray-100 pb-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-800" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Auditoría Automática CDI</h1>
                        <p className="text-gray-500 font-bold uppercase tracking-widest mt-2">Diagnóstico de Planta y Logística</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 text-right min-w-[200px] w-full md:w-auto">
                        <p className="text-xs font-black uppercase text-gray-400">Fecha del Reporte</p>
                        <p className="text-lg font-black text-[var(--accent)]">{new Date().toLocaleDateString()}</p>
                        <p className="text-xs font-bold text-gray-500">{new Date().toLocaleTimeString()}</p>
                    </div>
                </div>

                {/* Resumen Ejecutivo Estilizado */}
                <div className="bg-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 opacity-10"><BrainCircuit size={200} /></div>
                    <h3 className="text-xl font-black uppercase text-slate-100 mb-4 flex items-center gap-2"><Activity size={24}/> Resumen Ejecutivo IA</h3>
                    <div className="text-base md:text-lg text-slate-200 leading-relaxed font-medium relative z-10 space-y-4">
                        <p>Actualmente hay <strong className="text-yellow-400 text-xl font-black">{activosCount}</strong> artículos activos en el piso de producción. 
                        Se ha detectado que el principal cuello de botella se encuentra en el área de <strong className="text-yellow-400 text-xl font-black uppercase">{bottleneckArea}</strong>, 
                        concentrando la mayor cantidad de la carga de trabajo ({areasCount[bottleneckArea] || 0} artículos).</p>
                        {delayedOrders.length > 0 ? 
                            <p className="border-l-4 border-red-500 pl-4 py-2 text-red-100 bg-red-500/10 rounded-r-lg">
                                ⚠️ Atención Crítica: Existen <strong className="text-red-400 font-black text-xl">{delayedOrders.length}</strong> pedidos con fechas de entrega vencidas que requieren intervención logística inmediata.
                            </p> 
                            : <p className="text-green-400 font-bold">✅ No se registran pedidos con atrasos críticos en este momento. La planta fluye adecuadamente.</p>
                        }
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Alertas Críticas de Atraso (AGRUPADAS) */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-black uppercase text-slate-800 flex items-center gap-2 border-b-2 border-[var(--primary)] pb-2 inline-flex"><Clock size={24} className="text-[var(--primary)]"/> Lista de Retrasos Críticos</h3>
                        
                        <div className="space-y-4">
                            {delayedOrders.length > 0 ? delayedOrders.slice(0, 5).map((o, idx) => (
                                <div key={idx} onClick={() => handleDeepLink(o.pedidoNum)} className="bg-red-50 p-5 rounded-2xl border border-red-100 flex gap-4 items-start shadow-sm hover:shadow-md hover:bg-red-100 transition-colors cursor-pointer relative group">
                                    <div className="hide-on-pdf absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-200 p-2 rounded-xl text-red-800">
                                        <Search size={20} />
                                    </div>
                                    <div className="bg-red-500 text-white w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-inner">
                                        <span className="text-xl font-black leading-none">{o.maxDaysLate}</span>
                                        <span className="text-[10px] font-bold uppercase">Días</span>
                                    </div>
                                    <div className="min-w-0 flex-1 pr-10">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-black text-red-900 text-lg hover:underline decoration-red-400">PEDIDO #{o.pedidoNum}</h4>
                                            <span className="text-xs font-black text-red-700 bg-red-200 px-2 py-0.5 rounded-full">{o.count} ARTÍCULOS</span>
                                        </div>
                                        <p className="font-bold text-red-700 text-sm uppercase truncate">{o.cliente}</p>
                                        <p className="text-xs font-bold text-red-500 mt-2">Áreas afectadas: {Array.from(o.areas).join(', ')}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center text-green-700">
                                    <CheckCircle size={40} className="mx-auto mb-3 opacity-50" />
                                    <p className="font-black uppercase">¡Excelente trabajo!</p>
                                    <p className="text-sm font-bold">Todos los pedidos están dentro del tiempo prometido.</p>
                                </div>
                            )}
                            {delayedOrders.length > 5 && <div className="text-center font-bold text-gray-400 text-sm italic">+ {delayedOrders.length - 5} pedidos atrasados adicionales no mostrados.</div>}
                        </div>
                    </div>

                    {/* Gráfico y Calidad (AGRUPADA) */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xl font-black uppercase text-slate-800 flex items-center gap-2 border-b-2 border-slate-300 pb-2 inline-flex mb-6"><Package size={24} className="text-slate-500"/> Distribución de Carga</h3>
                            <div className="h-[250px] w-full bg-slate-50 rounded-3xl border border-slate-100 p-4">
                                <canvas id="aiChartAreas"></canvas>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-black uppercase text-slate-800 flex items-center gap-2 border-b-2 border-yellow-400 pb-2 inline-flex mb-6"><AlertTriangle size={24} className="text-yellow-500"/> Calidad Crítica Agrupada</h3>
                            <div className="space-y-3">
                                {topQualityIssues.length > 0 ? topQualityIssues.map((grupo, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded-2xl border-l-4 border-yellow-400 shadow-sm text-sm hover:shadow-md cursor-pointer hover:bg-yellow-50 transition-colors relative group">
                                        <div className="hide-on-pdf absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-100 p-1.5 rounded-lg text-yellow-800">
                                            <Search size={16} />
                                        </div>
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <span className="font-black text-slate-800 text-base hover:underline decoration-yellow-400">PEDIDO #{grupo.pedido}</span>
                                            <span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md shrink-0">{grupo.fallos.length} FALLOS</span>
                                        </div>
                                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">{grupo.cliente}</p>
                                        <div className="space-y-2 mt-2">
                                            {grupo.fallos.slice(0, 2).map((f, i) => (
                                                <div key={i} onClick={() => handleProductDeepLink(grupo.pedido, f.articulo)} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-yellow-100 transition-colors">
                                                    <span className="font-black text-slate-700">{f.articulo}: </span>
                                                    <span className="text-slate-500 italic">"{f.observacion}"</span>
                                                    <span className="ml-2 font-black text-[9px] text-red-500 bg-red-50 px-1 py-0.5 rounded">{f.estado}</span>
                                                </div>
                                            ))}
                                            {grupo.fallos.length > 2 && <p className="text-[10px] text-gray-400 font-bold italic pl-2">+ {grupo.fallos.length - 2} fallos adicionales</p>}
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-gray-400 text-sm italic">No se han registrado rechazos o reprocesos recientes.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-100 text-center text-xs text-gray-400 font-bold uppercase tracking-widest">
                    Generado automáticamente por el motor de análisis CDI - Documento Confidencial
                </div>
            </div>
        </div>
    );
};

export default InformeInteligenteIA;
