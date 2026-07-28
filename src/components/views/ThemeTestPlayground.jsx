import React, { useState, useEffect } from 'react';
import { Activity, Clock, Settings, TrendingDown, Layers, Box, CheckCircle2 } from 'lucide-react';

/**
 * THEME SWITCHER (Isolated)
 * El estado del tema actual se mantiene estrictamente aquí.
 * No usamos un Contexto global para evitar re-renders en cadena.
 */
const ThemeSwitcher = () => {
  const [activeTheme, setActiveTheme] = useState('zafiro');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'zafiro';
    setActiveTheme(savedTheme);
  }, []);

  const handleThemeChange = (themeName) => {
    setActiveTheme(themeName);
    localStorage.setItem('app-theme', themeName);
    document.body.setAttribute('data-theme', themeName);
  };

  const themes = [
    { id: 'zafiro', name: 'Zafiro Atardecer', color: 'bg-[#ff6b6b]' },
    { id: 'ambar', name: 'Ámbar Resplandeciente', color: 'bg-[#fbbf24]' },
    { id: 'bosque', name: 'Bosque Neón', color: 'bg-[#84cc16]' },
    { id: 'eclipse', name: 'Eclipse Solar', color: 'bg-[#e5e5e5]' },
  ];

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 bg-surface backdrop-blur-xl p-4 rounded-2xl border border-border shadow-2xl mb-8">
      <div className="flex items-center gap-2 text-textMuted font-black uppercase text-xs">
        <Settings size={16} className="text-primary" /> Motor de Tematización
      </div>
      <div className="flex flex-wrap gap-2">
        {themes.map(t => (
          <button
            key={t.id}
            onClick={() => handleThemeChange(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-300 border 
              ${activeTheme === t.id 
                ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_var(--color-primary-glow)] scale-105' 
                : 'bg-black/20 text-textMuted border-border hover:border-primary/50 hover:bg-primary/10'
              }`}
          >
            <span className={`w-3 h-3 rounded-full ${t.color} shadow-sm`}></span>
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * PLAYGROUND: Benchmarking Mockup
 */
export default function ThemeTestPlayground() {
  return (
    <div className="min-h-screen bg-base text-textMain p-4 md:p-8 font-sans selection:bg-primary/30 selection:text-primary transition-colors duration-500">
      
      {/* Header del Playground */}
      <div className="max-w-6xl mx-auto mb-8 animate-in slide-in-from-top-4 duration-500">
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-2 font-oswald text-transparent bg-clip-text bg-gradient-to-r from-textMain to-primary">
          Sandbox de UI / UX
        </h1>
        <p className="text-sm font-bold text-textMuted max-w-2xl">
          Entorno aislado para probar el motor de temas, variables CSS nativas y efectos de Glassmorphism sin afectar el estado de React.
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Aislamiento del Switcher */}
        <ThemeSwitcher />

        {/* Mockup de Benchmarking (Glassmorphism UI) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Tarjeta 1: Indicador de Rendimiento */}
          <div className="lg:col-span-1 bg-surface backdrop-blur-2xl border border-border p-6 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] relative overflow-hidden group hover:border-primary/50 transition-colors duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary opacity-10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:opacity-20 transition-opacity"></div>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-[0_0_15px_var(--color-primary-glow)]">
                <TrendingDown size={24} />
              </div>
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Eficiencia del Lote</h3>
                <p className="text-xl font-black">15% Más Rápido</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-black/20 p-4 rounded-2xl border border-border">
                <p className="text-[10px] font-bold text-textMuted uppercase mb-1">Tiempo de este Pedido</p>
                <p className="text-2xl font-black text-primary drop-shadow-sm">4d 12h</p>
              </div>
              <div className="bg-black/20 p-4 rounded-2xl border border-border">
                <p className="text-[10px] font-bold text-textMuted uppercase mb-1">Promedio Histórico</p>
                <p className="text-lg font-black text-textMuted">5d 08h</p>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Distribución Visual */}
          <div className="lg:col-span-2 bg-surface backdrop-blur-2xl border border-border p-6 md:p-8 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:border-primary/30 transition-colors duration-500">
            <h2 className="text-lg font-black uppercase tracking-wide flex items-center gap-2 mb-8 text-textMain">
              <Clock className="text-primary" size={20} /> Distribución de Tiempos por Área
            </h2>

            <div className="space-y-6">
              {/* Barra Ebanistería */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="flex items-center gap-2"><Box size={14} className="text-primary"/> Ebanistería</span>
                  <span className="text-textMuted">Este Pedido: <span className="text-primary drop-shadow-md">24h</span> <span className="mx-2 opacity-30">|</span> Promedio: 28h</span>
                </div>
                <div className="relative h-4 w-full bg-black/30 rounded-full overflow-hidden border border-border/50">
                  <div className="absolute top-0 left-0 h-full bg-textMuted/40 rounded-full" style={{ width: '85%' }}></div>
                  <div className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_10px_var(--color-primary-glow)] rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>

              {/* Barra Pintura */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="flex items-center gap-2"><Layers size={14} className="text-primary"/> Pintura Líquida</span>
                  <span className="text-textMuted">Este Pedido: <span className="text-primary drop-shadow-md">16h</span> <span className="mx-2 opacity-30">|</span> Promedio: 14h</span>
                </div>
                <div className="relative h-4 w-full bg-black/30 rounded-full overflow-hidden border border-border/50">
                  <div className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_10px_var(--color-primary-glow)] rounded-full z-10" style={{ width: '60%' }}></div>
                  <div className="absolute top-0 left-0 h-full bg-textMuted/40 rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
              
              {/* Barra Ensamble */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase">
                  <span className="flex items-center gap-2"><CheckCircle2 size={14} className="text-primary"/> Ensamble</span>
                  <span className="text-textMuted">Este Pedido: <span className="text-primary drop-shadow-md">8h</span> <span className="mx-2 opacity-30">|</span> Promedio: 12h</span>
                </div>
                <div className="relative h-4 w-full bg-black/30 rounded-full overflow-hidden border border-border/50">
                  <div className="absolute top-0 left-0 h-full bg-textMuted/40 rounded-full" style={{ width: '90%' }}></div>
                  <div className="absolute top-0 left-0 h-full bg-primary shadow-[0_0_10px_var(--color-primary-glow)] rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
