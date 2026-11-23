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
                        on
