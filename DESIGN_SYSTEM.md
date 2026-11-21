# Sistema de Diseño Corporativo — CDI Exhibiciones

Guía oficial de identidad visual, tokens de color, tipografía y componentes UI para la plataforma industrial de **CDI Exhibiciones**. Estilo **SaaS Industrial Moderno**: limpio, sobrio, técnico y de alta legibilidad en planta y oficina.

---

## 1. Paleta de Colores Oficial (Tokens)

### Identidad y Marca
| Token | Hex | Uso Autorizado |
| :--- | :--- | :--- |
| **Primario Corporativo** | `#1E293B` | Botones primarios, pestaña activa en *segmented controls*, encabezados principales y badges activos. |
| **Primario Hover** | `#0F172A` | Estado `:hover` / `:active` de acciones primarias y paneles profundos. |
| **Azul Pizarra Marca** | `#2E435B` | Bordes de foco en inputs (`focus:border-[#2E435B]`), acentos secundarios y cabeceras técnicas. |
| **Acento Dorado Escudo** | `#B8860B` / `#D4AF37` | **Solo micro-acentos**: anillos de foco (`focus:ring-[#D4AF37]/30`), filetes sutiles de marca e iconografía destacada. *Prohibido usar en bloques grandes o fondos chillones.* |

### Superficies y Bordes (Sin Neumorfismo Grueso)
| Elemento | Modo Claro | Modo Oscuro | Regla de Elevación |
| :--- | :--- | :--- | :--- |
| **Fondo Principal (`base`)** | `#F4F5F7` | `#0B1120` | Superficie mate de descanso visual. |
| **Tarjetas y Paneles (`surface`)** | `#FFFFFF` | `#111827` | Contenedores planos `rounded-xl` con sombra sutil (`shadow-xs` / `shadow-sm`). |
| **Borde Estándar (`border`)** | `1px solid #E2E8F0` | `1px solid #1E293B` | Hover en tarjetas: `hover:border-slate-300` / `dark:hover:border-slate-700`. |
| **Texto Principal** | `#0F172A` | `#F8FAFC` | Alto contraste WCAG AA/AAA. |
| **Texto Secundario (`muted`)** | `#475569` | `#94A3B8` | Metadatos, etiquetas y subtítulos. |

---

## 2. Estados de Planta e Insumos (*Soft Pills*)

Todos los estados operativos y alertas de materiales deben representarse como **píldoras suaves (*soft pills*)** con borde fino y un **indicador de punto de color (`6px`)** a la izquierda:

| Estado Operativo | Fondo (Claro) | Texto (Claro) | Borde (Claro) | Punto Indicador | Equivalente Oscuro |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Óptimo / Completo / Despachado** | `#ECFDF5` | `#065F46` | `#A7F3D0` | `#10B981` | `bg-emerald-950/45 text-emerald-300 border-emerald-800/60` |
| **En Proceso / Pendiente / Alerta** | `#FFFBEB` | `#92400E` | `#FDE68A` | `#F59E0B` | `bg-amber-950/45 text-amber-300 border-amber-800/60` |
| **Crítico / Sin Stock / Atraso** | `#FEF2F2` | `#991B1B` | `#FECACA` | `#EF4444` | `bg-red-950/45 text-red-300 border-red-800/60` |
| **Neutro / Área Operativa** | `#F1F5F9` | `#334155` | `#E2E8F0` | `#64748B` | `bg-slate-800/80 text-slate-200 border-slate-700` |

---

## 3. Tipografía y Reglas Numéricas

- **Familia principal:** `'Outfit', sans-serif` para interfaz general y encabezados; `ui-monospace` para códigos técnicos.
- **Números tabulares obligatorios (`tabular-nums`):**
  - Todo número de pedido (`PED: 64354`), código de artículo (`33000072`), cantidad, porcentaje de avance, contador de pestañas y fecha (`17/11`) debe incluir la clase `tabular-nums` para alineación vertical perfecta en tablas y tarjetas.
- **Jerarquía y pesos:**
  - Evitar el abuso de `font-black uppercase` en textos largos, nombres de clientes extensos o notas de planta.
  - Usar `font-semibold` o `font-bold` para títulos y `font-medium` para controles y etiquetas operativas.

---

## 4. Activos Oficiales de Marca

- **Escudo Oficial:** `/cdi-logo.png` (Escudo dorado 3D de CDI Exhibiciones).
  - En `Header.jsx`: renderizar con `h-10 w-auto object-contain drop-shadow-sm` acompañado a la derecha por la marca tipográfica **`CDI EXHIBICIONES`**.
  - En `LoginScreen.jsx`: renderizar como elemento protagonista del panel derecho (`h-24 w-auto object-contain drop-shadow-md`).
- **Fondo de Acceso (Login Split-Screen):** `/login-bg.jpg` en el panel izquierdo (55% en desktop) con encuadre `object-cover` y superposición pizarra `#1E293B` en los bordes.

---

## 5. Patrones de Componentes

1. **Navegación Superior (*Segmented Control*):**
   - Contenedor unificado `bg-[#F4F5F7] dark:bg-[#0B1120] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]`.
   - Pestaña activa: `bg-[#1E293B] text-white shadow-xs` con contador `tabular-nums`.
   - Pestañas inactivas: fondo transparente, texto `#475569` (`dark:text-slate-300`) y hover suave.
2. **Inputs y Formularios:**
   - `rounded-lg border border-slate-300 dark:border-slate-700 focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/30 outline-none transition-all`.
3. **Tarjetas de Producción (`OrderCard`):**
   - `rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs hover:shadow-md hover:border-slate-300 transition-all`.
   - Badges de áreas uniformes en la parte inferior con conteo `tabular-nums`.
