import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Retail price-match operations</p>
          <h1>Price matching without a single operator deciding the claim.</h1>
          <p className="hero-lede">MatchClaim lets a retailer commit its rules, register the purchase baseline, and let GenLayer validators independently assess the public competitor offer.</p>
          <div className="hero-actions"><Button href="/merchant">Merchant workspace</Button><Button href="/claim/find" variant="secondary">Submit a price match</Button><Button href="/verify" variant="quiet">Verify authorization →</Button></div>
          <p className="hero-note">The contract owns product equivalence, eligibility, competitor price, verdict, credit, and authorization.</p>
        </div>
        <Card className="hero-panel">
          <div className="panel-kicker"><span>One accountable flow</span><strong>V1 · PRICE MATCH</strong></div>
          <div className="flow-preview">
            <div className="flow-preview-item"><span className="flow-number">01</span><div><strong>Retailer sets rules</strong><p>Immutable policy and approved competitor hosts.</p></div></div>
            <div className="flow-preview-item"><span className="flow-number">02</span><div><strong>Purchase is registered</strong><p>Buyer, product, condition, and paid price become the baseline.</p></div></div>
            <div className="flow-preview-item"><span className="flow-number">03</span><div><strong>Buyer submits a listing</strong><p>Only the registered buyer can submit an approved HTTPS URL.</p></div></div>
            <div className="flow-preview-item"><span className="flow-number">04</span><div><strong>GenLayer validators assess</strong><p>Independent page retrieval and structured consensus.</p></div></div>
            <div className="flow-preview-item"><span className="flow-number">05</span><div><strong>Credit becomes verifiable</strong><p>Eligible claims create a permanent authorization.</p></div></div>
          </div>
        </Card>
      </section>
      <section className="section">
        <div className="section-heading"><p className="eyebrow">Why MatchClaim</p><h2>Trust the rulebook and the record.</h2><p>A clear retail workflow with the decision boundary kept inside the Intelligent Contract.</p></div>
        <div className="feature-grid">
          <div className="feature-card"><span className="mini-icon">R</span><h3>Retailer-controlled policy</h3><p>Merchant rules and approved domains are committed before purchases reference them.</p></div>
          <div className="feature-card"><span className="mini-icon">V</span><h3>Validator assessment</h3><p>Consensus compares strict structured results from independent web and model paths.</p></div>
          <div className="feature-card"><span className="mini-icon">A</span><h3>Permanent authorization</h3><p>An eligible claim produces a compact, independently verifiable credit record.</p></div>
        </div>
      </section>
      <section className="section"><div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}><div><p className="eyebrow">Built for review</p><h2 style={{ margin: "6px 0 4px", letterSpacing: "-.05em" }}>See the contract-owned evidence trail.</h2><p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>No screenshots, off-chain verdict setters, or fake chain state in the product path.</p></div><Link className="button button-secondary" href="/verify">Open verifier</Link></div></section>
    </>
  );
}
