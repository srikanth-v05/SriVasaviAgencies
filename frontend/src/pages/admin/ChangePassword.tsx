import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChangePassword } from "@/features/queries";
import { useAuth } from "@/hooks/useAuth";
import { Button, Field, Input, Panel, PanelHeader } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";

/**
 * Self-service password change. Every signed-in user can reach this for their
 * own account — it does not depend on the `users:manage` permission, which
 * only covers an admin resetting someone *else's* password.
 */
export function ChangePassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const mismatchError = confirmPassword.length > 0 && newPassword !== confirmPassword ? "Passwords do not match" : null;
  const tooShortError = newPassword.length > 0 && newPassword.length < 10 ? "Use at least 10 characters" : null;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 10 &&
    newPassword === confirmPassword &&
    !changePassword.isPending;

  const submit = async () => {
    setFieldError(null);
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match");
      return;
    }
    if (newPassword.length < 10) {
      setFieldError("Use at least 10 characters");
      return;
    }

    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      toast.success("Password changed. Sign in again on any other device.");
      navigate("/admin", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Could not change the password"));
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">Change password</h1>
        <p className="mt-1 text-xs text-muted">
          Signed in as {user?.email}. Changing your password signs you out everywhere else.
        </p>
      </header>

      <Panel>
        <PanelHeader title="Update your password" />
        <form
          className="space-y-4 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Current password" htmlFor="current-password" required>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="new-password"
            required
            error={tooShortError ?? undefined}
            hint={tooShortError ? undefined : "At least 10 characters."}
          >
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(tooShortError)}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>

          <Field label="Confirm new password" htmlFor="confirm-password" required error={mismatchError ?? undefined}>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(mismatchError)}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>

          {fieldError && <p className="field-error">{fieldError}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={!canSubmit}>
              {changePassword.isPending ? "Changing…" : "Change password"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
