// Permissions an owner can grant to chefs. A chef with no stored
// permissions still has full access (legacy accounts / not restricted yet).
// Shared by the API and the admin dashboard so both sides agree.
export const ALL_PERMISSIONS = ['view_sales', 'manage_menu', 'manage_tables', 'manage_stock', 'manage_expenses', 'manage_sales', 'approve_records']

export const PERMISSION_LABELS = {
  view_sales: 'View sales',
  manage_menu: 'Manage menu',
  manage_tables: 'Manage tables',
  manage_stock: 'Manage stock',
  manage_expenses: 'Manage expenses',
  manage_sales: 'Record sales',
  approve_records: 'Approve sales, stock & expenses',
}
