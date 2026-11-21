import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CartItem,
  PaymentMethod,
  PaymentSplit,
  Product,
  ProductUnit,
  ProductVariant,
  Sale,
} from '../../types';
import { formatFCFA } from '../../services/storage';
import { useBarcodeWedge } from '../../hooks/useBarcodeWedge';
import {
  Search,
  ScanLine,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Maximize2,
  Minimize2,
  History,
  X,
  Gift,
  KeyRound,
  Percent,
  Layers,
  Ban,
  Printer,
  ChevronUp,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';

export const POSView: React.FC = () => {
  const {
    products,
    customers,
    sales,
    activeStoreId,
    currentStore,
    currentUser,
    activeOperator,
    organization,
    activeShift,
    openShift,
    closeShift,
    recordSale,
    voidSale,
    heldSales,
    holdCurrentSale,
    deleteHeldSale,
    isPosFullScreen,
    setIsPosFullScreen,
    openPinModal,
    hasPermission,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Client Comptant');

  // Discounts, Tax & Loyalty
  const [globalDiscountType, setGlobalDiscountType] = useState<'amount' | 'percent'>('amount');
  const [globalDiscountValue, setGlobalDiscountValue] = useState<number>(0);
  const [applyVat, setApplyVat] = useState<boolean>(Boolean(organization.vatEnabled));
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState<boolean>(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('especes');
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { id: 'sp-1', method: 'especes', amount: 0 },
    { id: 'sp-2', method: 'wave', amount: 0 },
  ]);
  const [notes, setNotes] = useState<string>('');

  // Modals & UI drawers
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftInitialCash, setShiftInitialCash] = useState<number>(50000);
  const [shiftActualCash, setShiftActualCash] = useState<number>(0);

  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [holdLabelInput, setHoldLabelInput] = useState('');
  const [isHoldPromptOpen, setIsHoldPromptOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [voidTargetSale, setVoidTargetSale] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Variant / Unit picker modal
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [pickerVariantId, setPickerVariantId] = useState<string>('');
  const [pickerUnitId, setPickerUnitId] = useState<string>('');

  // Explicit Wave / Orange Money manual verification modal (per user policy)
  const [isMobileMoneyConfirmOpen, setIsMobileMoneyConfirmOpen] = useState(false);
  const [mobileMoneyChecked, setMobileMoneyChecked] = useState(false);
  const [mobileMoneyRefInput, setMobileMoneyRefInput] = useState('');

  // Non-blocking toast banner
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(
    null
  );
  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3200);
  }, []);

  const canApplyDiscount = hasPermission('applyDiscount');
  const maxDiscountPct = activeOperator?.permissions?.maxDiscountPercent ?? 100;
  const canVoidSale = hasPermission('voidSale');
  const canManageShift = hasPermission('manageCashShift');

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.active) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered available products in current store
  const posProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.active) return false;
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.variants &&
          p.variants.some(
            (v) =>
              v.name.toLowerCase().includes(term) ||
              v.sku.toLowerCase().includes(term) ||
              (v.barcode && v.barcode.toLowerCase().includes(term))
          ));
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const getCartLineKey = (item: Pick<CartItem, 'productId' | 'variantId' | 'unitName'>) =>
    `${item.productId}__${item.variantId || 'base'}__${item.unitName || 'base'}`;

  const addResolvedItemToCart = useCallback(
    (
      product: Product,
      variant?: ProductVariant,
      unit?: ProductUnit
    ) => {
      const unitFactor = unit ? Math.max(1, unit.conversionFactor) : 1;
      const unitName = unit ? unit.name : undefined;
      const availableBaseQty = variant
        ? variant.storeQuantities?.[activeStoreId] ?? 0
        : product.storeQuantities?.[activeStoreId] ?? 0;

      if (availableBaseQty < unitFactor) {
        showToast(
          'error',
          `Stock insuffisant pour ${product.name}${variant ? ` (${variant.name})` : ''} dans cette boutique.`
        );
        return;
      }

      const sellPrice = unit
        ? unit.sellPrice
        : variant
        ? variant.sellPrice
        : product.sellPrice;
      const buyPrice = (variant ? variant.buyPrice : product.buyPrice) * unitFactor;
      const lineKey = `${product.id}__${variant?.id || 'base'}__${unitName || 'base'}`;

      setCart((prev) => {
        // Total base units already in cart for same product/variant
        const alreadyUsedBase = prev
          .filter(
            (i) => i.productId === product.id && (i.variantId || '') === (variant?.id || '')
          )
          .reduce((sum, i) => sum + i.quantity * (i.unitFactor || 1), 0);

        if (alreadyUsedBase + unitFactor > availableBaseQty) {
          showToast('error', `Stock maximum atteint (${availableBaseQty} ${product.unit} dispo).`);
          return prev;
        }

        const existingIdx = prev.findIndex((i) => getCartLineKey(i) === lineKey);
        if (existingIdx >= 0) {
          return prev.map((i, idx) => {
            if (idx !== existingIdx) return i;
            const nextQty = i.quantity + 1;
            const gross = nextQty * i.sellPrice;
            const disc =
              i.discountType === 'percent'
                ? Math.round((gross * (i.discountValue || 0)) / 100)
                : i.discount;
            return {
              ...i,
              quantity: nextQty,
              discount: disc,
              total: Math.max(0, gross - disc),
            };
          });
        }

        const maxUnitsAvail = Math.floor(availableBaseQty / unitFactor);
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          sku: variant?.sku || product.sku,
          buyPrice,
          sellPrice,
          quantity: 1,
          discount: 0,
          discountType: 'amount',
          discountValue: 0,
          total: sellPrice,
          availableStock: maxUnitsAvail,
          variantId: variant?.id,
          variantName: variant?.name,
          unitName,
          unitFactor,
          imageUrl: product.imageUrl,
        };
        return [...prev, newItem];
      });
    },
    [activeStoreId, showToast]
  );

  const handleProductCardClick = (product: Product) => {
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const hasUnits = Array.isArray(product.units) && product.units.length > 0;
    if (hasVariants || hasUnits) {
      setPickerProduct(product);
      setPickerVariantId(hasVariants ? product.variants![0].id : '');
      setPickerUnitId('');
      return;
    }
    addResolvedItemToCart(product);
  };

  // Barcode scan handler (camera + USB/Bluetooth wedge)
  const handleBarcodeScanned = useCallback(
    (code: string) => {
      const clean = code.trim();
      const lower = clean.toLowerCase();

      for (const p of products) {
        if (!p.active) continue;
        if (p.barcode === clean || p.sku.toLowerCase() === lower) {
          addResolvedItemToCart(p);
          showToast('success', `Ajouté : ${p.name}`);
          return;
        }
        const matchedVariant = p.variants?.find(
          (v) => v.barcode === clean || v.sku.toLowerCase() === lower
        );
        if (matchedVariant) {
          addResolvedItemToCart(p, matchedVariant);
          showToast('success', `Ajouté : ${p.name} (${matchedVariant.name})`);
          return;
        }
        const matchedUnit = p.units?.find((u) => u.barcode === clean);
        if (matchedUnit) {
          addResolvedItemToCart(p, undefined, matchedUnit);
          showToast('success', `Ajouté : ${p.name} [${matchedUnit.name}]`);
          return;
        }
      }

      showToast('error', `Code-barres « ${clean} » introuvable dans le catalogue.`);
    },
    [products, addResolvedItemToCart, showToast]
  );

  useBarcodeWedge({
    enabled:
      !isScannerOpen &&
      !isShiftModalOpen &&
      !isHeldModalOpen &&
      !isHistoryModalOpen &&
      !isMobileMoneyConfirmOpen &&
      !pickerProduct,
    onScan: handleBarcodeScanned,
  });

  const updateCartQty = (lineKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (getCartLineKey(item) !== lineKey) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.availableStock) {
            showToast('error', `Stock maximum atteint (${item.availableStock} max).`);
            return item;
          }
          const gross = nextQty * item.sellPrice;
          const disc =
            item.discountType === 'percent'
              ? Math.round((gross * (item.discountValue || 0)) / 100)
              : Math.min(gross, item.discount);
          return {
            ...item,
            quantity: nextQty,
            discount: disc,
            total: Math.max(0, gross - disc),
          };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateLineDiscount = (
    lineKey: string,
    discountType: 'amount' | 'percent',
    rawVal: number
  ) => {
    if (!canApplyDiscount) {
      showToast('error', 'Votre rôle ne permet pas d’appliquer de remise.');
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (getCartLineKey(item) !== lineKey) return item;
        const gross = item.quantity * item.sellPrice;
        let val = Math.max(0, rawVal);
        if (discountType === 'percent') {
          val = Math.min(val, maxDiscountPct, 100);
        } else {
          const maxAmt = Math.round((gross * maxDiscountPct) / 100);
          val = Math.min(val, maxAmt, gross);
        }
        const computedDisc =
          discountType === 'percent' ? Math.round((gross * val) / 100) : val;
        return {
          ...item,
          discountType,
          discountValue: val,
          discount: computedDisc,
          total: Math.max(0, gross - computedDisc),
        };
      })
    );
  };

  const removeFromCart = (lineKey: string) => {
    setCart((prev) => prev.filter((i) => getCartLineKey(i) !== lineKey));
  };

  const clearCart = () => {
    setCart([]);
    setGlobalDiscountValue(0);
    setUseLoyaltyPoints(false);
    setAmountTendered(0);
    setPaymentReference('');
    setNotes('');
    setMobileMoneyChecked(false);
    setMobileMoneyRefInput('');
  };

  // Financial calculations
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart]
  );

  const computedGlobalDiscount = useMemo(() => {
    if (!canApplyDiscount || globalDiscountValue <= 0) return 0;
    if (globalDiscountType === 'percent') {
      const cappedPct = Math.min(globalDiscountValue, maxDiscountPct, 100);
      return Math.round((subtotal * cappedPct) / 100);
    }
    const maxAmt = Math.round((subtotal * maxDiscountPct) / 100);
    return Math.min(globalDiscountValue, maxAmt, subtotal);
  }, [canApplyDiscount, globalDiscountType, globalDiscountValue, maxDiscountPct, subtotal]);

  // Loyalty redemption calculation
  const loyaltyConfig = organization.loyaltySettings;
  const maxRedeemable = useMemo(() => {
    if (!selectedCustomer || !loyaltyConfig?.enabled) return { points: 0, discountFCFA: 0 };
    const pts = selectedCustomer.loyaltyPoints || 0;
    if (pts < (loyaltyConfig.minRedeemPoints || 0) || pts <= 0) {
      return { points: 0, discountFCFA: 0 };
    }
    const afterGlobal = Math.max(0, subtotal - computedGlobalDiscount);
    const pointVal = Math.max(1, loyaltyConfig.pointValueFCFA || 25);
    const maxPtsByTotal = Math.floor(afterGlobal / pointVal);
    const usablePts = Math.min(pts, maxPtsByTotal);
    return {
      points: usablePts,
      discountFCFA: usablePts * pointVal,
    };
  }, [selectedCustomer, loyaltyConfig, subtotal, computedGlobalDiscount]);

  const appliedLoyaltyPoints = useLoyaltyPoints ? maxRedeemable.points : 0;
  const appliedLoyaltyDiscount = useLoyaltyPoints ? maxRedeemable.discountFCFA : 0;

  const netBeforeTax = useMemo(
    () => Math.max(0, subtotal - computedGlobalDiscount - appliedLoyaltyDiscount),
    [subtotal, computedGlobalDiscount, appliedLoyaltyDiscount]
  );

  const effectiveTaxRate = applyVat ? organization.vatRate || 18 : 0;
  const taxAmount = useMemo(
    () => (applyVat ? Math.round((netBeforeTax * effectiveTaxRate) / 100) : 0),
    [applyVat, netBeforeTax, effectiveTaxRate]
  );

  const totalAmount = useMemo(
    () => netBeforeTax + taxAmount,
    [netBeforeTax, taxAmount]
  );

  const changeDue = useMemo(() => {
    if (paymentMethod === 'especes' && amountTendered > totalAmount) {
      return amountTendered - totalAmount;
    }
    return 0;
  }, [paymentMethod, amountTendered, totalAmount]);

  const splitTotalPaid = useMemo(
    () => splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [splits]
  );

  const needsMobileMoneyConfirm = useMemo(() => {
    if (paymentMethod === 'wave' || paymentMethod === 'orange_money') return true;
    if (
      paymentMethod === 'mixte' &&
      splits.some((s) => (s.method === 'wave' || s.method === 'orange_money') && s.amount > 0)
    ) {
      return true;
    }
    return false;
  }, [paymentMethod, splits]);

  const executeSaleCommit = (overrideRef?: string) => {
    let paid = totalAmount;
    let computedChange = 0;
    let finalSplits: PaymentSplit[] | undefined;

    if (paymentMethod === 'credit') {
      paid = 0;
    } else if (paymentMethod === 'especes') {
      if (amountTendered > 0 && amountTendered < totalAmount) {
        // Partial cash payment -> credit remaining
        paid = amountTendered;
      } else {
        paid = totalAmount;
        computedChange = amountTendered > totalAmount ? amountTendered - totalAmount : 0;
      }
    } else if (paymentMethod === 'mixte') {
      finalSplits = splits.filter((s) => s.amount > 0);
      paid = Math.min(totalAmount, splitTotalPaid);
      if (paid <= 0) {
        showToast('error', 'Veuillez saisir les montants pour le paiement mixte.');
        return;
      }
    }

    if (paid < totalAmount && !selectedCustomerId) {
      showToast('error', 'Veuillez sélectionner un client pour enregistrer un crédit ou paiement partiel.');
      return;
    }

    const sale = recordSale({
      items: cart,
      customerId: selectedCustomerId || undefined,
      customerName,
      subtotal,
      discount: computedGlobalDiscount,
      discountType: globalDiscountType,
      discountValue: globalDiscountValue,
      taxRate: effectiveTaxRate,
      taxAmount,
      totalAmount,
      paidAmount: paid,
      changeDue: computedChange,
      paymentMethod,
      paymentSplits: finalSplits,
      paymentReference: overrideRef || paymentReference || undefined,
      loyaltyPointsRedeemed: appliedLoyaltyPoints,
      loyaltyDiscountAmount: appliedLoyaltyDiscount,
      notes: notes || undefined,
    });

    if (sale) {
      setCompletedSale(sale);
      clearCart();
      setIsMobileCartOpen(false);
      setIsMobileMoneyConfirmOpen(false);
    }
  };

  const handleValidateClick = () => {
    if (cart.length === 0) {
      showToast('error', 'Ajoutez au moins un article au panier.');
      return;
    }
    if (needsMobileMoneyConfirm) {
      setMobileMoneyChecked(false);
      setMobileMoneyRefInput(paymentReference);
      setIsMobileMoneyConfirmOpen(true);
      return;
    }
    executeSaleCommit();
  };

  const todaySalesForStore = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sales.filter((s) => s.storeId === activeStoreId && s.date.startsWith(today));
  }, [sales, activeStoreId]);

  const totalItemsCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Reusable Cart + Checkout panel (shared between desktop right column & mobile slide-up drawer)
  const renderCartAndCheckout = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Cart Header */}
      <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">Panier Actuel</span>
          <span className="text-xs font-mono font-bold text-[#123B67] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
            {totalItemsCount} art.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setHoldLabelInput(customerName !== 'Client Comptant' ? customerName : '');
                  setIsHoldPromptOpen(true);
                }}
                className="text-xs font-semibold text-[#123B67] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1"
              >
                <PauseCircle className="w-3.5 h-3.5 text-[#F58220]" />
                <span>Attente</span>
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            </>
          )}
          {isMobileCartOpen && (
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Customer Selector & Loyalty Pill */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
        <select
          value={selectedCustomerId}
          onChange={(e) => {
            const id = e.target.value;
            setSelectedCustomerId(id);
            setUseLoyaltyPoints(false);
            if (id) {
              const cust = customers.find((c) => c.id === id);
              if (cust) setCustomerName(cust.name);
            } else {
              setCustomerName('Client Comptant');
            }
          }}
          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:border-[#123B67]"
        >
          <option value="">Client Comptant (Standard)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {(c.loyaltyPoints || 0) > 0 ? ` · ⭐ ${c.loyaltyPoints} pts` : ''}
              {c.outstandingBalance > 0 ? ` (Dû: ${formatFCFA(c.outstandingBalance)})` : ''}
            </option>
          ))}
        </select>

        {selectedCustomer && loyaltyConfig?.enabled && (
          <div className="flex items-center justify-between text-[11px] bg-amber-50/70 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-1.5 text-amber-900 font-medium">
              <Gift className="w-3.5 h-3.5 text-[#F58220]" />
              <span>
                Solde : <strong>{selectedCustomer.loyaltyPoints || 0} pts</strong>
              </span>
            </div>
            {maxRedeemable.points > 0 ? (
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#123B67]">
                <input
                  type="checkbox"
                  checked={useLoyaltyPoints}
                  onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                  className="rounded text-[#F58220]"
                />
                <span>Utiliser (-{formatFCFA(maxRedeemable.discountFCFA)})</span>
              </label>
            ) : (
              <span className="text-[10px] text-slate-500">
                Min {loyaltyConfig.minRedeemPoints} pts requis
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="p-3.5 overflow-y-auto divide-y divide-slate-100 flex-1 min-h-[160px] max-h-[310px] lg:max-h-[340px]">
        {cart.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 space-y-2">
            <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
            <p>Panier vide. Touchez un produit ou scannez un code-barres.</p>
          </div>
        ) : (
          cart.map((item) => {
            const key = getCartLineKey(item);
            return (
              <div key={key} className="py-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">
                      {item.productName}
                      {item.variantName ? (
                        <span className="text-[#123B67] font-medium"> · {item.variantName}</span>
                      ) : null}
                      {item.unitName ? (
                        <span className="text-[#F58220] font-medium"> [{item.unitName}]</span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatFCFA(item.sellPrice)} / u
                    </div>
                  </div>

                  {/* Touch Qty Stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCartQty(key, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(key, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right w-20 shrink-0 font-bold text-slate-900 font-mono">
                    {formatFCFA(item.total)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(key)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Per-line discount */}
                {canApplyDiscount && (
                  <div className="flex items-center justify-end gap-1.5 text-[10px]">
                    <span className="text-slate-400">Remise ligne :</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateLineDiscount(
                          key,
                          item.discountType === 'percent' ? 'amount' : 'percent',
                          0
                        )
                      }
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-semibold"
                    >
                      {item.discountType === 'percent' ? '%' : 'FCFA'}
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={item.discountValue || ''}
                      placeholder="0"
                      onChange={(e) =>
                        updateLineDiscount(
                          key,
                          item.discountType || 'amount',
                          Number(e.target.value)
                        )
                      }
                      className="w-16 px-1.5 py-0.5 text-right border border-slate-200 rounded font-mono bg-slate-50"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Totals & Payment Footer */}
      <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5">
        {/* Global Discount + VAT toggles */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-[11px] text-slate-500 shrink-0">Remise:</span>
            <input
              type="number"
              min={0}
              disabled={!canApplyDiscount}
              value={globalDiscountValue || ''}
              placeholder="0"
              onChange={(e) => setGlobalDiscountValue(Math.max(0, Number(e.target.value)))}
              className="w-full text-right font-mono text-xs focus:outline-hidden bg-transparent"
            />
            <button
              type="button"
              disabled={!canApplyDiscount}
              onClick={() =>
                setGlobalDiscountType((prev) => (prev === 'amount' ? 'percent' : 'amount'))
              }
              className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-[#123B67]"
            >
              {globalDiscountType === 'percent' ? '%' : 'F'}
            </button>
          </div>

          <label className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2.5 py-1 cursor-pointer text-[11px]">
            <span className="text-slate-600 font-medium">
              TVA ({organization.vatRate || 18}%)
            </span>
            <input
              type="checkbox"
              checked={applyVat}
              onChange={(e) => setApplyVat(e.target.checked)}
              className="rounded text-[#F58220]"
            />
          </label>
        </div>

        {/* Summary Lines */}
        <div className="space-y-0.5 text-[11px] text-slate-600">
          <div className="flex justify-between">
            <span>Sous-total :</span>
            <span className="font-mono">{formatFCFA(subtotal)}</span>
          </div>
          {computedGlobalDiscount > 0 && (
            <div className="flex justify-between text-rose-600">
              <span>Remise globale :</span>
              <span className="font-mono">-{formatFCFA(computedGlobalDiscount)}</span>
            </div>
          )}
          {appliedLoyaltyDiscount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Fidélité ({appliedLoyaltyPoints} pts) :</span>
              <span className="font-mono">-{formatFCFA(appliedLoyaltyDiscount)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between">
              <span>TVA ({effectiveTaxRate}%) :</span>
              <span className="font-mono">+{formatFCFA(taxAmount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center py-2 border-t border-b border-slate-200">
          <span className="font-bold text-xs sm:text-sm text-slate-900">NET À ENCAISSER :</span>
          <span className="font-extrabold text-lg text-[#F58220] font-mono">
            {formatFCFA(totalAmount)}
          </span>
        </div>

        {/* Payment Method Selector (>=44px touch height) */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
          {[
            { id: 'especes', label: '💵 Espèces' },
            { id: 'wave', label: '🌊 Wave' },
            { id: 'orange_money', label: '🍊 OM' },
            { id: 'carte', label: '💳 Carte' },
            { id: 'virement', label: '🏦 Virement' },
            { id: 'mixte', label: '🔀 Mixte' },
            { id: 'credit', label: '⏳ Crédit' },
          ].map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
              className={`min-h-[40px] px-1.5 rounded-xl border text-center font-semibold text-[11px] transition-colors active:scale-95 ${
                paymentMethod === pm.id
                  ? pm.id === 'wave'
                    ? 'bg-[#38BDF8] text-slate-950 border-[#38BDF8]'
                    : pm.id === 'orange_money'
                    ? 'bg-[#F58220] text-white border-[#F58220]'
                    : pm.id === 'credit'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-[#123B67] text-white border-[#123B67]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>

        {/* Cash Tendered + Quick FCFA Bills */}
        {paymentMethod === 'especes' && (
          <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-amber-900 font-semibold text-[11px]">Montant reçu :</span>
              <input
                type="number"
                value={amountTendered || ''}
                placeholder={String(totalAmount)}
                onChange={(e) => setAmountTendered(Number(e.target.value))}
                className="w-28 px-2 py-1 text-right text-xs bg-white border border-amber-300 rounded-lg font-mono font-bold focus:outline-hidden"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setAmountTendered(totalAmount)}
                className="px-2 py-1 rounded bg-white border border-amber-200 text-[10px] font-bold text-[#123B67]"
              >
                Exact
              </button>
              {[1000, 2000, 5000, 10000, 20000].map((bill) => (
                <button
                  key={bill}
                  type="button"
                  onClick={() => setAmountTendered(bill)}
                  className="px-2 py-1 rounded bg-white border border-amber-200 text-[10px] font-mono text-slate-700 hover:bg-amber-100"
                >
                  {bill.toLocaleString('fr-FR')}
                </button>
              ))}
            </div>
            {changeDue > 0 && (
              <div className="flex justify-between font-bold text-emerald-800 pt-1 border-t border-amber-200">
                <span>Monnaie à rendre :</span>
                <span className="font-mono text-sm">+{formatFCFA(changeDue)}</span>
              </div>
            )}
          </div>
        )}

        {/* Split Tender Builder */}
        {paymentMethod === 'mixte' && (
          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#123B67] text-[11px]">Répartition du paiement</span>
              <button
                type="button"
                onClick={() =>
                  setSplits((prev) => [
                    ...prev,
                    { id: `sp-${Date.now()}`, method: 'especes', amount: 0 },
                  ])
                }
                className="text-[11px] font-semibold text-[#F58220] hover:underline"
              >
                + Ajouter ligne
              </button>
            </div>
            {splits.map((sp) => (
              <div key={sp.id} className="flex items-center gap-1.5">
                <select
                  value={sp.method}
                  onChange={(e) =>
                    setSplits((prev) =>
                      prev.map((x) =>
                        x.id === sp.id ? { ...x, method: e.target.value as any } : x
                      )
                    )
                  }
                  className="px-2 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg"
                >
                  <option value="especes">Espèces</option>
                  <option value="wave">Wave</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="carte">Carte</option>
                  <option value="virement">Virement</option>
                </select>
                <input
                  type="number"
                  min={0}
                  value={sp.amount || ''}
                  placeholder="Montant"
                  onChange={(e) =>
                    setSplits((prev) =>
                      prev.map((x) =>
                        x.id === sp.id ? { ...x, amount: Number(e.target.value) } : x
                      )
                    )
                  }
                  className="flex-1 px-2 py-1.5 text-right text-xs font-mono bg-white border border-slate-200 rounded-lg"
                />
                {splits.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setSplits((prev) => prev.filter((x) => x.id !== sp.id))}
                    className="p-1 text-rose-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex justify-between text-[11px] font-semibold pt-1 border-t border-blue-200">
              <span>Total saisi : {formatFCFA(splitTotalPaid)}</span>
              <span
                className={
                  splitTotalPaid >= totalAmount ? 'text-emerald-700' : 'text-amber-700'
                }
              >
                Reste : {formatFCFA(Math.max(0, totalAmount - splitTotalPaid))}
              </span>
            </div>
          </div>
        )}

        {/* Validate Button (>=48px) */}
        <button
          type="button"
          onClick={handleValidateClick}
          disabled={cart.length === 0}
          className="w-full min-h-[48px] bg-[#F58220] hover:bg-[#E07315] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span>Encaisser ({formatFCFA(totalAmount)})</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`space-y-3 ${isPosFullScreen ? 'pb-20 lg:pb-2' : 'pb-24 lg:pb-4'}`}>
      {/* Non-blocking Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-blue-50 border-blue-200 text-[#123B67]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* POS Top Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#F58220]">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">Caisse & Point de Vente</h1>
            <p className="text-[11px] text-slate-500">
              {currentStore?.name} · Opérateur :{' '}
              <button
                type="button"
                onClick={openPinModal}
                className="font-semibold text-[#123B67] hover:underline inline-flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3 text-[#F58220]" />
                {activeOperator?.name || currentUser.name}
              </button>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Held sales button */}
          <button
            type="button"
            onClick={() => setIsHeldModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#123B67] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl"
          >
            <PauseCircle className="w-3.5 h-3.5 text-[#F58220]" />
            <span>En attente ({heldSales.filter((h) => h.storeId === activeStoreId).length})</span>
          </button>

          {/* Today's Tickets & Void button */}
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl"
          >
            <History className="w-3.5 h-3.5 text-[#123B67]" />
            <span>Tickets ({todaySalesForStore.length})</span>
          </button>

          {/* Shift open/close */}
          {canManageShift &&
            (activeShift ? (
              <button
                type="button"
                onClick={() => {
                  setShiftActualCash(activeShift.expectedCash);
                  setIsShiftModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
              >
                Clôturer ({formatFCFA(activeShift.expectedCash)})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShiftInitialCash(50000);
                  setIsShiftModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl"
              >
                Ouvrir Caisse
              </button>
            ))}

          {/* Full Screen Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsPosFullScreen(!isPosFullScreen)}
            title={isPosFullScreen ? 'Quitter le mode plein écran' : 'Mode Caisse Plein Écran'}
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
          >
            {isPosFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Catalog */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search & Camera Scanner */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                data-barcode-input="true"
                placeholder="Rechercher produit, SKU ou scanner code-barres..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    const exact = products.find(
                      (p) =>
                        p.active &&
                        (p.barcode === searchTerm.trim() ||
                          p.sku.toLowerCase() === searchTerm.trim().toLowerCase())
                    );
                    if (exact) {
                      e.preventDefault();
                      addResolvedItemToCart(exact);
                      setSearchTerm('');
                    }
                  }
                }}
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#123B67]"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[42px] flex items-center gap-1.5 px-3.5 text-xs font-semibold text-[#123B67] bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-colors shrink-0"
            >
              <ScanLine className="w-4 h-4 text-[#F58220]" />
              <span>Caméra</span>
            </button>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[38px] px-3.5 rounded-xl whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#123B67] text-white font-semibold shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tous ({products.filter((p) => p.active).length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[38px] px-3.5 rounded-xl whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#123B67] text-white font-semibold shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Touch Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {posProducts.map((p) => {
              const storeQty = p.storeQuantities?.[activeStoreId] ?? 0;
              const isOut = storeQty <= 0;
              const hasVarsOrUnits =
                (p.variants && p.variants.length > 0) || (p.units && p.units.length > 0);
              const isExpiringSoon =
                p.expiryDate &&
                new Date(p.expiryDate).getTime() - Date.now() <= 30 * 86400000;

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOut}
                  onClick={() => handleProductCardClick(p)}
                  className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.97] group ${
                    isOut
                      ? 'bg-slate-50 border-slate-200 opacity-55 cursor-not-allowed'
                      : 'bg-white border-slate-200 hover:border-[#F58220] hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="space-y-1.5">
                    {p.imageUrl ? (
                      <div className="h-20 w-full rounded-xl overflow-hidden bg-slate-100 relative">
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute top-1.5 right-1.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md shadow-2xs ${
                            isOut
                              ? 'bg-rose-600 text-white'
                              : storeQty <= p.alertThreshold
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {storeQty} {p.unit}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            isOut
                              ? 'bg-rose-50 text-rose-700'
                              : storeQty <= p.alertThreshold
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {storeQty} {p.unit}
                        </span>
                      </div>
                    )}

                    <div className="font-semibold text-slate-800 text-xs line-clamp-2 group-hover:text-[#123B67]">
                      {p.name}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {hasVarsOrUnits && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-blue-50 text-[#123B67] px-1.5 py-0.5 rounded">
                          <Layers className="w-2.5 h-2.5" /> Options
                        </span>
                      )}
                      {isExpiringSoon && (
                        <span className="text-[9px] font-semibold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                          DLC proche
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 font-mono text-xs">
                      {formatFCFA(p.sellPrice)}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-orange-50 group-hover:bg-[#F58220] flex items-center justify-center text-[#F58220] group-hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Right Cart Panel */}
        <div className="hidden lg:flex lg:col-span-5 rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-4 flex-col">
          {renderCartAndCheckout()}
        </div>
      </div>

      {/* Mobile / Tablet Sticky Bottom Cart Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 p-3 shadow-lg flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="flex-1 min-h-[48px] px-4 rounded-xl bg-[#123B67] text-white flex items-center justify-between font-bold text-xs shadow-sm active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#F58220]" />
            <span>Panier ({totalItemsCount})</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono text-sm">
            {formatFCFA(totalAmount)}
            <ChevronUp className="w-4 h-4" />
          </span>
        </button>
      </div>

      {/* Mobile Slide-up Cart Sheet */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {renderCartAndCheckout()}
          </div>
        </div>
      )}

      {/* Variant & Unit Picker Modal */}
      {pickerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{pickerProduct.name}</h3>
                <p className="text-[11px] text-slate-500">Sélectionnez la variante ou l’unité</p>
              </div>
              <button
                onClick={() => setPickerProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerProduct.variants && pickerProduct.variants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Variante :</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                  {pickerProduct.variants.map((v) => {
                    const vQty = v.storeQuantities?.[activeStoreId] ?? 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={vQty <= 0}
                        onClick={() => setPickerVariantId(v.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs flex items-center justify-between ${
                          pickerVariantId === v.id
                            ? 'border-[#F58220] bg-orange-50 font-semibold'
                            : 'border-slate-200 bg-white'
                        } disabled:opacity-50`}
                      >
                        <span>
                          {v.name} <span className="text-slate-400 font-mono">({vQty} en stock)</span>
                        </span>
                        <span className="font-mono font-bold text-[#123B67]">
                          {formatFCFA(v.sellPrice)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {pickerProduct.units && pickerProduct.units.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Conditionnement / Unité :</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPickerUnitId('')}
                    className={`p-2.5 rounded-xl border text-left text-xs ${
                      pickerUnitId === ''
                        ? 'border-[#123B67] bg-blue-50 font-semibold'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>{pickerProduct.unit} (x1)</div>
                    <div className="font-mono font-bold text-[#123B67]">
                      {formatFCFA(pickerProduct.sellPrice)}
                    </div>
                  </button>
                  {pickerProduct.units.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setPickerUnitId(u.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs ${
                        pickerUnitId === u.id
                          ? 'border-[#123B67] bg-blue-50 font-semibold'
                          : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {u.name} (x{u.conversionFactor})
                      </div>
                      <div className="font-mono font-bold text-[#123B67]">
                        {formatFCFA(u.sellPrice)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPickerProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosenVariant = pickerProduct.variants?.find((v) => v.id === pickerVariantId);
                  const chosenUnit = pickerProduct.units?.find((u) => u.id === pickerUnitId);
                  addResolvedItemToCart(pickerProduct, chosenVariant, chosenUnit);
                  setPickerProduct(null);
                }}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-xl"
              >
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Wave / Orange Money Manual Verification Modal */}
      {isMobileMoneyConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#F58220]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Confirmation Réception Mobile Money
                </h3>
              </div>
              <button
                onClick={() => setIsMobileMoneyConfirmOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-1.5 text-xs">
              <div className="font-bold text-[#123B67]">
                Montant à vérifier sur votre téléphone : {formatFCFA(totalAmount)}
              </div>
              {organization.waveNumber && (
                <div className="text-slate-700">
                  Numéro Wave marchand : <span className="font-mono font-bold">{organization.waveNumber}</span>
                </div>
              )}
              {organization.orangeMoneyNumber && (
                <div className="text-slate-700">
                  Numéro Orange Money :{' '}
                  <span className="font-mono font-bold">{organization.orangeMoneyNumber}</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500 pt-1">
                Vérifiez le SMS ou l’application Wave/OM sur votre appareil avant de valider la vente.
              </p>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">
                Référence transaction (optionnel) :
              </label>
              <input
                type="text"
                value={mobileMoneyRefInput}
                onChange={(e) => setMobileMoneyRefInput(e.target.value)}
                placeholder="Ex: T2604... ou ID Wave"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-[#123B67]"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={mobileMoneyChecked}
                onChange={(e) => setMobileMoneyChecked(e.target.checked)}
                className="mt-0.5 rounded text-[#F58220]"
              />
              <span className="font-semibold text-slate-800 leading-relaxed">
                Je confirme avoir vérifié la réception effective du paiement Wave / Orange Money sur le téléphone de la boutique.
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMobileMoneyConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!mobileMoneyChecked}
                onClick={() => executeSaleCommit(mobileMoneyRefInput)}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Confirmer et Émettre Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Sale Name Modal */}
      {isHoldPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Mettre le ticket en attente</h3>
            <input
              type="text"
              autoFocus
              value={holdLabelInput}
              onChange={(e) => setHoldLabelInput(e.target.value)}
              placeholder="Nom du client ou repère (ex: Table 2, Mme Diop)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsHoldPromptOpen(false)}
                className="px-4 py-2 text-xs text-slate-600 bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  holdCurrentSale({
                    label: holdLabelInput,
                    customerId: selectedCustomerId || undefined,
                    customerName,
                    items: cart,
                    discountType: globalDiscountType,
                    discountValue: globalDiscountValue,
                    notes,
                  });
                  clearCart();
                  setIsHoldPromptOpen(false);
                  showToast('info', 'Ticket mis en attente.');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#123B67] rounded-xl"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Sales Drawer/Modal */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Ventes en Attente</h3>
              <button
                onClick={() => setIsHeldModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 overflow-y-auto">
              {heldSales.filter((h) => h.storeId === activeStoreId).length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Aucune vente en attente dans cette boutique.
                </div>
              ) : (
                heldSales
                  .filter((h) => h.storeId === activeStoreId)
                  .map((h) => {
                    const total = h.items.reduce((s, i) => s + i.total, 0);
                    return (
                      <div
                        key={h.id}
                        className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{h.label}</div>
                          <div className="text-[11px] text-slate-500">
                            {h.items.length} ligne(s) · {formatFCFA(total)} · Par {h.operatorName}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCart(h.items);
                              setSelectedCustomerId(h.customerId || '');
                              setCustomerName(h.customerName || 'Client Comptant');
                              setGlobalDiscountType(h.discountType);
                              setGlobalDiscountValue(h.discountValue);
                              deleteHeldSale(h.id);
                              setIsHeldModalOpen(false);
                              showToast('info', `Ticket « ${h.label} » repris.`);
                            }}
                            className="px-3 py-1.5 bg-[#F58220] text-white font-semibold rounded-lg flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Reprendre</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteHeldSale(h.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Today's Tickets & Secure Void Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Tickets du Jour · {currentStore?.name}</h3>
                <p className="text-[11px] text-slate-500">Réimpression thermique ou annulation sécurisée</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 overflow-y-auto">
              {todaySalesForStore.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Aucune vente enregistrée aujourd’hui dans cette boutique.
                </div>
              ) : (
                todaySalesForStore.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      s.status === 'annulee'
                        ? 'bg-rose-50/40 border-rose-200 opacity-75'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono">#{s.saleNumber}</span>
                        {s.status === 'annulee' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                            Annulé
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(s.date).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {s.customerName} · {s.cashierName}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 mr-2">
                        {formatFCFA(s.totalAmount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsHistoryModalOpen(false);
                          setCompletedSale(s);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Ticket</span>
                      </button>
                      {s.status !== 'annulee' && canVoidSale && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidTargetSale(s);
                            setVoidReason('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold flex items-center gap-1"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Annuler</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {voidTargetSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-rose-700 text-sm flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Annulation Sécurisée #{voidTargetSale.saleNumber}
            </h3>
            <p className="text-xs text-slate-600">
              Cette action rétablira automatiquement le stock des articles vendus et ajustera le compte client et les points fidélité.
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Motif d’annulation (obligatoire) :
              </label>
              <input
                type="text"
                autoFocus
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Ex: Erreur de saisie caissier, retour immédiat..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidTargetSale(null)}
                className="px-4 py-2 text-xs text-slate-600 bg-slate-100 rounded-xl"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={!voidReason.trim()}
                onClick={() => {
                  const ok = voidSale(voidTargetSale.id, voidReason);
                  if (ok) {
                    showToast('info', `Ticket #${voidTargetSale.saleNumber} annulé et stock rétabli.`);
                  }
                  setVoidTargetSale(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl"
              >
                Confirmer l’Annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onScan={handleBarcodeScanned}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Thermal Receipt Modal */}
      {completedSale && (
        <ThermalReceiptModal
          sale={completedSale}
          org={organization}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* Quick Cash Shift Open/Close Modal */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">
              {activeShift ? 'Clôture de Caisse & Rapport Z' : 'Ouverture de Session de Caisse'}
            </h3>

            {activeShift ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fond initial :</span>
                    <span className="font-mono">{formatFCFA(activeShift.initialCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ventes Espèces :</span>
                    <span className="font-mono text-emerald-700">
                      +{formatFCFA(activeShift.cashSales)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Entrées / Sorties / Dépenses :</span>
                    <span className="font-mono">
                      +{formatFCFA(activeShift.cashInTotal || 0)} / -
                      {formatFCFA((activeShift.cashOutTotal || 0) + (activeShift.expensesTotal || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ventes Wave / OM :</span>
                    <span className="font-mono">
                      {formatFCFA(activeShift.waveSales + activeShift.orangeMoneySales)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Espèces théoriques en tiroir :</span>
                    <span className="font-mono">{formatFCFA(activeShift.expectedCash)}</span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Espèces réellement comptées :
                  </label>
                  <input
                    type="number"
                    value={shiftActualCash}
                    onChange={(e) => setShiftActualCash(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:outline-hidden focus:border-[#123B67]"
                  />
                  {shiftActualCash - activeShift.expectedCash !== 0 && (
                    <div
                      className={`text-[11px] font-semibold mt-1 ${
                        shiftActualCash - activeShift.expectedCash > 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}
                    >
                      Écart de caisse : {formatFCFA(shiftActualCash - activeShift.expectedCash)}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsShiftModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      closeShift(shiftActualCash);
                      setIsShiftModalOpen(false);
                      showToast('success', 'Session de caisse clôturée et archivée.');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                  >
                    Confirmer la Clôture
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fond de caisse initial (Espèces en FCFA) :
                  </label>
                  <input
                    type="number"
                    value={shiftInitialCash}
                    onChange={(e) => setShiftInitialCash(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsShiftModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      openShift(shiftInitialCash);
                      setIsShiftModalOpen(false);
                      showToast('success', 'Caisse ouverte.');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    Ouvrir la Caisse
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
