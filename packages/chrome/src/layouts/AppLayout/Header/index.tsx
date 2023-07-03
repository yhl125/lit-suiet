import styles from './index.module.scss';
import IconArrowRight from '../../../assets/icons/arrow-right.svg';
import classnames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { getAddress } from '../../../hooks/useAccount';
import { useEffect, useMemo, useState } from 'react';
import WalletSwitcher, { WalletData } from '../../../components/WalletSwitcher';
import { useWallets } from '../../../hooks/useWallets';
import { isNonEmptyArray } from '../../../utils/check';
import { useNavigate } from 'react-router-dom';
import { updateAccountId, updateWalletId } from '../../../store/app-context';
import { PageEntry } from '../../../hooks/usePageEntry';
import { Extendable } from '../../../types';
import Address from '../../../components/Address';
import Avatar from '../../../components/Avatar';
import { useWallet } from '../../../hooks/useWallet';
import { AccountInWallet, Wallet } from '@suiet/core';
import { useApiClient } from '../../../hooks/useApiClient';
import { useGetAddress } from '../../../hooks/usePKPWallet';

function useWalletAccountMap(wallets: Wallet[]) {
  const apiClient = useApiClient();
  const [walletAccountMap, setWalletAccountMap] = useState<
    Map<string, AccountInWallet>
  >(new Map());

  function searchDefaultAccount(wallet: Wallet) {
    const sortedAccounts = [...wallet.accounts];
    sortedAccounts.sort((a, b) => (a.id < b.id ? 0 : 1));
    return sortedAccounts[0];
  }

  // generate defaultAccount map
  useEffect(() => {
    if (!isNonEmptyArray(wallets)) return;

    (async function () {
      const map = new Map<string, AccountInWallet>();
      const accounts = wallets.map((wallet) => searchDefaultAccount(wallet));
      // NOTE: use calculated addresses for safety concern
      const addresses = await getAddress(apiClient, {
        batchAccountIds: accounts.map((ac) => ac.id),
      });
      wallets.forEach((wallet, index) => {
        map.set(wallet.id, {
          id: accounts[index].id,
          address: addresses[index],
        });
      });
      setWalletAccountMap(map);
    })();
  }, [apiClient, wallets]);

  return walletAccountMap;
}

export type HeaderProps = Extendable & {
  openSwitcher?: boolean;
};

const WalletSwitcherInstance = (props: {
  onSelect: (id: string, wallet: WalletData) => void;
  onEdit: (id: string, wallet: WalletData) => void;
  onClickLayer: () => void;
  onClickImport: () => void;
  onClickNew: () => void;
}) => {
  const { data: wallets = [] } = useWallets();
  const walletAccountMap = useWalletAccountMap(wallets);
  const walletDataList = useMemo(() => {
    if (!isNonEmptyArray(wallets) || walletAccountMap.size === 0) return [];
    return wallets.map(walletDataAdapter);
  }, [wallets, walletAccountMap]);

  function walletDataAdapter(wallet: Wallet): WalletData {
    const account = walletAccountMap.get(wallet.id);
    return {
      id: wallet.id,
      name: wallet.name,
      avatar: wallet.avatar,
      accountId: account?.id ?? '',
      accountAddress: account?.address ?? '',
    };
  }

  return (
    <WalletSwitcher
      wallets={walletDataList}
      onSelect={props.onSelect}
      onEdit={props.onEdit}
      onClickLayer={props.onClickLayer}
      onClickNew={props.onClickNew}
      onClickImport={props.onClickImport}
    />
  );
};

function Header(props: HeaderProps) {
  const { openSwitcher = false } = props;
  const { context } = useSelector((state: RootState) => ({
    context: state.appContext,
  }));
  const [doSwitch, setDoSwitch] = useState<boolean>(openSwitcher);
  const navigate = useNavigate();
  const address = useGetAddress(context.usePKP, context.accountId);

  const dispatch = useDispatch<AppDispatch>();
  const { data: wallet } = useWallet(context.walletId);

  async function switchWallet(id: string, data: WalletData) {
    await Promise.all([
      dispatch(updateWalletId(id)),
      dispatch(updateAccountId(data.accountId)),
    ]);
    setDoSwitch(false);
    navigate('/');
  }

  async function editWallet(id: string, data: WalletData) {
    await Promise.all([
      dispatch(updateWalletId(id)),
      dispatch(updateAccountId(data.accountId)),
    ]);
    navigate('/settings/wallet', {
      state: {
        hideAppLayout: true,
      },
    });
  }

  return (
    <div className={classnames(styles['header-container'], props.className)}>
      <Avatar size={'sm'} model={wallet?.avatar} />
      <div
        className={styles['account']}
        onClick={() => {
          setDoSwitch(true);
        }}
      >
        <span className={styles['account-name']}>{wallet?.name}</span>
        <img className="ml-[6px]" src={IconArrowRight} alt="arrow right" />
      </div>
      <Address
        suins={true}
        value={address}
        hideCopy={true}
        className={classnames(styles['address'], 'ml-[18px]')}
      />
      <div
        className={classnames(
          styles['net'],
          styles['net-' + context.networkId]
        )}
        onClick={() => {
          navigate('/settings/network');
        }}
      >
        {context.networkId}
      </div>

      {doSwitch && (
        <WalletSwitcherInstance
          onSelect={switchWallet}
          onEdit={editWallet}
          onClickLayer={() => {
            setDoSwitch(false);
          }}
          onClickNew={() => {
            navigate('/wallet/create', {
              state: { pageEntry: PageEntry.SWITCHER },
            });
          }}
          onClickImport={() => {
            navigate('/wallet/import', {
              state: { pageEntry: PageEntry.SWITCHER },
            });
          }}
        />
      )}
    </div>
  );
}
export default Header;
