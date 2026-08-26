# Sri Vasavi Agencies — System Architecture

## 1. Project Overview

Sri Vasavi Agencies is a housekeeping-chemicals and housekeeping-materials supplier serving individual customers as well as bulk customers such as companies, schools, colleges, institutions, and other organizations.

The application will combine:

- Public company/product website
- Admin authentication
- Product catalog management
- Customer management
- Quotation management
- Invoice management
- Quotation-to-invoice conversion
- Payment and outstanding tracking
- GST-aware tax calculation
- GST-oriented reports and Excel exports
- PDF quotation/invoice generation
- Audit logging
- Draft/placeholder billing workflow

The system will **not** include supplier management or inventory/stock management in the first version.

---

## 2. Key Business Rules

### 2.1 Product Master Price Is a Default Only

The price stored in the product master is the default/reference selling price. It is **not a fixed billing price**.

When creating a quotation or invoice, the admin can override the product price without restriction.

Example:

```text
Product Master
-----------------------------
White Phenyl
Default Price: ₹100 / Litre
GST: 18%

Quotation / Invoice
-----------------------------
Customer A -> ₹95 / Litre
Customer B -> ₹110 / Litre
Customer C -> ₹80 / Litre
```

The system must not prevent a higher or lower price.

### 2.2 Snapshot Finalized Document Values

When a quotation or invoice is saved/finalized, the document must store its own snapshot of:

- Product name
- Product code/SKU, if used
- Unit
- Quantity
- Unit price entered for that document
- Discount
- GST rate
- Taxable amount
- CGST amount
- SGST amount
- IGST amount
- Line total

Changes to the product master later must **not modify old quotations or invoices**.

### 2.3 No Automatic Inventory

There is no stock ledger, stock deduction, stock receipt, reorder level, or inventory valuation in this version.

### 2.4 No Supplier Module

Supplier records and purchase management are intentionally excluded.

### 2.5 Customer-Centric ERP

The ERP is centered around customers, quotations, invoices, payments, GST records, and reports.

---

## 3. High-Level Architecture

```text
                                 INTERNET
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
             PUBLIC WEBSITE                    ADMIN ERP
                    |                               |
                    +---------------+---------------+
                                    |
                                    v
                              React Frontend
                                    |
                              HTTPS / REST API
                                    |
                                    v
                             Node.js Backend
                                    |
                +-------------------+-------------------+
                |                   |                   |
                v                   v                   v
          PostgreSQL DB       File Storage        PDF/Excel Engine
                |                   |                   |
                |                   |                   |
                +-------------------+-------------------+
                                    |
                                    v
                               Audit Logs
```

---

## 4. Recommended Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- Component library such as shadcn/ui

### Backend

- Node.js
- TypeScript
- NestJS recommended for modular ERP structure
- Prisma ORM
- REST API
- JWT-based authentication
- Argon2 or bcrypt password hashing
- Zod/class-validator for request validation

### Database

- PostgreSQL

### File Storage

Use object storage for:

- Company logo
- Product images if uploaded
- Generated PDF documents if persistence is required

Recommended options:

- AWS S3
- Cloudflare R2

### Document Generation

- PDF generation using a server-side library such as PDFKit or Playwright/HTML-to-PDF
- Excel generation using ExcelJS

### Deployment

Recommended production setup:

```text
Cloudflare / CDN
        |
        v
Nginx / Reverse Proxy
        |
  +-----+------+
  |            |
  v            v
React        Node.js API
                 |
                 v
             PostgreSQL
                 |
                 v
          Object Storage
```

---

## 5. Application Modules

### Public Website

- Home
- About company
- Product catalog
- Product details
- Bulk order enquiry
- Contact page
- Phone/WhatsApp links
- Basic SEO metadata

### Admin ERP

- Dashboard
- Products
- Customers
- Quotations
- Invoices
- Payments
- Reports
- GST exports
- Company settings
- User management
- Audit logs

---

## 6. Authentication and Authorization

### Authentication

Admin login using:

- Email/username
- Password
- Access token
- Refresh token
- Secure session/token rotation strategy

### Roles

The first version can support:

```text
SUPER_ADMIN
ADMIN
BILLING_USER
REPORT_USER
```

Suggested permissions:

| Permission | SUPER_ADMIN | ADMIN | BILLING_USER | REPORT_USER |
|---|---:|---:|---:|---:|
| Dashboard | Yes | Yes | Yes | Yes |
| Products | Yes | Yes | View | View |
| Customers | Yes | Yes | Yes | View |
| Quotations | Yes | Yes | Yes | View |
| Invoices | Yes | Yes | Yes | View |
| Payments | Yes | Yes | Yes | View |
| Reports | Yes | Yes | Yes | Yes |
| GST export | Yes | Yes | Yes | Yes |
| User management | Yes | Yes | No | No |
| Company settings | Yes | Yes | No | No |
| Audit logs | Yes | Yes | No | View |

---

## 7. Company Settings

Store the business information once and reuse it in documents.

### Company

- Company name
- Trade name
- Legal name, if different
- GSTIN
- PAN
- Address
- City
- State
- State code
- PIN code
- Phone
- Email
- Website
- Logo

### Banking Information

- Bank name
- Account name
- Account number
- IFSC
- Branch
- UPI ID

### Document Settings

- Quotation prefix
- Invoice prefix
- Next quotation number
- Next invoice number
- Financial year format
- Default payment terms
- Default quotation validity days
- Default invoice notes
- Terms and conditions

---

## 8. Product Management

Products are catalog/master records only.

### Product Fields

```text
id
product_code
name
category_id
description
image_url
hsn_code
default_price
default_gst_rate
unit_id
is_active
created_at
updated_at
```

### Units

Support configurable units such as:

- Litre
- ml
- Kg
- Gram
- Nos
- Piece
- Packet
- Box
- Bottle
- Can
- Set
- Custom

The unit should be stored on the document line as a snapshot.

---

## 9. Customer Management

### Customer Fields

```text
id
customer_type
name
company_name
contact_person
phone
alternate_phone
email
gstin
pan
billing_address_id
shipping_address_id
state
state_code
notes
is_active
created_at
updated_at
```

### Customer Types

- Individual
- Company
- School
- College
- Government
- Institution
- Other

### Customer Profile

Customer profile should show:

```text
Customer Details
----------------
Basic information
Billing address
Shipping address
GST information

Transaction history
-------------------
Quotations
Invoices
Payments
Outstanding balance
```

---

## 10. Quotation Module

### Quotation Workflow

```text
Draft
  |
  v
Sent
  |
  +----> Rejected
  |
  v
Accepted
  |
  v
Converted to Invoice
```

Possible statuses:

- DRAFT
- SENT
- ACCEPTED
- REJECTED
- EXPIRED
- CONVERTED
- CANCELLED

### Quotation Header

```text
quotation_number
customer_id
quotation_date
valid_until
place_of_supply
notes
terms_and_conditions
subtotal
discount_total
taxable_total
cgst_total
sgst_total
igst_total
round_off
grand_total
status
```

### Quotation Item

```text
product_id
product_name_snapshot
product_code_snapshot
unit_snapshot
quantity
unit_price
line_discount
line_taxable_value
gst_rate
cgst_rate
cgst_amount
sgst_rate
sgst_amount
igst_rate
igst_amount
line_total
```

### Price Override Rule

Quotation item price must be editable directly.

```text
Product Default Price = ₹100

Admin enters:
₹75

System accepts ₹75.
```

There must be no min/max restriction based on the product default price.

---

## 11. Invoice Module

Invoice can be created in two ways.

### Method A — Direct Invoice

```text
Customer
  |
  v
New Invoice
  |
  v
Add Products
  |
  v
Override Prices if required
  |
  v
Calculate GST
  |
  v
Finalize
```

### Method B — Quotation Conversion

```text
Quotation
    |
    v
Accepted
    |
    v
Convert to Invoice
    |
    v
Invoice Draft
    |
    v
Review / Edit
    |
    v
Finalize
```

Quotation conversion must not force the product-master price. It should copy the quotation's exact saved unit price and values.

The admin may still edit the invoice price before finalization.

### Invoice Statuses

- DRAFT
- ISSUED
- PARTIALLY_PAID
- PAID
- OVERDUE
- CANCELLED

### Invoice Fields

```text
invoice_number
customer_id
quotation_id (nullable)
invoice_date
place_of_supply
payment_terms
notes
terms_and_conditions
subtotal
discount_total
taxable_total
cgst_total
sgst_total
igst_total
round_off
grand_total
amount_paid
balance_due
status
```

---

## 12. GST Calculation Engine

GST must be calculated using the applicable place-of-supply rules and stored on the finalized document.

### Core Inputs

```text
Company State
Customer State
Place of Supply
Product GST Rate
Taxable Value
```

### Same-State Example

```text
Taxable Value = ₹10,000
GST Rate = 18%

CGST = 9% = ₹900
SGST = 9% = ₹900

Grand Total = ₹11,800
```

### Inter-State Example

```text
Taxable Value = ₹10,000
GST Rate = 18%

IGST = 18% = ₹1,800

Grand Total = ₹11,800
```

### GST Data Must Be Snapshotted

A finalized invoice must retain the GST rate and tax amounts used at the time of issuance.

If the product's default GST rate changes later, historical invoices must remain unchanged.

> Tax calculation should be implemented against the current applicable GST rules and validated before production use because tax rules and filing schemas can change.

---

## 13. Discount and Price Override Logic

Each quotation/invoice item should support:

```text
quantity
unit_price
line_discount_type
line_discount_value
gst_rate
```

Discount types:

- NONE
- PERCENTAGE
- FIXED

### Example

```text
Product default price: ₹100
Quantity: 50
Admin override price: ₹85

Gross taxable value:
50 × ₹85 = ₹4,250
```

The default product price must not be used after an explicit document-level unit price is entered.

---

## 14. Rounding

Support configurable invoice rounding:

```text
Rounding:
- None
- Nearest Rupee
- Custom accounting rule
```

Store:

```text
round_off
rounded_grand_total
```

The invoice PDF and reports must use the finalized values.

---

## 15. Payment Management

Payments are linked to invoices.

### Payment Fields

```text
id
invoice_id
payment_date
amount
payment_method
reference_number
notes
created_by
created_at
```

### Payment Methods

- Cash
- UPI
- Bank transfer
- Cheque
- Other

### Payment Status Calculation

```text
amount_paid = sum(successful payments)

balance_due = grand_total - amount_paid
```

Status examples:

```text
0 paid       -> ISSUED / OVERDUE based on date
partial paid-> PARTIALLY_PAID
fully paid   -> PAID
```

---

## 16. Draft / Placeholder / Empty Bill Workflow

The system should support legitimate incomplete documents without pretending they are finalized tax invoices.

### Recommended states

```text
DRAFT
   |
   v
READY_TO_ISSUE
   |
   v
ISSUED
```

A draft can be created with incomplete details, but the application should require mandatory fields before the document becomes an official invoice.

For compliance and auditability:

- Draft invoices are not treated as issued invoices.
- Issued invoice numbers are not silently reused.
- Cancelled invoices remain in the audit history.
- Finalized invoices should be locked except through an authorized amendment/cancellation process appropriate to the business and applicable tax rules.

---

## 17. Invoice Numbering

Recommended format:

```text
SVA/2026-27/0001
SVA/2026-27/0002
SVA/2026-27/0003
```

Quotation example:

```text
SVA/QT/2026-27/0001
```

Number generation must be server-side and transaction-safe so two users cannot receive the same number.

---

## 18. PDF Documents

### Quotation PDF

Include:

- Company logo
- Company information
- GSTIN
- Quotation number
- Date
- Customer information
- Item table
- Quantity
- Unit
- Unit price
- Discount
- Tax
- Total
- Validity
- Terms and conditions
- Bank/payment information

### Invoice PDF

Include:

- Tax invoice title
- Invoice number
- Invoice date
- Company GSTIN
- Customer GSTIN if applicable
- Customer address
- Place of supply
- HSN code
- Item description
- Quantity
- Unit
- Unit price
- Taxable value
- CGST/SGST/IGST
- Grand total
- Amount in words
- Payment details
- Terms and conditions

---

## 19. Reports

### Sales Reports

- Daily sales
- Weekly sales
- Monthly sales
- Yearly sales
- Customer-wise sales
- Product-wise sales
- GST rate-wise sales
- Invoice-wise sales

### Quotation Reports

- Draft quotations
- Sent quotations
- Accepted quotations
- Rejected quotations
- Expired quotations
- Converted quotations
- Conversion percentage

### Customer Reports

- Customer list
- Customer purchase history
- Customer-wise quotation history
- Customer-wise invoice history
- Customer-wise payment history
- Customer outstanding report

### Payment Reports

- Daily collections
- Monthly collections
- Payment method-wise report
- Outstanding report
- Overdue report
- Customer ledger

### GST Reports

- Taxable sales summary
- CGST summary
- SGST summary
- IGST summary
- B2B sales report
- B2C sales report where applicable
- HSN summary
- GST rate-wise summary
- Monthly sales register

All reports should support filters such as:

```text
Date From
Date To
Customer
Product
GST Rate
Invoice Status
Payment Status
```

---

## 20. GST Excel Export

The application should provide exportable GST-oriented Excel files.

### Suggested worksheets

```text
1. Sales Register
2. B2B Invoices
3. B2C Invoices
4. HSN Summary
5. GST Rate Summary
6. CGST Summary
7. SGST Summary
8. IGST Summary
9. Credit Notes (future)
10. Debit Notes (future)
```

### Exported Invoice Fields

Typical fields can include:

- Invoice number
- Invoice date
- Customer name
- Customer GSTIN
- Customer state
- Place of supply
- HSN
- Product description
- Quantity
- Unit
- Unit price
- Taxable value
- GST rate
- CGST
- SGST
- IGST
- Invoice total

The exact filing template should be mapped to the current official GST filing requirements at implementation time rather than assuming today's columns will remain unchanged.

---

## 21. Dashboard

Admin dashboard should display:

```text
+--------------------------------------------------+
| Today's Sales          | This Month's Sales     |
+--------------------------------------------------+
| Total Customers        | Outstanding Amount     |
+--------------------------------------------------+
| Pending Quotations     | Accepted Quotations    |
+--------------------------------------------------+
| Issued Invoices        | Overdue Invoices       |
+--------------------------------------------------+
| GST Collected          | Payments Received      |
+--------------------------------------------------+
```

Also show:

- Recent quotations
- Recent invoices
- Recent payments
- Top customers
- Monthly sales chart
- Payment collection chart

---

## 22. Database Design

### Core Tables

```text
users
roles
permissions
user_roles

company_settings

categories
units
products

gst_rates

customers
customer_addresses

quotations
quotation_items

invoices
invoice_items

payments

document_sequences

audit_logs
```

### Important Relationships

```text
customers 1 ---- N quotations
customers 1 ---- N invoices

quotations 1 ---- N quotation_items

invoices 1 ---- N invoice_items

quotations 1 ---- 0..1 invoices

invoices 1 ---- N payments

products 1 ---- N quotation_items
products 1 ---- N invoice_items
```

The relationship from invoice to quotation should be optional because an invoice can also be created directly.

---

## 23. Suggested ER Diagram

```text
                    +------------------+
                    |      users       |
                    +--------+---------+
                             |
                             | created_by
                             |
                 +-----------+-----------+
                 |                       |
                 v                       v
        +------------------+    +------------------+
        |   quotations     |    |     invoices     |
        +--------+---------+    +--------+---------+
                 |                       |
                 | 1:N                   | 1:N
                 v                       v
        +------------------+    +------------------+
        | quotation_items  |    |  invoice_items   |
        +--------+---------+    +--------+---------+
                 |                       |
                 | N:1                   | N:1
                 +-----------+-----------+
                             |
                             v
                       +-----------+
                       | products  |
                       +-----------+

        +------------------+
        |    customers     |
        +----+---------+---+
             |         |
           1:N         1:N
             |         |
             v         v
       quotations    invoices
                         |
                         | 1:N
                         v
                    +----------+
                    | payments |
                    +----------+

       company_settings
             |
             +----> quotations / invoices
```

---

## 24. REST API Structure

Base URL:

```text
/api/v1
```

### Authentication

```text
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password
```

### Company

```text
GET    /company
PUT    /company
POST   /company/logo
```

### Products

```text
GET    /products
POST   /products
GET    /products/:id
PUT    /products/:id
DELETE /products/:id
PATCH  /products/:id/status
```

### Customers

```text
GET    /customers
POST   /customers
GET    /customers/:id
PUT    /customers/:id
DELETE /customers/:id
GET    /customers/:id/quotations
GET    /customers/:id/invoices
GET    /customers/:id/payments
GET    /customers/:id/ledger
```

### Quotations

```text
GET    /quotations
POST   /quotations
GET    /quotations/:id
PUT    /quotations/:id
DELETE /quotations/:id
POST   /quotations/:id/send
POST   /quotations/:id/accept
POST   /quotations/:id/reject
POST   /quotations/:id/duplicate
POST   /quotations/:id/convert-to-invoice
GET    /quotations/:id/pdf
```

### Invoices

```text
GET    /invoices
POST   /invoices
GET    /invoices/:id
PUT    /invoices/:id
POST   /invoices/:id/finalize
POST   /invoices/:id/cancel
GET    /invoices/:id/pdf
GET    /invoices/:id/payments
```

### Payments

```text
GET    /payments
POST   /payments
GET    /payments/:id
PUT    /payments/:id
DELETE /payments/:id
```

### Reports

```text
GET /reports/sales
GET /reports/quotations
GET /reports/customers
GET /reports/payments
GET /reports/outstanding
GET /reports/gst
GET /reports/hsn
```

### Exports

```text
GET /exports/sales.xlsx
GET /exports/gst.xlsx
GET /exports/hsn.xlsx
GET /exports/customer-ledger.xlsx
```

---

## 25. Frontend Route Structure

### Public

```text
/
/about
/products
/products/:slug
/contact
/bulk-order
```

### Admin

```text
/admin/login
/admin
/admin/products
/admin/products/new
/admin/products/:id
/admin/customers
/admin/customers/new
/admin/customers/:id
/admin/quotations
/admin/quotations/new
/admin/quotations/:id
/admin/invoices
/admin/invoices/new
/admin/invoices/:id
/admin/payments
/admin/reports
/admin/reports/sales
/admin/reports/gst
/admin/settings/company
/admin/settings/users
/admin/audit-logs
```

---

## 26. Recommended Backend Folder Structure

```text
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   ├── strategies/
│   │   └── dto/
│   │
│   ├── users/
│   ├── company/
│   ├── products/
│   ├── categories/
│   ├── units/
│   ├── customers/
│   ├── quotations/
│   ├── invoices/
│   ├── payments/
│   ├── gst/
│   ├── reports/
│   ├── exports/
│   ├── pdf/
│   ├── audit/
│   │
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── middleware/
│   │   └── utils/
│   │
│   └── prisma/
│       └── prisma.service.ts
│
├── prisma/
│   └── schema.prisma
│
├── test/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 27. Recommended Frontend Folder Structure

```text
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── public/
│   │   └── admin/
│   │
│   ├── components/
│   │   ├── common/
│   │   ├── forms/
│   │   ├── tables/
│   │   ├── quotation/
│   │   ├── invoice/
│   │   └── dashboard/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── products/
│   │   ├── customers/
│   │   ├── quotations/
│   │   ├── invoices/
│   │   ├── payments/
│   │   └── reports/
│   │
│   ├── hooks/
│   ├── services/
│   ├── api/
│   ├── types/
│   ├── utils/
│   ├── routes/
│   └── layouts/
│
├── public/
└── package.json
```

---

## 28. Important Transaction Rules

Financial documents must use database transactions.

### Invoice Finalization

```text
BEGIN TRANSACTION

1. Validate customer
2. Validate invoice items
3. Calculate totals
4. Calculate GST
5. Allocate invoice number
6. Save invoice
7. Save invoice items
8. Save audit event

COMMIT
```

If any step fails, rollback all changes.

### Quotation Conversion

```text
BEGIN TRANSACTION

1. Verify quotation exists
2. Verify quotation is convertible
3. Copy customer reference
4. Copy quotation item snapshots
5. Copy exact quoted unit prices
6. Allocate invoice number if required
7. Create invoice draft
8. Mark quotation as CONVERTED
9. Save audit event

COMMIT
```

---

## 29. Audit Logging

Every important action should be recorded.

### Audit Events

```text
LOGIN
LOGOUT
CREATE_CUSTOMER
UPDATE_CUSTOMER
CREATE_PRODUCT
UPDATE_PRODUCT
CREATE_QUOTATION
UPDATE_QUOTATION
ACCEPT_QUOTATION
CONVERT_QUOTATION
CREATE_INVOICE
UPDATE_INVOICE
FINALIZE_INVOICE
CANCEL_INVOICE
CREATE_PAYMENT
UPDATE_PAYMENT
EXPORT_REPORT
UPDATE_COMPANY_SETTINGS
```

Audit record should contain:

```text
user_id
action
entity_type
entity_id
old_values
new_values
ip_address
user_agent
created_at
```

This is especially important because invoice pricing can be manually overridden.

---

## 30. Price Override Audit Rule

Because the admin can enter any document price, the system should record:

```text
Product master price
Original document default price
Final entered unit price
User who changed it
When it was changed
```

Example audit event:

```text
Product: White Phenyl
Master Price: ₹100
Invoice Price: ₹82
Changed By: Admin
Changed At: 2026-08-25 20:20
```

There should be **no automatic warning or rejection based on the price being above or below the master price**, unless a future business policy is explicitly added.

---

## 31. Security Requirements

### Authentication

- Hash passwords with Argon2 or bcrypt
- Never store plaintext passwords
- Short-lived access tokens
- Secure refresh-token handling
- Logout/revocation support

### API Security

- HTTPS only in production
- Input validation
- Rate limiting for login
- Role-based authorization
- CORS allowlist
- Helmet/security headers
- Request size limits
- SQL injection protection via ORM/parameterized queries

### Document Security

- Only authorized users can access invoice PDFs
- Validate ownership/permissions before file download
- Do not expose storage bucket as a writable public endpoint

### Audit

Financial modifications must be auditable.

---

## 32. Backup and Recovery

Recommended production policy:

- Automated daily PostgreSQL backups
- Point-in-time recovery if supported by hosting
- Object storage versioning for documents
- Separate backup credentials
- Periodic restore testing

---

## 33. Development Environments

Use separate configurations:

```text
.env.development
.env.test
.env.production
```

Example variables:

```text
DATABASE_URL=
JWT_SECRET=
REFRESH_TOKEN_SECRET=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
```

Never commit real secrets to Git.

---

## 34. Testing Strategy

### Unit Tests

Test:

- GST calculation
- CGST/SGST/IGST selection
- Discount calculation
- Price override
- Invoice total calculation
- Payment balance calculation
- Number generation
- Rounding

### Integration Tests

Test:

- Login
- Product CRUD
- Customer CRUD
- Quotation creation
- Quotation conversion
- Invoice creation
- Invoice finalization
- Payment creation
- Reports
- Excel exports

### Important Price Override Test Cases

```text
1. Default price = 100, entered price = 100
2. Default price = 100, entered price = 80
3. Default price = 100, entered price = 120
4. Default price = 100, entered price = 0 if business permits free/zero billing
5. Multiple items with different overridden prices
6. Quotation price override converted to invoice
7. Invoice price changed after quotation conversion but before finalization
8. Product master price changed after invoice finalization
9. Historical invoice remains unchanged
```

Zero-value billing should be enabled or restricted according to the business's real invoicing rules; the application should not silently assume it is valid.

### End-to-End Tests

Test the complete flow:

```text
Admin Login
    -> Create Customer
    -> Create Product
    -> Create Quotation
    -> Override Price
    -> Generate Quotation PDF
    -> Accept Quotation
    -> Convert to Invoice
    -> Override Invoice Price if needed
    -> Finalize Invoice
    -> Record Payment
    -> Generate Report
    -> Export GST Excel
```

---

## 35. Operational Rules for Finalized Invoices

Once an invoice is finalized:

- Do not directly overwrite historical totals.
- Record cancellation/amendment events where appropriate.
- Preserve the original invoice PDF/data snapshot.
- Ensure all financial changes are auditable.
- Maintain sequential document numbering according to the configured business process.

---

## 36. Future Extensions

These are intentionally outside the first version but can be added later:

- WhatsApp document sending
- Email invoice delivery
- E-invoice integration where applicable
- E-way bill integration where applicable
- Credit notes
- Debit notes
- Delivery challans
- Recurring invoices
- Multiple branches
- Multiple companies
- Multiple GST registrations
- Sales staff management
- Customer-specific price lists
- Customer-specific discounts
- Purchase/supplier module
- Inventory module
- Barcode/QR support
- Online payments
- Mobile application

---

## 37. Recommended Development Phases

### Phase 1 — Foundation

- Repository setup
- React setup
- Node.js/NestJS setup
- PostgreSQL
- Prisma
- Authentication
- Role-based permissions
- Company settings

### Phase 2 — Masters

- Product categories
- Units
- Products
- Customers

### Phase 3 — Quotation

- Quotation creation
- Free price override
- Discount
- GST calculation
- PDF quotation
- Quotation status workflow

### Phase 4 — Invoice

- Direct invoice creation
- Quotation-to-invoice conversion
- Free invoice price override
- GST calculation
- PDF invoice
- Invoice numbering
- Finalization/cancellation

### Phase 5 — Payments

- Payment entry
- Customer outstanding
- Customer ledger
- Payment reports

### Phase 6 — Reports & GST Export

- Sales reports
- Customer reports
- Quotation reports
- Payment reports
- GST reports
- Excel exports

### Phase 7 — Hardening

- Audit logs
- Security testing
- Backup strategy
- Performance testing
- Production deployment
- Monitoring

---

## 38. Final Business Workflow

```text
                         PUBLIC WEBSITE
                              |
                    Product Browsing / Enquiry
                              |
                              v
                         ADMIN LOGIN
                              |
         +--------------------+--------------------+
         |                    |                    |
         v                    v                    v
      Products            Customers           Dashboard
         |                    |
         +----------+---------+
                    |
                    v
                QUOTATION
                    |
          +---------+---------+
          |                   |
       Rejected            Accepted
                              |
                              v
                         CONVERT TO
                           INVOICE
                              |
                     +--------+--------+
                     |                 |
                 Override Price    Keep Price
                     |                 |
                     +--------+--------+
                              |
                              v
                       FINALIZE INVOICE
                              |
                              v
                          PAYMENT
                              |
                              v
                    CUSTOMER OUTSTANDING
                              |
                              v
                        REPORTS / GST
                              |
                              v
                         EXCEL / PDF
```

---

## 39. Final Scope Summary

### Included

- Public product website
- Admin login
- Product management
- Customer management
- Company/GST settings
- Quotations
- Unlimited manual price override on documents
- Quotation-to-invoice conversion
- Direct invoices
- GST calculation
- Payments
- Customer outstanding/ledger
- PDF quotations
- PDF invoices
- Reports
- GST-oriented Excel exports
- Draft invoice workflow
- Audit logs
- Role-based access
- Backup/security architecture

### Excluded

- Supplier management
- Purchase management
- Inventory management
- Stock tracking

The architecture is intentionally designed so those modules can be added in the future without changing the core quotation, invoice, customer, payment, and reporting architecture.
