import DOMPurify from 'dompurify';
import CryptoJS from 'crypto-js';

export const SESSION_SECRET = "cdi_industrial_vault_2026";

export const sanitizeInput = (text) => DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

export const deepSanitize = (obj) => {
    if (typeof obj === 'string') return sanitizeInput(obj);
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        for (let key in obj) newObj[key] = deepSanitize(obj[key]);
        return newObj;
    }
    return obj;
};

export const verifySignature = (profile, signature) => {
    if (!profile || !signature) return false;
    const expectedSig = CryptoJS.SHA256(JSON.stringify(profile) + SESSION_SECRET).toString();
    return expectedSig === signature;
};

export const signProfile = (profile) => {
    return CryptoJS.SHA256(JSON.stringify(profile) + SESSION_SECRET).toString();
};
