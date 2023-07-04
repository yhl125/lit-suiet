import {
  Provider,
  QueryProvider,
  handleSuiRpcError,
} from '@suiet/core/src/provider';
import {
  Connection,
  DryRunTransactionBlockResponse,
  ExecuteTransactionRequestType,
  JsonRpcProvider,
  SUI_SYSTEM_STATE_OBJECT_ID,
  SuiTransactionBlockResponse,
  TransactionBlock,
} from '@mysten/sui.js';
import { SuiTransactionBlockResponseOptions } from '@mysten/sui.js/src/types';
import { getTransactionBlock } from '@suiet/core/src/utils/txb-factory';
import { PKPSuiWallet } from '@yhl125/pkp-sui';
import { PKPWallet } from '@suiet/core/src/storage/types';
import { Network } from '@suiet/core';
import { BackgroundApiClient } from '../../scripts/shared/ui-api-client';

export type PKPTransferCoinParams = {
  network: Network;
  coinType: string;
  amount: string;
  recipient: string;
};

export type PKPTransferObjectParams = {
  network: Network;
  recipient: string;
  objectId: string;
};

export type PKPSignMessageParams = {
  network: Network;
  message: Uint8Array;
};

export type PKPSendAndExecuteTxParams<T> = {
  network: Network;
  transactionBlock: T;
  requestType?: ExecuteTransactionRequestType;
  options?: SuiTransactionBlockResponseOptions;
};

export type PKPSendTxParams<T> = {
  network: Network;
  transactionBlock: T;
};

export type PKPStakeCoinParams = {
  network: Network;
  amount: string;
  validator: string; // address
  gasBudgetForStake: number;
};

export type PKPDryRunTXBParams<T> = {
  network: Network;
  transactionBlock: T;
};

async function getPKPWallet(network: Network, apiClient: BackgroundApiClient) {
  const pkpWallet = await apiClient.callFunc<undefined, PKPWallet>(
    'wallet.getPKPWallet',
    undefined
  );
  if (!pkpWallet) {
    throw new Error('PKP wallet not found');
  }
  return getPKPSuiWallet(network, pkpWallet);
}

function getPKPSuiWallet(network: Network, pkpWallet: PKPWallet) {
  return new PKPSuiWallet(
    {
      controllerAuthSig: pkpWallet.authSig,
      pkpPubKey: pkpWallet.pkpPublicKey,
    },
    new JsonRpcProvider(new Connection({ fullnode: network.txRpcUrl }))
  );
}

export async function pkpTransferCoin(
  params: PKPTransferCoinParams,
  apiClient: BackgroundApiClient
): Promise<SuiTransactionBlockResponse> {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  const address = await pkpWallet.getAddress();
  const provider = new Provider(
    params.network.queryRpcUrl,
    params.network.txRpcUrl,
    params.network.versionCacheTimoutInSeconds
  );
  const transactionBlock = await provider.getTransferCoinTxb(
    params.coinType,
    BigInt(params.amount),
    params.recipient,
    address
  );
  return await pkpWallet.signAndExecuteTransactionBlock({
    transactionBlock,
  });
}

export async function pkpTransferObject(
  params: PKPTransferObjectParams,
  apiClient: BackgroundApiClient
) {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  const address = await pkpWallet.getAddress();
  const provider = new QueryProvider(
    params.network.queryRpcUrl,
    params.network.versionCacheTimoutInSeconds
  );
  const object = await provider.getOwnedObject(address, params.objectId);
  if (!object) {
    throw new Error('No object to transfer');
  }
  const tx = new TransactionBlock();
  tx.transferObjects([tx.object(params.objectId)], tx.pure(params.recipient));

  try {
    return await pkpWallet.signAndExecuteTransactionBlock({
      transactionBlock: tx,
    });
  } catch (e) {
    handleSuiRpcError(e);
  }
}

export async function pkpSignMessage(
  params: PKPSignMessageParams,
  apiClient: BackgroundApiClient
) {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  return await pkpWallet.signMessage({ message: params.message });
}

export async function pkpSignMessageDapp(
  params: PKPSignMessageParams,
  pkpWallet: PKPWallet
) {
  const wallet = getPKPSuiWallet(params.network, pkpWallet);
  return await wallet.signMessage({ message: params.message });
}

export async function pkpSignAndExecuteTransactionBlock(
  params: PKPSendAndExecuteTxParams<string | TransactionBlock>,
  apiClient: BackgroundApiClient
) {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  const txb = getTransactionBlock(params.transactionBlock);
  try {
    return await pkpWallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      requestType: params.requestType,
      options: params.options,
    });
  } catch (e) {
    handleSuiRpcError(e);
  }
}

export async function pkpSignAndExecuteTransactionBlockDapp(
  params: PKPSendAndExecuteTxParams<string | TransactionBlock>,
  pkpWallet: PKPWallet
) {
  const wallet = getPKPSuiWallet(params.network, pkpWallet);
  const txb = getTransactionBlock(params.transactionBlock);
  try {
    return await wallet.signAndExecuteTransactionBlock({
      transactionBlock: txb,
      requestType: params.requestType,
      options: params.options,
    });
  } catch (e) {
    handleSuiRpcError(e);
  }
}

export async function pkpSignTransactionBlock(
  params: PKPSendTxParams<string | TransactionBlock>,
  apiClient: BackgroundApiClient
) {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  return await pkpWallet.signTransactionBlock({
    transactionBlock: getTransactionBlock(params.transactionBlock),
  });
}

export async function pkpSignTransactionBlockDapp(
  params: PKPSendTxParams<string | TransactionBlock>,
  pkpWallet: PKPWallet
) {
  const wallet = getPKPSuiWallet(params.network, pkpWallet);
  return await wallet.signTransactionBlock({
    transactionBlock: getTransactionBlock(params.transactionBlock),
  });
}

export async function pkpStakeCoin(
  params: PKPStakeCoinParams,
  apiClient: BackgroundApiClient
) {
  const { amount, validator } = params;
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  const tx = new TransactionBlock();
  const stakeCoin = tx.splitCoins(tx.gas, [tx.pure(amount)]);
  tx.moveCall({
    target: '0x3::sui_system::request_add_stake',
    arguments: [
      tx.object(SUI_SYSTEM_STATE_OBJECT_ID),
      stakeCoin,
      tx.pure(validator),
    ],
  });
  try {
    return await pkpWallet.signAndExecuteTransactionBlock({
      transactionBlock: tx,
    });
  } catch (e) {
    handleSuiRpcError(e);
  }
}

export async function pkpDryRunTransactionBlock(
  params: PKPDryRunTXBParams<string | TransactionBlock>,
  apiClient: BackgroundApiClient
): Promise<DryRunTransactionBlockResponse> {
  const pkpWallet = await getPKPWallet(params.network, apiClient);
  const txb = getTransactionBlock(params.transactionBlock);

  return await pkpWallet.dryRunTransactionBlock({
    transactionBlock: txb,
  });
}
