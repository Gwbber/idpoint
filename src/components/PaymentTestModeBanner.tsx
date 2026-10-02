const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">Pagamentos reais ainda não estão liberados.</div>;
  }
  if (clientToken.startsWith("pk_test_")) {
    return <div className="w-full border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-sm text-warning">Ambiente de teste: nenhuma cobrança é real.</div>;
  }
  return null;
}