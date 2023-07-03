import { useState } from 'react';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { getLoginUrl } from '../../../utils/googleAuth';
import { useApiClient } from '../../../hooks/useApiClient';
import { SignSessionKeyResponse } from '@lit-protocol/types';
import { AppDispatch } from '../../../store';
import { useDispatch } from 'react-redux';
import { updateInitialized, updateUsePKP } from '../../../store/app-context';

interface IPKP {
  tokenId: string;
  ethAddress: string;
  publicKey: string;
}
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

const CreateNewPKPWalletGoogle = () => {
  const apiClient = useApiClient();
  const [view, setView] = useState(Views.SIGN_IN);
  const [error, setError] = useState<any>();

  const [googleIdToken, setGoogleIdToken] = useState<string>('');
  const [pkps, setPKPs] = useState<IPKP[]>([]);
  const [currentPKP, setCurrentPKP] = useState<IPKP>();
  const [authSigs, setAuthSigs] = useState<SignSessionKeyResponse>();
  const dispatch = useDispatch<AppDispatch>();

  const litNodeClient = new LitNodeClient({
    litNetwork: 'serrano',
    debug: false,
  });

  const handleRedirect = async (idToken: string) => {
    setView(Views.HANDLE_REDIRECT);
    try {
      // Fetch PKPs associated with Google account
      setView(Views.FETCHING);
      const pkps = await fetchGooglePKPs(idToken);
      if (pkps.length > 0) {
        setPKPs(pkps);
      }
      setView(Views.FETCHED);
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  };

  async function mint() {
    setView(Views.MINTING);

    try {
      // Mint new PKP
      const newPKP = await mintGooglePKP(googleIdToken);
      console.log('newPKP', newPKP);

      // Add new PKP to list of PKPs
      const morePKPs = [...pkps, newPKP];
      setPKPs(morePKPs);

      setView(Views.MINTED);
      setView(Views.CREATING_SESSION);

      // Get session sigs for new PKP
      await createSession(newPKP);
      await dispatch(updateInitialized(true));
      await dispatch(updateUsePKP(true));
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  }

  async function createSession(pkp: any) {
    setView(Views.CREATING_SESSION);

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
            accessToken: googleIdToken,
          },
        ],
        pkpPublicKey: pkp.publicKey,
        expiration: DEFAULT_EXP,
        resources: [],
      });
      console.log('signSessionKey', signSessionKey);

      setCurrentPKP(pkp);
      setAuthSigs(signSessionKey);
      const wallet = await apiClient.callFunc<SignSessionKeyResponse, string>(
        'wallet.createPKPWallet',
        signSessionKey
      );
      console.log('wallet', wallet);

      setView(Views.SESSION_CREATED);
    } catch (err) {
      setError(err);
      setView(Views.ERROR);
    }
  }

  function signInWithGoogle() {
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
      });
  }
  function extractAccessToken(url: string): string | null {
    const m = url.match(/[#?](.*)/);
    if (!m || m.length < 1) return null;
    const params = new URLSearchParams(m[1].split('#')[0]);
    return params.get('id_token');
  }

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
    return newPKP;
  }

  return (
    <>
      <main>
        {view === Views.ERROR && (
          <>
            <h1>Error</h1>
            <p>{error.message}</p>
            <button
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
          </>
        )}
        {view === Views.SIGN_IN && (
          <>
            <h1>Sign in with Lit</h1>
            <button onClick={signInWithGoogle}>Google</button>
          </>
        )}
        {view === Views.HANDLE_REDIRECT && (
          <>
            <h1>Verifying your identity...</h1>
          </>
        )}
        {view === Views.FETCHING && (
          <>
            <h1>Fetching your PKPs...</h1>
          </>
        )}
        {view === Views.FETCHED && (
          <>
            {pkps.length > 0 ? (
              <>
                <h1>Select a PKP to continue</h1>
                {/* Select a PKP to create session sigs for */}
                <div>
                  {pkps.map((pkp) => (
                    <button
                      key={pkp.ethAddress}
                      onClick={async () => await createSession(pkp)}
                    >
                      {pkp.ethAddress}
                    </button>
                  ))}
                </div>
                <hr></hr>
                {/* Or mint another PKP */}
                <p>or mint another one:</p>
                <button onClick={mint}>Mint another PKP</button>
              </>
            ) : (
              <>
                <h1>Mint a PKP to continue</h1>
                <button onClick={mint}>Mint a PKP</button>
              </>
            )}
          </>
        )}
        {view === Views.MINTING && (
          <>
            <h1>Minting your PKP...</h1>
          </>
        )}
        {view === Views.MINTED && (
          <>
            <h1>Minted!</h1>
          </>
        )}
        {view === Views.CREATING_SESSION && (
          <>
            <h1>Saving your session...</h1>
          </>
        )}
        {/* {view === Views.SESSION_CREATED && (
          <>
            <h1>Ready for the open web</h1>
            <div>
              <p>Check out your PKP:</p>
              <p>{currentPKP.ethAddress}</p>
            </div>
            <hr></hr>
            <div>
              <p>Sign this message with your PKP:</p>
              <p>{message}</p>
              <button onClick={signMessage}>Sign message</button>

              {signature && (
                <>
                  <h3>Your signature:</h3>
                  <p>{signature}</p>
                  <h3>Recovered address:</h3>
                  <p>{recoveredAddress}</p>
                  <h3>Verified:</h3>
                  <p>{verified ? 'true' : 'false'}</p>
                </>
              )}
            </div>
          </>
        )} */}
      </main>
    </>
  );
};

export default CreateNewPKPWalletGoogle;
