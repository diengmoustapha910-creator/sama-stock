import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Store as StoreIcon,
  User as UserIcon,
  Wifi,
  WifiOff,
  RefreshCw,
  ShoppingCart,
  Plus,
  Menu,
  X,
  Bell,
  CheckCircle2,
  LogOut,
  Shield,
  CreditCard,
  KeyRound,
  Download,
} from 'lucide-react';
import { UserRole } from '../../types';
import { STAFF_ROLE_LABELS } from '../../services/permissions';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface HeaderProps {
  onOpenMobileMenu: () => void;
  isMobileMenuOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, isMobileMenuOpen }) => {
  const {
    currentStore,
    stores,
    setActiveStoreId,
    currentUser,
    isOnline,
    toggleOnlineMode,
    pendingSyncOperations,
    syncPendingOperations,
    setActiveTab,
    kpis,
    logout,
    updateProfile,
    activeOperator,
    openPinModal,
    canAccessStore,
  } = useApp();

  const { isInstalled, canInstallNatively, isIosDevice, promptInstall } = usePWAInstall();
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);

  // Profile modal edit fields
  const [profName, setProfName] = useState(currentUser?.name || '');
  const [profEmail, setProfEmail] = useState(currentUser?.email || '');
  const [profPhone, setProfPhone] = useState(currentUser?.phone || '');
  const [profSaved, setProfSaved] = useState(false);
  const [profError, setProfError] = useState('');
  const [isSavingProf, setIsSavingProf] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfName(currentUser.name || '');
      setProfEmail(currentUser.email || '');
      setProfPhone(currentUser.phone || '');
    }
  }, [currentUser]);

  const isAdmin = currentUser.role === 'administrateur';

  const roleLabels: Record<UserRole, string> = {
    administrateur: 'Administrateur',
    commercant: 'Commerçant',
  };

  const handleSyncClick = () => {
    syncPendingOperations();
    setShowSyncSuccess(true);
    setTimeout(() => setShowSyncSuccess(false), 2000);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfError('');
    setProfSaved(false);
    setIsSavingProf(true);
    try {
      const res = await updateProfile({
        name: profName,
        email: profEmail,
        phone: profPhone,
      });
      if (!res.success) {
        setProfError(res.error || 'Erreur lors de la mise à jour du profil.');
      } else {
        setProfSaved(true);
        setTimeout(() => setProfSaved(false), 2500);
      }
    } finally {
      setIsSavingProf(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Ouvrir le menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <img
              src="/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png"
              alt="SAMA STOCK"
              className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </div>
        </div>

        {/* Center: Store Selector & Connected Account Menu */}
        <div className="hidden md:flex items-center gap-3">
          {/* Store Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setIsStoreMenuOpen(!isStoreMenuOpen);
                setIsUserMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#123B67] bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <StoreIcon className="w-3.5 h-3.5 text-[#F58220]" />
              <span className="font-semibold truncate max-w-[170px]">{currentStore?.name}</span>
            </button>

            {isStoreMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Mes Boutiques
                </div>
                {stores
                  .filter((s) => canAccessStore(s.id))
                  .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveStoreId(s.id);
                      setIsStoreMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      s.id === currentStore?.id ? 'text-[#F58220] font-semibold bg-orange-50/50' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.city}</div>
                    </div>
                    {s.isMain && (
                      <span className="text-[10px] text-slate-500 font-mono">Principale</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Operator PIN Switcher */}
          {activeOperator && (
            <button
              type="button"
              onClick={openPinModal}
              title="Changer d'opérateur par code PIN"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#123B67] bg-orange-50/70 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#F58220]" />
              <span className="truncate max-w-[115px]">{activeOperator.name}</span>
              <span className="text-[10px] text-slate-500">
                ({STAFF_ROLE_LABELS[activeOperator.role]})
              </span>
            </button>
          )}

          {/* Authenticated User Menu (No role or account switcher) */}
          <div className="relative">
            <button
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen);
                setIsStoreMenuOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="truncate max-w-[140px]">{currentUser.name}</span>
              <span className="text-[10px] text-slate-400">· {roleLabels[currentUser.role]}</span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900 truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {currentUser.email || currentUser.phone}
                  </div>
                  <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#123B67]">
                    {roleLabels[currentUser.role]}
                  </span>
                </div>

                <div className="pt-1 px-1 space-y-1">
                  <button
                    onClick={() => {
                      setProfName(currentUser.name);
                      setProfEmail(currentUser.email);
                      setProfPhone(currentUser.phone);
                      setProfSaved(false);
                      setProfError('');
                      setIsProfileModalOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mon Profil</span>
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setActiveTab('admin_subscriptions');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-[#F58220]" />
                        <span>Gestion Abonnements</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-[#F58220]">
                        Admin
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-500" />
                    <span>Paramètres & Sécurité</span>
                  </button>

                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 font-medium transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Se Déconnecter</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Logout Button */}
          <button
            onClick={logout}
            title="Se déconnecter de SAMA STOCK"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>

          {/* Online / Offline Status Switcher */}
          <button
            onClick={toggleOnlineMode}
            title={isOnline ? 'En ligne - Cliquez pour tester le mode hors-connexion' : 'Mode hors-ligne - Cliquez pour reconnecter'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'En ligne' : 'Hors-ligne'}</span>
          </button>

          {/* Sync Queue indicator */}
          {pendingSyncOperations.length > 0 && (
            <button
              onClick={handleSyncClick}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors animate-pulse"
              title="Opérations en attente de synchronisation"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{pendingSyncOperations.length} en attente</span>
            </button>
          )}

          {showSyncSuccess && (
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Synchronisé
            </span>
          )}
        </div>

        {/* Right: Primary POS Quick Action, PWA Install, Admin Badge & Alert Bell */}
        <div className="flex items-center gap-2">
          {!isInstalled && (canInstallNatively || isIosDevice) && (
            <button
              type="button"
              onClick={async () => {
                const res = await promptInstall();
                if (res === 'ios-guide') setShowIosInstallGuide(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#123B67] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Installer SAMA STOCK comme application sur cet appareil"
            >
              <Download className="w-3.5 h-3.5 text-[#F58220]" />
              <span>Installer App</span>
            </button>
          )}

          {activeOperator && (
            <button
              type="button"
              onClick={openPinModal}
              className="md:hidden p-2 text-[#123B67] bg-orange-50 border border-orange-200 rounded-lg"
              title={`Opérateur : ${activeOperator.name}`}
            >
              <KeyRound className="w-4 h-4 text-[#F58220]" />
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin_subscriptions')}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs"
              title="Administration centrale des abonnements SAMA STOCK"
            >
              <CreditCard className="w-3.5 h-3.5 text-[#F58220]" />
              <span className="font-semibold text-[#123B67]">Admin Abonnements</span>
            </button>
          )}

          {kpis.lowStockCount > 0 && (
            <button
              onClick={() => setActiveTab('stock')}
              className="relative p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              title={`${kpis.lowStockCount} produit(s) en stock faible`}
            >
              <Bell className="w-4 h-4 text-amber-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
            </button>
          )}

          <button
            onClick={() => setActiveTab('invoices')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#123B67] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#123B67]" />
            <span>Facture / Devis</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Caisse POS</span>
          </button>
        </div>
      </div>

      {/* iOS PWA Install Guide Modal */}
      {showIosInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Installer sur iPhone / iPad</h3>
              <button
                onClick={() => setShowIosInstallGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal pl-4 leading-relaxed">
              <li>Appuyez sur le bouton <strong>Partager</strong> (icône carré avec flèche vers le haut) dans Safari.</li>
              <li>Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong>.</li>
              <li>Appuyez sur <strong>Ajouter</strong> en haut à droite pour lancer SAMA STOCK en plein écran.</li>
            </ol>
            <button
              onClick={() => setShowIosInstallGuide(false)}
              className="w-full py-2 text-xs font-semibold text-white bg-[#123B67] rounded-xl"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-[#123B67]" />
                <h3 className="font-bold text-slate-900 text-sm">Mon Profil Utilisateur</h3>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Type de compte :</span>
                  <span className="font-semibold text-[#123B67]">
                    {roleLabels[currentUser.role]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Statut du compte :</span>
                  <span className="font-semibold text-emerald-600">Actif & Isolé</span>
                </div>
              </div>

              {profError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                  {profError}
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adresse e-mail</label>
                <input
                  type="email"
                  required
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Téléphone</label>
                <input
                  type="text"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              {profSaved && (
                <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Profil mis à jour !
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    logout();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Se Déconnecter</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Fermer
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProf}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs disabled:opacity-50"
                  >
                    {isSavingProf ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
