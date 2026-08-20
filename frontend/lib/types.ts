export type Condition = "NEW" | "REFURBISHED";
export type Verdict = "MATCH_ELIGIBLE" | "NOT_ELIGIBLE" | "INCONCLUSIVE";

export interface MerchantPolicy {
  policy_id: string;
  merchant_address: string;
  merchant_name: string;
  policy_text: string;
  approved_competitor_hosts: string[];
  eligible_new: boolean;
  eligible_refurbished: boolean;
  active: boolean;
  policy_digest: string;
}

export interface Purchase {
  purchase_id: string;
  policy_id: string;
  buyer_address: string;
  product_title: string;
  manufacturer: string;
  model_number: string;
  sku: string;
  product_condition: Condition;
  paid_price_minor: number;
  currency: string;
  purchase_digest: string;
  claim_assessed: boolean;
  latest_assessment_id: string;
  authorization_id: string;
  assessment_count: number;
}

export interface ClaimAssessment {
  assessment_id: string;
  purchase_id: string;
  competitor_url: string;
  verdict: Verdict;
  competitor_price_minor: number;
  authorized_credit_minor: number;
  currency: string;
  result_digest: string;
  assessment_digest: string;
}

export interface PriceMatchAuthorization {
  authorization_id: string;
  purchase_id: string;
  assessment_id: string;
  original_price_minor: number;
  competitor_price_minor: number;
  authorized_credit_minor: number;
  currency: string;
  result_digest: string;
  authorization_digest: string;
}

export interface ContractInfo {
  name: string;
  version: string;
  product_class: string;
  supported_conditions: Condition[];
  verdicts: Verdict[];
  model_keys: string[];
  max_id_length: number;
  max_policy_text_length: number;
  max_host_count: number;
  max_host_length: number;
  max_url_length: number;
  max_page_text_length: number;
  max_price_minor: number;
}

export type WriteOperation =
  | "create_policy"
  | "register_purchase"
  | "assess_price_match";
