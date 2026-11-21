import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Category } from '../../types';
import { formatFCFA } from '../../services/storage';
import {
  Tags,
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Palette,
  Sparkles,
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Émeraude', hex: '#059669', bgClass: 'bg-emerald-500', lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { name: 'Cyan', hex: '#0284c7', bgClass: 'bg-sky-500', lightBg: 'bg-sky-50 text-sky-700 border-sky-200' },
  { name: 'Bleu Royal', hex: '#2563eb', bgClass: 'bg-blue-600', lightBg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Violet', hex: '#7c3aed', bgClass: 'bg-violet-600', lightBg: 'bg-violet-50 text-violet-700 border-violet-200' },
  { name: 'Rose', hex: '#db2777', bgClass: 'bg-pink-600', lightBg: 'bg-pink-50 text-pink-700 border-pink-200' },
  { name: 'Ambre / Or', hex: '#d97706', bgClass: 'bg-amber-500', lightBg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Orange SAMA', hex: '#F58220', bgClass: 'bg-[#F58220]', lightBg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Indigo', hex: '#4f46e5', bgClass: 'bg-indigo-600', lightBg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { name: 'Ardoise', hex: '#475569', bgClass: 'bg-slate-600', lightBg: 'bg-slate-50 text-slate-700 border-slate-200' },
  { name: 'Teal', hex: '#0d9488', bgClass: 'bg-teal-600', lightBg: 'bg-teal-50 text-teal-700 border-teal-200' },
];

const PRESET_EMOJIS = [
  '🛒', '🥤', '🥛', '🧼', '✨', '📱', '🔨', '👕',
  '🫒', '📦', '🥖', '🍎', '⚡', '💊', '🍖', '☕',
  '🧴', '🍬', '🥗', '👟', '🥫', '🍚', '🍫', '🐟'
];

export const CategoriesView: React.FC = () => {
  const {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    resetCategoriesToDefault,
    products,
    setActiveTab,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [selectedIcon, setSelectedIcon] = useState('🛒');

  // Stats calculation
  const stats = useMemo(() => {
    const totalCategories = categories.length;
    const activeProducts = products.filter((p) => p.active);
    
    // Category product counts and inventory values
    const catMap: Record<string, { count: number; stockValue: number }> = {};
    categories.forEach((c) => {
      catMap[c.name] = { count: 0, stockValue: 0 };
    });

    activeProducts.forEach((p) => {
      if (!catMap[p.category]) {
        catMap[p.category] = { count: 0, stockValue: 0 };
      }
      catMap[p.category].count += 1;
      catMap[p.category].stockValue += (p.buyPrice * p.quantity);
    });

    // Top category by product count
    let topCategory = 'Aucune';
    let maxCount = -1;
    Object.entries(catMap).forEach(([catName, data]) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        topCategory = catName;
      }
    });

    const categoriesWithProducts = Object.values(catMap).filter((d) => d.count > 0).length;

    return {
      totalCategories,
      categoriesWithProducts,
      totalCategorizedProducts: activeProducts.length,
      topCategory,
      topCount: maxCount > 0 ? maxCount : 0,
      catMap,
    };
  }, [categories, products]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const match =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
      return match;
    });
  }, [categories, searchTerm]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setSelectedColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex);
    setSelectedIcon(PRESET_EMOJIS[0]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setSelectedColor(cat.color || PRESET_COLORS[0].hex);
    setSelectedIcon(cat.icon || '🛒');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingCategory) {
      updateCategory(editingCategory.id, {
        name: name.trim(),
        description: description.trim(),
        color: selectedColor,
        icon: selectedIcon,
      });
      setNotificationMsg(`La catégorie « ${name} » a été modifiée avec succès.`);
    } else {
      // Check duplicate
      const exists = categories.some(
        (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (exists) {
        alert('Une catégorie portant ce nom existe déjà.');
        return;
      }
      addCategory({
        name: name.trim(),
        description: description.trim(),
        color: selectedColor,
        icon: selectedIcon,
      });
      setNotificationMsg(`La catégorie « ${name} » a été créée avec succès.`);
    }

    setIsModalOpen(false);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const catName = categoryToDelete.name;
    const countInCat = stats.catMap[catName]?.count || 0;

    deleteCategory(categoryToDelete.id);
    setCategoryToDelete(null);
    setNotificationMsg(
      countInCat > 0
        ? `Catégorie « ${catName} » supprimée. Note : ${countInCat} produit(s) portaient cette catégorie.`
        : `Catégorie « ${catName} » supprimée avec succès.`
    );
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-[#123B67] rounded-xl border border-blue-200">
              <Tags className="w-5 h-5 text-[#F58220]" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Gestion des Catégories
              </h1>
              <p className="text-xs text-slate-500">
                Organisez vos familles de produits pour simplifier la caisse POS et le réapprovisionnement.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Voulez-vous réinitialiser la liste avec les catégories recommandées du commerce sénégalais ?'
                )
              ) {
                resetCategoriesToDefault();
                setNotificationMsg('Les catégories par défaut ont été restaurées.');
                setTimeout(() => setNotificationMsg(null), 3000);
              }
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-2xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Réinitialiser</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors"
          >
            <Package className="w-3.5 h-3.5 text-slate-500" />
            <span>Catalogue Produits</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#F58220] hover:bg-[#E07315] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Catégorie</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{notificationMsg}</span>
          </div>
          <button
            onClick={() => setNotificationMsg(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-[#123B67] rounded-xl">
            <Tags className="w-5 h-5 text-[#123B67]" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Catégories
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {stats.totalCategories}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {stats.categoriesWithProducts} avec des articles en stock
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Articles Assignés
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {stats.totalCategorizedProducts}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5 font-medium">
              100% rattachés à une famille
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-orange-50 text-[#F58220] rounded-xl">
            <TrendingUp className="w-5 h-5 text-[#F58220]" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Catégorie Phare
            </div>
            <div className="text-sm font-extrabold text-slate-900 truncate max-w-[150px] mt-0.5" title={stats.topCategory}>
              {stats.topCategory}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {stats.topCount} produit{stats.topCount > 1 ? 's' : ''} référencé{stats.topCount > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <Layers className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Caisse & POS
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              Onglets Rapides
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Filtrage instantané à la vente
            </div>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#123B67] transition-colors"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {filteredCategories.length} catégorie{filteredCategories.length > 1 ? 's' : ''} trouvée{filteredCategories.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Categories Cards Grid */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-50 border border-orange-200 text-[#F58220] flex items-center justify-center mb-4">
            <Tags className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Aucune catégorie trouvée</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            {categories.length === 0
              ? 'Votre boutique n’a pas encore de catégories enregistrées. Créez-en une ou chargez les catégories standards.'
              : 'Aucune catégorie ne correspond à votre recherche.'}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-[#F58220] hover:bg-[#E07315] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une Catégorie</span>
            </button>
            {categories.length === 0 && (
              <button
                onClick={resetCategoriesToDefault}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Charger Recommandations</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => {
            const catStats = stats.catMap[cat.name] || { count: 0, stockValue: 0 };
            const catProducts = products.filter((p) => p.active && p.category === cat.name);
            const colorPreset = PRESET_COLORS.find((c) => c.hex === cat.color) || PRESET_COLORS[0];

            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#123B67]/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                {/* Top color bar */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: cat.color || '#F58220' }}
                />

                <div className="p-5 flex-1 space-y-4">
                  {/* Category Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-2xs border border-slate-100 shrink-0"
                        style={{
                          backgroundColor: `${cat.color || '#F58220'}15`,
                        }}
                      >
                        {cat.icon || '🛒'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#123B67] transition-colors">
                          {cat.name}
                        </h3>
                        <span
                          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                          style={{
                            backgroundColor: `${cat.color || '#F58220'}18`,
                            color: cat.color || '#F58220',
                          }}
                        >
                          {catStats.count} produit{catStats.count > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditModal(cat)}
                        title="Modifier cette catégorie"
                        className="p-1.5 text-slate-400 hover:text-[#123B67] hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        title="Supprimer cette catégorie"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {cat.description ? (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {cat.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Aucune description renseignée pour cette catégorie.
                    </p>
                  )}

                  {/* Stock Metrics Bar */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Valeur Stock (Achat)</div>
                      <div className="font-mono font-bold text-slate-800">
                        {formatFCFA(catStats.stockValue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-medium">Articles En Stock</div>
                      <div className="font-mono font-bold text-emerald-700">
                        {catProducts.reduce((acc, p) => acc + p.quantity, 0)} unités
                      </div>
                    </div>
                  </div>

                  {/* Mini Preview of articles */}
                  {catProducts.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Exemples d'articles ({catProducts.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {catProducts.slice(0, 3).map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] rounded-lg truncate max-w-[140px]"
                            title={p.name}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span className="truncate">{p.name}</span>
                          </span>
                        ))}
                        {catProducts.length > 3 && (
                          <span className="text-[10px] text-slate-400 self-center pl-1">
                            +{catProducts.length - 3} autre{catProducts.length - 3 > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {cat.id.slice(0, 14)}
                  </span>
                  <button
                    onClick={() => setActiveTab('products')}
                    className="text-xs font-bold text-[#123B67] hover:text-[#F58220] flex items-center gap-1 transition-colors"
                  >
                    <span>Voir les articles</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Category */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-50 text-[#F58220] rounded-xl border border-orange-200">
                  <Tags className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie de Produits'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Définissez le nom, la couleur et le pictogramme pour votre caisse.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {/* Category Name */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Épicerie Sucrée, Boissons Fraîches, Papeterie..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67] focus:ring-2 focus:ring-[#123B67]/15"
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Description / Sous-titre
                </label>
                <textarea
                  rows={2}
                  placeholder="Précisez quels types de produits sont inclus..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:border-[#123B67]"
                />
              </div>

              {/* Emoji / Pictogram Selector */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Icône / Émoji représentatif
                </label>
                <div className="grid grid-cols-8 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl max-h-36 overflow-y-auto">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedIcon(emoji)}
                      className={`text-xl p-2 rounded-xl flex items-center justify-center transition-all ${
                        selectedIcon === emoji
                          ? 'bg-white shadow-xs border-2 border-[#F58220] scale-110'
                          : 'hover:bg-white/80 border border-transparent'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  <span>Couleur d'identification</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((clr) => (
                    <button
                      key={clr.hex}
                      type="button"
                      onClick={() => setSelectedColor(clr.hex)}
                      title={clr.name}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        selectedColor === clr.hex ? 'ring-2 ring-offset-2 ring-[#123B67] scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: clr.hex }}
                    >
                      {selectedColor === clr.hex && (
                        <div className="w-2 h-2 rounded-full bg-white shadow-xs"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Aperçu du badge en Caisse & Catalogue
                </div>
                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ backgroundColor: `${selectedColor}20` }}
                  >
                    {selectedIcon}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">
                      {name || 'Nom de la catégorie'}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">
                      {description || 'Description de la catégorie'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#F58220] hover:bg-[#E07315] text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                >
                  {editingCategory ? 'Enregistrer les Modifications' : 'Créer la Catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Supprimer la catégorie « {categoryToDelete.name} » ?
              </h3>
              <p className="text-xs text-slate-500">
                Cette action supprimera cette catégorie de la liste.
                {(stats.catMap[categoryToDelete.name]?.count || 0) > 0 && (
                  <span className="block text-amber-700 font-semibold mt-1">
                    Attention : {stats.catMap[categoryToDelete.name].count} produit(s) sont actuellement assignés à cette catégorie.
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Confirmer la Suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
