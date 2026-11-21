import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface AuthViewProps {
  initialResetToken?: string;
  onClearResetToken?: () => void;
}

function tryStoreBrowserCredential(identifier: string, password: string): void {
  try {
    if (
      typeof window !== 'undefined' &&
      'PasswordCredential' in window &&
      navigator.credentials &&
      typeof navigator.credentials.store === 'function'
    ) {
      const CredCtor = (window as any).PasswordCredential;
      const cred = new CredCtor({
        id: identifier,
        password,
      });
      Promise.resolve(navigator.credentials.store(cred)).catch(() => {});
    }
  } catch {
    // Ignore unsupported credential API environments
  }
}

export const AuthView: React.FC<AuthViewProps> = ({
  initialResetToken = '',
  onClearResetToken,
}) => {
  const { login, register, isAuthenticated, logout } = useApp();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(
    initialResetToken ? 'reset' : 'login'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form state (clean, no hardcoded credentials)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('+221 ');
  const [regEmail, setRegEmail] = useState('');
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regStoreName, setRegStoreName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState('');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');

  // Reset password form state
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetValidationState, setResetValidationState] = useState<
    'idle' | 'checking' | 'valid' | 'invalid'
  >(initialResetToken ? 'checking' : 'idle');
  const [resetValidationError, setResetValidationError] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetSubmitError, setResetSubmitError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  const clearUrlResetToken = () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('reset_token')) {
        url.searchParams.delete('reset_token');
        const nextUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
        window.history.replaceState({}, '', nextUrl);
      }
    } catch {
      // ignore history errors
    }
    onClearResetToken?.();
  };

  useEffect(() => {
    const tokenFromUrl =
      initialResetToken ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('reset_token') || ''
        : '');

    if (!tokenFromUrl) return;

    setResetToken(tokenFromUrl);
    setMode('reset');
    setResetValidationState('checking');
    setResetValidationError('');
    setResetSuccessMessage('');
    setResetSubmitError('');

    let active = true;
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(tokenFromUrl)}`, {
      credentials: 'include',
    })
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        if (!active) return;
        if (resp.ok && data?.valid) {
          setResetValidationState('valid');
        } else {
          setResetValidationState('invalid');
          setResetValidationError(
            data?.error || 'Lien de réinitialisation invalide ou expiré.'
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setResetValidationState('invalid');
        setResetValidationError(
          'Impossible de vérifier le lien de réinitialisation auprès du serveur.'
        );
      });

    return () => {
      active = false;
    };
  }, [initialResetToken]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setLoginError('Veuillez saisir votre e-mail ou numéro de téléphone.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(cleanIdentifier, loginPassword);
      if (!res.success) {
        setLoginError(res.error || 'Identifiant ou mot de passe incorrect.');
      } else {
        tryStoreBrowserCredential(cleanIdentifier, loginPassword);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName.trim() || !regBusinessName.trim()) {
      setRegError('Veuillez renseigner votre nom complet et le nom de votre entreprise.');
      return;
    }
    if (!regPhone.trim() && !regEmail.trim()) {
      setRegError('Veuillez renseigner un numéro de téléphone ou une adresse e-mail.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        businessName: regBusinessName.trim(),
        storeName: regStoreName.trim() || `Boutique ${regBusinessName.trim()}`,
        password: regPassword,
      });

      if (!res.success) {
        setRegError(res.error || 'Impossible de créer votre compte commerçant.');
      } else {
        const savedId = regEmail.trim() || regPhone.trim();
        if (savedId) {
          tryStoreBrowserCredential(savedId, regPassword);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccessMessage('');

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setForgotError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        if (data?.error) {
          setForgotError(data.error);
        } else if (resp.status === 503 || resp.status === 422) {
          setForgotError(
            "Le service d'envoi d'e-mails (support@sama-stock.com) n'est pas encore configuré sur le serveur."
          );
        } else {
          setForgotError(
            `Impossible d'envoyer le lien de réinitialisation (erreur HTTP ${resp.status}).`
          );
        }
        return;
      }
      setForgotSuccessMessage(
        data?.message ||
          "Si un compte actif est associé à cette adresse e-mail, un lien de réinitialisation valable 15 minutes vient d'être envoyé."
      );
    } catch {
      setForgotError('Impossible de contacter le serveur. Vérifiez votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetSubmitError('');

    if (resetNewPassword.length < 8) {
      setResetSubmitError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetSubmitError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token: resetToken,
          newPassword: resetNewPassword,
          confirmPassword: resetConfirmPassword,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        setResetSubmitError(
          data?.error || 'Impossible de réinitialiser votre mot de passe.'
        );
        return;
      }

      setResetSuccessMessage(
        data?.message ||
          'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
      );
      setResetNewPassword('');
      setResetConfirmPassword('');
      if (isAuthenticated) {
        await logout();
      }
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('reset_token')) {
          url.searchParams.delete('reset_token');
          const nextUrl = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''}${url.hash}`;
          window.history.replaceState({}, '', nextUrl);
        }
      } catch {
        // ignore history errors
      }
    } catch {
      setResetSubmitError('Erreur réseau lors de la réinitialisation du mot de passe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    clearUrlResetToken();
    setMode('login');
    setLoginError('');
    setRegError('');
    setForgotError('');
    setForgotSuccessMessage('');
    setResetSubmitError('');
    setResetSuccessMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#123B67] via-[#0C2744] to-[#123B67] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col">
        {/* Brand Header */}
        <div className="p-8 pb-6 text-center space-y-2 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
          <div className="flex justify-center">
            <img
              src="/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png"
              alt="SAMA STOCK"
              className="h-16 w-auto object-contain"
            />
          </div>
          <p className="text-xs text-[#F58220] font-bold tracking-wide">
            Gérez votre stock. Développez votre business.
          </p>
        </div>

        {/* Tab Switcher: Connexion vs Inscription */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex border-b border-slate-200 text-xs font-semibold bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLoginError('');
                setRegError('');
              }}
              className={`flex-1 py-3 transition-colors text-center border-b-2 ${
                mode === 'login'
                  ? 'border-[#F58220] text-[#123B67] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Se Connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLoginError('');
                setRegError('');
              }}
              className={`flex-1 py-3 transition-colors text-center border-b-2 ${
                mode === 'register'
                  ? 'border-[#F58220] text-[#123B67] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Créer un Compte
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-5 text-xs">
          {/* Mode 1: LOGIN */}
          {mode === 'login' && (
            <form
              method="post"
              action="/api/auth/login"
              autoComplete="on"
              onSubmit={handleLoginSubmit}
              className="space-y-4"
            >
              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="login-username"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  E-mail ou Téléphone
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    inputMode="email"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    placeholder="exemple@boutique.sn ou +221 77..."
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label
                    htmlFor="login-password"
                    className="font-semibold text-slate-700"
                  >
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotError('');
                      setForgotSuccessMessage('');
                      if (loginIdentifier.includes('@')) {
                        setForgotEmail(loginIdentifier.trim());
                      }
                      setMode('forgot');
                    }}
                    className="text-[11px] font-medium text-[#F58220] hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    enterKeyHint="done"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Afficher ou masquer le mot de passe"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#F58220] hover:bg-[#E07315] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Connexion en cours...' : 'Se Connecter à SAMA STOCK'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Mode 2: REGISTER */}
          {mode === 'register' && (
            <form
              method="post"
              action="/api/auth/register"
              autoComplete="on"
              onSubmit={handleRegisterSubmit}
              className="space-y-3.5"
            >
              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label htmlFor="reg-name" className="font-semibold text-slate-700 block mb-1">
                  Nom et Prénom du Commerçant *
                </label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ex: Ibrahima Diouf"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label htmlFor="reg-business" className="font-semibold text-slate-700 block mb-1">
                  Nom de votre Commerce / Entreprise *
                </label>
                <input
                  id="reg-business"
                  name="organization"
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="Ex: Supérette & Grossiste Fass"
                  value={regBusinessName}
                  onChange={(e) => setRegBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label htmlFor="reg-store" className="font-semibold text-slate-700 block mb-1">
                  Nom de votre Première Boutique
                </label>
                <input
                  id="reg-store"
                  name="storeName"
                  type="text"
                  placeholder="Ex: Boutique Médina"
                  value={regStoreName}
                  onChange={(e) => setRegStoreName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="reg-phone" className="font-semibold text-slate-700 block mb-1">
                    Téléphone *
                  </label>
                  <input
                    id="reg-phone"
                    name="tel"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+221 77..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="font-semibold text-slate-700 block mb-1">
                    Email
                  </label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    placeholder="contact@boutique.sn"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-password" className="font-semibold text-slate-700 block mb-1">
                  Mot de passe *
                </label>
                <input
                  id="reg-password"
                  name="new-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimum 8 caractères"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#F58220] hover:bg-[#E07315] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? 'Création du compte...'
                    : 'Créer Mon Compte & Démarrer'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Mode 3: FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#123B67]/10 text-[#123B67] flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Mot de passe oublié ?
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Saisissez l’adresse e-mail de votre compte SAMA STOCK pour recevoir un lien sécurisé de réinitialisation (valable 15 minutes).
                  </p>
                </div>
              </div>

              {forgotError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccessMessage ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-900 mb-1">Demande enregistrée</p>
                      <p>{forgotSuccessMessage}</p>
                      <p className="mt-1.5 text-[11px] text-emerald-700">
                        Vérifiez votre boîte de réception ainsi que votre dossier Courrier indésirable (spam).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-2.5 bg-[#123B67] hover:bg-[#0C2744] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retour à la connexion</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-email"
                      className="font-semibold text-slate-700 block mb-1"
                    >
                      Adresse e-mail du compte *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="forgot-email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="exemple@boutique.sn"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#F58220] hover:bg-[#E07315] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting
                        ? 'Envoi en cours...'
                        : 'Envoyer le lien de réinitialisation'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#123B67] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retour à la connexion</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Mode 4: RESET PASSWORD (from email link ?reset_token=...) */}
          {mode === 'reset' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F58220]/15 text-[#F58220] flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Nouveau mot de passe
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Choisissez un mot de passe fort (minimum 8 caractères) pour sécuriser votre compte SAMA STOCK.
                  </p>
                </div>
              </div>

              {resetValidationState === 'checking' && (
                <div className="p-6 text-center space-y-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <Loader2 className="w-6 h-6 text-[#123B67] animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Vérification de votre lien sécurisé...
                  </p>
                </div>
              )}

              {resetValidationState === 'invalid' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{resetValidationError}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      clearUrlResetToken();
                      setForgotError('');
                      setForgotSuccessMessage('');
                      setMode('forgot');
                    }}
                    className="w-full py-3 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    Demander un nouveau lien
                  </button>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#123B67] font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Retour à la connexion
                  </button>
                </div>
              )}

              {resetValidationState === 'valid' && resetSuccessMessage && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <div>
                      <p className="font-bold text-emerald-900 mb-1">
                        Mot de passe mis à jour
                      </p>
                      <p>{resetSuccessMessage}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-3 bg-[#123B67] hover:bg-[#0C2744] text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Se connecter maintenant</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {resetValidationState === 'valid' && !resetSuccessMessage && (
                <form
                  method="post"
                  action="/api/auth/reset-password"
                  autoComplete="on"
                  onSubmit={handleResetSubmit}
                  className="space-y-4"
                >
                  {resetSubmitError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>{resetSubmitError}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="reset-new-password"
                      className="font-semibold text-slate-700 block mb-1"
                    >
                      Nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reset-new-password"
                        name="new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Minimum 8 caractères"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label="Afficher ou masquer le mot de passe"
                      >
                        {showResetPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reset-confirm-password"
                      className="font-semibold text-slate-700 block mb-1"
                    >
                      Confirmer le nouveau mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="reset-confirm-password"
                        name="confirm-password"
                        type={showResetPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Retapez le mot de passe"
                        value={resetConfirmPassword}
                        onChange={(e) => setResetConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-[#F58220] hover:bg-[#E07315] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting
                        ? 'Enregistrement en cours...'
                        : 'Enregistrer le nouveau mot de passe'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={goToLogin}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#123B67] font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler et revenir à la connexion
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Security Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Comptes commerçants indépendants · Données isolées et sécurisées</span>
        </div>
      </div>
    </div>
  );
};
