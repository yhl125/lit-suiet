import { BackgroundApiClient } from '../../../scripts/shared/ui-api-client';
import { OmitToken } from '../../../types';
import {
  Network,
  PKPTransferCoinParams,
  TransferCoinParams,
  TxEssentials,
} from '@suiet/core';
import { getTransactionBlock } from '@suiet/core/src/utils/txb-factory';
import { TransactionBlock } from '@mysten/sui.js';

export default async function createTransferCoinTxb(params: {
  apiClient: BackgroundApiClient;
  context: OmitToken<TxEssentials> | undefined;
  coinType: string;
  recipient: string;
  amount: string;
}): Promise<TransactionBlock> {
  const { apiClient, context, coinType, recipient, amount } = params;

  if (!context) throw new Error('context is undefined');

  const serialized = await apiClient.callFunc<
    TransferCoinParams<OmitToken<TxEssentials>>,
    string
  >(
    'txn.getSerializedTransferCoinTxb',
    {
      coinType,
      amount, // mock for dry run
      recipient,
      context,
    },
    { withAuth: true }
  );
  return getTransactionBlock(serialized);
}

export async function createPKPTransferCoinTxb(params: {
  apiClient: BackgroundApiClient;
  network: Network;
  coinType: string;
  recipient: string;
  amount: string;
}): Promise<TransactionBlock> {
  const { apiClient, network, coinType, recipient, amount } = params;

  const serialized = await apiClient.callFunc<PKPTransferCoinParams, string>(
    'txn.pkpGetSerializedTransferCoinTxb',
    {
      coinType,
      amount, // mock for dry run
      recipient,
      network,
    }
  );
  return getTransactionBlock(serialized);
}
