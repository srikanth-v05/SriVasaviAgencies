import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button, Field, Input, Spinner } from "@/components/common/ui";
import { errorMessage } from "@/components/common/Toast";

const schema = z.object({
  email: z.string().email("Enter your email address"),
  password: z.string().min(1, "Enter your password"),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const { user, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isLoading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to={(location.state as { from?: string })?.from ?? "/admin"} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await signIn(values.email, values.password);
      navigate((location.state as { from?: string })?.from ?? "/admin", { replace: true });
    } catch (error) {
      setFailure(errorMessage(error, "Could not sign you in"));
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-ground px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="zone-strip h-1" aria-hidden />
        <div className="panel border-t-0 p-7">
          <p className="type-display text-lg text-ink">SRI VASAVI AGENCIES</p>
          <p className="type-eyebrow mt-1">Billing &amp; ERP</p>

          <h1 className="mt-6 text-sm font-semibold text-ink">Sign in to continue</h1>

          <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
            </Field>

            <Field label="Password" htmlFor="password" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </Field>

            {failure && <p className="field-error">{failure}</p>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Staff access only. Contact your administrator if you cannot get in.
        </p>
      </div>
    </div>
  );
}
