import { useEffect, useRef, useState, useCallback } from 'react';

export const useVoiceInput = (onResult) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const activeTargetRef = useRef(null);
    const onResultRef = useRef(onResult);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'es-CO';
            
            recognition.onresult = (event) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                }
                if (finalTranscript && onResultRef.current) {
                    onResultRef.current(activeTargetRef.current, finalTranscript);
                }
            };
            
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (e) => { alert("Error de micrófono: " + (e.error || e.message || "Desconocido")); setIsListening(false); };
            recognitionRef.current = recognition;
        }
    }, []);

    const toggleMic = useCallback((target) => {
        if (!recognitionRef.current) { alert("El dictado por voz no es compatible con este navegador o faltan permisos."); return; }
        if (isListening) { 
            recognitionRef.current.stop(); 
            setIsListening(false); 
        } else { 
            activeTargetRef.current = target; 
            recognitionRef.current.start(); 
            setIsListening(true); 
        }
    }, [isListening]);

    return { isListening, toggleMic, activeDictationTarget: activeTargetRef };
};
