import { useState } from 'react';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { getLoginUrl } from '../../../utils/googleAuth';
import { useApiClient } from '../../../hooks/useApiClient';
import { SignSessionKeyResponse } from '@lit-protocol/types';
import { AppDispatch } from '../../../store';
import { useDispatch } from 'react-redux';
import {
  updateInitialized,
  updateNetworkId,
  updateUsePKP,
} from '../../../store/app-context';
import { useNavigate } from 'react-router-dom';
import { useFeatureFlags } from '../../../hooks/useFeatureFlags';
import Nav from '../../../components/Nav';
import Button from '../../../components/Button';

const Views = {
  SIGN_IN: 'sign_in',
  FETCHING: 'fetching',
  FETCHED: 'fetched',
  MINTING: 'minting',
  MINTED: 'minted',
  CREATING_SESSION: 'creating_session',
  SESSION_CREATED: 'session_created',
  ERROR: 'error',
  HANDLE_REDIRECT: 'handle-redirect',
};

const CreatePKPWalletGoogle = () => {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [view, setView] = useState(Views.SIGN_IN);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [error, setError] = useState<any>();
  const [disableNav, setDiableNav] = useState<boolean>(false);
  const [googleIdToken, setGoogleIdToken] = useState<string>('');
  const [authSigs, setAuthSigs] = useState<SignSessionKeyResponse>();
  const dispatch = useDispatch<AppDispatch>();
  const featureFlags = useFeatureFlags();

  const litNodeClient = new LitNodeClient({
    litNetwork: 'serrano',
    debug: false,
  });

  const handleRedirect = async (idToken: string) => {
    setView(Views.HANDLE_REDIRECT);
    try {
      // Fetch PKPs associated with Google account
      setDiableNav(true);
      setView(Views.FETCHING);
      const pkps = await fetchGooglePKPs(idToken);
      if (pkps.length === 0) {
        await mint(idToken);
      }
      if (pkps.length > 0) {
        await createSession(pkps[0], idToken);
      }
      setView(Views.FETCHED);
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  };

  /**
   * Fetch PKPs associated with the given Google account through the relay server
   *
   * @param {string} idToken - Google ID token
   *
   * @returns PKPs associated with Google account
   */
  async function fetchGooglePKPs(idToken: string | null) {
    // Fetch PKPs associated with Google OAuth
    const body = JSON.stringify({
      idToken,
    });
    // const fetchRes = await fetchPKPs(body);
    const fetchRes = await apiClient.callFunc<any, any>(
      'pkpGoogle.fetchPKPs',
      body
    );
    const { pkps } = fetchRes;
    if (!pkps) {
      throw new Error('Unable to fetch PKPs through relay server');
    }
    return pkps;
  }

  /**
   * Mint a PKP for the given Google account through the relay server
   *
   * @param {string} idToken - Google ID token
   *
   * @returns newly minted PKP
   */
  async function mintGooglePKP(idToken: string) {
    // Mint a new PKP via relay server
    const body = JSON.stringify({
      idToken,
    });
    // const mintRes = await mintPKP(body);
    const mintRes = await apiClient.callFunc<any, any>(
      'pkpGoogle.mintPKP',
      body
    );
    const { requestId } = mintRes;
    if (!requestId) {
      throw new Error('Unable to mint PKP through relay server');
    }

    // Poll for status of minting PKP
    // const pollRes = await pollRequestUntilTerminalState(requestId);
    const pollRes = await apiClient.callFunc<string, any>(
      'pkpGoogle.pollRequestUntilTerminalState',
      requestId
    );
    if (
      !pollRes ||
      !pollRes.pkpTokenId ||
      !pollRes.pkpEthAddress ||
      !pollRes.pkpPublicKey
    ) {
      throw new Error('Missing poll response or new PKP from relay server');
    }
    const newPKP = {
      tokenId: pollRes.pkpTokenId,
      ethAddress: pollRes.pkpEthAddress,
      publicKey: pollRes.pkpPublicKey,
    };
    console.log('newPKP', newPKP);
    return newPKP;
  }

  async function mint(idToken: string) {
    setView(Views.MINTING);
    try {
      // Mint new PKP
      const newPKP = await mintGooglePKP(idToken);

      setView(Views.MINTED);
      setView(Views.CREATING_SESSION);

      // Get session sigs for new PKP
      await createSession(newPKP, idToken);
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  }

  async function createSession(pkp: any, idToken: string) {
    try {
      // Connect to LitNodeClient if not already connected
      if (!litNodeClient.ready) {
        await litNodeClient.connect();
      }

      // Generate session sigs with the given session params
      const DEFAULT_EXP = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 7
      ).toISOString();

      const signSessionKey = await litNodeClient.signSessionKey({
        authMethods: [
          {
            authMethodType: 6,
            accessToken: idToken,
          },
        ],
        pkpPublicKey: pkp.publicKey,
        expiration: DEFAULT_EXP,
        resources: [],
      });

      setAuthSigs(signSessionKey);
      await apiClient.callFunc<SignSessionKeyResponse, string>(
        'wallet.createPKPWallet',
        signSessionKey
      );
      dispatch(updateInitialized(true));
      dispatch(updateUsePKP(true));
      dispatch(updateNetworkId(featureFlags?.default_network ?? 'devnet'));

      setView(Views.SESSION_CREATED);
      navigate('/home');
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  }

  function signInWithGoogle() {
    setGoogleLoading(true);
    // Get login url
    const redierctUri = chrome.identity.getRedirectURL();
    const loginUrl = getLoginUrl(redierctUri);
    // Redirect to login url
    chrome.identity
      .launchWebAuthFlow({ interactive: true, url: loginUrl })
      .then(async (res) => {
        if (!res) {
          throw Error(`res doesn't exist`);
        }
        const idToken = extractAccessToken(res);
        if (!idToken) {
          throw Error(`idToken doesn't exist`);
        }
        setGoogleIdToken(idToken);
        handleRedirect(idToken);
        setGoogleLoading(false);
      })
      .catch((error) => setGoogleLoading(false));
  }
  function extractAccessToken(url: string): string | null {
    const m = url.match(/[#?](.*)/);
    if (!m || m.length < 1) return null;
    const params = new URLSearchParams(m[1].split('#')[0]);
    return params.get('id_token');
  }

  return (
    <div>
      <Nav
        title={'Sign With Google'}
        navDisabled={disableNav}
        onNavBack={() => navigate('/onboard/welcome')}
      />
      {view === Views.ERROR && (
        <div className="error m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10 text-red-500"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-3xl font-medium">Uh oh!</h1>
          {error.message ? (
            <>
              <p className="mb-4">Something went wrong:</p>
              <p className="mb-8 border border-red-500 border-opacity-40 bg-red-900 bg-opacity-5 p-3 text-sm text-red-500">
                {error.message}
              </p>
            </>
          ) : (
            <p className="mb-8">Something went wrong.</p>
          )}
          <button
            className="w-full border px-6 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={() => {
              if (authSigs) {
                setView(Views.SESSION_CREATED);
              } else {
                if (googleIdToken) {
                  setView(Views.FETCHED);
                } else {
                  setView(Views.SIGN_IN);
                }
              }
              setError(null);
            }}
          >
            Got it
          </button>
        </div>
      )}
      {view === Views.SIGN_IN && (
        <div className="signin m-4">
          <h1 className="mb-4 text-3xl font-medium">
            The most secure and customizable wallet that&apos;s 100% yours.
          </h1>
          <p className="mb-6 text-sm">
            Create a self-custody wallet in just a few taps using the latest
            auth flow&mdash;passkeys. No more passwords, no more seed phrases,
            no more extensions.
          </p>
          <div className="px-6 sm:px-0 max-w-sm">
            <Button
              loading={googleLoading}
              onClick={signInWithGoogle}
              className="text-white w-full  bg-[#4285F4] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center justify-between dark:focus:ring-[#4285F4]/55 mr-2 mb-2"
            >
              <svg
                className="mr-2 -ml-1 w-4 h-4"
                aria-hidden="true"
                focusable="false"
                data-prefix="fab"
                data-icon="google"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                ></path>
              </svg>
              Sign in with Google<div></div>
            </Button>
          </div>
        </div>
      )}
      {view === Views.HANDLE_REDIRECT && (
        <div className="handleRedirect m-4">
          <h1 className="mb-4 text-3xl font-medium">
            Verifying your identity...
          </h1>
        </div>
      )}
      {view === Views.FETCHING && (
        <div className="fetching m-4">
          <h1 className="mb-4 text-3xl font-medium">Fetching your PKPs...</h1>
        </div>
      )}
      {view === Views.MINTING && (
        <div className="minting m-4">
          <h1 className="mb-4 text-3xl font-medium">Minting your PKP...</h1>
        </div>
      )}
      {view === Views.MINTED && (
        <div className="minted m-4">
          <h1 className="mb-4 text-3xl font-medium">Minted!</h1>
        </div>
      )}
      {view === Views.CREATING_SESSION && (
        <div className="creatingSession m-4">
          <h1 className="mb-4 text-3xl font-medium">Saving your session...</h1>
        </div>
      )}
      {view === Views.SESSION_CREATED && (
        <div className="sessionCreated m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-3xl font-medium">
            Successfully signed in with Lit
          </h1>
          <p className="mb-6 text-sm">
            You should now be signed in. Refresh this page if you don&apos;t see
            your dashboard.
          </p>
        </div>
      )}
    </div>
  );
};

export default CreatePKPWalletGoogle;
