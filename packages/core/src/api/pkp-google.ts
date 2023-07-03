export interface IPKPRelayApi {
  fetchPKPs: (body: any) => Promise<any>;
  mintPKP: (body: any) => Promise<any>;
  pollRequestUntilTerminalState: (requestId: string) => Promise<any>;
}

export class PKPGoogleApi implements IPKPRelayApi {
  // LIT-Protocol/relay-server feature/lit-462-remove-verification-steps-from-relayer-required-before
  private readonly relayServerUrl =
    'https://relay-server-staging.herokuapp.com';

  private readonly relayApiKey = 'test';
  private readonly rpcUrl = 'https://chain-rpc.litprotocol.com/http';

  async fetchPKPs(body: any) {
    const response = await fetch(
      `${this.relayServerUrl}/auth/google/userinfo`,
      {
        method: 'POST',
        headers: {
          'api-key': this.relayApiKey,
          'Content-Type': 'application/json',
        },
        body,
      }
    );

    if (response.status < 200 || response.status >= 400) {
      console.warn('Something wrong with the API call', await response.json());
      const err = new Error('Unable to fetch PKPs through relay server');
      throw err;
    } else {
      const resBody = await response.json();
      console.log('Response OK', { body: resBody });
      console.log('Successfully fetched PKPs with relayer');
      return resBody;
    }
  }

  async mintPKP(body: any) {
    const response = await fetch(`${this.relayServerUrl}/auth/google`, {
      method: 'POST',
      headers: {
        'api-key': this.relayApiKey,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (response.status < 200 || response.status >= 400) {
      console.warn('Something wrong with the API call', await response.json());
      const err = new Error('Unable to mint PKP through relay server');
      throw err;
    } else {
      const resBody = await response.json();
      console.log('Response OK', { body: resBody });
      console.log('Successfully initiated minting PKP with relayer');
      return resBody;
    }
  }

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
        console.warn(
          'Something wrong with the API call',
          await response.json()
        );
        const err = new Error(
          `Unable to poll the status of this mint PKP transaction: ${requestId}`
        );
        throw err;
      }

      const resBody = await response.json();
      console.log('Response OK', { body: resBody });

      if (resBody.error) {
        // exit loop since error
        console.warn('Something wrong with the API call', {
          error: resBody.error,
        });
        const err = new Error(resBody.error);
        throw err;
      } else if (resBody.status === 'Succeeded') {
        // exit loop since success
        console.info('Successfully authed', { ...resBody });
        return resBody;
      }

      // otherwise, sleep then continue polling
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    // at this point, polling ended and still no success, set failure status
    // console.error(`Hmm this is taking longer than expected...`);
    const err = new Error('Polling for mint PKP transaction status timed out');
    throw err;
  }
}
