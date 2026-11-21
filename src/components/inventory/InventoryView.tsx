import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { InventorySession } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    inventorySessions,
    createInventorySession,
    validateInventorySession,
    stores,
    activeStoreId,
    currentStore,
  } = useApp();

  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [sessionStoreId, setSessionStoreId] = useState(activeStoreId);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Active counting items state
  const [countedItems, setCountedItems] = useState<any[]>([]);

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession = createInventorySession(sessionStoreId, sessionNotes);
    setActiveSession(newSession);
    setCountedItems(newSession.items);
    setIsStartModalOpen(false);
  };

  const handleOpenExistingSession = (session: InventorySession) => {
    setActiveSession(session);
    setCountedItems(session.items);
  };

  const handleUpdateCount = (index: number, val: number) => {
    setCountedItems((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index] };
      cur.countedQty = Math.max(0, val);
      cur.discrepancyQty = cur.countedQty - cur.theoreticalQty;
      cur.discrepancyValue = cur.discrepancyQty * cur.unitCost;
      updated[index] = cur;
      return updated;
    });
  };

  const handleValidateSession = () => {
    if (!activeSession) return;
    if (
      window.confirm(
        'Valider définitivement cet inventaire physique ? Les quantités en stock seront ajustées selon les comptages réels.'
      )
    ) {
      validateInventorySession(activeSession.id, countedItems);
      setActiveSession(null);
    }
  };

  const totalTheo = countedItems.reduce((a, b) => a + b.theoreticalQty, 0);
  const totalCount = countedItems.reduce((a, b) => a + b.countedQty, 0);
  const totalDiffQty = totalCount - totalTheo;
  const totalDiffVal = countedItems.reduce((a, b) => a + b.discrepancyValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Inventaire Physique & Réconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comptage physique périodique, détection des écarts et ajustements de stock
          </p>
        </div>

        {!activeSession && (
          <button
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Démarrer un Inventaire</span>
          </button>
        )}
      </div>

      {/* Active Counting Session Screen */}
      {activeSession ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-[#123B67] font-mono">
                  {activeSession.sessionNumber}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    activeSession.status === 'validee'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {activeSession.status === 'validee' ? 'INVENTAIRE VALIDÉ' : 'COMPTAGE EN COURS'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Boutique : <strong className="text-slate-800">{activeSession.storeName}</strong> · Initié par {activeSession.createdBy} le {activeSession.date}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSession(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Fermer l'écran
              </button>
              {activeSession.status !== 'validee' && (
                <button
                  onClick={handleValidateSession}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valider & Ajuster le Stock</span>
                </button>
              )}
            </div>
          </div>

          {/* Variance KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 text-[11px]">Stock Théorique</div>
              <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">{totalTheo} unités</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 text-[11px]">Comptage Physique Réel</div>
              <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">{totalCount} unités</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 text-[11px]">Écart Quantité</div>
              <div
                className={`font-bold font-mono text-sm mt-0.5 ${
                  totalDiffQty === 0
                    ? 'text-emerald-700'
                    : totalDiffQty > 0
                    ? 'text-blue-700'
                    : 'text-rose-700'
                }`}
              >
                {totalDiffQty > 0 ? `+${totalDiffQty}` : totalDiffQty} unités
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 text-[11px]">Impact Financier Écart</div>
              <div
                className={`font-bold font-mono text-sm mt-0.5 ${
                  totalDiffVal >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatFCFA(totalDiffVal)}
              </div>
            </div>
          </div>

          {/* Counting Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3">Article</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Théorique</th>
                  <th className="py-2.5 px-3 text-right">Compté Réel</th>
                  <th className="py-2.5 px-3 text-right">Écart</th>
                  <th className="py-2.5 px-3 text-right">Valeur Écart (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {countedItems.map((item, idx) => {
                  const hasDiscrepancy = item.discrepancyQty !== 0;

                  return (
                    <tr
                      key={item.productId}
                      className={hasDiscrepancy ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.productName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{item.sku}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {item.theoreticalQty}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {activeSession.status === 'validee' ? (
                          <span className="font-mono font-bold text-slate-900">{item.countedQty}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={item.countedQty}
                            onChange={(e) => handleUpdateCount(idx, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-right font-mono font-bold text-xs bg-white border border-slate-300 rounded focus:outline-hidden focus:border-[#123B67]"
                          />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span
                          className={
                            item.discrepancyQty > 0
                              ? 'text-blue-700'
                              : item.discrepancyQty < 0
                              ? 'text-rose-700'
                              : 'text-slate-400'
                          }
                        >
                          {item.discrepancyQty > 0 ? `+${item.discrepancyQty}` : item.discrepancyQty}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={
                            item.discrepancyValue >= 0 ? 'text-slate-700' : 'text-rose-700 font-bold'
                          }
                        >
                          {formatFCFA(item.discrepancyValue)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* History of Sessions */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Session N°</th>
                  <th className="py-3 px-4">Boutique</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Théorique</th>
                  <th className="py-3 px-4 text-right">Physique</th>
                  <th className="py-3 px-4 text-right">Écart Total</th>
                  <th className="py-3 px-4 text-right">Valeur Écart</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventorySessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      Aucune session d'inventaire physique archivée. Cliquez sur "Démarrer un Inventaire".
                    </td>
                  </tr>
                ) : (
                  inventorySessions.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#123B67]">
                        {sess.sessionNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{sess.storeName}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{sess.date}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {sess.totalTheoreticalQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {sess.totalCountedQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={sess.totalDiscrepancyQty >= 0 ? 'text-blue-700' : 'text-rose-700'}>
                          {sess.totalDiscrepancyQty}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {formatFCFA(sess.totalDiscrepancyValue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${
                            sess.status === 'validee'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {sess.status === 'validee' ? 'VALIDÉE' : 'EN COURS'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenExistingSession(sess)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md font-medium text-xs transition-colors"
                        >
                          Consulter
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Démarrer une Session d'Inventaire Physique
              </h3>
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartSession} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Boutique à inventorier *
                </label>
                <select
                  value={sessionStoreId}
                  onChange={(e) => setSessionStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notes ou observations
                </label>
                <input
                  type="text"
                  placeholder="Ex: Inventaire mensuel fin mars"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Lancer le Comptage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
