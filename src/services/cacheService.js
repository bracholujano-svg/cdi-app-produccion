// src/services/cacheService.js
// Servicio de Caché y Almacenamiento Local
// Utiliza IndexedDB (vía localforage) para reducir el tiempo de carga de catálogos masivos a 0ms.

import localforage from 'localforage';

// Configurar la instancia de la base de datos local
const db = localforage.createInstance({
  name: 'CDI_Database',
  storeName: 'app_cache',
  description: 'Almacenamiento persistente offline para la aplicación CDI'
});

/**
 * Patrón Stale-While-Revalidate:
 * Intenta devolver instantáneamente los datos de la memoria local.
 * En paralelo (background), va al servidor a buscar datos frescos y actualiza la caché.
 * 
 * @param {string} cacheKey - Identificador único del recurso (ej. 'full_inventory')
 * @param {Function} fetchFunction - Promesa/Función que trae los datos de Supabase
 * @returns {Promise<any>} Datos locales (inmediatos) o del servidor (si no hay caché)
 */
export const getCachedData = async (cacheKey, fetchFunction) => {
  try {
    // 1. Obtener de caché local instantáneamente
    const cachedData = await db.getItem(cacheKey);

    // 2. Disparar consulta silenciosa al servidor para actualizar la caché de fondo
    fetchFunction().then(async (freshData) => {
      if (freshData && freshData.length > 0) {
        await db.setItem(cacheKey, freshData);
      }
    }).catch(error => {
      console.warn(`[CacheService] Fallo sincronización silenciosa para ${cacheKey}:`, error);
    });

    // 3. Retornar caché si existe, sino esperar a la consulta real
    if (cachedData) {
      console.log(`[CacheService] Servido desde caché local: ${cacheKey}`);
      return cachedData;
    }

    console.log(`[CacheService] Sin caché local. Esperando red para: ${cacheKey}`);
    const data = await fetchFunction();
    await db.setItem(cacheKey, data);
    return data;

  } catch (error) {
    console.error(`[CacheService] Error crítico accediendo a IndexedDB:`, error);
    // Fallback: Si IndexedDB falla, actuar como si no existiera e ir directo a la red
    return await fetchFunction();
  }
};

/**
 * Limpia una llave específica de la caché o toda la base de datos si no se pasa parámetro.
 */
export const clearCache = async (cacheKey = null) => {
  if (cacheKey) {
    await db.removeItem(cacheKey);
  } else {
    await db.clear();
  }
};
