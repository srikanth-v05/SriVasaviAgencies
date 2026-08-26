import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { usePublicProducts, useSubmitEnquiry } from "@/features/queries";
import { Field, Input, Textarea, Button } from "@/components/common/ui";
import { errorMessage } from "@/components/common/Toast";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name"),
  organisation: z.string().trim().optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{6,20}$/, "Enter a phone number we can reach you on"),
  email: z.string().email("Enter a valid email address").or(z.literal("")).optional(),
  message: z.string().trim().min(10, "List the items and quantities you need"),
});

type FormValues = z.infer<typeof schema>;

export function BulkOrder() {
  const [params] = useSearchParams();
  const productSlug = params.get("product");
  const { data: products } = usePublicProducts({ limit: 60 });
  const submitEnquiry = useSubmitEnquiry();
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Arriving from a product page pre-fills the request with that item.
  useEffect(() => {
    if (!productSlug || !products) return;
    const product = products.data.find((p) => p.slug === productSlug);
    if (product) {
      setValue("message", `${product.name} — quantity: \nDelivery location: `);
    }
  }, [productSlug, products, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const matched = productSlug ? products?.data.find((p) => p.slug === productSlug) : undefined;
      await submitEnquiry.mutateAsync({
        ...values,
        organisation: values.organisation || null,
        email: values.email || null,
        productIds: matched ? [matched.id] : [],
      });
      setSubmitted(true);
    } catch (error) {
      setFailure(errorMessage(error, "We could not send that. Please call us instead."));
    }
  });

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <div className="panel p-8">
          <span className="block h-1 w-14 bg-zone-green" aria-hidden />
          <h1 className="type-display mt-4 text-2xl text-ink">We have your list.</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Someone will call you on the number you gave, usually the same working day, with a priced quotation. If it
            is urgent, call us directly — the number is in the footer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="type-eyebrow">Bulk enquiry</p>
          <h1 className="type-display mt-3 text-3xl text-ink sm:text-4xl">
            Send the list.
            <br />
            We price it.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
            Institutional supply works better on a written list than a phone call. Tell us the items, the quantities and
            where it goes, and you get back a quotation you can put in front of a purchase committee.
          </p>

          <ol className="mt-8 space-y-4 border-l border-hairline pl-5">
            {[
              ["You send the list", "Items, quantities, delivery address, and GSTIN if you are registered."],
              ["We quote", "A priced quotation with GST shown separately, valid for 15 days."],
              ["You confirm", "We deliver against the quotation and raise a GST tax invoice for the same figures."],
            ].map(([title, detail], index) => (
              <li key={title} className="relative">
                <span className="type-data absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{detail}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-6">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Your name" htmlFor="name" required error={errors.name?.message}>
              <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </Field>

            <Field label="Organisation" htmlFor="organisation" hint="School, college, company or department.">
              <Input id="organisation" autoComplete="organization" {...register("organisation")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
                <Input id="phone" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
              </Field>
              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
              </Field>
            </div>

            <Field
              label="What do you need?"
              htmlFor="message"
              required
              error={errors.message?.message}
              hint="For example: White phenyl 200 L, dishwash 50 L, Kentucky mops 20 sets. Delivery to Villupuram campus."
            >
              <Textarea id="message" rows={6} aria-invalid={Boolean(errors.message)} {...register("message")} />
            </Field>

            {failure && <p className="field-error">{failure}</p>}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Sending…" : "Send enquiry"}
            </Button>

            <p className="text-[11px] leading-relaxed text-muted">
              We use your number only to quote for this enquiry.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
