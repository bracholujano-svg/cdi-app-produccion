# Análisis de Impacto Arquitectónico - Fase 4 (UI SRP)

## Causa Raíz de la Reestructuración
El archivo `App.jsx` violaba el principio de Responsabilidad Única (SRP) no solo a nivel de lógica de negocio (resuelto en las Fases 1 a 3), sino también a nivel de renderizado visual. El componente `MainApp` contenía un "God Render Method" que superaba las 1000 líneas de JSX, mezclando modales emergentes, iteraciones masivas de tarjetas (Grids) y cabeceras de filtros, todo en un único flujo. Esto provocaba que cualquier renderizado de un input o cambio de filtro re-evaluara el VDOM de estructuras pesadas sin necesidad, degradando el rendimiento.

## Extracciones Realizadas
Se han implementado de forma quirúrgica componentes "tontos" (dumb components) que absorben la complejidad visual, manteniendo el estado encapsulado o inyectado vía props/context, sin alterar ni una sola clase de Tailwind:

1. **`FilterControls`** (Panel Estático de Controles y Filtros)
   - Extracción de la barra de búsqueda superior y los controles de cuadrícula (`gridCols`).
   - Ahora consume localmente `useAppStore` y `useAppContext`, aislando sus re-renders.
2. **`OrderGrid`** (Estructura de Iteración Masiva)
   - Extracción de la cuadrícula principal que mapea `paginatedGroups` y renderiza `OrderCard`.
   - Incluye su lógica visual de paginación de estado (`Anterior` / `Siguiente`).
3. **`CoordViewModal`** (Modal Absoluto - UI Compleja)
   - Extracción del Plan Maestro de Despacho (modal z-[110]).
   - Ahora maneja sus propios estados internos de ordenamiento (`coordSortOrder`) y búsqueda local, liberando a `App.jsx` de estos estados visuales.
4. **`MaterialsAlertModal`** (Modal Absoluto - Alertas)
   - Extracción de la vista de materiales requeridos vs faltantes.
   - Consume su propio `materialsSearchTerm` desde Zustand.
5. **`ReportConfigModal`** (Ventana Emergente - Formulario)
   - Extracción del generador del reporte de turno (selectores de fecha, supervisor, hora).

## Código Eliminado y Reemplazado
Se erradicaron múltiples bloques masivos (más de 150 líneas de JSX consecutivos) por bloques declarativos atómicos en el JSX principal de `App.jsx`:
```jsx
<FilterControls uniqueClients={uniqueClients} />
<OrderGrid gridColsClass={...} paginatedGroups={...} />
{showCoordViewModal && <CoordViewModal deleteAlert={deleteAlert} />}
{showMaterialsAlertModal && <MaterialsAlertModal ... />}
{showReportConfigModal && <ReportConfigModal ... />}
```

Adicionalmente, se corrigieron las advertencias (ESLint Rules) relacionadas a la llamada síncrona de `setState` (`setCurrentPage(1)`) dentro de los efectos, y se restauraron las dependencias requeridas para la comunicación con los hooks extraídos en fases anteriores (`useVoiceInput`, `NotificationService`).

## Número Exacto de Líneas Finales
El archivo `src/App.jsx` se estabilizó reduciéndose **de 1362 líneas a 1079 líneas exactas**. Una reducción neta de **283 líneas** que pertenecen pura y físicamente a JSX extraído sin pérdida de funcionalidad ni estilos.
