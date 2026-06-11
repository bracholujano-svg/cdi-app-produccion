import React from 'react';
import CryptoJS from 'crypto-js';
import { Lock, Sun, Moon, Info, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { safeStorage, safeSessionStorage } from '../../utils/helpers';
import { AREAS } from '../../utils/constants';
import { SESSION_SECRET } from '../../utils/security';
import { loginEnGoogle, registrarEnGoogle } from '../../services/api';

const LoginScreen = () => {
  const {
    supervisorProfile, setSupervisorProfile,
    isRegistering, setIsRegistering,
    authError, setAuthError,
    appTheme, setAppTheme,
    savedLogins, setSavedLogins,
    setAreaFilter
  } = useAppContext();

  const handleVirtualLogin = async (e) => {
    e.preventDefault(); 
    setAuthError("⏳ VERIFICANDO CREDENCIALES EN GOOGLE..."); 
    const userStr = e.target.username.value.trim().toLowerCase();
    const passStr = e.target.password.value.trim();
    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;

    const res = await loginEnGoogle(emailFull, passStr);
    
    if (res.success) {
      setAuthError("");
      const newProfile = { name: res.result.nombre, email: emailFull, area: res.result.rol };
      const signature = CryptoJS.SHA256(JSON.stringify(newProfile) + SESSION_SECRET).toString();
      
      setSupervisorProfile(newProfile);
      safeSessionStorage.set('cdi_supervisor_session', JSON.stringify({ profile: newProfile, signature }));
      
      const newRecent = [{ username: userStr, name: newProfile.name }, ...savedLogins.filter(u => u?.username !== userStr)].slice(0, 3);
      setSavedLogins(newRecent); 
      safeStorage.set('cdi_recent_logins', JSON.stringify(newRecent));
      
      if (newProfile.area !== "Administrador / Todos" && AREAS.includes(newProfile.area)) {
        setAreaFilter(newProfile.area);
      }
    } else {
      setAuthError(res.error);
    }
  };

  const handleVirtualRegister = async (e) => {
    e.preventDefault(); 
    setAuthError("⏳ REGISTRANDO EN LA BÓVEDA DE GOOGLE...");
    const name = e.target.name.value.trim().toUpperCase();
    const userStr = e.target.username.value.trim().toLowerCase();
    const pass = e.target.password.value.trim();
    const area = e.target.area ? e.target.area.value : 'Pendiente';
    
    if (!/^\d+$/.test(pass) || pass.length < 6) {
      setAuthError("El PIN debe ser numérico y mínimo de 6 dígitos."); 
      return;
    }
    
    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;
    const res = await registrarEnGoogle(emailFull, pass, name, area);
    
    if (res.success) {
      setAuthError("✅ Registro Exitoso. Ahora puedes Iniciar Sesión.");
      setTimeout(() => { setIsRegistering(false); setAuthError(""); }, 3000);
    } else {
      setAuthError(res.error);
    }
  };

  return (
    <div className="min-h-screen theme-bg-main flex flex-col items-center justify-center p-4 transition-colors duration-300" data-theme={appTheme}>
      <div className="w-full max-w-md theme-bg-card rounded-[3rem] border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-500">
        <div className="p-8 text-center border-b theme-border theme-bg-header relative">
          <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="absolute top-4 right-4 p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all">{appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="flex items-center justify-center gap-2 mb-4 select-none">
             <span className="text-5xl font-normal tracking-[-0.04em] leading-none text-[var(--primary)] transform scale-y-[1.1]" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>CDI</span>
             <div className="w-[3px] h-[40px] bg-current opacity-30 rounded-full mx-2"></div>
             <div className="flex flex-col text-left justify-center">
               <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-bold leading-none tracking-[0.2em] theme-text-muted mb-[2px]">DISEÑO EN</span>
               <span className="text-[12px] font-black leading-none tracking-[0.05em] text-[var(--primary)]">EXHIBICIÓN</span>
             </div>
          </div>
          <h2 className="text-[var(--accent)] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2"><Lock size={"1.2em"}/> {isRegistering ? 'Registro Seguro' : 'Acceso Planta'}</h2>
        </div>
        
        <form onSubmit={isRegistering ? handleVirtualRegister : handleVirtualLogin} className="p-8 space-y-5">
          {savedLogins.length > 0 && !isRegistering && (
             <div className="flex flex-wrap gap-2 justify-center mb-4">
               {savedLogins.map((u, i) => (
                 <button type="button" key={i} onClick={() => { document.getElementsByName('username')[0].value = u.username; }} className="bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1.5 rounded-xl text-xs md:text-sm lg:text-base font-black border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20 transition-colors">
                   {u?.name?.split(' ')[0]}
                 </button>
               ))}
             </div>
          )}

          {authError && <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-300 p-3 rounded-xl text-xs md:text-sm lg:text-base font-bold uppercase flex items-center gap-2"><AlertCircle size={"1.2em"} className="shrink-0"/><span>{authError}</span></div>}
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase ml-1">Nombre Completo</label>
              <input name="name" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase focus:ring-2 focus:ring-[var(--accent)]" placeholder="EJ: JUAN PEREZ" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase ml-1">Usuario Corporativo</label>
            <div className="flex theme-bg-input rounded-2xl overflow-hidden border theme-border focus-within:ring-2 focus-within:ring-[var(--accent)] transition-all">
              <input name="username" type="text" required className="w-full p-4 bg-transparent outline-none font-bold" placeholder="nombre.apellido" />
              <div className="px-3 sm:px-4 theme-bg-header theme-text-muted font-black text-xs md:text-sm lg:text-base sm:text-xs md:text-sm lg:text-base flex items-center select-none border-l theme-border">@cdiexhibiciones.co</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase">Clave / PIN</label>
              <span className="text-xs md:text-sm lg:text-base font-bold text-[var(--accent)] uppercase flex items-center gap-1"><Info size={"1.2em"}/> Mín. 6 dígitos</span>
            </div>
            <input name="password" type="password" inputMode="numeric" pattern="[0-9]{6,}" title="Debe contener al menos 6 números" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold tracking-widest text-lg focus:ring-2 focus:ring-[var(--accent)]" placeholder="••••••" />
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase ml-1">Área Asignada (Solo Registro)</label>
              <select name="area" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase text-xs md:text-sm lg:text-base focus:ring-2 focus:ring-[var(--accent)]">
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <button type="submit" className="w-full bg-[var(--accent)] text-[var(--card-bg)] font-black uppercase py-4 rounded-2xl shadow-xl hover:brightness-110 active:translate-y-1 border-b-4  transition-all">
            {isRegistering ? 'Crear Perfil Seguro' : 'Ingresar al Sistema'}
          </button>
          <p className="text-center text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase tracking-widest cursor-pointer hover:text-[var(--accent)] transition-colors" onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}>
            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿Nuevo supervisor? Registrarse'}
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
