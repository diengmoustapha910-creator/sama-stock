import { Employee, StaffPermissions, StaffRole } from '../types';

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  proprietaire: 'Propriétaire',
  administrateur: 'Administrateur',
  gestionnaire: 'Gestionnaire',
  caissier: 'Caissier',
  vendeur: 'Vendeur',
  magasinier: 'Magasinier',
};

export const STAFF_ROLE_BADGE_CLASSES: Record<StaffRole, string> = {
  proprietaire: 'bg-[#123B67] text-white',
  administrateur: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  gestionnaire: 'bg-sky-50 text-sky-700 border border-sky-200',
  caissier: 'bg-orange-50 text-[#F58220] border border-orange-200',
  vendeur: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  magasinier: 'bg-amber-50 text-amber-700 border border-amber-200',
};

export function getDefaultPermissionsForRole(role: StaffRole): StaffPermissions {
  switch (role) {
    case 'proprietaire':
      return {
        posAccess: true,
        applyDiscount: true,
        maxDiscountPercent: 100,
        voidSale: true,
        manageCashShift: true,
        cashInOut: true,
        manageProducts: true,
        editPrices: true,
        manageStock: true,
        viewReports: true,
        viewMargins: true,
        manageCustomers: true,
        manageEmployees: true,
      };
    case 'administrateur':
      return {
        posAccess: true,
        applyDiscount: true,
        maxDiscountPercent: 50,
        voidSale: true,
        manageCashShift: true,
        cashInOut: true,
        manageProducts: true,
        editPrices: true,
        manageStock: true,
        viewReports: true,
        viewMargins: true,
        manageCustomers: true,
        manageEmployees: true,
      };
    case 'gestionnaire':
      return {
        posAccess: true,
        applyDiscount: true,
        maxDiscountPercent: 25,
        voidSale: true,
        manageCashShift: true,
        cashInOut: true,
        manageProducts: true,
        editPrices: true,
        manageStock: true,
        viewReports: true,
        viewMargins: false,
        manageCustomers: true,
        manageEmployees: false,
      };
    case 'caissier':
      return {
        posAccess: true,
        applyDiscount: true,
        maxDiscountPercent: 10,
        voidSale: false,
        manageCashShift: true,
        cashInOut: true,
        manageProducts: false,
        editPrices: false,
        manageStock: false,
        viewReports: false,
        viewMargins: false,
        manageCustomers: true,
        manageEmployees: false,
      };
    case 'vendeur':
      return {
        posAccess: true,
        applyDiscount: true,
        maxDiscountPercent: 5,
        voidSale: false,
        manageCashShift: false,
        cashInOut: false,
        manageProducts: false,
        editPrices: false,
        manageStock: false,
        viewReports: false,
        viewMargins: false,
        manageCustomers: true,
        manageEmployees: false,
      };
    case 'magasinier':
      return {
        posAccess: false,
        applyDiscount: false,
        maxDiscountPercent: 0,
        voidSale: false,
        manageCashShift: false,
        cashInOut: false,
        manageProducts: true,
        editPrices: false,
        manageStock: true,
        viewReports: false,
        viewMargins: false,
        manageCustomers: false,
        manageEmployees: false,
      };
  }
}

export function hasEmployeePermission(
  employee: Employee | null | undefined,
  perm: Exclude<keyof StaffPermissions, 'maxDiscountPercent'>
): boolean {
  if (!employee) return true; // Fallback when no operator lock is initialized
  if (employee.role === 'proprietaire') return true;
  return Boolean(employee.permissions?.[perm]);
}

export function canEmployeeAccessStore(
  employee: Employee | null | undefined,
  storeId: string
): boolean {
  if (!employee) return true;
  if (employee.role === 'proprietaire') return true;
  if (!employee.storeIds || employee.storeIds.length === 0) return true;
  return employee.storeIds.includes(storeId);
}
