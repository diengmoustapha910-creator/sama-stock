import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, ProductBatch, ProductUnit, ProductVariant } from '../../types';
import {
  compressImageFileToDataUrl,
  escapeCsvCell,
  formatFCFA,
  sanitizeClientMediaUrl,
} from '../../services/storage';
import { generateEAN13Barcode } from '../../services/barcodeService';
import {
  Plus,
  Search,
  ScanLine,
  Download,
  Upload,
  Edit2,
  Trash2,
  History,
  CheckCircle2,
  X,
  Tag,
  ImagePlus,
  Wand2,
  Layers,
  Package,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import { BarcodeLabelsModal } from '../common/BarcodeLabelsModal';

function getNearestExpiryDays(p: Product): number | null {
  const dates: string[] = [];
  if (p.expiryDate) dates.push(p.expiryDate);
  if (Array.isArray(p.batches)) {
    p.batches.forEach((b) => {
      if (b.quantity > 0 && b.expiryDate) dates.push(b.expiryDate);
    });
  }
  if (dates.length === 0) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let minDays: number | null = null;
  for (const d of dates) {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) continue;
    const diff = Math.ceil((dt.getTime() - now.getTime()) / 86400000);
    if (minDays === null || diff < minDays) minDays = diff;
  }
  return minDays;
}

export const ProductsView: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    clearAllProducts,
    suppliers,
    stockMovements,
    activeStoreId,
    currentStore,
    importProducts,
    hasPermission,
    quotaSummary,
    canAddProduct,
    openUpgradeModal,
  } = useApp();

  const canViewMargins = hasPermission('viewMargins');
  const canEditPrices = hasPermission('editPrices');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low' | 'out' | 'expiring'>(
    'all'
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [notificationMsg, setNotificationMsg] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLabelsModalOpen, setIsLabelsModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Alimentation Générale');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('Unité');
  const [buyPrice, setBuyPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [initialQuantity, setInitialQuantity] = useState<number>(0);
  const [alertThreshold, setAlertThreshold] = useState<number>(5);
  const [supplierId, setSupplierId] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [imageError, setImageError] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.variants &&
          p.variants.some(
            (v) =>
              v.name.toLowerCase().includes(q) ||
              v.sku.toLowerCase().includes(q) ||
              (v.barcode && v.barcode.toLowerCase().includes(q))
          ));

      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'out') {
        matchesStock = p.quantity === 0;
      } else if (stockFilter === 'low') {
        matchesStock = p.quantity > 0 && p.quantity <= p.alertThreshold;
      } else if (stockFilter === 'in_stock') {
        matchesStock = p.quantity > p.alertThreshold;
      } else if (stockFilter === 'expiring') {
        const expDays = getNearestExpiryDays(p);
        matchesStock = expDays !== null && expDays <= 30;
      }

      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  const handleOpenAddModal = () => {
    const check = canAddProduct();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }
    setEditingProduct(null);
    const nextSku = `ART-${Date.now().toString().slice(-6)}`;
    setName('');
    setSku(nextSku);
    setBarcode('');
    setCategory(categories[0] || 'Alimentation Générale');
    setBrand('');
    setUnit('Unité');
    setBuyPrice(1000);
    setSellPrice(1300);
    setInitialQuantity(10);
    setAlertThreshold(5);
    setSupplierId(suppliers[0]?.id || '');
    setDescription('');
    setImageUrl('');
    setExpiryDate('');
    setVariants([]);
    setUnits([]);
    setBatches([]);
    setImageError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setBarcode(p.barcode || '');
    setCategory(p.category);
    setBrand(p.brand || '');
    setUnit(p.unit);
    setBuyPrice(p.buyPrice);
    setSellPrice(p.sellPrice);
    setInitialQuantity(p.quantity);
    setAlertThreshold(p.alertThreshold);
    setSupplierId(p.supplierId || '');
    setDescription(p.description || '');
    setImageUrl(p.imageUrl || '');
    setExpiryDate(p.expiryDate || '');
    setVariants(Array.isArray(p.variants) ? p.variants : []);
    setUnits(Array.isArray(p.units) ? p.units : []);
    setBatches(Array.isArray(p.batches) ? p.batches : []);
    setImageError('');
    setIsAddModalOpen(true);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError('');
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 320, 0.78);
      setImageUrl(compressed);
    } catch (err: any) {
      setImageError(err?.message || 'Erreur lors du traitement de l’image.');
    }
    e.target.value = '';
  };

  const handleAddVariant = () => {
    const idx = variants.length + 1;
    setVariants((prev) => [
      ...prev,
      {
        id: `var-${Date.now()}-${idx}`,
        name: `Variante ${idx}`,
        sku: `${sku}-V${idx}`,
        barcode: '',
        buyPrice: Number(buyPrice) || 0,
        sellPrice: Number(sellPrice) || 0,
        storeQuantities: { [activeStoreId]: 0 },
      },
    ]);
  };

  const handleAddUnit = () => {
    const idx = units.length + 1;
    setUnits((prev) => [
      ...prev,
      {
        id: `unit-${Date.now()}-${idx}`,
        name: 'Carton (12)',
        conversionFactor: 12,
        sellPrice: (Number(sellPrice) || 0) * 12,
        barcode: '',
      },
    ]);
  };

  const handleAddBatch = () => {
    const defaultDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    setBatches((prev) => [
      ...prev,
      {
        id: `lot-${Date.now()}`,
        lotNumber: `LOT-${Date.now().toString().slice(-5)}`,
        expiryDate: defaultDate,
        storeId: activeStoreId,
        quantity: 0,
        receivedAt: new Date().toISOString(),
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanVariants = variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        ...v,
        name: v.name.trim(),
        sku: v.sku.trim() || `${sku}-V`,
        buyPrice: Number(v.buyPrice) || 0,
        sellPrice: Number(v.sellPrice) || 0,
      }));

    const cleanUnits = units
      .filter((u) => u.name.trim() && u.conversionFactor > 0)
      .map((u) => ({
        ...u,
        name: u.name.trim(),
        conversionFactor: Math.max(1, Number(u.conversionFactor)),
        sellPrice: Math.max(0, Number(u.sellPrice)),
      }));

    const cleanBatches = batches.filter((b) => b.lotNumber.trim() && b.expiryDate);

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name,
        sku,
        barcode: barcode || undefined,
        category,
        brand: brand || undefined,
        unit,
        buyPrice: Number(buyPrice),
        sellPrice: Number(sellPrice),
        alertThreshold: Number(alertThreshold),
        supplierId: supplierId || undefined,
        description,
        imageUrl: imageUrl || undefined,
        expiryDate: expiryDate || undefined,
        variants: cleanVariants.length > 0 ? cleanVariants : undefined,
        units: cleanUnits.length > 0 ? cleanUnits : undefined,
        batches: cleanBatches.length > 0 ? cleanBatches : undefined,
      });
    } else {
      addProduct({
        name,
        sku,
        barcode: barcode || undefined,
        category,
        brand: brand || undefined,
        unit,
        buyPrice: Number(buyPrice),
        sellPrice: Number(sellPrice),
        quantity: Number(initialQuantity),
        storeQuantities: {
          [activeStoreId]: Number(initialQuantity),
        },
        alertThreshold: Number(alertThreshold),
        supplierId: supplierId || undefined,
        description,
        imageUrl: imageUrl || undefined,
        expiryDate: expiryDate || undefined,
        variants: cleanVariants.length > 0 ? cleanVariants : undefined,
        units: cleanUnits.length > 0 ? cleanUnits : undefined,
        batches: cleanBatches.length > 0 ? cleanBatches : undefined,
        active: true,
      });
    }

    setIsAddModalOpen(false);
  };

  // CSV Export (protected against formula injection)
  const handleExportCSV = () => {
    let csv = 'SKU;CodeBarres;Nom;Categorie;Unite;PrixAchat;PrixVente;Quantite;SeuilAlerte;Expiration\n';
    products
      .filter((p) => p.active)
      .forEach((p) => {
        csv += [
          escapeCsvCell(p.sku),
          escapeCsvCell(p.barcode || ''),
          escapeCsvCell(p.name),
          escapeCsvCell(p.category),
          escapeCsvCell(p.unit),
          Math.max(0, Number(p.buyPrice) || 0),
          Math.max(0, Number(p.sellPrice) || 0),
          Math.max(0, Number(p.quantity) || 0),
          Math.max(0, Number(p.alertThreshold) || 0),
          escapeCsvCell(p.expiryDate || ''),
        ].join(';') + '\n';
      });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SAMA_STOCK_Catalogue_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // CSV Import (with size limit & numeric validation)
  const handleImportCSVClick = () => {
    const check = canAddProduct();
    if (!check.allowed) {
      openUpgradeModal(check.reason);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setNotificationMsg('Le fichier CSV dépasse la taille maximale autorisée (5 Mo).');
          setTimeout(() => setNotificationMsg(''), 4000);
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = String(event.target?.result || '');
          const lines = content.split('\n');
          const newProds: Product[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(';').map((s) => s.replace(/^"|"$/g, ''));
            if (parts.length >= 7) {
              const [skuVal, barcodeVal, nameVal, catVal, unitVal, buyStr, sellStr, qtyStr, alertStr, expStr] =
                parts;
              const buyVal = Math.max(0, Number(buyStr));
              const sellVal = Math.max(0, Number(sellStr));
              const qtyVal = Math.max(0, Number(qtyStr));
              const alertVal = Math.max(0, Number(alertStr));
              newProds.push({
                id: `prod-imp-${Date.now()}-${i}`,
                sku: skuVal || `IMP-${i}`,
                barcode: barcodeVal || undefined,
                name: nameVal || 'Produit Importé',
                category: catVal || 'Alimentation Générale',
                unit: unitVal || 'Unité',
                buyPrice: Number.isFinite(buyVal) ? buyVal : 1000,
                sellPrice: Number.isFinite(sellVal) ? sellVal : 1200,
                quantity: Number.isFinite(qtyVal) ? qtyVal : 0,
                storeQuantities: {
                  [activeStoreId]: Number.isFinite(qtyVal) ? qtyVal : 0,
                },
                alertThreshold: Number.isFinite(alertVal) ? alertVal : 5,
                expiryDate: expStr || undefined,
                active: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
          if (newProds.length > 0) {
            importProducts(newProds);
            setNotificationMsg(`${newProds.length} produit(s) importé(s) avec succès !`);
            setTimeout(() => setNotificationMsg(''), 4000);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const productMovements = useMemo(() => {
    if (!historyProduct) return [];
    return stockMovements.filter((m) => m.productId === historyProduct.id);
  }, [stockMovements, historyProduct]);

  const activeProductsForLabels = useMemo(
    () => (filteredProducts.length > 0 ? filteredProducts : products.filter((p) => p.active)),
    [filteredProducts, products]
  );

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notificationMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notificationMsg}</span>
          </div>
          <button
            onClick={() => setNotificationMsg('')}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Catalogue des Produits
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {filteredProducts.length} référence(s) · Variantes, multi-unités, lots & codes-barres
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && (
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
              title="Supprimer tous les produits de démonstration"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Vider démo</span>
            </button>
          )}

          {activeProductsForLabels.length > 0 && (
            <button
              onClick={() => setIsLabelsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#123B67] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-[#123B67]" />
              <span>Étiquettes Codes-barres</span>
            </button>
          )}

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ScanLine className="w-3.5 h-3.5 text-[#F58220]" />
            <span>Scanner</span>
          </button>

          <button
            onClick={handleImportCSVClick}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Importer</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exporter</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* Product Quota Usage Banner */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          quotaSummary.products.reached
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-[#123B67] text-white text-[10px] font-bold uppercase">
              Formule {quotaSummary.planName}
            </span>
            {quotaSummary.products.limit === -1 ? (
              <span className="font-semibold">
                Produits actifs : <strong>{quotaSummary.products.used}</strong> · Catalogue illimité
              </span>
            ) : (
              <span className="font-semibold">
                Quota produits : <strong>{quotaSummary.products.used}</strong> /{' '}
                <strong>{quotaSummary.products.limit}</strong> utilisé(s) ·{' '}
                <strong className={quotaSummary.products.reached ? 'text-rose-700' : 'text-emerald-700'}>
                  {quotaSummary.products.remaining} restant(s)
                </strong>
              </span>
            )}
          </div>
          {quotaSummary.products.limit !== -1 && (
            <div className="w-full max-w-md h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  quotaSummary.products.reached
                    ? 'bg-rose-500'
                    : quotaSummary.products.used / quotaSummary.products.limit >= 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((quotaSummary.products.used / Math.max(1, quotaSummary.products.limit)) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
        {quotaSummary.products.reached && (
          <button
            type="button"
            onClick={() => openUpgradeModal(canAddProduct().reason)}
            className="px-3.5 py-2 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-lg text-xs shrink-0 transition-colors cursor-pointer"
          >
            Limite atteinte · Passer à une formule supérieure
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, SKU, variante ou code-barres..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67] transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-[#123B67]"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stockFilter === 'all' ? 'bg-white font-medium text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stockFilter === 'low' ? 'bg-white font-medium text-amber-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Faible
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stockFilter === 'out' ? 'bg-white font-medium text-rose-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Rupture
            </button>
            <button
              onClick={() => setStockFilter('expiring')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                stockFilter === 'expiring'
                  ? 'bg-white font-medium text-rose-700 shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              Expiration &lt;30j
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Article & Réf</th>
                <th className="py-3 px-4">Catégorie</th>
                {canViewMargins && <th className="py-3 px-4 text-right">Prix Achat</th>}
                <th className="py-3 px-4 text-right">Prix Vente</th>
                {canViewMargins && <th className="py-3 px-4 text-right">Marge</th>}
                <th className="py-3 px-4 text-center">Stock ({currentStore?.name})</th>
                <th className="py-3 px-4 text-center">Stock Total</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={canViewMargins ? 8 : 6} className="py-16 text-center">
                    {products.length === 0 ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-slate-800 text-sm">
                          Catalogue prêt — Ajoutez vos premiers articles
                        </div>
                        <p className="text-xs text-slate-500">
                          Votre catalogue ne contient aucun article de démonstration. Ajoutez vos produits avec photo, code-barres, variantes et conditionnements.
                        </p>
                        <div className="pt-2 flex justify-center gap-2">
                          <button
                            onClick={handleOpenAddModal}
                            className="px-4 py-2 bg-[#F58220] hover:bg-[#E07315] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Ajouter un Produit</span>
                          </button>
                          <button
                            onClick={handleImportCSVClick}
                            className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors"
                          >
                            <Upload className="w-4 h-4 text-slate-500" />
                            <span>Importer CSV</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-slate-400">
                        Aucun produit ne correspond à votre filtre de recherche.
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const storeQty = p.storeQuantities?.[activeStoreId] ?? 0;
                  const marginAmt = p.sellPrice - p.buyPrice;
                  const marginPct = p.buyPrice > 0 ? Math.round((marginAmt / p.buyPrice) * 100) : 0;
                  const isLow = p.quantity > 0 && p.quantity <= p.alertThreshold;
                  const isOut = p.quantity === 0;
                  const expDays = getNearestExpiryDays(p);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {sanitizeClientMediaUrl(p.imageUrl) ? (
                            <img
                              src={sanitizeClientMediaUrl(p.imageUrl)}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 flex flex-wrap items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.variants && p.variants.length > 0 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                  {p.variants.length} var.
                                </span>
                              )}
                              {p.units && p.units.length > 0 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                                  +{p.units.length} unité(s)
                                </span>
                              )}
                              {expDays !== null && expDays <= 30 && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    expDays <= 0
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {expDays <= 0 ? 'Expiré' : `Exp. ${expDays}j`}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                              <span>{p.sku}</span>
                              {p.barcode && <span>· EAN : {p.barcode}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.category}</td>
                      {canViewMargins && (
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatFCFA(p.buyPrice)}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatFCFA(p.sellPrice)}
                      </td>
                      {canViewMargins && (
                        <td className="py-3 px-4 text-right font-mono text-emerald-700">
                          +{formatFCFA(marginAmt)} ({marginPct}%)
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-800">
                          {storeQty} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {p.quantity} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setHistoryProduct(p)}
                          title="Historique des mouvements"
                          className="p-1.5 text-slate-500 hover:text-[#123B67] hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          title="Modifier"
                          className="p-1.5 text-slate-500 hover:text-[#F58220] hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setProductToDelete(p)}
                          title="Supprimer définitivement"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingProduct ? 'Modifier le Produit' : 'Ajouter un Nouveau Produit'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto text-xs">
              {/* Photo Upload + Basic Identification */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-24 shrink-0 space-y-2">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative">
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt="Aperçu produit"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          title="Retirer la photo"
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/70 text-white hover:bg-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <ImagePlus className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label className="block w-full text-center px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg cursor-pointer text-[11px]">
                    Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>
                  {imageError && <div className="text-[10px] text-rose-600">{imageError}</div>}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Désignation de l'article *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Riz Parfumé Dinor 25kg"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#123B67]/20 focus:border-[#123B67]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Référence SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Code-barres EAN-13 / Code 128
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Scanner ou générer..."
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        className="flex-1 min-w-0 px-2.5 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                      />
                      <button
                        type="button"
                        onClick={() => setBarcode(generateEAN13Barcode(sku))}
                        title="Générer un code-barres EAN-13 unique"
                        className="px-2.5 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[#123B67]"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        title="Scanner avec caméra"
                        className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-700"
                      >
                        <ScanLine className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Catégorie</label>
                  <input
                    type="text"
                    list="cat-list"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                  <datalist id="cat-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Unité de base</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  >
                    <option value="Unité">Unité</option>
                    <option value="Sac">Sac</option>
                    <option value="Bidon">Bidon</option>
                    <option value="Carton">Carton</option>
                    <option value="Paquet">Paquet</option>
                    <option value="Barre">Barre (12m)</option>
                    <option value="Coupon">Coupon (5m)</option>
                    <option value="Pièce">Pièce / Yard</option>
                    <option value="Kg">Kg</option>
                    <option value="Litre">Litre</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Prix d'achat unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    disabled={Boolean(editingProduct) && !canEditPrices}
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:bg-slate-100 focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Prix de vente unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    disabled={Boolean(editingProduct) && !canEditPrices}
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono disabled:bg-slate-100 focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                {!editingProduct && (
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Quantité initiale en stock ({currentStore?.name})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                    />
                  </div>
                )}

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Seuil d'alerte stock faible
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Date d’expiration principale (optionnelle)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fournisseur habituel
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  >
                    <option value="">Sélectionner un fournisseur...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variants Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Variantes (Tailles, Couleurs, Formats)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-[#123B67]"
                  >
                    + Ajouter variante
                  </button>
                </div>

                {variants.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Optionnel : ajoutez des variantes si ce produit existe en plusieurs tailles ou parfums.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, idx) => (
                      <div
                        key={v.id}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="text"
                          placeholder="Nom (ex: L - Noir)"
                          value={v.name}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                            )
                          }
                          className="col-span-4 px-2 py-1.5 border border-slate-300 rounded text-[11px]"
                        />
                        <input
                          type="text"
                          placeholder="SKU"
                          value={v.sku}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, sku: e.target.value } : item))
                            )
                          }
                          className="col-span-3 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <input
                          type="number"
                          placeholder="Prix vente"
                          value={v.sellPrice}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, sellPrice: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="col-span-2 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <input
                          type="number"
                          placeholder="Qté"
                          value={v.storeQuantities?.[activeStoreId] ?? 0}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      storeQuantities: {
                                        ...(item.storeQuantities || {}),
                                        [activeStoreId]: Math.max(0, Number(e.target.value)),
                                      },
                                    }
                                  : item
                              )
                            )
                          }
                          className="col-span-2 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-500 hover:text-rose-700 flex justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-units Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Package className="w-4 h-4 text-sky-600" />
                    <span>Conditionnements Multi-Unités (Carton, Pack, Boîte)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddUnit}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-[#123B67]"
                  >
                    + Ajouter conditionnement
                  </button>
                </div>

                {units.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Ex: vendre 1 Carton de 12 unités déduit automatiquement 12 unités du stock.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {units.map((u, idx) => (
                      <div
                        key={u.id}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="text"
                          placeholder="Nom (ex: Carton 12)"
                          value={u.name}
                          onChange={(e) =>
                            setUnits((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item))
                            )
                          }
                          className="col-span-5 px-2 py-1.5 border border-slate-300 rounded text-[11px]"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Facteur"
                          title="Nombre d'unités de base déduites"
                          value={u.conversionFactor}
                          onChange={(e) =>
                            setUnits((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, conversionFactor: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="col-span-3 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Prix FCFA"
                          value={u.sellPrice}
                          onChange={(e) =>
                            setUnits((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, sellPrice: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="col-span-3 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => setUnits((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-500 hover:text-rose-700 flex justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Batches / Lots Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Lots & Dates d’Expiration (FEFO)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBatch}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-[#123B67]"
                  >
                    + Ajouter un lot
                  </button>
                </div>

                {batches.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Suivez les numéros de lot et dates de péremption pour sortir en priorité les lots les plus proches (FEFO).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {batches.map((b, idx) => (
                      <div
                        key={b.id}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="text"
                          placeholder="N° Lot"
                          value={b.lotNumber}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, lotNumber: e.target.value } : item
                              )
                            )
                          }
                          className="col-span-4 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <input
                          type="date"
                          value={b.expiryDate}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, expiryDate: e.target.value } : item
                              )
                            )
                          }
                          className="col-span-4 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Qté"
                          value={b.quantity}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, quantity: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="col-span-3 px-2 py-1.5 border border-slate-300 rounded font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => setBatches((prev) => prev.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-500 hover:text-rose-700 flex justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description ou caractéristiques
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              {canViewMargins && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-medium">Marge brute par unité vendue :</span>
                  <span className="font-mono font-bold text-emerald-900">
                    +{formatFCFA(sellPrice - buyPrice)} (
                    {buyPrice > 0 ? Math.round(((sellPrice - buyPrice) / buyPrice) * 100) : 0}%)
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-lg transition-colors"
                >
                  {editingProduct ? 'Mettre à jour' : 'Enregistrer le Produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Stock Movement History Drawer */}
      {historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Historique des Mouvements</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{historyProduct.name}</p>
              </div>
              <button
                onClick={() => setHistoryProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {productMovements.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Aucun mouvement enregistré pour cet article.
                </div>
              ) : (
                productMovements.map((mov) => (
                  <div key={mov.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 capitalize">
                        {mov.type.replace('_', ' ')}
                        {mov.variantName ? ` · ${mov.variantName}` : ''}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          mov.quantity > 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{mov.reason}</div>
                    {mov.lotNumber && (
                      <div className="text-[10px] font-mono text-amber-700">Lot : {mov.lotNumber}</div>
                    )}
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                      <span>{mov.storeName} · Par {mov.userName}</span>
                      <span>{new Date(mov.date).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear Demo Products Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Supprimer tous les produits ?
                </h3>
                <p className="text-[11px] text-slate-500">Réinitialisation du catalogue</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer les {products.length} produit(s) actuels ? Votre catalogue sera vidé pour enregistrer vos véritables marchandises.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllProducts();
                  setIsClearModalOpen(false);
                  setNotificationMsg('Catalogue vidé avec succès.');
                  setTimeout(() => setNotificationMsg(''), 4000);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Oui, tout supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Product Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Supprimer l'article ?</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {productToDelete.name} ({productToDelete.sku})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cette action supprimera définitivement cet article du catalogue et de l'historique de stock.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(productToDelete.id);
                  const deletedName = productToDelete.name;
                  setProductToDelete(null);
                  setNotificationMsg(`L'article "${deletedName}" a été définitivement supprimé.`);
                  setTimeout(() => setNotificationMsg(''), 3000);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Labels Print Modal */}
      {isLabelsModalOpen && (
        <BarcodeLabelsModal
          products={activeProductsForLabels}
          onClose={() => setIsLabelsModalOpen(false)}
        />
      )}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            if (isAddModalOpen) {
              setBarcode(code);
            } else {
              setSearchTerm(code);
            }
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};
