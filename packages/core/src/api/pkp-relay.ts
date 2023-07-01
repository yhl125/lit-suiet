import { ethers, utils } from 'ethers';
import { startAuthentication } from '@simplewebauthn/browser';
import base64url from 'base64url';
import {
  WebAuthnAuthenticationVerificationParams,
  IRelayMintResponse,
} from '@lit-protocol/types';
import { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/typescript-types';
import {
  parseCreationOptionsFromJSON,
  CredentialCreationOptionsJSON,
} from '@github/webauthn-json/browser-ponyfill';
import { hexlify, toUtf8Bytes } from 'ethers/lib/utils';
import { AuthMethodType } from '@lit-protocol/constants';
import { parseAuthenticatorData } from './lit-utils';

export interface IPKPRelayApi {
  authenticate: () => Promise<WebAuthnAuthenticationVerificationParams>;
  fetchPKPs: (
    authData: WebAuthnAuthenticationVerificationParams
  ) => Promise<any>;
  register: (username: string) => Promise<any>;
  verifyAndMintPKPThroughRelayer: (attResp: any) => Promise<any>;
  pollRequestUntilTerminalState: (requestId: string) => Promise<any>;
  // getAuthSigForWebAuthn: (
  //   authData: WebAuthnAuthenticationVerificationParams
  // ) => Promise<SignSessionKeyResponse>;
}

export class PKPRelayApi implements IPKPRelayApi {
  public DEFAULT_EXP = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  ).toISOString();

  // LIT-Protocol/relay-server feature/lit-462-remove-verification-steps-from-relayer-required-before
  private readonly relayServerUrl =
    'http://ec2-13-212-154-129.ap-southeast-1.compute.amazonaws.com:3001';

  private readonly relayApiKey = 'test';
  private readonly rpcUrl = 'https://chain-rpc.litprotocol.com/http';

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
    const url = `https://lit-relay-helper.vercel.app/lit/register?username=${username}`;
    const response = await fetch(url, {
      method: 'GET',
    });

    return this.registerResponseToCredentialCreationOptions(
      await response.json()
    );
  }

  registerResponseToCredentialCreationOptions(response: any) {
    const creationOptionsJson = {
      publicKey: {
        ...response,
        rp: {
          name: response.rp.name,
        },
      },
    };
    return creationOptionsJson;
  }

  async verifyAndMintPKPThroughRelayer(attResp: any) {
    // Submit registration options to the authenticator
    // const attResp = await startRegistration(options);
    // Send the credential to the relying party for verification
    const authMethodId: string = this.generateAuthMethodId(attResp.rawId);

    // create a buffer object from the base64 encoded content.
    const attestationBuffer = Buffer.from(
      attResp.response.attestationObject,
      'base64'
    );

    let publicKey: string;
    try {
      // parse the buffer to reconstruct the object.
      // buffer is COSE formatted, utilities decode the buffer into json, and extract the public key information
      const authenticationResponse: any =
        parseAuthenticatorData(attestationBuffer);
      // publickey in cose format to register the auth method
      const publicKeyCoseBuffer: Buffer = authenticationResponse
        .attestedCredentialData.credentialPublicKey as Buffer;
      // Encode the publicKey for contract storage
      publicKey = hexlify(ethers.utils.arrayify(publicKeyCoseBuffer));
    } catch (e) {
      throw new Error(
        `Error while decoding credential create response for public key retrieval. attestation response not encoded as expected: ${e}`
      );
    }

    const req = {
      authMethodType: AuthMethodType.WebAuthn,
      authMethodId,
      authMethodPubKey: publicKey,
    };
    console.log('Minting input', req);
    const mintRes = await this.mintPKP(
      AuthMethodType.WebAuthn,
      JSON.stringify(req)
    );
    if (!mintRes || !mintRes.requestId) {
      throw new Error('Missing mint response or request ID from relay server');
    }
    // If the credential was verified and registration successful, minting has kicked off
    return mintRes.requestId;
  }

  private generateAuthMethodId(credentialRawId: string): string {
    return utils.keccak256(toUtf8Bytes(`${credentialRawId}:lit`));
  }

  /**
   * Mint a new PKP for the given auth method
   *
   * @param {AuthMethodType} authMethodType - Auth method type
   * @param {string} body - Body of the request
   *
   * @returns {Promise<IRelayMintResponse>} Response from the relay server
   */
  public async mintPKP(
    authMethodType: AuthMethodType,
    body: string
  ): Promise<IRelayMintResponse> {
    const route = this._getMintPKPRoute(authMethodType);
    const response = await fetch(`${this.relayServerUrl}${route}`, {
      method: 'POST',
      headers: {
        'api-key': this.relayApiKey,
        'Content-Type': 'application/json',
      },
      body,
    });
    console.log('Minting PKP with relay server', response);

    if (response.status < 200 || response.status >= 400) {
      console.warn('Something wrong with the API call', await response.json());
      const err = new Error('Unable to mint PKP through relay server');
      throw err;
    } else {
      const resBody = await response.json();
      console.log('Successfully initiated minting PKP with relayer');
      return resBody;
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
    // const rpId = this.getDomainFromOrigin(
    //   'https://lit-relay-helper.vercel.app'
    // );
    // console.log('Using rpId: ', { rpId });
    const authenticationOptions: PublicKeyCredentialRequestOptionsJSON = {
      challenge: base64url(Buffer.from(blockHashBytes)),
      timeout: 60000,
      userVerification: 'preferred',
      // rpId,
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
      authenticationResponse.response.userHandle ?? ''
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
    const newOrigin = origin.replace(/(^\w+:|^)\/\//, '');
    // remove port with regex
    return newOrigin.replace(/:\d+$/, '');
  }

  /**
   * Get route for minting PKPs
   *
   * @param {AuthMethodType} authMethodType - Auth method type
   *
   * @returns {string} Minting route
   */
  private _getMintPKPRoute(authMethodType: AuthMethodType): string {
    switch (authMethodType) {
      case AuthMethodType.EthWallet:
      case AuthMethodType.Discord:
      case AuthMethodType.GoogleJwt:
      case AuthMethodType.OTP:
        return '/auth';
      case AuthMethodType.WebAuthn:
        return '/auth/webauthn/registration';
      default:
        throw new Error(
          `Auth method type "${authMethodType}" is not supported`
        );
    }
  }
}
