import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import { verifyTelegramLogin } from './telegram';
import { fetchChannelLatest } from './telegram';
import { fetchDriveFiles } from './drive';
import { checkLatestUpdate } from './utils';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Health
app.get('/', (req, res) => res.json({ ok: true, service: 'unistream-functions' }));

// Telegram Login verification (POST)
app.post('/telegram/verify-login', async (req, res) => {
  try {
    const { auth_data } = req.body;
    if (!auth_data) return res.status(400).json({ error: 'auth_data missing' });
    const user = await verifyTelegramLogin(auth_data);
    // create minimal session token or return user info (optional store in Firestore)
    return res.json({ ok: true, user });
  } catch (err: any) {
    console.error('verify-login error', err);
    return res.status(500).json({ error: err.message || 'verification failed' });
  }
});

// Fetch last N media posts from a Telegram channel (resolved media URLs)
app.get('/telegram/channel/:name/latest', async (req, res) => {
  const channelName = req.params.name;
  const limit = parseInt((req.query.limit as string) || '20', 10);
  try {
    const items = await fetchChannelLatest(channelName, limit);
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error('fetchChannelLatest error', err);
    return res.status(500).json({ error: err.message || 'fetch failed' });
  }
});

// Google Drive folder list (server-side)
app.get('/drive/folder/:folderId/files', async (req, res) => {
  const folderId = req.params.folderId;
  try {
    const files = await fetchDriveFiles(folderId);
    return res.json({ ok: true, files });
  } catch (err: any) {
    console.error('fetchDriveFiles error', err);
    return res.status(500).json({ error: err.message || 'drive fetch failed' });
  }
});

// Update endpoint
app.get('/update/latest', async (req, res) => {
  const info = await checkLatestUpdate();
  res.json(info);
});

export const api = functions.https.onRequest(app);
