import { jsPDF } from 'jspdf';
import { Invoice, Organization, Sale, Store } from '../types';
import { formatFCFA } from './storage';

export const generateInvoicePDF = (
  invoice: Invoice,
  org: Organization,
  store?: Store
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const darkNavy = [18, 59, 103]; // #123B67
  const orange = [245, 130, 32]; // #F58220
  const lightBlue = [56, 189, 248]; // #38BDF8
  const darkText = [30, 41, 59];
  const mutedText = [100, 116, 139];
  const lightBg = [243, 246, 250];

  // Document title mapping
  const docTitles: Record<string, string> = {
    facture_vente: 'FACTURE DE VENTE',
    proforma: 'FACTURE PRO FORMA',
    devis: 'DEVIS COMMERCIAL',
    bon_commande: 'BON DE COMMANDE',
    bon_livraison: 'BON DE LIVRAISON',
    recu: 'REÇU DE RÈGLEMENT',
    avoir: 'FACTURE D\'AVOIR',
  };

  const title = docTitles[invoice.type] || 'FACTURE';

  // 1. Top Decorative Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(0, 0, pageWidth, 6, 'F');

  doc.setFillColor(orange[0], orange[1], orange[2]);
  doc.rect(0, 6, pageWidth, 2, 'F');

  // 2. Company & Document Header
  let y = 18;

  // Company Brand Name & Logo Placeholder
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(org.name, margin, y);

  // Slogan
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  y += 5;
  doc.text(org.slogan || 'Gérez votre stock. Développez votre business.', margin, y);

  // Company legal coordinates
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  y += 5;
  const storeInfo = store ? `${store.name} - ${store.address}, ${store.city}` : `${org.address}, ${org.city}`;
  doc.text(storeInfo, margin, y);
  y += 4;
  doc.text(`Tél : ${org.phone} | Email : ${org.email}`, margin, y);

  // Document Badge (Right Side)
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text(title, rightX, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  doc.text(`N° ${invoice.invoiceNumber}`, rightX, 24, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Date d'émission : ${invoice.date}`, rightX, 30, { align: 'right' });
  if (invoice.dueDate) {
    doc.text(`Date d'échéance : ${invoice.dueDate}`, rightX, 35, { align: 'right' });
  }

  // 3. Client & Details Box
  y = 44;
  // Left: Client Box
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, y, 95, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, 95, 28, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('FACTURÉ À / CLIENT :', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text(invoice.customerName, margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  if (invoice.customerPhone) {
    doc.text(`Tél : ${invoice.customerPhone}`, margin + 4, y + 17);
  }
  if (invoice.customerAddress) {
    doc.text(`Adresse : ${invoice.customerAddress}`, margin + 4, y + 21);
  }

  // Right: Status Box
  const statusX = margin + 102;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(statusX, y, contentWidth - 102, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(statusX, y, contentWidth - 102, 28, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('STATUT DU DOCUMENT :', statusX + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (invoice.status === 'payee') {
    doc.setTextColor(16, 185, 129); // Green
    doc.text('PAYÉE INTÉGRALEMENT', statusX + 4, y + 14);
  } else if (invoice.status === 'partiellement_payee') {
    doc.setTextColor(245, 130, 32); // Orange
    doc.text('PARTIELLEMENT PAYÉE', statusX + 4, y + 14);
  } else if (invoice.status === 'emise') {
    doc.setTextColor(18, 59, 103); // Dark Navy
    doc.text('ÉMISE - EN ATTENTE', statusX + 4, y + 14);
  } else if (invoice.status === 'en_retard') {
    doc.setTextColor(239, 68, 68); // Red
    doc.text('EN RETARD DE RÈGLEMENT', statusX + 4, y + 14);
  } else {
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(invoice.status.toUpperCase(), statusX + 4, y + 14);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Point de vente : ${invoice.storeName}`, statusX + 4, y + 21);
  if (invoice.convertedFromQuoteId) {
    doc.text(`Réf devis : ${invoice.convertedFromQuoteId}`, statusX + 4, y + 25);
  }

  // 4. Products / Items Table
  y = 78;
  const colX = {
    ref: margin,
    desc: margin + 28,
    qty: margin + 95,
    unit: margin + 115,
    tva: margin + 142,
    total: rightX,
  };

  // Table Header
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(margin, y, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('RÉF.', colX.ref + 2, y + 5.5);
  doc.text('DÉSIGNATION DES ARTICLES', colX.desc, y + 5.5);
  doc.text('QTÉ', colX.qty + 6, y + 5.5, { align: 'right' });
  doc.text('P.U (FCFA)', colX.unit + 18, y + 5.5, { align: 'right' });
  doc.text('TVA', colX.tva + 6, y + 5.5, { align: 'center' });
  doc.text('TOTAL (FCFA)', colX.total - 2, y + 5.5, { align: 'right' });

  y += 8;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  invoice.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y, contentWidth, 7, 'F');
    }

    doc.setTextColor(darkText[0], darkText[1], darkText[2]);
    doc.text(item.reference || '-', colX.ref + 2, y + 5);

    // Truncate long description
    const maxDescWidth = 64;
    const truncatedDesc = doc.splitTextToSize(item.description, maxDescWidth)[0];
    doc.text(truncatedDesc, colX.desc, y + 5);

    doc.text(item.quantity.toString(), colX.qty + 6, y + 5, { align: 'right' });
    doc.text(formatFCFA(item.unitPrice).replace(' FCFA', ''), colX.unit + 18, y + 5, { align: 'right' });
    doc.text(item.taxRate > 0 ? `${item.taxRate}%` : '0%', colX.tva + 6, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatFCFA(item.total).replace(' FCFA', ''), colX.total - 2, y + 5, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Bottom line
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 7, rightX, y + 7);

    y += 7;
  });

  // Table bottom border
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, rightX, y);

  // 5. Totals Section & Financials
  y += 4;
  const totalsBoxX = margin + 100;
  const totalsBoxW = contentWidth - 100;

  // Left Note / Payment conditions
  const noteW = 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('MODES & CONDITIONS DE PAIEMENT :', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  let ny = y + 9;
  if (org.waveNumber) {
    doc.text(`- Wave Business : ${org.waveNumber}`, margin, ny);
    ny += 4;
  }
  if (org.orangeMoneyNumber) {
    doc.text(`- Orange Money : ${org.orangeMoneyNumber}`, margin, ny);
    ny += 4;
  }
  if (org.bankDetails) {
    doc.text(`- Virement : ${org.bankDetails}`, margin, ny);
    ny += 4;
  }
  if (invoice.paymentTerms) {
    doc.text(invoice.paymentTerms, margin, ny);
    ny += 4;
  }
  if (invoice.notes) {
    doc.text(`Note : ${invoice.notes}`, margin, ny);
  }

  // Right Totals Table
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(totalsBoxX, y, totalsBoxW, 36, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(totalsBoxX, y, totalsBoxW, 36, 'D');

  let ty = y + 5;
  const labelX = totalsBoxX + 4;
  const valX = rightX - 4;

  // Sous-total HT
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Sous-total HT :', labelX, ty);
  doc.text(formatFCFA(invoice.subtotal), valX, ty, { align: 'right' });

  // Remise
  if (invoice.discountTotal > 0) {
    ty += 5;
    doc.text('Remise accordée :', labelX, ty);
    doc.text(`-${formatFCFA(invoice.discountTotal)}`, valX, ty, { align: 'right' });
  }

  // TVA
  ty += 5;
  doc.text(`TVA Sénégal (${invoice.taxRate}%) :`, labelX, ty);
  doc.text(formatFCFA(invoice.taxAmount), valX, ty, { align: 'right' });

  // Total TTC
  ty += 6;
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(totalsBoxX, ty - 4, totalsBoxW, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL À PAYER (TTC) :', labelX, ty + 1.5);
  doc.setTextColor(orange[0], orange[1], orange[2]);
  doc.text(formatFCFA(invoice.totalAmount), valX, ty + 1.5, { align: 'right' });

  // Montant déjà payé & Reste à payer
  ty += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Montant déjà réglé :', labelX, ty);
  doc.setTextColor(16, 185, 129);
  doc.text(formatFCFA(invoice.paidAmount), valX, ty, { align: 'right' });

  ty += 5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  doc.text('SOLDE RESTANT DÛ :', labelX, ty);
  doc.setTextColor(invoice.balanceDue > 0 ? 239 : 16, invoice.balanceDue > 0 ? 68 : 185, invoice.balanceDue > 0 ? 68 : 129);
  doc.text(formatFCFA(invoice.balanceDue), valX, ty, { align: 'right' });

  // 6. Signature & Stamp Box
  y = pageHeight - 48;
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, 80, 22);
  doc.rect(pageWidth - margin - 80, y, 80, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.text('Signature & Accord du Client', margin + 4, y + 4.5);
  doc.text('Pour SAMA STOCK / Cachet Commercial', pageWidth - margin - 76, y + 4.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('(Mention Bon pour Accord et Signature)', margin + 4, y + 9);
  doc.text('Signature autorisée et date', pageWidth - margin - 76, y + 9);

  // 7. Footer
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');

  doc.setDrawColor(226, 232, 240);
  doc.line(0, pageHeight - 14, pageWidth, pageHeight - 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  const footerLegal = `${org.name} - Tél: ${org.phone} - Siège: ${org.address}, ${org.city}, Sénégal`;
  doc.text(footerLegal, pageWidth / 2, pageHeight - 8, { align: 'center' });
  doc.text(
    'Document certifié conforme émis par la plateforme commerciale SAMA STOCK. Tous droits réservés.',
    pageWidth / 2,
    pageHeight - 4,
    { align: 'center' }
  );

  return doc;
};

export const downloadInvoicePDF = (
  invoice: Invoice,
  org: Organization,
  store?: Store
): void => {
  const doc = generateInvoicePDF(invoice, org, store);
  const filename = `${invoice.invoiceNumber}_${invoice.customerName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(filename);
};

export const printInvoicePDF = (
  invoice: Invoice,
  org: Organization,
  store?: Store
): void => {
  const doc = generateInvoicePDF(invoice, org, store);
  const blobUrl = doc.output('bloburl');
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl.toString();
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
  };
};

export const generateWhatsAppText = (invoice: Invoice, org: Organization): string => {
  const title = invoice.type === 'devis' ? 'Devis' : 'Facture';
  let message = `Bonjour ${invoice.customerName},\n\n`;
  message += `Voici les détails de votre ${title} *${invoice.invoiceNumber}* émise par *${org.name}* :\n\n`;
  message += `📅 Date : ${invoice.date}\n`;
  message += `💰 Montant Total : *${formatFCFA(invoice.totalAmount)}*\n`;
  if (invoice.paidAmount > 0) {
    message += `✅ Acompte payé : ${formatFCFA(invoice.paidAmount)}\n`;
  }
  if (invoice.balanceDue > 0) {
    message += `⚠️ Solde restant dû : *${formatFCFA(invoice.balanceDue)}*\n`;
  } else {
    message += `✨ Statut : Entièrement réglé\n`;
  }
  message += `\n📦 Détail des articles :\n`;
  invoice.items.forEach((item) => {
    message += `• ${item.quantity}x ${item.description} : ${formatFCFA(item.total)}\n`;
  });

  message += `\n💳 Règlements acceptés :\n`;
  if (org.waveNumber) message += `- Wave : ${org.waveNumber}\n`;
  if (org.orangeMoneyNumber) message += `- Orange Money : ${org.orangeMoneyNumber}\n`;
  message += `\nMerci pour votre fidélité !\n*${org.name}* - ${org.phone}`;

  return encodeURIComponent(message);
};
