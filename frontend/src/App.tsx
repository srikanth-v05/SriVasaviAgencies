import { Navigate, Route, Routes } from "react-router-dom";

import { PublicLayout } from "@/layouts/PublicLayout";
import { AdminLayout } from "@/layouts/AdminLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

import { Home } from "@/pages/public/Home";
import { About } from "@/pages/public/About";
import { Products as PublicProducts } from "@/pages/public/Products";
import { ProductDetail } from "@/pages/public/ProductDetail";
import { Contact } from "@/pages/public/Contact";
import { BulkOrder } from "@/pages/public/BulkOrder";

import { Login } from "@/pages/admin/Login";
import { Dashboard } from "@/pages/admin/Dashboard";
import { Products } from "@/pages/admin/Products";
import { ProductForm } from "@/pages/admin/ProductForm";
import { Customers } from "@/pages/admin/Customers";
import { CustomerForm } from "@/pages/admin/CustomerForm";
import { CustomerDetail } from "@/pages/admin/CustomerDetail";
import { Quotations } from "@/pages/admin/Quotations";
import { QuotationForm } from "@/pages/admin/QuotationForm";
import { QuotationDetail } from "@/pages/admin/QuotationDetail";
import { Invoices } from "@/pages/admin/Invoices";
import { InvoiceForm } from "@/pages/admin/InvoiceForm";
import { InvoiceDetail } from "@/pages/admin/InvoiceDetail";
import { Payments } from "@/pages/admin/Payments";
import { ReportsSales } from "@/pages/admin/ReportsSales";
import { ReportsGst } from "@/pages/admin/ReportsGst";
import { SettingsCompany } from "@/pages/admin/SettingsCompany";
import { SettingsUsers } from "@/pages/admin/SettingsUsers";
import { SettingsReviews } from "@/pages/admin/SettingsReviews";
import { AuditLogs } from "@/pages/admin/AuditLogs";

/** Route structure follows architecture.md §25. */
export function App() {
  return (
    <Routes>
      {/* ------------------------------------------------ public website */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<PublicProducts />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/bulk-order" element={<BulkOrder />} />
      </Route>

      {/* ------------------------------------------------------ admin ERP */}
      <Route path="/admin/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Guard permission="dashboard:read" element={<Dashboard />} />} />

        <Route path="products" element={<Guard permission="products:read" element={<Products />} />} />
        <Route path="products/new" element={<Guard permission="products:write" element={<ProductForm />} />} />
        <Route path="products/:id" element={<Guard permission="products:write" element={<ProductForm />} />} />

        <Route path="customers" element={<Guard permission="customers:read" element={<Customers />} />} />
        <Route path="customers/new" element={<Guard permission="customers:write" element={<CustomerForm />} />} />
        <Route path="customers/:id" element={<Guard permission="customers:read" element={<CustomerDetail />} />} />
        <Route path="customers/:id/edit" element={<Guard permission="customers:write" element={<CustomerForm />} />} />

        <Route path="quotations" element={<Guard permission="quotations:read" element={<Quotations />} />} />
        <Route path="quotations/new" element={<Guard permission="quotations:write" element={<QuotationForm />} />} />
        <Route path="quotations/:id" element={<Guard permission="quotations:read" element={<QuotationDetail />} />} />
        <Route path="quotations/:id/edit" element={<Guard permission="quotations:write" element={<QuotationForm />} />} />

        <Route path="invoices" element={<Guard permission="invoices:read" element={<Invoices />} />} />
        <Route path="invoices/new" element={<Guard permission="invoices:write" element={<InvoiceForm />} />} />
        <Route path="invoices/:id" element={<Guard permission="invoices:read" element={<InvoiceDetail />} />} />
        <Route path="invoices/:id/edit" element={<Guard permission="invoices:write" element={<InvoiceForm />} />} />

        <Route path="payments" element={<Guard permission="payments:read" element={<Payments />} />} />

        <Route path="reports" element={<Navigate to="/admin/reports/sales" replace />} />
        <Route path="reports/sales" element={<Guard permission="reports:read" element={<ReportsSales />} />} />
        <Route path="reports/gst" element={<Guard permission="reports:read" element={<ReportsGst />} />} />

        <Route path="settings/company" element={<Guard permission="company:manage" element={<SettingsCompany />} />} />
        <Route path="settings/reviews" element={<Guard permission="company:manage" element={<SettingsReviews />} />} />
        <Route path="settings/users" element={<Guard permission="users:manage" element={<SettingsUsers />} />} />
        <Route path="audit-logs" element={<Guard permission="audit:read" element={<AuditLogs />} />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function Guard({ permission, element }: { permission: Parameters<typeof ProtectedRoute>[0]["permission"]; element: JSX.Element }) {
  return <ProtectedRoute permission={permission}>{element}</ProtectedRoute>;
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ground px-5 text-center">
      <p className="type-display text-3xl text-ink">Page not found</p>
      <p className="max-w-sm text-sm text-muted">
        That link does not lead anywhere. The catalogue is a good place to start.
      </p>
      <a href="/" className="mt-2 rounded-[3px] bg-brand px-4 py-2 text-sm text-white hover:bg-brand-deep">
        Go to the home page
      </a>
    </div>
  );
}
