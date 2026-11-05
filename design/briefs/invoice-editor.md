# Invoice editor (staff app, desktop 1440)
Same admin shell (sidebar: Finance › Invoices active). Breadcrumb: Invoices / New invoice. Header: "Draft invoice" badge "Draft" (neutral), actions: "Save draft" (secondary), "Issue invoice" (primary).
Two columns: main editor (2/3) + summary side panel (1/3, sticky).
- Client picker (combobox showing "Example Trading (Pvt) Ltd", contact "Tendai M., accounts@example.com"), Currency select USD, Issue date, Payment terms "14 days" → Due date auto.
- Line items table (LineItemEditor): columns Description · Qty · Unit price · Discount · Tax · Line total · drag handle/remove. Rows: "Business Website package (up to 12 pages)" 1 × 750.00; "Business email, 10 mailboxes, 12 months" 10 × 30.00; "Content upload, extra pages" 3 × 25.00 with 10% discount. "+ Add line" and "+ Add package" buttons.
- Document discount, Notes, Terms fields.
- Side panel totals (tabular numbers): Subtotal, Discount, Tax (VAT inactive → "No tax"), Total USD 1,117.50. Note: "Number is assigned when the invoice is issued."
