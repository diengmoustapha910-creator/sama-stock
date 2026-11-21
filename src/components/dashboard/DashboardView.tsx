import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/storage';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  Truck,
  ArrowUpRight,
  ShoppingCart,
  Plus,
  ArrowLeftRight,
  Layers,
  Wallet,
  Calendar,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    kpis,
    currentStore,
    stores,
    activeStoreId,
    consolidatedView,
    setConsolidatedView,
    activeOperator,
    products,
    sales,
    setActiveTab,
    hasPermission,
  } = useApp();

  const canViewMargins = hasPermission('viewMargins');
  const canToggleConsolidated =
    stores.length > 1 &&
    (!activeOperator ||
      activeOperator.role === 'proprietaire' ||
      activeOperator.storeIds.length === 0);

  const scopedSales = React.useMemo(
    () =>
      sales.filter(
        (s) => s.status !== 'annulee' && (consolidatedView || s.storeId === activeStoreId)
      ),
    [sales, consolidatedView, activeStoreId]
  );

  const todayStats = React.useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayList = scopedSales.filter((s) => s.date.startsWith(todayStr));
    const total = todayList.reduce((acc, s) => acc + s.totalAmount, 0);
    return {
      count: todayList.length,
      total,
      avgBasket: todayList.length > 0 ? Math.round(total / todayList.length) : 0,
    };
  }, [scopedSales]);

  // Category breakdown
  const categoryStats = React.useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    products.forEach((p) => {
      if (!p.active) return;
      const qty = consolidatedView ? p.quantity : p.storeQuantities?.[activeStoreId] ?? 0;
      if (!map[p.category]) {
        map[p.category] = { count: 0, value: 0 };
      }
      map[p.category].count += qty;
      map[p.category].value += qty * p.buyPrice;
    });
    return Object.entries(map).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [products, consolidatedView, activeStoreId]);

  // Daily sales for the last 7 days chart
  const weeklyDailySales = React.useMemo(() => {
    const days: { dateStr: string; label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      days.push({
        dateStr,
        label: dayName.charAt(0).toUpperCase() + dayName.slice(1),
        total: 0,
      });
    }

    scopedSales.forEach((s) => {
      const sDay = s.date.split('T')[0];
      const match = days.find((d) => d.dateStr === sDay);
      if (match) {
        match.total += s.totalAmount;
      }
    });

    const maxVal = Math.max(...days.map((d) => d.total), 50000);
    return { days, maxVal };
  }, [scopedSales]);

  // Low stock products alert list
  const criticalStockItems = products
    .filter((p) => p.active && p.quantity <= p.alertThreshold)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5);

  // Expiry alerts count (<30 days)
  const expiringCount = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    products.forEach((p) => {
      if (!p.active) return;
      if (p.expiryDate) {
        const dt = new Date(p.expiryDate);
        if (!isNaN(dt.getTime()) && (dt.getTime() - today.getTime()) / 86400000 <= 30) {
          count++;
          return;
        }
      }
      if (
        p.batches?.some((b) => {
          if (b.quantity <= 0 || !b.expiryDate) return false;
          const dt = new Date(b.expiryDate);
          return !isNaN(dt.getTime()) && (dt.getTime() - today.getTime()) / 86400000 <= 30;
        })
      ) {
        count++;
      }
    });
    return count;
  }, [products]);

  // Top products sold
  const topSoldProducts = React.useMemo(() => {
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    scopedSales.forEach((s) => {
      s.items.forEach((item) => {
        if (!itemMap[item.productId]) {
          itemMap[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        itemMap[item.productId].quantity += item.quantity * (item.unitFactor || 1);
        itemMap[item.productId].revenue += item.total;
      });
    });
    return Object.values(itemMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [scopedSales]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="bg-gradient-to-r from-[#123B67] to-[#1e4d82] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#38BDF8] tracking-wider uppercase">
            <span>Tableau de Bord</span>
            <span>·</span>
            <span>
              {consolidatedView ? `Toutes les boutiques (${stores.length})` : currentStore?.name}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
            SAMA STOCK Sénégal
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Caisse tactile POS, gestion de stock multi-boutiques, fidélité client et facturation A4 en FCFA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canToggleConsolidated && (
            <button
              type="button"
              onClick={() => setConsolidatedView(!consolidatedView)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl border transition-colors ${
                consolidatedView
                  ? 'bg-white text-[#123B67] border-white'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{consolidatedView ? 'Vue Consolidée' : 'Vue Boutique'}</span>
            </button>
          )}
          {hasPermission('posAccess') && (
            <button
              onClick={() => setActiveTab('pos')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F58220] hover:bg-[#E07315] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Encaisser Vente</span>
            </button>
          )}
          {(hasPermission('manageCashShift') || hasPermission('cashInOut')) && (
            <button
              onClick={() => setActiveTab('cash_shifts')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/20 backdrop-blur-xs transition-colors"
            >
              <Wallet className="w-4 h-4" />
              <span>Caisse & Shift</span>
            </button>
          )}
          {hasPermission('manageProducts') && (
            <button
              onClick={() => setActiveTab('products')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/20 backdrop-blur-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Produit</span>
            </button>
          )}
          {hasPermission('manageStock') && (
            <button
              onClick={() => setActiveTab('stock')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl border border-white/20 backdrop-blur-xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Stock</span>
            </button>
          )}
        </div>
      </div>

      {/* Expiry alert strip if needed */}
      {expiringCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>
              {expiringCount} produit(s) ont des lots expirés ou expirant sous 30 jours.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('stock')}
            className="font-bold text-[#123B67] hover:underline shrink-0"
          >
            Voir les lots →
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today Sales & Average Basket */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Ventes du Jour</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#F58220]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
            {formatFCFA(todayStats.total)}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between gap-1">
            <span>{todayStats.count} ticket(s)</span>
            <span className="font-semibold text-slate-700 font-mono">
              Panier moy. {formatFCFA(todayStats.avgBasket)}
            </span>
          </div>
        </div>

        {/* KPI 2: Stock Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">
              {canViewMargins ? 'Valeur Stock (Achat)' : 'Valeur Stock (Vente)'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#123B67]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
            {formatFCFA(canViewMargins ? kpis.stockValueCost : kpis.stockValueRetail)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>{kpis.totalProductsCount} article(s) · Prix vente :</span>
            <span className="font-semibold text-slate-700 font-mono">
              {formatFCFA(kpis.stockValueRetail)}
            </span>
          </div>
        </div>

        {/* KPI 3: Margins or Month Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">
              {canViewMargins ? 'Marge Brute Estimée' : 'CA Mois en Cours'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono tracking-tight">
            {canViewMargins
              ? `+${formatFCFA(kpis.grossMargin)}`
              : formatFCFA(kpis.monthSalesTotal)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>Charges :</span>
            <span className="font-semibold text-rose-600 font-mono">
              -{formatFCFA(kpis.monthExpensesTotal)}
            </span>
          </div>
        </div>

        {/* KPI 4: Receivables & Debts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Créances Clients</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-700 font-mono tracking-tight">
            {formatFCFA(kpis.totalCustomerDebt)}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <span>Dettes Fournisseurs :</span>
            <span className="font-semibold text-slate-700 font-mono">
              {formatFCFA(kpis.totalSupplierDebt)}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Row: Sales Evolution Chart & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Évolution des Ventes (7 Derniers Jours)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {consolidatedView
                  ? "Activité consolidée sur l'ensemble des boutiques"
                  : `Activité caisse : ${currentStore?.name}`}
              </p>
            </div>
            <span className="text-xs font-semibold text-[#123B67] bg-blue-50 px-2.5 py-1 rounded-lg">
              Semaine : {formatFCFA(kpis.weekSalesTotal)}
            </span>
          </div>

          <div className="pt-4">
            <div className="h-44 flex items-end gap-3 sm:gap-6 justify-between border-b border-slate-200 pb-2">
              {weeklyDailySales.days.map((day, idx) => {
                const heightPercent = Math.max(
                  8,
                  Math.round((day.total / weeklyDailySales.maxVal) * 100)
                );
                const isToday = idx === weeklyDailySales.days.length - 1;
                return (
                  <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="text-[10px] font-mono text-slate-400 group-hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatFCFA(day.total).replace(' FCFA', '')}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                        isToday
                          ? 'bg-[#F58220] shadow-sm'
                          : 'bg-[#123B67]/80 hover:bg-[#123B67]'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-medium ${
                        isToday ? 'text-[#F58220] font-bold' : 'text-slate-500'
                      }`}
                    >
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-slate-100">
            <div>
              <div className="text-slate-400 text-[11px]">Chiffre d'affaires</div>
              <div className="font-bold text-slate-900 font-mono mt-0.5">
                {formatFCFA(kpis.monthSalesTotal)}
              </div>
            </div>
            {canViewMargins && (
              <div>
                <div className="text-slate-400 text-[11px]">Coût marchandises (COGS)</div>
                <div className="font-bold text-slate-700 font-mono mt-0.5">
                  -{formatFCFA(kpis.costOfGoodsSold)}
                </div>
              </div>
            )}
            <div>
              <div className="text-slate-400 text-[11px]">Charges boutique</div>
              <div className="font-bold text-rose-600 font-mono mt-0.5">
                -{formatFCFA(kpis.monthExpensesTotal)}
              </div>
            </div>
            {canViewMargins && (
              <div>
                <div className="text-slate-400 text-[11px]">Résultat net estimé</div>
                <div className="font-bold text-emerald-700 font-mono mt-0.5">
                  {formatFCFA(kpis.estimatedNetProfit)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="font-bold text-slate-900 text-sm">Alertes de Stock</h2>
              </div>
              <button
                onClick={() => setActiveTab('stock')}
                className="text-xs font-semibold text-[#123B67] hover:underline"
              >
                Gérer
              </button>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {criticalStockItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tous vos stocks sont à des niveaux optimaux.
                </div>
              ) : (
                criticalStockItems.map((prod) => (
                  <div key={prod.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate pr-2">
                      <div className="font-medium text-slate-800 truncate">{prod.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {prod.sku} · Seuil : {prod.alertThreshold} {prod.unit}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`font-bold font-mono px-2 py-0.5 rounded-md text-[11px] ${
                          prod.quantity === 0
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {prod.quantity === 0 ? 'RUPTURE' : `${prod.quantity} ${prod.unit}`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => setActiveTab('suppliers')}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-[#123B67] rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Truck className="w-3.5 h-3.5 text-[#F58220]" />
              <span>Commander Réapprovisionnement</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Top 5 Produits les Plus Vendus</h2>
            <button
              onClick={() => setActiveTab('reports')}
              className="text-xs font-semibold text-[#123B67] hover:underline"
            >
              Rapport Ventes
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {topSoldProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Aucune vente enregistrée pour le moment.
              </div>
            ) : (
              topSoldProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-800">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 font-mono">{formatFCFA(p.revenue)}</div>
                    <div className="text-[10px] text-slate-400">{p.quantity} unités vendues</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Répartition du Stock par Catégorie</h2>
            <span className="text-xs text-slate-400 font-mono">
              Total : {formatFCFA(kpis.stockValueCost)}
            </span>
          </div>

          <div className="space-y-3">
            {categoryStats.map((cat) => {
              const pct =
                kpis.stockValueCost > 0
                  ? Math.round((cat.value / kpis.stockValueCost) * 100)
                  : 0;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{cat.name}</span>
                    <span className="font-mono text-slate-500">
                      {cat.count} articles · {formatFCFA(cat.value)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-[#123B67] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
