import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { UserRecord, Role, UserStatus, PaginationState } from '@/types';
import { getUsers, addUser, updateUser } from '@/services/adminService';
import { DataTable, DataTableColumn, DataTableState } from '@/components/ui/DataTable';
import { Dialog, DialogFooter } from '@/components/ui/Dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { Search, MoreHorizontal, UserPlus, Loader2 } from 'lucide-react';

// ── Table columns ─────────────────────────────────────────────────────────────

const getUserColumns = (): DataTableColumn<UserRecord>[] => [
  {
    key: 'email',
    header: 'Email',
    render: (row) => (
      <div>
        <p className="text-sm font-medium text-foreground">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.email}</p>
      </div>
    ),
    mobileTitle: true,
  },
  {
    key: 'role',
    header: 'Role',
    render: (row) => (
      <Badge variant="secondary" className="capitalize">{row.role}</Badge>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'last_login',
    header: 'Last Login',
    align: 'right',
    render: (row) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {row.last_login ? new Date(row.last_login).toLocaleString() : '—'}
      </span>
    ),
    mobileHidden: true,
  },
];

// ── User form ─────────────────────────────────────────────────────────────────

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface UserFormData {
  name: string;
  email: string;
  role: Role;
}

interface UserFormErrors {
  name?: string;
  email?: string;
}

function validateUserForm(data: UserFormData): UserFormErrors {
  const errors: UserFormErrors = {};
  if (!data.name.trim()) errors.name = 'Name is required.';
  if (!data.email.trim()) errors.email = 'Email is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email address.';
  return errors;
}

// ── Module ────────────────────────────────────────────────────────────────────

interface UsersModuleProps {
  currentUserId: string;
}

export const UsersModule: React.FC<UsersModuleProps> = ({ currentUserId }) => {
  const [data, setData] = useState<UserRecord[]>([]);
  const [tableState, setTableState] = useState<DataTableState>('loading');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, pageSize: 25, total: 0 });
  const [filter, setFilter] = useState('');
  const filterTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [confirmUser, setConfirmUser] = useState<{ user: UserRecord; action: 'status' | 'role'; newVal: string } | null>(null);

  // Form state (Add)
  const [addForm, setAddForm] = useState<UserFormData>({ name: '', email: '', role: 'analyst' });
  const [addFormErrors, setAddFormErrors] = useState<UserFormErrors>({});
  const [addFormState, setAddFormState] = useState<FormState>('idle');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Form state (Edit)
  const [editForm, setEditForm] = useState<UserFormData>({ name: '', email: '', role: 'analyst' });
  const [editFormState, setEditFormState] = useState<FormState>('idle');
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Row action menu open state
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);

  const loadUsers = useCallback(async (page: number, f: string) => {
    setTableState('loading');
    try {
      const { data: d, pagination: p } = await getUsers(page, pagination.pageSize, f || undefined);
      setData(d);
      setPagination(p);
      setTableState(d.length === 0 ? (f ? 'no-results' : 'empty') : 'loaded');
    } catch {
      setTableState('error');
    }
  }, [pagination.pageSize]);

  useEffect(() => { loadUsers(1, ''); }, []);

  const handleFilter = (val: string) => {
    setFilter(val);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => loadUsers(1, val), 300);
  };

  // ── Add User ────────────────────────────────────────────────────────────────

  const handleAddSubmit = async () => {
    const errors = validateUserForm(addForm);
    if (Object.keys(errors).length > 0) { setAddFormErrors(errors); return; }
    setAddFormState('submitting');
    setAddFormError(null);
    try {
      await addUser(addForm);
      setAddFormState('success');
      setAddOpen(false);
      setAddForm({ name: '', email: '', role: 'analyst' });
      setAddFormErrors({});
      loadUsers(1, filter);
    } catch (err) {
      setAddFormState('error');
      setAddFormError(err instanceof Error ? err.message : 'Could not add user. Please try again.');
    }
  };

  // ── Edit / Role / Status change ──────────────────────────────────────────────

  const handleEditOpen = (user: UserRecord) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setEditFormState('idle');
    setEditFormError(null);
  };

  const handleEditSubmit = async () => {
    if (!editUser) return;

    // If role change affects current user, go through confirmation
    const roleChanged = editForm.role !== editUser.role;
    if (roleChanged && editUser.id === currentUserId) {
      setConfirmUser({ user: editUser, action: 'role', newVal: editForm.role });
      return;
    }

    setEditFormState('submitting');
    try {
      await updateUser(editUser.id, { name: editForm.name, role: editForm.role });
      setEditFormState('success');
      setEditUser(null);
      loadUsers(pagination.page, filter);
    } catch (err) {
      setEditFormState('error');
      setEditFormError(err instanceof Error ? err.message : 'Could not save changes.');
    }
  };

  const handleStatusChange = (user: UserRecord) => {
    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    // Any status change that could revoke access goes through confirmation
    setConfirmUser({ user, action: 'status', newVal: newStatus });
    setOpenRowMenu(null);
  };

  const handleConfirmAction = async () => {
    if (!confirmUser) return;
    try {
      if (confirmUser.action === 'status') {
        await updateUser(confirmUser.user.id, { status: confirmUser.newVal as UserStatus });
      } else {
        await updateUser(confirmUser.user.id, { role: confirmUser.newVal as Role });
        setEditUser(null);
      }
      setConfirmUser(null);
      loadUsers(pagination.page, filter);
    } catch {
      setConfirmUser(null);
    }
  };

  // ── Row action menu ──────────────────────────────────────────────────────────

  const renderRowActions = (user: UserRecord) => (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        id={`row-menu-${user.id}`}
        aria-label={`Actions for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={openRowMenu === user.id}
        onClick={(e) => { e.stopPropagation(); setOpenRowMenu(openRowMenu === user.id ? null : user.id); }}
        className="h-8 w-8"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
      {openRowMenu === user.id && (
        <div
          role="menu"
          aria-labelledby={`row-menu-${user.id}`}
          className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-card shadow-md ring-1 ring-border overflow-hidden z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { handleEditOpen(user); setOpenRowMenu(null); }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            Edit user
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => handleStatusChange(user)}
            className={cn(
              'w-full text-left px-3 py-2 text-sm transition-colors',
              user.status === 'active'
                ? 'hover:bg-destructive/10 text-destructive'
                : user.status === 'pending'
                ? 'hover:bg-success/10 text-success'
                : 'hover:bg-muted'
            )}
          >
            {user.status === 'active' ? 'Deactivate' : user.status === 'pending' ? 'Approve Account' : 'Activate'}
          </button>
        </div>
      )}
    </div>
  );

  const columns = getUserColumns();

  return (
    <div className="space-y-6" onClick={() => setOpenRowMenu(null)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage user accounts and roles</p>
        </div>
        <Button
          id="add-user-btn"
          variant="default"
          onClick={() => { setAddOpen(true); setAddFormState('idle'); setAddFormErrors({}); setAddFormError(null); }}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add User
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        state={tableState}
        rowKey={(r) => r.id}
        rowActions={renderRowActions}
        onRetry={() => loadUsers(pagination.page, filter)}
        onClearFilters={() => { setFilter(''); loadUsers(1, ''); }}
        caption="User list"
        pagination={pagination}
        onPageChange={(p) => { setPagination((prev) => ({ ...prev, page: p })); loadUsers(p, filter); }}
        emptyTitle="No users yet"
        emptyDescription="Add the first user with the button above."
        toolbar={
          <Input
            id="users-filter"
            placeholder="Search by email or name…"
            value={filter}
            onChange={(e) => handleFilter(e.target.value)}
            leadingIcon={<Search className="h-4 w-4" />}
            className="max-w-xs"
          />
        }
      />

      {/* ── Add User Dialog ───────────────────────────────────────────────── */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add User"
        description="The new user will receive an invitation to sign in."
        size="md"
        triggerId="add-user-btn"
      >
        <div className="space-y-4">
          {addFormError && (
            <Alert variant="destructive" title="Could not add user">
              <p className="text-sm">{addFormError}</p>
            </Alert>
          )}
          <div>
            <label htmlFor="add-name" className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
            <Input
              id="add-name"
              value={addForm.name}
              onChange={(e) => { setAddForm((f) => ({ ...f, name: e.target.value })); setAddFormErrors((err) => ({ ...err, name: undefined })); }}
              aria-invalid={!!addFormErrors.name}
              aria-describedby={addFormErrors.name ? 'add-name-error' : undefined}
              placeholder="Full name"
            />
            {addFormErrors.name && (
              <p id="add-name-error" className="text-xs text-destructive mt-1">{addFormErrors.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="add-email" className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
            <Input
              id="add-email"
              type="email"
              value={addForm.email}
              onChange={(e) => { setAddForm((f) => ({ ...f, email: e.target.value })); setAddFormErrors((err) => ({ ...err, email: undefined })); }}
              aria-invalid={!!addFormErrors.email}
              aria-describedby={addFormErrors.email ? 'add-email-error' : undefined}
              placeholder="user@company.com"
            />
            {addFormErrors.email && (
              <p id="add-email-error" className="text-xs text-destructive mt-1">{addFormErrors.email}</p>
            )}
          </div>
          <div>
            <Select
              id="add-role"
              label="Role"
              value={addForm.role}
              onChange={(v) => setAddForm((f) => ({ ...f, role: v as Role }))}
              options={[
                { value: 'analyst', label: 'Analyst' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addFormState === 'submitting'}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleAddSubmit}
            disabled={addFormState === 'submitting'}
            className="gap-2"
          >
            {addFormState === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Add User
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ── Edit User Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={!!editUser}
        onClose={() => setEditUser(null)}
        title="Edit User"
        size="md"
      >
        {editUser && (
          <>
            <div className="space-y-4">
              {editFormError && (
                <Alert variant="destructive" title="Could not save changes">
                  <p className="text-sm">{editFormError}</p>
                </Alert>
              )}
              <div>
                <label htmlFor="edit-name" className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label htmlFor="edit-email" className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
                <Input
                  id="edit-email"
                  value={editForm.email}
                  disabled
                  className="cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed after account creation.</p>
              </div>
              <Select
                id="edit-role"
                label="Role"
                value={editForm.role}
                onChange={(v) => setEditForm((f) => ({ ...f, role: v as Role }))}
                options={[
                  { value: 'analyst', label: 'Analyst' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditUser(null)} disabled={editFormState === 'submitting'}>Cancel</Button>
              <Button
                variant="default"
                onClick={handleEditSubmit}
                disabled={editFormState === 'submitting'}
                className="gap-2"
              >
                {editFormState === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Save changes
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* ── Confirmation dialog ───────────────────────────────────────────── */}
      <Dialog
        open={!!confirmUser}
        onClose={() => setConfirmUser(null)}
        title={confirmUser?.action === 'status' ? 'Change User Status' : 'Change Role'}
        size="md"
      >
        {confirmUser && (
          <>
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                {confirmUser.action === 'status'
                  ? `This will ${confirmUser.newVal === 'inactive' ? 'deactivate' : 'activate'} `
                  : `This will change the role of `}
                <strong>{confirmUser.user.name}</strong>
                {confirmUser.action === 'status'
                  ? `. ${
                      confirmUser.newVal === 'inactive' 
                        ? 'They will no longer be able to access Reacher.' 
                        : confirmUser.user.status === 'pending' 
                          ? 'They will now be able to access Reacher.' 
                          : 'They will be able to sign in again.'
                    }`
                  : ` to <strong>${confirmUser.newVal}</strong>. This affects their access level.`}
              </p>
              {confirmUser.action === 'status' && confirmUser.newVal === 'inactive' && (
                <Alert variant="destructive" title="Access will be revoked">
                  <p className="text-sm">This user will immediately lose access to Reacher.</p>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmUser(null)}>Cancel</Button>
              <Button
                variant={confirmUser.action === 'status' && confirmUser.newVal === 'inactive' ? 'destructive' : 'default'}
                onClick={handleConfirmAction}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
};
