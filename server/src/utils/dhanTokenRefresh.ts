/**
 * dhanTokenRefresh.ts
 * 
 * Utility to hot-swap the Dhan access token without restarting the server.
 * 
 * NOTE: Dhan API v2 does not expose a public programmatic token generation endpoint.
 * The access token must be obtained daily from: https://login.dhan.co
 * 
 * This module provides:
 *   1. updateDhanToken()   — Updates the in-memory adapter + writes token to .env
 *   2. getDhanTokenInfo()  — Decodes JWT to get expiry info
 *   3. isTokenExpiringSoon() — Returns true if token expires in < X minutes
 */

import fs from 'fs';
import path from 'path';
import { sendTelegramAlert } from './telegramAlert';

// Reference to the live DhanAdapter instance — set via setDhanAdapterRef()
let dhanAdapterRef: any = null;

export function setDhanAdapterRef(adapter: any) {
  dhanAdapterRef = adapter;
}

/**
 * Decode a JWT and return its payload without verifying the signature.
 */
export function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Returns the number of minutes until the Dhan token expires.
 * Returns -1 if the token is already expired or cannot be decoded.
 */
export function getTokenExpiryMinutes(token: string): number {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return -1;

  const nowSeconds = Math.floor(Date.now() / 1000);
  const diffSeconds = payload.exp - nowSeconds;
  return Math.floor(diffSeconds / 60);
}

/**
 * Returns true if the token expires within `thresholdMinutes` (default: 60 min).
 */
export function isTokenExpiringSoon(token: string, thresholdMinutes = 60): boolean {
  const minutesLeft = getTokenExpiryMinutes(token);
  return minutesLeft >= 0 && minutesLeft <= thresholdMinutes;
}

/**
 * Hot-swaps the Dhan access token in both:
 *  a) The live DhanAdapter instance (in-memory, immediate effect)
 *  b) The .env file (persists across restarts)
 * 
 * @param newToken - The fresh Dhan access token from https://login.dhan.co
 */
export async function updateDhanToken(newToken: string): Promise<{ success: boolean; message: string; expiresInMinutes?: number }> {
  if (!newToken || typeof newToken !== 'string' || newToken.split('.').length !== 3) {
    return { success: false, message: 'Invalid token format. Must be a valid JWT.' };
  }

  const expiresInMinutes = getTokenExpiryMinutes(newToken);
  if (expiresInMinutes < 0) {
    return { success: false, message: 'Token is already expired. Please generate a new one from https://login.dhan.co' };
  }

  // 1. Hot-swap in the live adapter instance
  if (dhanAdapterRef) {
    try {
      await dhanAdapterRef.setAccessToken(newToken);
      console.log('[DhanTokenRefresh] ✅ Token hot-swapped in DhanAdapter. Reconnecting WebSocket...');
    } catch (err) {
      console.error('[DhanTokenRefresh] Failed to update adapter:', err);
    }
  } else {
    console.warn('[DhanTokenRefresh] DhanAdapter reference not set. Token not updated in adapter.');
  }

  // 2. Persist to .env file
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8');
      // Replace the existing DHAN_ACCESS_TOKEN line
      envContent = envContent.replace(
        /^DHAN_ACCESS_TOKEN=.*$/m,
        `DHAN_ACCESS_TOKEN=${newToken}`
      );
      fs.writeFileSync(envPath, envContent, 'utf-8');
      console.log('[DhanTokenRefresh] ✅ Token written to .env file successfully.');
    }
  } catch (err) {
    console.error('[DhanTokenRefresh] Warning: Could not write token to .env file:', err);
  }

  const expiryHours = (expiresInMinutes / 60).toFixed(1);
  const successMsg = `✅ Dhan token updated successfully! New token expires in ${expiresInMinutes} minutes (~${expiryHours}h).`;
  console.log(`[DhanTokenRefresh] ${successMsg}`);

  // 3. Send Telegram confirmation
  await sendTelegramAlert(
    `🔑 <b>Trade Grow — Dhan Token Updated</b>\n\n` +
    `✅ New access token applied successfully.\n` +
    `⏳ Token valid for: <b>${expiryHours} hours</b>\n` +
    `📅 Alert will be sent 1 hour before expiry.`
  );

  return { success: true, message: successMsg, expiresInMinutes };
}
