import React from 'react';
import { Invoice, Organization, Store, PaymentMethod } from '../../types';
import { downloadInvoicePDF, printInvoicePDF, generateWhatsAppText } from '../../services/pdfService';
import { formatFCFA } from '../../services/storage';
import { Download, Printer, Share2, X, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface InvoicePDFPreviewModalProps {
  invoice: Invoice | null;
  org: Organization;
  store?: Store;
  onClose: () => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export const InvoicePDFPreviewModal: React.FC<InvoicePDFPreviewModalProps> = ({
  invoice,
  org,
  store,
  onClose,
  onRecordPayment,
}) => {
  if (!invoice) return null;

  const docTitleMap: Record<string, string> = {
    facture_vente: 'FACTURE DE VENTE',
    proforma: 'FACTURE PRO FORMA',
    devis: 'DEVIS COMMERCIAL',
    bon_commande: 'BON DE COMMANDE',
    bon_livraison: 'BON DE LIVRAISON',
    recu: 'REÇU DE PAIEMENT',
    avoir: 'FACTURE D\'AVOIR',
  };

  const handleDownload = () => {
    downloadInvoicePDF(invoice, org, store);
  };

  const handlePrint = () => {
    printInvoicePDF(invoice, org, store);
  };

  const handleWhatsApp = () => {
    const text = generateWhatsAppText(invoice, org);
    const phone = invoice.customerPhone ? invoice.customerPhone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[95vh] overflow-hidden">
        {/* Top Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">{invoice.invoiceNumber}</span>
            <span className="text-xs text-slate-500">· {docTitleMap[invoice.type] || 'Facture'}</span>
          </div>

          <div className="flex items-center gap-2">
            {onRecordPayment && invoice.balanceDue > 0 && invoice.type === 'facture_vente' && (
              <button
                onClick={() => onRecordPayment(invoice)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
              >
                Encaisser un paiement
              </button>
            )}

            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors"
              title="Partager le résumé et relance par WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimer</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#123B67] hover:bg-[#0C2744] rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document View */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex justify-center">
          <div className="w-full max-w-[780px] bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-slate-800 text-xs space-y-6">
            {/* Top Brand Bar */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-6 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <img
                    src="/assets/aistudio/Logo_SAMA_STOCK__gestion_et_croissance_7ffcabd3.png"
                    alt="SAMA STOCK"
                    className="h-10 w-auto object-contain"
                  />
                  <div>
                    <h2 className="font-extrabold text-base text-[#123B67] tracking-tight">{org.name}</h2>
                    <p className="text-[11px] text-[#F58220] font-medium">{org.slogan}</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                  <div>{store ? `${store.name} · ${store.address}` : org.address}</div>
                  <div>Tél : {org.phone} · Email : {org.email}</div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">
                  {docTitleMap[invoice.type] || 'DOCUMENT'}
                </div>
                <div className="text-lg font-extrabold text-[#F58220] font-mono">
                  {invoice.invoiceNumber}
                </div>
                <div className="text-[11px] text-slate-500">
                  Émis le : <span className="font-medium text-slate-700">{invoice.date}</span>
                </div>
                {invoice.dueDate && (
                  <div className="text-[11px] text-slate-500">
                    Échéance : <span className="font-medium text-slate-700">{invoice.dueDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recipient & Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Client Destinataire
                </div>
                <div className="font-bold text-sm text-slate-900">{invoice.customerName}</div>
                {invoice.customerPhone && <div className="text-slate-600">Tél : {invoice.customerPhone}</div>}
                {invoice.customerAddress && <div className="text-slate-600">Adresse : {invoice.customerAddress}</div>}
              </div>

              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Règlement & Point de Vente
                </div>
                <div className="flex items-center gap-2">
                  {invoice.status === 'payee' && (
                    <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md text-[11px]">
                      <CheckCircle className="w-3 h-3" /> Payée Intégralement
                    </span>
                  )}
                  {invoice.status === 'partiellement_payee' && (
                    <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md text-[11px]">
                      <Clock className="w-3 h-3" /> Partiellement Payée
                    </span>
                  )}
                  {invoice.status === 'emise' && (
                    <span className="flex items-center gap-1 font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md text-[11px]">
                      <Clock className="w-3 h-3" /> En attente de règlement
                    </span>
                  )}
                  {invoice.status === 'en_retard' && (
                    <span className="flex items-center gap-1 font-semibold text-rose-700 bg-rose-100/60 px-2 py-0.5 rounded-md text-[11px]">
                      <AlertCircle className="w-3 h-3" /> En retard
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  Boutique : {invoice.storeName}
                </div>
                {invoice.convertedFromQuoteId && (
                  <div className="text-[11px] text-slate-500">
                    Origine : Devis {invoice.convertedFromQuoteId}
                  </div>
                )}
              </div>
            </div>

            {/* Articles Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#123B67] text-white text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Réf.</th>
                    <th className="py-2.5 px-3 font-semibold">Désignation</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Qté</th>
                    <th className="py-2.5 px-3 text-right font-semibold">P.U (FCFA)</th>
                    <th className="py-2.5 px-3 text-center font-semibold">TVA</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Total (FCFA)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.reference || '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatFCFA(item.unitPrice).replace(' FCFA', '')}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{item.taxRate > 0 ? `${item.taxRate}%` : '0%'}</td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                        {formatFCFA(item.total).replace(' FCFA', '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Notes Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3 text-[11px] text-slate-600">
                <div className="font-semibold text-slate-900 uppercase tracking-wider text-[10px]">
                  Règlements & Mentions Légales
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  {org.waveNumber && <div>· Wave Pro : <span className="font-semibold text-slate-900">{org.waveNumber}</span></div>}
                  {org.orangeMoneyNumber && <div>· Orange Money : <span className="font-semibold text-slate-900">{org.orangeMoneyNumber}</span></div>}
                  {org.bankDetails && <div>· {org.bankDetails}</div>}
                  {invoice.paymentTerms && <div className="pt-1 text-slate-500">{invoice.paymentTerms}</div>}
                  {invoice.notes && <div className="text-slate-500 italic">"{invoice.notes}"</div>}
                </div>

                {/* Payments history */}
                {invoice.payments.length > 0 && (
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-800 text-[10px] uppercase">Historique des encaissements :</div>
                    {invoice.payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg text-[10px]">
                        <span>{p.date} · {p.paymentMethod.toUpperCase()} ({p.receivedBy})</span>
                        <span className="font-bold text-emerald-800 font-mono">+{formatFCFA(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals Box */}
              <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Sous-total HT :</span>
                  <span className="font-mono">{formatFCFA(invoice.subtotal)}</span>
                </div>
                {invoice.discountTotal > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Remise commerciale :</span>
                    <span className="font-mono text-emerald-700">-{formatFCFA(invoice.discountTotal)}</span>
                  </div>
                )}
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>TVA Sénégal ({invoice.taxRate}%) :</span>
                    <span className="font-mono">{formatFCFA(invoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-[#123B67] pt-2 border-t border-slate-200">
                  <span>TOTAL TTC :</span>
                  <span className="font-mono text-[#F58220] text-base">{formatFCFA(invoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Montant encaissé :</span>
                  <span className="font-mono text-emerald-700 font-semibold">{formatFCFA(invoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                  <span>SOLDE RESTANT DÛ :</span>
                  <span className={`font-mono ${invoice.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatFCFA(invoice.balanceDue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer with legal stamp line */}
            <div className="pt-6 border-t border-slate-200 flex justify-between text-[10px] text-slate-400">
              <div>SAMA STOCK Sénégal · Solution certifiée</div>
              <div>Page 1 / 1</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
