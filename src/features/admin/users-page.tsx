import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, UserCog, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { useAuth } from '@/app/providers/auth-provider';
import { getApiErrorMessage } from '@/api/client';
import { fetchUsers, createUser, updateUser, deleteUser } from '@/api/users';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageSkeleton } from '@/components/feedback/skeleton';
import { PermissionGate } from '@/components/shell/permission-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import type { User, UserCreateInput, UserUpdateInput } from '@/api/types';
import { formatDate, titleCase } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';

const inputClassName =
  'w-full rounded-2xl border border-[color:var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-amber-100';
const labelClassName = 'text-sm font-semibold text-[var(--surface-ink)]';
const errorClassName = 'text-xs text-orange-600';

const ROLES = ['admin', 'project_manager', 'engineer', 'accountant', 'contractor', 'viewer'] as const;

const roleToneMap: Record<string, 'accent' | 'info' | 'success' | 'warning' | 'neutral'> = {
  admin: 'accent',
  project_manager: 'info',
  engineer: 'success',
  accountant: 'warning',
  contractor: 'neutral',
  viewer: 'neutral',
};

const strongPasswordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Include 1 uppercase letter')
  .regex(/\d/, 'Include 1 number')
  .regex(/[^A-Za-z0-9]/, 'Include 1 special character');

const createSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: strongPasswordSchema,
  phone: z.string().optional(),
  role: z.enum(ROLES),
  is_active: z.boolean(),
});

const updateSchema = createSchema.omit({ password: true }).extend({
  password: strongPasswordSchema.optional().or(z.literal('')),
});

export default function UsersPage() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(accessToken ?? ''),
    enabled: Boolean(accessToken),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const filtered = useMemo(() => {
    let result = users;
    if (roleFilter) result = result.filter((u) => u.role === roleFilter);
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name.toLowerCase().includes(lower) ||
          u.email.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [users, roleFilter, search]);

  const metrics = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === 'admin').length,
    roles: new Set(users.map((u) => u.role)).size,
  }), [users]);

  /* ── Create form ── */
  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: '', email: '', password: '', phone: '', role: 'viewer', is_active: true },
  });

  const createMutation = useMutation({
    mutationFn: (data: UserCreateInput) => createUser(accessToken ?? '', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setServerMessage('User created.');
      setShowCreate(false);
      createForm.reset();
    },
  });

  /* ── Update form ── */
  const updateForm = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
  });

  const openEdit = (u: User) => {
    setEditUser(u);
    setServerMessage(null);
    updateForm.reset({ full_name: u.full_name, email: u.email, phone: u.phone ?? '', role: u.role as typeof ROLES[number], is_active: u.is_active, password: '' });
  };

  const updateMutation = useMutation({
    mutationFn: (data: UserUpdateInput) => updateUser(accessToken ?? '', editUser!.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setServerMessage('User updated.');
      setEditUser(null);
    },
  });

  /* ── Delete ── */
  const deleteMutation = useMutation({
    mutationFn: () => deleteUser(accessToken ?? '', confirmDelete!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setServerMessage('User deleted.');
      setConfirmDelete(null);
    },
  });

  if (usersQuery.isLoading) return <PageSkeleton statCount={4} tableRows={6} tableColumns={5} />;
  if (usersQuery.error) return <ErrorState description={getApiErrorMessage(usersQuery.error)} onRetry={() => void usersQuery.refetch()} />;

  return (
    <PermissionGate roles={['admin']}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Manage team members, roles, and access."
          description="Create accounts, assign roles, and control who can access what in the ERP."
          actions={
            <Button onClick={() => { setShowCreate(true); setServerMessage(null); createForm.reset(); }}>
              <UserPlus className="size-4" /> Add user
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total users" value={String(metrics.total)} caption="In directory" icon={Users} tone="info" />
          <StatCard label="Active" value={String(metrics.active)} caption="Enabled accounts" icon={UserCog} tone="success" />
          <StatCard label="Admins" value={String(metrics.admins)} caption="Full access" icon={Shield} tone="accent" />
          <StatCard label="Roles" value={String(metrics.roles)} caption="Distinct roles used" icon={Shield} tone="info" />
        </div>

        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className={labelClassName}>Role</span>
              <select className={inputClassName} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelClassName}>Search</span>
              <input className={inputClassName} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
            </label>
          </div>
        </Card>

        {serverMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{serverMessage}</div> : null}

        <DataTable
          columns={[
            {
              id: 'Name',
              header: 'Name',
              cell: (row) => (
                <div>
                  <p className="font-semibold text-[var(--surface-ink)]">{row.full_name}</p>
                  <p className="text-xs text-[var(--surface-faint)]">{row.email}</p>
                </div>
              ),
              sortValue: (row) => row.full_name,
              exportValue: (row) => `${row.full_name} (${row.email})`,
            },
            { id: 'Role', header: 'Role', cell: (row) => <Badge tone={roleToneMap[row.role] ?? 'neutral'}>{titleCase(row.role)}</Badge>, sortValue: (row) => row.role, exportValue: (row) => titleCase(row.role) },
            { id: 'Status', header: 'Status', cell: (row) => <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Disabled'}</Badge>, sortValue: (row) => (row.is_active ? 1 : 0), exportValue: (row) => row.is_active ? 'Active' : 'Disabled' },
            { id: 'Joined', header: 'Joined', cell: (row) => formatDate(row.created_at), sortValue: (row) => row.created_at, exportValue: (row) => row.created_at },
            {
              header: 'Actions',
              cell: (row) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(row)}>Delete</Button>
                </div>
              ),
            },
          ]}
          rows={filtered}
          rowKey={(row) => row.id}
          exportFileName="m2n-users"
          stickyHeader
          defaultSortId="Name"
          defaultSortDir="asc"
          emptyState={<EmptyState title="No users found" description="Add your first team member to get started." />}
        />

        {/* ── Create Drawer ── */}
        <Drawer open={showCreate} title="Add User" description="Create a new ERP account." onClose={() => setShowCreate(false)}>
          <form
            className="space-y-4"
            onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data as UserCreateInput))}
          >
            <label className="space-y-2"><span className={labelClassName}>Full name</span><input className={inputClassName} {...createForm.register('full_name')} />{createForm.formState.errors.full_name ? <p className={errorClassName}>{createForm.formState.errors.full_name.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Email</span><input className={inputClassName} type="email" {...createForm.register('email')} />{createForm.formState.errors.email ? <p className={errorClassName}>{createForm.formState.errors.email.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Password</span><input className={inputClassName} type="password" {...createForm.register('password')} autoComplete="new-password" />{createForm.formState.errors.password ? <p className={errorClassName}>{createForm.formState.errors.password.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Phone</span><input className={inputClassName} {...createForm.register('phone')} /></label>
            <label className="space-y-2">
              <span className={labelClassName}>Role</span>
              <select className={inputClassName} {...createForm.register('role')}>
                {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3"><input type="checkbox" {...createForm.register('is_active')} className="size-4 accent-[var(--accent)]" /><span className={labelClassName}>Account active</span></label>
            {createMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(createMutation.error)}</div> : null}
            <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create user'}</Button>
          </form>
        </Drawer>

        {/* ── Edit Drawer ── */}
        <Drawer open={Boolean(editUser)} title="Edit User" description={editUser ? editUser.full_name : ''} onClose={() => setEditUser(null)}>
          <form
            className="space-y-4"
            onSubmit={updateForm.handleSubmit((data) => {
              const payload: UserUpdateInput = { ...data, phone: data.phone || undefined };
              if (!data.password) delete (payload as Record<string, unknown>).password;
              updateMutation.mutate(payload);
            })}
          >
            <label className="space-y-2"><span className={labelClassName}>Full name</span><input className={inputClassName} {...updateForm.register('full_name')} />{updateForm.formState.errors.full_name ? <p className={errorClassName}>{updateForm.formState.errors.full_name.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>Email</span><input className={inputClassName} type="email" {...updateForm.register('email')} />{updateForm.formState.errors.email ? <p className={errorClassName}>{updateForm.formState.errors.email.message}</p> : null}</label>
            <label className="space-y-2"><span className={labelClassName}>New password (leave blank to keep)</span><input className={inputClassName} type="password" {...updateForm.register('password')} autoComplete="new-password" /></label>
            <label className="space-y-2"><span className={labelClassName}>Phone</span><input className={inputClassName} {...updateForm.register('phone')} /></label>
            <label className="space-y-2">
              <span className={labelClassName}>Role</span>
              <select className={inputClassName} {...updateForm.register('role')}>
                {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-3"><input type="checkbox" {...updateForm.register('is_active')} className="size-4 accent-[var(--accent)]" /><span className={labelClassName}>Account active</span></label>
            {updateMutation.error ? <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{getApiErrorMessage(updateMutation.error)}</div> : null}
            <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving...' : 'Save changes'}</Button>
          </form>
        </Drawer>

        {/* ── Delete confirmation ── */}
        <Dialog
          open={Boolean(confirmDelete)}
          title="Delete User"
          description={`Permanently remove ${confirmDelete?.full_name ?? 'this user'}? This action cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="danger"
          loading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    </PermissionGate>
  );
}
