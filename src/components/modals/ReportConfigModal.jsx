import React from 'react';
import { SUPERVISORES } from '../../utils/constants';

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
        <div className="fixed inset-0 bg-black/80  z-[120] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header flex justify-between items-center border-b theme-border"><h2 className="font-black uppercase text-base text-[var(--color-primary)]">Reporte de Turno</h2><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--color-primary)]">✕</button></div>
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
