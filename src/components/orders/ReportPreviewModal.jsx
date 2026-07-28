import React from 'react';
import { Printer, Calendar, Clock, User, ArrowRightLeft, CheckCircle, AlertTriangle, Package, MapPin, Target } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const ReportPreviewModal = () => {
  const { showReportPreviewModal, setShowReportPreviewModal, repSupervisor, repDateStart, repTimeStart, repDateEnd, repTimeEnd, generatedReportData } = useAppContext();
  
  if (!showReportPreviewModal) return null;

  // Group events by area
  const groupedData = generatedReportData.reduce((acc, item) => {
      const area = item.area || 'DESCONOCIDA';
      if (!acc[area]) acc[area] = [];
      acc[area].push(item);
      return acc;
  }, {});

  const getIconForType = (type, status) => {
      if (type === 'PRODUCCIÓN') return <Target className="text-blue-500" />;
      if (type === 'CALIDAD') return status === 'APROBADO' ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-red-500" />;
      return <ArrowRightLeft className="text-purple-500" />;
  };

  const getColorForType = (type, status) => {
      if (type === 'PRODUCCIÓN') return 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10';
      if (type === 'CALIDAD') return status === 'APROBADO' ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' : 'border-red-500 bg-red-50/50 dark:bg-red-900/10';
      return 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10';
  };

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-[130] flex flex-col overflow-y-auto print:bg-white text-slate-800 dark:text-slate-200">
      <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
        
        {/* ENCABEZADO ACCIONES */}
        <div className="flex justify-between items-center mb-6 print:hidden bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg md:text-xl font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
            <Package /> Vista Previa del Reporte
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => { try { window.print(); } catch(e) { } }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase text-sm shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2">
              <Printer size={"1.2em"}/> Imprimir
            </button>
            <button type="button" onClick={() => setShowReportPreviewModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-black uppercase text-sm border border-slate-300 dark:border-slate-600 hover:brightness-110 transition-colors">
              Cerrar
            </button>
          </div>
        </div>

        {/* CONTENIDO DEL REPORTE */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] print:rounded-none shadow-xl print:shadow-none border border-slate-200 dark:border-slate-700 print:border-0 p-6 md:p-10">
          
          {/* ENCABEZADO INFO */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-200 dark:border-slate-700 pb-6 mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white leading-none mb-2">Reporte de Turno</h1>
              <h2 className="text-sm font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg inline-block">CDI EXHIBICIONES</h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                    <User className="text-indigo-500" />
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Supervisor</p>
                        <p className="font-black uppercase text-slate-800 dark:text-white">{repSupervisor}</p>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3 shadow-sm">
                    <Calendar className="text-orange-500" />
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Rango Operativo</p>
                        <p className="font-black uppercase text-slate-800 dark:text-white text-xs">
                            {repDateStart} {repTimeStart} a<br/>{repDateEnd} {repTimeEnd}
                        </p>
                    </div>
                </div>
            </div>
          </div>

          {/* CUERPO - AGRUPADO POR ÁREA */}
          <div className="space-y-10">
            {Object.keys(groupedData).length === 0 ? (
                <div className="text-center py-20">
                    <p className="font-black uppercase text-slate-400 text-xl">Sin actividades registradas</p>
                </div>
            ) : (
                Object.entries(groupedData).map(([area, items]) => (
                    <div key={area} className="break-inside-avoid">
                        <h3 className="text-xl font-black uppercase text-slate-800 dark:text-white mb-4 flex items-center gap-2 border-l-4 border-[var(--color-primary)] pl-3">
                            <MapPin className="theme-text-primary" /> ÁREA: {area} <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">{items.length} EVENTOS</span>
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item, idx) => (
                                <div key={idx} className={`p-4 rounded-2xl border-l-4 shadow-sm flex flex-col justify-between ${getColorForType(item.type, item.status)}`}>
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                {getIconForType(item.type, item.status)}
                                                <span className="text-xs font-black uppercase tracking-wider">{item.type}</span>
                                            </div>
                                            <span className="text-xs font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                                <Clock size={12} /> {item.time.substring(0, 5)}
                                            </span>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Producto</p>
                                            <p className="font-black text-sm uppercase truncate" title={item.orderName}>{item.orderName}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/50">OC: {item.orderOC}</span>
                                                <span className="text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50">ART: {item.codArticulo}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-black/5 dark:border-white/5 mb-3">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Detalle / Acción</p>
                                            <p className="text-xs font-medium italic">{item.detail}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end pt-2 border-t border-black/5 dark:border-white/5 mt-auto">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">Responsable</p>
                                            <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">{item.person}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">{item.status}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ReportPreviewModal;
