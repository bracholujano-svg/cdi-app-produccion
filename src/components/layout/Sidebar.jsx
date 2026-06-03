import React from 'react';
import { Menu, X, BarChart2, Megaphone, Plus, FlaskConical } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const Sidebar = () => {
  const {
    isSidebarOpen, setIsSidebarOpen,
    setShowDashboardModal,
    setShowCoordinationModal,
    setShowAddModal,
    setSearchResults,
    setShowSearchSelector,
    setDuplicateError,
    setShowRecetarioModal
  } = useAppContext();

  return (
    <>
      {/* SIDEBAR TRIGGER FLOTANTE */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] bg-[var(--card-bg)] text-white p-3 md:p-4 rounded-r-2xl border-y border-r border-[var(--border-color)] shadow-xl hover:bg-[var(--primary)] hover:border-[var(--primary)] transition-all duration-300 group"
      >
        <Menu size={"1.5em"} className="group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* BACKDROP DEL SIDEBAR */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* CAJÓN OCULTO (SIDEBAR) */}
      <div className={`fixed top-0 left-0 h-full w-[110px] md:w-[130px] bg-[var(--bg-main)] z-[80] border-r border-[var(--border-color)] shadow-[10px_0_30px_rgba(0,0,0,0.8)] transform transition-transform duration-300 ease-in-out flex flex-col items-center py-6 gap-6 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors">
          <X size={"1.5em"} />
        </button>
        <div className="mt-12 flex flex-col gap-4 w-full px-4">
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowDashboardModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-all duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <BarChart2 size={"2em"} /><span className="text-center leading-tight">Indicadores</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowCoordinationModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-all duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <Megaphone size={"2em"} /><span className="text-center leading-tight">Coord</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowAddModal(true); setSearchResults([]); setShowSearchSelector(false); setDuplicateError(""); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-all duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <Plus size={"2em"} strokeWidth={3} /><span className="text-center leading-tight">Nuevo</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-all duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <FlaskConical size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">SC Color</span>
            </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
