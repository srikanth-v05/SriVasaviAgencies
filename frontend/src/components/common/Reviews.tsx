import { usePublicReviews } from "@/features/queries";
import type { Review, ReviewSource } from "@/types";

const SOURCE_LABEL: Record<ReviewSource, string> = {
  GOOGLE: "Google",
  JUSTDIAL: "JustDial",
  DIRECT: "Customer",
};

function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="14" height="14" viewBox="0 0 20 20" aria-hidden focusable="false">
          <path
            d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
            fill={star <= rating ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Customer reviews on the public website.
 *
 * Everything here comes from the database — either entered by staff from the
 * Google or JustDial listing, or imported through the Google Places API. The
 * section renders nothing at all when there are no reviews, rather than showing
 * placeholder praise.
 */
export function Reviews() {
  const { data } = usePublicReviews();

  const reviews = data?.reviews ?? [];
  const links = data?.links;
  const summary = data?.summary;
  const hasLinks = Boolean(links?.google || links?.justdial);

  if (reviews.length === 0 && !hasLinks) return null;

  return (
    <section className="border-b border-hairline bg-ground-deep">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="type-eyebrow text-gold">What customers say</p>
            <h2 className="type-display mt-3 text-2xl text-ink sm:text-3xl">Reviews</h2>
          </div>

          {summary && summary.count > 0 && (
            <div className="flex items-center gap-3 rounded-[4px] border border-hairline bg-surface px-4 py-2.5">
              <span className="type-display text-3xl text-brand">{summary.average.toFixed(1)}</span>
              <span>
                <Stars rating={Math.round(summary.average)} className="text-gold" />
                <span className="mt-0.5 block text-[11px] text-muted">
                  {summary.count} review{summary.count === 1 ? "" : "s"}
                </span>
              </span>
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <ul className="mt-8 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {reviews.slice(0, 6).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        )}

        {hasLinks && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted">Read every review on:</p>
            {links?.google && (
              <a
                href={links.google}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-[4px] border border-hairline bg-surface px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
              >
                Google Maps
              </a>
            )}
            {links?.justdial && (
              <a
                href={links.justdial}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-[4px] border border-hairline bg-surface px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
              >
                JustDial
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.reviewDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <li className="flex flex-col bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <Stars rating={review.rating} className="text-gold" />
        <span className="type-data text-[10px] uppercase tracking-wider text-muted">{SOURCE_LABEL[review.source]}</span>
      </div>

      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-ink-soft">“{review.text}”</blockquote>

      <footer className="mt-4 border-t border-hairline pt-3">
        <p className="text-sm font-medium text-ink">{review.authorName}</p>
        <p className="text-[11px] text-muted">
          {review.authorRole ? `${review.authorRole} · ` : ""}
          {date}
        </p>
        {review.sourceUrl && (
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1.5 inline-block text-[11px] text-brand hover:underline"
          >
            View on {SOURCE_LABEL[review.source]}
          </a>
        )}
      </footer>
    </li>
  );
}
