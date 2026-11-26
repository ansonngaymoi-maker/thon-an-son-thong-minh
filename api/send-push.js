export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const appId =
    process.env.ONESIGNAL_APP_ID ||
    process.env.VITE_ONESIGNAL_APP_ID ||
    'e21ec54f-f220-4014-a603-d9c0f23977ab';

  const restKey = (process.env.ONESIGNAL_REST_KEY || '').trim();

  if (!restKey) {
    return res.status(500).json({
      ok: false,
      error: 'Thiếu biến môi trường máy chủ ONESIGNAL_REST_KEY trên Vercel.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { heading, content, launchUrl, imageUrl, target } = body;

    if (!heading || !content) {
      return res.status(400).json({ ok: false, error: 'Thiếu tiêu đề hoặc nội dung thông báo.' });
    }

    const authHeader = restKey.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`;

    const payload = {
      app_id: appId,
      headings: { en: String(heading), vi: String(heading) },
      contents: { en: String(content), vi: String(content) },
      url: launchUrl || undefined,
      chrome_web_image: imageUrl || undefined,
      ios_attachments: imageUrl ? { id1: imageUrl } : undefined,
      ios_sound: 'default',
    };

    if (target === 'admins') {
      payload.filters = [
        { field: 'tag', key: 'is_admin', relation: '=', value: 'true' },
      ];
    } else {
      payload.included_segments = ['Total Subscriptions'];
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || (Array.isArray(data.errors) && data.errors.length > 0)) {
      const errMsg = Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors || data);
      return res.status(response.status || 400).json({ ok: false, error: errMsg });
    }

    return res.status(200).json({
      ok: true,
      id: data.id || null,
      recipients: data.recipients ?? 0,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Lỗi máy chủ khi gửi thông báo đẩy.',
    });
  }
}
