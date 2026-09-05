import { useRef, useState } from "react";
import {
  useCompany,
  useRemoveBranding,
  useSaveCompany,
  useUploadBranding,
  type BrandingAsset,
} from "@/features/queries";
import { Button, ErrorState, Field, Panel, PanelHeader, Spinner, Textarea } from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import type { CompanySettings } from "@/types";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function SettingsBranding() {
  const { data, isLoading, error, refetch } = useCompany();

  if (isLoading) return <Spinner label="Loading branding" />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!data) return <ErrorState error={new Error("Set up company settings first")} />;

  return <BrandingBody company={data} />;
}

function BrandingBody({ company }: { company: CompanySettings }) {
  const toast = useToast();
  const saveCompany = useSaveCompany();
  const [declaration, setDeclaration] = useState(company.declaration ?? "");

  const declarationChanged = declaration !== (company.declaration ?? "");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="type-display text-2xl text-ink">Seal &amp; signature</h1>
        <p className="mt-1 max-w-2xl text-xs text-muted">
          These print in the signature block of every quotation and invoice — the stamp goes down first and the
          signature over the top of it, the same way a document is signed by hand. Leave them empty to keep signing on
          paper.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <AssetCard
          asset="seal"
          title="Rubber stamp"
          hint="The round company seal. A scan on white paper is fine — it prints slightly transparent so a signature laid over it stays readable."
          currentUrl={company.sealUrl}
        />
        <AssetCard
          asset="signature"
          title="Authorised signature"
          hint="Sign on white paper, scan or photograph it, and crop close. A PNG with a transparent background looks best."
          currentUrl={company.signatureUrl}
        />
      </div>

      <Panel>
        <PanelHeader title="Preview" description="Roughly how the block prints at the foot of a document." />
        <div className="flex justify-center p-6">
          <div className="w-64 rounded-[4px] border border-dashed border-hairline bg-surface px-4 py-3 text-right">
            <p className="text-[10px] text-muted">For {company.tradeName ?? company.name}</p>

            <div className="relative mx-auto my-2 h-20 w-full">
              {company.sealUrl && (
                <img
                  src={company.sealUrl}
                  alt="Company seal"
                  className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 object-contain opacity-85"
                />
              )}
              {company.signatureUrl && (
                <img
                  src={company.signatureUrl}
                  alt="Authorised signature"
                  className="absolute left-1/2 top-3 h-14 w-36 -translate-x-1/2 object-contain"
                />
              )}
              {!company.sealUrl && !company.signatureUrl && (
                <span className="absolute inset-0 flex items-center justify-center text-[11px] text-faint">
                  Space to sign by hand
                </span>
              )}
            </div>

            <p className="border-t border-hairline pt-1.5 text-[10px] text-muted">Authorised Signatory</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Declaration" description="Printed just above the signature block on every invoice." />
        <div className="space-y-3 p-4">
          <Field label="Declaration text" htmlFor="declaration">
            <Textarea
              id="declaration"
              rows={3}
              value={declaration}
              onChange={(event) => setDeclaration(event.target.value)}
              placeholder="We declare that this invoice shows the actual price of the goods described…"
            />
          </Field>
          <Button
            disabled={saveCompany.isPending || !declarationChanged}
            onClick={() =>
              void (async () => {
                try {
                  await saveCompany.mutateAsync({
                    ...company,
                    declaration: declaration.trim() || null,
                  } as never);
                  toast.success("Declaration saved");
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              })()
            }
          >
            {saveCompany.isPending ? "Saving…" : "Save declaration"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function AssetCard({
  asset,
  title,
  hint,
  currentUrl,
}: {
  asset: BrandingAsset;
  title: string;
  hint: string;
  currentUrl: string | null;
}) {
  const toast = useToast();
  const upload = useUploadBranding();
  const remove = useRemoveBranding();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const send = async (file: File | undefined) => {
    if (!file) return;

    // Checked here as well as on the server, so the person is told before a
    // large upload travels.
    if (file.size > MAX_BYTES) {
      toast.error("That image is over 2 MB. Crop it, or save it smaller.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Upload a PNG, JPG or WEBP image");
      return;
    }

    try {
      await upload.mutateAsync({ asset, file });
      toast.success(`${title} uploaded`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not upload that image"));
    }
  };

  return (
    <Panel>
      <PanelHeader
        title={title}
        actions={
          currentUrl ? (
            <Button
              variant="danger"
              size="sm"
              disabled={remove.isPending}
              onClick={() =>
                void (async () => {
                  if (!window.confirm(`Remove the ${title.toLowerCase()}?`)) return;
                  try {
                    await remove.mutateAsync(asset);
                    toast.success(`${title} removed`);
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                })()
              }
            >
              Remove
            </Button>
          ) : undefined
        }
      />

      <div className="p-4">
        <p className="text-xs leading-relaxed text-muted">{hint}</p>

        <div
          className={`mt-3 flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-[4px] border-2 border-dashed p-4 transition-colors ${
            dragging ? "border-brand bg-brand-tint/40" : "border-hairline bg-ground/40"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void send(event.dataTransfer.files?.[0]);
          }}
        >
          {currentUrl ? (
            // Checkerboard behind the image, so a transparent PNG reads as transparent.
            <div
              className="rounded-[3px] p-2"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
              }}
            >
              <img src={currentUrl} alt={title} className="max-h-24 max-w-[180px] object-contain" />
            </div>
          ) : (
            <p className="text-xs text-faint">Drop an image here, or choose a file</p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              void send(event.target.files?.[0]);
              // Reset, so picking the same file again still fires a change event.
              event.target.value = "";
            }}
          />
          <Button variant="secondary" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? "Uploading…" : currentUrl ? "Replace image" : "Choose image"}
          </Button>
        </div>

        <p className="mt-2 text-[11px] text-faint">PNG, JPG or WEBP · up to 2 MB</p>
      </div>
    </Panel>
  );
}
