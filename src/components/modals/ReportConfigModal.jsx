import React from 'react';
import { SUPERVISORES } from '../../utils/constants';
import CDILogo from '../ui/CDILogo';

export default function ReportConfigModal({
    repSupervisor, setRepSupervisor,
    repDateStart, setRepDateStart,
    repTimeStart, setRepTimeStart,
    repDateEnd, setRepDateEnd,
    repTimeEnd, setRepTimeEnd,
    generateShiftReport,
    setShowReportConfigModal
}) {
    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] w-full max-w-sm rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 bg-[#1E293B] text-white flex justify-between items-center border-b border-[#D4AF37]/30"><div className="flex items-center gap-3"><CDILogo heightClass="h-10 w-auto" className="shrink-0" /><h2 className="font-bold uppercase text-base text-white">Reporte de Turno</h2></div><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200">✕</button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-base lg:text-lg font-black theme-text-muted uppercase tracking-widest">Supervisor</label><select value={repSupervisor} onChange={e=>setRepSupervisor(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-base lg:text-lg uppercase outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]"><option value="">Seleccione...</option><option value="TODOS">TODOS LOS SUPERVISORES</option>{SUPERVISORES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-sm md:text-base font-black theme-text-muted uppercase tracking-widest">Fecha Inicio</label><input type="date" value={repDateStart} onChange={e=>setRepDateStart(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-sm md:text-base outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]" /></div>
                  <div className="space-y-1"><label className="text-sm md:text-base font-black theme-text-muted uppercase tracking-widest">Hora Inicio</label><input type="time" value={repTimeStart} onChange={e=>setRepTimeStart(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-sm md:text-base outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]" /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-sm md:text-base font-black theme-text-muted uppercase tracking-widest">Fecha Fin</label><input type="date" value={repDateEnd} onChange={e=>setRepDateEnd(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-sm md:text-base outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]" /></div>
                  <div className="space-y-1"><label className="text-sm md:text-base font-black theme-text-muted uppercase tracking-widest">Hora Fin</label><input type="time" value={repTimeEnd} onChange={e=>setRepTimeEnd(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-sm md:text-base outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-primary)]" /></div>
              </div>

              <button type="button" onClick={generateShiftReport} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase text-base lg:text-lg py-4 rounded-xl border border-[var(--color-border)] transition-colors duration-200 hover:brightness-125 active:scale-95 mt-2">Generar Vista Previa</button>
            </div>
          </div>
        </div>
    );
}
