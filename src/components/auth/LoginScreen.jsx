import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Sun, Moon, Info, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { AREAS } from '../../utils/constants';
import { purgeBrowserAuthArtifacts } from '../../supabaseClient';
import {
  validateLoginCredentials,
  validateRegisterInput
} from '../../utils/inputSecurity';
import { loginEnGoogle, registrarEnGoogle } from '../../services/api';
import CDILogo from '../ui/CDILogo';

const REGISTERABLE_AREAS = AREAS.filter((a) => a !== 'Administrador / Todos');

const LoginScreen = () => {
  const {
    setSupervisorProfile,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    setAreaFilter
  } = useAppContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fullName, setFullName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedArea, setSelectedArea] = useState(REGISTERABLE_AREAS[0] || '');
  // Mantiene los inputs en readOnly al montar para impedir autofill automático del navegador antes de interacción manual
  const [isInputUnlocked, setIsInputUnlocked] = useState(false);

  // En Chrome/Edge/Safari/WebView usar type="text" + -webkit-text-security evita el popup "¿Guardar contraseña?"
  const supportsWebkitTextSecurity = useMemo(() => {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.CSS !== 'undefined' &&
        typeof window.CSS.supports === 'function' &&
        window.CSS.supports('-webkit-text-security', 'disc')
      );
    } catch (_) {
      return false;
    }
  }, []);

  useEffect(() => {
    purgeBrowserAuthArtifacts();
    setUsernameInput('');
    setPasswordInput('');
    setFullName('');
    setIsInputUnlocked(false);
  }, [isRegistering]);

  const unlockInputsOnUserGesture = () => {
    if (!isInputUnlocked) setIsInputUnlocked(true);
  };

  const handleVirtualLogin = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isSubmitting) return;

    const validation = validateLoginCredentials({
      username: usernameInput,
      password: passwordInput
    });

    if (!validation.valid) {
      setAuthError(validation.error.toUpperCase());
      return;
    }

    setIsSubmitting(true);
    setAuthError("⏳ VERIFICANDO CREDENCIALES...");
    try {
      const res = await loginEnGoogle(validation.email, validation.password);

      if (res.success) {
        setAuthError("");
        const newProfile = {
          id: res.result.id || undefined,
          name: res.result.nombre,
          email: res.result.email || validation.email,
          area: res.result.rol,
          appRoles: res.result.appRoles || [],
          isAdmin: Boolean(res.result.isAdmin),
          isPaintSupervisor: Boolean(res.result.isPaintSupervisor)
        };

        // Limpiar credenciales de memoria inmediatamente y mantener sesión únicamente en RAM (0 storage en disco)
        setUsernameInput('');
        setPasswordInput('');
        purgeBrowserAuthArtifacts();
        setSupervisorProfile(newProfile);

        if (newProfile.area !== "Administrador / Todos" && AREAS.includes(newProfile.area)) {
          setAreaFilter(newProfile.area);
        }
      } else {
        setAuthError(res.error || "❌ NO SE PUDO INICIAR SESIÓN. VERIFICA TUS DATOS.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVirtualRegister = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (isSubmitting) return;

    const validation = validateRegisterInput({
      name: fullName,
      username: usernameInput,
      password: passwordInput,
      area: selectedArea
    });

    if (!validation.valid) {
      setAuthError(validation.error.toUpperCase());
      return;
    }

    setIsSubmitting(true);
    setAuthError("⏳ REGISTRANDO EN LA BÓVEDA SEGURA...");
    try {
      const res = await registrarEnGoogle(
        validation.email,
        validation.password,
        validation.name,
        validation.area
      );

      if (res.success) {
        setFullName('');
        setUsernameInput('');
        setPasswordInput('');
        setAuthError("✅ Registro Exitoso. Ahora puedes Iniciar Sesión.");
        setTimeout(() => { setIsRegistering(false); setAuthError(""); }, 3000);
      } else {
        setAuthError(res.error || "❌ NO SE PUDO COMPLETAR EL REGISTRO.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen theme-bg-main flex flex-col items-center justify-center p-4 transition-colors duration-300" data-theme={appTheme}>
      <div className="w-full max-w-md theme-bg-card rounded-[3rem] border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-500">
        <div className="p-8 text-center border-b theme-border theme-bg-header relative">
          <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="absolute top-4 right-4 p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-colors">{appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="flex justify-center mb-6 select-none py-2">
               <div className="flex justify-center">
                 <CDILogo className="scale-100 md:scale-110 origin-center" />
               </div>
            </div>
          <h2 className="theme-text-main font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2"><Lock size={"1.2em"}/> {isRegistering ? 'Registro Seguro' : 'Acceso Planta'}</h2>
        </div>
        
        {/* Contenedor sin <form> para bloquear heurísticas de autocompletado y el diálogo "¿Guardar contraseña?" del navegador */}
        <div
          role="region"
          aria-label={isRegistering ? 'Registro seguro de planta' : 'Acceso seguro de planta'}
          data-form-type="other"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isRegistering) {
                handleVirtualRegister(e);
              } else {
                handleVirtualLogin(e);
              }
            }
          }}
          className="p-8 space-y-5"
        >
          {authError && <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-300 p-3 rounded-xl text-base lg:text-lg font-bold uppercase flex items-center gap-2"><AlertCircle size={"1.2em"} className="shrink-0"/><span>{authError}</span></div>}
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Nombre Completo</label>
              <input
                name="cdi_nombre_personal"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={unlockInputsOnUserGesture}
                onPointerDown={unlockInputsOnUserGesture}
                readOnly={!isInputUnlocked}
                maxLength={80}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                required
                className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="EJ: JUAN PEREZ"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Usuario Corporativo</label>
            <div className="flex theme-bg-input rounded-2xl overflow-hidden border theme-border focus-within:ring-2 focus-within:ring-[var(--color-primary)] transition-colors">
              <input
                name="cdi_operador_acceso"
                type="text"
                inputMode="email"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onFocus={unlockInputsOnUserGesture}
                onPointerDown={unlockInputsOnUserGesture}
                readOnly={!isInputUnlocked}
                maxLength={100}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                data-bwignore="true"
                data-form-type="other"
                required
                className="w-full p-4 bg-transparent outline-none font-bold"
                placeholder="nombre.apellido"
              />
              <div className="px-3 sm:px-4 theme-bg-header theme-text-muted font-black text-base lg:text-lg sm:text-base lg:text-lg flex items-center select-none border-l theme-border">@cdiexhibiciones.co</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase">Clave Segura</label>
              <span className="text-base lg:text-lg font-bold theme-text-main uppercase flex items-center gap-1"><Info size={"1.2em"}/> Mín. 6 caracteres</span>
            </div>
            <input
              name="cdi_codigo_verificacion"
              type={supportsWebkitTextSecurity ? 'text' : 'password'}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onFocus={unlockInputsOnUserGesture}
              onPointerDown={unlockInputsOnUserGesture}
              readOnly={!isInputUnlocked}
              minLength={6}
              maxLength={128}
              autoComplete={supportsWebkitTextSecurity ? 'off' : 'new-password'}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              style={supportsWebkitTextSecurity ? { WebkitTextSecurity: 'disc' } : undefined}
              title="Mínimo 6 caracteres (letras y números)"
              required
              className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold tracking-widest text-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="••••••"
            />
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Área Asignada (Solo Registro)</label>
              <select
                name="cdi_area_operativa"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                required
                className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase text-base lg:text-lg focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {REGISTERABLE_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={isRegistering ? handleVirtualRegister : handleVirtualLogin}
            disabled={isSubmitting}
            className={`w-full bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase py-4 rounded-2xl shadow-xl hover:brightness-110 active:translate-y-1 border-b-4 transition-colors ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Procesando...' : (isRegistering ? 'Crear Perfil Seguro' : 'Ingresar al Sistema')}
          </button>
          <p className="text-center text-base lg:text-lg font-black theme-text-muted uppercase tracking-widest cursor-pointer hover:theme-text-main transition-colors" onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}>
            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿Nuevo supervisor? Registrarse'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
