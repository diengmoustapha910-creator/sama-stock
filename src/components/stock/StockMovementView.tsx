import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MovementType, ProductBatch } from '../../types';
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  X,
  AlertTriangle,
  AlertCircle,
  Calendar,
} from 'lucide-react';

export const StockMovementView: React.FC = () => {
  const {
    products,
    stockMovements,
    stores,
    activeStoreId,
    currentStore,
    currentUser,
    activeOperator,
    addStockMovement,
    transferStock,
    updateProduct,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // Manual stock entry / exit form
  const [entryProductId, setEntryProductId] = useState('');
  const [entryType, setEntryType] = useState<
    'reception' | 'sortie_manuelle' | 'perte_degat' | 'inventaire'
  >('reception');
  const [entryQuantity, setEntryQuantity] = useState<number>(1);
  const [entryReason, setEntryReason] = useState('');
  const [entryRef, setEntryRef] = useState('');
  const [entryLotNumber, setEntryLotNumber] = useState('');
  const [entryExpiryDate, setEntryExpiryDate] = useState('');
  const [entryError, setEntryError] = useState('');

  // Transfer form
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromStoreId, setTransferFromStoreId] = useState(activeStoreId);
  const [transferToStoreId, setTransferToStoreId] = useState(
    stores.find((s) => s.id !== activeStoreId)?.id || ''
  );
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferReason, setTransferReason] = useState('Rééquilibrage de stock');
  const [transferError, setTransferError] = useState('');

  const movementLabels: Record<MovementType, { label: string; color: string }> = {
    initial: { label: 'Stock Initial', color: 'text-blue-700 bg-blue-50' },
    reception: { label: 'Réception Achat', color: 'text-emerald-700 bg-emerald-50' },
    sortie_manuelle: { label: 'Sortie Manuelle', color: 'text-amber-700 bg-amber-50' },
    vente: { label: 'Vente Caisse', color: 'text-purple-700 bg-purple-50' },
    retour_client: { label: 'Retour Client', color: 'text-cyan-700 bg-cyan-50' },
    retour_fournisseur: { label: 'Retour Fournisseur', color: 'text-rose-700 bg-rose-50' },
    transfert_entrant: { label: 'Transfert Entrant', color: 'text-teal-700 bg-teal-50' },
    transfert_sortant: { label: 'Transfert Sortant', color: 'text-orange-700 bg-orange-50' },
    inventaire: { label: 'Ajustement Inventaire', color: 'text-indigo-700 bg-indigo-50' },
    perte_degat: { label: 'Perte / Dégât', color: 'text-red-700 bg-red-50' },
  };

  // Expiry & batch alerts (<30 days or already expired)
  const expiryAlerts = useMemo(() => {
    const alerts: {
      id: string;
      productName: string;
      lotNumber?: string;
      expiryDate: string;
      daysLeft: number;
      qty: number;
    }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    products.forEach((p) => {
      if (!p.active) return;
      if (Array.isArray(p.batches) && p.batches.length > 0) {
        p.batches.forEach((b) => {
          if (b.quantity <= 0 || !b.expiryDate) return;
          const dt = new Date(b.expiryDate);
          if (isNaN(dt.getTime())) return;
          const daysLeft = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
          if (daysLeft <= 30) {
            alerts.push({
              id: `${p.id}-${b.id}`,
              productName: p.name,
              lotNumber: b.lotNumber,
              expiryDate: b.expiryDate,
              daysLeft,
              qty: b.quantity,
            });
          }
        });
      } else if (p.expiryDate) {
        const dt = new Date(p.expiryDate);
        if (!isNaN(dt.getTime())) {
          const daysLeft = Math.ceil((dt.getTime() - today.getTime()) / 86400000);
          if (daysLeft <= 30) {
            alerts.push({
              id: p.id,
              productName: p.name,
              expiryDate: p.expiryDate,
              daysLeft,
              qty: p.quantity,
            });
          }
        }
      }
    });

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  const filteredMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      const matchSearch =
        m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.lotNumber && m.lotNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.referenceId && m.referenceId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchType = selectedType === 'all' || m.type === selectedType;
      return matchSearch && matchType;
    });
  }, [stockMovements, searchTerm, selectedType]);

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEntryError('');
    const prod = products.find((p) => p.id === entryProductId);
    if (!prod) {
      setEntryError('Sélectionnez un article valide.');
      return;
    }

    const currentQty = prod.storeQuantities?.[activeStoreId] ?? 0;
    const finalQty =
      entryType === 'inventaire'
        ? entryQuantity - currentQty
        : entryType === 'reception'
        ? Math.abs(entryQuantity)
        : -Math.abs(entryQuantity);

    if (entryType !== 'inventaire' && finalQty < 0 && currentQty < Math.abs(finalQty)) {
      setEntryError(
        `Impossible de déduire ${Math.abs(finalQty)} ${prod.unit} : stock actuel insuffisant (${currentQty}).`
      );
      return;
    }

    if (entryType === 'inventaire' && entryQuantity < 0) {
      setEntryError('La quantité inventoriée ne peut pas être négative.');
      return;
    }

    addStockMovement({
      productId: prod.id,
      productName: prod.name,
      storeId: activeStoreId,
      storeName: currentStore?.name || 'Boutique',
      type: entryType,
      quantity: finalQty,
      previousQuantity: currentQty,
      newQuantity: Math.max(0, currentQty + finalQty),
      reason:
        entryReason ||
        (entryType === 'reception'
          ? 'Réception marchandise'
          : entryType === 'inventaire'
          ? 'Ajustement inventaire rapide'
          : 'Sortie manuelle'),
      referenceId: entryRef || undefined,
      lotNumber: entryLotNumber.trim() || undefined,
      userId: activeOperator?.id || currentUser.id,
      userName: activeOperator?.name || currentUser.name,
    });

    // Attach lot & expiry batch if provided during reception
    if (entryType === 'reception' && (entryLotNumber.trim() || entryExpiryDate)) {
      const existingBatches = Array.isArray(prod.batches) ? [...prod.batches] : [];
      const newBatch: ProductBatch = {
        id: `lot-${Date.now()}`,
        lotNumber: entryLotNumber.trim() || `LOT-${Date.now().toString().slice(-5)}`,
        expiryDate: entryExpiryDate || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
        storeId: activeStoreId,
        quantity: Math.abs(entryQuantity),
        receivedAt: new Date().toISOString(),
      };
      updateProduct(prod.id, {
        batches: [...existingBatches, newBatch],
        ...(entryExpiryDate && (!prod.expiryDate || entryExpiryDate < prod.expiryDate)
          ? { expiryDate: entryExpiryDate }
          : {}),
      });
    }

    setIsEntryModalOpen(false);
    setEntryQuantity(1);
    setEntryReason('');
    setEntryRef('');
    setEntryLotNumber('');
    setEntryExpiryDate('');
    setFeedbackMsg(`Mouvement enregistré pour ${prod.name}.`);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    if (!transferProductId) {
      setTransferError('Veuillez sélectionner un article.');
      return;
    }
    if (transferFromStoreId === transferToStoreId) {
      setTransferError('La boutique de départ et la boutique d’arrivée doivent être différentes.');
      return;
    }

    const success = transferStock(
      transferProductId,
      transferFromStoreId,
      transferToStoreId,
      transferQuantity,
      transferReason
    );

    if (success) {
      setIsTransferModalOpen(false);
      setTransferQuantity(1);
      setFeedbackMsg('Transfert inter-boutiques exécuté avec succès.');
      setTimeout(() => setFeedbackMsg(''), 3500);
    } else {
      setTransferError('Échec du transfert : stock source insuffisant dans la boutique sélectionnée.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Gestion des Stocks & Mouvements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Traçabilité intégrale des entrées, lots FEFO, ajustements et transferts multi-boutiques
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setTransferProductId(products[0]?.id || '');
              setTransferFromStoreId(activeStoreId);
              setTransferToStoreId(stores.find((s) => s.id !== activeStoreId)?.id || '');
              setTransferError('');
              setIsTransferModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#123B67] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#123B67]" />
            <span>Transfert Inter-Boutiques</span>
          </button>

          <button
            onClick={() => {
              setEntryProductId(products[0]?.id || '');
              setEntryError('');
              setIsEntryModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Entrée / Ajustement Stock</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Expiry Alerts Banner */}
      {expiryAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>
              Alertes Dates d’Expiration ({expiryAlerts.length} lot(s) expiré(s) ou &lt; 30 jours)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {expiryAlerts.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="p-2.5 bg-white border border-amber-200 rounded-xl flex items-center justify-between text-[11px]"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-slate-900 truncate">{a.productName}</div>
                  <div className="text-slate-500 font-mono">
                    {a.lotNumber ? `Lot ${a.lotNumber} · ` : ''}
                    Exp : {a.expiryDate} ({a.qty} u.)
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                    a.daysLeft <= 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {a.daysLeft <= 0 ? 'Expiré' : `${a.daysLeft}j`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par article, N° lot, motif ou référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#123B67]"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-[#123B67]"
        >
          <option value="all">Tous les types de mouvements</option>
          <option value="reception">Réceptions d'achats</option>
          <option value="vente">Ventes caisse</option>
          <option value="transfert_entrant">Transferts entrants</option>
          <option value="transfert_sortant">Transferts sortants</option>
          <option value="inventaire">Ajustements d'inventaire</option>
          <option value="sortie_manuelle">Sorties manuelles</option>
          <option value="perte_degat">Pertes ou dégâts</option>
        </select>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-4">Article</th>
                <th className="py-3 px-4">Type de mouvement</th>
                <th className="py-3 px-4">Boutique</th>
                <th className="py-3 px-4 text-right">Quantité</th>
                <th className="py-3 px-4 text-right">Stock Avant</th>
                <th className="py-3 px-4 text-right">Stock Après</th>
                <th className="py-3 px-4">Motif & Lot</th>
                <th className="py-3 px-4">Opérateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun mouvement de stock enregistré.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => {
                  const info = movementLabels[mov.type] || {
                    label: mov.type,
                    color: 'text-slate-700 bg-slate-100',
                  };
                  const isPositive = mov.quantity > 0;

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(mov.date).toLocaleDateString('fr-FR')}{' '}
                        {new Date(mov.date).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div>{mov.productName}</div>
                        {mov.variantName && (
                          <div className="text-[10px] text-indigo-600">{mov.variantName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${info.color}`}
                        >
                          {info.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{mov.storeName}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        <span className={isPositive ? 'text-emerald-700' : 'text-rose-700'}>
                          {isPositive ? `+${mov.quantity}` : mov.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {mov.previousQuantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {mov.newQuantity}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{mov.reason}</div>
                        {(mov.referenceId || mov.lotNumber) && (
                          <div className="text-[10px] font-mono text-slate-400">
                            {mov.lotNumber ? `Lot : ${mov.lotNumber}` : ''}
                            {mov.lotNumber && mov.referenceId ? ' · ' : ''}
                            {mov.referenceId ? `Réf : ${mov.referenceId}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{mov.userName}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Entrée, Sortie ou Ajustement de Stock
              </h3>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="space-y-3 text-xs">
              {entryError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{entryError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Type d'opération *
                </label>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  <option value="reception">Entrée de Stock (Réception Marchandise)</option>
                  <option value="inventaire">Ajustement Inventaire (Nouvelle Qté réelle)</option>
                  <option value="sortie_manuelle">Sortie Manuelle Autorisée</option>
                  <option value="perte_degat">Sortie pour Dégât ou Casse</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Article concerné *
                </label>
                <select
                  value={entryProductId}
                  onChange={(e) => setEntryProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock actuel : {p.storeQuantities?.[activeStoreId] ?? 0} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {entryType === 'inventaire'
                    ? 'Nouveau stock réel compté *'
                    : 'Quantité à imputer *'}
                </label>
                <input
                  type="number"
                  required
                  min={entryType === 'inventaire' ? 0 : 1}
                  value={entryQuantity}
                  onChange={(e) => setEntryQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-hidden"
                />
              </div>

              {entryType === 'reception' && (
                <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      N° Lot (optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: LOT-2026-A"
                      value={entryLotNumber}
                      onChange={(e) => setEntryLotNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      <span>Expiration</span>
                    </label>
                    <input
                      type="date"
                      value={entryExpiryDate}
                      onChange={(e) => setEntryExpiryDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motif / Justificatif *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Arrivage camion ou casse lors du rayonnage"
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Référence du document
                </label>
                <input
                  type="text"
                  placeholder="Ex: BL-FOURN-9921"
                  value={entryRef}
                  onChange={(e) => setEntryRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Valider le Mouvement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Transfert Inter-Boutiques</h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              {transferError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Article à transférer *
                </label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Total dispo : {p.quantity} {p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Boutique de départ *
                  </label>
                  <select
                    value={transferFromStoreId}
                    onChange={(e) => setTransferFromStoreId(e.target.value)}
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
                    Boutique destinataire *
                  </label>
                  <select
                    value={transferToStoreId}
                    onChange={(e) => setTransferToStoreId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Quantité à transférer *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motif du transfert
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-lg shadow-sm"
                >
                  Exécuter le Transfert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
