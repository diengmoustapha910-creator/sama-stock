import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  ArrowLeftRight,
  FileText,
  Users,
  Truck,
  ClipboardList,
  Receipt,
  BarChart3,
  CreditCard,
  Settings,
  Building2,
  LogOut,
  Wallet,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { ActiveTab } from '../../types';
import { STAFF_ROLE_LABELS } from '../../services/permissions';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const {
    activeTab,
    setActiveTab,
    kpis,
    currentStore,
    currentUser,
    activeOperator,
    activeShift,
    openPinModal,
    hasPermission,
    logout,
  } = useApp();

  const isAdmin = currentUser.role === 'administrateur';

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
    visible?: boolean;
  }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, visible: true },
    { id: 'pos', label: 'Caisse & Vente POS', icon: ShoppingCart, visible: hasPermission('posAccess') },
    {
      id: 'cash_shifts',
      label: 'Caisses & Shifts',
      icon: Wallet,
      badge: activeShift ? 'Ouverte' : undefined,
      badgeColor: 'text-emerald-700 bg-emerald-50',
      visible: hasPermission('manageCashShift') || hasPermission('cashInOut'),
    },
    { id: 'products', label: 'Produits & Articles', icon: Package, visible: hasPermission('manageProducts') },
    { id: 'categories', label: 'Catégories', icon: Tags, visible: hasPermission('manageProducts') },
    {
      id: 'stock',
      label: 'Stocks & Mouvements',
      icon: ArrowLeftRight,
      badge: kpis.lowStockCount > 0 ? kpis.lowStockCount : undefined,
      badgeColor: 'text-amber-700 bg-amber-50',
      visible: hasPermission('manageStock'),
    },
    {
      id: 'invoices',
      label: 'Facturation & Devis',
      icon: FileText,
      badge: kpis.unpaidInvoicesCount > 0 ? kpis.unpaidInvoicesCount : undefined,
      badgeColor: 'text-blue-700 bg-blue-50',
      visible: true,
    },
    { id: 'customers', label: 'Clients & Fidélité', icon: Users, visible: hasPermission('manageCustomers') },
    { id: 'suppliers', label: 'Fournisseurs & Achats', icon: Truck, visible: hasPermission('manageStock') },
    { id: 'inventory', label: 'Inventaire Physique', icon: ClipboardList, visible: hasPermission('manageStock') },
    { id: 'expenses', label: 'Dépenses & Charges', icon: Receipt, visible: hasPermission('viewReports') || hasPermission('manageCashShift') },
    { id: 'reports', label: 'Rapports & Bilans', icon: BarChart3, visible: hasPermission('viewReports') },
    { id: 'employees', label: 'Équipe & Rôles', icon: ShieldCheck, visible: hasPermission('manageEmployees') },
    ...(isAdmin
      ? [
          {
            id: 'admin_subscriptions' as ActiveTab,
            label: 'Gestion Abonnements',
            icon: CreditCard,
            badge: 'Admin',
            badgeColor: 'text-white bg-[#F58220] font-bold',
            visible: true,
          },
        ]
      : []),
    { id: 'settings', label: 'Paramètres & Boutiques', icon: Settings, visible: true },
  ];

  const handleSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-4rem)] flex flex-col justify-between ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Active Store & Operator banner */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#123B67]">
                <Building2 className="w-3.5 h-3.5 text-[#F58220]" />
                <span className="truncate">{currentStore?.name}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                {currentStore?.city} · {currentUser.name}
              </div>
            </div>
            {activeOperator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openPinModal();
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#F58220] text-[11px] transition-colors"
              >
                <span className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3 text-[#F58220]" />
                  {activeOperator.name}
                </span>
                <span className="text-[10px] font-medium text-slate-500 shrink-0">
                  {STAFF_ROLE_LABELS[activeOperator.role]}
                </span>
              </button>
            )}
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            <div className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Menu Commercial
            </div>
            {navItems
              .filter((item) => item.visible !== false)
              .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#123B67] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-[#38BDF8]' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        isActive ? 'bg-white/20 text-white' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info: Senegalese Currency & Logout */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Devise : Franc CFA</span>
            <span className="font-mono font-medium text-slate-700">FCFA</span>
          </div>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full py-2 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center gap-2 border border-rose-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se Déconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
};
