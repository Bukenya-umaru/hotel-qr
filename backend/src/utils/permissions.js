// Permissions an owner can grant to chefs. A chef with no stored
// permissions still has full access (legacy accounts / not restricted yet).
// Shared by the API and the admin dashboard so both sides agree.
export const ALL_PERMISSIONS = ['view_sales', 'manage_menu', 'manage_tables', 'manage_stock', 'manage_expenses', 'manage_sales', 'edit_records', 'approve_records']

export const PERMISSION_LABELS = {
  view_sales: 'View sales',
  manage_menu: 'Manage food items',
  manage_stock: 'Manage stock',
  manage_expenses: 'Manage expenses',
  manage_sales: 'Record sales',
  edit_records: 'Edit expenses & damages until approved',
  approve_records: 'Approve sales, stock & expenses',
}

// True only for an array of supported permission keys — used by the owner's
// and the developer's account-creation endpoints.
export const validPermissions = value => Array.isArray(value) && value.every(perm => ALL_PERMISSIONS.includes(perm))
