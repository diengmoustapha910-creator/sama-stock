import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { escapeCsvCell, formatFCFA } from '../../services/storage';
import {
  Download,
  Printer,
  Building2,
  TrendingUp,
  Award,
  Users,
  Layers,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const {
    sales,
    products,
    expenses,
    customers,
    suppliers,
    stores,
    activeStoreId,
    currentStore,
    consolidatedView,
    setConsolidatedView,
    activeOperator,
    hasPermission,
  } = useApp();

  const canViewMargins = hasPermission('viewMargins');
  const canToggleConsolidated =
    stores.length > 1 &&
    (!activeOperator ||
      activeOperator.role === 'proprietaire' ||
      activeOperator.storeIds.length === 0);

  const [reportType, setReportType] = useState<
    'sales' | 'performance' | 'stock' | 'margins' | 'debts'
  >('sales');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Filter sales according to date range & store scope
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    return sales.filter((s) => {
      if (s.status === 'annulee') return false;
      if (!consolidatedView && s.storeId !== activeStoreId) return false;

      const sDate = new Date(s.date);
      const sDay = s.date.split('T')[0];

      if (dateRange === 'today') return sDay === todayStr;
      if (dateRange === 'week') return sDate >= sevenDaysAgo;
      if (dateRange === 'month') return sDate >= thirtyDaysAgo;
      return true;
    });
  }, [sales, dateRange, consolidatedView, activeStoreId]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    return expenses.filter((e) => {
      if (!consolidatedView && e.storeId !== activeStoreId) return false;
      const eDate = new Date(e.date);
      const eDay = e.date.split('T')[0];
      if (dateRange === 'today') return eDay === todayStr;
      if (dateRange === 'week') return eDate >= sevenDaysAgo;
      if (dateRange === 'month') return eDate >= thirtyDaysAgo;
      return true;
    });
  }, [expenses, dateRange, consolidatedView, activeStoreId]);

  const salesTotal = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.totalAmount, 0),
    [filteredSales]
  );

  const avgBasket = useMemo(
    () => (filteredSales.length > 0 ? Math.round(salesTotal / filteredSales.length) : 0),
    [salesTotal, filteredSales.length]
  );

  const salesCost = useMemo(() => {
    let cost = 0;
    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        cost += item.buyPrice * item.quantity;
      });
    });
    return cost;
  }, [filteredSales]);

  const salesMargin = salesTotal - salesCost;
  const periodExpensesTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  // Stock values scoped to active store or consolidated
  const stockSummary = useMemo(() => {
    let cost = 0;
    let retail = 0;
    const rows = products
      .filter((p) => p.active)
      .map((p) => {
        const qty = consolidatedView ? p.quantity : p.storeQuantities?.[activeStoreId] ?? 0;
        cost += qty * p.buyPrice;
        retail += qty * p.sellPrice;
        return { product: p, qty };
      });
    return { cost, retail, rows };
  }, [products, consolidatedView, activeStoreId]);

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    const totals: Record<string, number> = {
      especes: 0,
      wave: 0,
      orange_money: 0,
      carte: 0,
      virement: 0,
      credit: 0,
    };
    filteredSales.forEach((s) => {
      if (Array.isArray(s.paymentSplits) && s.paymentSplits.length > 0) {
        s.paymentSplits.forEach((sp) => {
          totals[sp.method] = (totals[sp.method] || 0) + sp.amount;
        });
        if (s.balanceDue > 0) {
          totals.credit += s.balanceDue;
        }
      } else {
        const key = s.paymentMethod === 'mixte' ? 'especes' : s.paymentMethod;
        totals[key] = (totals[key] || 0) + s.totalAmount;
      }
    });
    return totals;
  }, [filteredSales]);

  // Cashier ranking
  const cashierStats = useMemo(() => {
    const map: Record<string, { name: string; count: number; total: number }> = {};
    filteredSales.forEach((s) => {
      const key = s.cashierId || s.cashierName || 'caissier';
      if (!map[key]) {
        map[key] = { name: s.cashierName || 'Opérateur', count: 0, total: 0 };
      }
      map[key].count += 1;
      map[key].total += s.totalAmount;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  // Top & Flop products
  const productSalesStats = useMemo(() => {
    const soldMap: Record<string, { id: string; name: string; qty: number; revenue: number }> = {};
    products
      .filter((p) => p.active)
      .forEach((p) => {
        soldMap[p.id] = { id: p.id, name: p.name, qty: 0, revenue: 0 };
      });

    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        if (!soldMap[it.productId]) {
          soldMap[it.productId] = {
            id: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
          };
        }
        soldMap[it.productId].qty += it.quantity * (it.unitFactor || 1);
        soldMap[it.productId].revenue += it.total;
      });
    });

    const list = Object.values(soldMap);
    const top = [...list]
      .filter((x) => x.qty > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    const flop = [...list].sort((a, b) => a.qty - b.qty).slice(0, 8);
    return { top, flop };
  }, [filteredSales, products]);

  // Store comparison
  const storeComparison = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    return stores.map((st) => {
      const stSales = sales.filter((s) => {
        if (s.status === 'annulee' || s.storeId !== st.id) return false;
        const sDate = new Date(s.date);
        const sDay = s.date.split('T')[0];
        if (dateRange === 'today') return sDay === todayStr;
        if (dateRange === 'week') return sDate >= sevenDaysAgo;
        if (dateRange === 'month') return sDate >= thirtyDaysAgo;
        return true;
      });
      const revenue = stSales.reduce((acc, s) => acc + s.totalAmount, 0);
      return {
        id: st.id,
        name: st.name,
        city: st.city,
        count: stSales.length,
        revenue,
        avgBasket: stSales.length > 0 ? Math.round(revenue / stSales.length) : 0,
      };
    });
  }, [stores, sales, dateRange]);

  const totalCustomerDebt = useMemo(
    () => customers.reduce((sum, c) => sum + c.outstandingBalance, 0),
    [customers]
  );
  const totalSupplierDebt = useMemo(
    () => suppliers.reduce((sum, s) => sum + s.outstandingBalance, 0),
    [suppliers]
  );

  // Export current report as CSV
  const handleExportCSV = () => {
    let csv = '';
    const dateStr = new Date().toISOString().split('T')[0];

    if (reportType === 'sales') {
      csv = 'NumeroVente;Date;Boutique;Caissier;Client;Articles;TotalVente;ModePaiement;Statut\n';
      filteredSales.forEach((s) => {
        csv += [
          escapeCsvCell(s.saleNumber),
          escapeCsvCell(s.date),
          escapeCsvCell(s.storeName),
          escapeCsvCell(s.cashierName),
          escapeCsvCell(s.customerName),
          s.items.length,
          s.totalAmount,
          escapeCsvCell(s.paymentMethod),
          escapeCsvCell(s.status),
        ].join(';') + '\n';
      });
    } else if (reportType === 'performance') {
      csv = 'Caissier;Transactions;ChiffreAffairesFCFA\n';
      cashierStats.forEach((c) => {
        csv += `${escapeCsvCell(c.name)};${c.count};${c.total}\n`;
      });
    } else if (reportType === 'stock') {
      csv = 'SKU;Article;Categorie;Unite;PrixAchat;PrixVente;QuantiteStock;ValeurStockAchat;ValeurStockVente\n';
      stockSummary.rows.forEach(({ product: p, qty }) => {
        csv += [
          escapeCsvCell(p.sku),
          escapeCsvCell(p.name),
          escapeCsvCell(p.category),
          escapeCsvCell(p.unit),
          p.buyPrice,
          p.sellPrice,
          qty,
          qty * p.buyPrice,
          qty * p.sellPrice,
        ].join(';') + '\n';
      });
    } else if (reportType === 'debts') {
      csv = 'Type;Nom;Telephone;SoldeDuFCFA\n';
      customers
        .filter((c) => c.outstandingBalance > 0)
        .forEach((c) => {
          csv += `"Client";${escapeCsvCell(c.name)};${escapeCsvCell(c.phone)};${c.outstandingBalance}\n`;
        });
      suppliers
        .filter((s) => s.outstandingBalance > 0)
        .forEach((s) => {
          csv += `"Fournisseur";${escapeCsvCell(s.name)};${escapeCsvCell(s.phone)};${s.outstandingBalance}\n`;
        });
    } else {
      csv = 'Poste;MontantFCFA\n';
      csv += `"Chiffre d'Affaires";${salesTotal}\n`;
      csv += `"Coût des Marchandises Vendues";${salesCost}\n`;
      csv += `"Marge Brute";${salesMargin}\n`;
      csv += `"Charges d'Exploitation";${periodExpensesTotal}\n`;
      csv += `"Résultat Net Estimé";${salesMargin - periodExpensesTotal}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SAMA_STOCK_Rapport_${reportType}_${dateStr}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Rapports & États Commerciaux
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {consolidatedView
              ? `Vue consolidée (${stores.length} boutiques)`
              : `Boutique : ${currentStore?.name}`}{' '}
            · Panier moyen, performance caissiers, marges et exportations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canToggleConsolidated && (
            <button
              type="button"
              onClick={() => setConsolidatedView(!consolidatedView)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                consolidatedView
                  ? 'bg-[#123B67] text-white border-[#123B67]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{consolidatedView ? 'Toutes les boutiques' : 'Boutique active seule'}</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Imprimer</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter en CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type & Range Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-lg gap-1">
          <button
            onClick={() => setReportType('sales')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              reportType === 'sales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Ventes & Paiements
          </button>
          <button
            onClick={() => setReportType('performance')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              reportType === 'performance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Top/Flop & Caissiers
          </button>
          <button
            onClick={() => setReportType('stock')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              reportType === 'stock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Valorisation Stock
          </button>
          {canViewMargins && (
            <button
              onClick={() => setReportType('margins')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                reportType === 'margins' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Marges & Résultats
            </button>
          )}
          <button
            onClick={() => setReportType('debts')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              reportType === 'debts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Créances & Dettes
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">Période :</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden"
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">Ce mois-ci (30 jours)</option>
            <option value="all">Tout l'historique</option>
          </select>
        </div>
      </div>

      {/* Report 1: Sales & Payment Methods */}
      {reportType === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="text-xs text-slate-500">Chiffre d'Affaires</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                {formatFCFA(salesTotal)}
              </div>
              <div className="text-[11px] text-slate-400">{filteredSales.length} ticket(s) validé(s)</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="text-xs text-slate-500">Panier Moyen</div>
              <div className="text-2xl font-extrabold text-[#123B67] font-mono">
                {formatFCFA(avgBasket)}
              </div>
              <div className="text-[11px] text-slate-400">Moyenne par transaction</div>
            </div>

            {canViewMargins && (
              <>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="text-xs text-slate-500">Coût Marchandises (COGS)</div>
                  <div className="text-2xl font-extrabold text-slate-700 font-mono">
                    {formatFCFA(salesCost)}
                  </div>
                  <div className="text-[11px] text-slate-400">Base prix d'achat</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                  <div className="text-xs text-emerald-800 font-medium">Marge Brute</div>
                  <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                    +{formatFCFA(salesMargin)}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-mono">
                    Taux : {salesCost > 0 ? Math.round((salesMargin / salesCost) * 100) : 0}%
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Payment Method Split Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Répartition des Encaissements par Mode de Paiement
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {[
                { key: 'especes', label: 'Espèces', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
                { key: 'wave', label: 'Wave', cls: 'bg-sky-50 border-sky-200 text-sky-900' },
                { key: 'orange_money', label: 'Orange Money', cls: 'bg-orange-50 border-orange-200 text-orange-900' },
                { key: 'carte', label: 'Carte Bancaire', cls: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
                { key: 'virement', label: 'Virement', cls: 'bg-slate-50 border-slate-200 text-slate-900' },
                { key: 'credit', label: 'À Crédit', cls: 'bg-amber-50 border-amber-200 text-amber-900' },
              ].map((m) => (
                <div key={m.key} className={`p-3 rounded-xl border ${m.cls}`}>
                  <div className="text-[11px] opacity-80">{m.label}</div>
                  <div className="font-mono font-extrabold text-sm mt-1">
                    {formatFCFA(paymentBreakdown[m.key] || 0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Boutique</th>
                    <th className="py-3 px-4">Caissier</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Règlement</th>
                    <th className="py-3 px-4 text-right">Total Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Aucune vente sur cette période.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.saleNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{s.date.split('T')[0]}</td>
                        <td className="py-3 px-4 text-slate-600">{s.storeName}</td>
                        <td className="py-3 px-4 text-slate-600">{s.cashierName}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{s.customerName}</td>
                        <td className="py-3 px-4 capitalize text-slate-600">{s.paymentMethod}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatFCFA(s.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 2: Top/Flop Products, Cashiers & Multi-Store Comparison */}
      {reportType === 'performance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Top Produits (Plus Vendus)</h3>
              </div>
              {productSalesStats.top.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Aucune vente enregistrée.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {productSalesStats.top.map((item, idx) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <div className="font-mono font-bold text-slate-900">
                          {formatFCFA(item.revenue)}
                        </div>
                        <div className="text-[10px] text-slate-400">{item.qty} unités</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Flop Products */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Award className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Flop Produits (Faible Rotation)
                </h3>
              </div>
              {productSalesStats.flop.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Aucun article actif.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {productSalesStats.flop.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate pr-2">{item.name}</span>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-amber-700">
                          {item.qty} vendu(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cashier Performance */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Users className="w-4 h-4 text-[#123B67]" />
                <h3 className="font-bold text-slate-900 text-sm">Performance par Caissier</h3>
              </div>
              {cashierStats.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  Aucune vente enregistrée sur la période.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {cashierStats.map((c) => (
                    <div key={c.name} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.count} ticket(s) encaissé(s)</div>
                      </div>
                      <div className="font-mono font-extrabold text-[#123B67]">
                        {formatFCFA(c.total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Store Comparison */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-[#F58220]" />
                <h3 className="font-bold text-slate-900 text-sm">Comparaison Multi-Boutiques</h3>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {storeComparison.map((st) => (
                  <div key={st.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{st.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {st.city} · {st.count} vente(s) · Panier moy. {formatFCFA(st.avgBasket)}
                      </div>
                    </div>
                    <div className="font-mono font-extrabold text-slate-900">
                      {formatFCFA(st.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Stock Valuation */}
      {reportType === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {canViewMargins && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-xs text-slate-500">Valeur Stock (Prix Achat)</div>
                <div className="text-2xl font-extrabold text-[#123B67] font-mono">
                  {formatFCFA(stockSummary.cost)}
                </div>
                <div className="text-[11px] text-slate-400">Capital immobilisé</div>
              </div>
            )}

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <div className="text-xs text-slate-500">Valeur Marchande (Prix Vente)</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                {formatFCFA(stockSummary.retail)}
              </div>
              <div className="text-[11px] text-slate-400">Recettes potentielles brutes</div>
            </div>

            {canViewMargins && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                <div className="text-xs text-emerald-800 font-medium">Bénéfice Potentiel</div>
                <div className="text-2xl font-extrabold text-emerald-700 font-mono">
                  +{formatFCFA(stockSummary.retail - stockSummary.cost)}
                </div>
                <div className="text-[11px] text-emerald-600">Plus-value marchande</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Article</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4 text-center">Quantité</th>
                    {canViewMargins && <th className="py-3 px-4 text-right">P.U Achat</th>}
                    <th className="py-3 px-4 text-right">P.U Vente</th>
                    <th className="py-3 px-4 text-right">
                      {canViewMargins ? 'Valeur Stock (Achat)' : 'Valeur Stock (Vente)'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockSummary.rows.map(({ product: p, qty }) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">{p.sku}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-slate-600">{p.category}</td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {qty} {p.unit}
                      </td>
                      {canViewMargins && (
                        <td className="py-3 px-4 text-right font-mono">{formatFCFA(p.buyPrice)}</td>
                      )}
                      <td className="py-3 px-4 text-right font-mono">{formatFCFA(p.sellPrice)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatFCFA(qty * (canViewMargins ? p.buyPrice : p.sellPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Report 4: Margins & Results */}
      {reportType === 'margins' && canViewMargins && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <h3 className="font-bold text-slate-900 text-sm">
            Compte de Résultat d'Exploitation Estimé (Période : {dateRange})
          </h3>

          <div className="space-y-3 font-mono text-xs max-w-2xl">
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="font-sans font-medium text-slate-700">
                Chiffre d'Affaires Brut (Ventes)
              </span>
              <span className="font-bold text-slate-900 text-sm">{formatFCFA(salesTotal)}</span>
            </div>

            <div className="flex justify-between p-3 bg-slate-50 rounded-xl text-slate-600">
              <span className="font-sans font-medium">
                (-) Coût d'Achat des Marchandises Vendues
              </span>
              <span className="text-rose-700">-{formatFCFA(salesCost)}</span>
            </div>

            <div className="flex justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl font-bold text-emerald-900">
              <span className="font-sans">(=) MARGE BRUTE COMMERCIALE</span>
              <span className="text-sm">+{formatFCFA(salesMargin)}</span>
            </div>

            <div className="flex justify-between p-3 bg-slate-50 rounded-xl text-slate-600">
              <span className="font-sans font-medium">
                (-) Dépenses & Charges Opérationnelles
              </span>
              <span className="text-rose-700">-{formatFCFA(periodExpensesTotal)}</span>
            </div>

            <div className="flex justify-between p-4 bg-[#123B67] text-white rounded-xl font-bold text-base">
              <span className="font-sans">RÉSULTAT NET ESTIMÉ</span>
              <span className="text-[#F58220]">
                {formatFCFA(salesMargin - periodExpensesTotal)}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Ces calculs sont générés à partir des opérations commerciales et charges enregistrées dans SAMA STOCK pour votre pilotage interne.
          </p>
        </div>
      )}

      {/* Report 5: Receivables & Payables */}
      {reportType === 'debts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Créances Clients (Crédits Accordés)
                </h3>
                <p className="text-xs text-slate-500">Montants dus par vos clients</p>
              </div>
              <span className="font-mono font-bold text-sm text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                {formatFCFA(totalCustomerDebt)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {customers
                .filter((c) => c.outstandingBalance > 0)
                .map((c) => (
                  <div key={c.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.phone}</div>
                    </div>
                    <span className="font-bold font-mono text-rose-600">
                      {formatFCFA(c.outstandingBalance)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dettes Fournisseurs</h3>
                <p className="text-xs text-slate-500">Montants dus à vos approvisionneurs</p>
              </div>
              <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                {formatFCFA(totalSupplierDebt)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {suppliers
                .filter((s) => s.outstandingBalance > 0)
                .map((s) => (
                  <div key={s.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-800">{s.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.phone}</div>
                    </div>
                    <span className="font-bold font-mono text-slate-900">
                      {formatFCFA(s.outstandingBalance)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
