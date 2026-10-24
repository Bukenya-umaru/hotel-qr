export const ALL_PERMISSIONS = ['view_sales', 'manage_menu', 'manage_tables', 'manage_stock', 'edit_business_stock', 'edit_approved_stock', 'manage_expenses', 'manage_sales', 'edit_records', 'approve_records']

export const PERMISSION_LABELS = {
  view_sales: 'View sales',
  manage_menu: 'Manage food items',
  manage_stock: 'Manage stock',
  edit_business_stock: 'Edit all stock entries until approved',
  edit_approved_stock: 'Edit stock details even after approval',
  manage_expenses: 'Manage expenses',
  manage_sales: 'Record sales',
  edit_records: 'Edit expenses & damages until approved',
  approve_records: 'Approve sales, stock & expenses',
}

export const validPermissions = value => Array.isArray(value) && value.every(perm => ALL_PERMISSIONS.includes(perm))
