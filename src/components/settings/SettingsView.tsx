import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  exportMerchantWorkspaceJSON,
  parseImportedWorkspaceJSON,
} from '../../services/storage';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  Building2,
  Shield,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  KeyRound,
  Lock,
  Star,
  Printer,
  Smartphone,
} from 'lucide-react';
import { AdminSubscriptionsTab } from './AdminSubscriptionsTab';

export const SettingsView: React.FC = () => {
  const {
    organization,
    updateOrganization,
    stores,
    addStore,
    activeStoreId,
    setActiveStoreId,
    currentUser,
    changePassword,
    setActiveTab,
    logout,
    categories,
    products,
    customers,
    suppliers,
    sales,
    invoices,
    purchases,
    expenses,
    stockMovements,
    inventorySessions,
    clearMerchantWorkspaceData,
    importWorkspaceData,
    isOnline,
    toggleOnlineMode,
    pendingSyncOperations,
    syncPendingOperations,
    quotaSummary,
    canAddStore,
    openUpgradeModal,
  } = useApp();

  const isAdmin = currentUser.role === 'administrateur';
  const { canInstallNatively, isInstalled, isIosDevice, promptInstall } = usePWAInstall();
  const [pwaFeedback, setPwaFeedback] = useState('');

  const [activeSubTab, setActiveSubTab] = useState<
    'company' | 'stores' | 'security' | 'sync' | 'backup' | 'plans'
  >('company');

  const [cleanDemoSuccess, setCleanDemoSuccess] = useState(false);
  const [isClearAllDemoModalOpen, setIsClearAllDemoModalOpen] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Company Profile form (NINEA / RCCM removed)
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [slogan, setSlogan] = useState(organization?.slogan || '');
  const [phone, setPhone] = useState(organization?.phone || '');
  const [email, setEmail] = useState(organization?.email || '');
  const [address, setAddress] = useState(organization?.address || '');
  const [city, setCity] = useState(organization?.city || '');
  const [vatEnabled, setVatEnabled] = useState(Boolean(organization?.vatEnabled));
  const [vatRate, setVatRate] = useState(organization?.vatRate ?? 18);
  const [waveNumber, setWaveNumber] = useState(organization?.waveNumber || '');
  const [orangeMoneyNumber, setOrangeMoneyNumber] = useState(organization?.orangeMoneyNumber || '');
  const [bankDetails, setBankDetails] = useState(organization?.bankDetails || '');

  // Loyalty & Thermal Receipt settings
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(
    organization?.loyaltySettings?.enabled ?? true
  );
  const [amountPerPoint, setAmountPerPoint] = useState(
    organization?.loyaltySettings?.amountPerPoint ?? 1000
  );
  const [pointValueFCFA, setPointValueFCFA] = useState(
    organization?.loyaltySettings?.pointValueFCFA ?? 25
  );
  const [minRedeemPoints, setMinRedeemPoints] = useState(
    organization?.loyaltySettings?.minRedeemPoints ?? 10
  );
  const [receiptDefaultWidth, setReceiptDefaultWidth] = useState<'58mm' | '80mm'>(
    organization?.receiptDefaultWidth || '80mm'
  );
  const [receiptShowLogo, setReceiptShowLogo] = useState(organization?.receiptShowLogo ?? true);
  const [receiptFooter, setReceiptFooter] = useState(
    organization?.receiptFooter || 'Merci pour votre confiance ! À bientôt.'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Password Change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdFeedback, setPwdFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
      setSlogan(organization.slogan || '');
      setPhone(organization.phone || '');
      setEmail(organization.email || '');
      setAddress(organization.address || '');
      setCity(organization.city || '');
      setVatEnabled(Boolean(organization.vatEnabled));
      setVatRate(organization.vatRate ?? 18);
      setWaveNumber(organization.waveNumber || '');
      setOrangeMoneyNumber(organization.orangeMoneyNumber || '');
      setBankDetails(organization.bankDetails || '');
      setLoyaltyEnabled(organization.loyaltySettings?.enabled ?? true);
      setAmountPerPoint(organization.loyaltySettings?.amountPerPoint ?? 1000);
      setPointValueFCFA(organization.loyaltySettings?.pointValueFCFA ?? 25);
      setMinRedeemPoints(organization.loyaltySettings?.minRedeemPoints ?? 10);
      setReceiptDefaultWidth(organization.receiptDefaultWidth || '80mm');
      setReceiptShowLogo(organization.receiptShowLogo ?? true);
      setReceiptFooter(
        organization.receiptFooter || 'Merci pour votre confiance ! À bientôt.'
      );
    }
  }, [organization]);

  useEffect(() => {
    if (currentUser.mustChangePassword) {
      setActiveSubTab('security');
    } else if (!isAdmin && activeSubTab === 'plans') {
      setActiveSubTab('company');
    }
  }, [isAdmin, activeSubTab, currentUser.mustChangePassword]);

  // New Store Modal
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCity, setStoreCity] = useState('Dakar');
  const [storePhone, setStorePhone] = useState('+221 ');

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization({
      name: orgName,
      slogan,
      phone,
      email,
      address,
      city,
      vatEnabled,
      vatRate: Number(vatRate),
      waveNumber,
      orangeMoneyNumber,
      bankDetails,
      loyaltySettings: {
        enabled: loyaltyEnabled,
        amountPerPoint: Math.max(100, Number(amountPerPoint) || 1000),
        pointValueFCFA: Math.max(1, Number(pointValueFCFA) || 25),
        minRedeemPoints: Math.max(1, Number(minRedeemPoints) || 10),
      },
      receiptDefaultWidth,
      receiptShowLogo,
      receiptFooter,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddStoreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    addStore({
      name: storeName,
      address: storeAddress,
      city: storeCity,
      phone: storePhone,
      isMain: false,
    });

    setIsAddStoreModalOpen(false);
    setStoreName('');
    setStoreAddress('');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);

    if (newPwd.length < 8) {
      setPwdFeedback({
        type: 'error',
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.',
      });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdFeedback({
        type: 'error',
        message: 'La confirmation du mot de passe ne correspond pas.',
      });
      return;
    }

    setIsChangingPwd(true);
    try {
      const res = await changePassword(currentPwd, newPwd, confirmPwd);
      if (res.success) {
        setPwdFeedback({
          type: 'success',
          message:
            'Votre mot de passe a été mis à jour avec succès. Toutes vos anciennes sessions ont été invalidées.',
        });
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setPwdFeedback({
          type: 'error',
          message:
            res.code === 'AUTH_REQUIRED' || res.code === 'SESSION_EXPIRED'
              ? `${res.error} Cliquez sur « Se reconnecter » pour renouveler votre cookie de session sécurisé.`
              : res.error || 'Impossible de modifier le mot de passe.',
        });
      }
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleBackupDownload = () => {
    const jsonStr = exportMerchantWorkspaceJSON({
      organization,
      stores,
      categories,
      products,
      customers,
      suppliers,
      sales,
      invoices,
      purchases,
      expenses,
      movements: stockMovements,
      inventorySessions,
    });
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SAMA_STOCK_Sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setRestoreFeedback(null);
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setRestoreFeedback({
          type: 'error',
          message: 'Fichier de sauvegarde trop volumineux (maximum 10 Mo).',
        });
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const parsed = parseImportedWorkspaceJSON(text);
        if (!parsed) {
          setRestoreFeedback({
            type: 'error',
            message: 'Fichier de sauvegarde JSON non valide.',
          });
          return;
        }
        const ok = await importWorkspaceData(parsed);
        if (ok) {
          setRestoreFeedback({
            type: 'success',
            message: 'Sauvegarde restaurée et synchronisée sur votre compte avec succès.',
          });
        } else {
          setRestoreFeedback({
            type: 'error',
            message: 'Impossible d’importer les données de sauvegarde.',
          });
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleInstallClick = async () => {
    const res = await promptInstall();
    if (res === 'accepted') {
      setPwaFeedback('SAMA STOCK est installé sur votre appareil.');
    } else if (res === 'ios-guide') {
      setPwaFeedback(
        'Sur iPhone/iPad (Safari) : appuyez sur le bouton Partager (carré avec flèche) puis sélectionnez "Sur l’écran d’accueil".'
      );
    } else if (res === 'unavailable') {
      setPwaFeedback(
        'Utilisez le menu de votre navigateur Chrome/Edge ("Installer l’application") pour ajouter SAMA STOCK à l’écran d’accueil.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Paramètres & Configuration de l'Entreprise
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Coordonnées commerciales, fidélité POS, tickets thermiques, multi-boutiques et mode hors-ligne
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('company')}
          className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'company'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Entreprise, Fidélité & Tickets
        </button>
        <button
          onClick={() => setActiveSubTab('stores')}
          className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'stores'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Boutiques & Points de Vente ({stores.length})
        </button>
        <button
          onClick={() => setActiveSubTab('security')}
          className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'security'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Mon Compte & Sécurité
        </button>
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'sync'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Hors-Ligne, Sync & PWA
        </button>
        <button
          onClick={() => setActiveSubTab('backup')}
          className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeSubTab === 'backup'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Sauvegarde & Nettoyage
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('plans')}
            className={`pb-2.5 font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeSubTab === 'plans'
                ? 'border-[#F58220] text-[#123B67]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Gestion des Abonnements (Admin)
          </button>
        )}
      </div>

      {/* Tab 1: Company Profile, Loyalty & Receipt Config */}
      {activeSubTab === 'company' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-3xl">
          <form onSubmit={handleSaveCompany} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Raison Sociale / Nom Commercial de l'Entreprise *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-semibold text-slate-700 block mb-1">
                  Slogan Commercial
                </label>
                <input
                  type="text"
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Téléphone Principal
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Adresse du Siège / Boutique
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>
            </div>

            {/* Payment Numbers */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h3 className="font-bold text-slate-900 text-xs">
                Coordonnées de Règlements (Affichées sur les Factures PDF & Reçus)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Numéro Wave Pro
                  </label>
                  <input
                    type="text"
                    value={waveNumber}
                    onChange={(e) => setWaveNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Numéro Orange Money
                  </label>
                  <input
                    type="text"
                    value={orangeMoneyNumber}
                    onChange={(e) => setOrangeMoneyNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Coordonnées Bancaires / IBAN
                  </label>
                  <input
                    type="text"
                    value={bankDetails}
                    onChange={(e) => setBankDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Loyalty Program Config */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#F58220] fill-[#F58220]" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">
                      Programme de Fidélité Clients (Points en Caisse POS)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Récompensez automatiquement vos clients enregistrés à chaque passage en caisse
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={loyaltyEnabled}
                  onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                  className="w-4 h-4 text-[#F58220] rounded border-slate-300"
                />
              </div>

              {loyaltyEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-orange-50/50 border border-orange-200 rounded-xl">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Montant pour 1 point (FCFA)
                    </label>
                    <input
                      type="number"
                      min={100}
                      value={amountPerPoint}
                      onChange={(e) => setAmountPerPoint(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Valeur d’1 point (FCFA)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={pointValueFCFA}
                      onChange={(e) => setPointValueFCFA(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Seuil minimum utilisation (pts)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minRedeemPoints}
                      onChange={(e) => setMinRedeemPoints(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Thermal Receipt Settings */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#123B67]" />
                <h3 className="font-bold text-slate-900 text-xs">
                  Impression Ticket de Caisse Thermique (58mm / 80mm)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Largeur papier par défaut
                  </label>
                  <select
                    value={receiptDefaultWidth}
                    onChange={(e) => setReceiptDefaultWidth(e.target.value as '58mm' | '80mm')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="80mm">80 mm (Standard caisse)</option>
                    <option value="58mm">58 mm (Mini imprimante Bluetooth)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-5">
                  <span className="font-semibold text-slate-700">
                    Afficher le logo sur le ticket
                  </span>
                  <input
                    type="checkbox"
                    checked={receiptShowLogo}
                    onChange={(e) => setReceiptShowLogo(e.target.checked)}
                    className="w-4 h-4 text-[#F58220] rounded"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-slate-700 block mb-1">
                    Message de bas de ticket
                  </label>
                  <input
                    type="text"
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    placeholder="Ex: Merci pour votre confiance ! Ni repris ni échangé après 48h."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* VAT settings */}
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <div className="font-bold text-slate-900 text-xs">
                  TVA Légale Sénégalaise ({vatRate}%)
                </div>
                <div className="text-[11px] text-slate-500">
                  Appliquer la TVA sur les factures de vente et devis par défaut
                </div>
              </div>
              <input
                type="checkbox"
                checked={vatEnabled}
                onChange={(e) => setVatEnabled(e.target.checked)}
                className="w-4 h-4 text-[#F58220] rounded border-slate-300"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Paramètres enregistrés avec succès !
                </span>
              ) : (
                <div />
              )}

              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-xl shadow-xs transition-colors"
              >
                Mettre à Jour la Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Multi-stores */}
      {activeSubTab === 'stores' && (
        <div className="space-y-4">
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              quotaSummary.stores.reached
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-[#123B67] text-white text-[10px] font-bold uppercase">
                  Formule {quotaSummary.planName}
                </span>
                {quotaSummary.stores.limit === -1 ? (
                  <span className="font-semibold">
                    Boutiques actives : <strong>{quotaSummary.stores.used}</strong> · Multi-boutiques illimité
                  </span>
                ) : (
                  <span className="font-semibold">
                    Quota boutiques : <strong>{quotaSummary.stores.used}</strong> /{' '}
                    <strong>{quotaSummary.stores.limit}</strong> utilisée ·{' '}
                    <strong className={quotaSummary.stores.reached ? 'text-rose-700' : 'text-emerald-700'}>
                      {quotaSummary.stores.remaining} restante
                    </strong>
                  </span>
                )}
              </div>
              {quotaSummary.stores.reached && (
                <p className="text-[11px] text-amber-800">
                  Votre formule {quotaSummary.planName} est limitée à {quotaSummary.stores.limit} boutique. Passez à une formule supérieure (Entreprise) pour ajouter d’autres points de vente.
                </p>
              )}
            </div>

            <button
              onClick={() => {
                const check = canAddStore();
                if (!check.allowed) {
                  openUpgradeModal(check.reason);
                  return;
                }
                setIsAddStoreModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une Nouvelle Boutique</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stores.map((s) => {
              const isSelected = s.id === activeStoreId;

              return (
                <div
                  key={s.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'bg-orange-50/30 border-[#F58220] shadow-sm'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#123B67]" />
                        <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                      </div>
                      {s.isMain && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                          Siège
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div>{s.address}</div>
                      <div>{s.city}, Sénégal</div>
                      <div className="font-mono">{s.phone}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {isSelected ? 'Boutique active' : 'Inactive'}
                    </span>
                    {!isSelected && (
                      <button
                        onClick={() => setActiveStoreId(s.id)}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-[#123B67] rounded-lg text-xs font-semibold"
                      >
                        Sélectionner
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Personal Account & Security */}
      {activeSubTab === 'security' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#123B67] text-white font-black flex items-center justify-center text-base shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{currentUser.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-[#123B67] border border-blue-200">
                      {currentUser.role === 'administrateur'
                        ? 'Administrateur Principal'
                        : 'Compte Commerçant'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {currentUser.email || 'Aucun e-mail'} ·{' '}
                    <span className="font-mono">{currentUser.phone || '-'}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                Espace Isolé
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-600">
              <Lock className="w-4 h-4 text-[#123B67] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Votre compte personnel dispose de son propre espace isolé : seules vos boutiques ({stores.length}), vos produits ({products.length}), vos clients, vos ventes et vos factures vous sont accessibles.
              </div>
            </div>

            {/* Quotas Summary for current organization */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">
                  Quotas utilisés & restants ({quotaSummary.planName})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Mois : {quotaSummary.monthKey}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-[11px] text-slate-500 font-semibold">Produits actifs</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    {quotaSummary.products.limit === -1
                      ? `${quotaSummary.products.used} · Illimité`
                      : `${quotaSummary.products.used} / ${quotaSummary.products.limit}`}
                  </div>
                  {quotaSummary.products.limit !== -1 && (
                    <div className={`text-[11px] mt-0.5 font-semibold ${quotaSummary.products.reached ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {quotaSummary.products.remaining} restant(s)
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-[11px] text-slate-500 font-semibold">Boutiques</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    {quotaSummary.stores.limit === -1
                      ? `${quotaSummary.stores.used} · Illimité`
                      : `${quotaSummary.stores.used} / ${quotaSummary.stores.limit}`}
                  </div>
                  {quotaSummary.stores.limit !== -1 && (
                    <div className={`text-[11px] mt-0.5 font-semibold ${quotaSummary.stores.reached ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {quotaSummary.stores.remaining} restante(s)
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="text-[11px] text-slate-500 font-semibold">Factures ce mois</div>
                  <div className="font-extrabold text-slate-900 mt-0.5">
                    {quotaSummary.invoices.limit === -1
                      ? `${quotaSummary.invoices.used} · Illimité`
                      : `${quotaSummary.invoices.used} / ${quotaSummary.invoices.limit}`}
                  </div>
                  {quotaSummary.invoices.limit !== -1 && (
                    <div className={`text-[11px] mt-0.5 font-semibold ${quotaSummary.invoices.reached ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {quotaSummary.invoices.remaining} restante(s)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            {currentUser.mustChangePassword && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Changement de mot de passe requis</span>
                  <span>
                    Votre mot de passe temporaire doit être remplacé par un nouveau mot de passe personnel (min. 8 caractères) avant de continuer à utiliser SAMA STOCK.
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-[#F58220]" />
              <h3 className="font-bold text-slate-900 text-sm">Changer Mon Mot de Passe</h3>
            </div>

            <form onSubmit={handleChangePasswordSubmit} autoComplete="on" className="space-y-3 text-xs">
              {pwdFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-medium space-y-2 ${
                    pwdFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  <div>{pwdFeedback.message}</div>
                  {pwdFeedback.type === 'success' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('dashboard')}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Accéder au Tableau de Bord
                    </button>
                  )}
                  {pwdFeedback.type === 'error' &&
                    /authentification requise|session expirée/i.test(pwdFeedback.message) && (
                      <button
                        type="button"
                        onClick={() => logout()}
                        className="px-3 py-1.5 bg-[#123B67] hover:bg-[#0C2744] text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                      >
                        Se reconnecter maintenant
                      </button>
                    )}
                </div>
              )}

              <div>
                <label
                  htmlFor="settings-current-password"
                  className="font-semibold text-slate-700 block mb-1"
                >
                  Mot de passe actuel *
                </label>
                <input
                  id="settings-current-password"
                  name="current-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="settings-new-password"
                    className="font-semibold text-slate-700 block mb-1"
                  >
                    Nouveau mot de passe *
                  </label>
                  <input
                    id="settings-new-password"
                    name="new-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 caractères"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-confirm-password"
                    className="font-semibold text-slate-700 block mb-1"
                  >
                    Confirmer le nouveau mot de passe *
                  </label>
                  <input
                    id="settings-confirm-password"
                    name="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Min. 8 caractères"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPwd}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    {isChangingPwd ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Offline, Sync Queue & PWA Install */}
      {activeSubTab === 'sync' && (
        <div className="space-y-6 max-w-2xl">
          {/* PWA Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#123B67] flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Application Installable (Android, iPhone, PC)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isInstalled
                      ? 'Installée sur cet appareil en mode application native.'
                      : 'Installez SAMA STOCK sur l’écran d’accueil pour encaisser hors-ligne comme une app POS dédiée.'}
                  </p>
                </div>
              </div>

              {!isInstalled && (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-xl transition-colors"
                >
                  {canInstallNatively
                    ? 'Installer SAMA STOCK'
                    : isIosDevice
                    ? 'Guide iPhone/iPad'
                    : 'Installer l’App'}
                </button>
              )}
            </div>

            {pwaFeedback && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-[#123B67]">
                {pwaFeedback}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Fonctionnement Hors-Ligne & File de Synchronisation
              </h3>
              <p className="text-xs text-slate-500">
                Garantit la continuité de service de vos caisses même en cas de coupure Internet
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    Statut actuel : {isOnline ? 'Connecté à Internet' : 'Mode Hors-Connexion Actif'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isOnline
                      ? 'Toutes vos opérations sont synchronisées sur votre compte sécurisé.'
                      : 'Les ventes et mouvements sont mis en attente et seront synchronisés automatiquement.'}
                  </div>
                </div>
              </div>

              <button
                onClick={toggleOnlineMode}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 ${
                  isOnline
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                }`}
              >
                {isOnline ? 'Simuler Hors-Ligne' : 'Rétablir Connexion'}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800">
                  Opérations en attente de synchronisation ({pendingSyncOperations.length})
                </span>
                {pendingSyncOperations.length > 0 && (
                  <button
                    onClick={syncPendingOperations}
                    className="text-xs font-semibold text-[#123B67] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Forcer la synchronisation
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto text-xs">
                {pendingSyncOperations.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">
                    Aucune opération en attente. Toutes vos données sont à jour.
                  </div>
                ) : (
                  pendingSyncOperations.map((op) => (
                    <div key={op.id} className="py-2 px-2 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800">{op.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">
                          {op.entity} #{op.entityId}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                        {op.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Backup & Restore */}
      {activeSubTab === 'backup' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Sauvegarde & Restauration Intégrale
            </h3>
            <p className="text-xs text-slate-500">
              Exportez ou restaurez toutes les données de votre compte commercial (produits, ventes, factures, clients, fournisseurs)
            </p>
          </div>

          {restoreFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium ${
                restoreFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {restoreFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-900">Télécharger la Sauvegarde</div>
                <p className="text-slate-500 text-[11px]">
                  Génère une archive JSON sécurisée contenant uniquement vos propres registres commerciaux.
                </p>
              </div>
              <button
                onClick={handleBackupDownload}
                className="w-full py-2.5 bg-[#123B67] hover:bg-[#0C2744] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exporter Sauvegarde (.json)</span>
              </button>
            </div>

            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-900">Restaurer des Données</div>
                <p className="text-slate-500 text-[11px]">
                  Restaurez votre catalogue et vos factures à partir d'un fichier de sauvegarde JSON.
                </p>
              </div>
              <label className="w-full py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Sélectionner Fichier JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Nettoyage & Remise à Zéro de Mon Espace Commercial</span>
            </div>

            <div className="p-5 bg-rose-50/70 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-slate-900 text-xs">
                  Vider les produits et opérations de test
                </div>
                <p className="text-slate-600 text-[11px] max-w-md leading-relaxed">
                  Supprime les articles, mouvements, ventes, factures, clients, fournisseurs et dépenses de votre compte pour démarrer sur une base propre (sans affecter les autres comptes).
                </p>
                {cleanDemoSuccess && (
                  <div className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Espace commercial réinitialisé avec succès !</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsClearAllDemoModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Vider Mon Espace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Admin Subscriptions Panel (ONLY administrateur) */}
      {activeSubTab === 'plans' && isAdmin && <AdminSubscriptionsTab />}

      {/* Add Store Modal */}
      {isAddStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Ajouter une Nouvelle Boutique</h3>
              <button
                onClick={() => setIsAddStoreModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStoreSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nom du point de vente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boutique Almadies 2 ou Dépôt Rufisque"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adresse</label>
                <input
                  type="text"
                  placeholder="Rue, avenue ou quartier"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Ville</label>
                  <input
                    type="text"
                    value={storeCity}
                    onChange={(e) => setStoreCity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStoreModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Créer la Boutique
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Merchant Workspace */}
      {isClearAllDemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Réinitialiser votre espace commercial ?
                </h3>
                <p className="text-[11px] text-slate-500">
                  Remise à zéro des données de votre compte
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cette opération va supprimer vos {products.length} produits, ventes, factures, clients et fournisseurs. Votre compte personnel et votre fiche entreprise (nom, téléphone, adresse) seront conservés.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllDemoModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  clearMerchantWorkspaceData();
                  setIsClearAllDemoModalOpen(false);
                  setCleanDemoSuccess(true);
                  setTimeout(() => setCleanDemoSuccess(false), 4000);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Oui, tout vider</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
