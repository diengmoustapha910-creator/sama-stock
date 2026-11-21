import React, { useState } from 'react';
import { Sale, Organization } from '../../types';
import { formatFCFA, formatDakarDate, formatDakarTime, formatDakarDateTime } from '../../services/storage';
import { buildBarcodeBars, getBarcodeTotalModules } from '../../services/barcodeService';
import { Printer, X, CheckCircle2, MessageCircle, Mail, Copy, Check } from 'lucide-react';

interface ThermalReceiptModalProps {
  sale: Sale | null;
  org: Organization;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ sale, org, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(
    org.receiptDefaultWidth || '80mm'
  );
  const [copied, setCopied] = useState(false);

  if (!sale) return null;

  const paymentLabels: Record<string, string> = {
    especes: 'Espèces',
    wave: 'Wave Mobile Money',
    orange_money: 'Orange Money',
    carte: 'Carte Bancaire',
    virement: 'Virement Bancaire',
    credit: 'Crédit Client',
    mixte: 'Paiement Mixte',
  };

  const barcodeValue = sale.saleNumber || sale.id;
  const barcodeBars = buildBarcodeBars(barcodeValue);
  const totalModules = getBarcodeTotalModules(barcodeValue);

  const handlePrint = () => {
    document.documentElement.style.setProperty('--receipt-print-width', paperWidth);
    document.body.classList.add('printing-receipt');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-receipt');
    }, 500);
  };

  const receiptText = [
    `*${org.name}* (${sale.storeName})`,
    `Ticket #${sale.saleNumber} - ${formatDakarDateTime(sale.date)}`,
    sale.customerName ? `Client : ${sale.customerName}` : null,
    `---`,
    ...sale.items.map(
      (i) =>
        `${i.quantity}x ${i.productName}${i.variantName ? ` (${i.variantName})` : ''} : ${formatFCFA(i.total)}`
    ),
    `---`,
    `TOTAL : ${formatFCFA(sale.totalAmount)}`,
    `Payé (${paymentLabels[sale.paymentMethod] || sale.paymentMethod}) : ${formatFCFA(sale.paidAmount)}`,
    sale.balanceDue > 0 ? `Reste dû : ${formatFCFA(sale.balanceDue)}` : null,
    org.receiptFooter || 'Merci pour votre confiance !',
  ]
    .filter(Boolean)
    .join('\n');

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restriction
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(receiptText)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(
    `Reçu ${org.name} #${sale.saleNumber}`
  )}&body=${encodeURIComponent(receiptText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {sale.status === 'annulee' ? 'Ticket Annulé' : 'Ticket de Caisse Validé'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex bg-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  paperWidth === '58mm' ? 'bg-white text-[#123B67] shadow-2xs' : 'text-slate-600'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  paperWidth === '80mm' ? 'bg-white text-[#123B67] shadow-2xs' : 'text-slate-600'
                }`}
              >
                80mm
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Thermal Receipt Preview */}
        <div className="p-5 overflow-y-auto bg-slate-100 flex justify-center">
          <div
            id="thermal-receipt-print-area"
            className={`bg-white p-4 shadow-sm border border-dashed border-slate-300 font-mono text-[11px] text-slate-800 leading-tight space-y-2.5 transition-all ${
              paperWidth === '58mm' ? 'w-[240px]' : 'w-[320px]'
            }`}
          >
            {/* Header info */}
            <div className="text-center space-y-1 pb-2.5 border-b border-dashed border-slate-300">
              {org.receiptShowLogo !== false && org.logoUrl && (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="h-9 w-auto mx-auto object-contain mb-1"
                />
              )}
              <div className="font-bold text-sm text-slate-900 tracking-tight uppercase">
                {org.name}
              </div>
              <div className="text-[10px] text-slate-600">{sale.storeName}</div>
              {org.address && <div className="text-[10px] text-slate-500">{org.address}</div>}
              <div className="text-[10px] text-slate-500">Tél : {org.phone}</div>
            </div>

            {sale.status === 'annulee' && (
              <div className="bg-rose-100 text-rose-800 font-bold text-center py-1 rounded border border-rose-300 text-[10px]">
                TICKET ANNULÉ ({sale.voidReason || 'Annulation'})
              </div>
            )}

            {/* Ticket Metadata */}
            <div className="flex justify-between text-[10px] text-slate-600">
              <span>#{sale.saleNumber}</span>
              <span>
                {formatDakarDate(sale.date)} {formatDakarTime(sale.date)}
              </span>
            </div>
            <div className="text-[10px] text-slate-600 space-y-0.5">
              <div>Opérateur : {sale.cashierName}</div>
              {sale.customerName && <div>Client : {sale.customerName}</div>}
            </div>

            {/* Items Table */}
            <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] text-slate-500 uppercase">
                <span>Article / Qte</span>
                <span>Total</span>
              </div>
              {sale.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="font-medium text-slate-900">
                    {item.productName}
                    {item.variantName ? ` (${item.variantName})` : ''}
                    {item.unitName ? ` [${item.unitName}]` : ''}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>
                      {item.quantity} x {formatFCFA(item.sellPrice)}
                      {item.discount > 0 && ` (-${formatFCFA(item.discount)})`}
                    </span>
                    <span className="font-semibold text-slate-900">{formatFCFA(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1 text-right pt-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total :</span>
                <span>{formatFCFA(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Remise :</span>
                  <span>-{formatFCFA(sale.discount)}</span>
                </div>
              )}
              {(sale.loyaltyDiscountAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Fidélité ({sale.loyaltyPointsRedeemed} pts) :</span>
                  <span>-{formatFCFA(sale.loyaltyDiscountAmount || 0)}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>TVA ({sale.taxRate}%) :</span>
                  <span>{formatFCFA(sale.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                <span>NET À PAYER :</span>
                <span>{formatFCFA(sale.totalAmount)}</span>
              </div>

              {sale.paymentMethod === 'mixte' && Array.isArray(sale.paymentSplits) ? (
                <div className="space-y-0.5 pt-1 text-[10px] text-slate-700">
                  {sale.paymentSplits.map((sp) => (
                    <div key={sp.id} className="flex justify-between">
                      <span>{paymentLabels[sp.method] || sp.method} :</span>
                      <span>{formatFCFA(sp.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex justify-between text-slate-700">
                  <span>{paymentLabels[sale.paymentMethod] || sale.paymentMethod} :</span>
                  <span>{formatFCFA(sale.paidAmount)}</span>
                </div>
              )}

              {sale.paymentReference && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Réf. paiement :</span>
                  <span>{sale.paymentReference}</span>
                </div>
              )}

              {(sale.changeDue || 0) > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Monnaie rendue :</span>
                  <span>{formatFCFA(sale.changeDue || 0)}</span>
                </div>
              )}

              {sale.balanceDue > 0 && (
                <div className="flex justify-between font-bold text-amber-700">
                  <span>Reste à payer :</span>
                  <span>{formatFCFA(sale.balanceDue)}</span>
                </div>
              )}

              {(sale.loyaltyPointsEarned || 0) > 0 && (
                <div className="flex justify-between text-[10px] font-bold text-[#123B67] pt-1 border-t border-dashed border-slate-200">
                  <span>Points fidélité gagnés :</span>
                  <span>+{sale.loyaltyPointsEarned} pts</span>
                </div>
              )}
            </div>

            {/* Footer & real Code 128 barcode */}
            <div className="text-center pt-2.5 border-t border-dashed border-slate-300 space-y-2">
              <div className="text-[10px] text-slate-600 font-sans">
                {org.receiptFooter || org.slogan || 'Merci pour votre confiance !'}
              </div>
              <div className="flex flex-col items-center py-1">
                <svg
                  viewBox={`0 0 ${totalModules} 32`}
                  className="w-44 h-8"
                  preserveAspectRatio="none"
                >
                  {barcodeBars.map((b, idx) => (
                    <rect key={idx} x={b.x} y={0} width={b.width} height={32} fill="#0F172A" />
                  ))}
                </svg>
                <span className="text-[9px] text-slate-500 tracking-widest mt-0.5">
                  {barcodeValue}
                </span>
              </div>
              <div className="text-[8px] text-slate-400">Propulsé par SAMA STOCK</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-white border-t border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <a
              href={mailHref}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>E-mail</span>
            </a>
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-xl transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer ({paperWidth})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
