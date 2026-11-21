import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Supplier, Purchase, PurchaseItem } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  X,
  ArrowRight,
  PackageCheck,
  Building,
} from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const {
    suppliers,
    addSupplier,
    updateSupplier,
    recordSupplierPayment,
    purchases,
    createPurchase,
    receivePurchase,
    products,
    stores,
    activeStoreId,
    currentStore,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveSubTab] = useState<'suppliers' | 'orders'>('orders');
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [paymentSupplierModal, setPaymentSupplierModal] = useState<Supplier | null>(null);
  const [supplierPaymentAmt, setSupplierPaymentAmt] = useState<number>(0);

  // Supplier form
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');

  // Purchase order form
  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [orderStoreId, setOrderStoreId] = useState(activeStoreId);
  const [orderItems, setOrderItems] = useState<PurchaseItem[]>([
    {
      id: 'p-1',
      productId: '',
      productName: '',
      sku: '',
      quantity: 10,
      receivedQuantity: 0,
      unitBuyPrice: 0,
      total: 0,
    },
  ]);
  const [orderNotes, setOrderNotes] = useState('');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm))
    );
  }, [suppliers, searchTerm]);

  const handleOpenAddSupplier = () => {
    setSupName('');
    setSupContact('');
    setSupPhone('+221 ');
    setSupEmail('');
    setSupAddress('');
    setIsAddSupplierModalOpen(true);
  };

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    addSupplier({
      name: supName,
      contactPerson: supContact,
      phone: supPhone,
      email: supEmail,
      address: supAddress,
    });
    setIsAddSupplierModalOpen(false);
  };

  const handleAddOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}`,
        productId: '',
        productName: '',
        sku: '',
        quantity: 1,
        receivedQuantity: 0,
        unitBuyPrice: 0,
        total: 0,
      },
    ]);
  };

  const updateOrderItemProduct = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    setOrderItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        unitBuyPrice: prod.buyPrice,
        total: updated[index].quantity * prod.buyPrice,
      };
      return updated;
    });
  };

  const updateOrderItemField = (index: number, field: keyof PurchaseItem, val: any) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: val };
      cur.total = cur.quantity * cur.unitBuyPrice;
      updated[index] = cur;
      return updated;
    });
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === orderSupplierId);
    const store = stores.find((s) => s.id === orderStoreId) || currentStore!;
    if (!sup || orderItems.length === 0 || !orderItems[0].productId) {
      alert('Veuillez sélectionner un fournisseur et au moins un article.');
      return;
    }

    const totalAmt = orderItems.reduce((sum, item) => sum + item.total, 0);

    createPurchase({
      supplierId: sup.id,
      supplierName: sup.name,
      storeId: store.id,
      storeName: store.name,
      orderDate: new Date().toISOString().split('T')[0],
      items: orderItems,
      totalAmount: totalAmt,
      paidAmount: 0,
      balanceDue: totalAmt,
      status: 'en_attente',
      notes: orderNotes,
    });

    setIsNewOrderModalOpen(false);
  };

  const handleReceiveOrder = (pur: Purchase) => {
    if (
      window.confirm(
        `Confirmer la réception effective de la commande #${pur.purchaseNumber} ? Le stock sera augmenté et la dette fournisseur enregistrée.`
      )
    ) {
      receivePurchase(pur.id);
    }
  };

  const handleSupplierPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplierModal || supplierPaymentAmt <= 0) return;

    recordSupplierPayment(paymentSupplierModal.id, supplierPaymentAmt);
    setPaymentSupplierModal(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Achats & Gestion des Fournisseurs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Commandes d'approvisionnement, réceptions réelles et dettes fournisseurs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddSupplier}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#123B67] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouveau Fournisseur</span>
          </button>

          <button
            onClick={() => {
              setOrderSupplierId(suppliers[0]?.id || '');
              setOrderStoreId(activeStoreId);
              setOrderItems([
                {
                  id: 'p-1',
                  productId: products[0]?.id || '',
                  productName: products[0]?.name || '',
                  sku: products[0]?.sku || '',
                  quantity: 10,
                  receivedQuantity: 0,
                  unitBuyPrice: products[0]?.buyPrice || 0,
                  total: (products[0]?.buyPrice || 0) * 10,
                },
              ]);
              setIsNewOrderModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Créer Bon de Commande</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher: Commandes vs Fournisseurs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'orders'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bons de Commande & Réceptions ({purchases.length})
        </button>
        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`pb-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'suppliers'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Annuaire des Fournisseurs ({suppliers.length})
        </button>
      </div>

      {/* Orders Tab View */}
      {activeTab === 'orders' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">N° Commande</th>
                  <th className="py-3 px-4">Fournisseur</th>
                  <th className="py-3 px-4">Boutique destination</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Articles</th>
                  <th className="py-3 px-4 text-right">Total Achat</th>
                  <th className="py-3 px-4 text-center">Statut Réception</th>
                  <th className="py-3 px-4 text-right">Action Réception</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Aucune commande d'achat enregistrée.
                    </td>
                  </tr>
                ) : (
                  purchases.map((pur) => (
                    <tr key={pur.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#123B67]">
                        {pur.purchaseNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{pur.supplierName}</td>
                      <td className="py-3 px-4 text-slate-600">{pur.storeName}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">{pur.orderDate}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {pur.items.reduce((a, b) => a + b.quantity, 0)} unités
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatFCFA(pur.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold text-[10px] px-2 py-0.5 rounded-md ${
                            pur.status === 'recue'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {pur.status === 'recue' ? 'RÉCEPTIONNÉE' : 'EN ATTENTE'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pur.status !== 'recue' ? (
                          <button
                            onClick={() => handleReceiveOrder(pur)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 ml-auto"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Réceptionner Stock</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Stock augmenté
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Suppliers Tab View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">{sup.name}</h3>
                  {sup.outstandingBalance > 0 && (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                      Dette : {formatFCFA(sup.outstandingBalance)}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-0.5">
                  <div>Contact : {sup.contactPerson}</div>
                  <div className="font-mono">Tél : {sup.phone}</div>
                  {sup.address && <div>Adresse : {sup.address}</div>}
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-slate-400">Total approvisionnements :</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatFCFA(sup.totalPurchases)}
                  </span>
                </div>
              </div>

              {sup.outstandingBalance > 0 && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      setPaymentSupplierModal(sup);
                      setSupplierPaymentAmt(sup.outstandingBalance);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-lg transition-colors"
                  >
                    Régler la Dette Fournisseur
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Nouveau Fournisseur</h3>
              <button
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nom commercial / Société *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Comptoir Commercial Sénégalais"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Personne à contacter
                </label>
                <input
                  type="text"
                  placeholder="Ex: Monsieur Babacar Sy"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Téléphone</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Adresse ou Ville</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
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

      {/* Create Purchase Order Modal */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Nouveau Bon de Commande d'Approvisionnement
              </h3>
              <button
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fournisseur *
                  </label>
                  <select
                    value={orderSupplierId}
                    onChange={(e) => setOrderSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Boutique de destination *
                  </label>
                  <select
                    value={orderStoreId}
                    onChange={(e) => setOrderStoreId(e.target.value)}
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

              {/* Order items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                    Articles à commander
                  </span>
                  <button
                    type="button"
                    onClick={handleAddOrderItem}
                    className="text-xs font-semibold text-[#123B67] hover:underline"
                  >
                    + Ajouter un article
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Article</th>
                        <th className="p-2 w-24 text-right">Qté</th>
                        <th className="p-2 w-28 text-right">Prix Achat (FCFA)</th>
                        <th className="p-2 w-28 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderItems.map((item, idx) => (
                        <tr key={item.id} className="bg-white">
                          <td className="p-2">
                            <select
                              value={item.productId}
                              onChange={(e) => updateOrderItemProduct(idx, e.target.value)}
                              className="w-full p-1 border border-slate-200 rounded text-xs"
                            >
                              <option value="">Sélectionner un produit...</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateOrderItemField(idx, 'quantity', Number(e.target.value))}
                              className="w-16 p-1 border border-slate-200 rounded text-right font-mono"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={item.unitBuyPrice}
                              onChange={(e) => updateOrderItemField(idx, 'unitBuyPrice', Number(e.target.value))}
                              className="w-24 p-1 border border-slate-200 rounded text-right font-mono"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            {formatFCFA(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-900">Total de la commande :</span>
                <span className="font-extrabold text-[#F58220] font-mono text-base">
                  {formatFCFA(orderItems.reduce((a, b) => a + b.total, 0))}
                </span>
              </div>

              <div className="text-[11px] text-slate-500 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                💡 Remarque : Le stock ne sera pas incrémenté immédiatement. Il sera augmenté lors de la validation de la réception effective du camion ou de la livraison.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-sm"
                >
                  Émettre la Commande
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {paymentSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">
                Règlement Fournisseur : {paymentSupplierModal.name}
              </h3>
              <button
                onClick={() => setPaymentSupplierModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSupplierPaymentSubmit} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between font-bold text-slate-900">
                <span>Dette actuelle :</span>
                <span className="font-mono text-rose-600">{formatFCFA(paymentSupplierModal.outstandingBalance)}</span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Montant à verser au fournisseur (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={paymentSupplierModal.outstandingBalance}
                  value={supplierPaymentAmt}
                  onChange={(e) => setSupplierPaymentAmt(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentSupplierModal(null)}
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  Valider le Règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
