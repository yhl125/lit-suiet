import { SignSessionKeyResponse } from '@lit-protocol/types';
import { Account, Wallet, GlobalMeta } from './types';

export default interface IStorage {
  getWallets: () => Promise<Wallet[]>;
  getWallet: (id: string) => Promise<Wallet | null>;

  addWallet: (id: string, wallet: Wallet) => Promise<void>;
  updateWallet: (id: string, wallet: Wallet) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;

  getAccounts: (walletId: string) => Promise<Account[]>;
  getAccount: (accountId: string) => Promise<Account | null>;

  addAccount: (
    walletId: string,
    accountId: string,
    account: Account
  ) => Promise<void>;
  updateAccount: (
    walletId: string,
    accountId: string,
    account: Account
  ) => Promise<void>;
  deleteAccount: (walletId: string, accountId: string) => Promise<void>;

  loadMeta: () => Promise<GlobalMeta | null>;
  saveMeta: (meta: GlobalMeta) => Promise<void>;
  clearMeta: () => Promise<void>;
  updateMetaAndWallets: (meta: GlobalMeta, wallets: Wallet[]) => Promise<void>;

  addPKPSignSessionKeyResponse: (
    response: SignSessionKeyResponse
  ) => Promise<void>;
  getPKPSignSessionKeyResponse: () => Promise<SignSessionKeyResponse | null>;

  reset: () => Promise<void>;
}
