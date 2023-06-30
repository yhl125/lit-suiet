import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { ethers } from 'ethers';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import base64url from 'base64url';
import {
  WebAuthnAuthenticationVerificationParams,
  SignSessionKeyResponse,
  IRelayPollStatusResponse,
} from '@lit-protocol/types';
import { LitAuthClient, WebAuthnProvider } from '@lit-protocol/lit-auth-client';
import { ProviderType } from '@lit-protocol/constants';
import {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/typescript-types';

export interface IPKPRelayApi {
  authenticate: () => Promise<WebAuthnAuthenticationVerificationParams>;
  fetchPKPs: (
    authData: WebAuthnAuthenticationVerificationParams
  ) => Promise<any>;
  register: (username: string) => Promise<any>;
  verifyRegistration: (attResp: any) => Promise<any>;
  pollRequestUntilTerminalState: (requestId: string) => Promise<any>;
  // getAuthSigForWebAuthn: (
  //   authData: WebAuthnAuthenticationVerificationParams
  // ) => Promise<SignSessionKeyResponse>;
}

export class PKPRelayApi implements IPKPRelayApi {
  public DEFAULT_EXP = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  ).toISOString();

  private relayServerUrl = 'https://relay-server-staging.herokuapp.com';
  // process.env.NEXT_PUBLIC_RELAY_API_URL ||
  //! must not commit sercret key! //
  private relayApiKey = 'test';
  private rpcUrl = 'https://chain-rpc.litprotocol.com/http';

  // private litAuthClient = new LitAuthClient({
  //   litRelayConfig: {
  //     relayApiKey: this.relayApiKey,
  //   },
  // });

  // async registerWithWebAuthn(
  //   username: string
  // ): Promise<IRelayPollStatusResponse> {
  //   const provider = this.litAuthClient.initProvider<WebAuthnProvider>(
  //     ProviderType.WebAuthn
  //   );
  //   // Register new WebAuthn credential
  //   const options = await provider.register(username);
  //   // Verify registration and mint PKP through relay server
  //   const txHash = await provider.verifyAndMintPKPThroughRelayer(options);
  //   const response = await provider.relay.pollRequestUntilTerminalState(txHash);
  //   // Return public key of newly minted PKP
  //   return response;
  // }

  async register(username: string) {
    // Generate registration options for the browser to pass to a supported authenticator
    let publicKeyCredentialCreationOptions = null;

    let url = `https://lit-relay-helper.vercel.app/lit/register?username=${username}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    return response;
  }

  async verifyRegistration(attResp: any) {
    // Submit registration options to the authenticator
    // const attResp = await startRegistration(options);
    // Send the credential to the relying party for verification
    let verificationJSON = null;

    const response = await fetch(
      `${this.relayServerUrl}/auth/webauthn/verify-registration`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.relayApiKey,
        },
        body: JSON.stringify({ credential: attResp }),
      }
    );
    if (response.status < 200 || response.status >= 400) {
      const errorJson = await response.json();
      const errorMsg = errorJson.error || 'Unknown error';
      const relayErr = new Error(`Unable to verify registration: ${errorMsg}`);
      throw relayErr;
    }

    verificationJSON = await response.json();
    // console.log('verificationJSON', verificationJSON);

    // If the credential was verified and registration successful, minting has kicked off
    if (verificationJSON && verificationJSON.requestId) {
      return verificationJSON.requestId;
    } else {
      const err = new Error(
        `WebAuthn registration error: ${JSON.stringify(verificationJSON)}`
      );
      throw err;
    }
  }

  // Poll the relay server for status of minting request
  async pollRequestUntilTerminalState(requestId: string) {
    const maxPollCount = 20;
    for (let i = 0; i < maxPollCount; i++) {
      const response = await fetch(
        `${this.relayServerUrl}/auth/status/${requestId}`,
        {
          method: 'GET',
          headers: {
            'api-key': this.relayApiKey,
          },
        }
      );

      if (response.status < 200 || response.status >= 400) {
        const err = new Error(
          `Unable to poll the status of this mint PKP transaction: ${requestId}`
        );
        throw err;
      }

      const resBody = await response.json();
      if (resBody.error) {
        // Exit loop since error
        const err = new Error(resBody.error);
        throw err;
      } else if (resBody.status === 'Succeeded') {
        // Exit loop since success
        return resBody;
      }

      // otherwise, sleep then continue polling
      await new Promise((r) => setTimeout(r, 1000));
    }

    // At this point, polling ended and still no success, set failure status
    // console.error(`Hmm this is taking longer than expected...`);
    const err = new Error('Polling for mint PKP transaction status timed out');
    throw err;
  }

  async authenticate() {
    const provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);

    const block = await provider.getBlock('latest');
    const blockHash = block.hash;

    // Turn into byte array.
    const blockHashBytes = ethers.utils.arrayify(blockHash);

    // Construct authentication options.
    const rpId = this.getDomainFromOrigin('localhost');
    // console.log('Using rpId: ', { rpId });
    const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = {
      challenge: base64url(Buffer.from(blockHashBytes)),
      timeout: 60000,
      userVerification: 'preferred',
      rpId,
    };

    // Authenticate with WebAuthn.
    const authenticationResponse = await startAuthentication(
      authenticationOptions
    );

    // BUG: We need to make sure userHandle is base64url encoded.
    // Deep copy the authentication response.
    const actualAuthenticationResponse: WebAuthnAuthenticationVerificationParams =
      JSON.parse(JSON.stringify(authenticationResponse));
    actualAuthenticationResponse.response.userHandle = base64url.encode(
      authenticationResponse.response.userHandle || ''
    );

    return actualAuthenticationResponse;
  }

  // async getAuthSigForWebAuthn(
  //   authData: WebAuthnAuthenticationVerificationParams
  // ) {
  //   const litNodeClient = new LitNodeClient({
  //     litNetwork: 'serrano',
  //     debug: false,
  //   });
  //   await litNodeClient.connect();

  //   const authMethod = litNodeClient.generateAuthMethodForWebAuthn(authData);
  //   const signSessionKeyResponse = await litNodeClient.signSessionKey({
  //     authMethods: [authMethod],
  //     expiration: this.DEFAULT_EXP,
  //     resources: [],
  //   });
  //   return signSessionKeyResponse;
  // }

  async fetchPKPs(authData: WebAuthnAuthenticationVerificationParams) {
    const fetchRes = await fetch(
      `${this.relayServerUrl}/auth/webauthn/userinfo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.relayApiKey,
        },
        body: JSON.stringify({ credential: authData }),
      }
    );
    if (fetchRes.status < 200 || fetchRes.status >= 400) {
      const errorJson = await fetchRes.json();
      const errorMsg = errorJson.error || 'Unknown error';
      const relayErr = new Error(`Unable to fetch PKPs: ${errorMsg}`);
      throw relayErr;
    }
    const fetchJSON = await fetchRes.json();
    return fetchJSON.pkps;
  }

  getDomainFromOrigin(origin: string) {
    // remove protocol with regex
    let newOrigin = origin.replace(/(^\w+:|^)\/\//, '');
    // remove port with regex
    return newOrigin.replace(/:\d+$/, '');
  }
}
