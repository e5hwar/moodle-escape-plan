// Standalone placeholder page opened in a new tab from the "View Invoices"
// company action — stands in for the real Stripe dashboard invoices view,
// which lives outside this app.
export function StripeInvoicesPage({ customerId }: { customerId: string }) {
  return (
    <div className="stripe-placeholder">
      <div className="stripe-placeholder-card">
        <div className="stripe-placeholder-mark">S</div>
        <h1 className="stripe-placeholder-title">Stripe — Invoices</h1>
        <p className="stripe-placeholder-sub">
          This is a placeholder for the Stripe dashboard. In production, this link opens the
          customer's invoice history directly in Stripe.
        </p>
        <div className="stripe-placeholder-row">
          <span className="stripe-placeholder-label">Customer ID</span>
          <code className="stripe-placeholder-value">{customerId}</code>
        </div>
      </div>
    </div>
  );
}
