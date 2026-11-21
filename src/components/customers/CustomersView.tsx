import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, PaymentMethod } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  Plus,
  Search,
  Phone,
  Share2,
  FileText,
  X,
  Star,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    recordCustomerCreditPayment,
    adjustCustomerPoints,
    sales,
    invoices,
    organization,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [paymentModalCustomer, setPaymentModalCustomer] = useState<Customer | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(300000);
  const [notes, setNotes] = useState('');

  // Payment state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');

  // Loyalty manual adjustment state
  const [pointsDelta, setPointsDelta] = useState<number>(0);
  const [pointsNote, setPointsNote] = useState<string>('');

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [customers, searchTerm]);

  const activeStatementCustomer = useMemo(() => {
    if (!statementCustomer) return null;
    return customers.find((c) => c.id === statementCustomer.id) || statementCustomer;
  }, [customers, statementCustomer]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('+221 ');
    setEmail('');
    setAddress('');
    setCreditLimit(300000);
    setNotes('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone || '');
    setEmail(c.email || '');
    setAddress(c.address || '');
    setCreditLimit(c.creditLimit);
    setNotes(c.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, {
        name,
        phone,
        email,
        address,
        creditLimit: Number(creditLimit),
        notes,
      });
    } else {
      addCustomer({
        name,
        phone,
        email,
        address,
        creditLimit: Number(creditLimit),
        notes,
      });
    }

    setIsAddModalOpen(false);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalCustomer || paymentAmount <= 0) return;

    recordCustomerCreditPayment(paymentModalCustomer.id, paymentAmount, paymentMethod);
    setPaymentModalCustomer(null);
  };

  const buildWhatsAppUrl = (c: Customer): string => {
    let msg = `Bonjour ${c.name},\n\n`;
    msg += `Ceci est un rappel amical de la part de *${organization.name}* concernant votre compte client.\n\n`;
    msg += `📊 *Solde restant dû : ${formatFCFA(c.outstandingBalance)}*\n\n`;
    msg += `Vous pouvez régulariser votre solde en boutique ou par Mobile Money :\n`;
    if (organization.waveNumber) msg += `🌊 Wave : ${organization.waveNumber}\n`;
    if (organization.orangeMoneyNumber) msg += `🍊 Orange Money : ${organization.orangeMoneyNumber}\n\n`;
    msg += `Merci pour votre confiance !\n*${organization.name}* - ${organization.phone}`;

    const cleanPhone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
    return cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const customerSales = useMemo(() => {
    if (!activeStatementCustomer) return [];
    return sales.filter((s) => s.customerId === activeStatementCustomer.id);
  }, [activeStatementCustomer, sales]);

  const customerInvoices = useMemo(() => {
    if (!activeStatementCustomer) return [];
    return invoices.filter((i) => i.customerId === activeStatementCustomer.id);
  }, [activeStatementCustomer, invoices]);

  const pointValue = organization.loyaltySettings?.pointValueFCFA ?? 25;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Fichier Clients, Crédits & Fidélité
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comptes clients, créances, points de fidélité, relances WhatsApp et règlements
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone ou adresse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#123B67]"
          />
        </div>
      </div>

      {/* Customers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">
            Aucun client trouvé.
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const hasDebt = cust.outstandingBalance > 0;
            const pts = cust.loyaltyPoints || 0;

            return (
              <div
                key={cust.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-[#F58220] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md font-mono flex items-center gap-1">
                        <Star className="w-3 h-3 fill-[#F58220]" />
                        {pts} pts
                      </span>
                      {hasDebt ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-mono">
                          Dû : {formatFCFA(cust.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          À jour
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500">
                    {cust.phone && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                    {cust.address && <div className="text-[11px] text-slate-400">{cust.address}</div>}
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Total Achats</div>
                      <div className="font-bold text-slate-900 font-mono">
                        {formatFCFA(cust.totalPurchases)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Plafond Crédit</div>
                      <div className="font-mono text-slate-600">{formatFCFA(cust.creditLimit)}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setPointsDelta(0);
                      setPointsNote('');
                      setStatementCustomer(cust);
                    }}
                    className="text-xs font-semibold text-[#123B67] hover:underline flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Relevé & Fidélité</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {hasDebt && (
                      <>
                        <a
                          href={buildWhatsAppUrl(cust)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Envoyer relance WhatsApp"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </a>

                        <button
                          onClick={() => {
                            setPaymentModalCustomer(cust);
                            setPaymentAmount(cust.outstandingBalance);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                        >
                          Encaisser
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(cust)}
                      className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingCustomer ? 'Modifier Fiche Client' : 'Créer une Fiche Client'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nom / Raison Sociale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Moussa Diop (Épicerie Liberté 6)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Téléphone</label>
                <input
                  type="text"
                  placeholder="+221 77 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="contact@client.sn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Adresse à Dakar / Région
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rond-point Liberté 6"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Plafond de crédit autorisé (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes internes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
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
                  {editingCustomer ? 'Enregistrer Modifications' : 'Créer le Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Payment Modal */}
      {paymentModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Encaisser un Remboursement de Crédit
              </h3>
              <button
                onClick={() => setPaymentModalCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Client :</span>
                  <span className="font-bold">{paymentModalCustomer.name}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700 pt-1">
                  <span>Dette restante :</span>
                  <span className="font-mono">
                    {formatFCFA(paymentModalCustomer.outstandingBalance)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Montant remboursé (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={paymentModalCustomer.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mode d'encaissement *
                </label>
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalCustomer(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Valider le Remboursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement & Loyalty Modal */}
      {activeStatementCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Relevé & Fidélité : {activeStatementCustomer.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Solde débiteur : {formatFCFA(activeStatementCustomer.outstandingBalance)}
                </p>
              </div>
              <button
                onClick={() => setStatementCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Loyalty Summary & Manual Adjustment */}
              <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-[#F58220] fill-[#F58220]" />
                    <div>
                      <div className="font-bold text-slate-900">
                        Solde Fidélité : {activeStatementCustomer.loyaltyPoints || 0} points
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Valeur remise en caisse :{' '}
                        <span className="font-mono font-bold text-[#123B67]">
                          {formatFCFA((activeStatementCustomer.loyaltyPoints || 0) * pointValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-orange-200/70">
                  <input
                    type="number"
                    placeholder="+/- pts"
                    value={pointsDelta || ''}
                    onChange={(e) => setPointsDelta(Number(e.target.value))}
                    className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Motif ajustement (ex: Bonus fidélité)"
                    value={pointsNote}
                    onChange={(e) => setPointsNote(e.target.value)}
                    className="flex-1 min-w-[160px] px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    disabled={!pointsDelta}
                    onClick={() => {
                      adjustCustomerPoints(
                        activeStatementCustomer.id,
                        pointsDelta,
                        pointsNote.trim() || 'Ajustement manuel'
                      );
                      setPointsDelta(0);
                      setPointsNote('');
                    }}
                    className="px-3 py-1.5 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] disabled:opacity-40 rounded-lg"
                  >
                    Ajuster Points
                  </button>
                </div>

                {activeStatementCustomer.loyaltyHistory &&
                  activeStatementCustomer.loyaltyHistory.length > 0 && (
                    <div className="bg-white border border-orange-200 rounded-xl divide-y divide-slate-100 max-h-36 overflow-y-auto">
                      {activeStatementCustomer.loyaltyHistory.map((tx) => (
                        <div key={tx.id} className="p-2 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-semibold text-slate-800">{tx.note}</span>
                            <span className="text-slate-400 ml-2 font-mono">
                              {new Date(tx.date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold ${
                              tx.points >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                  Factures Émises à ce Client :
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Numéro</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Total TTC</th>
                        <th className="p-2.5 text-right">Réglé</th>
                        <th className="p-2.5 text-right">Solde Dû</th>
                        <th className="p-2.5 text-center">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            Aucune facture enregistrée pour ce client.
                          </td>
                        </tr>
                      ) : (
                        customerInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="p-2.5 font-mono font-bold text-[#123B67]">
                              {inv.invoiceNumber}
                            </td>
                            <td className="p-2.5 text-slate-500 font-mono">{inv.date}</td>
                            <td className="p-2.5 text-right font-mono">{formatFCFA(inv.totalAmount)}</td>
                            <td className="p-2.5 text-right font-mono text-emerald-700">
                              {formatFCFA(inv.paidAmount)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-600">
                              {formatFCFA(inv.balanceDue)}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="text-[10px] uppercase font-semibold text-slate-600">
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                  Achats en Caisse Réalisés :
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Ticket</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Articles</th>
                        <th className="p-2.5 text-right">Montant</th>
                        <th className="p-2.5">Règlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerSales.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            Aucun ticket de caisse enregistré.
                          </td>
                        </tr>
                      ) : (
                        customerSales.map((s) => (
                          <tr key={s.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-900">{s.saleNumber}</td>
                            <td className="p-2.5 text-slate-500 font-mono">{s.date.split('T')[0]}</td>
                            <td className="p-2.5 text-slate-600">{s.items.length} articles</td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {formatFCFA(s.totalAmount)}
                            </td>
                            <td className="p-2.5 text-slate-600 capitalize">{s.paymentMethod}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
