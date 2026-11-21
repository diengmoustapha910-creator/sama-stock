import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BillingCycle,
  Plan,
  PlanFeatureKey,
  Subscription,
  SubscriptionStatus,
} from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  PLAN_FEATURE_DEFINITIONS,
  calculateMRR,
  calculateARR,
} from '../../services/subscriptionService';
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit2,
  RotateCcw,
  Zap,
  Calendar,
  Gift,
  AlertTriangle,
  X,
  FileText,
  Lock,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Search,
  Key,
  Terminal,
  Radio,
  Power,
  Wallet,
  KeyRound,
} from 'lucide-react';

export const AdminSubscriptionsTab: React.FC = () => {
  const {
    currentUser,
    adminOverview,
    refreshAdminOverview,
    updatePlanConfig,
    resetPlansToDefault,
    adminUpdateSubscription,
    adminRecordPayment,
    adminToggleAccountStatus,
    adminResetAccountPassword,
    unitechPayConfig,
    unitechPayOrders,
    unitechPayWebhookLogs,
    refreshUnitechPayData,
    updateUnitechPayConfig,
    configureRemoteUnitechPayWebhook,
    initiateUnitechPayWavePayment,
    checkUnitechPayOrderStatus,
    simulateUnitechPayWebhookEvent,
  } = useApp();

  const isAdmin = currentUser.role === 'administrateur';

  const plans = adminOverview?.plans || [];
  const merchantAccounts = adminOverview?.merchantAccounts || [];
  const paymentTransactions = adminOverview?.paymentTransactions || [];
  const subscriptionEvents = adminOverview?.subscriptionEvents || [];

  const [activeAdminSubTab, setActiveAdminSubTab] = useState<
    'plans' | 'subscriptions' | 'transactions' | 'unitechpay' | 'audit'
  >('subscriptions');

  // UnitechPay admin state
  const [unitechConfigForm, setUnitechConfigForm] = useState(() => ({
    ...unitechPayConfig,
    apiUrl: unitechPayConfig?.apiUrl || 'https://api.unitech.sn/api.php',
    apiKey: unitechPayConfig?.apiKey || '',
    webhookUrl: unitechPayConfig?.webhookUrl || '',
    signatureMethod: unitechPayConfig?.signatureMethod || 'auto',
    autoActivate: Boolean(unitechPayConfig?.autoActivate ?? true),
  }));
  const [isSavingUnitechConfig, setIsSavingUnitechConfig] = useState(false);
  const [isConfiguringRemoteWebhook, setIsConfiguringRemoteWebhook] = useState(false);
  const [copiedUnitechUrl, setCopiedUnitechUrl] = useState(false);
  const [unitechTestRunning, setUnitechTestRunning] = useState<string | null>(null);
  const [lastSimulationResponse, setLastSimulationResponse] = useState<any | null>(null);
  const [selectedUnitechLogModal, setSelectedUnitechLogModal] = useState<any | null>(null);
  const [unitechSearch, setUnitechSearch] = useState('');
  const [unitechFilterStatus, setUnitechFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (unitechPayConfig) {
      setUnitechConfigForm({
        ...unitechPayConfig,
        apiUrl: unitechPayConfig.apiUrl || 'https://api.unitech.sn/api.php',
        apiKey: unitechPayConfig.apiKey || '',
        webhookUrl: unitechPayConfig.webhookUrl || '',
        signatureMethod: unitechPayConfig.signatureMethod || 'auto',
      });
    }
  }, [unitechPayConfig]);

  // Notifications & errors
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setErrorMsg(null);
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // Search merchant accounts
  const [accountSearch, setAccountSearch] = useState('');
  const [isResettingPwdForId, setIsResettingPwdForId] = useState<string | null>(null);
  const [tempPwdResult, setTempPwdResult] = useState<{
    accountName: string;
    email?: string;
    phone?: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedTempPwd, setCopiedTempPwd] = useState(false);

  // Reset plans modal
  const [isResetPlansModalOpen, setIsResetPlansModalOpen] = useState(false);

  // Plan editing modal
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editMonthlyPrice, setEditMonthlyPrice] = useState<number>(0);
  const [editAnnualPrice, setEditAnnualPrice] = useState<number>(0);
  const [editMaxProducts, setEditMaxProducts] = useState<number>(50);
  const [editMaxUsers, setEditMaxUsers] = useState<number>(1);
  const [editMaxStores, setEditMaxStores] = useState<number>(1);
  const [editMaxInvoices, setEditMaxInvoices] = useState<number>(10);
  const [editFeatures, setEditFeatures] = useState<PlanFeatureKey[]>([]);

  // Target account selection for admin subscription modals
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Manual override modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideAccountId, setOverrideAccountId] = useState<string>('');
  const [overridePlanId, setOverridePlanId] = useState<string>('plan-gratuit');
  const [overrideStatus, setOverrideStatus] = useState<SubscriptionStatus>('actif');
  const [overrideCycle, setOverrideCycle] = useState<BillingCycle>('mensuel');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState<string>('');
  const [overrideJustification, setOverrideJustification] = useState('');

  // Trial modal
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialAccountId, setTrialAccountId] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(14);
  const [trialPlanId, setTrialPlanId] = useState<string>('plan-pro');

  // Comped modal
  const [isCompedModalOpen, setIsCompedModalOpen] = useState(false);
  const [compedAccountId, setCompedAccountId] = useState<string>('');
  const [compedPlanId, setCompedPlanId] = useState<string>('plan-pro');
  const [compedReason, setCompedReason] = useState(
    'Partenariat commercial ou compte sponsorisé SAMA STOCK'
  );

  // Payment / UnitechPay Wave modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payPlanId, setPayPlanId] = useState<string>('plan-pro');
  const [payCycle, setPayCycle] = useState<BillingCycle>('mensuel');
  const [payMethod, setPayMethod] = useState<
    'unitechpay_wave' | 'wave' | 'orange_money' | 'carte' | 'virement'
  >('unitechpay_wave');
  const [payPhone, setPayPhone] = useState<string>('+221 ');
  const [payAmount, setPayAmount] = useState<number>(5000);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [generatedWaveResult, setGeneratedWaveResult] = useState<{
    wavePaymentUrl: string;
    reference: string;
  } | null>(null);
  const [isCheckingWaveStatus, setIsCheckingWaveStatus] = useState(false);

  // Sync default selected account when merchantAccounts loads
  useEffect(() => {
    if (merchantAccounts.length > 0 && !selectedAccountId) {
      const firstMerchant =
        merchantAccounts.find((m) => m.account.role === 'commercant') || merchantAccounts[0];
      if (firstMerchant) {
        setSelectedAccountId(firstMerchant.account.id);
      }
    }
  }, [merchantAccounts, selectedAccountId]);

  // Platform KPIs across ALL merchant subscriptions
  const allSubscriptions = useMemo(() => {
    return merchantAccounts
      .map((m) => m.subscription)
      .filter((s): s is NonNullable<typeof s> => Boolean(s)) as Subscription[];
  }, [merchantAccounts]);

  const mrr = useMemo(() => calculateMRR(allSubscriptions, plans), [allSubscriptions, plans]);
  const arr = useMemo(() => calculateARR(allSubscriptions, plans), [allSubscriptions, plans]);

  const totalCollected = useMemo(() => {
    return paymentTransactions
      .filter((t) => t.status === 'succes')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [paymentTransactions]);

  const activePaidOrTrialCount = useMemo(() => {
    return merchantAccounts.filter(
      (m) => m.subscription && m.subscription.status === 'actif' && m.subscription.planId !== 'plan-gratuit'
    ).length;
  }, [merchantAccounts]);

  const filteredMerchants = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return merchantAccounts;
    return merchantAccounts.filter(
      (m) =>
        m.account.name.toLowerCase().includes(q) ||
        m.organizationName.toLowerCase().includes(q) ||
        m.account.email.toLowerCase().includes(q) ||
        m.account.phone.toLowerCase().includes(q)
    );
  }, [merchantAccounts, accountSearch]);

  const openOverrideForAccount = (accountId?: string) => {
    const targetId = accountId || selectedAccountId || merchantAccounts[0]?.account.id || '';
    const item = merchantAccounts.find((m) => m.account.id === targetId);
    setOverrideAccountId(targetId);
    setOverridePlanId(item?.subscription?.planId || 'plan-gratuit');
    setOverrideStatus(item?.subscription?.status || 'actif');
    setOverrideCycle(item?.subscription?.billingCycle || 'mensuel');
    setOverrideExpiresAt(
      item?.subscription?.renewalDate ? item.subscription.renewalDate.slice(0, 10) : ''
    );
    setOverrideJustification('');
    setIsOverrideModalOpen(true);
  };

  const openTrialForAccount = (accountId?: string) => {
    const targetId = accountId || selectedAccountId || merchantAccounts[0]?.account.id || '';
    setTrialAccountId(targetId);
    setTrialDays(14);
    setTrialPlanId('plan-pro');
    setIsTrialModalOpen(true);
  };

  const openCompedForAccount = (accountId?: string) => {
    const targetId = accountId || selectedAccountId || merchantAccounts[0]?.account.id || '';
    setCompedAccountId(targetId);
    setCompedPlanId('plan-pro');
    setIsCompedModalOpen(true);
  };

  const openPaymentForAccount = (accountId?: string) => {
    const targetId = accountId || selectedAccountId || merchantAccounts[0]?.account.id || '';
    const item = merchantAccounts.find((m) => m.account.id === targetId);
    const defaultPlan = plans.find((p) => p.id === 'plan-pro') || plans[1] || plans[0];
    setPayAccountId(targetId);
    setPayPlanId(defaultPlan?.id || 'plan-pro');
    setPayCycle('mensuel');
    setPayMethod('unitechpay_wave');
    setPayPhone(item?.account.phone || '+221 ');
    setPayAmount(defaultPlan?.monthlyPrice || 5000);
    setGeneratedWaveResult(null);
    setIsPaymentModalOpen(true);
  };

  const handlePlanOrCycleChangeInPay = (nextPlanId: string, nextCycle: BillingCycle) => {
    setPayPlanId(nextPlanId);
    setPayCycle(nextCycle);
    const p = plans.find((pl) => pl.id === nextPlanId);
    if (p) {
      setPayAmount(nextCycle === 'annuel' ? p.annualPrice : p.monthlyPrice);
    }
  };

  const handleOpenEditPlan = (p: Plan) => {
    setEditingPlan(p);
    setEditMonthlyPrice(p.monthlyPrice);
    setEditAnnualPrice(p.annualPrice);
    setEditMaxProducts(p.limits.maxProducts);
    setEditMaxUsers(p.limits.maxUsers);
    setEditMaxStores(p.limits.maxStores);
    setEditMaxInvoices(p.limits.maxInvoicesPerMonth);
    setEditFeatures([...p.features]);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      await updatePlanConfig(editingPlan.id, {
        monthlyPrice: Number(editMonthlyPrice),
        annualPrice: Number(editAnnualPrice),
        limits: {
          maxProducts: Number(editMaxProducts),
          maxUsers: Number(editMaxUsers),
          maxStores: Number(editMaxStores),
          maxInvoicesPerMonth: Number(editMaxInvoices),
        },
        features: editFeatures,
      });
      const editedName = editingPlan.name;
      setEditingPlan(null);
      showToast(`La formule « ${editedName} » a été mise à jour avec succès.`);
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de la mise à jour de la formule.');
    }
  };

  const toggleFeatureInEdit = (key: PlanFeatureKey) => {
    setEditFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideAccountId) {
      showError('Veuillez sélectionner un compte commerçant.');
      return;
    }
    if (!overrideJustification.trim()) {
      showError('Veuillez saisir une justification obligatoire pour le journal d’audit.');
      return;
    }

    try {
      const expiresIso = overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null;
      await adminUpdateSubscription(overrideAccountId, {
        planId: overridePlanId,
        status: overrideStatus,
        billingCycle: overrideCycle,
        renewalDate: expiresIso,
        expiresAt: expiresIso,
        isTrial: false,
        isComped: false,
        justification: overrideJustification.trim(),
        eventType: 'MANUAL_OVERRIDE',
      });
      setIsOverrideModalOpen(false);
      setOverrideJustification('');
      showToast('L’abonnement du commerçant a été mis à jour et journalisé.');
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de la modification manuelle.');
    }
  };

  const handleApplyTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialAccountId) return;
    try {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + Number(trialDays));
      await adminUpdateSubscription(trialAccountId, {
        planId: trialPlanId,
        status: 'actif',
        billingCycle: 'mensuel',
        startDate: start.toISOString(),
        renewalDate: end.toISOString(),
        expiresAt: end.toISOString(),
        isTrial: true,
        isComped: false,
        justification: `Période d’essai gratuit de ${trialDays} jours accordée par l’administrateur.`,
        eventType: 'TRIAL_STARTED',
      });
      setIsTrialModalOpen(false);
      showToast(`Période d'essai gratuit de ${trialDays} jours accordée avec succès.`);
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de l’activation de l’essai.');
    }
  };

  const handleApplyComped = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compedAccountId || !compedReason.trim()) return;
    try {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      await adminUpdateSubscription(compedAccountId, {
        planId: compedPlanId,
        status: 'actif',
        billingCycle: 'annuel',
        startDate: start.toISOString(),
        renewalDate: end.toISOString(),
        expiresAt: end.toISOString(),
        isTrial: false,
        isComped: true,
        justification: compedReason.trim(),
        eventType: 'MANUAL_OVERRIDE',
      });
      setIsCompedModalOpen(false);
      showToast('Abonnement gratuit/sponsorisé accordé avec succès.');
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de l’octroi de l’abonnement offert.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAccountId) {
      showError('Veuillez sélectionner un compte commerçant.');
      return;
    }
    setIsProcessingPayment(true);
    setGeneratedWaveResult(null);
    try {
      if (payMethod === 'unitechpay_wave') {
        const res = await initiateUnitechPayWavePayment(
          payPlanId,
          payCycle,
          payPhone,
          payAccountId
        );
        setGeneratedWaveResult({
          wavePaymentUrl: res.wavePaymentUrl,
          reference: res.reference,
        });
        showToast(`Lien de paiement Wave généré (Réf: ${res.reference}).`);
      } else {
        await adminRecordPayment(payAccountId, {
          planId: payPlanId,
          billingCycle: payCycle,
          amount: Number(payAmount),
          paymentMethod: payMethod,
          status: 'succes',
          phoneNumber: payPhone,
        });
        setIsPaymentModalOpen(false);
        showToast('Paiement enregistré et abonnement activé avec succès.');
      }
    } catch (err: any) {
      showError(err?.message || 'Erreur lors de l’opération de paiement.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center max-w-xl mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900">
            Accès Administrateur Principal Requis
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            La gestion des abonnements, des tarifs, des échéances et des paiements UnitechPay est strictement réservée à l’administrateur principal de SAMA STOCK.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Tableau de Bord Administrateur — Abonnements SAMA STOCK
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#123B67] text-white">
              Admin Principal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion centralisée des comptes commerçants, formules, échéances, renouvellements, paiements et webhooks UnitechPay.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openTrialForAccount()}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Accorder un Essai</span>
          </button>

          <button
            onClick={() => openCompedForAccount()}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#123B67] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Gift className="w-3.5 h-3.5 text-[#F58220]" />
            <span>Offrir un Abonnement</span>
          </button>

          <button
            onClick={() => openPaymentForAccount()}
            className="px-3 py-2 bg-[#F58220] hover:bg-[#E07315] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Paiement / Lien Wave</span>
          </button>

          <button
            onClick={() => openOverrideForAccount()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Modifier Abonnement</span>
          </button>

          <button
            onClick={async () => {
              await Promise.all([refreshAdminOverview(), refreshUnitechPayData()]);
              showToast('Données administrateur actualisées.');
            }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast Notifications */}
      {notificationMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notificationMsg}</span>
          </div>
          <button
            onClick={() => setNotificationMsg(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Revenue & Platform Statistics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              MRR (Revenu Mensuel)
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {formatFCFA(mrr)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              Récurrent normalisé global
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-[#123B67] rounded-xl">
            <DollarSign className="w-5 h-5 text-[#123B67]" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              ARR (Revenu Annuel)
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {formatFCFA(arr)}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">
              Projection sur 12 mois
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-orange-50 text-[#F58220] rounded-xl">
            <CreditCard className="w-5 h-5 text-[#F58220]" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Encaissé
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {formatFCFA(totalCollected)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Wave / OM / CB confirmés
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Comptes Commerçants
            </div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
              {merchantAccounts.filter((m) => m.account.active).length} / {merchantAccounts.length}
            </div>
            <div className="text-[10px] text-purple-600 mt-0.5 font-medium">
              Dont {activePaidOrTrialCount} formule(s) payante(s)/essai
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs within Admin Section */}
      <div className="flex items-center gap-4 border-b border-slate-200 text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveAdminSubTab('subscriptions')}
          className={`pb-2.5 font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeAdminSubTab === 'subscriptions'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Comptes & Abonnements ({merchantAccounts.length})
        </button>
        <button
          onClick={() => setActiveAdminSubTab('plans')}
          className={`pb-2.5 font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeAdminSubTab === 'plans'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Tarifs & Formules ({plans.length})
        </button>
        <button
          onClick={() => setActiveAdminSubTab('transactions')}
          className={`pb-2.5 font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeAdminSubTab === 'transactions'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Transactions & Paiements ({paymentTransactions.length})
        </button>
        <button
          onClick={() => setActiveAdminSubTab('unitechpay')}
          className={`pb-2.5 font-bold whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5 ${
            activeAdminSubTab === 'unitechpay'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-[#F58220]" />
          <span>Webhooks UnitechPay & Wave ({unitechPayWebhookLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveAdminSubTab('audit')}
          className={`pb-2.5 font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeAdminSubTab === 'audit'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Journal d’Audit ({subscriptionEvents.length})
        </button>
      </div>

      {/* SubTab 1: Multi-Merchant Subscriptions Table */}
      {activeAdminSubTab === 'subscriptions' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Comptes Commerçants & Abonnements ({filteredMerchants.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Vue centralisée des comptes indépendants, formules actives, dates de début, échéances et statuts d’accès.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un commerçant..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:border-[#123B67]"
              />
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Commerçant & Organisation</th>
                  <th className="py-3 px-4">Formule</th>
                  <th className="py-3 px-4">Cycle</th>
                  <th className="py-3 px-4 text-center">Statut Abo</th>
                  <th className="py-3 px-4">Date Début</th>
                  <th className="py-3 px-4">Échéance / Renouv.</th>
                  <th className="py-3 px-4 text-center">Accès Compte</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMerchants.map((m) => {
                  const sub = m.subscription;
                  const planName =
                    sub?.planName ||
                    plans.find((p) => p.id === sub?.planId)?.name ||
                    'Gratuit';
                  const isSelfAdmin = m.account.id === currentUser.id;

                  return (
                    <tr key={m.account.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{m.organizationName}</span>
                          {m.account.role === 'administrateur' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#123B67] text-white">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {m.account.name} · <span className="font-mono">{m.account.phone || '-'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {m.account.email || 'Sans e-mail'} · {m.storesCount} boutique(s) · {m.productsCount} produit(s)
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-[#123B67]">{planName}</span>
                        {sub?.isTrial && (
                          <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                            Essai
                          </span>
                        )}
                        {sub?.isComped && (
                          <span className="ml-1.5 text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">
                            Offert
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 capitalize text-slate-600">
                        {sub?.billingCycle || 'mensuel'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sub?.status === 'actif'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : sub?.status === 'gratuit'
                              ? 'bg-slate-100 text-slate-700'
                              : sub?.status === 'expire' || sub?.status === 'suspendu'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {sub?.status || 'gratuit'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {sub?.startDate
                          ? new Date(sub.startDate).toLocaleDateString('fr-FR')
                          : '-'}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 text-[11px]">
                        {sub?.renewalDate
                          ? new Date(sub.renewalDate).toLocaleDateString('fr-FR')
                          : 'Illimité (Gratuit)'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={isSelfAdmin}
                          onClick={async () => {
                            try {
                              await adminToggleAccountStatus(m.account.id, !m.account.active);
                              showToast(
                                `Compte ${m.account.name} ${!m.account.active ? 'activé' : 'suspendu'}.`
                              );
                            } catch (err: any) {
                              showError(err?.message || 'Action impossible.');
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                            m.account.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          } disabled:opacity-60`}
                          title={
                            isSelfAdmin
                              ? 'Compte administrateur principal protégé'
                              : 'Activer ou suspendre ce compte'
                          }
                        >
                          <Power className="w-3 h-3" />
                          <span>{m.account.active ? 'Actif' : 'Suspendu'}</span>
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openPaymentForAccount(m.account.id)}
                          className="px-2.5 py-1 bg-orange-50 hover:bg-[#F58220] text-[#F58220] hover:text-white border border-orange-200 text-[11px] font-bold rounded-lg transition-colors"
                        >
                          Paiement / Wave
                        </button>
                        <button
                          type="button"
                          onClick={() => openOverrideForAccount(m.account.id)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-[#123B67] hover:text-white text-slate-700 text-[11px] font-bold rounded-lg transition-colors"
                        >
                          Modifier
                        </button>
                        {!isSelfAdmin && m.account.role !== 'administrateur' && (
                          <button
                            type="button"
                            disabled={isResettingPwdForId === m.account.id}
                            onClick={async () => {
                              setIsResettingPwdForId(m.account.id);
                              try {
                                const res = await adminResetAccountPassword(m.account.id);
                                setCopiedTempPwd(false);
                                setTempPwdResult({
                                  accountName: res.accountName || m.account.name,
                                  email: m.account.email,
                                  phone: m.account.phone,
                                  temporaryPassword: res.temporaryPassword,
                                });
                                showToast(
                                  `Mot de passe temporaire généré pour ${m.account.name}.`
                                );
                              } catch (err: any) {
                                showError(
                                  err?.message || 'Impossible de réinitialiser le mot de passe.'
                                );
                              } finally {
                                setIsResettingPwdForId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border border-amber-200 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                            title="Générer un mot de passe temporaire et révoquer les sessions actives"
                          >
                            <KeyRound className="w-3 h-3" />
                            <span>
                              {isResettingPwdForId === m.account.id ? 'En cours...' : 'Réinit. MDP'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredMerchants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Aucun compte commerçant trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 2: Configurable Plans Editor */}
      {activeAdminSubTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Formules Tarifaires & Quotas en vigueur (Admin Uniquement)
              </h3>
              <p className="text-[11px] text-slate-500">
                Modifiez les prix, les plafonds de produits, de boutiques et les fonctionnalités associées.
              </p>
            </div>
            <button
              onClick={() => setIsResetPlansModalOpen(true)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Rétablir défaut</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#F58220]">
                        {plan.badge || 'Formule'}
                      </span>
                      <h4 className="text-lg font-black text-slate-900">{plan.name}</h4>
                    </div>
                    <button
                      onClick={() => handleOpenEditPlan(plan)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-[#123B67] hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configurer</span>
                    </button>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tarif Mensuel :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFCFA(plan.monthlyPrice)} / mois
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tarif Annuel :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatFCFA(plan.annualPrice)} / an
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[11px]">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px] pt-1">
                      Limites de Quotas :
                    </div>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2.5">
                      <div className="py-1 flex justify-between">
                        <span className="text-slate-500">Max Produits :</span>
                        <span className="font-bold text-slate-800">
                          {plan.limits.maxProducts === -1 ? 'Illimité (-1)' : plan.limits.maxProducts}
                        </span>
                      </div>
                      <div className="py-1 flex justify-between">
                        <span className="text-slate-500">Max Boutiques :</span>
                        <span className="font-bold text-slate-800">
                          {plan.limits.maxStores === -1 ? 'Illimité (-1)' : plan.limits.maxStores}
                        </span>
                      </div>
                      <div className="py-1 flex justify-between">
                        <span className="text-slate-500">Max Factures / mois :</span>
                        <span className="font-bold text-slate-800">
                          {plan.limits.maxInvoicesPerMonth === -1
                            ? 'Illimité (-1)'
                            : plan.limits.maxInvoicesPerMonth}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1">
                    <strong>{plan.features.length}</strong> fonctionnalité(s) activée(s) sur cette formule.
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 3: Platform Transactions */}
      {activeAdminSubTab === 'transactions' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Transactions & Encaisses Globales ({paymentTransactions.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Registre administratif complet des règlements Wave, UnitechPay, Orange Money et virement.
              </p>
            </div>
          </div>

          {paymentTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucun paiement enregistré pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Réf Transaction</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Commerçant</th>
                    <th className="py-3 px-4">Formule</th>
                    <th className="py-3 px-4">Montant</th>
                    <th className="py-3 px-4">Moyen</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {txn.reference}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(txn.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{txn.customerName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{txn.phoneNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {txn.planName} ({txn.billingCycle})
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#123B67]">
                        {formatFCFA(txn.amount)}
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-600">
                        {txn.paymentMethod.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            txn.status === 'succes'
                              ? 'bg-emerald-50 text-emerald-700'
                              : txn.status === 'en_attente'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {txn.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SubTab 4: UnitechPay Webhooks & Wave Confirmation */}
      {activeAdminSubTab === 'unitechpay' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-[#123B67] to-[#F58220] text-white rounded-2xl shadow-sm shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Module Webhook UnitechPay & Wave Sénégal
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    HMAC-SHA256 Actif
                  </span>
                  {unitechPayConfig.isConfiguredWithUnitech ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-[#123B67] border border-blue-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Configuré sur UnitechPay</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      Configuration en attente
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Traitement sécurisé des notifications de paiement Wave via l’API UnitechPay (
                  <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">
                    https://api.unitech.sn/api.php
                  </code>
                  ), vérification cryptographique et activation automatique instantanée des abonnements.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setIsConfiguringRemoteWebhook(true);
                  try {
                    const res = await configureRemoteUnitechPayWebhook(unitechConfigForm.webhookUrl);
                    showToast(res.message);
                  } catch (err: any) {
                    showError(err?.message || 'Erreur lors de la configuration distante.');
                  } finally {
                    setIsConfiguringRemoteWebhook(false);
                  }
                }}
                disabled={isConfiguringRemoteWebhook}
                className="px-3.5 py-2 bg-gradient-to-r from-[#F58220] to-[#E07315] hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Radio className={`w-3.5 h-3.5 ${isConfiguringRemoteWebhook ? 'animate-spin' : ''}`} />
                <span>{isConfiguringRemoteWebhook ? 'Configuration...' : 'Configurer sur l’API UnitechPay'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await refreshUnitechPayData();
                  showToast('Logs et commandes UnitechPay actualisés.');
                }}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
                title="Actualiser les données UnitechPay"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Notifications Reçues
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {unitechPayWebhookLogs.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total webhooks UnitechPay</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Paiements Wave Confirmés
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
                {unitechPayOrders.filter((o) => o.status === 'completed').length}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                Abonnements activés automatiquement
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Taux de Validité HMAC
              </div>
              <div className="text-2xl font-black text-[#123B67] mt-1 font-mono">
                {unitechPayWebhookLogs.length > 0
                  ? `${Math.round(
                      (unitechPayWebhookLogs.filter((l) => l.signatureValid).length /
                        unitechPayWebhookLogs.length) *
                        100
                    )}%`
                  : '100%'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Contrôle timingSafeEqual</div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Passerelle Mobile
              </div>
              <div className="text-sm font-black text-slate-900 mt-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                <span>Wave Sénégal (XOF)</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                Gestion centralisée Admin
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Configuration Column */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#F58220]" />
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Paramètres Webhook & Sécurité
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Configuration de la passerelle UnitechPay côté serveur.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setIsSavingUnitechConfig(true);
                  try {
                    const res = await updateUnitechPayConfig(unitechConfigForm);
                    showToast(res.message);
                  } catch (err: any) {
                    showError(err?.message || 'Erreur lors de la sauvegarde.');
                  } finally {
                    setIsSavingUnitechConfig(false);
                  }
                }}
                className="space-y-3.5 text-xs"
              >
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    URL du Webhook SAMA STOCK (HTTPS) *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={
                        unitechConfigForm.webhookUrl ||
                        `${window.location.origin}/api/webhooks/unitechpay`
                      }
                      onChange={(e) =>
                        setUnitechConfigForm((prev) => ({ ...prev, webhookUrl: e.target.value }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px] bg-slate-50 text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          unitechConfigForm.webhookUrl ||
                          `${window.location.origin}/api/webhooks/unitechpay`;
                        navigator.clipboard.writeText(url);
                        setCopiedUnitechUrl(true);
                        setTimeout(() => setCopiedUnitechUrl(false), 2000);
                      }}
                      className="p-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                      title="Copier l'URL HTTPS du webhook"
                    >
                      {copiedUnitechUrl ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    API UnitechPay Endpoint *
                  </label>
                  <input
                    type="url"
                    required
                    value={unitechConfigForm.apiUrl || ''}
                    onChange={(e) =>
                      setUnitechConfigForm((prev) => ({ ...prev, apiUrl: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px] bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Clé API UnitechPay (Secret HMAC)
                  </label>
                  <input
                    type="password"
                    required={!unitechConfigForm.hasApiKey}
                    value={unitechConfigForm.apiKey || ''}
                    onChange={(e) =>
                      setUnitechConfigForm((prev) => ({ ...prev, apiKey: e.target.value }))
                    }
                    placeholder={
                      unitechConfigForm.hasApiKey
                        ? `Configurée (${unitechConfigForm.apiKeyMasked || '••••••••'}) — laisser vide pour conserver`
                        : 'unitech_sec_live_...'
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-[11px] bg-white text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    En production, UNITECHPAY_API_KEY est conservée dans Google Secret Manager côté serveur uniquement.
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Méthode de validation HMAC
                  </label>
                  <select
                    value={unitechConfigForm.signatureMethod || 'auto'}
                    onChange={(e: any) =>
                      setUnitechConfigForm((prev) => ({
                        ...prev,
                        signatureMethod: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  >
                    <option value="auto">
                      Auto-détection (Raw Body HTTP + Format Canonique Pipe) [Recommandé]
                    </option>
                    <option value="raw_body">
                      Méthode 1 : Corps brut HTTP (X-UNITECHPAY-SIGNATURE)
                    </option>
                    <option value="canonical_pipe">
                      Méthode 2 : event|reference|amount|status|signed_at
                    </option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoActivateToggle"
                      checked={Boolean(unitechConfigForm.autoActivate)}
                      onChange={(e) =>
                        setUnitechConfigForm((prev) => ({
                          ...prev,
                          autoActivate: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-[#F58220] focus:ring-[#F58220]"
                    />
                    <label
                      htmlFor="autoActivateToggle"
                      className="font-semibold text-slate-700 text-xs cursor-pointer"
                    >
                      Activation automatique immédiate
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingUnitechConfig}
                    className="px-4 py-2 bg-[#123B67] hover:bg-[#0E2E52] text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                  >
                    {isSavingUnitechConfig ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>

            {/* Sandbox Engine */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      Banc d’Essai & Tests de Conformité UnitechPay
                    </h4>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tests réservés à l’administrateur pour vérifier les webhooks et signatures HMAC.
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                  Sandbox Engine
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  {
                    type: 'payment_completed' as const,
                    title: '1. Paiement Wave Confirmé',
                    badge: 'HTTP 200',
                    desc: 'Vérifie HMAC, référence et active la formule Pro (5 000 FCFA).',
                    border: 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50',
                    text: 'text-emerald-900',
                    badgeCls: 'bg-emerald-100 text-emerald-800',
                    extra: { planId: 'plan-pro', amount: 5000 },
                  },
                  {
                    type: 'payment_failed' as const,
                    title: '2. Paiement Échoué',
                    badge: 'payment_failed',
                    desc: 'Marque la transaction comme échouée sans activer d’abonnement.',
                    border: 'border-rose-200 bg-rose-50/40 hover:bg-rose-50',
                    text: 'text-rose-900',
                    badgeCls: 'bg-rose-100 text-rose-800',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'payment_expired' as const,
                    title: '3. Paiement Expiré',
                    badge: 'payment_expired',
                    desc: 'Session Wave expirée. Conserve la traçabilité sans activer.',
                    border: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50',
                    text: 'text-amber-900',
                    badgeCls: 'bg-amber-100 text-amber-800',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'invalid_signature' as const,
                    title: '4. Signature Invalide',
                    badge: 'HTTP 401',
                    desc: 'Prouve le rejet strict d’une signature HMAC falsifiée.',
                    border: 'border-purple-200 bg-purple-50/40 hover:bg-purple-50',
                    text: 'text-purple-900',
                    badgeCls: 'bg-purple-100 text-purple-800',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'unknown_reference' as const,
                    title: '5. Référence Inconnue',
                    badge: 'Réf Orpheline',
                    desc: 'Gestion sécurisée d’une référence non pré-enregistrée.',
                    border: 'border-slate-200 bg-slate-50 hover:bg-slate-100',
                    text: 'text-slate-800',
                    badgeCls: 'bg-slate-200 text-slate-700',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'amount_mismatch' as const,
                    title: '6. Montant Incorrect',
                    badge: 'HTTP 400',
                    desc: 'Envoie 500 FCFA pour 5 000 FCFA. Vérifie le blocage anti-fraude.',
                    border: 'border-rose-200 bg-rose-50/40 hover:bg-rose-50',
                    text: 'text-rose-900',
                    badgeCls: 'bg-rose-100 text-rose-800',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'duplicate_notification' as const,
                    title: '7. Doublon Idempotent',
                    badge: 'Idempotent',
                    desc: 'Répond HTTP 200 sans dupliquer l’abonnement.',
                    border: 'border-blue-200 bg-blue-50/40 hover:bg-blue-50',
                    text: 'text-blue-900',
                    badgeCls: 'bg-blue-100 text-blue-800',
                    extra: { planId: 'plan-pro' },
                  },
                  {
                    type: 'delayed_notification' as const,
                    title: '8. Notification Tardive',
                    badge: 'Horodatage Ancien',
                    desc: 'Gère les notifications livrées avec retard par les serveurs.',
                    border: 'border-slate-200 bg-slate-50 hover:bg-slate-100',
                    text: 'text-slate-800',
                    badgeCls: 'bg-slate-200 text-slate-700',
                    extra: { planId: 'plan-pro' },
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    disabled={Boolean(unitechTestRunning)}
                    onClick={async () => {
                      setUnitechTestRunning(item.type);
                      try {
                        const res = await simulateUnitechPayWebhookEvent({
                          type: item.type,
                          ...item.extra,
                        });
                        setLastSimulationResponse(res);
                        showToast(res.message);
                      } catch (err: any) {
                        showError(err?.message || 'Erreur lors du test');
                      } finally {
                        setUnitechTestRunning(null);
                      }
                    }}
                    className={`p-3 text-left rounded-2xl border transition-all flex flex-col justify-between ${item.border}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-bold ${item.text}`}>{item.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${item.badgeCls}`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{item.desc}</p>
                  </button>
                ))}
              </div>

              {lastSimulationResponse && (
                <div className="mt-3 p-3.5 bg-slate-900 text-slate-100 rounded-2xl font-mono text-xs space-y-2 border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          lastSimulationResponse.httpStatus === 200
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        HTTP {lastSimulationResponse.httpStatus}
                      </span>
                      <span className="text-slate-300 font-sans font-bold">
                        Résultat de simulation
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLastSimulationResponse(null)}
                      className="text-slate-500 hover:text-slate-300 text-[11px]"
                    >
                      ✕ Fermer
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    {lastSimulationResponse.message}
                  </div>
                  <pre className="text-[10px] text-emerald-400 overflow-x-auto p-2 bg-slate-950 rounded-lg max-h-36">
                    {JSON.stringify(
                      lastSimulationResponse.response || lastSimulationResponse,
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Webhooks Audit Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span>Journal des Notifications Webhook UnitechPay</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                    {unitechPayWebhookLogs.length}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traçabilité cryptographique, validation HMAC-SHA256, détection des doublons et activations.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Filtrer par référence..."
                  value={unitechSearch}
                  onChange={(e) => setUnitechSearch(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                />
                <select
                  value={unitechFilterStatus}
                  onChange={(e) => setUnitechFilterStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 font-semibold"
                >
                  <option value="all">Tous les événements</option>
                  <option value="payment_completed">Paiements confirmés</option>
                  <option value="payment_failed">Paiements échoués</option>
                  <option value="payment_expired">Paiements expirés</option>
                  <option value="rejected">Rejetés (Signature/Montant)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date & Heure</th>
                    <th className="py-2.5 px-3">Événement</th>
                    <th className="py-2.5 px-3">Référence / TxID</th>
                    <th className="py-2.5 px-3">Montant</th>
                    <th className="py-2.5 px-3">Signature HMAC</th>
                    <th className="py-2.5 px-3">Résultat</th>
                    <th className="py-2.5 px-3 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitechPayWebhookLogs
                    .filter((l) => {
                      const matchesSearch =
                        !unitechSearch ||
                        l.reference.toLowerCase().includes(unitechSearch.toLowerCase()) ||
                        String(l.transactionId || '').includes(unitechSearch);
                      const matchesStatus =
                        unitechFilterStatus === 'all' ||
                        l.event === unitechFilterStatus ||
                        (unitechFilterStatus === 'rejected' && l.status === 'rejected');
                      return matchesSearch && matchesStatus;
                    })
                    .map((log) => {
                      const isSuccess = log.resultStatus === 'success';
                      const isDuplicate = log.resultStatus === 'duplicate';
                      const isError = log.resultStatus === 'error' || log.status === 'rejected';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                            {new Date(log.receivedAt).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-700">
                              {log.event}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-slate-900 text-xs">
                              {log.reference}
                            </div>
                            {log.transactionId && (
                              <div className="font-mono text-[10px] text-slate-400">
                                ID: #{log.transactionId}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {log.amount ? formatFCFA(log.amount) : '-'}
                          </td>
                          <td className="py-3 px-3">
                            {log.signatureValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3" />
                                <span>Valide</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <X className="w-3 h-3" />
                                <span>Invalide</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isSuccess ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                ✓ Succès
                              </span>
                            ) : isDuplicate ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                Doublon 200
                              </span>
                            ) : isError ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                {log.rejectionReason || 'Rejeté'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                Enregistré
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedUnitechLogModal(log)}
                              className="px-2.5 py-1 text-[11px] font-bold text-[#123B67] hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              Détails JSON
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {unitechPayWebhookLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aucune notification UnitechPay reçue pour l'instant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 5: Audit Trail Log */}
      {activeAdminSubTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Journal d’Audit des Abonnements (Security & Event Log)
            </h3>
            <p className="text-[11px] text-slate-500">
              Traçabilité intégrale de chaque modification administrative, paiement et renouvellement.
            </p>
          </div>

          <div className="space-y-2.5">
            {subscriptionEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 text-[#123B67] shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-[#F58220]" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{evt.description}</div>
                    {evt.justification && (
                      <div className="text-[11px] text-slate-600 mt-1 italic bg-white p-2 rounded-lg border border-slate-200">
                        <strong>Justification :</strong> {evt.justification}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-1">
                      Opéré par : <strong className="text-slate-700">{evt.performedBy}</strong> · ID :{' '}
                      {evt.id}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 shrink-0">
                  {new Date(evt.date).toLocaleString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Reset Plans Confirmation */}
      {isResetPlansModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">
              Rétablir les 3 formules standard SAMA STOCK ?
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Les tarifs et limites des formules Gratuit, Professionnel et Entreprise seront remis aux valeurs par défaut.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetPlansModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await resetPlansToDefault();
                    setIsResetPlansModalOpen(false);
                    showToast('Formules réinitialisées aux valeurs par défaut.');
                  } catch (err: any) {
                    showError(err?.message || 'Erreur lors de la réinitialisation.');
                  }
                }}
                className="px-4 py-2 bg-[#123B67] text-white font-bold rounded-xl"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Plan Configurations & Limits */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 text-[#F58220] rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Configuration de la Formule {editingPlan.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Modifiez les prix et quotas de la formule.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Prix Mensuel (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={editMonthlyPrice}
                    onChange={(e) => setEditMonthlyPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Prix Annuel (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={editAnnualPrice}
                    onChange={(e) => setEditAnnualPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Plafonds de Quotas (-1 pour illimité) :
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Max Produits Actifs
                    </label>
                    <input
                      type="number"
                      value={editMaxProducts}
                      onChange={(e) => setEditMaxProducts(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Max Factures / Mois
                    </label>
                    <input
                      type="number"
                      value={editMaxInvoices}
                      onChange={(e) => setEditMaxInvoices(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">Max Boutiques</label>
                    <input
                      type="number"
                      value={editMaxStores}
                      onChange={(e) => setEditMaxStores(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-2 text-[11px] uppercase tracking-wider">
                  Fonctionnalités associées :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-2xl bg-slate-50">
                  {Object.entries(PLAN_FEATURE_DEFINITIONS).map(([key, def]) => {
                    const isChecked = editFeatures.includes(key as PlanFeatureKey);
                    return (
                      <label
                        key={key}
                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-white border-[#123B67] text-slate-900 font-semibold shadow-2xs'
                            : 'bg-transparent border-transparent text-slate-500 hover:bg-white/60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFeatureInEdit(key as PlanFeatureKey)}
                          className="rounded text-[#123B67]"
                        />
                        <span className="text-[11px] truncate">{def.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-xl shadow-xs"
                >
                  Enregistrer les Modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual Override for a Selected Merchant */}
      {isOverrideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Modification Manuelle d’Abonnement
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Opération réservée à l’administrateur et journalisée dans l’audit.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOverrideModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyOverride} className="space-y-3.5">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Compte Commerçant *</label>
                <select
                  value={overrideAccountId}
                  onChange={(e) => setOverrideAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {merchantAccounts.map((m) => (
                    <option key={m.account.id} value={m.account.id}>
                      {m.organizationName} ({m.account.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Formule cible *</label>
                  <select
                    value={overridePlanId}
                    onChange={(e) => setOverridePlanId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatFCFA(p.monthlyPrice)}/m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cycle</label>
                  <select
                    value={overrideCycle}
                    onChange={(e) => setOverrideCycle(e.target.value as BillingCycle)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="mensuel">Mensuel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Statut *</label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as SubscriptionStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="actif">actif (Abonnement valide)</option>
                  <option value="gratuit">gratuit (Formule d'origine)</option>
                  <option value="en_attente">en_attente (Attente paiement)</option>
                  <option value="periode_grace">periode_grace (Tolérance temporaire)</option>
                  <option value="expire">expire (Expiré)</option>
                  <option value="suspendu">suspendu (Bloqué par admin)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Date d'échéance / renouvellement (optionnel)
                </label>
                <input
                  type="date"
                  value={overrideExpiresAt || ''}
                  onChange={(e) => setOverrideExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Justification obligatoire (Audit Trail) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Renouvellement confirmé, prolongation suite à incident..."
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#123B67] hover:bg-[#0C2744] text-white font-bold rounded-xl shadow-xs"
                >
                  Appliquer & Journaliser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Grant Trial */}
      {isTrialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Accorder une Période d’Essai Gratuit
                </h3>
              </div>
              <button onClick={() => setIsTrialModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyTrial} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Commerçant cible *</label>
                <select
                  value={trialAccountId}
                  onChange={(e) => setTrialAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {merchantAccounts.map((m) => (
                    <option key={m.account.id} value={m.account.id}>
                      {m.organizationName} ({m.account.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Formule testée</label>
                <select
                  value={trialPlanId}
                  onChange={(e) => setTrialPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="plan-pro">Professionnel (250 produits · 50 factures/mois)</option>
                  <option value="plan-entreprise">Entreprise (Multi-Boutiques)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Durée de l'essai</label>
                <select
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours (Standard)</option>
                  <option value={30}>30 jours (Offre découverte)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Activer l'Essai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Grant Comped */}
      {isCompedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#F58220]" />
                <h3 className="font-bold text-slate-900 text-sm">Offrir un Abonnement Gratuit</h3>
              </div>
              <button onClick={() => setIsCompedModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyComped} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Commerçant cible *</label>
                <select
                  value={compedAccountId}
                  onChange={(e) => setCompedAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {merchantAccounts.map((m) => (
                    <option key={m.account.id} value={m.account.id}>
                      {m.organizationName} ({m.account.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Formule offerte</label>
                <select
                  value={compedPlanId}
                  onChange={(e) => setCompedPlanId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="plan-pro">Professionnel</option>
                  <option value="plan-entreprise">Entreprise</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Justification du compte sponsorisé *
                </label>
                <textarea
                  required
                  rows={2}
                  value={compedReason}
                  onChange={(e) => setCompedReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCompedModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#123B67] text-white font-bold rounded-xl shadow-xs"
                >
                  Accorder l'Abonnement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment or Initiate UnitechPay Wave Checkout Link */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#F58220]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Paiement & Renouvellement d’Abonnement
                </h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Commerçant *</label>
                <select
                  value={payAccountId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setPayAccountId(id);
                    const found = merchantAccounts.find((m) => m.account.id === id);
                    if (found?.account.phone) setPayPhone(found.account.phone);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {merchantAccounts.map((m) => (
                    <option key={m.account.id} value={m.account.id}>
                      {m.organizationName} ({m.account.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Formule *</label>
                  <select
                    value={payPlanId}
                    onChange={(e) => handlePlanOrCycleChangeInPay(e.target.value, payCycle)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {plans
                      .filter((p) => p.id !== 'plan-gratuit')
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cycle *</label>
                  <select
                    value={payCycle}
                    onChange={(e) =>
                      handlePlanOrCycleChangeInPay(payPlanId, e.target.value as BillingCycle)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="mensuel">Mensuel</option>
                    <option value="annuel">Annuel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mode *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="unitechpay_wave">Générer lien UnitechPay Wave</option>
                    <option value="wave">Wave (Encaissement manuel)</option>
                    <option value="orange_money">Orange Money (Manuel)</option>
                    <option value="virement">Virement / Espèces</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    readOnly={payMethod === 'unitechpay_wave'}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Téléphone Wave / Contact du commerçant *
                </label>
                <input
                  type="text"
                  required
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              {generatedWaveResult && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl space-y-2.5">
                  <div className="font-bold text-sky-900">
                    Lien Wave prêt (Réf : {generatedWaveResult.reference})
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={generatedWaveResult.wavePaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[#123B67] text-white font-bold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Ouvrir le lien de paiement Wave</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedWaveResult.wavePaymentUrl);
                        showToast('Lien Wave copié.');
                      }}
                      className="px-3 py-2 bg-white border border-sky-300 text-sky-800 font-semibold rounded-xl"
                    >
                      Copier URL
                    </button>
                    <button
                      type="button"
                      disabled={isCheckingWaveStatus}
                      onClick={async () => {
                        setIsCheckingWaveStatus(true);
                        try {
                          const st = await checkUnitechPayOrderStatus(
                            generatedWaveResult.reference
                          );
                          showToast(st.message);
                        } catch (err: any) {
                          showError(err?.message || 'Erreur lors de la vérification.');
                        } finally {
                          setIsCheckingWaveStatus(false);
                        }
                      }}
                      className="px-3 py-2 bg-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50"
                    >
                      {isCheckingWaveStatus ? 'Vérification...' : 'Vérifier Statut'}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isProcessingPayment}
                  className="flex-1 py-2.5 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {isProcessingPayment
                    ? 'Traitement...'
                    : payMethod === 'unitechpay_wave'
                    ? 'Créer Lien Wave UnitechPay'
                    : 'Enregistrer & Activer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Raw Webhook Notification JSON */}
      {selectedUnitechLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Notification Webhook : {selectedUnitechLogModal.event}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Réf : {selectedUnitechLogModal.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUnitechLogModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              {selectedUnitechLogModal.summary}
            </div>

            <pre className="p-3 bg-slate-950 text-emerald-400 rounded-2xl text-[10px] font-mono overflow-x-auto max-h-60 border border-slate-800">
              {JSON.stringify(
                selectedUnitechLogModal.rawPayload || selectedUnitechLogModal,
                null,
                2
              )}
            </pre>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedUnitechLogModal(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: One-time Temporary Password Display */}
      {tempPwdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Mot de passe temporaire généré
                  </h3>
                  <p className="text-[11px] text-slate-500">{tempPwdResult.accountName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempPwdResult(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              Communiquez ce mot de passe temporaire au commerçant de manière sécurisée. Toutes ses sessions actives ont été révoquées et il devra obligatoirement choisir un nouveau mot de passe dès sa connexion.
            </div>

            {(tempPwdResult.email || tempPwdResult.phone) && (
              <div className="text-[11px] text-slate-500 space-y-0.5">
                {tempPwdResult.email && <div>Email : {tempPwdResult.email}</div>}
                {tempPwdResult.phone && (
                  <div>
                    Téléphone : <span className="font-mono">{tempPwdResult.phone}</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-3.5 bg-slate-950 text-emerald-400 rounded-2xl flex items-center justify-between gap-3 border border-slate-800">
              <code className="font-mono text-sm font-bold tracking-wider select-all">
                {tempPwdResult.temporaryPassword}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(tempPwdResult.temporaryPassword);
                    setCopiedTempPwd(true);
                  } catch {
                    // ignore clipboard failure
                  }
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold inline-flex items-center gap-1.5 shrink-0"
              >
                {copiedTempPwd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTempPwdResult(null)}
                className="px-5 py-2.5 bg-[#123B67] hover:bg-[#0C2744] text-white font-bold rounded-xl"
              >
                J’ai noté le mot de passe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
