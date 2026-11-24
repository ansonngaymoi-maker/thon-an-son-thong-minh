import { createClient } from '@supabase/supabase-js';

const SCHEDULE_PREFIX = '__ANN_SCHEDULE__:';
const PUSH_FLAG = '__PUSH__:1';

function parseScheduleLine(raw) {
  const text = String(raw || '');
  const firstNl = text.indexOf('\n');
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  if (!firstLine.startsWith(SCHEDULE_PREFIX)) {
    return null;
  }
  const jsonStr = firstLine.slice(SCHEDULE_PREFIX.length);
  const body = firstNl === -1 ? '' : text.slice(firstNl + 1);
  try {
    const meta = JSON.parse(jsonStr);
    return {
      publishAtMs: Number(meta?.publishAtMs) || 0,
      publishLabel: meta?.publishLabel || '',
      sendPush: Boolean(meta?.sendPush),
      pushedDone: Boolean(meta?.pushedDone),
      body,
    };
  } catch (_e) {
    return null;
  }
}

function packScheduleLine({ publishAtMs, publishLabel, sendPush, pushedDone }, body) {
  return `${SCHEDULE_PREFIX}${JSON.stringify({ publishAtMs, publishLabel, sendPush, pushedDone })}\n${body}`;
}

async function triggerSendPush({ siteUrl, heading, content, launchUrl, imageUrl }) {
  try {
    const res = await fetch(`${siteUrl}/api/send-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        heading,
        content,
        launchUrl: launchUrl || siteUrl,
        imageUrl: imageUrl || undefined,
        target: 'all',
      }),
    });
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch (_e) {
      return { status: res.status, raw: text.slice(0, 200) };
    }
  } catch (err) {
    return { status: 500, error: err?.message || 'Lỗi gọi /api/send-push' };
  }
}

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Thiếu cấu hình Supabase trên máy chủ.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const nowMs = Date.now();
  const siteUrl = process.env.SITE_URL || 'https://thon-an-son-thong-minh.vercel.app';
  let processed = 0;
  let skippedNoPermission = 0;
  const pushResults = [];

  try {
    // 1. Xử lý Thông báo & Tin tức hẹn giờ
    const { data: anns } = await supabase.from('announcements').select('*');
    for (const row of anns || []) {
      const parsed = parseScheduleLine(row.content);
      if (parsed && parsed.publishAtMs > 0 && parsed.publishAtMs <= nowMs && !parsed.pushedDone) {
        const isNewsPost = parsed.body.startsWith('__IS_NEWS__:1\n');
        const cleanBody = isNewsPost ? parsed.body.replace(/^__IS_NEWS__:1\n/, '') : parsed.body;
        const updatedContent = packScheduleLine(
          {
            publishAtMs: parsed.publishAtMs,
            publishLabel: parsed.publishLabel,
            sendPush: parsed.sendPush,
            pushedDone: true,
          },
          parsed.body
        );

        const { data: updatedRows, error: updateErr } = await supabase
          .from('announcements')
          .update({ content: updatedContent })
          .eq('id', row.id)
          .select('id');

        if (updateErr || !updatedRows || updatedRows.length === 0) {
          skippedNoPermission += 1;
          continue;
        }

        if (parsed.sendPush) {
          const result = await triggerSendPush({
            siteUrl,
            heading: isNewsPost ? 'Tin tức mới – Thôn An Sơn' : 'Thông báo mới – Thôn An Sơn',
            content: row.title || cleanBody.slice(0, 100),
            launchUrl: `${siteUrl}/?post=announcements-${row.id}`,
            imageUrl: row.image_url || undefined,
          });
          pushResults.push({ id: row.id, type: 'announcement', result });
        }
        processed += 1;
      }
    }

    // 2. Xử lý Lịch thôn hẹn giờ
    const { data: evts } = await supabase.from('events').select('*');
    for (const ev of evts || []) {
      const rawDesc = String(ev.description || '');
      if (rawDesc.includes(SCHEDULE_PREFIX) && !rawDesc.includes(PUSH_FLAG)) {
        const parsed = parseScheduleLine(rawDesc);
        if (parsed && parsed.publishAtMs > 0 && parsed.publishAtMs <= nowMs) {
          const updatedDesc = `${rawDesc}\n${PUSH_FLAG}`;
          const { data: updatedEvt, error: evtErr } = await supabase
            .from('events')
            .update({ description: updatedDesc })
            .eq('id', ev.id)
            .select('id');

          if (evtErr || !updatedEvt || updatedEvt.length === 0) {
            skippedNoPermission += 1;
            continue;
          }

          if (parsed.sendPush) {
            const result = await triggerSendPush({
              siteUrl,
              heading: 'Lịch sinh hoạt – Thôn An Sơn',
              content: `${ev.title} (${ev.event_time || ''} ngày ${ev.event_date || ''})`,
              launchUrl: `${siteUrl}/?post=events-${ev.id}`,
            });
            pushResults.push({ id: ev.id, type: 'event', result });
          }
          processed += 1;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      processed,
      skippedNoPermission,
      pushResults,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Lỗi cron xuất bản' });
  }
}
