import classnames from 'classnames';
import type { StyleExtendable } from '../../../types';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { isNonEmptyArray, isSuiToken } from '../../../utils/check';
import { useMemo } from 'react';
import { Extendable } from '../../../types';
import styles from './index.module.scss';
import Typo from '../../../components/Typo';
import TokenIcon from '../../../components/TokenIcon';
import IconWaterDrop from '../../../assets/icons/waterdrop.svg';
import IconToken from '../../../assets/icons/token.svg';
import { formatCurrency } from '@suiet/core';
import { useNetwork } from '../../../hooks/useNetwork';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_DELEGATED_STAKES } from '../../../utils/graphql/query';
import useCoins from '../../../hooks/coin/useCoins';
import { SUI_TYPE_ARG } from '@mysten/sui.js';
import { DEFAULT_SUI_COIN } from '../../../constants/coin';
import { ReactComponent as VerifiedIcon } from '../../../assets/icons/verified.svg';
import { ReactComponent as UnverifiedIcon } from '../../../assets/icons/unverified.svg';
import Tooltip from '../../../components/Tooltip';
import { useGetAddress } from '../../../hooks/usePKPWallet';
export type TokenListProps = StyleExtendable;

type TokenItemProps = Extendable & {
  type: string;
  symbol: string;
  balance: string;
  decimals: number;
  isVerified: boolean;
};

const TokenItem = (props: TokenItemProps) => {
  const { balance = '0', decimals = 0, isVerified = false } = props;
  const navigate = useNavigate();
  const appContext = useSelector((state: RootState) => state.appContext);
  const { data: network } = useNetwork(appContext.networkId);

  const address = useGetAddress(appContext.usePKP, appContext.accountId);
  const { data: delegatedStakesResult, loading: stakesLoading } = useQuery(
    GET_DELEGATED_STAKES,
    {
      variables: {
        address,
      },
      skip: !address,
    }
  );
  const delegatedStakes = delegatedStakesResult?.delegatedStakes;
  const stakedBalance =
    delegatedStakes?.reduce((accumulator: any, current: { stakes: any[] }) => {
      const sum = current.stakes.reduce(
        (stakesAccumulator, stake) => stakesAccumulator + stake.principal,
        0
      );
      return accumulator + sum;
    }, 0) ?? 0;
  const isSUI = isSuiToken(props.type);

  function handleClick() {
    // TODO: support other coins for detail page
    if (isSUI) {
      navigate(`/coin/detail/${props.type}`);
    }
  }
  return (
    <div
      className={classnames(
        styles['token-item'],
        isSUI ? styles['token-item-sui'] : null,
        { 'cursor-pointer': isSUI }
      )}
      onClick={handleClick}
    >
      <div className="flex w-full flex-row items-center justify-between">
        <div className="flex">
          <TokenIcon
            icon={isSUI ? IconWaterDrop : IconToken}
            alt="water-drop"
            className={isSUI ? '' : styles['icon-wrap-default']}
          />
          <div className={'flex flex-col ml-[32px]'}>
            <div className="flex items-center gap-1">
              <Tooltip message={props.type}>
                <Typo.Normal
                  className={classnames(
                    styles['token-name'],
                    isSUI ? styles['token-name-sui'] : null
                  )}
                >
                  {props.symbol}
                </Typo.Normal>
              </Tooltip>
              {isVerified ? (
                <Tooltip message={'Verified'}>
                  <VerifiedIcon width={14} height={14} />
                </Tooltip>
              ) : (
                <Tooltip
                  message={
                    'Unverified: proceed with caution and research before use'
                  }
                >
                  <UnverifiedIcon width={14} height={14} />
                </Tooltip>
              )}
            </div>

            <div className="flex gap-1">
              <Typo.Small
                className={classnames(
                  styles['token-amount'],
                  isSUI ? styles['token-amount-sui'] : null
                )}
              >
                {formatCurrency(balance, {
                  decimals,
                  withAbbr: false,
                })}
              </Typo.Small>

              {isSUI && network?.enableStaking && stakedBalance > 0 && (
                <>
                  <Typo.Small
                    className={classnames('inline', styles['token-amount'])}
                    style={{ color: 'rgba(0,0,0,0.3)' }}
                  >
                    +
                  </Typo.Small>

                  <Typo.Small
                    className={classnames(
                      'inline',
                      styles['token-amount'],
                      isSUI ? styles['token-amount'] : null
                    )}
                    style={{ color: '#0096FF' }}
                  >
                    {formatCurrency(stakedBalance, {
                      decimals: 9,
                      withAbbr: false,
                    })}{' '}
                    Staked
                  </Typo.Small>
                </>
              )}
            </div>
          </div>
        </div>
        {/* {props.type === SUI_TYPE_ARG && network?.enableStaking && (
          <button
            className={styles['click-button']}
            onClick={(e) => {
              // to={'/staking'}
              e.preventDefault();
              e.stopPropagation();
              navigate('/staking');
            }}
          >
            Stake
          </button>
        )} */}
      </div>
    </div>
  );
};

const TokenList = (props: TokenListProps) => {
  const appContext = useSelector((state: RootState) => state.appContext);
  const address = useGetAddress(appContext.usePKP, appContext.accountId);
  const {
    data: coins,
    loading: isLoading,
    error: coinsError,
  } = useCoins(address);
  const coinsWithSuiOnTop = useMemo(() => {
    if (!isNonEmptyArray(coins)) return [DEFAULT_SUI_COIN];

    const result = coins;
    const suiCoinIndex = result.findIndex((item) => item.type === SUI_TYPE_ARG);
    if (suiCoinIndex !== -1) {
      const suiCoin = result[suiCoinIndex];
      result.splice(suiCoinIndex, 1);
      result.unshift(suiCoin);
    }
    return result;
  }, [coins]);

  if (isLoading || coinsError) return null;
  return (
    <div className={classnames(props.className)} style={props.style}>
      {coinsWithSuiOnTop.map((coin) => {
        return (
          <TokenItem
            key={coin.type}
            type={coin.type}
            symbol={coin.symbol}
            balance={coin.balance}
            decimals={coin.decimals}
            isVerified={coin.isVerified}
          />
        );
      })}
    </div>
  );
};

export default TokenList;
