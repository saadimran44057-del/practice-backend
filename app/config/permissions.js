// Every permission the app knows about.
// "key" is used in code, "label" is shown in the admin panel.
export const PERMISSIONS = [
    { key: 'dashboard.view', label: 'View dashboard numbers', group: 'Dashboard' },
  
    { key: 'users.view', label: 'View users', group: 'Users' },
    { key: 'users.block', label: 'Block and unblock users', group: 'Users' },
    { key: 'users.assignRole', label: "Change a user's role", group: 'Users' },
    { key: 'users.delete', label: 'Delete users', group: 'Users' },
    { key: 'users.edit', label: 'Edit user details and passwords', group: 'Users' },
    { key: 'users.create', label: 'Add new users', group: 'Users' },    
    { key: 'products.view', label: 'View all products', group: 'Products' },
    { key: 'products.block', label: 'Block and unblock products', group: 'Products' },
    { key: 'products.edit', label: "Edit anyone's products", group: 'Products' },
    { key: 'products.delete', label: "Delete anyone's products", group: 'Products' },
  
    { key: 'roles.manage', label: 'Create, edit and delete roles', group: 'Roles' },
  ];
  
  export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);
  
  // Roles created automatically the first time the server starts
  export const DEFAULT_ROLES = [
    {
      name: 'admin',
      description: 'Full access to everything',
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    },
    {
      name: 'manager',
      description: 'Runs daily operations for users and products',
      permissions: ['dashboard.view', 'users.view', 'users.block', 'products.view', 'products.block'],
      isSystem: false,
    },
    {
      name: 'user',
      description: 'Regular account, can only manage their own products',
      permissions: [],
      isSystem: true,
    },
  ];
  
  // The admin role always gets every permission, even ones added later
  export const isAdminRole = (role) => Boolean(role && role.isSystem && role.name === 'admin');
  
  export const permissionsForRole = (role) => {
    if (!role) return [];
    if (isAdminRole(role)) return ALL_PERMISSIONS;
    return (role.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));
  };