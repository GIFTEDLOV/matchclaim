import { getConfig, type MatchClaimConfig } from "./config";
import type { InjectedProvider } from "./client";
import type { Address } from "./address";
import { isAddress } from "./validation";

export interface WalletConnection {
  address: Address;
  chainId: number;
  provider: InjectedProvider;
}

export function getInjectedProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as Window & { ethereum?: InjectedProvider }).ethereum;
  return candidate ?? null;
}

async function request<T>(provider: InjectedProvider, method: string, params?: unknown[]): Promise<T> {
  return (await provider.request({ method, params })) as T;
}

export async function walletAccounts(provider = getInjectedProvider()): Promise<Address[]> {
  if (!provider) return [];
  const accounts = await request<unknown[]>(provider, "eth_accounts");
  return accounts.filter((account): account is Address => typeof account === "string" && isAddress(account));
}

export async function walletChainId(provider: InjectedProvider): Promise<number> {
  const raw = await request<string>(provider, "eth_chainId");
  const chainId = Number.parseInt(raw, 16);
  if (!Number.isSafeInteger(chainId)) throw new Error("Wallet returned an invalid network ID");
  return chainId;
}

async function switchNetwork(provider: InjectedProvider, config: MatchClaimConfig): Promise<void> {
  if (!config.chainId) throw new Error("MatchClaim contract is not configured");
  const chainId = `0x${config.chainId.toString(16)}`;
  try {
    await request(provider, "wallet_switchEthereumChain", [{ chainId }]);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code: unknown }).code)
      : null;
    if (code !== 4902) throw error;
    await request(provider, "wallet_addEthereumChain", [{
      chainId,
      chainName: config.chainName,
      nativeCurrency: { name: config.symbol, symbol: config.symbol, decimals: 18 },
      rpcUrls: [config.rpcUrl],
    }]);
  }
}

export async function connectWallet(config = getConfig()): Promise<WalletConnection> {
  if (!config.configured) throw new Error("MatchClaim contract is not configured");
  const provider = getInjectedProvider();
  if (!provider) throw new Error("Connect a browser wallet to continue");
  const accounts = await request<unknown[]>(provider, "eth_requestAccounts");
  const rawAddress = accounts[0];
  if (typeof rawAddress !== "string" || !isAddress(rawAddress)) {
    throw new Error("Wallet did not return a valid address");
  }
  await switchNetwork(provider, config);
  return { address: rawAddress as Address, chainId: await walletChainId(provider), provider };
}

export async function inspectWallet(config = getConfig()): Promise<WalletConnection | null> {
  const provider = getInjectedProvider();
  if (!provider || !config.configured) return null;
  const accounts = await walletAccounts(provider);
  if (!accounts[0]) return null;
  return { address: accounts[0], chainId: await walletChainId(provider), provider };
}
