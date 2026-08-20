import { PolicyForm } from "@/components/forms";
import { Button, PageHeader } from "@/components/ui";

export default function NewPolicyPage() {
  return <><PageHeader eyebrow="Merchant · policy" title="Create the rulebook." description="This policy becomes immutable once the transaction is finalized. Use exact, lowercase competitor hostnames." action={<Button href="/merchant">Back to workspace</Button>} /><div className="form-layout"><PolicyForm /><aside className="card side-note"><p className="eyebrow">Before you write</p><h2>Make the boundary explicit.</h2><p>GenLayer validators receive the committed policy, purchase baseline, and fetched competitor page. The frontend never decides eligibility.</p><ul><li>Use one hostname per line.</li><li>Choose every eligible condition.</li><li>Review the policy ID before signing.</li></ul></aside></div></>;
}
