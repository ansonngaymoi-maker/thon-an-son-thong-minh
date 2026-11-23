import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Home, Newspaper, Users, Calendar, MessageSquare, QrCode,
  Shield, Phone, MapPin, Plus, Trash2, LogOut, Search,
  CheckCircle, AlertTriangle, Download, Printer, ListPlus,
  Home as HomeIcon, Lock, RefreshCw, ChevronRight, X,
  Image as ImageIcon, Map, PhoneCall, ExternalLink, Copy, Check, ArrowDown
} from 'lucide-react';
import { supabase, isConfigured } from './supabaseClient';

const APP_VERSION = 'v1.5.1';
const SEEN_IDS_KEY = 'thon_an_son_seen_post_ids_v1';
const ONESIGNAL_APP_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ONESIGNAL_APP_ID) ||
  'e21ec54f-f220-4014-a603-d9c0f23977ab';
const ONESIGNAL_REST_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ONESIGNAL_REST_KEY) || '';

const QRImage = ({ url, size = 200 }) => {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  return <img src={src} alt="Mã QR Thôn An Sơn" width={size} height={size} className="rounded-xl border border-slate-200 bg-white p-2 mx-auto" />;
};

export default function App() {
  const isInitialAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const [mode, setMode] = useState(isInitialAdmin ? 'admin' : 'public');
  const [tab, setTab] = useState('home');
  const [adminTab, setAdminTab] = useState('overview');

  // Auth
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Public data
  const [announcements, setAnnouncements] = useState([]);
  const [news, setNews] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [events, setEvents] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin private data
  const [feedbacks, setFeedbacks] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);

  // UI states
  const [searchOfficial, setSearchOfficial] = useState('');
  const [searchHousehold, setSearchHousehold] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [toast, setToast] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [highlightedPost, setHighlightedPost] = useState('');
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // Pull-to-refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const hasInitializedFeedRef = useRef(false);

  // Announcement image upload & push toggles
  const [annImageFile, setAnnImageFile] = useState(null);
  const [annImagePreview, setAnnImagePreview] = useState('');
  const [uploadingAnn, setUploadingAnn] = useState(false);
  const [sendPushOnAnn, setSendPushOnAnn] = useState(true);
  const [sendPushOnNews, setSendPushOnNews] = useState(true);
  const [sendPushOnEvent, setSendPushOnEvent] = useState(true);

  // Feedback form
  const [fbForm, setFbForm] = useState({ sender_name: '', sender_phone: '', category: 'Đường làng, ngõ xóm', content: '' });

  // Admin forms
  const [annForm, setAnnForm] = useState({ title: '', content: '', priority: 'normal', is_pinned: false });
  const [newsForm, setNewsForm] = useState({ title: '', content: '', category: 'Hoạt động cộng đồng', video_url: '' });
  const [offForm, setOffForm] = useState({ full_name: '', role: '', phone: '', sort_order: 8 });
  const [evtForm, setEvtForm] = useState({ title: '', event_date: '', event_time: '19:30', location: 'Nhà văn hóa thôn An Sơn', category: 'Họp dân', description: '' });
  const [hhForm, setHhForm] = useState({ household_code: '', head_name: '', area: '', phone: '', member_count: 1, notes: '' });
  const [resForm, setResForm] = useState({ household_id: '', full_name: '', birth_year: '', gender: 'Nam', relationship: 'Thành viên', phone: '', group_tag: '', residency_status: 'Thường trú' });
  const [listForm, setListForm] = useState({ title: '', description: '', is_public: true, year: 2026 });
  const [itemForm, setItemForm] = useState({ list_id: '', name: '', role_or_group: '', phone: '', detail: '', notes: '' });

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://thon-an-son-thong-minh.vercel.app';

  const showToast = (msg, duration = 5000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  };

  // Gửi thông báo đẩy qua OneSignal API tới toàn bộ điện thoại bà con
  const dispatchOneSignalPush = async ({ heading, content, launchUrl, imageUrl }) => {
    const cleanKey = (ONESIGNAL_REST_KEY || '').trim();
    if (!ONESIGNAL_APP_ID || !cleanKey) {
      return { ok: false, reason: 'missing_key' };
    }

    const authHeader = cleanKey.startsWith('os_v2_') ? `Key ${cleanKey}` : `Basic ${cleanKey}`;
    const bodyPayload = {
      app_id: ONESIGNAL_APP_ID.trim(),
      included_segments: ['Total Subscriptions'],
      headings: { en: heading, vi: heading },
      contents: { en: content, vi: content },
      url: launchUrl || siteUrl,
    };
    if (imageUrl) {
      bodyPayload.chrome_web_image = imageUrl;
    }

    try {
      const res = await fetch('https://api.onesignal.com/notifications?c=push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: authHeader,
        },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json();
      if (res.ok && !data.errors) {
        return { ok: true, recipients: data.recipients ?? 1 };
      }
      const errDetail = Array.isArray(data.errors) ? data.errors.join(', ') : JSON.stringify(data.errors || data);
      return { ok: false, reason: errDetail };
    } catch (err) {
      return { ok: false, reason: err.message || 'Lỗi kết nối mạng' };
    }
  };

  // Hủy Service Worker sw.js cũ nếu còn lưu trong cache trình duyệt & nạp OneSignal SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          if (reg.active && reg.active.scriptURL && reg.active.scriptURL.endsWith('/sw.js')) {
            reg.unregister();
          }
        });
      });
    }

    if (!ONESIGNAL_APP_ID) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
        const optedIn = Boolean(OneSignal.User?.PushSubscription?.optedIn);
        const hasPerm = Boolean(OneSignal.Notifications?.permission);
        if (optedIn || hasPerm) {
          setPushSubscribed(true);
        }
        OneSignal.User?.PushSubscription?.addEventListener('change', (event) => {
          setPushSubscribed(Boolean(event?.current?.optedIn));
        });
      } catch (_err) {
        if ('Notification' in window && Notification.permission === 'granted') {
          setPushSubscribed(true);
        }
      }
    });

    if (!document.getElementById('onesignal-sdk-script')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk-script';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Kéo màn hình từ trên xuống để tải tin mới nhất (Pull-to-Refresh trên iPhone & Android)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleTouchStart = (e) => {
      if (window.scrollY <= 2 && e.touches.length === 1) {
        touchStartYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const delta = currentY - touchStartYRef.current;
      if (delta > 0 && window.scrollY <= 2) {
        setPullDistance(Math.min(delta * 0.45, 95));
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullDistance >= 60 && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(56);
        await fetchPublicData();
        if (session) await fetchAdminData();
        showToast('Đã cập nhật tin mới nhất!');
        setIsRefreshing(false);
      }
      setPullDistance(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, session]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await fetchPublicData();
    if (session) await fetchAdminData();
    setIsRefreshing(false);
    showToast('Đã tải lại thông tin mới nhất!');
  };

  const triggerBrowserAlert = (title, body, postParam) => {
    setToast(`${title}: ${body}`);
    setTimeout(() => setToast(''), 5000);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: postParam || 'thon-an-son-update',
        });
        n.onclick = () => {
          window.focus();
          if (postParam) openPostFromKey(postParam);
        };
      } catch (_err) {
        // Ignore on iOS standalone when service worker handles push
      }
    }
  };

  const openPostFromKey = (postKey) => {
    if (!postKey) return;
    setMode('public');
    setHighlightedPost(postKey);
    if (postKey.startsWith('announcements-')) {
      setTab('announcements');
    } else if (postKey.startsWith('news-')) {
      setTab('news');
    } else if (postKey.startsWith('events-')) {
      setTab('events');
    }
    setTimeout(() => {
      const el = document.getElementById(`post-${postKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const getPostShareUrl = (type, id) => {
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : siteUrl;
    return `${base}?post=${type}-${id}`;
  };

  const handleCopyPostLink = async (type, item) => {
    const shareUrl = getPostShareUrl(type, item.id);
    const key = `${type}-${item.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (_err) {
      const temp = document.createElement('input');
      temp.value = shareUrl;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
    }
    setCopiedKey(key);
    showToast('Đã sao chép link bài viết để gửi nhóm Zalo!');
    setTimeout(() => setCopiedKey(''), 2500);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const postParam = params.get('post');
    if (postParam) {
      openPostFromKey(postParam);
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    fetchPublicData();

    const channel = supabase
      .channel('thon-an-son-live-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const row = payload.new;
        fetchPublicData();
        if (row) {
          triggerBrowserAlert(
            'Thông báo mới – Thôn An Sơn',
            row.title || 'Có thông báo mới vừa được đăng tải.',
            `announcements-${row.id}`
          );
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'news' }, (payload) => {
        const row = payload.new;
        fetchPublicData();
        if (row) {
          triggerBrowserAlert(
            'Tin tức mới – Thôn An Sơn',
            row.title || 'Có tin tức mới vừa được cập nhật.',
            `news-${row.id}`
          );
        }
      })
      .subscribe();

    return () => {
      listener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (session && isConfigured) {
      fetchAdminData();
    }
  }, [session]);

  const checkNewPostsSinceLastVisit = (annRows, newsRows) => {
    if (typeof window === 'undefined') return;
    const currentKeys = [
      ...(annRows || []).map((r) => `announcements-${r.id}`),
      ...(newsRows || []).map((r) => `news-${r.id}`),
    ];
    let seenList = [];
    try {
      seenList = JSON.parse(localStorage.getItem(SEEN_IDS_KEY) || '[]');
    } catch (_e) {
      seenList = [];
    }

    if (!hasInitializedFeedRef.current) {
      hasInitializedFeedRef.current = true;
      if (seenList.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const newestAnn = (annRows || []).find((r) => !seenList.includes(`announcements-${r.id}`));
        const newestNews = (newsRows || []).find((r) => !seenList.includes(`news-${r.id}`));
        if (newestAnn) {
          triggerBrowserAlert(
            'Thông báo mới – Thôn An Sơn',
            newestAnn.title || 'Có thông báo mới cho bà con.',
            `announcements-${newestAnn.id}`
          );
        } else if (newestNews) {
          triggerBrowserAlert(
            'Tin tức mới – Thôn An Sơn',
            newestNews.title || 'Có bài tin tức mới vừa đăng.',
            `news-${newestNews.id}`
          );
        }
      }
      if (currentKeys.length > 0) {
        localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(currentKeys.slice(0, 100)));
      }
    } else if (currentKeys.length > 0) {
      localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(currentKeys.slice(0, 100)));
    }
  };

  const fetchPublicData = async () => {
    setLoading(true);
    try {
      const [a, n, o, e, cl, ci] = await Promise.all([
        supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
        supabase.from('officials').select('*').order('sort_order', { ascending: true }),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('custom_lists').select('*').order('created_at', { ascending: false }),
        supabase.from('custom_list_items').select('*').order('created_at', { ascending: true }),
      ]);
      const annRows = a.data || [];
      const newsRows = n.data || [];
      if (a.data) setAnnouncements(annRows);
      if (n.data) setNews(newsRows);
      if (o.data) setOfficials(o.data);
      if (e.data) setEvents(e.data);
      if (cl.data) setCustomLists(cl.data);
      if (ci.data) setCustomItems(ci.data);
      checkNewPostsSinceLastVisit(annRows, newsRows);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    const [fb, hh, res] = await Promise.all([
      supabase.from('feedbacks').select('*').order('created_at', { ascending: false }),
      supabase.from('households').select('*').order('created_at', { ascending: false }),
      supabase.from('residents').select('*').order('created_at', { ascending: false }),
    ]);
    if (fb.data) setFeedbacks(fb.data);
    if (hh.data) setHouseholds(hh.data);
    if (res.data) setResidents(res.data);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) setAuthError('Sai email hoặc mật khẩu. Vui lòng kiểm tra lại.');
    else showToast('Đăng nhập Ban quản trị thành công!');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setMode('public');
    showToast('Đã đăng xuất.');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!fbForm.content.trim()) return;
    const { error } = await supabase.from('feedbacks').insert([fbForm]);
    if (!error) {
      setFbForm({ sender_name: '', sender_phone: '', category: 'Đường làng, ngõ xóm', content: '' });
      showToast('Đã gửi phản ánh đến Ban thôn. Cảm ơn bà con!');
    } else {
      showToast('Có lỗi xảy ra, vui lòng thử lại.');
    }
  };

  const handleAnnImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB). Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    setAnnImageFile(file);
    setAnnImagePreview(URL.createObjectURL(file));
  };

  const clearAnnImage = () => {
    setAnnImageFile(null);
    setAnnImagePreview('');
  };

  const formatPushResultMessage = (baseSuccessMsg, pushRes) => {
    if (pushRes.ok) {
      return `${baseSuccessMsg} Đã gửi chuông báo tới điện thoại bà con!`;
    }
    if (pushRes.reason === 'missing_key') {
      return `${baseSuccessMsg} (Chưa nhận biến VITE_ONESIGNAL_REST_KEY trên Vercel - hãy bấm Redeploy).`;
    }
    return `${baseSuccessMsg} (Lỗi đẩy chuông OneSignal: ${pushRes.reason})`;
  };

  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setUploadingAnn(true);
    try {
      let image_url = null;
      if (annImageFile) {
        const ext = annImageFile.name.split('.').pop() || 'jpg';
        const fileName = `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('anh-thong-bao')
          .upload(fileName, annImageFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          showToast('Lỗi tải ảnh lên: ' + uploadError.message);
          setUploadingAnn(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('anh-thong-bao').getPublicUrl(fileName);
        image_url = urlData.publicUrl;
      }

      const payload = image_url ? { ...annForm, image_url } : { ...annForm };
      const { data: insertedRows, error } = await supabase.from('announcements').insert([payload]).select();
      if (!error) {
        const created = insertedRows?.[0];
        let pushMsg = 'Đã đăng thông báo mới!';
        if (sendPushOnAnn) {
          const pushRes = await dispatchOneSignalPush({
            heading: 'Thông báo mới – Thôn An Sơn',
            content: annForm.title,
            launchUrl: created ? getPostShareUrl('announcements', created.id) : siteUrl,
            imageUrl: image_url,
          });
          pushMsg = formatPushResultMessage('Đã đăng thông báo!', pushRes);
        }
        setAnnForm({ title: '', content: '', priority: 'normal', is_pinned: false });
        clearAnnImage();
        fetchPublicData();
        showToast(pushMsg, 6000);
      } else {
        showToast('Lỗi đăng thông báo: ' + error.message);
      }
    } finally {
      setUploadingAnn(false);
    }
  };

  const requestNotification = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isIOS && !isStandalone) {
      showToast('Trên iPhone: Bấm nút Chia sẻ (↑) ở dưới Safari → chọn "Thêm vào MH chính", sau đó mở biểu tượng ngoài màn hình chính để bật thông báo.');
      return;
    }

    if (typeof window !== 'undefined' && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          await OneSignal.Notifications.requestPermission();
          await OneSignal.User.PushSubscription.optIn();
          const opted = Boolean(OneSignal.User?.PushSubscription?.optedIn);
          if (opted || OneSignal.Notifications?.permission) {
            setPushSubscribed(true);
            showToast('Đã bật thông báo nền! Máy sẽ rung chuông ngay cả khi tắt ứng dụng.');
          } else {
            showToast('Vui lòng chọn "Cho phép" khi điện thoại hỏi quyền thông báo.');
          }
        } catch (_e) {
          if ('Notification' in window) {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
              setPushSubscribed(true);
              showToast('Đã bật thông báo trên thiết bị!');
            }
          }
        }
      });
      return;
    }

    if (!('Notification' in window)) {
      showToast('Trình duyệt chưa hỗ trợ thông báo. Hãy mở từ biểu tượng ngoài Màn hình chính.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setPushSubscribed(true);
      showToast('Đã bật thông báo! Mỗi khi có tin mới, máy sẽ báo ngay.');
    } else {
      showToast('Bạn chưa cấp quyền thông báo trên thiết bị.');
    }
  };

  const exportCSV = (filename, rows) => {
    if (!rows.length) return showToast('Chưa có dữ liệu để xuất.');
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const exportBackupJSON = () => {
    const data = { exported_at: new Date().toISOString(), version: APP_VERSION, announcements, news, officials, events, feedbacks, households, residents, customLists, customItems };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sao-luu-thon-an-son-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast('Đã tải tệp sao lưu dữ liệu thành công!');
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="max-w-lg bg-white p-8 rounded-2xl shadow-lg border border-emerald-200 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800 mb-2">Chưa cấu hình kết nối Supabase</h1>
          <p className="text-slate-600 text-sm">
            Vui lòng thêm 2 biến môi trường <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> trong phần Settings → Environment Variables trên Vercel rồi bấm Redeploy.
          </p>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const galleryItems = announcements.filter(a => a.image_url);

  // ==================== ADMIN VIEW ====================
  if (mode === 'admin') {
    if (!session) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Ban Quản Trị Thôn An Sơn</h1>
              <p className="text-sm text-slate-500 mt-1">Đăng nhập bằng tài khoản quản trị Supabase</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email quản trị</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ansonngaymoi@gmail.com" className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              {authError && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{authError}</p>}
              <button disabled={authLoading} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl transition">
                {authLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
            <button onClick={() => setMode('public')} className="w-full mt-4 text-sm text-slate-500 hover:text-emerald-700">
              ← Quay lại trang công khai cho người dân
            </button>
          </div>
        </div>
      );
    }

    const adminMenu = [
      { id: 'overview', label: 'Tổng quan', icon: HomeIcon, color: 'bg-slate-100 text-slate-700' },
      { id: 'announcements', label: 'Thông báo', icon: Bell, color: 'bg-red-50 text-red-600' },
      { id: 'news', label: 'Tin tức', icon: Newspaper, color: 'bg-emerald-50 text-emerald-700' },
      { id: 'officials', label: 'Cán bộ', icon: Users, color: 'bg-sky-50 text-sky-700' },
      { id: 'events', label: 'Lịch thôn', icon: Calendar, color: 'bg-teal-50 text-teal-700' },
      { id: 'feedbacks', label: `Phản ánh (${feedbacks.filter(f => f.status === 'received').length})`, icon: MessageSquare, color: 'bg-amber-50 text-amber-700' },
      { id: 'households', label: 'Hộ dân & Dân cư', icon: Shield, color: 'bg-indigo-50 text-indigo-700' },
      { id: 'lists', label: 'Danh sách mở rộng', icon: ListPlus, color: 'bg-purple-50 text-purple-700' },
      { id: 'qr', label: 'Mã QR & In ấn', icon: QrCode, color: 'bg-cyan-50 text-cyan-700' },
      { id: 'system', label: 'Sao lưu & Phiên bản', icon: RefreshCw, color: 'bg-lime-50 text-lime-700' },
    ];

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
        {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-lg no-print max-w-sm text-sm">{toast}</div>}

        <aside className="w-full md:w-64 bg-emerald-900 text-white p-4 flex flex-col no-print">
          <div className="mb-4 md:mb-6 pb-3 md:pb-4 border-b border-emerald-800 flex items-center justify-between md:block">
            <div>
              <h2 className="font-bold text-lg">QUẢN TRỊ AN SƠN</h2>
              <p className="text-xs text-emerald-300 truncate">{session.user.email} • {APP_VERSION}</p>
            </div>
            <div className="flex gap-2 md:hidden">
              <button onClick={() => setMode('public')} className="bg-emerald-800 hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium">Trang dân</button>
              <button onClick={handleLogout} className="bg-red-600/80 hover:bg-red-600 px-2.5 py-1.5 rounded-lg text-xs font-medium"><LogOut className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <nav className="grid grid-cols-2 md:block gap-1.5 md:space-y-1 flex-1">
            {adminMenu.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => setAdminTab(m.id)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-medium w-full text-left transition ${adminTab === m.id ? 'bg-white text-emerald-900 shadow-sm font-bold' : 'text-emerald-100 hover:bg-emerald-800'}`}>
                  <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="hidden md:flex mt-4 pt-4 border-t border-emerald-800 gap-2">
            <button onClick={() => setMode('public')} className="flex-1 bg-emerald-800 hover:bg-emerald-700 py-2 rounded-lg text-xs font-medium">Trang dân</button>
            <button onClick={handleLogout} className="flex items-center justify-center gap-1 bg-red-600/80 hover:bg-red-600 px-3 py-2 rounded-lg text-xs font-medium"><LogOut className="w-3.5 h-3.5" /> Thoát</button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {adminTab !== 'overview' && (
            <button
              onClick={() => setAdminTab('overview')}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 px-3 py-1.5 rounded-xl transition no-print"
            >
              ← Quay về Tổng quan
            </button>
          )}

          {adminTab === 'overview' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống Thôn An Sơn</h1>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'announcements', label: 'Thông báo', val: announcements.length, color: 'bg-emerald-600 hover:bg-emerald-700' },
                  { id: 'officials', label: 'Cán bộ, đoàn thể', val: officials.length, color: 'bg-sky-600 hover:bg-sky-700' },
                  { id: 'households', label: 'Hộ dân (Nội bộ)', val: households.length, color: 'bg-indigo-600 hover:bg-indigo-700' },
                  { id: 'feedbacks', label: 'Phản ánh mới', val: feedbacks.filter(f => f.status === 'received').length, color: 'bg-amber-600 hover:bg-amber-700' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setAdminTab(c.id)}
                    className={`${c.color} text-white p-5 rounded-2xl shadow text-left transition active:scale-[0.98] cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{c.val}</span>
                      <ChevronRight className="w-5 h-5 opacity-75 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="text-sm opacity-95 mt-1 font-medium">{c.label}</div>
                  </button>
                ))}
              </div>

              <div className="bg-white p-5 md:p-6 rounded-2xl border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">Chọn nhanh mục quản lý (Bấm để mở ngay)</h3>
                  <span className="text-xs text-slate-400">1 chạm mở trang</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {adminMenu.filter(m => m.id !== 'overview').map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAdminTab(m.id)}
                        className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition active:scale-[0.98] cursor-pointer"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-slate-800 leading-snug">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-2">
                <h3 className="font-bold text-slate-800">Trạng thái bảo mật & Thông báo đẩy ({APP_VERSION})</h3>
                <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" /> Đã kết nối cơ sở dữ liệu Supabase thời gian thực.</p>
                <p className={`text-sm flex items-center gap-2 ${ONESIGNAL_REST_KEY ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {ONESIGNAL_REST_KEY ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {ONESIGNAL_REST_KEY
                    ? 'Đã nhận mã khóa OneSignal REST API Key – Sẵn sàng tự động đẩy chuông khi đăng bài.'
                    : 'Chưa nhận biến VITE_ONESIGNAL_REST_KEY trên Vercel (cần thêm vào dự án và bấm Redeploy).'}
                </p>
              </div>
            </div>
          )}

          {adminTab === 'announcements' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Thông báo thôn</h1>
              <form onSubmit={handleAnnouncementSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <input required placeholder="Tiêu đề thông báo..." value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <textarea required rows={4} placeholder="Nội dung chi tiết..." value={annForm.content} onChange={e => setAnnForm({ ...annForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />

                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 transition">
                    <ImageIcon className="w-4 h-4 text-emerald-700" />
                    <span>{annImageFile ? 'Đổi ảnh khác' : 'Chèn ảnh đính kèm (tùy chọn)'}</span>
                    <input type="file" accept="image/*" onChange={handleAnnImageChange} className="hidden" />
                  </label>
                  {annImagePreview && (
                    <div className="relative inline-block mt-2">
                      <img src={annImagePreview} alt="Xem trước" className="max-h-48 rounded-xl border border-slate-200 object-cover" />
                      <button type="button" onClick={clearAnnImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700" title="Bỏ ảnh">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                  <select value={annForm.priority} onChange={e => setAnnForm({ ...annForm, priority: e.target.value })} className="border px-3 py-2 rounded-xl text-sm">
                    <option value="normal">Mức bình thường</option>
                    <option value="important">Quan trọng</option>
                    <option value="urgent">Khẩn cấp</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={annForm.is_pinned} onChange={e => setAnnForm({ ...annForm, is_pinned: e.target.checked })} /> Ghim lên đầu trang
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <input type="checkbox" checked={sendPushOnAnn} onChange={e => setSendPushOnAnn(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                  </label>
                  <button disabled={uploadingAnn} className="ml-auto bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> {uploadingAnn ? 'Đang tải lên...' : 'Đăng thông báo'}
                  </button>
                </div>
              </form>
              <div className="space-y-3">
                {announcements.map(a => (
                  <div key={a.id} className="bg-white p-4 rounded-xl border flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="font-bold text-slate-800">{a.is_pinned && '📌 '}{a.title}</div>
                      <p className="text-sm text-slate-600 whitespace-pre-line">{a.content}</p>
                      {a.image_url && (
                        <a href={a.image_url} target="_blank" rel="noreferrer" className="block">
                          <img src={a.image_url} alt={a.title} className="max-h-56 rounded-xl border border-slate-200 object-cover mt-2" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyPostLink('announcements', a)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                      >
                        {copiedKey === `announcements-${a.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === `announcements-${a.id}` ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                      </button>
                    </div>
                    <button onClick={async () => { if (confirm('Xóa thông báo này?')) { await supabase.from('announcements').delete().eq('id', a.id); fetchPublicData(); } }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'news' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Tin tức & Hoạt động</h1>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { data: insertedRows, error } = await supabase.from('news').insert([newsForm]).select();
                if (!error) {
                  const created = insertedRows?.[0];
                  let msg = 'Đã đăng bài viết!';
                  if (sendPushOnNews) {
                    const pushRes = await dispatchOneSignalPush({
                      heading: 'Tin tức mới – Thôn An Sơn',
                      content: newsForm.title,
                      launchUrl: created ? getPostShareUrl('news', created.id) : siteUrl,
                    });
                    msg = formatPushResultMessage('Đã đăng bài viết!', pushRes);
                  }
                  setNewsForm({ title: '', content: '', category: 'Hoạt động cộng đồng', video_url: '' });
                  fetchPublicData();
                  showToast(msg, 6000);
                } else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <input required placeholder="Tiêu đề bài viết..." value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <textarea required rows={4} placeholder="Nội dung bài viết..." value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <input placeholder="Link video YouTube (nếu có)..." value={newsForm.video_url} onChange={e => setNewsForm({ ...newsForm, video_url: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <input type="checkbox" checked={sendPushOnNews} onChange={e => setSendPushOnNews(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                  </label>
                  <button className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold">Đăng bài viết</button>
                </div>
              </form>
              <div className="space-y-3">
                {news.map(n => (
                  <div key={n.id} className="bg-white p-4 rounded-xl border flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="font-bold">{n.title}</div>
                      <p className="text-sm text-slate-600">{n.content}</p>
                      <button
                        type="button"
                        onClick={() => handleCopyPostLink('news', n)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                      >
                        {copiedKey === `news-${n.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === `news-${n.id}` ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                      </button>
                    </div>
                    <button onClick={async () => { if (confirm('Xóa bài viết?')) { await supabase.from('news').delete().eq('id', n.id); fetchPublicData(); } }} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'officials' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Cán bộ & Đoàn thể</h1>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('officials').insert([offForm]);
                if (!error) { setOffForm({ full_name: '', role: '', phone: '', sort_order: officials.length + 1 }); fetchPublicData(); showToast('Đã thêm cán bộ!'); }
                else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl border grid md:grid-cols-4 gap-3">
                <input required placeholder="Họ và tên" value={offForm.full_name} onChange={e => setOffForm({ ...offForm, full_name: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <input required placeholder="Chức vụ" value={offForm.role} onChange={e => setOffForm({ ...offForm, role: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <input placeholder="Số điện thoại" value={offForm.phone} onChange={e => setOffForm({ ...offForm, phone: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <button className="bg-emerald-700 text-white rounded-xl font-semibold py-2">+ THÊM CÁN BỘ</button>
              </form>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b"><tr><th className="p-3">Họ tên</th><th className="p-3">Chức vụ</th><th className="p-3">SĐT</th><th className="p-3 text-right">Xóa</th></tr></thead>
                  <tbody>
                    {officials.map(o => (
                      <tr key={o.id} className="border-b last:border-0">
                        <td className="p-3 font-medium">{o.full_name}</td>
                        <td className="p-3">{o.role}</td>
                        <td className="p-3">{o.phone}</td>
                        <td className="p-3 text-right"><button onClick={async () => { if (confirm('Xóa cán bộ này?')) { await supabase.from('officials').delete().eq('id', o.id); fetchPublicData(); } }} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'events' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Lịch sinh hoạt cộng đồng</h1>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { data: insertedRows, error } = await supabase.from('events').insert([evtForm]).select();
                if (!error) {
                  const created = insertedRows?.[0];
                  let msg = 'Đã thêm lịch sinh hoạt!';
                  if (sendPushOnEvent) {
                    const pushRes = await dispatchOneSignalPush({
                      heading: 'Lịch sinh hoạt – Thôn An Sơn',
                      content: `${evtForm.title} (${evtForm.event_time} ngày ${evtForm.event_date})`,
                      launchUrl: created ? getPostShareUrl('events', created.id) : siteUrl,
                    });
                    msg = formatPushResultMessage('Đã thêm lịch sinh hoạt!', pushRes);
                  }
                  setEvtForm({ title: '', event_date: '', event_time: '19:30', location: 'Nhà văn hóa thôn An Sơn', category: 'Họp dân', description: '' });
                  fetchPublicData();
                  showToast(msg, 6000);
                } else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl border space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <input required placeholder="Tên sự kiện / cuộc họp" value={evtForm.title} onChange={e => setEvtForm({ ...evtForm, title: e.target.value })} className="border px-3 py-2 rounded-xl" />
                  <input required type="date" value={evtForm.event_date} onChange={e => setEvtForm({ ...evtForm, event_date: e.target.value })} className="border px-3 py-2 rounded-xl" />
                  <input placeholder="Giờ (VD: 19:30)" value={evtForm.event_time} onChange={e => setEvtForm({ ...evtForm, event_time: e.target.value })} className="border px-3 py-2 rounded-xl" />
                  <input placeholder="Địa điểm" value={evtForm.location} onChange={e => setEvtForm({ ...evtForm, location: e.target.value })} className="border px-3 py-2 rounded-xl md:col-span-2" />
                  <button className="bg-emerald-700 text-white rounded-xl font-semibold py-2">+ Thêm lịch</button>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <input type="checkbox" checked={sendPushOnEvent} onChange={e => setSendPushOnEvent(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                </label>
              </form>
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
                    <div><div className="font-bold">{ev.title}</div><div className="text-sm text-slate-500">{ev.event_date} • {ev.event_time} • {ev.location}</div></div>
                    <button onClick={async () => { await supabase.from('events').delete().eq('id', ev.id); fetchPublicData(); }} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'feedbacks' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-bold">Phản ánh & Góp ý từ bà con (Nội bộ)</h1>
              {feedbacks.length === 0 && <p className="text-slate-500">Chưa có phản ánh nào.</p>}
              {feedbacks.map(fb => (
                <div key={fb.id} className="bg-white p-5 rounded-2xl border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-800">{fb.category}</span>
                    <select value={fb.status} onChange={async (e) => { await supabase.from('feedbacks').update({ status: e.target.value }).eq('id', fb.id); fetchAdminData(); showToast('Đã cập nhật trạng thái'); }} className="border rounded-lg px-2 py-1 text-xs">
                      <option value="received">Đã tiếp nhận</option>
                      <option value="reviewing">Đang xem xét</option>
                      <option value="resolved">Đã phản hồi / Xử lý</option>
                    </select>
                  </div>
                  <p className="text-slate-800">{fb.content}</p>
                  <div className="text-xs text-slate-500">Người gửi: {fb.sender_name || 'Ẩn danh'} • SĐT: {fb.sender_phone || 'Không cung cấp'}</div>
                </div>
              ))}
            </div>
          )}

          {adminTab === 'households' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <h1 className="text-2xl font-bold">Quản lý Hộ dân & Dân cư (Nội bộ)</h1>
                <div className="flex gap-2">
                  <button onClick={() => exportCSV('danh-sach-ho-dan.csv', households)} className="bg-sky-700 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Xuất Excel Hộ dân</button>
                  <button onClick={() => exportCSV('danh-sach-dan-cu.csv', residents)} className="bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-1.5"><Download className="w-4 h-4" /> Xuất Excel Dân cư</button>
                </div>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('households').insert([hhForm]);
                if (!error) { setHhForm({ household_code: '', head_name: '', area: '', phone: '', member_count: 1, notes: '' }); fetchAdminData(); showToast('Đã thêm hộ dân!'); }
                else showToast('Lỗi: Mã hộ có thể bị trùng.');
              }} className="bg-white p-5 rounded-2xl border space-y-3">
                <h3 className="font-bold text-emerald-800">+ THÊM HỘ DÂN MỚI</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <input required placeholder="Mã hộ (VD: AS-001)" value={hhForm.household_code} onChange={e => setHhForm({ ...hhForm, household_code: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input required placeholder="Họ tên chủ hộ" value={hhForm.head_name} onChange={e => setHhForm({ ...hhForm, head_name: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input placeholder="Khu vực / Xóm" value={hhForm.area} onChange={e => setHhForm({ ...hhForm, area: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input placeholder="Số điện thoại" value={hhForm.phone} onChange={e => setHhForm({ ...hhForm, phone: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input type="number" min={1} placeholder="Số nhân khẩu" value={hhForm.member_count} onChange={e => setHhForm({ ...hhForm, member_count: Number(e.target.value) })} className="border px-3 py-2 rounded-xl text-sm" />
                  <button className="bg-emerald-700 text-white rounded-xl font-semibold text-sm py-2">Lưu Hộ dân</button>
                </div>
              </form>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const payload = { ...resForm, birth_year: resForm.birth_year ? Number(resForm.birth_year) : null, household_id: resForm.household_id || null };
                const { error } = await supabase.from('residents').insert([payload]);
                if (!error) { setResForm({ household_id: '', full_name: '', birth_year: '', gender: 'Nam', relationship: 'Thành viên', phone: '', group_tag: '', residency_status: 'Thường trú' }); fetchAdminData(); showToast('Đã thêm dân cư!'); }
                else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-5 rounded-2xl border space-y-3">
                <h3 className="font-bold text-sky-800">+ THÊM DÂN CƯ (THÀNH VIÊN)</h3>
                <div className="grid md:grid-cols-4 gap-3">
                  <select value={resForm.household_id} onChange={e => setResForm({ ...resForm, household_id: e.target.value })} className="border px-3 py-2 rounded-xl text-sm">
                    <option value="">-- Chọn hộ gia đình --</option>
                    {households.map(h => <option key={h.id} value={h.id}>{h.household_code} - {h.head_name}</option>)}
                  </select>
                  <input required placeholder="Họ và tên" value={resForm.full_name} onChange={e => setResForm({ ...resForm, full_name: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input type="number" placeholder="Năm sinh" value={resForm.birth_year} onChange={e => setResForm({ ...resForm, birth_year: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input placeholder="Đoàn thể (Thanh niên, Phụ nữ...)" value={resForm.group_tag} onChange={e => setResForm({ ...resForm, group_tag: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <button className="bg-sky-700 text-white rounded-xl font-semibold text-sm py-2 md:col-span-4">Lưu Dân cư</button>
                </div>
              </form>

              <input placeholder="Tìm kiếm hộ dân theo tên chủ hộ, mã hộ hoặc xóm..." value={searchHousehold} onChange={e => setSearchHousehold(e.target.value)} className="w-full border bg-white px-4 py-2.5 rounded-xl" />
              <div className="bg-white rounded-2xl border overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b"><tr><th className="p-3">Mã hộ</th><th className="p-3">Chủ hộ</th><th className="p-3">Khu vực</th><th className="p-3">SĐT</th><th className="p-3">Số người</th><th className="p-3">Xóa</th></tr></thead>
                  <tbody>
                    {households.filter(h => (h.head_name + h.household_code + h.area).toLowerCase().includes(searchHousehold.toLowerCase())).map(h => (
                      <tr key={h.id} className="border-b last:border-0">
                        <td className="p-3 font-mono">{h.household_code}</td>
                        <td className="p-3 font-medium">{h.head_name}</td>
                        <td className="p-3">{h.area}</td>
                        <td className="p-3">{h.phone}</td>
                        <td className="p-3">{h.member_count}</td>
                        <td className="p-3"><button onClick={async () => { if (confirm('Xóa hộ dân này?')) { await supabase.from('households').delete().eq('id', h.id); fetchAdminData(); } }} className="text-red-500"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {adminTab === 'lists' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Danh sách bổ sung của thôn (Mở rộng)</h1>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('custom_lists').insert([listForm]);
                if (!error) { setListForm({ title: '', description: '', is_public: true, year: 2026 }); fetchPublicData(); showToast('Đã tạo danh sách mới!'); }
              }} className="bg-white p-5 rounded-2xl border space-y-3">
                <h3 className="font-bold text-emerald-800">+ TẠO DANH SÁCH MỚI</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <input required placeholder="Tên danh sách (VD: Mạnh thường quân 2026)" value={listForm.title} onChange={e => setListForm({ ...listForm, title: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input placeholder="Mô tả ngắn" value={listForm.description} onChange={e => setListForm({ ...listForm, description: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <label className="flex items-center gap-2 text-sm px-2">
                    <input type="checkbox" checked={listForm.is_public} onChange={e => setListForm({ ...listForm, is_public: e.target.checked })} /> Công khai cho bà con xem
                  </label>
                </div>
                <button className="bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-semibold">Tạo danh sách</button>
              </form>

              {customLists.length > 0 && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!itemForm.list_id) return showToast('Vui lòng chọn danh sách');
                  const { error } = await supabase.from('custom_list_items').insert([itemForm]);
                  if (!error) { setItemForm({ ...itemForm, name: '', role_or_group: '', phone: '', detail: '', notes: '' }); fetchPublicData(); showToast('Đã bổ sung mục mới!'); }
                }} className="bg-white p-5 rounded-2xl border space-y-3">
                  <h3 className="font-bold text-sky-800">+ BỔ SUNG THÀNH VIÊN / MỤC VÀO DANH SÁCH</h3>
                  <div className="grid md:grid-cols-4 gap-3">
                    <select required value={itemForm.list_id} onChange={e => setItemForm({ ...itemForm, list_id: e.target.value })} className="border px-3 py-2 rounded-xl text-sm">
                      <option value="">-- Chọn danh sách --</option>
                      {customLists.map(l => <option key={l.id} value={l.id}>{l.title} ({l.is_public ? 'Công khai' : 'Nội bộ'})</option>)}
                    </select>
                    <input required placeholder="Họ tên / Tên mục" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                    <input placeholder="Nhóm / Vai trò" value={itemForm.role_or_group} onChange={e => setItemForm({ ...itemForm, role_or_group: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                    <input placeholder="Chi tiết / Đóng góp / Ghi chú" value={itemForm.detail} onChange={e => setItemForm({ ...itemForm, detail: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  </div>
                  <button className="bg-sky-700 text-white px-5 py-2 rounded-xl text-sm font-semibold">Thêm vào danh sách</button>
                </form>
              )}

              <div className="space-y-4">
                {customLists.map(l => (
                  <div key={l.id} className="bg-white p-5 rounded-2xl border">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-bold text-lg">{l.title}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${l.is_public ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{l.is_public ? 'Công khai' : 'Nội bộ'}</span>
                      </div>
                      <button onClick={async () => { if (confirm('Xóa danh sách này?')) { await supabase.from('custom_lists').delete().eq('id', l.id); fetchPublicData(); } }} className="text-red-500 text-sm">Xóa</button>
                    </div>
                    <ul className="divide-y text-sm">
                      {customItems.filter(i => i.list_id === l.id).map(i => (
                        <li key={i.id} className="py-2 flex justify-between">
                          <span><strong>{i.name}</strong> {i.role_or_group && `(${i.role_or_group})`} — {i.detail}</span>
                          <button onClick={async () => { await supabase.from('custom_list_items').delete().eq('id', i.id); fetchPublicData(); }} className="text-red-400 text-xs">Xóa</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'qr' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center no-print">
                <h1 className="text-2xl font-bold">Mã QR & In Poster A4 dán Nhà văn hóa</h1>
                <button onClick={() => window.print()} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"><Printer className="w-4 h-4" /> In Poster A4</button>
              </div>
              <div className="bg-white p-10 rounded-3xl border-4 border-emerald-700 max-w-xl mx-auto text-center space-y-5 shadow-lg">
                <div className="text-emerald-800 font-bold tracking-wider text-sm">XÃ CAM LỘ – TỈNH QUẢNG TRỊ</div>
                <h2 className="text-3xl font-extrabold text-emerald-900">THÔN AN SƠN</h2>
                <p className="text-slate-600">Thông tin cộng đồng – Kết nối người dân – Chung tay xây dựng quê hương</p>
                <QRImage url={siteUrl} size={260} />
                <p className="text-lg font-bold text-slate-800">QUÉT MÃ QR BẰNG ZALO HOẶC CAMERA ĐIỆN THOẠI</p>
                <p className="text-sm text-slate-500">Không cần tải app • Không cần đăng nhập • Xem ngay thông báo, lịch họp & danh bạ thôn</p>
                <div className="text-xs font-mono text-emerald-700 bg-emerald-50 py-2 rounded-lg">{siteUrl}</div>
              </div>
            </div>
          )}

          {adminTab === 'system' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Sao lưu dữ liệu & Quản lý phiên bản</h1>
              <div className="bg-white p-6 rounded-2xl border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">Phiên bản hiện tại: {APP_VERSION}</div>
                    <p className="text-sm text-slate-500">Kiến trúc PWA mô-đun hóa, hỗ trợ kéo vuốt làm mới và tự động đẩy thông báo nền.</p>
                  </div>
                  <button onClick={() => window.location.reload()} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Kiểm tra cập nhật</button>
                </div>
                <hr />
                <div>
                  <h3 className="font-bold mb-2">Sao lưu toàn bộ dữ liệu thôn</h3>
                  <button onClick={exportBackupJSON} className="bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"><Download className="w-4 h-4" /> Tải bản sao lưu (.JSON)</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ==================== PUBLIC RESIDENT VIEW ====================
  const menuGrid = [
    { id: 'announcements', label: 'Thông báo', icon: Bell, iconColor: 'text-red-500', bgColor: 'bg-red-50' },
    { id: 'news', label: 'Tin tức', icon: Newspaper, iconColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { id: 'events', label: 'Lịch thôn', icon: Calendar, iconColor: 'text-sky-600', bgColor: 'bg-sky-50' },
    { id: 'officials', label: 'Cán bộ', icon: Users, iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { id: 'feedback', label: 'Phản ánh', icon: MessageSquare, iconColor: 'text-amber-500', bgColor: 'bg-amber-50' },
    { id: 'map', label: 'Bản đồ', icon: MapPin, iconColor: 'text-teal-600', bgColor: 'bg-teal-50' },
    { id: 'contact', label: 'Liên hệ', icon: PhoneCall, iconColor: 'text-blue-600', bgColor: 'bg-blue-50' },
    { id: 'gallery', label: 'Thư viện ảnh', icon: ImageIcon, iconColor: 'text-purple-600', bgColor: 'bg-purple-50' },
    { id: 'more', label: 'Mã QR', icon: QrCode, iconColor: 'text-slate-700', bgColor: 'bg-slate-100' },
  ];

  return (
    <div className="min-h-screen bg-[#f3f6f4] pb-24">
      {(pullDistance > 0 || isRefreshing) && (
        <div
          style={{ height: `${isRefreshing ? 48 : pullDistance}px` }}
          className="bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-2 overflow-hidden transition-all"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải tin mới nhất...
            </>
          ) : (
            <>
              <ArrowDown className={`w-4 h-4 transition-transform ${pullDistance >= 60 ? 'rotate-180' : ''}`} />
              {pullDistance >= 60 ? 'Thả tay để cập nhật tin mới' : 'Kéo xuống để làm mới tin'}
            </>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-4 py-3 rounded-xl shadow-lg max-w-sm text-sm font-medium">
          {toast}
        </div>
      )}

      <header className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 text-white rounded-b-3xl shadow-md">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[11px] bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full capitalize font-medium">{todayStr}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                className="bg-white/15 hover:bg-white/25 p-2 rounded-xl transition"
                title="Làm mới tin"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowQRModal(true)} className="bg-white/15 hover:bg-white/25 p-2 rounded-xl transition" title="Mã QR chia sẻ">
                <QrCode className="w-4 h-4" />
              </button>
              <button onClick={() => setMode('admin')} className="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
                <Lock className="w-3.5 h-3.5" /> Quản trị
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <img src="/icon.svg" alt="Logo Thôn An Sơn" className="w-14 h-14 rounded-2xl shadow-md bg-white/10 p-1" />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight leading-tight">THÔN AN SƠN</h1>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-0.5">Xã Cam Lộ – Tỉnh Quảng Trị</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {tab === 'home' && (
          <>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {menuGrid.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md active:scale-[0.98] flex flex-col items-center justify-center gap-2.5 transition"
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.bgColor}`}>
                      <Icon className={`w-6 h-6 ${item.iconColor}`} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <section className="space-y-3 pt-1">
              <div className="flex justify-between items-center px-1">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Tin mới nhất</h2>
                <button onClick={() => setTab('announcements')} className="text-xs text-emerald-700 font-bold flex items-center hover:underline">
                  Xem tất cả <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-sm text-slate-500 text-center">Đang tải thông tin thôn...</div>
              ) : announcements.length === 0 ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Chào mừng bà con đến với cổng thông tin Thôn An Sơn</p>
                  <p className="text-xs text-slate-500">Chưa có thông báo mới. Ban thôn sẽ cập nhật kịp thời tại đây.</p>
                </div>
              ) : (
                announcements.slice(0, 3).map(a => (
                  <div key={a.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-emerald-600 border border-slate-100 shadow-sm space-y-2">
                    <div className="flex items-center gap-2">
                      {a.is_pinned && <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Ghim</span>}
                      {a.priority === 'urgent' && <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Khẩn cấp</span>}
                      <span className="text-xs font-bold text-emerald-700">Thông báo thôn</span>
                      <span className="text-[11px] text-slate-400 ml-auto">{new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-base leading-snug">{a.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-line">{a.content}</p>
                    {a.image_url && (
                      <a href={a.image_url} target="_blank" rel="noreferrer" className="block pt-1">
                        <img src={a.image_url} alt={a.title} className="w-full max-h-64 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                      </a>
                    )}
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopyPostLink('announcements', a)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
                      >
                        {copiedKey === `announcements-${a.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === `announcements-${a.id}` ? 'Đã sao chép link' : 'Sao chép link gửi Zalo'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-800">Nhận tin báo nhanh từ Ban thôn</div>
                <div className="text-xs text-slate-500">Bật 1 lần để điện thoại rung chuông ngay cả khi tắt ứng dụng</div>
              </div>
              <button onClick={requestNotification} className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0">
                <Bell className="w-4 h-4" /> {pushSubscribed ? 'Đã bật thông báo nền' : 'Bật thông báo'}
              </button>
            </div>
          </>
        )}

        {tab === 'announcements' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Thông báo Thôn An Sơn</h2>
            {announcements.length === 0 && <p className="text-slate-500 text-sm">Chưa có thông báo nào.</p>}
            {announcements.map(a => {
              const postKey = `announcements-${a.id}`;
              const isHighlighted = highlightedPost === postKey;
              return (
                <div
                  key={a.id}
                  id={`post-${postKey}`}
                  className={`bg-white p-5 rounded-2xl border shadow-sm space-y-2 transition ${isHighlighted ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-100'}`}
                >
                  <div className="text-xs text-slate-400">{a.is_pinned ? '📌 Đã ghim • ' : ''}{new Date(a.created_at).toLocaleDateString('vi-VN')}</div>
                  <h3 className="font-bold text-lg text-slate-800">{a.title}</h3>
                  <p className="text-slate-600 whitespace-pre-line">{a.content}</p>
                  {a.image_url && (
                    <a href={a.image_url} target="_blank" rel="noreferrer" className="block pt-1">
                      <img src={a.image_url} alt={a.title} className="w-full max-h-96 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                    </a>
                  )}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopyPostLink('announcements', a)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition"
                    >
                      {copiedKey === postKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === postKey ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'news' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Tin tức & Hoạt động cộng đồng</h2>
            {news.length === 0 && <p className="text-slate-500 text-sm">Chưa có bài viết nào.</p>}
            {news.map(n => {
              const postKey = `news-${n.id}`;
              const isHighlighted = highlightedPost === postKey;
              return (
                <div
                  key={n.id}
                  id={`post-${postKey}`}
                  className={`bg-white p-5 rounded-2xl border shadow-sm space-y-2 transition ${isHighlighted ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-100'}`}
                >
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-medium">{n.category}</span>
                  <h3 className="font-bold text-lg text-slate-800">{n.title}</h3>
                  <p className="text-slate-600 whitespace-pre-line">{n.content}</p>
                  {n.video_url && <a href={n.video_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-sky-700 font-semibold underline">▶ Xem video hoạt động</a>}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopyPostLink('news', n)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition"
                    >
                      {copiedKey === postKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedKey === postKey ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'officials' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Danh sách Cán bộ, Đoàn thể Thôn An Sơn</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input placeholder="Tìm theo tên hoặc chức vụ..." value={searchOfficial} onChange={e => setSearchOfficial(e.target.value)} className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {officials.filter(o => (o.full_name + o.role).toLowerCase().includes(searchOfficial.toLowerCase())).map(o => (
                <div key={o.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center gap-3">
                  <div>
                    <div className="font-bold text-slate-800">{o.full_name}</div>
                    <div className="text-sm text-emerald-700 font-medium">{o.role}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{o.phone}</div>
                  </div>
                  {o.phone && (
                    <a href={`tel:${o.phone.replace(/\s+/g, '')}`} className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl shrink-0" title="Gọi điện">
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Lịch sinh hoạt cộng đồng</h2>
            {events.length === 0 && <p className="text-slate-500 text-sm">Chưa có lịch sinh hoạt sắp tới.</p>}
            {events.map(ev => {
              const postKey = `events-${ev.id}`;
              const isHighlighted = highlightedPost === postKey;
              return (
                <div
                  key={ev.id}
                  id={`post-${postKey}`}
                  className={`bg-white p-4 rounded-2xl border shadow-sm flex gap-4 items-center ${isHighlighted ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-100'}`}
                >
                  <div className="bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl text-center min-w-[76px]">
                    <div className="text-xs font-semibold">{ev.event_date}</div>
                    <div className="text-sm font-bold">{ev.event_time}</div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{ev.title}</h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'feedback' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Gửi Phản ánh & Góp ý</h2>
            <p className="text-sm text-slate-500">Không cần đăng nhập. Mọi thông tin cá nhân và phản ánh của bà con được bảo mật, chỉ Ban thôn tiếp nhận xử lý.</p>
            <form onSubmit={handleFeedbackSubmit} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="Họ và tên (không bắt buộc)" value={fbForm.sender_name} onChange={e => setFbForm({ ...fbForm, sender_name: e.target.value })} className="border px-4 py-2.5 rounded-xl text-sm" />
                <input placeholder="Số điện thoại (không bắt buộc)" value={fbForm.sender_phone} onChange={e => setFbForm({ ...fbForm, sender_phone: e.target.value })} className="border px-4 py-2.5 rounded-xl text-sm" />
              </div>
              <select value={fbForm.category} onChange={e => setFbForm({ ...fbForm, category: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm">
                <option>Đường làng, ngõ xóm</option>
                <option>Vệ sinh môi trường</option>
                <option>Điện chiếu sáng</option>
                <option>An ninh, trật tự</option>
                <option>Hoạt động cộng đồng</option>
                <option>Ý kiến góp ý khác</option>
              </select>
              <textarea required rows={4} placeholder="Nhập nội dung phản ánh hoặc góp ý của bà con..." value={fbForm.content} onChange={e => setFbForm({ ...fbForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm" />
              <button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl">Gửi phản ánh đến Ban thôn</button>
            </form>
          </div>
        )}

        {tab === 'map' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Bản đồ & Địa điểm Thôn An Sơn</h2>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  title="Bản đồ Thôn An Sơn, xã Cam Lộ"
                  src="https://maps.google.com/maps?q=Th%C3%B4n%20An%20S%C6%A1n,%20Cam%20L%E1%BB%99,%20Qu%E1%BA%A3ng%20Tr%E1%BB%8B&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  className="w-full h-72 border-0"
                  loading="lazy"
                />
              </div>
              <div className="space-y-2 pt-1">
                <div className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-700" /> Nhà văn hóa & Trung tâm Văn hóa Thôn An Sơn</div>
                <p className="text-xs text-slate-500">Địa chỉ: Thôn An Sơn, xã Cam Lộ, tỉnh Quảng Trị</p>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Th%C3%B4n+An+S%C6%A1n+Cam+L%E1%BB%99+Qu%E1%BA%A3ng+Tr%E1%BB%8B"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                   Mở chỉ đường trên Google Maps <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {tab === 'contact' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Liên hệ nhanh & Số khẩn cấp</h2>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-emerald-800 text-sm uppercase">Ban quản lý & Tổ ANTT Thôn An Sơn</h3>
              {officials.length === 0 ? (
                <p className="text-sm text-slate-500">Xem danh bạ chi tiết trong mục Cán bộ.</p>
              ) : (
                <div className="divide-y">
                  {officials.map(o => (
                    <div key={o.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{o.full_name}</div>
                        <div className="text-xs text-slate-500">{o.role}</div>
                      </div>
                      {o.phone && (
                        <a href={`tel:${o.phone.replace(/\s+/g, '')}`} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {o.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="font-bold text-red-700 text-sm uppercase">Đường dây nóng khẩn cấp toàn quốc</h3>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                {[
                  { label: 'Công an', num: '113' },
                  { label: 'Cứu hỏa', num: '114' },
                  { label: 'Cấp cứu', num: '115' },
                ].map(em => (
                  <a key={em.num} href={`tel:${em.num}`} className="bg-red-50 hover:bg-red-100 border border-red-100 p-3 rounded-xl">
                    <div className="text-lg font-extrabold text-red-600">{em.num}</div>
                    <div className="text-xs font-semibold text-slate-700">{em.label}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'gallery' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Thư viện ảnh hoạt động Thôn An Sơn</h2>
            {galleryItems.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                Chưa có hình ảnh nào được đăng tải. Hình ảnh đính kèm trong các thông báo của thôn sẽ tự động hiển thị tại đây.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {galleryItems.map(item => (
                  <a key={item.id} href={item.image_url} target="_blank" rel="noreferrer" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
                    <img src={item.image_url} alt={item.title} className="w-full h-52 object-cover group-hover:scale-[1.02] transition" />
                    <div className="p-3">
                      <div className="font-bold text-sm text-slate-800 line-clamp-1">{item.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleDateString('vi-VN')}</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'more' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center space-y-3">
              <h3 className="font-bold text-lg text-slate-800">Mã QR truy cập nhanh</h3>
              <QRImage url={siteUrl} size={200} />
              <p className="text-xs text-slate-500">Đưa mã này cho bà con quét bằng Zalo hoặc Camera điện thoại để mở ngay ứng dụng Thôn An Sơn.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-lg text-slate-800 mb-2">Danh sách công khai của thôn</h3>
              {customLists.filter(l => l.is_public).length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có danh sách công khai nào được đăng tải.</p>
              ) : customLists.filter(l => l.is_public).map(l => (
                <div key={l.id} className="border-t pt-3 mt-3 first:border-0 first:pt-0">
                  <div className="font-bold text-emerald-800">{l.title}</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {customItems.filter(i => i.list_id === l.id).map(i => (
                      <li key={i.id}>• <strong>{i.name}</strong> {i.role_or_group && `(${i.role_or_group})`} {i.detail && `– ${i.detail}`}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2 z-40">
        {[
          { id: 'home', label: 'Trang chủ', icon: Home },
          { id: 'announcements', label: 'Thông báo', icon: Bell },
          { id: 'officials', label: 'Cán bộ', icon: Users },
          { id: 'feedback', label: 'Phản ánh', icon: MessageSquare },
        ].map(n => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)} className={`flex flex-col items-center gap-0.5 px-3 py-1 ${active ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[11px]">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-emerald-800">Chia sẻ Thôn An Sơn</h3>
              <button onClick={() => setShowQRModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <QRImage url={siteUrl} size={220} />
            <p className="text-xs text-slate-500">Quét mã QR bằng Zalo hoặc Camera để mở ngay ứng dụng.</p>
          </div>
        </div>
      )}
    </div>
  );
}
