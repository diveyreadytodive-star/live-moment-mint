import axios from 'axios';
import nacl from 'tweetnacl';
import * as anchor from '@coral-xyz/anchor';

export interface AuthState {
  jwt: string;
  apiToken: string;
  expiresAt: number; // epoch ms
}

/** Fetch a guest JWT from TxLINE */
export async function getGuestJwt(apiOrigin: string): Promise<string> {
  const res = await axios.post(`${apiOrigin}/auth/guest/start`);
  return res.data.token as string;
}

/**
 * Activate an API token using the on-chain subscribe tx signature.
 * The message signed is `${txSig}::${jwt}` (no leagues selected).
 */
export async function activateApiToken(
  apiOrigin: string,
  jwt: string,
  txSig: string,
  keypair: anchor.web3.Keypair,
): Promise<string> {
  const message = new TextEncoder().encode(`${txSig}::${jwt}`);
  const signatureBytes = nacl.sign.detached(message, keypair.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString('base64');

  const res = await axios.post(
    `${apiOrigin}/api/token/activate`,
    { txSig, walletSignature, leagues: [] },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return (res.data.token ?? res.data) as string;
}
