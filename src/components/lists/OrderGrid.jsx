import React from 'react';
import OrderCard from '../orders/OrderCard';
import { Package } from 'lucide-react';

export default function OrderGrid({ 
    gridColsClass, 
    paginatedGroups, 
    groupedArray, 
    totalPages, 
    currentPage, 
    setCurrentPage 
}) {
    return (
        <main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen flex flex-col">
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5 flex-1 content-start`}>
                {paginatedGroups.map(group => <OrderCard key={group.pedidoNum} group={group} />)}
                {groupedArray.length === 0 && (
                    <div className="col-span-full text-center py-20 theme-text-muted">
                        <Package size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8 pb-10">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-6 py-3 rounded-xl font-black uppercase text-base lg:text-lg border theme-border theme-bg-card text-[var(--color-primary)] disabled:opacity-50 hover:bg-[var(--color-primary)] hover:text-[var(--color-surface)] transition-colors"
                    >
                        Anterior
                    </button>
                    <span className="font-bold text-base lg:text-lg text-[var(--color-primary)] px-2">
                        Página {currentPage} de {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-6 py-3 rounded-xl font-black uppercase text-base lg:text-lg border theme-border theme-bg-card text-[var(--color-primary)] disabled:opacity-50 hover:bg-[var(--color-primary)] hover:text-[var(--color-surface)] transition-colors"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </main>
    );
}
