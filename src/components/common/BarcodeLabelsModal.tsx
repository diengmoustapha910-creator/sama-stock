import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { formatFCFA } from '../../services/storage';
import { buildBarcodeBars, getBarcodeTotalModules } from '../../services/barcodeService';
import { Printer, X, Tag, Minus, Plus } from 'lucide-react';

interface BarcodeLabelsModalProps {
  products: Product[];
  onClose: () => void;
}

export const BarcodeLabelsModal: React.FC<BarcodeLabelsModalProps> = ({ products, onClose }) => {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.slice(0, 20).forEach((p) => {
      initial[p.id] = 1;
    });
    return initial;
  });
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);

  const labelItems = useMemo(() => {
    const list: Product[] = [];
    for (const p of products) {
      const qty = counts[p.id] || 0;
      for (let i = 0; i < qty; i++) {
        list.push(p);
      }
    }
    return list;
  }, [products, counts]);

  const handlePrint = () => {
    document.body.classList.add('printing-labels');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-labels');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-[#F58220]" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Impression d’Étiquettes Codes-Barres</h3>
              <p className="text-[11px] text-slate-500">
                {labelItems.length} étiquette(s) prête(s) à imprimer (Code 128 / EAN-13)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left: Quantities Selection */}
          <div className="lg:col-span-2 p-4 space-y-3 bg-white overflow-y-auto max-h-[68vh]">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">Quantité d’étiquettes</span>
              <div className="flex items-center gap-3 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-[#F58220]"
                  />
                  <span>Prix</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    className="rounded text-[#F58220]"
                  />
                  <span>SKU</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              {products.map((prod) => {
                const qty = counts[prod.id] || 0;
                return (
                  <div
                    key={prod.id}
                    className="p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">{prod.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 truncate">
                        {prod.barcode || prod.sku}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCounts((prev) => ({
                            ...prev,
                            [prod.id]: Math.max(0, (prev[prod.id] || 0) - 1),
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold text-slate-900">{qty}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCounts((prev) => ({
                            ...prev,
                            [prod.id]: (prev[prod.id] || 0) + 1,
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Print Preview */}
          <div className="lg:col-span-3 p-5 bg-slate-100 overflow-y-auto max-h-[68vh]">
            <div
              id="barcode-labels-print-area"
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              {labelItems.map((prod, idx) => {
                const code = prod.barcode || prod.sku || prod.id.slice(-8);
                const bars = buildBarcodeBars(code);
                const totalModules = getBarcodeTotalModules(code);
                return (
                  <div
                    key={`${prod.id}-${idx}`}
                    className="bg-white border border-slate-300 rounded-lg p-2.5 flex flex-col items-center text-center justify-between space-y-1 break-inside-avoid"
                  >
                    <div className="text-[11px] font-bold text-slate-900 line-clamp-1 w-full">
                      {prod.name}
                    </div>
                    {showPrice && (
                      <div className="text-xs font-extrabold text-[#123B67]">
                        {formatFCFA(prod.sellPrice)}
                      </div>
                    )}
                    <svg
                      viewBox={`0 0 ${totalModules} 36`}
                      className="w-full h-9"
                      preserveAspectRatio="none"
                    >
                      {bars.map((bar, bIdx) => (
                        <rect
                          key={bIdx}
                          x={bar.x}
                          y={0}
                          width={bar.width}
                          height={36}
                          fill="#0F172A"
                        />
                      ))}
                    </svg>
                    <div className="text-[9px] font-mono text-slate-600 tracking-wider">
                      {code}
                      {showSku && prod.sku && prod.barcode ? ` · ${prod.sku}` : ''}
                    </div>
                  </div>
                );
              })}

              {labelItems.length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-slate-500">
                  Sélectionnez au moins 1 étiquette à gauche pour afficher l’aperçu.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={labelItems.length === 0}
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] disabled:opacity-50 rounded-xl shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer {labelItems.length} étiquette(s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
