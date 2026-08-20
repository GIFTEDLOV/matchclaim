import { localnet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";

export interface MatchClaimConfig {
  rpcUrl: string;
  network: "localnet" | "testnetAsimov" | "testnetBradbury" | "";
  chainId: number | null;
  chainName: string;
  symbol: string;
  contractAddress: `0x${string}` | "";
  configured: boolean;
}

const asNonEmpty = (value: string | undefined): string => value?.trim() ?? "";

export function getConfig(): MatchClaimConfig {
  const rpcUrl = asNonEmpty(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL);
  const rawNetwork = asNonEmpty(process.env.NEXT_PUBLIC_GENLAYER_NETWORK);
  const chainIdText = asNonEmpty(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID);
  const chainName = asNonEmpty(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME);
  const symbol = asNonEmpty(process.env.NEXT_PUBLIC_GENLAYER_SYMBOL);
  const rawAddress = asNonEmpty(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
  const chainId = /^\d+$/.test(chainIdText) ? Number(chainIdText) : null;
  const network = ["localnet", "testnetAsimov", "testnetBradbury"].includes(rawNetwork)
    ? (rawNetwork as MatchClaimConfig["network"])
    : "";
  const contractAddress = /^0x[a-fA-F0-9]{40}$/.test(rawAddress)
    ? (rawAddress as `0x${string}`)
    : "";
  const configured = Boolean(
    rpcUrl && network && chainId !== null && chainName && symbol && contractAddress,
  );
  return { rpcUrl, network, chainId, chainName, symbol, contractAddress, configured };
}

type RuntimeChain = typeof testnetBradbury;

function presetFor(network: MatchClaimConfig["network"]): RuntimeChain {
  if (network === "localnet") return localnet;
  if (network === "testnetAsimov") return testnetAsimov;
  return testnetBradbury;
}

export function getChain(config: MatchClaimConfig): RuntimeChain {
  if (!config.configured || !config.chainId || !config.network) {
    throw new Error("MatchClaim contract is not configured");
  }
  const preset = presetFor(config.network);
  return {
    ...preset,
    id: config.chainId,
    name: config.chainName,
    rpcUrls: { default: { http: [config.rpcUrl] } },
    nativeCurrency: { name: config.symbol, symbol: config.symbol, decimals: 18 },
  };
}

export function configMessage(config = getConfig()): string {
  return config.configured
    ? `${config.chainName} · chain ${config.chainId}`
    : "MatchClaim contract is not configured";
}
