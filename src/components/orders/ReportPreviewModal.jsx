import React from 'react';
import { Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const ReportPreviewModal = ({ downloadReport }) => {
  const { showReportPreviewModal, setShowReportPreviewModal, reportPreviewData } = useAppContext();
  
  return (
      
        <div className="fixed inset-0 bg-white z-[130] flex flex-col overflow-y-auto text-black">
          <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h2 className="text-lg md:text-xl font-black uppercase text-slate-800">Vista Previa Impresión</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => { try { window.print(); } catch(e) { } }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200 border-blue-800  hover:brightness-125 active:scale-95 flex items-center gap-2"><Printer size={"1.2em"}/> Imprimir</button>
                <button type="button" onClick={() => setShowReportPreviewModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-800 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border border-[var(--border-color)] transition-all duration-200 border-slate-300  hover:brightness-125 active:scale-95">Cerrar</button>
              </div>
            </div>
            <div className="border-2 border-slate-900 p-6 md:p-10 bg-white print:border-0 print:p-0 text-xs md:text-sm lg:text-base w-full overflow-hidden block">
              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
                <div><h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">Reporte de Turno</h1><h2 className="text-sm font-bold uppercase text-slate-500 mt-1">CDI EXHIBICIONES</h2></div>
                <div className="text-right text-slate-900"><p className="text-xs md:text-sm lg:text-base font-black uppercase">Sup: {repSupervisor}</p><p className="text-xs md:text-sm lg:text-base font-black uppercase">Fecha: {repDate}</p></div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse min-w-[700px] text-slate-900 text-xs md:text-sm lg:text-base">
                  <thead><tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                    <th className="p-2 font-black uppercase border border-slate-700 w-16">Tipo</th><th className="p-2 font-black uppercase border border-slate-700 w-12">Hora</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Pedido</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Artículo</th><th className="p-2 font-black uppercase border border-slate-700">Producto / Detalle</th><th className="p-2 font-black uppercase border border-slate-700 w-24">Involucrado</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Estado</th>
                  </tr></thead>
                  <tbody>{generatedReportData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-300 break-inside-avoid">
                      <td className="p-2 font-black border-x border-slate-300">{item.type}</td><td className="p-2 font-bold border-x border-slate-300">{item.time.substring(0,5)}</td><td className="p-2 font-black text-red-700 border-x border-slate-300">{item.orderOC}</td><td className="p-2 font-black text-blue-700 border-x border-slate-300">{item.codArticulo}</td><td className="p-2 border-x border-slate-300"><span className="font-bold block truncate max-w-[150px]">{item.orderName}</span><span className="italic text-slate-600">{item.detail}</span></td><td className="p-2 font-bold border-x border-slate-300 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm">{item.person}</td><td className="p-2 font-black border-x border-slate-300">{item.status}</td>
                    </tr>
                  ))}
                  {generatedReportData.length === 0 && <tr><td colSpan="7" className="p-6 text-center font-black uppercase text-slate-400 border border-slate-200">Sin actividades registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      
  );
};

export default ReportPreviewModal;
