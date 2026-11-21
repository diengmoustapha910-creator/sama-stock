import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  CheckCircle2,
  X,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const UpgradeModal: React.FC = () => {
  const {
    isUpgradeModalOpen,
    upgradeModalReason,
    closeUpgradeModal,
    quotaSummary,
  } = useApp();

  if (!isUpgradeModalOpen) return null;

  const formatQuotaLine = (item: { used: number; limit: number; remaining: number | null; reached: boolean }) => {
    if (item.limit === -1) {
      return `${item.used} utilisé(s) · Illimité`;
    }
    return `${item.used} / ${item.limit} utilisé(s) · ${item.remaining ?? 0} restant(s)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
        {/* Header with vibrant SAMA gradient */}
        <div className="p-6 bg-gradient-to-r from-[#123B67] via-[#0C2744] to-[#123B67] text-white relative">
          <button
            onClick={closeUpgradeModal}
            className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-2.5 py-1 bg-[#F58220] text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1 shadow-xs">
              <Sparkles className="w-3 h-3" />
              <span>Formule {quotaSummary.planName} · Quota atteint</span>
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-white">
            Passez à une formule supérieure
          </h2>
          <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
            {upgradeModalReason ||
              `Vous avez atteint une limite de votre formule ${quotaSummary.planName}. Passez à une formule supérieure (Professionnel ou Entreprise) pour augmenter vos quotas.`}
          </p>
        </div>

        {/* Live account quotas + upgrade prompt (without exposing financial billing details) */}
        <div className="p-6 space-y-4 text-xs">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Quotas de votre compte ({quotaSummary.planName})
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Période : {quotaSummary.monthKey}
              </span>
            </div>

            <div className="divide-y divide-slate-200/70 text-[11px]">
              <div className="py-1.5 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Produits actifs</span>
                <span className={`font-bold ${quotaSummary.products.reached ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatQuotaLine(quotaSummary.products)}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Boutiques</span>
                <span className={`font-bold ${quotaSummary.stores.reached ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatQuotaLine(quotaSummary.stores)}
                </span>
              </div>
              <div className="py-1.5 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Factures ce mois</span>
                <span className={`font-bold ${quotaSummary.invoices.reached ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatQuotaLine(quotaSummary.invoices)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-orange-50/60 border border-orange-200 rounded-2xl flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#123B67] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Lock className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div className="space-y-1">
              <div className="font-extrabold text-slate-900 text-sm">
                Débloquez plus de capacité avec une formule supérieure
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Contactez l’administrateur SAMA STOCK pour faire évoluer votre compte vers la formule Professionnel (250 produits, 50 factures/mois) ou Entreprise (produits, boutiques et factures illimités).
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <ul className="space-y-2 text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Vos produits, stocks, ventes et factures existants sont intégralement conservés</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Votre compteur mensuel de factures se réinitialise automatiquement le 1er de chaque mois</span>
              </li>
            </ul>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-[11px] text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Vos données restent strictement isolées et sécurisées sur votre compte personnel.</span>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={closeUpgradeModal}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Compris / Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
