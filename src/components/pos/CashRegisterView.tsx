import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CashMovement, CashRegisterShift } from '../../types';
import { formatFCFA, formatDakarTime, formatDakarDateTime } from '../../services/storage';
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  Receipt,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Lock,
} from 'lucide-react';

export const CashRegisterView: React.FC = () => {
  const {
    activeShift,
    shiftHistory,
    currentStore,
    activeStoreId,
    openShift,
    closeShift,
    recordCashMovement,
    hasPermission,
  } = useApp();

  const [initialCash, setInitialCash] = useState(50000);
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [isCloseModal, setIsCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  const [movementModalType, setMovementModalType] = useState<CashMovement['type'] | null>(null);
  const [movAmount, setMovAmount] = useState<number>(0);
  const [movReason, setMovReason] = useState<string>('');
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<CashRegisterShift | null>(null);

  const canManageShift = hasPermission('manageCashShift');
  const canCashInOut = hasPermission('cashInOut');

  const storeHistory = shiftHistory.filter((s) => s.storeId === activeStoreId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Gestion de Caisse & Rapports Z
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ouverture, entrées/sorties d’espèces, dépenses et clôtures journalières ({currentStore?.name})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeShift && canCashInOut && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMovementModalType('entree');
                  setMovAmount(0);
                  setMovReason('');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Entrée Espèces</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementModalType('sortie');
                  setMovAmount(0);
                  setMovReason('');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl"
              >
                <MinusCircle className="w-4 h-4" />
                <span>Sortie / Retrait</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementModalType('depense');
                  setMovAmount(0);
                  setMovReason('');
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
              >
                <Receipt className="w-4 h-4" />
                <span>Dépense Caisse</span>
              </button>
            </>
          )}

          {canManageShift &&
            (activeShift ? (
              <button
                type="button"
                onClick={() => {
                  setActualCash(activeShift.expectedCash);
                  setCloseNotes('');
                  setIsCloseModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Clôturer la Caisse</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpenModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
              >
                <Wallet className="w-4 h-4" />
                <span>Ouvrir la Caisse</span>
              </button>
            ))}
        </div>
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-bold text-slate-900 text-sm">
                Session Ouverte · {activeShift.userName}
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Ouverte le {formatDakarDateTime(activeShift.openedAt)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Fond initial</div>
              <div className="font-mono font-bold text-slate-900 text-sm mt-1">
                {formatFCFA(activeShift.initialCash)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-emerald-700">Ventes Espèces</div>
              <div className="font-mono font-bold text-emerald-900 text-sm mt-1">
                +{formatFCFA(activeShift.cashSales)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
              <div className="text-sky-700">Wave</div>
              <div className="font-mono font-bold text-sky-900 text-sm mt-1">
                {formatFCFA(activeShift.waveSales)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200">
              <div className="text-orange-700">Orange Money</div>
              <div className="font-mono font-bold text-orange-900 text-sm mt-1">
                {formatFCFA(activeShift.orangeMoneySales)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Carte / Virement</div>
              <div className="font-mono font-bold text-slate-900 text-sm mt-1">
                {formatFCFA((activeShift.carteSales || 0) + (activeShift.virementSales || 0))}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#123B67] text-white">
              <div className="text-blue-200">Espèces attendues</div>
              <div className="font-mono font-extrabold text-sm mt-1">
                {formatFCFA(activeShift.expectedCash)}
              </div>
            </div>
          </div>

          {/* Cash Movements List */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mouvements du tiroir-caisse ({activeShift.movements?.length || 0})
            </h3>
            {!activeShift.movements || activeShift.movements.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Aucune entrée ou sortie manuelle enregistrée sur cette session.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {activeShift.movements.map((m) => (
                  <div key={m.id} className="p-3 flex items-center justify-between text-xs bg-white">
                    <div className="flex items-center gap-2.5">
                      {m.type === 'entree' ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      )}
                      <div>
                        <div className="font-semibold text-slate-800">{m.reason}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatDakarTime(m.date)} · {m.operatorName}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold ${
                        m.type === 'entree' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {m.type === 'entree' ? '+' : '-'}
                      {formatFCFA(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-bold text-slate-800">Aucune caisse ouverte actuellement</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Ouvrez une session de caisse avec votre fond de caisse initial pour suivre les espèces, les encaissements Wave/Orange Money et générer un rapport Z en fin de journée.
          </p>
        </div>
      )}

      {/* Closed Shifts History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#123B67]" />
            <h2 className="font-bold text-slate-900 text-sm">Historique des Clôtures (Rapports Z)</h2>
          </div>
          <span className="text-xs text-slate-500">{storeHistory.length} session(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="p-3 font-semibold">Date Clôture</th>
                <th className="p-3 font-semibold">Caissier</th>
                <th className="p-3 font-semibold text-right">Total Ventes</th>
                <th className="p-3 font-semibold text-right">Attendu Espèces</th>
                <th className="p-3 font-semibold text-right">Compté</th>
                <th className="p-3 font-semibold text-right">Écart</th>
                <th className="p-3 font-semibold text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storeHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Aucune clôture enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                storeHistory.map((sh) => {
                  const diff = sh.cashDifference || 0;
                  return (
                    <tr key={sh.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-700">
                        {formatDakarDateTime(sh.closedAt || sh.openedAt)}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{sh.closedBy || sh.userName}</td>
                      <td className="p-3 text-right font-mono font-bold text-[#123B67]">
                        {formatFCFA(sh.totalSales)}
                      </td>
                      <td className="p-3 text-right font-mono">{formatFCFA(sh.expectedCash)}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        {formatFCFA(sh.actualCash ?? sh.expectedCash)}
                      </td>
                      <td
                        className={`p-3 text-right font-mono font-bold ${
                          diff === 0
                            ? 'text-emerald-600'
                            : diff > 0
                            ? 'text-sky-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {diff > 0 ? '+' : ''}
                        {formatFCFA(diff)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedShiftDetail(sh)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                        >
                          Rapport Z
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open Modal */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Ouvrir une Caisse</h3>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Fond de caisse initial (FCFA) :
              </label>
              <input
                type="number"
                value={initialCash}
                onChange={(e) => setInitialCash(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsOpenModal(false)}
                className="px-4 py-2 text-xs text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  openShift(initialCash);
                  setIsOpenModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl"
              >
                Démarrer Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Movement Modal */}
      {movementModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              {movementModalType === 'entree'
                ? 'Entrée d’Espèces en Caisse'
                : movementModalType === 'sortie'
                ? 'Sortie / Retrait de Caisse'
                : 'Dépense Payée par la Caisse'}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Montant (FCFA) :</label>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={movAmount || ''}
                  onChange={(e) => setMovAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Motif / Libellé :</label>
                <input
                  type="text"
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  placeholder="Ex: Appoint monnaie, achat sacs, versement banque..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMovementModalType(null)}
                className="px-4 py-2 text-xs text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                disabled={movAmount <= 0 || !movReason.trim()}
                onClick={() => {
                  recordCashMovement(movementModalType, movAmount, movReason);
                  setMovementModalType(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-[#123B67] disabled:opacity-40 rounded-xl"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">Clôture de Caisse & Rapport Z</h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span>Espèces attendues :</span>
                <span className="font-mono font-bold">{formatFCFA(activeShift.expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total encaissé (tous modes) :</span>
                <span className="font-mono font-bold text-[#123B67]">
                  {formatFCFA(activeShift.totalSales)}
                </span>
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Espèces réellement comptées :
              </label>
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-sm"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Notes de clôture :</label>
              <textarea
                rows={2}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCloseModal(false)}
                className="px-4 py-2 text-xs text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  closeShift(actualCash, closeNotes);
                  setIsCloseModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl"
              >
                Valider Clôture Z
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Z Report Detail Modal */}
      {selectedShiftDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Rapport Z de Caisse</h3>
              <button
                onClick={() => setSelectedShiftDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 font-mono bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span>Ouverture :</span>
                <span>{new Date(selectedShiftDetail.openedAt).toLocaleString('fr-FR')}</span>
              </div>
              <div className="flex justify-between">
                <span>Clôture :</span>
                <span>
                  {selectedShiftDetail.closedAt
                    ? new Date(selectedShiftDetail.closedAt).toLocaleString('fr-FR')
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Fond initial :</span>
                <span>{formatFCFA(selectedShiftDetail.initialCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Espèces ventes :</span>
                <span>{formatFCFA(selectedShiftDetail.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Wave :</span>
                <span>{formatFCFA(selectedShiftDetail.waveSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Orange Money :</span>
                <span>{formatFCFA(selectedShiftDetail.orangeMoneySales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Carte / Virement :</span>
                <span>
                  {formatFCFA(
                    (selectedShiftDetail.carteSales || 0) + (selectedShiftDetail.virementSales || 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Crédit client :</span>
                <span>{formatFCFA(selectedShiftDetail.creditSales || 0)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                <span>Attendu tiroir :</span>
                <span>{formatFCFA(selectedShiftDetail.expectedCash)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Compté réel :</span>
                <span>{formatFCFA(selectedShiftDetail.actualCash ?? 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#F58220]">
                <span>Écart :</span>
                <span>{formatFCFA(selectedShiftDetail.cashDifference || 0)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedShiftDetail(null)}
              className="w-full py-2 text-xs font-semibold text-white bg-[#123B67] rounded-xl flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Fermer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
