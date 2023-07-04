import { Extendable } from '../types';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { useEffect } from 'react';
import { useApiClient } from '../hooks/useApiClient';
import { updateAuthed } from '../store/app-context';
import LockPage from '../pages/LockPage';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

const Session = (props: Extendable) => {
  const { authed, usePKP } = useSelector(
    (state: RootState) => state.appContext
  );
  const dispatch = useDispatch();
  const apiClient = useApiClient();
  const { isSetuped, authenticate } = useBiometricAuth();

  async function verifyAuthStatus(ac: AbortController) {
    try {
      await apiClient.callFunc('auth.isAuthed', null);
      dispatch(updateAuthed(true));
    } catch (e) {
      dispatch(updateAuthed(false));
    }
  }

  useEffect(() => {
    if (usePKP === true) return;
    if (!authed) {
      const ac = new AbortController();
      authenticate(ac.signal).catch(() => {});
      return () => {
        ac.abort();
      };
    }
  }, [isSetuped]);

  useEffect(() => {
    if (usePKP === true) return;
    const controller = new AbortController();
    verifyAuthStatus(controller);
    return () => {
      controller.abort();
    };
  }, []);

  if (!usePKP && !authed) return <LockPage />;
  return <>{props.children}</>;
};

export default Session;
