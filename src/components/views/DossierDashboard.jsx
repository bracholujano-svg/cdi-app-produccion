import React, { useState, useMemo } from 'react';
import { 
  Activity, Clock, Search, TrendingDown, TrendingUp, X, Filter, 
  BarChart3, AlertTriangle, Package, CheckCircle2, Layers, Cpu, 
  Box, Sparkles, ChevronRight, FileText, ArrowRight, ShieldCheck, 
  Database, RefreshCw, Scale, ListFilter, Plus
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { AREAS_PLANTA } from '../../utils/constants';

// Helper local 
const msToTimeStrLocal = (ms) => {
  if (!ms || ms <= 0) return '0h';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) return `${days}d ${remHours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
};

const HistorialView = React.memo(({ targetProducts }) => (
  <div className="space-y-6 animate-in fade-in duration-300">
    {targetProducts.map(p => (
      <div key={p.id} className="bg-[var(--color-surface)] p-6 rounded-3xl border border-[var(--color-border)] space-y-4 shadow-sm">
        <h3 className="text-base md:text-lg font-black uppercase theme-text-primary border-b border-[var(--color-border)] pb-3">
          Histórico Completo: {p.nombre}
        </h3>
        <div className="space-y-3">
          {(p.historial || []).slice().reverse().map((h, idx) => (
            <div key={idx} className="p-4 bg-[var(--color-base)] rounded-2xl border border-[var(--color-border)] space-y-2 hover:border-[var(--color-primary)] transition-colors">
              <div className="flex justify-between items-center text-xs font-black uppercase">
                <span className="px-2 py-0.5 bg-[var(--primary-glow)] theme-text-primary rounded border border-[var(--color-primary)]">
                  {h.accion}
                </span>
                <span className="theme-text-muted text-[10px] font-bold">
                  {new Date(h.fecha).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold uppercase bg-black/10 dark:bg-white/10 p-2 rounded-xl">
                <div><span className="text-[10px] theme-text-muted block">ENTREGA:</span> {h.entrega || 'S/N'}</div>
                <div><span className="text-[10px] theme-text-muted block">SUPERVISOR:</span> {h.supervisor || 'S/N'}</div>
              </div>
              {h.nota && <p className="text-xs italic theme-text-muted">"{h.nota}"</p>}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
));

const BenchmarkingView = React.memo(({ comparativeBenchmark }) => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="p-4 rounded-2xl bg-[var(--primary-glow)] border border-[var(--color-primary)] theme-text-primary text-xs font-bold leading-relaxed">
      💡 <strong>Análisis Comparativo Inter-Pedidos:</strong> Compara automáticamente el tiempo que se demoró este producto en cada área con el promedio histórico registrado.
    </div>
    {comparativeBenchmark.map(({ product, currentMetrics, otherInstancesCount, areaAverages, diffPercent }) => {
      const isFaster = diffPercent < 0;
      return (
        <div key={product.id} className="bg-[var(--color-surface)] p-6 rounded-3xl border border-[var(--color-border)] space-y-6 shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[var(--color-border)] pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest theme-text-primary">Artículo Analizado</span>
              <h3 className="text-lg md:text-xl font-black uppercase theme-text-main">
                {product.nombre} <span className="text-xs theme-text-muted font-bold">(Cód: {product.codArticulo || 'S/N'})</span>
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold theme-text-muted">Histórico: <strong>{otherInstancesCount}</strong> pedidos anteriores</span>
              {otherInstancesCount > 0 && (
                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase flex items-center gap-1 border ${isFaster ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'}`}>
                  {isFaster ? <TrendingDown size={14}/> : <TrendingUp size={14}/>}
                  {Math.abs(diffPercent).toFixed(1)}% {isFaster ? 'más eficiente' : 'más demorado'} que el promedio
                </span>
              )}
            </div>
          </div>
          {otherInstancesCount === 0 ? (
            <div className="p-6 text-center text-xs italic theme-text-muted bg-[var(--color-base)] rounded-2xl">
              No hay pedidos anteriores registrados en la base de datos para este artículo.
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider theme-text-main">Comparación de Tiempos por Área</h4>
              <div className="grid grid-cols-1 gap-3">
                {Object.keys(currentMetrics.areaDurations).map(area => {
                  const currentMs = currentMetrics.areaDurations[area] || 0;
                  const avgMs = areaAverages[area] || 0;
                  const maxVal = Math.max(currentMs, avgMs) || 1;
                  const currentWidth = (currentMs / maxVal) * 100;
                  const avgWidth = (avgMs / maxVal) * 100;
                  return (
                    <div key={area} className="p-3.5 bg-[var(--color-base)] rounded-2xl border border-[var(--color-border)] space-y-2 hover:border-[var(--color-primary)] transition-colors">
                      <div className="flex justify-between items-center text-xs font-black uppercase">
                        <span>{area}</span>
                        <div className="flex gap-4">
                          <span className="theme-text-primary">Este Pedido: {msToTimeStrLocal(currentMs)}</span>
                          <span className="theme-text-muted">Promedio: {msToTimeStrLocal(avgMs)}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-4 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                          <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500 shadow-sm" style={{ width: `${Math.max(currentWidth, 2)}%` }}></div>
                        </div>
                        <div className="h-4 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                          <div className="h-full bg-gray-500 rounded-full transition-all duration-500 shadow-sm opacity-60" style={{ width: `${Math.max(avgWidth, 2)}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
));

export default function DossierDashboard() {
  const { orders, setOrders, setShowDossierModal, syncOrderToSupabase, supervisorProfile } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPedidoNum, setSelectedPedidoNum] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('ALL'); // 'ALL' or specific product id
  const [activeTab, setActiveTab] = useState('tiempos'); // 'tiempos' | 'comparativa' | 'insumos' | 'historial'

  // Form local para agregar insumos
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('');
  const [nuevoInsumoCantidad, setNuevoInsumoCantidad] = useState('');
  const [nuevoInsumoNota, setNuevoInsumoNota] = useState('');

  // Agrupar órdenes por pedido para la vista general
  const groupedOrders = useMemo(() => {
    const grouped = {};
    (orders || []).forEach(o => {
      if (!o) return;
      const pNum = o.pedidoNum || "S/N";
      if (!grouped[pNum]) {
        grouped[pNum] = {
          pedidoNum: pNum,
          cliente: o.cliente || 'Sin cliente',
          products: []
        };
      }
      grouped[pNum].products.push(o);
    });
    return Object.values(grouped).sort((a,b) => String(b.pedidoNum).localeCompare(String(a.pedidoNum), undefined, {numeric:true}));
  }, [orders]);

  // Filtrar pedidos según término de búsqueda
  const filteredPedidos = useMemo(() => {
    if (!searchTerm) return groupedOrders;
    const st = searchTerm.toLowerCase().trim();
    return groupedOrders.filter(g => 
      g.pedidoNum.toLowerCase().includes(st) || 
      (g.cliente || "").toLowerCase().includes(st) ||
      g.products.some(p => (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st))
    );
  }, [groupedOrders, searchTerm]);

  // Pedido seleccionado activo
  const selectedGroup = useMemo(() => {
    if (!selectedPedidoNum) return null;
    return groupedOrders.find(g => g.pedidoNum === selectedPedidoNum) || null;
  }, [groupedOrders, selectedPedidoNum]);

  // Producto(s) a inspeccionar dentro del pedido
  const targetProducts = useMemo(() => {
    if (!selectedGroup) return [];
    if (selectedProductId === 'ALL') return selectedGroup.products;
    return selectedGroup.products.filter(p => p.id === selectedProductId);
  }, [selectedGroup, selectedProductId]);

  const msToTimeStr = msToTimeStrLocal;

  // Cálculo de desglose de tiempos por área y esperas para un producto
  const calculateProductMetrics = (product) => {
    if (!product || !product.historial || product.historial.length === 0) {
      return { totalWorkingMs: 0, totalWaitingMs: 0, areaDurations: {}, details: [] };
    }

    const history = [...product.historial].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
    
    let totalWorkingMs = 0;
    let totalWaitingMs = 0;
    const areaDurations = {}; // { 'Ebanistería': ms, ... }
    const details = [];

    let currentArea = null;
    let areaStartTime = null;

    history.forEach((h, index) => {
      const hDate = new Date(h.fecha).getTime();
      const accion = (h.accion || '').toUpperCase();

      // Detectar área en el historial
      let areaFound = null;
      const allKnownAreas = ['Diseño', 'Programación CNC', ...AREAS_PLANTA];
      allKnownAreas.forEach(a => {
        if (accion.includes(a.toUpperCase())) areaFound = a;
      });

      if (areaFound) {
        if (currentArea && areaStartTime) {
          const duration = hDate - areaStartTime;
          if (duration > 0) {
            areaDurations[currentArea] = (areaDurations[currentArea] || 0) + duration;
            totalWorkingMs += duration;
            details.push({ area: currentArea, duration, type: 'work', fecha: h.fecha });
          }
        }
        currentArea = areaFound;
        areaStartTime = hDate;
      }

      if (index === history.length - 1 && currentArea && areaStartTime) {
        // Tiempo hasta el momento actual si aún no ha finalizado
        const duration = Date.now() - areaStartTime;
        if (duration > 0 && product.estadoInterno !== 'DESPACHADO') {
          areaDurations[currentArea] = (areaDurations[currentArea] || 0) + duration;
          totalWorkingMs += duration;
          details.push({ area: currentArea, duration, type: 'work', fecha: h.fecha });
        }
      }
    });

    return { totalWorkingMs, totalWaitingMs, areaDurations, details };
  };

  // Análisis agregado del pedido seleccionado
  const pedidoMetrics = useMemo(() => {
    if (!selectedGroup) return null;
    
    const aggregatedAreaDurations = {};
    let globalWorkingMs = 0;

    selectedGroup.products.forEach(p => {
      const m = calculateProductMetrics(p);
      globalWorkingMs += m.totalWorkingMs;
      Object.entries(m.areaDurations).forEach(([area, ms]) => {
        aggregatedAreaDurations[area] = (aggregatedAreaDurations[area] || 0) + ms;
      });
    });

    return { globalWorkingMs, aggregatedAreaDurations };
  }, [selectedGroup]);

  // BENCHMARKING INTER-PEDIDOS: Buscar otros pedidos con los mismos productos para comparar
  const comparativeBenchmark = useMemo(() => {
    if (!selectedGroup || targetProducts.length === 0) return [];

    return targetProducts.map(currentProduct => {
      const targetCode = (currentProduct.codArticulo || "").trim().toLowerCase();
      const targetName = (currentProduct.nombre || "").trim().toLowerCase();

      // Buscar instancias de este mismo producto en OTROS pedidos
      const sameProductInstances = (orders || []).filter(o => {
        if (!o || o.pedidoNum === currentProduct.pedidoNum) return false;
        const codeMatch = targetCode && (o.codArticulo || "").trim().toLowerCase() === targetCode;
        const nameMatch = targetName && (o.nombre || "").trim().toLowerCase() === targetName;
        return codeMatch || nameMatch;
      });

      const currentMetrics = calculateProductMetrics(currentProduct);
      
      // Calcular promedio histórico por área
      const historicalAreaAverages = {};
      const historicalTotalTimes = [];

      sameProductInstances.forEach(otherProd => {
        const otherMetrics = calculateProductMetrics(otherProd);
        if (otherMetrics.totalWorkingMs > 0) {
          historicalTotalTimes.push(otherMetrics.totalWorkingMs);
        }
        Object.entries(otherMetrics.areaDurations).forEach(([area, ms]) => {
          if (!historicalAreaAverages[area]) historicalAreaAverages[area] = [];
          historicalAreaAverages[area].push(ms);
        });
      });

      // Calcular medias
      const areaAverages = {};
      Object.entries(historicalAreaAverages).forEach(([area, msArray]) => {
        const sum = msArray.reduce((acc, val) => acc + val, 0);
        areaAverages[area] = sum / (msArray.length || 1);
      });

      const avgTotalWorkingMs = historicalTotalTimes.length > 0
        ? historicalTotalTimes.reduce((a, b) => a + b, 0) / historicalTotalTimes.length
        : 0;

      // Calcular desviación % vs promedio
      let diffPercent = 0;
      if (avgTotalWorkingMs > 0 && currentMetrics.totalWorkingMs > 0) {
        diffPercent = ((currentMetrics.totalWorkingMs - avgTotalWorkingMs) / avgTotalWorkingMs) * 100;
      }

      return {
        product: currentProduct,
        currentMetrics,
        otherInstancesCount: sameProductInstances.length,
        sameProductInstances,
        areaAverages,
        avgTotalWorkingMs,
        diffPercent
      };
    });
  }, [selectedGroup, targetProducts, orders]);

  // Manejar guardado de nuevo insumo/materia prima
  const handleAddInsumo = (productId) => {
    if (!nuevoInsumoNombre.trim()) {
      alert("Por favor ingrese el nombre del insumo o materia prima.");
      return;
    }

    const orderToUpdate = (orders || []).find(o => o.id === productId);
    if (!orderToUpdate) return;

    const newInsumoEntry = {
      id: Date.now(),
      nombre: nuevoInsumoNombre.trim().toUpperCase(),
      cantidad: nuevoInsumoCantidad.trim() || '1 UNID',
      nota: nuevoInsumoNota.trim() || 'Registrado en Dossier',
      fecha: new Date().toISOString(),
      registradoPor: supervisorProfile?.name || 'S/N'
    };

    const updatedInsumos = [...(orderToUpdate.insumosMateriasPrimas || []), newInsumoEntry];
    const updatedOrder = { ...orderToUpdate, insumosMateriasPrimas: updatedInsumos };

    const updatedOrdersList = (orders || []).map(o => o.id === productId ? updatedOrder : o);
    setOrders(updatedOrdersList);
    syncOrderToSupabase(updatedOrder);

    setNuevoInsumoNombre('');
    setNuevoInsumoCantidad('');
    setNuevoInsumoNota('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-300">
      <div className="bg-[var(--color-surface)] w-full h-full md:h-[95vh] md:max-w-7xl rounded-2xl md:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl border border-[var(--color-border)]">
        
        {/* ENCABEZADO SUPERIOR */}
        <div className="p-4 md:p-6 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-base)]">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-500/20">
              <Activity size={28} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black theme-text-primary uppercase tracking-tight flex items-center gap-2">
                DOSSIER & BENCHMARKING DE PRODUCCIÓN
              </h2>
              <p className="text-xs md:text-sm font-bold theme-text-muted">
                Análisis Comparativo Inter-Pedidos, Histórico de Tiempos y Consumo de Insumos
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setShowDossierModal(false)}
            className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors theme-text-primary"
          >
            <X size={24} />
          </button>
        </div>

        {/* CUERPO PRINCIPAL DOSSIER */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* BARRA LATERAL IZQUIERDA: LISTA DE PEDIDOS */}
          <div className={`w-full md:w-80 border-r theme-border flex flex-col bg-[var(--color-surface)] ${selectedGroup ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b theme-border">
              <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 theme-text-muted" />
                <input 
                  type="text"
                  placeholder="Buscar pedido, cliente o código..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-purple-500 theme-text-primary"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {filteredPedidos.map(g => {
                const isSelected = selectedGroup?.pedidoNum === g.pedidoNum;
                return (
                  <div 
                    key={g.pedidoNum}
                    onClick={() => { setSelectedPedidoNum(g.pedidoNum); setSelectedProductId('ALL'); }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400 shadow-md' : 'theme-bg-card theme-border hover:border-purple-500/50 hover:-translate-y-0.5'}`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <h3 className="font-black text-base md:text-lg uppercase">#{g.pedidoNum}</h3>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-black/10 dark:bg-white/10 rounded-full">
                        {g.products.length} PRODS
                      </span>
                    </div>
                    <p className="text-xs font-bold opacity-80 truncate">{g.cliente}</p>
                  </div>
                );
              })}

              {filteredPedidos.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-bold text-xs">
                  No se encontraron pedidos.
                </div>
              )}
            </div>
          </div>

          {/* ÁREA CENTRAL PRINCIPAL: DASHBOARD DEL PEDIDO */}
          <div className={`flex-1 flex flex-col bg-[var(--color-base)] overflow-hidden ${!selectedGroup ? 'hidden md:flex items-center justify-center p-8' : ''}`}>
            {!selectedGroup ? (
              <div className="text-center opacity-40 max-w-sm">
                <BarChart3 size={64} className="mx-auto mb-4 text-purple-500 animate-pulse" />
                <h3 className="text-lg font-black uppercase tracking-widest theme-text-primary mb-2">Seleccione un Pedido</h3>
                <p className="text-xs font-bold theme-text-muted">Elija un pedido de la lista izquierda para desplegar su gráfico comparativo, análisis de tiempos e insumos.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
                
                {/* BOTÓN VOLVER (MÓVIL) */}
                <button onClick={() => setSelectedPedidoNum(null)} className="md:hidden flex items-center gap-2 text-purple-500 font-bold mb-2 text-xs uppercase">
                  <X size={16} /> Volver a la lista de pedidos
                </button>

                {/* CABECERA DEL DASHBOARD DEL PEDIDO */}
                <div className="bg-[var(--color-base)] p-6 rounded-3xl border border-[var(--color-border)] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--primary-glow)] theme-text-primary border border-[var(--color-primary)]">
                        Dossier Activo
                      </span>
                      <span className="text-xs font-bold theme-text-muted uppercase">Cliente: {selectedGroup.cliente}</span>
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black uppercase theme-text-main tracking-tight">
                      PEDIDO #{selectedGroup.pedidoNum}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedProductId('ALL')}
                      className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all ${selectedProductId === 'ALL' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md' : 'bg-[var(--color-surface)] border-[var(--color-border)] theme-text-muted hover:border-[var(--color-primary)]'}`}
                    >
                      📦 Todos ({selectedGroup.products.length})
                    </button>
                    {selectedGroup.products.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-black uppercase border transition-all whitespace-nowrap ${selectedProductId === p.id ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md' : 'bg-[var(--color-surface)] border-[var(--color-border)] theme-text-muted hover:border-[var(--color-primary)]'}`}
                      >
                        {p.codArticulo || p.nombre}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TABS DE SECCIÓN DEL DOSSIER */}
                <div className="flex border-b theme-border gap-2 md:gap-4 overflow-x-auto custom-scrollbar pb-1">
                  <button 
                    onClick={() => setActiveTab('tiempos')}
                    className={`px-4 py-2.5 rounded-t-xl font-black text-xs uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'tiempos' ? 'bg-purple-600 text-white border-t border-x border-purple-600' : 'theme-text-muted hover:bg-purple-500/10'}`}
                  >
                    <Clock size={16} /> 1. Distribución de Tiempos por Área
                  </button>
                  <button 
                    onClick={() => setActiveTab('comparativa')}
                    className={`px-4 py-2.5 rounded-t-xl font-black text-xs uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'comparativa' ? 'bg-purple-600 text-white border-t border-x border-purple-600' : 'theme-text-muted hover:bg-purple-500/10'}`}
                  >
                    <Scale size={16} /> 2. Benchmarking Inter-Pedidos
                  </button>
                  <button 
                    onClick={() => setActiveTab('insumos')}
                    className={`px-4 py-2.5 rounded-t-xl font-black text-xs uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'insumos' ? 'bg-purple-600 text-white border-t border-x border-purple-600' : 'theme-text-muted hover:bg-purple-500/10'}`}
                  >
                    <Package size={16} /> 3. Materias Primas e Insumos
                  </button>
                  <button 
                    onClick={() => setActiveTab('historial')}
                    className={`px-4 py-2.5 rounded-t-xl font-black text-xs uppercase transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === 'historial' ? 'bg-purple-600 text-white border-t border-x border-purple-600' : 'theme-text-muted hover:bg-purple-500/10'}`}
                  >
                    <Layers size={16} /> 4. Timeline y Trazabilidad
                  </button>
                </div>

                {/* PESTAÑA 1: DISTRIBUCIÓN DE TIEMPOS POR ÁREA */}
                {activeTab === 'tiempos' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="theme-bg-card p-5 rounded-2xl border theme-border flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                          <Clock size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase theme-text-muted">Tiempo Total Procesado</p>
                          <h4 className="text-xl md:text-2xl font-black theme-text-primary">
                            {msToTimeStr(pedidoMetrics?.globalWorkingMs)}
                          </h4>
                        </div>
                      </div>

                      <div className="theme-bg-card p-5 rounded-2xl border theme-border flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                          <Cpu size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase theme-text-muted">Áreas Activas</p>
                          <h4 className="text-xl md:text-2xl font-black theme-text-primary">
                            {Object.keys(pedidoMetrics?.aggregatedAreaDurations || {}).length} Secciones
                          </h4>
                        </div>
                      </div>

                      <div className="theme-bg-card p-5 rounded-2xl border theme-border flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase theme-text-muted">Estado Global</p>
                          <h4 className="text-sm font-black theme-text-primary uppercase">
                            {selectedGroup.products.every(p => p.isTerminado) ? '🟢 Terminado' : '🟡 En Procesamiento'}
                          </h4>
                        </div>
                      </div>
                    </div>

                    {/* GRÁFICO DE BARRAS DE TIEMPO POR ÁREA */}
                    <div className="theme-bg-card p-6 rounded-3xl border theme-border space-y-4">
                      <h3 className="text-base md:text-lg font-black uppercase theme-text-primary flex items-center gap-2">
                        <BarChart3 className="text-purple-500" /> Gráfico Comparativo de Tiempo por Sección
                      </h3>

                      {Object.keys(pedidoMetrics?.aggregatedAreaDurations || {}).length === 0 ? (
                        <p className="text-xs italic theme-text-muted text-center py-6">Aún no hay registros de tiempo acumulados para este pedido.</p>
                      ) : (
                        <div className="space-y-4 pt-2">
                          {Object.entries(pedidoMetrics.aggregatedAreaDurations).map(([area, ms]) => {
                            const percent = pedidoMetrics.globalWorkingMs > 0 ? (ms / pedidoMetrics.globalWorkingMs) * 100 : 0;
                            return (
                              <div key={area} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs font-black uppercase">
                                  <span className="theme-text-primary">{area}</span>
                                  <span className="theme-text-muted">{msToTimeStr(ms)} ({percent.toFixed(1)}%)</span>
                                </div>
                                <div className="h-4 w-full theme-bg-input rounded-full overflow-hidden p-0.5 border theme-border">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-500 shadow-sm"
                                    style={{ width: `${Math.max(percent, 2)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PESTAÑA 2: BENCHMARKING INTER-PEDIDOS */}
                {activeTab === 'comparativa' && (
                  <BenchmarkingView comparativeBenchmark={comparativeBenchmark} />
                )}

                {/* PESTAÑA 3: MATERIAS PRIMAS E INSUMOS */}
                {activeTab === 'insumos' && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    {targetProducts.map(p => (
                      <div key={p.id} className="bg-[var(--color-surface)] p-6 rounded-3xl border border-[var(--color-border)] space-y-4 shadow-sm">
                        <div className="flex justify-between items-center border-b border-[var(--color-border)] pb-3">
                          <h3 className="text-base md:text-lg font-black uppercase theme-text-primary">
                            Insumos de: {p.nombre} <span className="text-xs theme-text-muted font-bold">({p.codArticulo})</span>
                          </h3>
                        </div>

                        {/* FORMULARIO AGREGAR INSUMO */}
                        <div className="p-4 bg-[var(--color-base)] rounded-2xl border border-[var(--color-border)] space-y-3">
                          <label className="text-xs font-black uppercase theme-text-primary block">Registrar Consumo de Materia Prima / Insumo:</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input 
                              type="text" 
                              placeholder="Nombre Insumo (ej. MDF 18mm, Cold Roll 1/8)" 
                              value={nuevoInsumoNombre}
                              onChange={e => setNuevoInsumoNombre(e.target.value)}
                              className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] font-bold text-xs outline-none focus:border-[var(--color-primary)] theme-text-main"
                            />
                            <input 
                              type="text" 
                              placeholder="Cantidad / Unidad (ej. 2 Hojas, 5 Kg)" 
                              value={nuevoInsumoCantidad}
                              onChange={e => setNuevoInsumoCantidad(e.target.value)}
                              className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] font-bold text-xs outline-none focus:border-[var(--color-primary)] theme-text-main"
                            />
                            <button 
                              type="button" 
                              onClick={() => handleAddInsumo(p.id)}
                              className="bg-[var(--color-primary)] text-white font-black uppercase text-xs p-3 rounded-xl shadow-sm hover:brightness-125 transition-colors flex items-center justify-center gap-1"
                            >
                              <Plus size={16} /> Guardar Insumo
                            </button>
                          </div>
                        </div>

                        {/* LISTADO DE INSUMOS REGISTRADOS */}
                        <div className="space-y-2 pt-2">
                          {(!p.insumosMateriasPrimas || p.insumosMateriasPrimas.length === 0) ? (
                            <p className="text-xs italic theme-text-muted text-center py-4">No se han registrado consumos de materia prima para este producto aún.</p>
                          ) : (
                            p.insumosMateriasPrimas.map((item, idx) => (
                              <div key={idx} className="p-3 rounded-xl bg-[var(--color-base)] border border-[var(--color-border)] flex justify-between items-center">
                                <div>
                                  <span className="text-xs font-black uppercase theme-text-main">{item.nombre}</span>
                                  <p className="text-[10px] theme-text-muted font-bold">Registrado por: {item.registradoPor} • {new Date(item.fecha).toLocaleString()}</p>
                                </div>
                                <span className="text-xs font-black px-3 py-1 bg-[var(--primary-glow)] theme-text-primary rounded-full border border-[var(--color-primary)] uppercase">
                                  {item.cantidad}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PESTAÑA 4: TIMELINE Y TRAZABILIDAD */}
                {activeTab === 'historial' && (
                  <HistorialView targetProducts={targetProducts} />
                )}

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
