import { useCallback } from 'react';
import { compressImageForUpload } from '../utils/imageCompression';

export const useImageProcessor = () => {
    const handleImageUpload = useCallback(async (e, setter) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const compressed = await compressImageForUpload(file, {
                maxDimension: 800,
                quality: 0.72,
                maxTargetKB: 120,
                preferWebp: true
            });
            if (compressed) {
                setter(compressed);
            }
        } catch (err) {
            console.error('Error comprimiendo evidencia fotográfica:', err);
        }
    }, []);

    return { handleImageUpload };
};
