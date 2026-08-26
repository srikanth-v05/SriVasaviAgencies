import { useState } from "react";
import { useSaveUser, useUsers } from "@/features/queries";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Panel,
  PanelHeader,
  Select,
  Spinner,
  TableShell,
} from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { dateTime } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "SUPER_ADMIN", label: "Super admin", description: "Everything, including users and company settings." },
  { value: "ADMIN", label: "Admin", description: "Everything, including users and company settings." },
  { value: "BILLING_USER", label: "Billing", description: "Quote, invoice and collect. Cannot change products or settings." },
  { value: "REPORT_USER", label: "Reports", description: "Read-only, plus reports, exports and the audit trail." },
];

export function SettingsUsers() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error, refetch } = useUsers();
  const create = useSaveUser();
  const toast = useToast();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "BILLING_USER" as Role });

  const canSubmit = form.name.trim().length >= 2 && form.email.includes("@") && form.password.length >= 10;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await create.mutateAsync({ ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() });
      toast.success("User created");
      setAdding(false);
      setForm({ name: "", email: "", password: "", role: "BILLING_USER" });
    } catch (err) {
      toast.error(errorMessage(err, "Could not create the user"));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">Users</h1>
          <p className="mt-1 text-xs text-muted">Roles decide what each person can see and change.</p>
        </div>
        <Button onClick={() => setAdding((open) => !open)}>{adding ? "Cancel" : "Add user"}</Button>
      </header>

      {adding && (
        <Panel>
          <PanelHeader title="New user" description="They can change their own password after the first sign-in." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Name" htmlFor="u-name" required>
              <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email" htmlFor="u-email" required>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password" htmlFor="u-pass" required hint="At least 10 characters.">
              <Input id="u-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="Role" htmlFor="u-role" hint={ROLES.find((r) => r.value === form.role)?.description}>
              <Select id="u-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="border-t border-hairline p-4">
            <Button onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Creating…" : "Create user"}
            </Button>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Everyone with access" />
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : !users || users.length === 0 ? (
          <EmptyState title="No users yet" />
        ) : (
          <TableShell
            head={
              <>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Last sign-in</th>
                <th className="px-4 py-2">Status</th>
                <th className="w-28 px-4 py-2" />
              </>
            }
          >
            {users.map((user) => (
              <UserRow key={user.id} user={user} isSelf={user.id === currentUser?.id} />
            ))}
          </TableShell>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="What each role can do" />
        <ul className="divide-y divide-hairline">
          {ROLES.map((role) => (
            <li key={role.value} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5">
              <span className="w-28 text-sm font-medium text-ink">{role.label}</span>
              <span className="flex-1 text-xs text-muted">{role.description}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
}: {
  user: { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt: string | null };
  isSelf: boolean;
}) {
  const update = useSaveUser(user.id);
  const toast = useToast();

  const change = async (patch: Record<string, unknown>, message: string) => {
    try {
      await update.mutateAsync(patch);
      toast.success(message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <tr>
      <td className="px-4 py-2.5 text-sm">
        {user.name}
        {isSelf && <span className="ml-2 text-[11px] text-muted">(you)</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-soft">{user.email}</td>
      <td className="px-4 py-2.5">
        <Select
          className="w-36"
          aria-label={`Role for ${user.name}`}
          value={user.role}
          disabled={isSelf}
          onChange={(e) => void change({ role: e.target.value }, "Role updated")}
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted">{user.lastLoginAt ? dateTime(user.lastLoginAt) : "Never"}</td>
      <td className="px-4 py-2.5 text-xs">
        {user.isActive ? <span className="text-zone-green">Active</span> : <span className="text-muted">Disabled</span>}
      </td>
      <td className="px-4 py-2.5 text-right">
        {!isSelf && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void change({ isActive: !user.isActive }, user.isActive ? "User disabled" : "User enabled")}
          >
            {user.isActive ? "Disable" : "Enable"}
          </Button>
        )}
      </td>
    </tr>
  );
}
