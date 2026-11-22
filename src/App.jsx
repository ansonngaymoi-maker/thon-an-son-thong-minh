import React, { useState, useEffect } from 'react';
import {
  Bell, Home, Newspaper, Users, Calendar, MessageSquare, QrCode,
  Shield, Phone, MapPin, Plus, Trash2, Edit2, LogOut, Search,
  CheckCircle, AlertTriangle, Download, Printer, ListPlus,
  Home as HomeIcon, Lock, Eye, EyeOff, RefreshCw, Info, ChevronRight, X,
  Image as ImageIcon
} from 'lucide-react';
import { supabase, isConfigured } from './supabaseClient';

const APP_VERSION = 'v1.1.0';

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
  const [selectedListId, setSelectedListId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [toast, setToast] = useState('');
  const [pushStatus, setPushStatus] = useState('idle');

  // Announcement image upload states
  const [annImageFile, setAnnImageFile] = useState(null);
  const [annImagePreview, setAnnImagePreview] = useState('');
  const [uploadingAnn, setUploadingAnn] = useState(false);

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

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

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
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && isConfigured) {
      fetchAdminData();
    }
  }, [session]);

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
      if (a.data) setAnnouncements(a.data);
      if (n.data) setNews(n.data);
      if (o.data) setOfficials(o.data);
      if (e.data) setEvents(e.data);
      if (cl.data) setCustomLists(cl.data);
      if (ci.data) setCustomItems(ci.data);
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
      const { error } = await supabase.from('announcements').insert([payload]);
      if (!error) {
        setAnnForm({ title: '', content: '', priority: 'normal', is_pinned: false });
        clearAnnImage();
        fetchPublicData();
        showToast('Đã đăng thông báo mới!');
      } else {
        showToast('Lỗi đăng thông báo: ' + error.message);
      }
    } finally {
      setUploadingAnn(false);
    }
  };

  const requestNotification = async () => {
    if (!('Notification' in window)) {
      showToast('Trình duyệt chưa hỗ trợ thông báo đẩy. Trên iPhone hãy thêm ra Màn hình chính trước.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setPushStatus('granted');
      showToast('Đã bật quyền nhận thông báo từ Thôn An Sơn!');
    } else {
      showToast('Bạn đã từ chối quyền thông báo.');
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

  // ==================== ADMIN VIEW ====================
  if (mode === 'admin') {
    if (!session) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-800 to-sky-900 flex items-center justify-center p-4">
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
      { id: 'overview', label: 'Tổng quan', icon: HomeIcon },
      { id: 'announcements', label: 'Thông báo', icon: Bell },
      { id: 'news', label: 'Tin tức', icon: Newspaper },
      { id: 'officials', label: 'Cán bộ', icon: Users },
      { id: 'events', label: 'Lịch thôn', icon: Calendar },
      { id: 'feedbacks', label: `Phản ánh (${feedbacks.filter(f => f.status === 'received').length})`, icon: MessageSquare },
      { id: 'households', label: 'Hộ dân & Dân cư', icon: Shield },
      { id: 'lists', label: 'Danh sách mở rộng', icon: ListPlus },
      { id: 'qr', label: 'Mã QR & In ấn', icon: QrCode },
      { id: 'system', label: 'Sao lưu & Phiên bản', icon: RefreshCw },
    ];

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
        {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-lg no-print">{toast}</div>}

        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-emerald-900 text-white p-4 flex flex-col no-print">
          <div className="mb-6 pb-4 border-b border-emerald-800">
            <h2 className="font-bold text-lg">QUẢN TRỊ AN SƠN</h2>
            <p className="text-xs text-emerald-300 truncate">{session.user.email}</p>
          </div>
          <nav className="flex-1 space-y-1 overflow-x-auto flex md:block gap-1">
            {adminMenu.map(m => {
              const Icon = m.icon;
              return (
                <button key={m.id} onClick={() => setAdminTab(m.id)} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap w-full text-left transition ${adminTab === m.id ? 'bg-white text-emerald-900' : 'text-emerald-100 hover:bg-emerald-800'}`}>
                  <Icon className="w-4 h-4 shrink-0" /> {m.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-4 pt-4 border-t border-emerald-800 flex gap-2">
            <button onClick={() => setMode('public')} className="flex-1 bg-emerald-800 hover:bg-emerald-700 py-2 rounded-lg text-xs font-medium">Trang dân</button>
            <button onClick={handleLogout} className="flex items-center justify-center gap-1 bg-red-600/80 hover:bg-red-600 px-3 py-2 rounded-lg text-xs font-medium"><LogOut className="w-3.5 h-3.5" /> Thoát</button>
          </div>
        </aside>

        {/* Main Admin Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {adminTab === 'overview' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống Thôn An Sơn</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Thông báo', val: announcements.length, color: 'bg-emerald-600' },
                  { label: 'Cán bộ, đoàn thể', val: officials.length, color: 'bg-sky-600' },
                  { label: 'Hộ dân (Nội bộ)', val: households.length, color: 'bg-indigo-600' },
                  { label: 'Phản ánh mới', val: feedbacks.filter(f => f.status === 'received').length, color: 'bg-amber-600' },
                ].map((c, i) => (
                  <div key={i} className={`${c.color} text-white p-5 rounded-2xl shadow`}>
                    <div className="text-3xl font-bold">{c.val}</div>
                    <div className="text-sm opacity-90 mt-1">{c.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h3 className="font-bold text-slate-800 mb-2">Trạng thái bảo mật & Kết nối</h3>
                <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Đã kết nối cơ sở dữ liệu Supabase thời gian thực. Dữ liệu Hộ dân, Dân cư và Phản ánh được bảo vệ bằng Row Level Security (RLS).</p>
              </div>
            </div>
          )}

          {adminTab === 'announcements' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Thông báo thôn</h1>
              <form onSubmit={handleAnnouncementSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <input required placeholder="Tiêu đề thông báo..." value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <textarea required rows={4} placeholder="Nội dung chi tiết..." value={annForm.content} onChange={e => setAnnForm({ ...annForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />

                {/* Chọn ảnh đính kèm */}
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
                const { error } = await supabase.from('news').insert([newsForm]);
                if (!error) { setNewsForm({ title: '', content: '', category: 'Hoạt động cộng đồng', video_url: '' }); fetchPublicData(); showToast('Đã đăng bài viết!'); }
                else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <input required placeholder="Tiêu đề bài viết..." value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <textarea required rows={4} placeholder="Nội dung bài viết..." value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <input placeholder="Link video YouTube (nếu có)..." value={newsForm.video_url} onChange={e => setNewsForm({ ...newsForm, video_url: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm" />
                <button className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold">Đăng bài viết</button>
              </form>
              <div className="space-y-3">
                {news.map(n => (
                  <div key={n.id} className="bg-white p-4 rounded-xl border flex justify-between items-start">
                    <div><div className="font-bold">{n.title}</div><p className="text-sm text-slate-600 mt-1">{n.content}</p></div>
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
                const { error } = await supabase.from('events').insert([evtForm]);
                if (!error) { setEvtForm({ title: '', event_date: '', event_time: '19:30', location: 'Nhà văn hóa thôn An Sơn', category: 'Họp dân', description: '' }); fetchPublicData(); showToast('Đã thêm lịch!'); }
                else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl border grid md:grid-cols-3 gap-3">
                <input required placeholder="Tên sự kiện / cuộc họp" value={evtForm.title} onChange={e => setEvtForm({ ...evtForm, title: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <input required type="date" value={evtForm.event_date} onChange={e => setEvtForm({ ...evtForm, event_date: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <input placeholder="Giờ (VD: 19:30)" value={evtForm.event_time} onChange={e => setEvtForm({ ...evtForm, event_time: e.target.value })} className="border px-3 py-2 rounded-xl" />
                <input placeholder="Địa điểm" value={evtForm.location} onChange={e => setEvtForm({ ...evtForm, location: e.target.value })} className="border px-3 py-2 rounded-xl md:col-span-2" />
                <button className="bg-emerald-700 text-white rounded-xl font-semibold py-2">+ Thêm lịch</button>
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

              {/* Add Household */}
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

              {/* Add Resident */}
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
                    <p className="text-sm text-slate-500">Kiến trúc PWA mô-đun hóa, tự động cập nhật khi có bản nâng cấp mới trên Vercel.</p>
                  </div>
                  <button onClick={() => window.location.reload(true)} className="bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Kiểm tra cập nhật</button>
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
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-lg">{toast}</div>}

      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-sky-700 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full capitalize">{todayStr}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQRModal(true)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl" title="Mã QR chia sẻ"><QrCode className="w-5 h-5" /></button>
              <button onClick={() => setMode('admin')} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Ban quản trị</button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="Logo" className="w-14 h-14 rounded-2xl shadow" />
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">THÔN AN SƠN</h1>
              <p className="text-xs md:text-sm text-emerald-100 font-medium">XÃ CAM LỘ – TỈNH QUẢNG TRỊ</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        {tab === 'home' && (
          <>
            {/* Welcome Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100">
              <h2 className="text-lg font-bold text-emerald-800">CHÀO MỪNG BÀ CON ĐẾN VỚI THÔN AN SƠN</h2>
              <p className="text-sm text-slate-600 mt-1">Thông tin nhanh chóng – Kết nối cộng đồng – Chung tay xây dựng quê hương.</p>
              <button onClick={requestNotification} className="mt-4 w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
                <Bell className="w-4 h-4" /> {pushStatus === 'granted' ? 'Đã bật thông báo từ thôn' : 'ĐĂNG KÝ NHẬN THÔNG BÁO TỪ THÔN'}
              </button>
            </div>

            {/* Big Icon Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { id: 'announcements', label: 'Thông báo', icon: Bell, color: 'bg-red-50 text-red-600' },
                { id: 'news', label: 'Tin tức', icon: Newspaper, color: 'bg-emerald-50 text-emerald-700' },
                { id: 'events', label: 'Lịch thôn', icon: Calendar, color: 'bg-sky-50 text-sky-700' },
                { id: 'officials', label: 'Cán bộ', icon: Users, color: 'bg-indigo-50 text-indigo-700' },
                { id: 'feedback', label: 'Phản ánh', icon: MessageSquare, color: 'bg-amber-50 text-amber-700' },
                { id: 'more', label: 'Khác & QR', icon: Info, color: 'bg-teal-50 text-teal-700' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => setTab(item.id)} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow flex flex-col items-center gap-2 transition">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color}`}><Icon className="w-6 h-6" /></div>
                    <span className="text-xs font-semibold text-slate-700 text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Latest Announcements */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800">Thông báo mới nhất</h3>
                <button onClick={() => setTab('announcements')} className="text-sm text-emerald-700 font-medium flex items-center">Xem tất cả <ChevronRight className="w-4 h-4" /></button>
              </div>
              {loading ? <p className="text-sm text-slate-500">Đang tải dữ liệu...</p> : announcements.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border text-center text-slate-500 text-sm">Chưa có thông báo mới. Ban thôn sẽ cập nhật sớm!</div>
              ) : announcements.slice(0, 3).map(a => (
                <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    {a.is_pinned && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Ghim</span>}
                    {a.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Khẩn cấp</span>}
                    <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <h4 className="font-bold text-slate-800">{a.title}</h4>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{a.content}</p>
                  {a.image_url && (
                    <a href={a.image_url} target="_blank" rel="noreferrer" className="block mt-3">
                      <img src={a.image_url} alt={a.title} className="w-full max-h-80 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                    </a>
                  )}
                </div>
              ))}
            </section>
          </>
        )}

        {tab === 'announcements' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Thông báo Thôn An Sơn</h2>
            {announcements.length === 0 && <p className="text-slate-500 text-sm">Chưa có thông báo nào.</p>}
            {announcements.map(a => (
              <div key={a.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                <div className="text-xs text-slate-400 mb-1">{a.is_pinned ? '📌 Đã ghim • ' : ''}{new Date(a.created_at).toLocaleDateString('vi-VN')}</div>
                <h3 className="font-bold text-lg text-slate-800">{a.title}</h3>
                <p className="text-slate-600 mt-2 whitespace-pre-line">{a.content}</p>
                {a.image_url && (
                  <a href={a.image_url} target="_blank" rel="noreferrer" className="block mt-3">
                    <img src={a.image_url} alt={a.title} className="w-full max-h-96 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'news' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Tin tức & Hoạt động cộng đồng</h2>
            {news.length === 0 && <p className="text-slate-500 text-sm">Chưa có bài viết nào.</p>}
            {news.map(n => (
              <div key={n.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-medium">{n.category}</span>
                <h3 className="font-bold text-lg mt-2">{n.title}</h3>
                <p className="text-slate-600 mt-2 whitespace-pre-line">{n.content}</p>
                {n.video_url && <a href={n.video_url} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-sky-700 font-semibold underline">▶ Xem video hoạt động</a>}
              </div>
            ))}
          </div>
        )}

        {tab === 'officials' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Danh sách Cán bộ, Đoàn thể Thôn An Sơn</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input placeholder="Tìm theo tên hoặc chức vụ..." value={searchOfficial} onChange={e => setSearchOfficial(e.target.value)} className="w-full bg-white border pl-10 pr-4 py-2.5 rounded-xl text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {officials.filter(o => (o.full_name + o.role).toLowerCase().includes(searchOfficial.toLowerCase())).map(o => (
                <div key={o.id} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center gap-3">
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
            {events.map(ev => (
              <div key={ev.id} className="bg-white p-4 rounded-2xl border shadow-sm flex gap-4 items-center">
                <div className="bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl text-center min-w-[76px]">
                  <div className="text-xs font-semibold">{ev.event_date}</div>
                  <div className="text-sm font-bold">{ev.event_time}</div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{ev.title}</h3>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'feedback' && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
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

        {tab === 'more' && (
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl border shadow-sm">
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

            <div className="bg-white p-5 rounded-2xl border shadow-sm text-center space-y-3">
              <h3 className="font-bold text-lg text-slate-800">Mã QR truy cập nhanh</h3>
              <QRImage url={siteUrl} size={200} />
              <p className="text-xs text-slate-500">Đưa mã này cho bà con quét bằng Zalo hoặc Camera điện thoại để mở ngay ứng dụng Thôn An Sơn.</p>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
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

      {/* QR Modal */}
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
