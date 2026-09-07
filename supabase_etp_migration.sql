-- FASE 1: Modificación del Esquema de Base de Datos (Supabase)

-- 1. Agregar campos a colores_aprobados
ALTER TABLE colores_aprobados 
ADD COLUMN sustrato_muestra text,
ADD COLUMN tolerancia_delta_e text,
ADD COLUMN porcentaje_pasta_mateante text,
ADD COLUMN catalizador_tipo text,
ADD COLUMN catalizador_pct text,
ADD COLUMN disolvente_tipo text,
ADD COLUMN disolvente_pct text,
ADD COLUMN procedimiento_preparacion jsonb,
ADD COLUMN creado_por_id uuid,
ADD COLUMN aprobado_por_id uuid,
ADD COLUMN estado_aprobacion text DEFAULT 'borrador';

-- 2. Habilitar y Configurar Row Level Security (RLS) en colores_aprobados
ALTER TABLE colores_aprobados ENABLE ROW LEVEL SECURITY;

-- Política 1: Los operarios solo pueden crear registros y editar aquellos en estado borrador.
-- Nota: Para simplificar, asumiremos que todos pueden INSERTAR y SELECT. Las restricciones fuertes van sobre el UPDATE.
CREATE POLICY "Permitir select a todos los usuarios autenticados"
ON colores_aprobados FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir insert a todos los usuarios autenticados"
ON colores_aprobados FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política 2: Los operarios (cualquiera) solo pueden actualizar si está en borrador. 
-- El supervisor_pintura_liquida puede actualizar en cualquier estado.
-- Asumiendo que usamos auth.jwt() -> 'role' u otra tabla de roles. Para este ejemplo, validaremos usando metadatos.
CREATE POLICY "Permitir update condicional según rol y estado"
ON colores_aprobados FOR UPDATE
TO authenticated
USING (
  estado_aprobacion = 'borrador' 
  OR (auth.jwt() ->> 'role' = 'supervisor_pintura_liquida')
  OR (auth.jwt() -> 'app_metadata' ->> 'rol' = 'supervisor_pintura_liquida')
)
WITH CHECK (
  estado_aprobacion = 'borrador' 
  OR (auth.jwt() ->> 'role' = 'supervisor_pintura_liquida')
  OR (auth.jwt() -> 'app_metadata' ->> 'rol' = 'supervisor_pintura_liquida')
);

-- Si deseas manejar los roles en una tabla personalizada 'perfiles':
-- (Puedes adaptar esta regla si usas una tabla perfiles en public.perfiles)
