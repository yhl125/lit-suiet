import styles from './index.module.scss';
import commonStyles from './common.module.scss';
import Typo from '../../components/Typo';
import Button from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import Nav from '../../components/Nav';
import TokenItem from './TokenItem';
import { useCallback, useEffect, useState } from 'react';
import AddressInputPage from './AddressInput';
import SendConfirm from './SendConfirm';
import Skeleton from 'react-loading-skeleton';
import { CoinDto } from '../../hooks/coin/useCoins';
import {
  SendAndExecuteTxParams,
  TxEssentials,
  calculateCoinAmount,
} from '@suiet/core';
import { DEFAULT_SUI_COIN } from '../../constants/coin';
import { SendData } from './types';
import { compareCoinAmount } from '../../utils/check';
import message from '../../components/message';
import { useNetwork } from '../../hooks/useNetwork';
import { useApiClient } from '../../hooks/useApiClient';
import { OmitToken } from '../../types';
import useSuiBalance from '../../hooks/coin/useSuiBalance';
import { getTransactionBlock } from '@suiet/core/src/utils/txb-factory';
import createTransferCoinTxb, {
  createPKPTransferCoinTxb,
} from './utils/createTransferCoinTxb';
import useGasBudgetForTransferCoin from './hooks/useGasBudgetForTranferCoin';
import useCoinsWithSuiOnTop from './hooks/useCoinsWithSuiOnTop';
import { useGetAddress } from '../../hooks/usePKPWallet';
import { pkpSignAndExecuteTransactionBlock } from '../../api/pkp/pkpSigns';

enum Mode {
  symbol,
  address,
  confirm,
}

const SendPage = () => {
  const { accountId, walletId, networkId, usePKP } = useSelector(
    (state: RootState) => state.appContext
  );
  const { data: network } = useNetwork(networkId);

  const apiClient = useApiClient();
  const navigate = useNavigate();
  const address = useGetAddress(usePKP, accountId);
  const { data: suiBalance } = useSuiBalance(address);
  const { data: coinsWithSuiOnTop, loading: coinsLoading } =
    useCoinsWithSuiOnTop(address);

  const [mode, setMode] = useState(Mode.symbol);
  const [selectedCoin, setSelectedCoin] = useState<CoinDto>(DEFAULT_SUI_COIN);
  const [sendData, setSendData] = useState<SendData>({
    recipientAddress: '',
    coinType: '',
    coinAmountWithDecimals: '0',
  });

  const { data: gasBudget } = useGasBudgetForTransferCoin({
    coinType: sendData.coinType,
    recipient: sendData.recipientAddress,
    network,
    walletId,
    accountId,
    gasFeeRatio: 1.2,
  });

  const submitTransaction = useCallback(async () => {
    if (!sendData.recipientAddress || !sendData.coinType) return;
    if (!network) throw new Error('network is undefined');
    const coinAmount = calculateCoinAmount(
      sendData.coinAmountWithDecimals,
      selectedCoin.decimals
    );
    if (usePKP === true) {
      const serializedTxb = await createPKPTransferCoinTxb({
        apiClient,
        network,
        coinType: sendData.coinType,
        recipient: sendData.recipientAddress,
        amount: coinAmount,
      });
      const txb = getTransactionBlock(serializedTxb);
      console.log(txb);
      txb.setGasBudget(gasBudget); // set gas budget which is based on estimated gas fee
      try {
        await pkpSignAndExecuteTransactionBlock(
          {
            transactionBlock: txb.serialize(),
            network,
          },
          apiClient
        );
        message.success('Send transaction succeeded');
        navigate('/transaction/flow');
      } catch (e: any) {
        console.error(e);
        message.error(`Send transaction failed: ${e?.message}`);
      }
    } else {
      const txEssentials: OmitToken<TxEssentials> = {
        network,
        walletId,
        accountId,
      };

      const serializedTxb = await createTransferCoinTxb({
        apiClient,
        context: txEssentials,
        coinType: sendData.coinType,
        recipient: sendData.recipientAddress,
        amount: coinAmount,
      });
      const txb = getTransactionBlock(serializedTxb);
      txb.setGasBudget(gasBudget); // set gas budget which is based on estimated gas fee
      try {
        await apiClient.callFunc<
          SendAndExecuteTxParams<string, OmitToken<TxEssentials>>,
          undefined
        >(
          'txn.signAndExecuteTransactionBlock',
          {
            transactionBlock: txb.serialize(),
            context: txEssentials,
          },
          {
            withAuth: true,
          }
        );
        message.success('Send transaction succeeded');
        navigate('/transaction/flow');
      } catch (e: any) {
        console.error(e);
        message.error(`Send transaction failed: ${e?.message}`);
      }
    }
  }, [gasBudget, sendData, selectedCoin]);

  useEffect(() => {
    if (coinsWithSuiOnTop.length === 0) return;
    if (selectedCoin === DEFAULT_SUI_COIN) {
      const firstCoin = coinsWithSuiOnTop[0];
      setSendData((prev) => ({
        ...prev,
        coinType: firstCoin.type,
      }));
      setSelectedCoin(firstCoin);
    }
  }, [coinsWithSuiOnTop]);

  return (
    <>
      <Nav
        position={'relative'}
        onNavBack={() => {
          switch (mode) {
            case Mode.symbol:
              navigate(-1);
              break;
            case Mode.address:
              setMode(Mode.symbol);
              break;
            case Mode.confirm:
              setMode(Mode.address);
              break;
            default:
          }
        }}
        title="Send"
      />
      {mode === Mode.symbol && (
        <>
          <div className={'px-[32px]'}>
            <Typo.Title className={'mt-[48px] font-bold text-[36px]'}>
              Select Token
            </Typo.Title>
            <Typo.Normal className={`mt-[8px] ${styles['desc']}`}>
              Choose the token you want to send
            </Typo.Normal>
          </div>
          <div className={styles['token-list']}>
            {coinsLoading && (
              <Skeleton width="100%" height="73px" className="block" />
            )}
            {!coinsLoading &&
              coinsWithSuiOnTop.map((coin) => {
                return (
                  <TokenItem
                    key={coin.type}
                    type={coin.type}
                    symbol={coin.symbol}
                    balance={coin.balance}
                    decimals={coin.decimals}
                    verified={coin.isVerified}
                    selected={sendData.coinType === coin.type}
                    isVerified={coin.isVerified}
                    onClick={(coinType) => {
                      setSelectedCoin(coin);
                      setSendData((prev) => ({
                        ...prev,
                        coinType,
                      }));
                    }}
                  />
                );
              })}
          </div>
          <div className={commonStyles['next-step']}>
            <Button
              type={'submit'}
              state={'primary'}
              disabled={
                !sendData.coinType ||
                compareCoinAmount(selectedCoin.balance, 0) <= 0
              }
              onClick={() => {
                setMode(Mode.address);
              }}
            >
              {compareCoinAmount(selectedCoin.balance, 0) <= 0
                ? 'Insufficient Balance'
                : 'Next Step'}
            </Button>
          </div>
        </>
      )}
      {mode === Mode.address && (
        <AddressInputPage
          onNext={() => {
            setMode(Mode.confirm);
          }}
          state={sendData}
          onSubmit={(address) => {
            setSendData((prev) => {
              return {
                ...prev,
                recipientAddress: address,
              };
            });
          }}
        />
      )}
      {mode === Mode.confirm && (
        <SendConfirm
          state={sendData}
          selectedCoin={selectedCoin}
          suiBalance={suiBalance.balance}
          gasBudget={String(gasBudget)}
          onInputCoinAmountWithDecimals={(amountWithDecimals) => {
            setSendData((prev) => {
              return {
                ...prev,
                coinAmountWithDecimals: amountWithDecimals,
              };
            });
          }}
          onSubmit={submitTransaction}
        />
      )}
    </>
  );
};

export default SendPage;
