import { createClient } from "genlayer-js";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { Address } from "./address";
import { getChain, getConfig, type MatchClaimConfig } from "./config";
import type {
  ClaimAssessment,
  ContractInfo,
  MerchantPolicy,
  PriceMatchAuthorization,
  Purchase,
} from "./types";

export const CONTRACT_READS = {
  getPolicy: "get_policy",
  getPurchase: "get_purchase",
  getAssessment: "get_assessment",
  getAuthorization: "get_authorization",
  getPolicyIds: "get_policy_ids",
  getPurchaseIds: "get_purchase_ids",
  getAssessmentIds: "get_assessment_ids",
  contractInfo: "contract_info",
} as const;

export const CONTRACT_WRITES = {
  createPolicy: "create_policy",
  registerPurchase: "register_purchase",
  assessPriceMatch: "assess_price_match",
} as const;

export const CONTRACT_METHOD_MATRIX = {
  create_policy: {
    method: "create_policy",
    args: ["policy_id:string", "merchant_name:string", "policy_text:string", "approved_competitor_hosts:string[]", "eligible_new:bool", "eligible_refurbished:bool"],
    precondition: "policy ID is absent and form fields pass UX validation",
    postcondition: "get_policy(policy_id) returns the new policy",
  },
  register_purchase: {
    method: "register_purchase",
    args: ["purchase_id:string", "policy_id:string", "buyer_address:string", "product_title:string", "manufacturer:string", "model_number:string", "sku:string", "product_condition:string", "paid_price_minor:u256", "currency:string"],
    precondition: "purchase ID is absent; connected sender controls the policy",
    postcondition: "get_purchase(purchase_id) returns the new purchase",
  },
  assess_price_match: {
    method: "assess_price_match",
    args: ["purchase_id:string", "assessment_id:string", "competitor_url:string"],
    precondition: "purchase exists; sender is buyer; assessment ID is unused; no authorization exists",
    postcondition: "get_assessment(assessment_id) returns the stored assessment",
  },
} as const;

export type InjectedProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type ReadClient = ReturnType<typeof createClient>;

function requireConfigured(config: MatchClaimConfig): asserts config is MatchClaimConfig & {
  configured: true;
  contractAddress: `0x${string}`;
} {
  if (!config.configured || !config.contractAddress) {
    throw new Error("MatchClaim contract is not configured");
  }
}

export function createReadClient(config = getConfig()): ReadClient {
  requireConfigured(config);
  return createClient({ endpoint: config.rpcUrl, chain: getChain(config) });
}

export function createWriteClient(
  address: Address,
  provider: InjectedProvider,
  config = getConfig(),
): ReadClient {
  requireConfigured(config);
  type Provider = NonNullable<Parameters<typeof createClient>[0]>["provider"];
  return createClient({
    endpoint: config.rpcUrl,
    chain: getChain(config),
    account: address as never,
    provider: provider as Provider,
  });
}

async function read<T>(client: ReadClient, functionName: string, args: unknown[] = []): Promise<T> {
  return (await client.readContract({
    address: getConfig().contractAddress as Address,
    functionName,
    args: args as never,
  })) as T;
}

function toMoney(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`Invalid monetary value returned for ${field}`);
}

function normalizePurchase(value: unknown): Purchase {
  const purchase = value as Purchase;
  return { ...purchase, paid_price_minor: toMoney(purchase.paid_price_minor, "paid_price_minor") };
}

function normalizeAssessment(value: unknown): ClaimAssessment {
  const assessment = value as ClaimAssessment;
  return {
    ...assessment,
    competitor_price_minor: toMoney(assessment.competitor_price_minor, "competitor_price_minor"),
    authorized_credit_minor: toMoney(assessment.authorized_credit_minor, "authorized_credit_minor"),
  };
}

function normalizeAuthorization(value: unknown): PriceMatchAuthorization {
  const authorization = value as PriceMatchAuthorization;
  return {
    ...authorization,
    original_price_minor: toMoney(authorization.original_price_minor, "original_price_minor"),
    competitor_price_minor: toMoney(authorization.competitor_price_minor, "competitor_price_minor"),
    authorized_credit_minor: toMoney(authorization.authorized_credit_minor, "authorized_credit_minor"),
  };
}

function normalizeContractInfo(value: unknown): ContractInfo {
  const info = value as ContractInfo;
  return { ...info, max_price_minor: toMoney(info.max_price_minor, "max_price_minor") };
}

export const readPolicy = (client: ReadClient, id: string) =>
  read<MerchantPolicy>(client, CONTRACT_READS.getPolicy, [id]);
export const readPurchase = (client: ReadClient, id: string) =>
  read<unknown>(client, CONTRACT_READS.getPurchase, [id]).then(normalizePurchase);
export const readAssessment = (client: ReadClient, id: string) =>
  read<unknown>(client, CONTRACT_READS.getAssessment, [id]).then(normalizeAssessment);
export const readAuthorization = (client: ReadClient, id: string) =>
  read<unknown>(client, CONTRACT_READS.getAuthorization, [id]).then(normalizeAuthorization);
export const readPolicyIds = (client: ReadClient) => read<string[]>(client, CONTRACT_READS.getPolicyIds);
export const readPurchaseIds = (client: ReadClient) => read<string[]>(client, CONTRACT_READS.getPurchaseIds);
export const readAssessmentIds = (client: ReadClient) => read<string[]>(client, CONTRACT_READS.getAssessmentIds);
export const readContractInfo = (client: ReadClient) => read<unknown>(client, CONTRACT_READS.contractInfo).then(normalizeContractInfo);

export function readClientForConfig(config = getConfig()): ReadClient {
  return createReadClient(config);
}

export async function writeCreatePolicy(
  client: ReadClient,
  args: [string, string, string, string[], boolean, boolean],
): Promise<string> {
  return (await client.writeContract({
    address: getConfig().contractAddress as Address,
    functionName: CONTRACT_WRITES.createPolicy,
    args: args as never,
    value: 0n,
  })) as string;
}

export async function writeRegisterPurchase(
  client: ReadClient,
  args: [string, string, string, string, string, string, string, string, bigint, string],
): Promise<string> {
  return (await client.writeContract({
    address: getConfig().contractAddress as Address,
    functionName: CONTRACT_WRITES.registerPurchase,
    args: args as never,
    value: 0n,
  })) as string;
}

export async function writeAssessPriceMatch(
  client: ReadClient,
  args: [string, string, string],
): Promise<string> {
  return (await client.writeContract({
    address: getConfig().contractAddress as Address,
    functionName: CONTRACT_WRITES.assessPriceMatch,
    args: args as never,
    value: 0n,
  })) as string;
}

export { ExecutionResult, TransactionStatus };
export type { ReadClient };
