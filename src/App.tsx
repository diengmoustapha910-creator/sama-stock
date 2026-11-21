import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { POSView } from './components/pos/POSView';
import { CashRegisterView } from './components/pos/CashRegisterView';
import { ProductsView } from './components/products/ProductsView';
import { CategoriesView } from './components/categories/CategoriesView';
import { StockMovementView } from './components/stock/StockMovementView';
import { InvoicesView } from './components/invoices/InvoicesView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { InventoryView } from './components/inventory/InventoryView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ReportsView } from './components/reports/ReportsView';
import { EmployeesView } from './components/employees/EmployeesView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminSubscriptionsTab } from './components/settings/AdminSubscriptionsTab';
import { UpgradeModal } from './components/subscription/UpgradeModal';
import { PinLockModal } from './components/common/PinLockModal';
import { AuthView } from './components/auth/AuthView';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const MainContent: React.FC = () => {
  const { activeTab, isAuthenticated, isAuthChecking, currentUser, isPosFullScreen } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [urlResetToken, setUrlResetToken] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('reset_token') || '';
  });

  if (urlResetToken) {
    return (
      <AuthView
        initialResetToken={urlResetToken}
        onClearResetToken={() => setUrlResetToken('')}
      />
    );
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-10 h-10 border-4 border-[#123B67]/20 border-t-[#F58220] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-600">
          Vérification de votre session SAMA STOCK...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  const renderView = () => {
    if (currentUser.mustChangePassword) {
      return <SettingsView />;
    }
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <POSView />;
      case 'cash_shifts':
        return <CashRegisterView />;
      case 'products':
        return <ProductsView />;
      case 'categories':
        return <CategoriesView />;
      case 'stock':
        return <StockMovementView />;
      case 'invoices':
        return <InvoicesView />;
      case 'customers':
        return <CustomersView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'inventory':
        return <InventoryView />;
      case 'expenses':
        return <ExpensesView />;
      case 'reports':
        return <ReportsView />;
      case 'employees':
        return <EmployeesView />;
      case 'admin_subscriptions':
        return currentUser.role === 'administrateur' ? (
          <AdminSubscriptionsTab />
        ) : (
          <DashboardView />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  const hideShell = isPosFullScreen && activeTab === 'pos';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {!hideShell && (
        <Header
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {!hideShell && (
          <Sidebar
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          />
        )}

        <main
          className={
            hideShell
              ? 'flex-1 overflow-y-auto p-2 sm:p-3 w-full'
              : 'flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full'
          }
        >
          {renderView()}
        </main>
      </div>

      {/* Staff quick PIN operator switcher */}
      <PinLockModal />

      {/* Centralized upgrade quota modal */}
      <UpgradeModal />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ErrorBoundary>
          <MainContent />
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}
