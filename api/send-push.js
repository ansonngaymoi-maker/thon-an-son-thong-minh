export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = (process.env.VITE_ONESIGNAL_APP_ID || 'e21ec54f-f220-4014-a603-d9c0f23977ab').trim();
  const restKey = (process.env.ONESIGNAL_REST_KEY || process.env.VITE_ONESIGNAL_REST_KEY || '').trim();

  if (!appId || !restKey) {
    return res.status(400).json({ error: 'Thiếu ONESIGNAL_REST_KEY trên Vercel' });
  }

  try {
    const { heading, content, launchUrl, imageUrl } = req.body || {};
    const payload = {
      app_id: appId,
      included_segments: ['Total Subscriptions'],
      headings: { en: heading || 'Thông báo Thôn An Sơn', vi: heading || 'Thông báo Thôn An Sơn' },
      contents: { en: content || 'Có cập nhật mới từ Thôn An Sơn.', vi: content || 'Có cập nhật mới từ Thôn An Sơn.' },
      url: launchUrl,
    };

    if (imageUrl) {
      payload.chrome_web_image = imageUrl;
    }

    const authHeader = restKey.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`;

    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
      return res.status(400).json({
        error: Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors || data),
      });
    }

    return res.status(200).json({ ok: true, recipients: data.recipients ?? 1 });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Lỗi máy chủ khi gửi thông báo' });
  }
}
