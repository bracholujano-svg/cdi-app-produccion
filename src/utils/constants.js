export const SUPERVISORES = [
    "DEYVIS BRACHO", "JUAN ESTEBAN", "GUILLERMO ALZATE", "ALEJANDRO", 
    "ELQUIN", "ELIANA SOTO", "DIANA", "CRISTIAN OSA", "CRISTINA", 
    "MARILU OSA", "YONI", "ELEXANDER ALZATE", "EDDY"
];

export const CONFIG_PROCESOS = {
    "Administrador / Todos": ["Control Total"],
    "Comercial / Ventas": ["Ingreso de Pedido", "Validación Técnica"],
    "Diseño": ["En Espera", "Diseño", "Elaboración de Planos"],
    "Programación CNC": ["En Espera", "Programación de Máquinas CNC"],
    "Corte y Mecanizado CNC de Madera": ["En Espera", "Corte Seccionadora", "Corte Escuadradora", "Mecanizado Venture", "Mecanizado BMG", "Mecanizado 612", "Enchape de Cantos"],
    "Ebanistería": ["En Espera", "Banco de Ebanistería", "Enchape", "Conformado", "Armado de Corian"],
    "Pintura Líquida": ["En Espera", "Pulido en Crudo", "Base 1", "Pulido de Base 1", "Base 2", "Pulido de Base 2", "Sellado", "Acabado"],
    "Corte y Dobles de Lámina y Tubería CNC": ["En Espera", "Corte Láser", "Punzonado", "Dobles", "Conformados Especiales"],
    "Área de Soldadura": ["En Espera", "Proceso de Soldadura", "Rolado y Soldadura", "Pulido y Grateado"],
    "Área de Torno Convencional y CNC": ["En Espera", "En Proceso"],
    "Pintura en Polvo": ["Limpieza", "Decapado", "Lavado Toran", "Para Pintar"],
    "Ensamble": ["En Espera", "En Banco de Ensamble", "Termo Conformado", "Láser de Acrílico"],
    "Corte y Mecanizado de Vidrio": ["En Espera", "Corte", "Mecanizado y Biselado", "Almacenado"],
    "Empaque": ["En Espera", "Para Empacar"],
    "Despachos": ["En Espera para Despacho", "DESPACHADO"]
};

export const AREAS_RECEPCION = Object.keys(CONFIG_PROCESOS).filter(a => a !== "Administrador / Todos");
export const AREAS = Object.keys(CONFIG_PROCESOS);

export const AREAS_ADMIN = [
    "Comercial / Ventas",
    "Diseño",
    "Programación CNC"
];

export const AREAS_PRIMARIAS = [
    "Corte y Mecanizado CNC de Madera",
    "Corte y Dobles de Lámina y Tubería CNC",
    "Corte y Mecanizado de Vidrio"
];

export const AREAS_SECUNDARIAS = [
    "Ebanistería",
    "Área de Soldadura",
    "Área de Torno Convencional y CNC",
    "Pintura en Polvo",
    "Pintura Líquida"
];

export const AREAS_FINALES = [
    "Ensamble",
    "Empaque",
    "Despachos"
];

export const AREAS_PLANTA = AREAS_RECEPCION.filter(a => !AREAS_ADMIN.includes(a));
