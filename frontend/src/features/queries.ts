import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { api, getAccessToken, type ApiEnvelope } from "@/api/client";
import type {
  AuditLog,
  Category,
  CompanySettings,
  Customer,
  GstRate,
  Invoice,
  Pagination,
  Payment,
  Product,
  PublicProduct,
  PublicReviews,
  Quotation,
  Review,
  Unit,
  User,
} from "@/types";

/**
 * Query hooks, one per resource. Keys are namespaced by resource so a mutation
 * can invalidate exactly the lists that its write could have changed.
 */

type Query = Record<string, string | number | boolean | undefined | null>;

export interface Page<T> {
  data: T[];
  pagination?: Pagination;
}

async function list<T>(path: string, query?: Query): Promise<Page<T>> {
  const response = await api.get<T[]>(path, query);
  return { data: response.data, pagination: response.pagination };
}

const unwrap = <T>(response: ApiEnvelope<T>) => response.data;

export const keys = {
  dashboard: ["dashboard"] as const,
  company: ["company"] as const,
  categories: ["categories"] as const,
  units: ["units"] as const,
  gstRates: ["gst-rates"] as const,
  users: ["users"] as const,
  products: (query?: Query) => ["products", query ?? {}] as const,
  product: (id: string) => ["products", id] as const,
  customers: (query?: Query) => ["customers", query ?? {}] as const,
  customer: (id: string) => ["customers", id] as const,
  customerLedger: (id: string) => ["customers", id, "ledger"] as const,
  quotations: (query?: Query) => ["quotations", query ?? {}] as const,
  quotation: (id: string) => ["quotations", id] as const,
  invoices: (query?: Query) => ["invoices", query ?? {}] as const,
  invoice: (id: string) => ["invoices", id] as const,
  payments: (query?: Query) => ["payments", query ?? {}] as const,
  reports: (name: string, query?: Query) => ["reports", name, query ?? {}] as const,
  audit: (query?: Query) => ["audit-logs", query ?? {}] as const,
  publicProducts: (query?: Query) => ["public", "products", query ?? {}] as const,
  publicProduct: (slug: string) => ["public", "products", slug] as const,
  publicCategories: ["public", "categories"] as const,
  publicCompany: ["public", "company"] as const,
  publicReviews: ["public", "reviews"] as const,
  reviews: (query?: Query) => ["reviews", query ?? {}] as const,
  reviewSyncStatus: ["reviews", "sync-status"] as const,
};

/* ---------------------------------------------------------------- dashboard */

export interface DashboardData {
  cards: Record<string, number>;
  recentInvoices: Invoice[];
  recentQuotations: Quotation[];
  recentPayments: Payment[];
  topCustomers: { customerId: string; customer: { name: string; companyName: string | null } | null; invoiceCount: number; total: number }[];
  charts: {
    monthlySales: { period: string; total: number; taxable: number; invoiceCount: number }[];
    monthlyCollections: { period: string; amount: number }[];
  };
}

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<DashboardData>("/dashboard").then(unwrap) });

/* ------------------------------------------------------------------ masters */

export const useCategories = () =>
  useQuery({ queryKey: keys.categories, queryFn: () => api.get<Category[]>("/categories").then(unwrap) });

export const useUnits = () =>
  useQuery({ queryKey: keys.units, queryFn: () => api.get<Unit[]>("/units").then(unwrap) });

export const useGstRates = () =>
  useQuery({ queryKey: keys.gstRates, queryFn: () => api.get<GstRate[]>("/gst-rates").then(unwrap) });

/* ----------------------------------------------------------------- company */

export const useCompany = () =>
  useQuery({ queryKey: keys.company, queryFn: () => api.get<CompanySettings | null>("/company").then(unwrap) });

export function useSaveCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CompanySettings>) => api.put<CompanySettings>("/company", body).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.company }),
  });
}

/* ---------------------------------------------------------------- products */

export const useProducts = (query: Query) =>
  useQuery({ queryKey: keys.products(query), queryFn: () => list<Product>("/products", query) });

export const useProduct = (id: string | undefined) =>
  useQuery({
    queryKey: keys.product(id ?? ""),
    queryFn: () => api.get<Product>(`/products/${id}`).then(unwrap),
    enabled: Boolean(id),
  });

export function useSaveProduct(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<Product>(`/products/${id}`, body) : api.post<Product>("/products", body)).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useSetProductStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Product>(`/products/${id}/status`, { isActive }).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["products"] }),
  });
}

export interface CatalogImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; name: string; message: string }[];
}

export function useImportCatalog() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (products: Record<string, unknown>[]) =>
      api.post<CatalogImportResult>("/products/import", { products }).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["products"] }),
  });
}

/* --------------------------------------------------------------- customers */

export const useCustomers = (query: Query) =>
  useQuery({ queryKey: keys.customers(query), queryFn: () => list<Customer>("/customers", query) });

export const useCustomer = (id: string | undefined) =>
  useQuery({
    queryKey: keys.customer(id ?? ""),
    queryFn: () => api.get<Customer>(`/customers/${id}`).then(unwrap),
    enabled: Boolean(id),
  });

export function useSaveCustomer(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<Customer>(`/customers/${id}`, body) : api.post<Customer>("/customers", body)).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export interface LedgerEntry {
  date: string;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  referenceId: string;
  debit: number;
  credit: number;
  balance: number;
}

export const useCustomerLedger = (id: string | undefined) =>
  useQuery({
    queryKey: keys.customerLedger(id ?? ""),
    queryFn: () =>
      api
        .get<{ customer: Customer; entries: LedgerEntry[]; closingBalance: number; outstanding: number }>(
          `/customers/${id}/ledger`,
        )
        .then(unwrap),
    enabled: Boolean(id),
  });

/* -------------------------------------------------------------- quotations */

export const useQuotations = (query: Query) =>
  useQuery({ queryKey: keys.quotations(query), queryFn: () => list<Quotation>("/quotations", query) });

export const useQuotation = (id: string | undefined) =>
  useQuery({
    queryKey: keys.quotation(id ?? ""),
    queryFn: () => api.get<Quotation>(`/quotations/${id}`).then(unwrap),
    enabled: Boolean(id),
  });

export function useSaveQuotation(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<Quotation>(`/quotations/${id}`, body) : api.post<Quotation>("/quotations", body)).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["quotations"] }),
  });
}

export function useQuotationAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "accept" | "reject" | "cancel" | "duplicate" }) =>
      api.post<Quotation>(`/quotations/${id}/${action}`).then(unwrap),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["quotations"] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useConvertQuotation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Invoice>(`/quotations/${id}/convert-to-invoice`).then(unwrap),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["quotations"] });
      void client.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useDeleteQuotation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quotations/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["quotations"] }),
  });
}

/* ---------------------------------------------------------------- invoices */

export const useInvoices = (query: Query) =>
  useQuery({ queryKey: keys.invoices(query), queryFn: () => list<Invoice>("/invoices", query) });

export const useInvoice = (id: string | undefined) =>
  useQuery({
    queryKey: keys.invoice(id ?? ""),
    queryFn: () => api.get<Invoice>(`/invoices/${id}`).then(unwrap),
    enabled: Boolean(id),
  });

export function useSaveInvoice(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<Invoice>(`/invoices/${id}`, body) : api.post<Invoice>("/invoices", body)).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useFinalizeInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, startSequence }: { id: string; startSequence?: number }) =>
      api.post<Invoice>(`/invoices/${id}/finalize`, startSequence ? { startSequence } : undefined).then(unwrap),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["invoices"] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useCancelInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Invoice>(`/invoices/${id}/cancel`, { reason }).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useUpdateInvoicePoNumber() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, poNumber }: { id: string; poNumber: string | null }) =>
      api.patch<Invoice>(`/invoices/${id}/po-number`, { poNumber }).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useDeleteInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

/* ---------------------------------------------------------------- payments */

export const usePayments = (query: Query) =>
  useQuery({ queryKey: keys.payments(query), queryFn: () => list<Payment>("/payments", query) });

export function useRecordPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Payment>("/payments", body).then(unwrap),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["payments"] });
      void client.invalidateQueries({ queryKey: ["invoices"] });
      void client.invalidateQueries({ queryKey: ["customers"] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useDeletePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["payments"] });
      void client.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

/* ----------------------------------------------------------------- reports */

export function useReport<T>(name: string, query: Query, options?: Partial<UseQueryOptions<T>>) {
  return useQuery<T>({
    queryKey: keys.reports(name, query),
    queryFn: () => api.get<T>(`/reports/${name}`, query).then(unwrap),
    ...options,
  });
}

/* ------------------------------------------------------------------- users */

export const useUsers = () =>
  useQuery({ queryKey: keys.users, queryFn: () => api.get<User[]>("/users").then(unwrap) });

export function useSaveUser(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<User>(`/users/${id}`, body) : api.post<User>("/users", body)).then(unwrap),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.users }),
  });
}

/* ------------------------------------------------------------------- audit */

export const useAuditLogs = (query: Query) =>
  useQuery({ queryKey: keys.audit(query), queryFn: () => list<AuditLog>("/audit-logs", query) });

/* ------------------------------------------------------------------ public */

export const usePublicProducts = (query: Query) =>
  useQuery({ queryKey: keys.publicProducts(query), queryFn: () => list<PublicProduct>("/public/products", query) });

export const usePublicProduct = (slug: string | undefined) =>
  useQuery({
    queryKey: keys.publicProduct(slug ?? ""),
    queryFn: () => api.get<PublicProduct>(`/public/products/${slug}`).then(unwrap),
    enabled: Boolean(slug),
  });

export const usePublicCategories = () =>
  useQuery({ queryKey: keys.publicCategories, queryFn: () => api.get<Category[]>("/public/categories").then(unwrap) });

export interface PublicCompany {
  name: string;
  tradeName: string | null;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  alternatePhone: string | null;
  email: string;
  website: string | null;
  logoUrl: string | null;
  googleMapsUrl: string | null;
  justdialUrl: string | null;
}

export const usePublicCompany = () =>
  useQuery({ queryKey: keys.publicCompany, queryFn: () => api.get<PublicCompany | null>("/public/company").then(unwrap) });

export function useSubmitEnquiry() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<{ id: string }>("/public/enquiries", body),
  });
}

/* ----------------------------------------------------------------- reviews */

export const usePublicReviews = () =>
  useQuery({
    queryKey: keys.publicReviews,
    queryFn: () => api.get<PublicReviews>("/public/reviews").then(unwrap),
  });

export const useReviews = (query: Query = {}) =>
  useQuery({
    queryKey: keys.reviews(query),
    queryFn: () => api.get<{ reviews: Review[]; total: number }>("/reviews", query).then(unwrap),
  });

function invalidateReviews(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ["reviews"] });
  void client.invalidateQueries({ queryKey: keys.publicReviews });
}

export function useSaveReview(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      (id ? api.put<Review>(`/reviews/${id}`, body) : api.post<Review>("/reviews", body)).then(unwrap),
    onSuccess: () => invalidateReviews(client),
  });
}

export function useDeleteReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reviews/${id}`),
    onSuccess: () => invalidateReviews(client),
  });
}

/** Whether this deployment has a Google Places key and place id configured. */
export const useReviewSyncStatus = () =>
  useQuery({
    queryKey: keys.reviewSyncStatus,
    queryFn: () => api.get<{ configured: boolean; missing: string[] }>("/reviews-sync/status").then(unwrap),
  });

export function useSyncGoogleReviews() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ imported: number; total: number }>("/reviews-sync/google").then(unwrap),
    onSuccess: () => invalidateReviews(client),
  });
}

/* ---------------------------------------------------------------- branding */

export type BrandingAsset = "logo" | "seal" | "signature";

/**
 * Branding images are multipart uploads, so they bypass the JSON api helper and
 * post a FormData body directly — the browser must set its own multipart
 * boundary, which means no Content-Type header of our own.
 */
export function useUploadBranding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ asset, file }: { asset: BrandingAsset; file: File }) => {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(`/api/v1/company/branding/${asset}`, {
        method: "POST",
        credentials: "include",
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {},
        body,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.status === "error") {
        throw new Error(payload?.message ?? "Upload failed");
      }
      return payload.data as CompanySettings;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.company });
      void client.invalidateQueries({ queryKey: keys.publicCompany });
    },
  });
}

export function useRemoveBranding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (asset: BrandingAsset) => api.delete<CompanySettings>(`/company/branding/${asset}`).then(unwrap),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.company });
      void client.invalidateQueries({ queryKey: keys.publicCompany });
    },
  });
}

/* -------------------------------------------------------------------- auth */

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.post<null>("/auth/change-password", body),
  });
}
