import * as cbor from 'cbor-web';

// Function logic copied from Microsoft demo implementation: https://github.com/MicrosoftEdge/webauthnsample/blob/master/fido.js
// Decrypt the authData Buffer and split it in its single information pieces. Its structure is specified here: https://w3c.github.io/webauthn/#authenticator-data
export function parseAuthenticatorData(
  authDataBuffer: Buffer
): Record<string, unknown> {
  try {
    // deocde the buffer from cbor, will return an object.
    const authDataBufferDecoded: any = cbor.decode(authDataBuffer);
    const authenticatorData: any = {};
    const authData: Buffer = authDataBufferDecoded.authData;

    authenticatorData.rpIdHash = authData.slice(0, 32);
    authenticatorData.flags = authData[32];
    authenticatorData.signCount =
      (authData[33] << 24) |
      (authData[34] << 16) |
      (authData[35] << 8) |
      authData[36];

    // Check if the client sent attestedCredentialdata, which is necessary for every new public key scheduled. This is indicated by the 6th bit of the flag byte being 1 (See specification at function start for reference)
    if (authenticatorData.flags & 64) {
      // Extract the data from the Buffer. Reference of the structure can be found here: https://w3c.github.io/webauthn/#sctn-attested-credential-data
      const attestedCredentialData: { [key: string]: any } = {};
      attestedCredentialData['aaguid'] = unparse(authData.slice(37, 53)); /// .toUpperCase()
      attestedCredentialData['credentialIdLength'] =
        (authData[53] << 8) | authData[54];
      attestedCredentialData['credentialId'] = authData.slice(
        55,
        55 + attestedCredentialData['credentialIdLength']
      );
      // Public key is the first CBOR element of the remaining buffer
      let publicKeyCoseBufferCbor: Buffer = authData.slice(
        55 + attestedCredentialData['credentialIdLength'],
        authData.length
      );

      const publicKey: any = cbor.decode(publicKeyCoseBufferCbor);
      publicKeyCoseBufferCbor = cbor.encode(publicKey);

      attestedCredentialData['credentialPublicKey'] = publicKeyCoseBufferCbor;

      authenticatorData.attestedCredentialData = attestedCredentialData;
    }

    // Check for extension data in the authData, which is indicated by the 7th bit of the flag byte being 1 (See specification at function start for reference)
    if (authenticatorData.flags & 128) {
      // has extension data

      let extensionDataCbor;

      if (authenticatorData.attestedCredentialData) {
        // if we have attesttestedCredentialData, then extension data is
        // the second element
        extensionDataCbor = cbor.decode(
          // decodeAllSync(
          authData.slice(
            55 + authenticatorData.attestedCredentialData.credentialIdLength,
            authData.length
          )
        );
        extensionDataCbor = extensionDataCbor[1];
      } else {
        // Else it's the first element
        extensionDataCbor = cbor.decode(authData.slice(37, authData.length));
      }

      authenticatorData.extensionData = cbor
        .encode(extensionDataCbor)
        .toString('base64');
    }

    return authenticatorData;
  } catch (e) {
    throw new Error('Authenticator Data could not be parsed');
  }
}

// **`unparse()` - Convert UUID byte array (ala parse()) into a string**
export function unparse(buf: any) {
  // Maps for number <-> hex string conversion
  const _byteToHex: string[] = [];
  const _hexToByte: any = {};
  // eslint-disable-next-line no-var
  for (let i = 0; i < 256; i++) {
    _byteToHex[i] = (i + 0x100).toString(16).substr(1);
    _hexToByte[_byteToHex[i]] = i;
  }
  let i: number = 0;
  const bth = _byteToHex;
  return (
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]] +
    '-' +
    bth[buf[i++]] +
    bth[buf[i++]] +
    '-' +
    bth[buf[i++]] +
    bth[buf[i++]] +
    '-' +
    bth[buf[i++]] +
    bth[buf[i++]] +
    '-' +
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]] +
    bth[buf[i++]]
  );
}
