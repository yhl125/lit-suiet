import { PKPWallet } from '@suiet/core/src/storage/types';
import { useApiClient } from './useApiClient';
import { useEffect, useState } from 'react';

export function usePKPWallet() {
  const apiClient = useApiClient();
  const [address, setAddress] = useState<string>('');
  const fetchPKPAddress = () => {
    apiClient
      .callFunc<undefined, PKPWallet>('wallet.getPKPWallet', undefined)
      .then((res) => {
        setAddress(res.address);
      });
  };
  useEffect(() => {
    fetchPKPAddress();
  }, []);
  return {
    address,
  };
}
