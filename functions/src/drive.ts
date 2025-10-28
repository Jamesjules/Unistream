import { google } from 'googleapis';
import * as functions from 'firebase-functions';
import { OAuth2Client } from 'google-auth-library';

/**
 * Drive helper uses a service account or OAuth2 server-side credentials to query private folders.
 * For public folders you can use API key, but quota and privacy differ.
 *
 * You must set functions.config().unistream.drive_service_account (JSON) or
 * use GOOGLE_APPLICATION_CREDENTIALS environment variable for server-side auth.
 */

export async function fetchDriveFiles(folderId: string) {
  // Try using service account credentials from functions config (as base64 JSON)
  const serviceAccountB64 = functions.config().unistream?.drive_service_account_b64;
  let auth;
  if (serviceAccountB64) {
    const saJson = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
    auth = new google.auth.GoogleAuth({
      credentials: saJson,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
  } else {
    // Fallback to application default creds
    auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  }

  const drive = google.drive({ version: 'v3', auth });
  const q = `'${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({ q, fields: 'files(id,name,mimeType,webViewLink,thumbnailLink)' });
  const files = res.data.files || [];
  return files.map(f => ({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.webViewLink, thumbnail: f.thumbnailLink }));
}
