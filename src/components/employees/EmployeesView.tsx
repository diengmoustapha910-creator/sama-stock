import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Employee, StaffPermissions, StaffRole } from '../../types';
import {
  STAFF_ROLE_BADGE_CLASSES,
  STAFF_ROLE_LABELS,
  getDefaultPermissionsForRole,
} from '../../services/permissions';
import {
  ShieldCheck,
  UserPlus,
  Edit2,
  Trash2,
  KeyRound,
  Search,
  Building2,
  CheckCircle2,
  X,
  AlertCircle,
  ClipboardList,
  Lock,
} from 'lucide-react';

const PERMISSION_LABELS: {
  key: Exclude<keyof StaffPermissions, 'maxDiscountPercent'>;
  label: string;
  group: 'Caisse POS' | 'Catalogue & Stock' | 'Gestion & Rapports';
}[] = [
  { key: 'posAccess', label: 'Accès Caisse POS', group: 'Caisse POS' },
  { key: 'applyDiscount', label: 'Appliquer des remises', group: 'Caisse POS' },
  { key: 'voidSale', label: 'Annuler une vente / ticket', group: 'Caisse POS' },
  { key: 'manageCashShift', label: 'Ouvrir / clôturer la caisse (Z)', group: 'Caisse POS' },
  { key: 'cashInOut', label: 'Entrées / sorties d’espèces', group: 'Caisse POS' },
  { key: 'manageProducts', label: 'Gérer les produits & catégories', group: 'Catalogue & Stock' },
  { key: 'editPrices', label: 'Modifier les prix de vente/achat', group: 'Catalogue & Stock' },
  { key: 'manageStock', label: 'Mouvements, achats & inventaires', group: 'Catalogue & Stock' },
  { key: 'manageCustomers', label: 'Gérer clients & fidélité', group: 'Gestion & Rapports' },
  { key: 'viewReports', label: 'Consulter rapports & dépenses', group: 'Gestion & Rapports' },
  { key: 'viewMargins', label: 'Voir prix d’achat & marges', group: 'Gestion & Rapports' },
  { key: 'manageEmployees', label: 'Gérer équipe, rôles & audit', group: 'Gestion & Rapports' },
];

export const EmployeesView: React.FC = () => {
  const {
    employees,
    activeOperator,
    stores,
    auditLogs,
    saveEmployee,
    removeEmployee,
    openPinModal,
    hasPermission,
  } = useApp();

  const [subTab, setSubTab] = useState<'team' | 'audit'>('team');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Employee modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('+221 ');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState<StaffRole>('caissier');
  const [empPin, setEmpPin] = useState('');
  const [empStoreIds, setEmpStoreIds] = useState<string[]>([]);
  const [empPermissions, setEmpPermissions] = useState<StaffPermissions>(() =>
    getDefaultPermissionsForRole('caissier')
  );
  const [empActive, setEmpActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation modal
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Audit filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  const canManageTeam = hasPermission('manageEmployees');

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setEmpName('');
    setEmpPhone('+221 ');
    setEmpEmail('');
    setEmpRole('caissier');
    setEmpPin('');
    setEmpStoreIds([]);
    setEmpPermissions(getDefaultPermissionsForRole('caissier'));
    setEmpActive(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.name);
    setEmpPhone(emp.phone || '');
    setEmpEmail(emp.email || '');
    setEmpRole(emp.role);
    setEmpPin('');
    setEmpStoreIds(Array.isArray(emp.storeIds) ? emp.storeIds : []);
    setEmpPermissions({
      ...getDefaultPermissionsForRole(emp.role),
      ...(emp.permissions || {}),
    });
    setEmpActive(emp.active !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: StaffRole) => {
    setEmpRole(newRole);
    setEmpPermissions(getDefaultPermissionsForRole(newRole));
  };

  const toggleStoreAssignment = (storeId: string) => {
    setEmpStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const togglePermission = (key: Exclude<keyof StaffPermissions, 'maxDiscountPercent'>) => {
    setEmpPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!empName.trim()) {
      setFormError('Le nom complet de l’employé est requis.');
      return;
    }

    const cleanPin = empPin.replace(/\D/g, '');
    if (!editingEmployee && cleanPin.length < 4) {
      setFormError('Veuillez définir un code PIN numérique de 4 à 6 chiffres.');
      return;
    }
    if (cleanPin && (cleanPin.length < 4 || cleanPin.length > 6)) {
      setFormError('Le code PIN doit contenir entre 4 et 6 chiffres.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveEmployee({
        id: editingEmployee?.id,
        name: empName.trim(),
        phone: empPhone.trim(),
        email: empEmail.trim() || undefined,
        role: empRole,
        pinCode: cleanPin || undefined,
        storeIds: empStoreIds,
        permissions: empPermissions,
        active: empActive,
      });

      if (!res.success) {
        setFormError(res.error || 'Impossible d’enregistrer l’employé.');
        return;
      }

      setIsModalOpen(false);
      setFeedback({
        type: 'success',
        message: editingEmployee
          ? `Profil de ${empName.trim()} mis à jour.`
          : `${empName.trim()} ajouté à l’équipe avec succès.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    const target = employeeToDelete;
    setEmployeeToDelete(null);

    const res = await removeEmployee(target.id);
    if (res.success) {
      setFeedback({
        type: 'success',
        message: `${target.name} a été retiré de l’équipe.`,
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Suppression impossible.',
      });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const auditActions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => set.add(l.action));
    return Array.from(set);
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
      if (!q) return true;
      return (
        log.employeeName.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.storeName.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q))
      );
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Équipe, Rôles & Journal d’Audit
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Codes PIN rapides par opérateur, permissions par boutique et traçabilité complète des actions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPinModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#123B67] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#F58220]" />
            <span>Changer d’opérateur (PIN)</span>
          </button>

          {canManageTeam && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#F58220] hover:bg-[#E07315] rounded-xl shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouvel Employé</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Operator Highlight */}
      {activeOperator && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#123B67] text-white font-bold flex items-center justify-center text-sm">
              {activeOperator.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Opérateur actif : {activeOperator.name}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    STAFF_ROLE_BADGE_CLASSES[activeOperator.role]
                  }`}
                >
                  {STAFF_ROLE_LABELS[activeOperator.role]}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Remise max autorisée :{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {activeOperator.permissions?.maxDiscountPercent ?? 100}%
                </span>{' '}
                · Accès boutiques :{' '}
                <span className="font-semibold text-slate-700">
                  {activeOperator.storeIds.length === 0
                    ? 'Toutes les boutiques'
                    : `${activeOperator.storeIds.length} boutique(s)`}
                </span>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Changement d’opérateur protégé par code PIN personnel (4 à 6 chiffres)</span>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('team')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            subTab === 'team'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Équipe & Rôles ({employees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            subTab === 'audit'
              ? 'border-[#F58220] text-[#123B67]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Journal d’Audit ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: TEAM */}
      {subTab === 'team' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const isCurrent = activeOperator?.id === emp.id;
            const assignedStoreNames =
              !emp.storeIds || emp.storeIds.length === 0
                ? 'Toutes les boutiques'
                : emp.storeIds
                    .map((sid) => stores.find((s) => s.id === sid)?.name || sid)
                    .join(', ');

            const activePermsCount = PERMISSION_LABELS.filter(
              (p) => emp.permissions?.[p.key]
            ).length;

            return (
              <div
                key={emp.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition-all ${
                  isCurrent
                    ? 'border-[#F58220] shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                } ${!emp.active ? 'opacity-65' : ''}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{emp.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-[#F58220] border border-orange-200">
                            Actif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {emp.phone || emp.email || 'Aucun contact'}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                        STAFF_ROLE_BADGE_CLASSES[emp.role]
                      }`}
                    >
                      {STAFF_ROLE_LABELS[emp.role]}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{assignedStoreNames}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Permissions actives :</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activePermsCount} / {PERMISSION_LABELS.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Remise max caisse :</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {emp.permissions?.applyDiscount
                          ? `${emp.permissions?.maxDiscountPercent ?? 0}%`
                          : 'Aucune'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Code PIN :</span>
                      <span
                        className={`font-semibold ${
                          emp.pinSet !== false ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {emp.pinSet !== false ? 'Configuré (••••)' : 'Non défini'}
                      </span>
                    </div>
                  </div>
                </div>

                {canManageTeam && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        emp.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {emp.active ? 'Compte actif' : 'Suspendu'}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(emp)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#123B67] hover:bg-blue-50 rounded-lg flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                      {!isCurrent && emp.role !== 'proprietaire' && (
                        <button
                          type="button"
                          onClick={() => setEmployeeToDelete(emp)}
                          title="Supprimer cet employé"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Rechercher par opérateur, action, boutique ou description..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#123B67]"
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">Toutes les actions ({auditLogs.length})</option>
              {auditActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Opérateur</th>
                    <th className="py-3 px-4">Boutique</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Résumé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Aucune trace d’audit enregistrée pour ces critères.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.slice(0, 150).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(log.date).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{log.employeeName}</div>
                          <div className="text-[10px] text-slate-400 uppercase">{log.employeeRole}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {log.storeName || '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          <div>{log.summary}</div>
                          {log.details && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{log.details}</div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingEmployee
                  ? `Modifier Employé : ${editingEmployee.name}`
                  : 'Créer un Profil Employé & Code PIN'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="p-5 space-y-4 overflow-y-auto text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Ex: Awa Ndiaye"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="+221 77 ..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Rôle prédéfini *</label>
                  <select
                    value={empRole}
                    onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-[#123B67]"
                  >
                    {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((role) => (
                      <option key={role} value={role}>
                        {STAFF_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    {editingEmployee
                      ? 'Nouveau code PIN (laisser vide = inchangé)'
                      : 'Code PIN rapide (4-6 chiffres) *'}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={empPin}
                    onChange={(e) => setEmpPin(e.target.value.replace(/\D/g, ''))}
                    placeholder={editingEmployee ? '••••' : 'Ex: 1234'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tracking-widest focus:outline-hidden focus:border-[#123B67]"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-semibold text-slate-700">Compte opérateur actif</span>
                  <input
                    type="checkbox"
                    checked={empActive}
                    onChange={(e) => setEmpActive(e.target.checked)}
                    className="w-4 h-4 text-[#F58220] rounded"
                  />
                </div>
              </div>

              {/* Store Assignment */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Boutiques accessibles</label>
                  <span className="text-[11px] text-slate-400">
                    Aucune sélection = accès à toutes les boutiques
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stores.map((st) => {
                    const checked = empStoreIds.includes(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => toggleStoreAssignment(st.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          checked
                            ? 'bg-[#123B67] text-white border-[#123B67]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissions Grid */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Permissions granulaires</span>
                  <button
                    type="button"
                    onClick={() => setEmpPermissions(getDefaultPermissionsForRole(empRole))}
                    className="text-[11px] font-semibold text-[#123B67] hover:underline"
                  >
                    Réinitialiser selon rôle ({STAFF_ROLE_LABELS[empRole]})
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERMISSION_LABELS.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.group}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(empPermissions[item.key])}
                        onChange={() => togglePermission(item.key)}
                        className="w-4 h-4 text-[#F58220] rounded"
                      />
                    </label>
                  ))}
                </div>

                {empPermissions.applyDiscount && (
                  <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-800">Plafond remise maximale en caisse</div>
                      <div className="text-[11px] text-slate-500">
                        Pourcentage maximal autorisé sans validation supérieure
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={empPermissions.maxDiscountPercent}
                        onChange={(e) =>
                          setEmpPermissions((prev) => ({
                            ...prev,
                            maxDiscountPercent: Math.min(100, Math.max(0, Number(e.target.value))),
                          }))
                        }
                        className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-right bg-white"
                      />
                      <span className="font-bold text-slate-700">%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#F58220] hover:bg-[#E07315] disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {isSaving
                    ? 'Enregistrement...'
                    : editingEmployee
                    ? 'Mettre à jour'
                    : 'Créer le Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Supprimer {employeeToDelete.name} ?
                </h3>
                <p className="text-[11px] text-slate-500">
                  {STAFF_ROLE_LABELS[employeeToDelete.role]}
                </p>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed">
              L’opérateur ne pourra plus se connecter via son code PIN sur cet appareil. L’historique des ventes et le journal d’audit restent intacts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEmployeeToDelete(null)}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
