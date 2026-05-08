# Lab Workflow Access Control Manager - Implementation Complete

## Files Created

### 1. **public/shared/lab-workflow-access-control.html**

- Main UI with 4 tabs
- KPI summary strip
- Search with debounce and clear button
- SVG filter button
- Desktop pill tabs with mobile select fallback
- Two modals: Staff Role Assignment and Staff Permission Preview
- Full responsive design

### 2. **public/shared/js/lab-workflow-access-control.js**

- Complete module logic
- RPC-only mutations (no direct DB writes)
- Permission checks using `module:lab-workflow-access-control`
- All 4 tabs fully functional:
  - Tab 1: Staff Role Assignment
  - Tab 2: Role Action Matrix
  - Tab 3: Staff Permission Preview
  - Tab 4: Workflow Action Master

## Module Configuration

### Add to app_module_registry (Supabase)

Add the following entry to enable the module in workspace navigation:

```sql
INSERT INTO app_module_registry
(
  module_key,
  target_key,
  label,
  description,
  section_key,
  section_label,
  sort_order,
  min_nav_mode,
  route_path,
  nav_enabled,
  client_key,
  is_active
) VALUES (
  'lab-workflow-access-control',
  'lab-workflow-access-control',
  'Lab Workflow Access Control Manager',
  'Manage laboratory staff roles and workflow action permissions',
  'lims-admin',
  'LIMS Admin',
  120,
  'view',
  'public/shared/lab-workflow-access-control.html',
  true,
  'electron',
  true
);
```

### Required Supabase Objects

**Database Tables (Already deployed per requirements):**

- lab.staff_role
- lab.workflow_action_master
- lab.staff_role_map
- lab.staff_role_action_map
- hr.staff (existing)

**Database Views (Already deployed):**

- lab.v_staff_role_action_map
- lab.v_staff_workflow_actions

**RPC Functions (Already deployed):**

- lab.fn_assign_staff_role
- lab.fn_deactivate_staff_role_assignment
- lab.fn_set_staff_role_action

### Permission Setup

Add permission entry in user_permissions or user_permissions_canonical:

```sql
INSERT INTO public.user_permissions_canonical
(user_id, target, can_view, can_edit, created_at)
VALUES
('{user_uuid}', 'module:lab-workflow-access-control', true, true, now());
```

## Features Implemented

### Tab 1: Staff Role Assignment

- ✅ Staff-centric table view
- ✅ Shows active role assignments as badges
- ✅ Row click opens modal with:
  - Current active assignments table
  - Deactivate button per role
  - Assign/Reactivate form with role selector
  - Effective from/to dates
- ✅ Uses `fn_assign_staff_role` RPC (handles reactivation)
- ✅ Uses `fn_deactivate_staff_role_assignment` RPC

### Tab 2: Role Action Matrix

- ✅ Cross-join of all active roles × actions
- ✅ Shows Allowed/Not Allowed status per pair
- ✅ Toggle buttons (Allow/Disallow)
- ✅ Uses `fn_set_staff_role_action` RPC
- ✅ Updates both new and existing mappings

### Tab 3: Staff Permission Preview

- ✅ Read-only view of effective permissions
- ✅ Shows staff → role → allowed actions
- ✅ Groups by role in modal
- ✅ Reflects changes after mutations

### Tab 4: Workflow Action Master

- ✅ Read-only list of available workflow actions
- ✅ Shows action code, name, description
- ✅ Active/inactive status badges

### Common Features

- ✅ KPI strip (5 metrics)
- ✅ Search with debounce (280ms)
- ✅ Tab-specific filters
- ✅ Filter badge with active count
- ✅ Mobile-responsive layout
- ✅ Accessible modals with ARIA
- ✅ Toast notifications
- ✅ Error handling with modal banners
- ✅ Busy state on mutation buttons
- ✅ HOME button with Platform.navigate fallback

## Access Flow

1. User clicks "Lab Workflow Access Control Manager" from workspace
2. Module checks permission: `module:lab-workflow-access-control`
3. Loads all data in parallel (staff, roles, actions, mappings)
4. Builds lookup maps for quick reference
5. Renders initial tab (Staff Role Assignment)
6. User can switch tabs, search, filter
7. Modal actions call RPC functions only
8. After mutations, full data reload and UI refresh

## RPC Call Pattern

All mutations follow this pattern:

```javascript
const { data, error } = await labSupabase.rpc("fn_assign_staff_role", {
  p_staff_id: staffId,
  p_role_id: roleId,
  p_effective_from: effectiveFrom,
  p_effective_to: effectiveTo,
});

if (error) {
  showBannerError(modal, error.message);
  return;
}

// Reload and refresh UI
await loadAllData();
showToast("Success", "success");
```

## Module Constants

- **MODULE_ID**: `lab-workflow-access-control`
- **Permission target**: `module:lab-workflow-access-control`
- **HTML file**: `public/shared/lab-workflow-access-control.html`
- **JS file**: `public/shared/js/lab-workflow-access-control.js`

## Testing Checklist

- [ ] Page loads without console errors
- [ ] Permission check blocks/allows access correctly
- [ ] All data sources load (staff, roles, actions, assignments)
- [ ] KPI values calculate correctly
- [ ] Search works in all tabs with debounce
- [ ] Filters work independently per tab
- [ ] Staff Role Assignment modal opens on row click
- [ ] Assign role creates mapping via RPC
- [ ] Deactivate role calls correct RPC
- [ ] Reassigning inactive role reactivates it
- [ ] Role Action matrix shows all role × action pairs
- [ ] Allow/Disallow buttons toggle permission via RPC
- [ ] Staff Permission Preview reflects changes
- [ ] Workflow Action Master is read-only
- [ ] Mobile tabs work (select instead of pills)
- [ ] Filter panel positions correctly
- [ ] HOME button navigates back
- [ ] No direct DB writes detected
- [ ] All mutations use RPC functions
- [ ] Modal close buttons restore focus
- [ ] Toast messages appear and auto-dismiss

## Notes

- All mutations are RPC-based, no direct inserts/updates/deletes
- Module is fully responsive (desktop → mobile → tablet)
- Filter state is preserved per tab
- Search term is cleared on tab switch
- All date fields use local YYYY-MM-DD format
- Permission checks use both Supabase session and Platform.getSession fallback
