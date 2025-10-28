import axios from 'axios';
import * as functions from 'firebase-functions';
import crypto from 'crypto';

const TELEGRAM_API = (token: string) => `https://api.telegram.org/bot${token}`;
const TELEGRAM_FILE_API = (token: string) => `https://api.telegram.org/file/bot${token}`;

/**
 * Verify Telegram Login widget auth_data object according to:
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export async function verifyTelegramLogin(auth_data: any) {
  // auth_data is an object containing id, first_name, last_name (optional), username (optional), photo_url, auth_date, hash
  const token = functions.config().unistream?.telegram_bot_token;
  if (!token) throw new Error('Telegram bot token not configured in functions config.');

  const secretKey = crypto.createHash('sha256').update(token).digest();

  // Compose data_check_string
  const dataCheckParts: string[] = [];
  Object.keys(auth_data).forEach((k) => {
    if (k === 'hash') return;
    dataCheckParts.push(`${k}=${auth_data[k]}`);
  });
  dataCheckParts.sort();
  const dataCheckString = dataCheckParts.join('\n');

  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (hmac !== auth_data.hash) {
    throw new Error('Telegram auth verification failed (invalid hash)');
  }

  // Optionally: check timestamp freshness
  const authDate = parseInt(auth_data.auth_date, 10);
  if (Date.now() / 1000 - authDate > 86400) {
    throw new Error('Auth data too old');
  }

  // Verified. Return user payload (do not return bot token)
  return {
    id: auth_data.id,
    username: auth_data.username,
    first_name: auth_data.first_name,
    last_name: auth_data.last_name,
    photo_url: auth_data.photo_url,
    auth_date: authDate
  };
}

/**
 * Fetch channel posts via getUpdates or getChatHistory.
 * Note: getUpdates returns messages that the bot receives. If you want a bot to receive channel posts,
 * the bot must be added as an admin to that channel. For more robust scraping, use userbot (MTProto) but that is complex.
 */
export async function fetchChannelLatest(channelName: string, limit = 20) {
  const token = functions.config().unistream?.telegram_bot_token;
  if (!token) throw new Error('Telegram bot token not configured in functions config.');

  // 1) getUpdates (note: large scale production may need a different approach)
  const updatesRes = await axios.get(`${TELEGRAM_API(token)}/getUpdates`, { timeout: 20000 });
  const updates = (updatesRes.data?.result || []);

  // 2) filter channel_post entries for that channel username
  const posts = updates
    .filter((u: any) => u.channel_post && u.channel_post.chat && u.channel_post.chat.username === channelName)
    .map((u: any) => u.channel_post);

  // 3) map to items and resolve file URLs via getFile where necessary
  const items = [];
  for (const post of posts.slice(-limit).reverse()) {
    let mediaType: 'text' | 'photo' | 'video' = 'text';
    let mediaUrl: string | null = null;
    let thumbnail: string | null = null;

    if (post.photo && post.photo.length) {
      mediaType = 'photo';
      const largest = post.photo[post.photo.length - 1];
      const fileId = largest.file_id;
      const fileUrl = await resolveFileUrl(token, fileId);
      mediaUrl = fileUrl;
    } else if (post.video) {
      mediaType = 'video';
      const fileId = post.video.file_id;
      const fileUrl = await resolveFileUrl(token, fileId);
      mediaUrl = fileUrl;
      if (post.video.thumb) {
        const thumbId = post.video.thumb.file_id;
        thumbnail = await resolveFileUrl(token, thumbId);
      }
    }

    items.push({
      id: post.message_id,
      sender: post.chat?.title || channelName,
      text: post.caption || post.text || '',
      mediaType,
      mediaUrl,
      thumbnail,
      time: new Date((post.date || Date.now()/1000) * 1000).toISOString()
    });
  }

  return items.slice(-limit).reverse();
}

async function resolveFileUrl(token: string, fileId: string) {
  // getFile -> returns file_path which can be combined with file API
  const fileRes = await axios.get(`${TELEGRAM_API(token)}/getFile`, { params: { file_id: fileId } , timeout: 20000});
  const filePath = fileRes.data?.result?.file_path;
  if (!filePath) throw new Error('Failed to get file path for file_id');
  return `${TELEGRAM_FILE_API(token)}/${filePath}`;
}
