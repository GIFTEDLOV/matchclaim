import { PurchaseForm } from "@/components/forms";
import { Button, PageHeader } from "@/components/ui";

export default function NewPurchasePage() {
  return <><PageHeader eyebrow="Merchant · purchase" title="Register a purchase baseline." description="The product, buyer, condition, paid price, and currency become immutable contract state." action={<Button href="/merchant">Back to workspace</Button>} /><div className="form-layout"><PurchaseForm /><aside className="card side-note"><p className="eyebrow">Money handling</p><h2>Store integers, show humans decimals.</h2><p>The form accepts a standard two-decimal amount such as 799.99 and parses it as 79999 minor units without using floating-point arithmetic.</p><ul><li>Currency is exactly three uppercase letters.</li><li>Buyer address is passed as a string to the contract.</li><li>Only the policy merchant can register the purchase.</li></ul></aside></div></>;
}
