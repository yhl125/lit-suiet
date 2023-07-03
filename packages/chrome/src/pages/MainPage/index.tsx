import Dashboard from './Dashboard';
import TokenList from './TokenList';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useAccount } from '../../hooks/useAccount';
import { useNftList } from '../../hooks/useNftList';
import AppLayout from '../../layouts/AppLayout';
import { useDappList } from '../../hooks/useDappList';
import BiometricSetup from '../../components/BiometricSetup';
import useTransactionListForHistory from '../TransactionFlow/hooks/useTransactionListForHistory';
import { usePKPWallet } from '../../hooks/usePKPWallet';

function MainPage() {
  const { accountId, networkId, usePKP } = useSelector(
    (state: RootState) => state.appContext
  );
  let address: string;
  if (usePKP) {
    address = usePKPWallet().address;
  } else {
    address = useAccount(accountId).address;
  }
  // prefetch other tabs' data
  useNftList(address);
  useTransactionListForHistory(address);
  useDappList();

  return (
    <AppLayout>
      <Dashboard address={address} networkId={networkId} />
      <BiometricSetup />
      <TokenList />
    </AppLayout>
  );
}

export default MainPage;
