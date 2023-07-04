import { Network } from '@suiet/core';
import { useMemo, useState } from 'react';
import { useFeatureFlagsWithNetwork } from '../../../hooks/useFeatureFlags';
import { useAsyncEffect } from 'ahooks';
import { dryRunTransactionBlock } from '../../../hooks/transaction/useDryRunTransactionBlock';
import { getEstimatedGasFeeFromDryRunResult } from '../../../hooks/transaction/useEstimatedGasFee';
import createTransferCoinTxb, {
  createPKPTransferCoinTxb,
} from '../utils/createTransferCoinTxb';
import { useApiClient } from '../../../hooks/useApiClient';
import { DEFAULT_GAS_BUDGET } from '../../../constants';
import Message from '../../../components/message';
import formatDryRunError from '@suiet/core/src/utils/format/formatDryRunError';
import { pkpDryRunTransactionBlock } from '../../../api/pkp/pkpSigns';

function calculateGasBudget(
  estimatedGasFee: bigint,
  defaultGasBudget: number,
  gasFeeRatio = 1
) {
  if (estimatedGasFee > 0n) {
    return Math.ceil(Number(estimatedGasFee) * gasFeeRatio);
  }
  return defaultGasBudget;
}

export default function useGasBudgetForTransferCoin(params: {
  coinType: string;
  recipient: string;
  network: Network | undefined;
  walletId: string;
  accountId: string;
  gasFeeRatio?: number;
}) {
  const apiClient = useApiClient();
  const [estimatedGasFee, setEstimatedGasFee] = useState<bigint>(0n);
  const featureFlags = useFeatureFlagsWithNetwork();
  const defaultGasBudget =
    featureFlags?.pay_coin_gas_budget ?? DEFAULT_GAS_BUDGET;

  const gasBudget = useMemo(() => {
    return calculateGasBudget(
      estimatedGasFee,
      defaultGasBudget,
      params.gasFeeRatio
    );
  }, [estimatedGasFee, params.gasFeeRatio]);

  const [loading, setLoading] = useState(false);

  useAsyncEffect(async () => {
    if (!params.network) return;
    if (!params.coinType) return;
    if (!params.recipient) return;
    if (loading) return;

    const txEssentials = {
      network: params.network,
      walletId: params.walletId,
      accountId: params.accountId,
    };

    const txb = await createTransferCoinTxb({
      apiClient,
      context: txEssentials,
      recipient: params.recipient,
      coinType: params.coinType,
      amount: '1', // placeholder for dry run
    });
    txb.setGasBudget(DEFAULT_GAS_BUDGET);

    setLoading(true);
    try {
      const dryRunRes = await dryRunTransactionBlock({
        transactionBlock: txb,
        apiClient,
        context: {
          network: params.network,
          walletId: params.walletId,
          accountId: params.accountId,
        },
      });
      const result = getEstimatedGasFeeFromDryRunResult(dryRunRes);
      setEstimatedGasFee(result);
    } catch (e: any) {
      const formattedErrMsg = formatDryRunError(e);
      if (formattedErrMsg.includes('needed gas')) {
        Message.info('Current balance is not enough to pay the gas fee');
      }
      setEstimatedGasFee(0n);
    } finally {
      setLoading(false);
    }
  }, [params.coinType, params.recipient]);

  return { data: gasBudget, loading };
}

export function usePKPGasBudgetForTransferCoin(params: {
  coinType: string;
  recipient: string;
  network: Network | undefined;
  gasFeeRatio?: number;
}) {
  const apiClient = useApiClient();
  const [estimatedGasFee, setEstimatedGasFee] = useState<bigint>(0n);
  const featureFlags = useFeatureFlagsWithNetwork();
  const defaultGasBudget =
    featureFlags?.pay_coin_gas_budget ?? DEFAULT_GAS_BUDGET;

  const gasBudget = useMemo(() => {
    return calculateGasBudget(
      estimatedGasFee,
      defaultGasBudget,
      params.gasFeeRatio
    );
  }, [estimatedGasFee, params.gasFeeRatio]);

  const [loading, setLoading] = useState(false);

  useAsyncEffect(async () => {
    if (!params.network) return;
    if (!params.coinType) return;
    if (!params.recipient) return;
    if (loading) return;

    const txb = await createPKPTransferCoinTxb({
      apiClient,
      network: params.network,
      recipient: params.recipient,
      coinType: params.coinType,
      amount: '1', // placeholder for dry run
    });
    txb.setGasBudget(DEFAULT_GAS_BUDGET);

    setLoading(true);
    try {
      const dryRunRes = await pkpDryRunTransactionBlock(
        {
          transactionBlock: txb,
          network: params.network,
        },
        apiClient
      );
      const result = getEstimatedGasFeeFromDryRunResult(dryRunRes);
      setEstimatedGasFee(result);
    } catch (e: any) {
      const formattedErrMsg = formatDryRunError(e);
      if (formattedErrMsg.includes('needed gas')) {
        Message.info('Current balance is not enough to pay the gas fee');
      }
      setEstimatedGasFee(0n);
    } finally {
      setLoading(false);
    }
  }, [params.coinType, params.recipient]);

  return { data: gasBudget, loading };
}
