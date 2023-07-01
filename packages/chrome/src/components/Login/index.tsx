import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useApiClient } from '../../hooks/useApiClient';
import { AppDispatch, RootState } from '../../store';
import { setAuthenticated, setPKP } from '../../store/pkp-context';
import {
  WebAuthnAuthenticationVerificationParams,
  SignSessionKeyResponse,
  IRelayPollStatusResponse,
} from '@lit-protocol/types';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import {
  create,
  get,
  parseCreationOptionsFromJSON,
} from '@github/webauthn-json/browser-ponyfill';
import base64url from 'base64url';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

const LoginViews = {
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  REGISTERING: 'registering',
  AUTHENTICATING: 'authenticating',
  MINTING: 'minting',
  MINTED: 'minted',
  CREATING_SESSION: 'creating_session',
  SESSION_CREATED: 'session_created',
  ERROR: 'error',
};

export default function Login() {
  const dispatch = useDispatch<AppDispatch>();
  const apiClient = useApiClient();

  // App state
  const pkpContext = useSelector((state: RootState) => state.pkpContext);

  // For UI
  const [view, setView] = useState(LoginViews.SIGN_IN);
  const [errorMsg, setErrorMsg] = useState('');

  // Current user
  const [username, setUsername] = useState('');

  // Update view if error has occured
  function onError(msg: string) {
    setErrorMsg(msg);
    setView(LoginViews.ERROR);
  }

  async function createPKPWithWebAuthn(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setView(LoginViews.REGISTERING);

    try {
      setView(LoginViews.MINTING);
      const options = await apiClient.callFunc<string, any>(
        'pkpRelay.register',
        username
      );

      // Poll minting status
      const attResp = await create(parseCreationOptionsFromJSON(options));
      const pollRes = await apiClient.callFunc<any, any>(
        'pkpRelay.verifyAndMintPKPThroughRelayer',
        attResp
      );
      if (pollRes) {
        const newPKP = {
          tokenId: pollRes.pkpTokenId,
          publicKey: pollRes.pkpPublicKey,
          ethAddress: pollRes.pkpEthAddress,
        };
        setView(LoginViews.MINTED);
        dispatch(setPKP(newPKP));
      } else {
        throw new Error(`Unable to poll minting status: ${pollRes}`);
      }
    } catch (e) {
      if (typeof e === 'string') {
        onError(e);
      } else if (e instanceof Error) {
        onError(e.message);
      }
    }
  }

  async function authThenGetSessionSigs(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();

    setView(LoginViews.AUTHENTICATING);

    try {
      const authenticationOptions = await apiClient.callFunc<
        undefined,
        PublicKeyCredentialRequestOptionsJSON
      >('pkpRelay.authenticationOptions', undefined);

      // Authenticate with WebAuthn.
      const authenticationResponse = await startAuthentication(
        authenticationOptions
      );

      // const a = await get();

      // BUG: We need to make sure userHandle is base64url encoded.
      // Deep copy the authentication response.
      const authData: WebAuthnAuthenticationVerificationParams = JSON.parse(
        JSON.stringify(authenticationResponse)
      );
      authData.response.userHandle = base64url.encode(
        authenticationResponse.response.userHandle ?? ''
      );
      console.log('authData', authData);

      // const pkps = await apiClient.callFunc<
      //   WebAuthnAuthenticationVerificationParams,
      //   any
      // >('pkpRelay.fetchPKPs', authData);
      // console.log('pkps', pkps);
      let pkpToAuthWith = pkpContext.currentPKP;
      if (!pkpToAuthWith) {
        // const pkps = await fetchPKPs(authData);
        const pkps = await apiClient.callFunc<
          WebAuthnAuthenticationVerificationParams,
          any
        >('pkpRelay.fetchPKPs', authData);
        if (pkps.length === 0) {
          throw new Error(
            'No PKPs found for this passkey. Please register a new passkey to mint a new PKP.'
          );
        } else {
          pkpToAuthWith = pkps[0];
          if (!pkpToAuthWith)
            throw new Error('No PKPs found for this passkey.');
        }
      }

      // Authenticate with a WebAuthn credential and create session sigs with authentication data
      setView(LoginViews.CREATING_SESSION);

      // const litResource = new LitPKPResource(pkpToAuthWith.tokenId);
      // const sessionSigs = await getSessionSigsForWebAuthn(
      //   pkpToAuthWith.publicKey,
      //   authData,
      //   litResource
      // );

      // const { authSig, pkpPublicKey } = await apiClient.callFunc<
      //   WebAuthnAuthenticationVerificationParams,
      //   SignSessionKeyResponse
      // >('pkpRelay.getAuthSigForWebAuthn', authData);
      const { authSig, pkpPublicKey } = await getAuthSigForWebAuthn(authData);
      console.log('authSig', authSig);
      console.log('pkpPublicKey', pkpPublicKey);

      setView(LoginViews.SESSION_CREATED);

      const DEFAULT_EXP = new Date(
        Date.now() + 1000 * 60 * 60 * 24 * 7
      ).toISOString();

      const pkpAuth = {
        username: username,
        pkp: pkpToAuthWith,
        sessionExpiration: DEFAULT_EXP,
        authsig: authSig,
      };
      dispatch(setAuthenticated(pkpAuth));
    } catch (e) {
      console.log('wow e', e);
      if (typeof e === 'string') {
        onError(e);
      } else if (e instanceof Error) {
        onError(e.message);
      }
    }
  }
  const DEFAULT_EXP = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  ).toISOString();

  async function getAuthSigForWebAuthn(
    authData: WebAuthnAuthenticationVerificationParams
  ) {
    const litNodeClient = new LitNodeClient({
      litNetwork: 'serrano',
      debug: false,
    });
    console.log('Lit node client');
    await litNodeClient.connect();
    console.log('Lit node client connected');

    const authMethod = litNodeClient.generateAuthMethodForWebAuthn(authData);
    console.log('Auth method', authMethod);
    const signSessionKeyResponse = await litNodeClient.signSessionKey({
      authMethods: [authMethod],
      expiration: DEFAULT_EXP,
      resources: [],
    });
    console.log('Sign session key response', signSessionKeyResponse);
    return signSessionKeyResponse;
  }

  return (
    <>
      {view === LoginViews.ERROR && (
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
          {errorMsg ? (
            <>
              <p className="mb-4">Something went wrong:</p>
              <p className="mb-8 border border-red-500 border-opacity-40 bg-red-900 bg-opacity-5 p-3 text-sm text-red-500">
                {errorMsg}
              </p>
            </>
          ) : (
            <p className="mb-8">Something went wrong.</p>
          )}
          {pkpContext.currentPKP ? (
            <button
              className="w-full border px-6 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
              onClick={() => setView(LoginViews.MINTED)}
            >
              Try again
            </button>
          ) : (
            <button
              className="w-full border px-6 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
              onClick={() => setView(LoginViews.SIGN_UP)}
            >
              Go back
            </button>
          )}
        </div>
      )}
      {view === LoginViews.SIGN_UP && (
        <div className="signup m-4">
          <h1 className="mb-4 text-3xl font-medium">
            The most secure and customizable wallet that&apos;s 100% yours.
          </h1>
          <p className="mb-6 text-sm">
            Create a self-custody wallet in just a few taps using the latest
            auth flow&mdash;passkeys. No more passwords, no more seed phrases,
            no more extensions.
          </p>
          <form onSubmit={createPKPWithWebAuthn} className="w-100 mb-3">
            <div className="mb-6">
              <label htmlFor="username" className="block text-base">
                Your passkey name
              </label>
              <div className="mt-1">
                <input
                  name="username"
                  type="text"
                  autoComplete="username webauthn"
                  aria-describedby="username-field"
                  placeholder='e.g. "Eth Denver 2023"'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-bordered input w-full"
                />
              </div>
              <p id="username-field" className="mt-2 text-sm">
                Give your passkey a unique name.
              </p>
            </div>
            <button type="submit" className="btn-outline btn w-full">
              Sign up
            </button>
          </form>
          <div className="text-center text-sm">
            Have a wallet?{' '}
            <button
              className="text-indigo-400 hover:text-indigo-500 hover:underline"
              onClick={() => setView(LoginViews.SIGN_IN)}
            >
              Sign in
            </button>
          </div>
        </div>
      )}
      {view === LoginViews.REGISTERING && (
        <div className="registering m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10 animate-pulse"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-3xl font-medium">
            Register your passkey
          </h1>
          <p className="mb-6 text-sm">
            Follow your browser&apos;s prompts to create a passkey.
          </p>
        </div>
      )}
      {view === LoginViews.MINTING && (
        <div className="minting m-4">
          <h1 className="mb-4 mt-6 text-2xl font-medium">
            Registration successful! Minting your new wallet...
          </h1>
          <p className="mb-6 text-sm">
            Hang tight and keep this page open as your cloud wallet is being
            minted on-chain.
          </p>
        </div>
      )}
      {view === LoginViews.MINTED && (
        <div className="minted m-4">
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
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-3xl font-medium">
            You&apos;ve created a wallet!
          </h1>
          <p className="mb-6 text-sm">
            To start using your new cloud wallet, you&apos;ll need to
            authenticate with your newly registered passkey. Continue when
            you&apos;re ready.
          </p>
          <button
            className="btn-outline btn-success btn w-full"
            onClick={authThenGetSessionSigs}
          >
            Continue
          </button>
        </div>
      )}
      {view === LoginViews.AUTHENTICATING && (
        <div className="authenticating m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10 animate-pulse"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-3xl font-medium">
            Authenticate with your passkey
          </h1>
          <p className="mb-6 text-sm">
            Follow your browser&apos;s prompts to authenticate with your
            passkey.
          </p>
        </div>
      )}
      {view === LoginViews.CREATING_SESSION && (
        <div className="creatingSession m-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-10 w-10 animate-pulse"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
          <h1 className="mb-4 mt-6 text-2xl font-medium">
            Authentication successful! Securing your session...
          </h1>
          <p className="mb-6 text-sm">
            Creating a secured session so you can use your new cloud wallet
            momentarily.
          </p>
        </div>
      )}
      {view === LoginViews.SESSION_CREATED && (
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
      {view === LoginViews.SIGN_IN && (
        <div className="signin m-4">
          <h1 className="mb-4 text-3xl font-medium">Welcome back</h1>
          <p className="mb-8 text-sm">
            Navigate the open web with a secure, self-custody wallet that you
            can easily tailor to your needs.
          </p>
          <div className="w-100 mb-3">
            <button
              onClick={authThenGetSessionSigs}
              className="btn-outline btn w-full"
            >
              Sign in
            </button>
          </div>
          <div className="text-center text-sm">
            Need a cloud wallet?{' '}
            <button
              onClick={() => setView(LoginViews.SIGN_UP)}
              className="text-indigo-400 hover:text-indigo-500 hover:underline focus:outline-none"
            >
              Create one
            </button>
          </div>
        </div>
      )}
    </>
  );
}
