import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Expense, ExpenseCategory, PaymentMethod } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  Receipt,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  X,
  PieChart,
  Calendar,
} from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const { expenses, addExpense, deleteExpense, kpis, currentStore } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('loyer');
  const [amount, setAmount] = useState<number>(50000);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [receiptNumber, setReceiptNumber] = useState('');

  const categoryLabels: Record<ExpenseCategory, string> = {
    loyer: 'Loyer Magasin / Dépôt',
    electricite_senelec: 'Électricité Senelec / Woyofal',
    transport_livraison: 'Transport, Carburant & Livraisons',
    salaires: 'Salaires & Rémunérations Employés',
    emballages: 'Sachets, Cartons & Emballages',
    maintenance: 'Maintenance & Réparations',
    taxes_impots: 'Taxes Communales & Impôts',
    communication: 'Forfaits Internet & Téléphonie',
    autre: 'Autres Dépenses Diverses',
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !description.trim()) return;

    addExpense({
      date,
      category,
      amount: Number(amount),
      description,
      paymentMethod,
      storeId: currentStore?.id || '',
      receiptNumber: receiptNumber || undefined,
    });

    setIsAddModalOpen(false);
    setDescription('');
    setReceiptNumber('');
    setAmount(20000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Dépenses d'Exploitation & Rentabilité Nette
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivi des charges d'exploitation, calcul de la marge brute et résultat net estimé
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Enregistrer une Dépense</span>
        </button>
      </div>

      {/* Financial Profitability Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium">Chiffre d'Affaires Mensuel</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">
            {formatFCFA(kpis.monthSalesTotal)}
          </div>
          <div className="text-[11px] text-slate-400">Total ventes encaissées & émises</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium">Coût Marchandises Vendues</div>
          <div className="text-2xl font-extrabold text-slate-700 font-mono">
            -{formatFCFA(kpis.costOfGoodsSold)}
          </div>
          <div className="text-[11px] text-slate-400">Valeur d'achat des articles vendus</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium">Charges d'Exploitation</div>
          <div className="text-2xl font-extrabold text-rose-600 font-mono">
            -{formatFCFA(kpis.monthExpensesTotal)}
          </div>
          <div className="text-[11px] text-slate-400">Loyer, Senelec, transport, etc.</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1 bg-gradient-to-br from-emerald-50/50 to-white">
          <div className="text-xs text-emerald-800 font-medium">Résultat Net Estimé</div>
          <div
            className={`text-2xl font-extrabold font-mono ${
              kpis.estimatedNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatFCFA(kpis.estimatedNetProfit)}
          </div>
          <div className="text-[11px] text-emerald-600">Marge brute - Total des dépenses</div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Registre des Dépenses Récentes</h3>
          <span className="text-xs text-slate-500 font-mono">
            Total : {formatFCFA(expenses.reduce((a, b) => a + b.amount, 0))}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Description / Motif</th>
                <th className="py-3 px-4">Boutique</th>
                <th className="py-3 px-4">Mode Règlement</th>
                <th className="py-3 px-4 text-right">Montant</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucune dépense enregistrée.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-500">{exp.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {categoryLabels[exp.category] || exp.category}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{exp.description}</div>
                      {exp.receiptNumber && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          Reçu : {exp.receiptNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{exp.storeName}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">{exp.paymentMethod}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                      -{formatFCFA(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm('Supprimer cette ligne de dépense ?')) {
                            deleteExpense(exp.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Enregistrer une Dépense d'Exploitation
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Catégorie de charge *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  <option value="loyer">Loyer Magasin / Dépôt</option>
                  <option value="electricite_senelec">Électricité Senelec / Woyofal</option>
                  <option value="transport_livraison">Transport, Carburant & Livraisons</option>
                  <option value="salaires">Salaires & Rémunérations</option>
                  <option value="emballages">Sachets & Emballages</option>
                  <option value="maintenance">Maintenance & Réparations</option>
                  <option value="taxes_impots">Taxes Communales & Impôts</option>
                  <option value="communication">Internet & Forfaits</option>
                  <option value="autre">Autres charges diverses</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Montant de la dépense (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description / Motif *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Facture Senelec compteur Médina"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Mode de règlement</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                  >
                    <option value="wave">Wave</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="especes">Espèces</option>
                    <option value="virement">Virement bancaire</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Numéro de reçu ou référence
                </label>
                <input
                  type="text"
                  placeholder="Optionnel"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
