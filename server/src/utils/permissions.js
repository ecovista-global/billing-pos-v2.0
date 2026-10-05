const DEFAULT_EMPLOYEE_PERMISSIONS = {
  dashboard: { view: true },
  pos: { view: true, edit: true },
  exchanged_phones: { view: true, edit: true },
  inventory: { view: true, edit: true },
  accessories: { view: true, edit: true },
  stock_entry: { view: true, edit: true },
  customers: { view: true, edit: true },
  sales: { view: true },
  invoices: { view: true, edit: true },
  returns: { view: true, edit: true },
  warranty: { view: true },
  profile: { view: true, edit: true }
};

function parseUserPermissions(permissionsStr, role = 'employee') {
  if (role === 'admin') {
    // Admin has full universal permissions for view/edit, but preserve custom flags (like delete)
    let stored = {};
    try {
      stored = typeof permissionsStr === 'string' ? JSON.parse(permissionsStr) : (permissionsStr || {});
    } catch(e) {}
    
    const adminPerms = { ...stored };
    for (const k of Object.keys(DEFAULT_EMPLOYEE_PERMISSIONS)) {
      adminPerms[k] = { ...adminPerms[k], view: true, edit: true };
    }
    return adminPerms;
  }

  if (!permissionsStr) {
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
  }

  try {
    const parsed = typeof permissionsStr === 'string' ? JSON.parse(permissionsStr) : permissionsStr;
    const merged = { ...DEFAULT_EMPLOYEE_PERMISSIONS };
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'object' && val !== null) {
        merged[key] = { ...merged[key], ...val };
      }
    }
    return merged;
  } catch (e) {
    return { ...DEFAULT_EMPLOYEE_PERMISSIONS };
  }
}

module.exports = {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  parseUserPermissions
};
