import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue lors du rendu de l’interface.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SAMA STOCK] Erreur React interceptée par ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
            <img
              src="/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png"
              alt="SAMA STOCK"
              className="h-12 w-auto mx-auto object-contain"
            />
            <div className="w-12 h-12 rounded-full bg-amber-50 text-[#F58220] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-base font-bold text-[#123B67]">
                Une erreur d’affichage est survenue
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vos données sont en sécurité. Vous pouvez réessayer l’affichage ou recharger la page.
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-xl transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recharger SAMA STOCK</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
