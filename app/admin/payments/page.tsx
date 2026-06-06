import Navbar from "@/app/components/Navbar";
import { getPaymentCurrencyLimits } from "@/lib/payments/currency-settings";
import { PaymentSettingsForm } from "./PaymentSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const limits = await getPaymentCurrencyLimits();

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/40 via-background to-background text-foreground">
      <Navbar />
      <PaymentSettingsForm initialLimits={limits} />
    </div>
  );
}
