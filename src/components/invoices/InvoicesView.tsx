import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceItem, InvoiceType, PaymentMethod } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Download,
  Share2,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Printer,
  Trash2,
  X,
  CreditCard,
} from 'lucide-react';
import { InvoicePDFPreviewModal } from '../common/InvoicePDFPreviewModal';

export const InvoicesView: React.FC = () => {
  const {
    invoices,
    createInvoice,
    recordInvoicePayment,
    convertQuoteToInvoice,
    customers,
    products,
    organization,
    currentStore,
    activeStoreId,
    quotaSummary,
    canCreateInvoice,
    openUpgradeModal,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);

  // New Invoice Form state
  const [docType, setDocType] = useState<InvoiceType>('facture_vente');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [taxRate, setTaxRate] = useState<number>(organization.vatEnabled ? 18 : 0);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [paymentTerms, setPaymentTerms] = useState(
    'Règlement sous 15 jours par Wave, Orange Money ou virement bancaire.'
  );
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: 'it-1',
      reference: 'ART-01',
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: organization.vatEnabled ? 18 : 0,
      discount: 0,
      total: 0,
    },
  ]);

  // Payment Recording State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const typeLabels: Record<string, string> = {
    facture_vente: 'Facture de Vente',
    proforma: 'Facture Pro Forma',
    devis: 'Devis Commercial',
    bon_commande: 'Bon de Commande',
    bon_livraison: 'Bon de Livraison',
    recu: 'Reçu de Paiement',
    avoir: 'Facture d\'Avoir',
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = selectedType === 'all' || inv.type === selectedType;
      const matchStatus = selectedStatus === 'all' || inv.status === selectedStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [invoices, searchTerm, selectedType, selectedStatus]);

  // Totals calculations for new document
  const formSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  );
  const formTaxAmount = useMemo(() => {
    const taxable = Math.max(0, formSubtotal - discountTotal);
    return Math.round((taxable * taxRate) / 100);
  }, [formSubtotal, discountTotal, taxRate]);
  const formTotalAmount = useMemo(
    () => Math.max(0, formSubtotal - discountTotal + formTaxAmount),
    [formSubtotal, discountTotal, formTaxAmount]
  );

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `it-${Date.now()}`,
        reference: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate,
        discount: 0,
        total: 0,
      },
    ]);
  };

  const handleItemProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        reference: prod.sku,
        description: prod.name,
        unitPrice: prod.sellPrice,
        total: updated[index].quantity * prod.sellPrice,
      };
      return updated;
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };
      cur.total = cur.quantity * cur.unitPrice - (cur.discount || 0);
      updated[index] = cur;
      return updated;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenCreateModal = () => {
    const check = canCreateInvoice();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }
    setDocType('facture_vente');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
    setDiscountTotal(0);
    setTaxRate(organization.vatEnabled ? 18 : 0);
    setItems([
      {
        id: 'it-1',
        reference: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: organization.vatEnabled ? 18 : 0,
        discount: 0,
        total: 0,
      },
    ]);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || items.length === 0 || !items[0].description) {
      alert('Veuillez renseigner le nom du client et au moins une ligne d article.');
      return;
    }

    try {
      const newInv = createInvoice({
        type: docType,
        storeId: activeStoreId,
        storeName: currentStore?.name || 'Boutique Principale',
        date,
        dueDate,
        customerId,
        customerName,
        customerPhone,
        customerAddress,
        items,
        subtotal: formSubtotal,
        discountTotal,
        taxRate,
        taxAmount: formTaxAmount,
        totalAmount: formTotalAmount,
        paidAmount: 0,
        balanceDue: formTotalAmount,
        status: 'emise',
        paymentTerms,
        notes,
      });

      setIsCreateModalOpen(false);
      setPreviewInvoice(newInv);
    } catch {
      setIsCreateModalOpen(false);
    }
  };

  // Convert Quote (Devis) to Real Invoice
  const handleConvertQuote = (quote: Invoice) => {
    const check = canCreateInvoice();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }
    if (window.confirm(`Convertir le devis ${quote.invoiceNumber} en Facture de vente définitive ?`)) {
      try {
        const converted = convertQuoteToInvoice(quote.id);
        if (converted) {
          setPreviewInvoice(converted);
        }
      } catch {
        // upgrade modal already opened by createInvoice
      }
    }
  };

  // Payment record submit
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice || paymentAmount <= 0) return;

    recordInvoicePayment(
      paymentModalInvoice.id,
      paymentAmount,
      paymentMethod,
      paymentRef,
      paymentNotes
    );
    setPaymentModalInvoice(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Facturation & Documents Commerciaux
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Factures A4, Devis, Pro Forma, Bons de livraison et suivi des règlements
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un Document</span>
        </button>
      </div>

      {/* Monthly Invoice Quota Banner */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          quotaSummary.invoices.reached
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#123B67] text-white text-[10px] font-bold uppercase">
              Formule {quotaSummary.planName}
            </span>
            {quotaSummary.invoices.limit === -1 ? (
              <span className="font-semibold">
                Factures ce mois ({quotaSummary.monthKey}) : <strong>{quotaSummary.invoices.used}</strong> · Illimité
              </span>
            ) : (
              <span className="font-semibold">
                Quota mensuel ({quotaSummary.monthKey}) : <strong>{quotaSummary.invoices.used}</strong> /{' '}
                <strong>{quotaSummary.invoices.limit}</strong> utilisée(s) ·{' '}
                <strong className={quotaSummary.invoices.reached ? 'text-rose-700' : 'text-emerald-700'}>
                  {quotaSummary.invoices.remaining} restante(s)
                </strong>
                <span className="text-[11px] text-slate-500 font-normal ml-1.5">
                  (Réinitialisation automatique le 1er du mois suivant)
                </span>
              </span>
            )}
          </div>
          {quotaSummary.invoices.limit !== -1 && (
            <div className="w-full max-w-md h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quotaSummary.invoices.reached
                    ? 'bg-rose-500'
                    : quotaSummary.invoices.used / quotaSummary.invoices.limit >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((quotaSummary.invoices.used / Math.max(1, quotaSummary.invoices.limit)) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
        {quotaSummary.invoices.reached && (
          <button
            type="button"
            onClick={() => openUpgradeModal(canCreateInvoice().reason)}
            className="px-3.5 py-2 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer"
          >
            Quota mensuel atteint · Passer à une formule supérieure
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par numéro (FAC-2026-...) ou nom du client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#123B67]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-[#123B67]"
          >
            <option value="all">Tous les types de document</option>
            <option value="facture_vente">Factures de Vente</option>
            <option value="devis">Devis</option>
            <option value="proforma">Factures Pro Forma</option>
            <option value="bon_livraison">Bons de Livraison</option>
            <option value="avoir">Avoirs</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-[#123B67]"
          >
            <option value="all">Tous les statuts</option>
            <option value="payee">Payées</option>
            <option value="partiellement_payee">Partiellement payées</option>
            <option value="emise">En attente (Émises)</option>
            <option value="en_retard">En retard</option>
          </select>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Numéro</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Montant TTC</th>
                <th className="py-3 px-4 text-right">Déjà Réglé</th>
                <th className="py-3 px-4 text-right">Solde Restant</th>
                <th className="py-3 px-4 text-center">Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Aucun document trouvé. Cliquez sur "Créer un Document" pour débuter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#123B67]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{typeLabels[inv.type] || inv.type}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{inv.date}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatFCFA(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatFCFA(inv.paidAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      <span className={inv.balanceDue > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatFCFA(inv.balanceDue)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${
                          inv.status === 'payee'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : inv.status === 'partiellement_payee'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : inv.status === 'en_retard'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {inv.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {inv.type === 'devis' && (
                        <button
                          onClick={() => handleConvertQuote(inv)}
                          title="Convertir en Facture"
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#123B67] rounded-md font-semibold text-[10px] inline-flex items-center gap-1"
                        >
                          <span>Convertir</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      )}

                      {inv.balanceDue > 0 && inv.type === 'facture_vente' && (
                        <button
                          onClick={() => {
                            setPaymentModalInvoice(inv);
                            setPaymentAmount(inv.balanceDue);
                          }}
                          title="Encaisser un paiement"
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-semibold text-[10px]"
                        >
                          Encaisser
                        </button>
                      )}

                      <button
                        onClick={() => setPreviewInvoice(inv)}
                        title="Aperçu & PDF"
                        className="p-1 text-slate-500 hover:text-[#123B67] hover:bg-slate-100 rounded-md"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Document Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Édition d'un Nouveau Document Commercial
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Type, Customer & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Type de document *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as InvoiceType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  >
                    <option value="facture_vente">Facture de Vente</option>
                    <option value="proforma">Facture Pro Forma</option>
                    <option value="devis">Devis Commercial</option>
                    <option value="bon_commande">Bon de Commande</option>
                    <option value="bon_livraison">Bon de Livraison</option>
                    <option value="recu">Reçu de Règlement</option>
                    <option value="avoir">Facture d'Avoir</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Date d'émission *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Date d'échéance
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
              </div>

              {/* Client Selection & Information */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                  Informations Client Destinataire
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-slate-600 block mb-1">
                      Sélectionner un client existant :
                    </label>
                    <select
                      value={customerId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setCustomerId(id);
                        const c = customers.find((cust) => cust.id === id);
                        if (c) {
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone || '');
                          setCustomerAddress(c.address || '');
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    >
                      <option value="">Nouveau client / Saisie libre...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-slate-600 block mb-1">
                      Nom / Raison Sociale du Client *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Entreprise Dieng & Frères"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-600 block mb-1">Téléphone</label>
                    <input
                      type="text"
                      placeholder="+221 ..."
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="font-medium text-slate-600 block mb-1">Adresse à Dakar / Régions</label>
                    <input
                      type="text"
                      placeholder="Ex: Médina Rue 11"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                    Lignes d'articles / prestations
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-[#123B67] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <th className="p-2 w-48">Choisir Produit</th>
                        <th className="p-2">Désignation</th>
                        <th className="p-2 w-20 text-right">Qté</th>
                        <th className="p-2 w-28 text-right">P.U (FCFA)</th>
                        <th className="p-2 w-28 text-right">Total HT</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id} className="bg-white">
                          <td className="p-2">
                            <select
                              value={item.productId || ''}
                              onChange={(e) => handleItemProductSelect(idx, e.target.value)}
                              className="w-full p-1 border border-slate-200 rounded text-xs"
                            >
                              <option value="">-- Produit du stock --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({formatFCFA(p.sellPrice)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="Description de l'article"
                              value={item.description}
                              onChange={(e) => updateItem(idx, 'description', e.target.value)}
                              className="w-full p-1 border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                              className="w-16 p-1 border border-slate-200 rounded text-xs text-right font-mono"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.unitPrice}
                              onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                              className="w-24 p-1 border border-slate-200 rounded text-xs text-right font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(item.total)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Taxes Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex-1 space-y-2">
                  <label className="font-semibold text-slate-700 block">
                    Conditions & Mentions :
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Note interne ou observation particulière..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="w-full sm:w-72 space-y-1.5 text-right font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Sous-total HT :</span>
                    <span>{formatFCFA(formSubtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Remise globale :</span>
                    <input
                      type="number"
                      min={0}
                      value={discountTotal || ''}
                      placeholder="0"
                      onChange={(e) => setDiscountTotal(Number(e.target.value))}
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-right text-xs"
                    />
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>TVA Sénégal :</span>
                    <select
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="px-2 py-0.5 border border-slate-300 rounded text-xs"
                    >
                      <option value={0}>0% (Exonéré)</option>
                      <option value={18}>18% (Taux normal)</option>
                    </select>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Montant TVA :</span>
                      <span>+{formatFCFA(formTaxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-[#123B67] pt-2 border-t border-slate-300">
                    <span>NET À PAYER :</span>
                    <span className="text-[#F58220]">{formatFCFA(formTotalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Générer le Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice PDF Preview Modal */}
      {previewInvoice && (
        <InvoicePDFPreviewModal
          invoice={previewInvoice}
          org={organization}
          store={currentStore}
          onClose={() => setPreviewInvoice(null)}
          onRecordPayment={(inv) => {
            setPreviewInvoice(null);
            setPaymentModalInvoice(inv);
            setPaymentAmount(inv.balanceDue);
          }}
        />
      )}

      {/* Payment Recording Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Encaisser un Paiement ({paymentModalInvoice.invoiceNumber})
              </h3>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Client :</span>
                  <span className="font-semibold text-slate-900">{paymentModalInvoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total facture :</span>
                  <span className="font-mono">{formatFCFA(paymentModalInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Déjà réglé :</span>
                  <span className="font-mono text-emerald-700">{formatFCFA(paymentModalInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700 pt-1 border-t border-slate-200">
                  <span>Solde restant dû :</span>
                  <span className="font-mono">{formatFCFA(paymentModalInvoice.balanceDue)}</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Montant à encaisser (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={paymentModalInvoice.balanceDue}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mode de règlement *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                >
                  <option value="wave">Wave Mobile Money</option>
                  <option value="orange_money">Orange Money Sénégal</option>
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement Bancaire</option>
                  <option value="carte">Carte Bancaire GIM-UEMOA</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Référence de la transaction
                </label>
                <input
                  type="text"
                  placeholder="Ex: WAVE-TX-448102"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalInvoice(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Valider l'Encaissement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
