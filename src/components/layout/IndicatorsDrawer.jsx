import React from 'react';
import AdvancedExecutiveDashboard from '../modals/AdvancedExecutiveDashboard';

/**
 * IndicatorsDrawer: Renderiza los Indicadores Operativos (Resumen, Operaciones, Analítica-IA)
 * exclusivamente dentro del Drawer lateral deslizable de la vista del Planificador.
 */
export default function IndicatorsDrawer({ 
  isOpen, 
  onClose, 
  orders = [], 
  coordinationAlerts = [], 
  setViewFilter, 
  setShowDashboardModal, 
  setShowPlantPlannerModal 
}) {
  return (
    <AdvancedExecutiveDashboard 
      orders={orders}
      coordinationAlerts={coordinationAlerts}
      onClose={onClose}
      asDrawer={true}
      isOpen={isOpen}
    />
  );
}
