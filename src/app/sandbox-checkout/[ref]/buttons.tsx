"use client";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { simulateCheckoutAction } from "./actions";

export function CheckoutButtons({ providerRef }: { providerRef: string }) {
  return (
    <ActionForm action={simulateCheckoutAction} className="space-y-2">
      <input type="hidden" name="ref" value={providerRef} />
      <SubmitButton variant="accent" className="w-full" name="outcome" value="success" pendingText="Sending webhook…">Simulate successful payment</SubmitButton>
      <SubmitButton variant="outline" className="w-full" name="outcome" value="declined" pendingText="Sending webhook…">Simulate declined card</SubmitButton>
      <SubmitButton variant="ghost" className="w-full" name="outcome" value="cancel" pendingText="Sending webhook…">Cancel checkout</SubmitButton>
    </ActionForm>
  );
}
