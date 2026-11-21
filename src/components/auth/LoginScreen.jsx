import React, { useState, useEffect, useMemo } from 'react';
import { Lock, Sun, Moon, Info, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { AREAS } from '../../utils/constants';
import { purgeBrowserAuthArtifacts } from '../../supabaseClient';
import {
  validateLoginCredentials,
  validateRegisterInput
} from '../../utils/inputSecurity';
import { loginEnGoogle, registrarEnGoogle } from '../../services/api';

const REGISTERABLE_AREAS = AREAS.filter((a) => a !== 'Administrador / Todos');

const LoginScreen = () => {
  const {
    setSupervisorProfile,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    isDarkMode, setIsDarkMode,
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

  const handleToggleDark = () => {
    if (typeof setIsDarkMode === 'function') {
      setIsDarkMode(!isDarkMode);
    } else if (typeof setAppTheme === 'function') {
      setAppTheme(appTheme === 'dark' ? 'light' : 'dark');
    }
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
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F4F5F7] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors duration-300"
      data-theme={appTheme}
    >
      {/* Fondo sutil desenfocado en dispositivos móviles */}
      <div className="lg:hidden absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="/login-bg.jpg"
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="w-full h-full object-cover opacity-20 dark:opacity-15 blur-md scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1E293B]/30 via-[#F4F5F7]/85 to-[#F4F5F7] dark:from-[#0B1120]/70 dark:via-[#0B1120]/90 dark:to-[#0B1120]" />
      </div>

      {/* PANEL IZQUIERDO (55% en Desktop): Composición fotográfica digitalizada /login-bg.jpg con marco pizarra */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#1E293B] select-none items-center justify-center">
        {/* Fondo ambiental desenfocado para llenar bordes sin recortar el escudo central de la composición 768x1024 */}
        <img
          src="/login-bg.jpg"
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110 opacity-45"
        />
        {/* Imagen principal completa y nítida */}
        <img
          src="/login-bg.jpg"
          alt="CDI Exhibiciones — Tu espacio: de simple lugar a experiencia memorable"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
          className="relative z-10 w-full h-full object-contain object-center max-h-screen"
        />
        {/* Superposición pizarra #1E293B sutil en los bordes para contraste elegante sin tapar el escudo inferior */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 62%, rgba(30,41,59,0.58) 100%), linear-gradient(180deg, rgba(15,23,42,0.35) 0%, transparent 18%, transparent 84%, rgba(15,23,42,0.55) 100%)'
          }}
        />
        {/* Pie corporativo discreto en esquina inferior */}
        <div className="absolute bottom-4 left-6 right-6 z-30 flex items-center justify-between text-xs text-white/90 pointer-events-none">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F172A]/75 backdrop-blur-xs border border-[#D4AF37]/40">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
            <span className="font-semibold tracking-wider uppercase text-[11px]">
              CDI EXHIBICIONES · Sistema de Control Industrial
            </span>
          </div>
          <span className="hidden xl:inline-block px-2.5 py-1 rounded-md bg-[#0F172A]/70 backdrop-blur-xs border border-white/10 font-mono tabular-nums text-[11px] text-[#D4AF37]">
            @cdiexhibiciones.co
          </span>
        </div>
      </div>

      {/* PANEL DERECHO (45% en Desktop): Tarjeta / Panel limpio con Escudo Dorado 3D */}
      <div className="relative z-10 w-full lg:w-[45%] min-h-screen flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 bg-transparent lg:bg-[#FFFFFF] lg:dark:bg-[#0F172A] lg:border-l lg:border-[#E2E8F0] lg:dark:border-[#1E293B]">
        {/* Botón de cambio de modo claro / oscuro */}
        <button
          type="button"
          onClick={handleToggleDark}
          title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 transition-colors shadow-xs cursor-pointer"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-full max-w-md bg-white dark:bg-[#111827] lg:bg-transparent lg:dark:bg-transparent rounded-2xl lg:rounded-none border border-[#E2E8F0] dark:border-[#1E293B] lg:border-0 shadow-lg lg:shadow-none p-6 sm:p-8 lg:p-2">
          {/* Cabecera con el Nuevo Escudo Dorado 3D protagonista (h-28 sm:h-32) */}
          <div className="text-center mb-7">
            <div className="flex justify-center mb-4 select-none">
              <img
                src="/cdi-logo.png"
                alt="CDI Exhibiciones"
                className="h-28 sm:h-32 w-auto object-contain drop-shadow-lg mx-auto"
              />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-white">
              CDI EXHIBICIONES
            </h2>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
              <Lock size={13} className="text-[#B8860B] dark:text-[#D4AF37]" />
              {isRegistering
                ? 'Registro de Personal Operativo y Supervisores'
                : 'Ingreso al Sistema de Control de Planta'}
            </p>
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
            className="space-y-4"
          >
            {authError && (
              <div className="bg-[#FEF2F2] dark:bg-red-950/50 border border-[#FECACA] dark:border-red-800/70 text-[#991B1B] dark:text-red-300 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {isRegistering && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nombre Completo
                </label>
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
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-700 outline-none text-sm font-medium uppercase focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/30 transition-all placeholder:text-slate-400"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Usuario Corporativo
              </label>
              <div className="flex bg-white dark:bg-slate-900/90 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 focus-within:border-[#2E435B] focus-within:ring-2 focus-within:ring-[#D4AF37]/30 transition-all">
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
                  className="w-full px-3.5 py-2.5 bg-transparent outline-none text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  placeholder="nombre.apellido"
                />
                <div className="px-3 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 font-mono text-xs sm:text-sm font-medium flex items-center select-none border-l border-slate-200 dark:border-slate-700">
                  @cdiexhibiciones.co
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Clave de Acceso
                </label>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Info size={12} /> Mín. 6 caracteres
                </span>
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
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-700 outline-none font-semibold tracking-widest text-base focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/30 transition-all placeholder:text-slate-400"
                placeholder="••••••"
              />
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Área Operativa Asignada
                </label>
                <select
                  name="cdi_area_operativa"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 rounded-lg border border-slate-300 dark:border-slate-700 outline-none text-sm font-medium focus:border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/30 transition-all"
                >
                  {REGISTERABLE_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={isRegistering ? handleVirtualRegister : handleVirtualLogin}
              disabled={isSubmitting}
              className={`w-full bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-sm tracking-wide py-3 px-4 rounded-lg shadow-sm border border-[#2E435B] focus:ring-2 focus:ring-[#D4AF37]/40 transition-colors cursor-pointer ${
                isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting
                ? 'Verificando...'
                : isRegistering
                ? 'Crear Perfil Corporativo'
                : 'Ingresar al Sistema'}
            </button>

            <div className="pt-2 text-center border-t border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError('');
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1E293B] dark:hover:text-white transition-colors cursor-pointer"
              >
                {isRegistering
                  ? '¿Ya tienes cuenta activa? Iniciar sesión'
                  : '¿Nuevo supervisor u operario? Solicitar registro'}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 select-none">
            <ShieldCheck size={13} className="text-[#B8860B] dark:text-[#D4AF37]" />
            <span>Sesión protegida en memoria · Cero persistencia en equipo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
