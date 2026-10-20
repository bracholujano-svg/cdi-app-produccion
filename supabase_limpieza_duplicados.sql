-- =====================================================================================
-- SCRIPT SQL DE DEPURACIÓN DE DUPLICADOS Y LIMPIEZA DE PLANTA (RIBISOFT / SUPABASE)
-- =====================================================================================
-- Instrucciones: Copia y pega este bloque completo en el "SQL Editor" de Supabase
-- y haz clic en "Run".
-- =====================================================================================

BEGIN;

-- 1. RETIRAR DE produccion_pedidos LOS 1,019 PEDIDOS VOLCADOS DEL EXCEL QUE NO FUERON
--    INGRESADOS EXPLÍCITAMENTE A PLANTA POR LOS USUARIOS (CONSERVANDO INTACTOS LOS REALES)
DELETE FROM public.produccion_pedidos
WHERE (
    data_completa->'historial'->0->>'entrega' = 'ERP RIBISOFT'
    OR data_completa->'historial'->0->>'accion' = 'Importación ERP Ribisoft (Ingreso Inicial)'
)
AND COALESCE(jsonb_array_length(data_completa->'historial'), 0) <= 1
AND COALESCE(jsonb_array_length(data_completa->'bitacoraTurnos'), 0) = 0
AND COALESCE(jsonb_array_length(data_completa->'bitacoraCalidad'), 0) = 0
AND COALESCE(data_completa->>'areaActual', 'Diseño') = 'Diseño'
AND COALESCE(data_completa->>'estadoInterno', '') <> 'DESPACHADO';

-- 2. COMPLETAR "Código Ítem" EN ribisoft_pedidos DESDE requerimientos_pedido (DONDE ESTÉ VACÍO)
UPDATE public.ribisoft_pedidos r
SET "Código Ítem" = req.codpt
FROM (
    SELECT DISTINCT ON (TRIM(pedido_sin), UPPER(REGEXP_REPLACE(TRIM(producto), '\s+', ' ', 'g')))
        TRIM(pedido_sin) AS p_sin,
        UPPER(REGEXP_REPLACE(TRIM(producto), '\s+', ' ', 'g')) AS prod_norm,
        TRIM(codpt) AS codpt
    FROM public.requerimientos_pedido
    WHERE pedido_sin IS NOT NULL
      AND codpt IS NOT NULL
      AND TRIM(codpt) <> ''
      AND producto IS NOT NULL
) req
WHERE (r."Código Ítem" IS NULL OR TRIM(r."Código Ítem") = '')
  AND TRIM(r."PedidoSIN") = req.p_sin
  AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(r."Descripción", '')), '\s+', ' ', 'g')) = req.prod_norm;

-- 3. ELIMINAR DUPLICADOS EN ribisoft_pedidos (CONSERVANDO SIEMPRE LA FILA QUE SÍ TIENE "Código Ítem")
WITH ranked_ribisoft AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                TRIM(COALESCE("PedidoSIN", '')),
                UPPER(REGEXP_REPLACE(TRIM(COALESCE("Descripción", '')), '\s+', ' ', 'g'))
            ORDER BY
                CASE WHEN NULLIF(TRIM(COALESCE("Código Ítem", '')), '') IS NOT NULL THEN 0 ELSE 1 END ASC,
                id DESC
        ) AS rn
    FROM public.ribisoft_pedidos
)
DELETE FROM public.ribisoft_pedidos
WHERE id IN (
    SELECT id FROM ranked_ribisoft WHERE rn > 1
);

-- Garantizar unicidad también por ("PedidoSIN" + "Código Ítem")
WITH ranked_ribisoft_code AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                TRIM(COALESCE("PedidoSIN", '')),
                TRIM("Código Ítem")
            ORDER BY id DESC
        ) AS rn
    FROM public.ribisoft_pedidos
    WHERE NULLIF(TRIM(COALESCE("Código Ítem", '')), '') IS NOT NULL
)
DELETE FROM public.ribisoft_pedidos
WHERE id IN (
    SELECT id FROM ranked_ribisoft_code WHERE rn > 1
);

-- 4. COMPLETAR codigo_item EN LOS PRODUCTOS REALES DE produccion_pedidos
UPDATE public.produccion_pedidos p
SET
    codigo_item = req.codpt,
    data_completa = jsonb_set(
        jsonb_set(COALESCE(p.data_completa, '{}'::jsonb), '{codArticulo}', to_jsonb(req.codpt::text), true),
        '{codigo_item}', to_jsonb(req.codpt::text), true
    )
FROM (
    SELECT DISTINCT ON (TRIM(pedido_sin), UPPER(REGEXP_REPLACE(TRIM(producto), '\s+', ' ', 'g')))
        TRIM(pedido_sin) AS p_sin,
        UPPER(REGEXP_REPLACE(TRIM(producto), '\s+', ' ', 'g')) AS prod_norm,
        TRIM(codpt) AS codpt
    FROM public.requerimientos_pedido
    WHERE pedido_sin IS NOT NULL
      AND codpt IS NOT NULL
      AND TRIM(codpt) <> ''
      AND producto IS NOT NULL
) req
WHERE (p.codigo_item IS NULL OR TRIM(p.codigo_item) = '')
  AND TRIM(COALESCE(p.data_completa->>'pedidoNum', p.pedido_num, '')) = req.p_sin
  AND UPPER(REGEXP_REPLACE(TRIM(COALESCE(p.data_completa->>'nombre', p.data_completa->>'descripcion', '')), '\s+', ' ', 'g')) = req.prod_norm;

-- 5. LIMPIAR FILAS HUÉRFANAS Y DUPLICADAS EN requerimientos_pedido
DELETE FROM public.requerimientos_pedido
WHERE pedido_sin IS NULL
   OR TRIM(pedido_sin) = ''
   OR idreferencia IS NULL
   OR TRIM(idreferencia) = '';

WITH ranked_reqs AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY
                TRIM(pedido_sin),
                COALESCE(TRIM(codpt), ''),
                UPPER(REGEXP_REPLACE(TRIM(COALESCE(producto, '')), '\s+', ' ', 'g')),
                TRIM(idreferencia),
                UPPER(TRIM(COALESCE(numero_rq, '')))
            ORDER BY
                CASE WHEN NULLIF(TRIM(COALESCE(codpt, '')), '') IS NOT NULL THEN 0 ELSE 1 END ASC,
                CASE WHEN NULLIF(TRIM(COALESCE(referencia, '')), '') IS NOT NULL THEN 0 ELSE 1 END ASC,
                id DESC
        ) AS rn
    FROM public.requerimientos_pedido
)
DELETE FROM public.requerimientos_pedido
WHERE id IN (
    SELECT id FROM ranked_reqs WHERE rn > 1
);

-- 6. CREAR ÍNDICES ÚNICOS PARA IMPEDIR FUTUROS DUPLICADOS EN POSTGRESQL
CREATE UNIQUE INDEX IF NOT EXISTS idx_ribisoft_pedidos_unico_pedido_desc
ON public.ribisoft_pedidos (
    TRIM(COALESCE("PedidoSIN", '')),
    UPPER(REGEXP_REPLACE(TRIM(COALESCE("Descripción", '')), '\s+', ' ', 'g'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_requerimientos_pedido_unico
ON public.requerimientos_pedido (
    TRIM(pedido_sin),
    COALESCE(TRIM(codpt), ''),
    UPPER(REGEXP_REPLACE(TRIM(COALESCE(producto, '')), '\s+', ' ', 'g')),
    TRIM(idreferencia),
    UPPER(TRIM(COALESCE(numero_rq, '')))
)
WHERE pedido_sin IS NOT NULL AND idreferencia IS NOT NULL;

COMMIT;
