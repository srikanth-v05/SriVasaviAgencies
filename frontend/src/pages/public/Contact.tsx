import { Link } from "react-router-dom";
import { usePublicCompany } from "@/features/queries";
import { telLink, whatsappLink } from "@/lib/contact";

export function Contact() {
  const { data: company } = usePublicCompany();
  const phone = company?.phone ?? "+91 99436 77409";
  const altPhone = company?.alternatePhone ?? "+91 90928 97386";

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="max-w-2xl">
        <p className="type-eyebrow">Contact</p>
        <h1 className="type-display mt-3 text-3xl text-ink sm:text-4xl">Call, message, or walk in.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
          For a priced quotation, the fastest route is to send your list. For everything else, the phone works.
        </p>
      </header>

      <div className="mt-10 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-surface p-6">
          <p className="type-eyebrow">Phone</p>
          <a href={telLink(phone)} className="type-data mt-2 block text-lg text-brand hover:underline">
            {phone}
          </a>
          <a href={telLink(altPhone)} className="type-data mt-1 block text-lg text-brand hover:underline">
            {altPhone}
          </a>
          <p className="mt-2 text-xs text-muted">Monday to Saturday, 9.30 am to 7 pm.</p>
        </div>

        <div className="bg-surface p-6">
          <p className="type-eyebrow">WhatsApp</p>
          <a
            href={whatsappLink(phone)}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 block text-sm text-brand hover:underline"
          >
            Message us your list
          </a>
          <p className="mt-2 text-xs text-muted">Photos of an old invoice or indent work fine.</p>
        </div>

        <div className="bg-surface p-6">
          <p className="type-eyebrow">Email</p>
          {company?.email ? (
            <a href={`mailto:${company.email}`} className="mt-2 block break-all text-sm text-brand hover:underline">
              {company.email}
            </a>
          ) : (
            <p className="mt-2 text-sm text-muted">—</p>
          )}
          <p className="mt-2 text-xs text-muted">Best for purchase orders and tender documents.</p>
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="type-eyebrow">Where we are</h2>
          <address className="mt-3 text-sm not-italic leading-relaxed text-ink">
            {company ? (
              <>
                {company.name}
                <br />
                {company.addressLine1}
                <br />
                {company.addressLine2 && (
                  <>
                    {company.addressLine2}
                    <br />
                  </>
                )}
                {company.city} {company.pincode}
                <br />
                {company.state}
              </>
            ) : (
              <>
                No. 1, Villupuram Main Road
                <br />
                Sundara Murthi Vinayaga Puram, Villianur
                <br />
                Puducherry 605110
              </>
            )}
          </address>
          {company?.gstin && <p className="type-data mt-3 text-xs text-muted">GSTIN {company.gstin}</p>}
        </section>

        <section className="panel flex flex-col justify-between p-6">
          <div>
            <h2 className="type-display text-xl text-ink">Need it priced?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Send the items and quantities and we will send a quotation back the same working day.
            </p>
          </div>
          <Link
            to="/bulk-order"
            className="mt-6 inline-block self-start rounded-[3px] bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
          >
            Request a quotation
          </Link>
        </section>
      </div>
    </div>
  );
}
