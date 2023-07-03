import { ExecutionStatusType } from '@mysten/sui.js';
import { AccountInWallet } from '../api/wallet';
import { AuthSig } from '@lit-protocol/types';

export const WALLET_PREFIX = 'wallet-';

export type Wallet = {
  id: string;
  name: string;
  accounts: AccountInWallet[];
  nextAccountId: number;
  avatar?: string;
  encryptedMnemonic: string;
};

export type Account = {
  id: string;
  name: string;
  pubkey: string;
  address: string;
  hdPath: string;
};

export type GlobalMeta = {
  nextWalletId: number;
  cipher: Cipher;
  clientId?: string;
  biometricData?: BiometricData;
  dataVersion: number;
};

export type Cipher = {
  data: string;
  salt: string;
};

export type BiometricData = {
  credentialIdBase64: string;
  publicKeyBase64: string;
  encryptedToken: string;
};

export type TxnHistoryEntry<T = TxObject> = {
  txStatus?: ExecutionStatusType;
  transactionDigest: string;
  gasFee: number;
  from: string;
  to: string;
  object: T | MoveCallInfo<T>;
  timestamp_ms: number | null | undefined;
};

export type TxObject = CoinObject | NftObject | ObjectId;

export type CoinObject = {
  type: 'coin';
  symbol: string;
  balance: string;
};

export type NftObject = {
  type: 'nft';
  name: string;
  description: string;
  url: string;
};

export type MoveCallInfo<T = TxObject> = {
  type: 'move_call';
  packageObjectId: string;
  module: string;
  function: string;
  arguments?: string[];
  created?: T[];
  // If object type is nft, it represents the nft was deleted. If object type is coin, it represents the coin balance was changed.
  changedOrDeleted?: T[];
};

export type ObjectId = {
  type: 'object_id';
  id: string;
};

export type PKPWallet = {
  address: string;
  pkpPublicKey: string;
  authSig: AuthSig;
};
