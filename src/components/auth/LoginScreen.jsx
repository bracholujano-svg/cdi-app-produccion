import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { Lock, Sun, Moon, Info, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { safeStorage, safeSessionStorage } from '../../utils/helpers';
import { AREAS } from '../../utils/constants';
import { SESSION_SECRET } from '../../utils/security';
import {
  validateLoginCredentials,
  validateRegisterInput,
  sanitizePlantText
} from '../../utils/inputSecurity';
import { loginEnGoogle, registrarEnGoogle } from '../../services/api';
import CDILogo from '../ui/CDILogo';

const LoginScreen = () => {
  const {
    supervisorProfile, setSupervisorProfile,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    savedLogins, setSavedLogins,
    setAreaFilter
  } = useAppContext();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVirtualLogin = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateLoginCredentials({
      username: e.target.username?.value || '',
      password: e.target.password?.value || ''
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
        const signature = CryptoJS.SHA256(JSON.stringify(newProfile) + SESSION_SECRET).toString();
        
        setSupervisorProfile(newProfile);
        safeSessionStorage.set('cdi_supervisor_session', JSON.stringify({ profile: newProfile, signature }));
        
        const userShort = validation.usernameClean;
        const newRecent = [{ username: userShort, name: newProfile.name }, ...savedLogins.filter(u => u?.username !== userShort)].slice(0, 3);
        setSavedLogins(newRecent); 
        safeStorage.set('cdi_recent_logins', JSON.stringify(newRecent));
        
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
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateRegisterInput({
      name: e.target.name?.value || '',
      username: e.target.username?.value || '',
      password: e.target.password?.value || '',
      area: e.target.area ? e.target.area.value : ''
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
        
        <form onSubmit={isRegistering ? handleVirtualRegister : handleVirtualLogin} className="p-8 space-y-5">
          {savedLogins.length > 0 && !isRegistering && (
             <div className="flex flex-wrap gap-2 justify-center mb-4">
               {savedLogins.map((u, i) => (
                 <button type="button" key={i} onClick={() => { const inp = document.getElementsByName('username')[0]; if (inp) inp.value = sanitizePlantText(u?.username || '', { maxLength: 64, allowNewlines: false }); }} className="bg-[var(--color-primary)]/10 theme-text-main px-3 py-1.5 rounded-xl text-base lg:text-lg font-black border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/20 transition-colors">
                   {u?.name?.split(' ')[0]}
                 </button>
               ))}
             </div>
          )}

          {authError && <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-300 p-3 rounded-xl text-base lg:text-lg font-bold uppercase flex items-center gap-2"><AlertCircle size={"1.2em"} className="shrink-0"/><span>{authError}</span></div>}
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Nombre Completo</label>
              <input name="name" maxLength={80} required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="EJ: JUAN PEREZ" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Usuario Corporativo</label>
            <div className="flex theme-bg-input rounded-2xl overflow-hidden border theme-border focus-within:ring-2 focus-within:ring-[var(--color-primary)] transition-colors">
              <input name="username" type="text" maxLength={100} autoComplete="username" required className="w-full p-4 bg-transparent outline-none font-bold" placeholder="nombre.apellido" />
              <div className="px-3 sm:px-4 theme-bg-header theme-text-muted font-black text-base lg:text-lg sm:text-base lg:text-lg flex items-center select-none border-l theme-border">@cdiexhibiciones.co</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase">Clave Segura</label>
              <span className="text-base lg:text-lg font-bold theme-text-main uppercase flex items-center gap-1"><Info size={"1.2em"}/> Mín. 6 caracteres</span>
            </div>
            <input name="password" type="password" minLength={6} maxLength={128} autoComplete={isRegistering ? 'new-password' : 'current-password'} title="Mínimo 6 caracteres (letras y números)" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold tracking-widest text-lg focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="••••••" />
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-base lg:text-lg font-black theme-text-muted uppercase ml-1">Área Asignada (Solo Registro)</label>
              <select name="area" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase text-base lg:text-lg focus:ring-2 focus:ring-[var(--color-primary)]">
                {AREAS.filter(a => a !== 'Administrador / Todos').map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className={`w-full bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase py-4 rounded-2xl shadow-xl hover:brightness-110 active:translate-y-1 border-b-4 transition-colors ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {isSubmitting ? 'Procesando...' : (isRegistering ? 'Crear Perfil Seguro' : 'Ingresar al Sistema')}
          </button>
          <p className="text-center text-base lg:text-lg font-black theme-text-muted uppercase tracking-widest cursor-pointer hover:theme-text-main transition-colors" onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}>
            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿Nuevo supervisor? Registrarse'}
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
