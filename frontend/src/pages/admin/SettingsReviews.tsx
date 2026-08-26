import { useState } from "react";
import {
  useCompany,
  useDeleteReview,
  useReviewSyncStatus,
  useReviews,
  useSaveReview,
  useSyncGoogleReviews,
} from "@/features/queries";
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
  Textarea,
} from "@/components/common/ui";
import { errorMessage, useToast } from "@/components/common/Toast";
import { date, today } from "@/lib/format";
import type { Review, ReviewSource } from "@/types";

const SOURCES: { value: ReviewSource; label: string }[] = [
  { value: "GOOGLE", label: "Google" },
  { value: "JUSTDIAL", label: "JustDial" },
  { value: "DIRECT", label: "Direct / other" },
];

const BLANK = {
  source: "GOOGLE" as ReviewSource,
  authorName: "",
  authorRole: "",
  rating: "5",
  text: "",
  reviewDate: today(),
  sourceUrl: "",
};

export function SettingsReviews() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useReviews();
  const { data: company } = useCompany();
  const { data: syncStatus } = useReviewSyncStatus();

  const create = useSaveReview();
  const remove = useDeleteReview();
  const syncGoogle = useSyncGoogleReviews();

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);

  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const canSubmit = form.authorName.trim().length >= 2 && form.text.trim().length >= 5;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      await create.mutateAsync({
        source: form.source,
        authorName: form.authorName.trim(),
        authorRole: form.authorRole.trim() || null,
        rating: Number(form.rating),
        text: form.text.trim(),
        reviewDate: form.reviewDate,
        sourceUrl: form.sourceUrl.trim() || null,
      });
      toast.success("Review added");
      setForm(BLANK);
      setAdding(false);
    } catch (err) {
      toast.error(errorMessage(err, "Could not save that review"));
    }
  };

  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-display text-2xl text-ink">Reviews</h1>
          <p className="mt-1 text-xs text-muted">What appears in the reviews section of the public website.</p>
        </div>
        <Button onClick={() => setAdding((open) => !open)}>{adding ? "Cancel" : "Add a review"}</Button>
      </header>

      {/* Being straight about where reviews can and cannot come from automatically. */}
      <Panel>
        <PanelHeader title="Where reviews come from" />
        <div className="space-y-3 p-4 text-xs leading-relaxed text-ink-soft">
          <p>
            <strong className="text-ink">Google</strong> — can be imported automatically, but only through the Google
            Places API, which needs a Google Cloud API key and this shop's Place ID. Google returns its five most
            helpful reviews per place, not the full history.
          </p>
          <p>
            <strong className="text-ink">JustDial</strong> — publishes no API, and copying their pages automatically
            would break their terms. Add those by hand below, with a link back to the listing.
          </p>
          <p className="text-muted">
            Nothing on this screen is written for you. Every review shown on the website is one a real customer left.
          </p>

          <div className="rounded-[4px] border border-hairline bg-ground p-3">
            {syncStatus?.configured ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink">Google sync is configured and ready.</p>
                <Button
                  size="sm"
                  disabled={syncGoogle.isPending}
                  onClick={() =>
                    void (async () => {
                      try {
                        const result = await syncGoogle.mutateAsync();
                        toast.success(`Imported ${result.imported} review(s) from Google`);
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    })()
                  }
                >
                  {syncGoogle.isPending ? "Importing…" : "Import from Google now"}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-ink">Google sync is not switched on yet. It needs:</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {(syncStatus?.missing ?? ["a Google Places API key", "the Place ID for this shop"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">
                  Set <code className="type-data">GOOGLE_PLACES_API_KEY</code> in the server environment, and paste the
                  Place ID into Company settings. The import button appears here once both are present.
                </p>
              </>
            )}
          </div>

          {!company?.googleMapsUrl && !company?.justdialUrl && (
            <p className="text-muted">
              Tip: add your Google Maps and JustDial listing links in Company settings, and the website will show
              “Read every review on…” buttons even before any reviews are stored here.
            </p>
          )}
        </div>
      </Panel>

      {adding && (
        <Panel>
          <PanelHeader
            title="Add a review"
            description="Copy the customer's own words from the listing. Do not paraphrase or write your own."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Source" htmlFor="r-source">
              <Select id="r-source" value={form.source} onChange={(e) => set({ source: e.target.value as ReviewSource })}>
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reviewer name" htmlFor="r-author" required>
              <Input id="r-author" value={form.authorName} onChange={(e) => set({ authorName: e.target.value })} />
            </Field>
            <Field label="Their role" htmlFor="r-role" hint="Optional, e.g. Facilities Manager.">
              <Input id="r-role" value={form.authorRole} onChange={(e) => set({ authorRole: e.target.value })} />
            </Field>
            <Field label="Rating" htmlFor="r-rating">
              <Select id="r-rating" value={form.rating} onChange={(e) => set({ rating: e.target.value })}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="r-date">
              <Input id="r-date" type="date" value={form.reviewDate} onChange={(e) => set({ reviewDate: e.target.value })} />
            </Field>
            <Field label="Link to the review" htmlFor="r-url" className="sm:col-span-2 lg:col-span-3">
              <Input
                id="r-url"
                placeholder="https://…"
                value={form.sourceUrl}
                onChange={(e) => set({ sourceUrl: e.target.value })}
              />
            </Field>
            <Field label="Review text" htmlFor="r-text" required className="sm:col-span-2 lg:col-span-4">
              <Textarea id="r-text" rows={4} value={form.text} onChange={(e) => set({ text: e.target.value })} />
            </Field>
          </div>
          <div className="border-t border-hairline p-4">
            <Button onClick={submit} disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Saving…" : "Add review"}
            </Button>
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Stored reviews" description="Unpublish one to hide it from the website without deleting it." />
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="The reviews section stays hidden on the website until you add one, or link your listings."
          />
        ) : (
          <TableShell
            head={
              <>
                <th className="px-4 py-2">Reviewer</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2 text-right">Rating</th>
                <th className="px-4 py-2">Review</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Shown</th>
                <th className="w-10 px-4 py-2" />
              </>
            }
          >
            {reviews.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                onDelete={() =>
                  void (async () => {
                    if (!window.confirm(`Delete the review by ${review.authorName}?`)) return;
                    try {
                      await remove.mutateAsync(review.id);
                      toast.success("Review deleted");
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  })()
                }
              />
            ))}
          </TableShell>
        )}
      </Panel>
    </div>
  );
}

function ReviewRow({ review, onDelete }: { review: Review; onDelete: () => void }) {
  const update = useSaveReview(review.id);
  const toast = useToast();

  const togglePublished = async () => {
    try {
      await update.mutateAsync({ isPublished: !review.isPublished });
      toast.success(review.isPublished ? "Hidden from the website" : "Now showing on the website");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <tr className="align-top">
      <td className="px-4 py-2.5">
        <p className="text-sm text-ink">{review.authorName}</p>
        {review.authorRole && <p className="text-[11px] text-muted">{review.authorRole}</p>}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-soft">
        {SOURCES.find((s) => s.value === review.source)?.label}
        {review.externalId && <span className="block text-[10px] text-muted">imported</span>}
      </td>
      <td className="cell-num px-4 py-2.5 text-sm">{review.rating}★</td>
      <td className="max-w-md px-4 py-2.5 text-xs leading-relaxed text-ink-soft">{review.text}</td>
      <td className="px-4 py-2.5 text-xs text-muted">{date(review.reviewDate)}</td>
      <td className="px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={togglePublished}>
          {review.isPublished ? "Showing" : "Hidden"}
        </Button>
      </td>
      <td className="px-4 py-2.5 text-right">
        <button
          type="button"
          aria-label={`Delete review by ${review.authorName}`}
          className="rounded px-1.5 py-1 text-xs text-muted hover:text-danger"
          onClick={onDelete}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
