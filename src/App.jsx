import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Home, Newspaper, Users, Calendar, MessageSquare, QrCode,
  Shield, Phone, MapPin, Plus, Trash2, LogOut, Search,
  CheckCircle, AlertTriangle, Download, Printer, ListPlus,
  Home as HomeIcon, Lock, RefreshCw, ChevronRight, ChevronLeft, X,
  Image as ImageIcon, Map, PhoneCall, ExternalLink, Copy, Check, ArrowDown,
  Settings, FileSpreadsheet, Upload, Lightbulb, HeartHandshake, Pencil, Wallet,
  Sparkles, Compass, Clock, BookOpen
} from 'lucide-react';
import { supabase, isConfigured } from './supabaseClient';

const APP_VERSION = 'v1.6.6';
const PUBLIC_PAGE_SIZE = 6;
const SEEN_IDS_KEY = 'thon_an_son_seen_post_ids_v1';
const SETTINGS_STORAGE_KEY = 'thon_an_son_app_settings_v1';
const FONT_SIZE_STORAGE_KEY = 'thon_an_son_font_size_v1';
const DONATION_LIST_MARKER = '__THON_AN_SON_UNG_HO__';
const LEDGER_LIST_MARKER = '__THON_AN_SON_THU_CHI__';
const SCHEDULE_META_PREFIX = '__ANN_SCHEDULE__:';
const NEWS_TAG_PREFIX = '__IS_NEWS__:1\n';
const NEWS_IMAGE_META_PREFIX = '__NEWS_IMAGE__:';
const FEEDBACK_ATTACHMENT_META_PREFIX = '__FEEDBACK_ATTACHMENTS__:';
const FEEDBACK_ATTACHMENT_BUCKET = 'phan-anh-dinh-kem';
const MAX_FEEDBACK_ATTACHMENT_COUNT = 3;
const MAX_FEEDBACK_ATTACHMENT_SIZE = 8 * 1024 * 1024;
const MAX_FEEDBACK_ATTACHMENTS_TOTAL_SIZE = 15 * 1024 * 1024;
const FEEDBACK_ATTACHMENT_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
};
const NEWS_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const ONESIGNAL_APP_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ONESIGNAL_APP_ID) ||
  'e21ec54f-f220-4014-a603-d9c0f23977ab';

const DEFAULT_SETTINGS = {
  village_name: 'THÔN AN SƠN',
  subtitle: 'Xã Cam Lộ – Tỉnh Quảng Trị',
  address: 'Thôn An Sơn, xã Cam Lộ, tỉnh Quảng Trị',
  cultural_house_name: 'Nhà văn hóa thôn An Sơn',
  cultural_house_query: 'Nhà văn hóa thôn An Sơn, Cam Lộ, Quảng Trị',
  cultural_house_lat: '16.74527',
  cultural_house_lng: '106.9635',
  cultural_house_note: 'Điểm sinh hoạt cộng đồng, hội họp và đón tiếp bà con thôn An Sơn.',
  public_notice: 'Thông tin cộng đồng – Kết nối người dân – Chung tay xây dựng quê hương',
};

const QRImage = ({ url, size = 200 }) => {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
  return <img src={src} alt="Mã QR Thôn An Sơn" width={size} height={size} className="rounded-xl border border-slate-200 bg-white p-2 mx-auto" />;
};

const PaginationControls = ({ currentPage, totalItems, pageSize = PUBLIC_PAGE_SIZE, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  return (
    <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-2">
      <button
        type="button"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
      >
        <ChevronLeft className="w-4 h-4" /> Trước
      </button>
      <div className="text-center">
        <span className="text-xs font-extrabold text-emerald-800">Trang {safePage}/{totalPages}</span>
        <span className="block text-[11px] text-slate-400">Hiển thị {startItem}–{endItem} / {totalItems}</span>
      </div>
      <button
        type="button"
        disabled={safePage >= totalPages}
        onClick={() => onPageChange(safePage + 1)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
      >
        Sau <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const loadXlsxLibrary = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('xlsx-cdn-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.XLSX));
      existing.addEventListener('error', () => reject(new Error('Không tải được thư viện đọc file Excel')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'xlsx-cdn-script';
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Không tải được thư viện đọc file Excel'));
    document.head.appendChild(script);
  });
};

const buildCulturalHouseMapUrl = (settings) => {
  const lat = String(settings?.cultural_house_lat || '').trim();
  const lng = String(settings?.cultural_house_lng || '').trim();
  if (lat && lng) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }
  const query = String(settings?.cultural_house_query || settings?.cultural_house_name || 'Nhà văn hóa thôn An Sơn, Cam Lộ, Quảng Trị').trim();
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
};

const buildCulturalHouseExternalUrl = (settings) => {
  const lat = String(settings?.cultural_house_lat || '').trim();
  const lng = String(settings?.cultural_house_lng || '').trim();
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  const query = String(settings?.cultural_house_query || settings?.cultural_house_name || 'Nhà văn hóa thôn An Sơn Cam Lộ Quảng Trị').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const isSuggestionRecord = (fb) => String(fb?.category || '').startsWith('[GÓP Ý]');

const packNewsContent = (content, imageUrl) => {
  if (!imageUrl) return String(content || '');
  return `${NEWS_IMAGE_META_PREFIX}${JSON.stringify({ imageUrl })}\n${String(content || '')}`;
};

const parseNewsContent = (raw) => {
  const text = String(raw || '');
  if (!text.startsWith(NEWS_IMAGE_META_PREFIX)) return { content: text, imageUrl: '' };
  const firstNl = text.indexOf('\n');
  if (firstNl < 0) return { content: text, imageUrl: '' };
  try {
    const meta = JSON.parse(text.slice(NEWS_IMAGE_META_PREFIX.length, firstNl));
    return { content: text.slice(firstNl + 1), imageUrl: String(meta?.imageUrl || '') };
  } catch (_e) {
    return { content: text, imageUrl: '' };
  }
};

const packFeedbackContent = (content, attachments) => {
  if (!attachments?.length) return String(content || '');
  return `${FEEDBACK_ATTACHMENT_META_PREFIX}${JSON.stringify(attachments)}\n${String(content || '')}`;
};

const parseFeedbackContent = (raw) => {
  const text = String(raw || '');
  if (!text.startsWith(FEEDBACK_ATTACHMENT_META_PREFIX)) return { content: text, attachments: [] };
  const firstNl = text.indexOf('\n');
  if (firstNl < 0) return { content: text, attachments: [] };
  try {
    const attachments = JSON.parse(text.slice(FEEDBACK_ATTACHMENT_META_PREFIX.length, firstNl));
    return {
      content: text.slice(firstNl + 1),
      attachments: Array.isArray(attachments) ? attachments : [],
    };
  } catch (_e) {
    return { content: text, attachments: [] };
  }
};

const getFeedbackAttachmentMimeType = (file) => {
  const allowedTypes = Object.values(FEEDBACK_ATTACHMENT_MIME_TYPES);
  const extension = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  const extensionType = FEEDBACK_ATTACHMENT_MIME_TYPES[extension] || '';
  if (allowedTypes.includes(file.type)) return extensionType && extensionType !== file.type ? '' : file.type;
  if (!file.type || file.type === 'application/octet-stream') return extensionType;
  return '';
};

const getFeedbackAttachmentExtension = (file, mimeType) => {
  const originalExtension = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  if (FEEDBACK_ATTACHMENT_MIME_TYPES[originalExtension] === mimeType) return originalExtension;
  return Object.keys(FEEDBACK_ATTACHMENT_MIME_TYPES).find((extension) => FEEDBACK_ATTACHMENT_MIME_TYPES[extension] === mimeType) || '.bin';
};

const getNewsImageMimeType = (file) => {
  if (NEWS_IMAGE_EXTENSIONS[file.type]) return file.type;
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  return Object.entries(NEWS_IMAGE_EXTENSIONS).find(([, allowedExtension]) => allowedExtension === extension)?.[0] || '';
};

const parseMoneyAmount = (raw) => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const digits = String(raw || '').replace(/[^\d-]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
};

const formatVND = (num) => {
  const val = Number(num) || 0;
  return `${val.toLocaleString('vi-VN')} đ`;
};

const encodeMeta = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (_e) {
    return '';
  }
};

const decodeMeta = (raw, fallback = {}) => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch (_e) {
    return { ...fallback, note: String(raw) };
  }
};

const syncOneSignalAdminTag = (isAdmin) => {
  if (typeof window === 'undefined') return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    try {
      if (isAdmin) {
        await OneSignal.User?.addTag?.('is_admin', 'true');
      } else {
        await OneSignal.User?.removeTag?.('is_admin');
      }
    } catch (_e) {
      // Bỏ qua nếu thiết bị chưa cấp quyền thông báo
    }
  });
};

const getVietnamDateTimeInputs = (offsetMinutes = 0) => {
  const vnDate = new Date(Date.now() + offsetMinutes * 60000 + 7 * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${vnDate.getUTCFullYear()}-${pad(vnDate.getUTCMonth() + 1)}-${pad(vnDate.getUTCDate())}`;
  const timeStr = `${pad(vnDate.getUTCHours())}:${pad(vnDate.getUTCMinutes())}`;
  return { dateStr, timeStr };
};

const parseVietnamScheduledMs = (dateStr, timeStr) => {
  const cleanDate = String(dateStr || '').trim();
  if (!cleanDate) return 0;
  const rawTime = String(timeStr || '07:00').trim();
  const hhmm = rawTime.length >= 5 ? rawTime.slice(0, 5) : '07:00';
  const ms = new Date(`${cleanDate}T${hhmm}:00+07:00`).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const parseScheduledItem = (raw) => {
  const text = String(raw || '');
  const firstNl = text.indexOf('\n');
  const firstLine = firstNl === -1 ? text : text.slice(0, firstNl);
  if (!firstLine.startsWith(SCHEDULE_META_PREFIX)) {
    const isNewsPost = text.startsWith(NEWS_TAG_PREFIX);
    return {
      hasSchedule: false,
      publishAtMs: 0,
      publishLabel: '',
      sendPush: false,
      pushedDone: true,
      isNewsPost,
      cleanContent: isNewsPost ? text.slice(NEWS_TAG_PREFIX.length) : text,
    };
  }
  const jsonPart = firstLine.slice(SCHEDULE_META_PREFIX.length);
  const bodyPart = firstNl === -1 ? '' : text.slice(firstNl + 1);
  try {
    const meta = JSON.parse(jsonPart);
    const ms = Number(meta?.publishAtMs) || 0;
    const isNewsPost = bodyPart.startsWith(NEWS_TAG_PREFIX);
    return {
      hasSchedule: ms > 0,
      publishAtMs: ms,
      publishLabel: meta?.publishLabel || (ms ? new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : ''),
      sendPush: Boolean(meta?.sendPush),
      pushedDone: Boolean(meta?.pushedDone),
      isNewsPost,
      cleanContent: isNewsPost ? bodyPart.slice(NEWS_TAG_PREFIX.length) : bodyPart,
    };
  } catch (_e) {
    return {
      hasSchedule: false,
      publishAtMs: 0,
      publishLabel: '',
      sendPush: false,
      pushedDone: true,
      isNewsPost: false,
      cleanContent: bodyPart,
    };
  }
};

const packScheduledItem = ({ cleanContent, scheduleDate, scheduleTime, sendPush, isNewsPost }) => {
  const bodyCore = `${isNewsPost ? NEWS_TAG_PREFIX : ''}${String(cleanContent || '').trim()}`;
  const ms = parseVietnamScheduledMs(scheduleDate, scheduleTime);
  if (!ms) return bodyCore;
  const timeClean = (scheduleTime || '07:00').trim();
  const metaObj = {
    publishAtMs: ms,
    publishLabel: `${scheduleDate} ${timeClean} (GMT+7)`,
    sendPush: Boolean(sendPush),
    pushedDone: ms <= Date.now() + 15000,
  };
  return `${SCHEDULE_META_PREFIX}${JSON.stringify(metaObj)}\n${bodyCore}`;
};

const parseEventInfo = (ev) => {
  const rawDesc = String(ev?.description || '');
  let publishAtMs = 0;
  let publishLabel = '';
  let cleanDesc = rawDesc;

  if (rawDesc.startsWith(SCHEDULE_META_PREFIX)) {
    const nlIdx = rawDesc.indexOf('\n');
    const headJson = nlIdx === -1 ? rawDesc.slice(SCHEDULE_META_PREFIX.length) : rawDesc.slice(SCHEDULE_META_PREFIX.length, nlIdx);
    cleanDesc = nlIdx === -1 ? '' : rawDesc.slice(nlIdx + 1);
    try {
      const m = JSON.parse(headJson);
      publishAtMs = Number(m?.publishAtMs) || 0;
      publishLabel = m?.publishLabel || '';
    } catch (_e) {
      publishAtMs = 0;
    }
  }

  return {
    publishAtMs,
    publishLabel,
    cleanDesc,
    evtDate: String(ev?.event_date || '').trim(),
  };
};

export default function App() {
  const isInitialAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const [mode, setMode] = useState(isInitialAdmin ? 'admin' : 'public');
  const [tab, setTab] = useState('home');
  const [feedSubTab, setFeedSubTab] = useState('all');
  const [directorySubTab, setDirectorySubTab] = useState('officials');
  const [voiceSubTab, setVoiceSubTab] = useState('feedback');
  const [adminTab, setAdminTab] = useState('overview');
  const [largeText, setLargeText] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(FONT_SIZE_STORAGE_KEY) === 'large';
    } catch (_e) {
      return false;
    }
  });

  const [quickSearch, setQuickSearch] = useState('');

  // Auth
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Settings
  const [appSettings, setAppSettings] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (_e) {
      return DEFAULT_SETTINGS;
    }
  });
  const [settingsForm, setSettingsForm] = useState(appSettings);
  const [savingSettings, setSavingSettings] = useState(false);

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
  const [feedbackFilter, setFeedbackFilter] = useState('all');
  const [showResolvedFeedback, setShowResolvedFeedback] = useState(false);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);

  // Excel import states
  const [excelFileName, setExcelFileName] = useState('');
  const [excelPreviewRows, setExcelPreviewRows] = useState([]);
  const [importingExcel, setImportingExcel] = useState(false);

  // Finance & Donations states
  const [financePublicSubTab, setFinancePublicSubTab] = useState('donations');
  const [searchFinance, setSearchFinance] = useState('');
  const [editingDonationId, setEditingDonationId] = useState(null);
  const [sendPushOnDonation, setSendPushOnDonation] = useState(true);
  const [donationForm, setDonationForm] = useState({
    donor_name: '',
    area_or_org: '',
    amount: '',
    in_kind: '',
    campaign: 'Vận động xây dựng & hoạt động thôn',
    date: getVietnamDateTimeInputs(0).dateStr,
    note: '',
  });
  const [editingLedgerId, setEditingLedgerId] = useState(null);
  const [sendPushOnLedger, setSendPushOnLedger] = useState(true);
  const [ledgerForm, setLedgerForm] = useState({
    type: 'thu',
    title: '',
    amount: '',
    date: getVietnamDateTimeInputs(0).dateStr,
    campaign: 'Quỹ vận động thôn An Sơn',
    note: '',
  });
  const [savingFinance, setSavingFinance] = useState(false);

  // UI states
  const [searchOfficial, setSearchOfficial] = useState('');
  const [searchHousehold, setSearchHousehold] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [detailModalPost, setDetailModalPost] = useState(null);
  const [toast, setToast] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [highlightedPost, setHighlightedPost] = useState('');
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // Pagination states
  const [homeAnnPage, setHomeAnnPage] = useState(1);
  const [homeNewsPage, setHomeNewsPage] = useState(1);
  const [feedAnnPage, setFeedAnnPage] = useState(1);
  const [feedNewsPage, setFeedNewsPage] = useState(1);
  const [financeDonPage, setFinanceDonPage] = useState(1);
  const [financeLedgerPage, setFinanceLedgerPage] = useState(1);

  // Pull-to-refresh states
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef(0);
  const isPullingRef = useRef(false);

  const hasInitializedFeedRef = useRef(false);
  const pendingUrlPostRef = useRef('');

  // Schedule toggles
  const defaultLater = getVietnamDateTimeInputs(5);
  const [annImageFile, setAnnImageFile] = useState(null);
  const [annImagePreview, setAnnImagePreview] = useState('');
  const [uploadingAnn, setUploadingAnn] = useState(false);
  const [newsImageFile, setNewsImageFile] = useState(null);
  const [newsImagePreview, setNewsImagePreview] = useState('');
  const [uploadingNews, setUploadingNews] = useState(false);
  const [sendPushOnAnn, setSendPushOnAnn] = useState(true);
  const [useAnnSchedule, setUseAnnSchedule] = useState(false);
  const [annScheduleDate, setAnnScheduleDate] = useState(defaultLater.dateStr);
  const [annScheduleTime, setAnnScheduleTime] = useState(defaultLater.timeStr);

  const [sendPushOnNews, setSendPushOnNews] = useState(true);
  const [useNewsSchedule, setUseNewsSchedule] = useState(false);
  const [newsScheduleDate, setNewsScheduleDate] = useState(defaultLater.dateStr);
  const [newsScheduleTime, setNewsScheduleTime] = useState(defaultLater.timeStr);

  const [sendPushOnEvent, setSendPushOnEvent] = useState(true);
  const [useEvtSchedule, setUseEvtSchedule] = useState(false);
  const [evtPublishDate, setEvtPublishDate] = useState(defaultLater.dateStr);
  const [evtPublishTime, setEvtPublishTime] = useState(defaultLater.timeStr);

  // Feedback & Suggestion forms
  const [fbForm, setFbForm] = useState({ sender_name: '', sender_phone: '', category: 'Đường làng, ngõ xóm', content: '' });
  const [feedbackAttachmentFiles, setFeedbackAttachmentFiles] = useState([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [sugForm, setSugForm] = useState({
    sender_name: '',
    sender_phone: '',
    area: '',
    topic: 'Xây dựng đời sống văn hóa, nông thôn mới',
    content: '',
  });
  const [submittingSug, setSubmittingSug] = useState(false);

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (largeText) {
      document.documentElement.setAttribute('data-font-size', 'large');
    } else {
      document.documentElement.removeAttribute('data-font-size');
    }
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, largeText ? 'large' : 'normal');
    } catch (_e) {
      // Cỡ chữ vẫn được áp dụng trong phiên hiện tại nếu trình duyệt chặn lưu trữ.
    }
  }, [largeText]);

  useEffect(() => {
    setFinanceDonPage(1);
    setFinanceLedgerPage(1);
  }, [searchFinance, financePublicSubTab]);

  const showToast = (msg, duration = 5000) => {
    setToast(msg);
    setTimeout(() => setToast(''), duration);
  };

  const openAnnouncementDetail = (a) => {
    if (!a) return;
    setDetailModalPost({
      kind: 'announcement',
      id: a.id,
      shareType: 'announcements',
      shareItem: a,
      badge: a.priority === 'urgent' ? 'Thông báo khẩn cấp' : a.priority === 'important' ? 'Thông báo quan trọng' : 'Thông báo thôn',
      isPinned: Boolean(a.is_pinned),
      priority: a.priority || 'normal',
      title: a.title,
      content: a.cleanContent ?? a.content,
      imageUrl: a.image_url || '',
      videoUrl: '',
      createdAt: a.created_at,
    });
  };

  const openNewsDetail = (n) => {
    if (!n) return;
    const shareTargetId = n.sourceAnnId || n.id;
    const shareType = n.sourceAnnId ? 'announcements' : 'news';
    setDetailModalPost({
      kind: 'news',
      id: n.id,
      shareType,
      shareItem: { ...n, id: shareTargetId },
      badge: n.category || 'Tin tức hoạt động',
      isPinned: false,
      priority: 'normal',
      title: n.title,
      content: n.content,
      imageUrl: n.image_url || '',
      videoUrl: n.video_url || '',
      createdAt: n.created_at,
    });
  };

  const handleDeleteAnnouncementRow = async (id, title = '') => {
    if (!id) return;
    if (!confirm(`Xác nhận xóa "${title || 'mục này'}"?`)) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      showToast('Lỗi xóa mục: ' + error.message);
      return;
    }
    await fetchPublicData();
    showToast('Đã xóa thành công!');
  };

  const handleDeleteNewsRow = async (id, title = '') => {
    if (!id) return;
    if (!confirm(`Xác nhận xóa bài viết "${title || 'này'}"?`)) return;
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (error) {
      showToast('Lỗi xóa bài viết: ' + error.message);
      return;
    }
    await fetchPublicData();
    showToast('Đã xóa bài viết!');
  };

  const handleDeleteFeedback = async (fb) => {
    if (!fb?.id || deletingFeedbackId) return;
    const isSug = isSuggestionRecord(fb);
    const label = isSug ? 'góp ý' : 'phản ánh';
    const sender = fb.sender_name || 'người dân';
    if (!confirm(`Xác nhận xóa ${label} của "${sender}"? Thao tác này không thể hoàn tác.`)) return;

    setDeletingFeedbackId(fb.id);
    try {
      const parsed = parseFeedbackContent(fb.content);
      const attachmentPaths = (parsed.attachments || [])
        .map((att) => att?.path)
        .filter(Boolean);

      if (attachmentPaths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from(FEEDBACK_ATTACHMENT_BUCKET)
          .remove(attachmentPaths);
        if (storageErr) {
          showToast('Cảnh báo: Không xóa được tệp đính kèm trên Storage (' + storageErr.message + '), vẫn xóa bản ghi.', 5000);
        }
      }

      const { error } = await supabase.from('feedbacks').delete().eq('id', fb.id);
      if (error) {
        showToast('Lỗi xóa ' + label + ': ' + error.message);
        return;
      }
      await fetchAdminData();
      showToast(`Đã xóa ${label} thành công!`);
    } finally {
      setDeletingFeedbackId(null);
    }
  };

  const goHomePublic = () => {
    setMode('public');
    setTab('home');
    setHighlightedPost('');
    setQuickSearch('');
    setDetailModalPost(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigatePublic = (targetTab, subTab) => {
    setMode('public');
    setTab(targetTab);
    if (targetTab === 'feed' && subTab) setFeedSubTab(subTab);
    if (targetTab === 'directory' && subTab) setDirectorySubTab(subTab);
    if (targetTab === 'voice' && subTab) setVoiceSubTab(subTab);
    if (targetTab === 'finance' && subTab) setFinancePublicSubTab(subTab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const dispatchOneSignalPush = async ({ heading, content, launchUrl, imageUrl, target }) => {
    const endpoint = `${siteUrl}/api/send-push`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          heading,
          content,
          launchUrl: launchUrl || siteUrl,
          imageUrl: imageUrl || undefined,
          target: target || 'all',
        }),
      });
      const text = await res.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_parseErr) {
        return { ok: false, reason: `Phản hồi không hợp lệ (HTTP ${res.status})` };
      }
      if (res.ok && data.ok) {
        return { ok: true, recipients: data.recipients ?? 0 };
      }
      return { ok: false, reason: data.error || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, reason: `${err?.message || 'Lỗi kết nối'} (${endpoint})` };
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          const scriptUrl = reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '';
          if (scriptUrl && !scriptUrl.includes('OneSignalSDKWorker')) {
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
          icon: '/logo.png',
          badge: '/logo.png',
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
    if (postKey === 'admin-feedbacks') {
      setMode('admin');
      setAdminTab('feedbacks');
      return;
    }
    if (postKey === 'finance') {
      setMode('public');
      setTab('finance');
      return;
    }
    setMode('public');
    setHighlightedPost(postKey);
    setTab('feed');
    if (postKey.startsWith('announcements-')) {
      setFeedSubTab('announcements');
      const targetId = postKey.slice('announcements-'.length);
      const foundAnn = announcements.find((item) => String(item.id) === String(targetId));
      if (foundAnn) {
        const parsed = parseScheduledItem(foundAnn.content);
        if (parsed.isNewsPost) {
          const parsedNews = parseNewsContent(parsed.cleanContent);
          openNewsDetail({
            id: `sch-${foundAnn.id}`,
            sourceAnnId: foundAnn.id,
            title: foundAnn.title,
            content: parsedNews.content,
            image_url: foundAnn.image_url || parsedNews.imageUrl,
            category: 'Tin tức hẹn giờ',
            created_at: foundAnn.created_at,
            video_url: '',
          });
        } else {
          openAnnouncementDetail({ ...foundAnn, cleanContent: parsed.cleanContent });
        }
      } else {
        pendingUrlPostRef.current = postKey;
      }
    } else if (postKey.startsWith('news-')) {
      setFeedSubTab('news');
      const targetId = postKey.slice('news-'.length);
      const foundNews = news.find((item) => String(item.id) === String(targetId));
      if (foundNews) {
        const parsed = parseNewsContent(foundNews.content);
        openNewsDetail({ ...foundNews, content: parsed.content, image_url: parsed.imageUrl });
      } else {
        pendingUrlPostRef.current = postKey;
      }
    } else if (postKey.startsWith('events-')) {
      setFeedSubTab('events');
    } else {
      setFeedSubTab('all');
    }
    setTimeout(() => {
      const el = document.getElementById(`post-${postKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  const getPostShareUrl = (type, id) => {
    const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : siteUrl;
    return id ? `${base}?post=${type}-${id}` : `${base}?post=${type}`;
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
      pendingUrlPostRef.current = postParam;
      openPostFromKey(postParam);
    }
  }, []);

  useEffect(() => {
    if (!pendingUrlPostRef.current) return;
    const key = pendingUrlPostRef.current;
    if (key.startsWith('announcements-') && announcements.length > 0) {
      pendingUrlPostRef.current = '';
      openPostFromKey(key);
    } else if (key.startsWith('news-') && news.length > 0) {
      pendingUrlPostRef.current = '';
      openPostFromKey(key);
    }
  }, [announcements, news]);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      syncOneSignalAdminTag(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      syncOneSignalAdminTag(Boolean(sess));
    });
    fetchPublicData();

    const channel = supabase
      .channel('thon-an-son-live-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const row = payload.new;
        fetchPublicData();
        if (row) {
          const parsed = parseScheduledItem(row.content);
          if (!parsed.hasSchedule || parsed.publishAtMs <= Date.now()) {
            triggerBrowserAlert(
              parsed.isNewsPost ? 'Tin tức mới – Thôn An Sơn' : 'Thông báo mới – Thôn An Sơn',
              row.title || 'Có cập nhật mới cho bà con.',
              `announcements-${row.id}`
            );
          }
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
    if (!session || !isConfigured) return;
    fetchAdminData();
    syncOneSignalAdminTag(true);

    const adminChannel = supabase
      .channel('thon-an-son-admin-feedbacks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedbacks' }, (payload) => {
        const row = payload.new;
        fetchAdminData();
        if (row) {
          const isSug = isSuggestionRecord(row);
          triggerBrowserAlert(
            isSug ? 'Góp ý mới cho thôn (Quản trị)' : 'Phản ánh kiến nghị mới (Quản trị)',
            `${row.sender_name || 'Người dân'}: ${parseFeedbackContent(row.content).content.slice(0, 80)}`,
            'admin-feedbacks'
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(adminChannel);
    };
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
      const [a, n, o, e, cl, ci, s] = await Promise.all([
        supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('news').select('*').order('created_at', { ascending: false }),
        supabase.from('officials').select('*').order('sort_order', { ascending: true }),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
        supabase.from('custom_lists').select('*').order('created_at', { ascending: false }),
        supabase.from('custom_list_items').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('*').limit(1),
      ]);
      const annRows = a.data || [];
      const newsRows = n.data || [];
      if (a.data) setAnnouncements(annRows);
      if (n.data) setNews(newsRows);
      if (o.data) setOfficials(o.data);
      if (e.data) setEvents(e.data);
      if (cl.data) setCustomLists(cl.data);
      if (ci.data) setCustomItems(ci.data);
      if (s && !s.error && Array.isArray(s.data) && s.data[0]) {
        const merged = { ...DEFAULT_SETTINGS, ...s.data[0] };
        setAppSettings(merged);
        setSettingsForm(merged);
        if (typeof window !== 'undefined') {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        }
      }
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

  const handleFeedbackStatusChange = async (feedbackId, status) => {
    const { error } = await supabase.from('feedbacks').update({ status }).eq('id', feedbackId);
    if (error) {
      showToast('Không cập nhật được trạng thái phản ánh: ' + error.message);
      return;
    }
    await fetchAdminData();
    showToast('Đã cập nhật trạng thái');
  };
  showToast('Đã cập nhật trạng thái');
  };
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

              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-700" /> Đẩy danh sách hộ dân từ file Excel (.xlsx, .xls, .csv)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cột hỗ trợ: <strong>Mã hộ</strong>, <strong>Chủ hộ</strong> (bắt buộc), <strong>Khu vực / Xóm</strong>, <strong>SĐT</strong>, <strong>Số người</strong>, <strong>Ghi chú</strong>.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-xl text-xs font-bold transition">
                    <Upload className="w-4 h-4" /> Chọn file Excel
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelFileChange} className="hidden" />
                  </label>
                </div>

                {excelFileName && (
                  <div className="text-xs text-slate-700 bg-slate-50 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2">
                    <span>Tệp đã chọn: <strong>{excelFileName}</strong> ({excelPreviewRows.length} hộ hợp lệ)</span>
                    {excelPreviewRows.length > 0 && (
                      <button
                        type="button"
                        disabled={importingExcel}
                        onClick={handlePushExcelToSupabase}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl disabled:opacity-60"
                      >
                        {importingExcel ? 'Đang đẩy lên...' : `Đẩy ${excelPreviewRows.length} hộ lên hệ thống`}
                      </button>
                    )}
                  </div>
                )}

                {excelPreviewRows.length > 0 && (
                  <div className="overflow-x-auto max-h-56 border rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-emerald-50 border-b">
                        <tr>
                          <th className="p-2">Mã hộ</th>
                          <th className="p-2">Chủ hộ</th>
                          <th className="p-2">Khu vực</th>
                          <th className="p-2">SĐT</th>
                          <th className="p-2">Số người</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreviewRows.slice(0, 20).map((r, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-2 font-mono">{r.household_code}</td>
                            <td className="p-2 font-semibold">{r.head_name}</td>
                            <td className="p-2">{r.area}</td>
                            <td className="p-2">{r.phone}</td>
                            <td className="p-2">{r.member_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {adminTab === 'lists' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Danh sách bổ sung của thôn (Mở rộng)</h1>
                <p className="text-xs text-slate-500 mt-0.5">Gợi ý: Tổ tự quản & Tổ công nghệ số, Gia đình văn hóa tiêu biểu, Hộ chính sách thăm hỏi lễ Tết, Điểm camera an ninh...</p>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase.from('custom_lists').insert([listForm]);
                if (!error) { setListForm({ title: '', description: '', is_public: true, year: 2026 }); fetchPublicData(); showToast('Đã tạo danh sách mới!'); }
              }} className="bg-white p-5 rounded-2xl border space-y-3">
                <h3 className="font-bold text-emerald-800">+ TẠO DANH SÁCH MỚI</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <input required placeholder="Tên danh sách (VD: Tổ công nghệ số thôn)" value={listForm.title} onChange={e => setListForm({ ...listForm, title: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <input placeholder="Mô tả ngắn" value={listForm.description} onChange={e => setListForm({ ...listForm, description: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  <label className="flex items-center gap-2 text-sm px-2">
                    <input type="checkbox" checked={listForm.is_public} onChange={e => setListForm({ ...listForm, is_public: e.target.checked })} /> Công khai cho bà con xem
                  </label>
                </div>
                <button className="bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-semibold">Tạo danh sách</button>
              </form>

              {regularCustomLists.length > 0 && (
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
                      {regularCustomLists.map(l => <option key={l.id} value={l.id}>{l.title} ({l.is_public ? 'Công khai' : 'Nội bộ'})</option>)}
                    </select>
                    <input required placeholder="Họ tên / Tên mục" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                    <input placeholder="Nhóm / Vai trò" value={itemForm.role_or_group} onChange={e => setItemForm({ ...itemForm, role_or_group: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                    <input placeholder="Chi tiết / SĐT / Ghi chú" value={itemForm.detail} onChange={e => setItemForm({ ...itemForm, detail: e.target.value })} className="border px-3 py-2 rounded-xl text-sm" />
                  </div>
                  <button className="bg-sky-700 text-white px-5 py-2 rounded-xl text-sm font-semibold">Thêm vào danh sách</button>
                </form>
              )}

              <div className="space-y-4">
                {regularCustomLists.map(l => (
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
                <div className="text-emerald-800 font-bold tracking-wider text-sm uppercase">{appSettings.subtitle}</div>
                <h2 className="text-3xl font-extrabold text-emerald-900">{appSettings.village_name}</h2>
                <p className="text-slate-600">{appSettings.public_notice}</p>
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
                    <p className="text-sm text-slate-500">Nâng cấp giao diện đọc chi tiết bài viết, phân trang danh sách và xóa phản ánh/góp ý kèm tệp đính kèm.</p>
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

  // ==================== SMART PUBLIC RESIDENT VIEW ====================
  const smartHubs = [
    {
      id: 'feed',
      sub: 'all',
      label: 'Tin & Lịch',
      desc: `${publishedAnnouncements.length + allPublishedNews.length} tin • ${upcomingEvents.length} lịch`,
      icon: Newspaper,
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
    },
    {
      id: 'finance',
      sub: 'donations',
      label: 'Ủng hộ & Quỹ',
      desc: `${donationItems.length} lượt • Minh bạch`,
      icon: HeartHandshake,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      id: 'directory',
      sub: 'officials',
      label: 'Danh bạ & Bản đồ',
      desc: `${officials.length} cán bộ • Nhà VH`,
      icon: Compass,
      iconColor: 'text-sky-700',
      bgColor: 'bg-sky-50',
    },
    {
      id: 'voice',
      sub: 'feedback',
      label: 'Phản ánh & Góp ý',
      desc: 'Gửi trực tiếp Ban thôn',
      icon: MessageSquare,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ];

  const qLower = quickSearch.trim().toLowerCase();
  const matchedAnnouncements = qLower
    ? publishedAnnouncements.filter((a) => `${a.title} ${a.cleanContent}`.toLowerCase().includes(qLower))
    : [];
  const matchedNews = qLower
    ? allPublishedNews.filter((n) => `${n.title} ${n.content} ${n.category}`.toLowerCase().includes(qLower))
    : [];
  const matchedOfficials = qLower
    ? officials.filter((o) => `${o.full_name} ${o.role} ${o.phone}`.toLowerCase().includes(qLower))
    : [];
  const matchedEvents = qLower
    ? upcomingEvents.filter((ev) => `${ev.title} ${ev.location} ${ev.event_date}`.toLowerCase().includes(qLower))
    : [];
  const matchedDonations = qLower
    ? donationItems.filter((d) => `${d.name} ${d.role_or_group} ${d.detail} ${d.in_kind}`.toLowerCase().includes(qLower))
    : [];
  const totalQuickMatches =
    matchedAnnouncements.length + matchedNews.length + matchedOfficials.length + matchedEvents.length + matchedDonations.length;

  const upcomingEvent = upcomingEvents[0] || null;

  const filteredDonationsPublic = donationItems.filter((d) =>
    `${d.name} ${d.role_or_group} ${d.detail} ${d.in_kind}`.toLowerCase().includes(searchFinance.toLowerCase())
  );
  const filteredLedgerPublic = ledgerItems.filter((l) =>
    `${l.name} ${l.detail} ${l.note}`.toLowerCase().includes(searchFinance.toLowerCase())
  );

  // Tính lát cắt phân trang (Pagination slices)
  const paginateSlice = (list, page, size = PUBLIC_PAGE_SIZE) => {
    const totalPages = Math.max(1, Math.ceil(list.length / size));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * size;
    return list.slice(start, start + size);
  };

  const pagedHomeAnnouncements = paginateSlice(publishedAnnouncements, homeAnnPage, 4);
  const pagedHomeNews = paginateSlice(allPublishedNews, homeNewsPage, 4);
  const pagedFeedAnnouncements = paginateSlice(publishedAnnouncements, feedAnnPage, PUBLIC_PAGE_SIZE);
  const pagedFeedNews = paginateSlice(allPublishedNews, feedNewsPage, PUBLIC_PAGE_SIZE);
  const pagedDonationsPublic = paginateSlice(filteredDonationsPublic, financeDonPage, PUBLIC_PAGE_SIZE);
  const pagedLedgerPublic = paginateSlice(filteredLedgerPublic, financeLedgerPage, PUBLIC_PAGE_SIZE);

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
        <div className="max-w-2xl mx-auto px-4 pt-3.5 pb-5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full capitalize font-medium">{todayStr}</span>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                onClick={requestNotification}
                aria-label={pushSubscribed ? 'Thông báo đang bật' : 'Bật thông báo'}
                className={`w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl transition ${
                  pushSubscribed ? 'bg-white/20 text-white' : 'bg-amber-400 text-emerald-950 hover:bg-amber-300'
                }`}
                title={pushSubscribed ? 'Thông báo đang bật' : 'Bật thông báo'}
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setLargeText(value => !value)}
                aria-pressed={largeText}
                aria-label={largeText ? 'Chuyển về cỡ chữ thường' : 'Tăng cỡ chữ'}
                className={`w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-xl text-sm font-extrabold transition ${largeText ? 'bg-white text-emerald-800' : 'bg-white/15 hover:bg-white/25 text-white'}`}
                title={largeText ? 'Chuyển về cỡ chữ thường' : 'Tăng cỡ chữ để dễ đọc hơn'}
              >
                {largeText ? 'A−' : 'A+'}
              </button>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="w-10 h-10 shrink-0 inline-flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition"
                aria-label="Làm mới tin"
                title="Làm mới tin"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" onClick={() => setShowQRModal(true)} className="w-10 h-10 shrink-0 inline-flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition" aria-label="Mã QR chia sẻ" title="Mã QR chia sẻ">
                <QrCode className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setMode('admin')} className="w-10 h-10 shrink-0 inline-flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-xl transition" aria-label="Quản trị" title="Quản trị">
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={goHomePublic}
            className="flex items-center gap-3 text-left group cursor-pointer active:scale-[0.99] transition"
            title="Bấm vào logo để quay về Trang chủ"
          >
            <img src="/logo.png" alt="Logo Thôn An Sơn" className="w-12 h-12 rounded-full shadow-md bg-white p-0.5 group-hover:bg-white/90 transition" />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">{appSettings.village_name}</h1>
              <p className="text-xs text-emerald-100 font-medium">{appSettings.subtitle}</p>
            </div>
          </button>

          <div className="relative mt-3.5">
            <Search className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3" />
            <input
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm nhanh thông báo, lịch họp, số điện thoại cán bộ, người ủng hộ..."
              className="w-full bg-white text-slate-800 placeholder-slate-400 pl-10 pr-9 py-2.5 rounded-2xl text-xs sm:text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-300"
            />
            {quickSearch && (
              <button
                type="button"
                onClick={() => setQuickSearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {qLower ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Kết quả tìm kiếm "{quickSearch}" ({totalQuickMatches})
              </h2>
              <button onClick={() => setQuickSearch('')} className="text-xs text-emerald-700 font-bold">Đóng tìm kiếm</button>
            </div>

            {totalQuickMatches === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                Không tìm thấy nội dung phù hợp với "{quickSearch}".
              </div>
            ) : (
              <div className="space-y-2.5">
                {matchedAnnouncements.map((a) => (
                  <button
                    key={`qa-${a.id}`}
                    type="button"
                    onClick={() => openAnnouncementDetail(a)}
                    className="w-full bg-white p-4 rounded-2xl border-l-4 border-l-emerald-600 border border-slate-100 text-left shadow-sm space-y-1"
                  >
                    <div className="text-[11px] font-bold text-emerald-700">THÔNG BÁO • {new Date(a.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
                    <div className="font-bold text-slate-800 text-sm">{a.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{a.cleanContent}</div>
                  </button>
                ))}
                {matchedNews.map((n) => (
                  <button
                    key={`qn-${n.id}`}
                    type="button"
                    onClick={() => openNewsDetail(n)}
                    className="w-full bg-white p-4 rounded-2xl border-l-4 border-l-teal-600 border border-slate-100 text-left shadow-sm space-y-1"
                  >
                    <div className="text-[11px] font-bold text-teal-700">TIN TỨC • {n.category}</div>
                    <div className="font-bold text-slate-800 text-sm">{n.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{n.content}</div>
                  </button>
                ))}
                {matchedEvents.map((ev) => (
                  <button
                    key={`qe-${ev.id}`}
                    type="button"
                    onClick={() => openPostFromKey(`events-${ev.id}`)}
                    className="w-full bg-white p-4 rounded-2xl border-l-4 border-l-sky-600 border border-slate-100 text-left shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-sky-700">LỊCH THÔN • {ev.event_date} ({ev.event_time})</div>
                      <div className="font-bold text-slate-800 text-sm">{ev.title}</div>
                      <div className="text-xs text-slate-500">{ev.location}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
                {matchedOfficials.map((o) => (
                  <div key={`qo-${o.id}`} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-700">CÁN BỘ THÔN</div>
                      <div className="font-bold text-slate-800 text-sm">{o.full_name} – {o.role}</div>
                      <div className="text-xs text-slate-500">{o.phone}</div>
                    </div>
                    {o.phone && (
                      <a href={`tel:${o.phone.replace(/\s+/g, '')}`} className="bg-emerald-600 text-white p-2.5 rounded-xl">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
                {matchedDonations.map((d) => (
                  <button
                    key={`qd-${d.id}`}
                    type="button"
                    onClick={() => navigatePublic('finance', 'donations')}
                    className="w-full bg-white p-4 rounded-2xl border border-slate-100 text-left shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-rose-600">ỦNG HỘ THÔN • {d.role_or_group || 'Nhân dân'}</div>
                      <div className="font-bold text-slate-800 text-sm">{d.name}</div>
                      <div className="text-xs text-slate-500">{d.detail}</div>
                    </div>
                    <div className="font-extrabold text-emerald-700 text-sm">{d.amount > 0 ? formatVND(d.amount) : d.in_kind}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {tab === 'home' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {smartHubs.map((hub) => {
                    const Icon = hub.icon;
                    return (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => navigatePublic(hub.id, hub.sub)}
                        className="bg-white rounded-2xl p-3 border border-slate-100 hover:border-emerald-300 shadow-sm active:scale-[0.98] flex items-center sm:flex-col sm:items-start gap-2.5 text-left transition"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${hub.bgColor}`}>
                          <Icon className={`w-5 h-5 ${hub.iconColor}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">{hub.label}</div>
                          <div className="text-[11px] text-slate-500 truncate">{hub.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {upcomingEvent && (
                  <button
                    type="button"
                    onClick={() => navigatePublic('feed', 'events')}
                    className="w-full bg-sky-50/90 hover:bg-sky-100/70 border border-sky-200 rounded-2xl p-3.5 text-left flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold uppercase text-sky-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Lịch thôn sắp tới
                      </div>
                      <div className="font-bold text-slate-800 text-xs sm:text-sm truncate mt-0.5">{upcomingEvent.title}</div>
                      <div className="text-[11px] text-slate-600 truncate">{upcomingEvent.event_date} • {upcomingEvent.event_time} • {upcomingEvent.location}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-700 shrink-0" />
                  </button>
                )}

                <section className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Thông báo thôn ({publishedAnnouncements.length})
                    </h2>
                    <button
                      onClick={() => navigatePublic('feed', 'announcements')}
                      className="text-xs text-emerald-700 font-bold flex items-center hover:underline"
                    >
                      Bảng tin tổng hợp <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 text-sm text-slate-500 text-center">Đang tải thông tin thôn...</div>
                  ) : publishedAnnouncements.length === 0 && allPublishedNews.length === 0 ? (
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-700">Chào mừng bà con đến với cổng thông tin {appSettings.village_name}</p>
                      <p className="text-xs text-slate-500">Chưa có thông báo mới. Ban thôn sẽ cập nhật kịp thời tại đây.</p>
                    </div>
                  ) : (
                    <>
                      {pagedHomeAnnouncements.map((a) => (
                        <div key={a.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-emerald-600 border border-slate-100 shadow-sm space-y-2">
                          <div className="flex items-center gap-2">
                            {a.is_pinned && <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">📌 Ghim</span>}
                            {a.priority === 'urgent' && <span className="text-[11px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Khẩn cấp</span>}
                            <span className="text-xs font-bold text-emerald-700">Thông báo thôn</span>
                            <span className="text-[11px] text-slate-400 ml-auto">{new Date(a.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                          </div>
                          <h3
                            onClick={() => openAnnouncementDetail(a)}
                            className="font-bold text-slate-800 text-base leading-snug cursor-pointer hover:text-emerald-700"
                          >
                            {a.title}
                          </h3>
                          <p
                            onClick={() => openAnnouncementDetail(a)}
                            className="text-sm text-slate-600 line-clamp-3 whitespace-pre-line cursor-pointer"
                          >
                            {a.cleanContent}
                          </p>
                          {a.image_url && (
                            <button type="button" onClick={() => openAnnouncementDetail(a)} className="block w-full pt-1 text-left">
                              <img src={a.image_url} alt={a.title} className="w-full max-h-64 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                            </button>
                          )}
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openAnnouncementDetail(a)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition"
                            >
                              <BookOpen className="w-3.5 h-3.5" /> Đọc chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPostLink('announcements', a)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition"
                            >
                              {copiedKey === `announcements-${a.id}` ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedKey === `announcements-${a.id}` ? 'Đã sao chép' : 'Gửi Zalo'}
                            </button>
                          </div>
                        </div>
                      ))}

                      <PaginationControls
                        currentPage={homeAnnPage}
                        totalItems={publishedAnnouncements.length}
                        pageSize={4}
                        onPageChange={setHomeAnnPage}
                      />

                      {allPublishedNews.length > 0 && (
                        <div className="pt-2 space-y-3">
                          <div className="flex justify-between items-center px-1">
                            <h2 className="text-xs font-extrabold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                              <Newspaper className="w-4 h-4 text-teal-600" /> Tin tức & Hoạt động ({allPublishedNews.length})
                            </h2>
                            <button
                              onClick={() => navigatePublic('feed', 'news')}
                              className="text-xs text-teal-700 font-bold flex items-center hover:underline"
                            >
                              Xem mục tin tức <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {pagedHomeNews.map((n) => (
                            <div key={n.id} className="bg-white p-4 rounded-2xl border-l-4 border-l-teal-500 border border-slate-100 shadow-sm space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] bg-teal-50 text-teal-800 px-2.5 py-0.5 rounded-full font-bold">{n.category}</span>
                                  <span className="text-[11px] text-slate-400">{new Date(n.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                                </div>
                                {session && n.sourceAnnId && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnnouncementRow(n.sourceAnnId, n.title)}
                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                    title="Xóa bài này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <h3
                                onClick={() => openNewsDetail(n)}
                                className="font-bold text-slate-800 text-base leading-snug cursor-pointer hover:text-teal-700"
                              >
                                {n.title}
                              </h3>
                              <p
                                onClick={() => openNewsDetail(n)}
                                className="text-sm text-slate-600 line-clamp-3 whitespace-pre-line cursor-pointer"
                              >
                                {n.content}
                              </p>
                              {n.image_url && (
                                <button type="button" onClick={() => openNewsDetail(n)} className="block w-full text-left">
                                  <img src={n.image_url} alt={n.title} className="w-full max-h-48 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                                </button>
                              )}
                              <div className="pt-1 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => openNewsDetail(n)}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl transition"
                                >
                                  <BookOpen className="w-3.5 h-3.5" /> Đọc chi tiết
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPostLink(n.sourceAnnId ? 'announcements' : 'news', { ...n, id: n.sourceAnnId || n.id })}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition"
                                >
                                  {copiedKey === `${n.sourceAnnId ? 'announcements' : 'news'}-${n.sourceAnnId || n.id}` ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copiedKey === `${n.sourceAnnId ? 'announcements' : 'news'}-${n.sourceAnnId || n.id}` ? 'Đã sao chép' : 'Gửi Zalo'}
                                </button>
                              </div>
                            </div>
                          ))}

                          <PaginationControls
                            currentPage={homeNewsPage}
                            totalItems={allPublishedNews.length}
                            pageSize={4}
                            onPageChange={setHomeNewsPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            {tab === 'feed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-800">Bảng tin & Lịch {appSettings.village_name}</h2>
                </div>

                <div className="flex gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  {[
                    { id: 'all', label: `Tất cả (${publishedAnnouncements.length + allPublishedNews.length})` },
                    { id: 'announcements', label: `Thông báo (${publishedAnnouncements.length})` },
                    { id: 'news', label: `Tin tức (${allPublishedNews.length})` },
                    { id: 'events', label: `Lịch thôn (${upcomingEvents.length})` },
                    { id: 'gallery', label: `Ảnh (${galleryItems.length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFeedSubTab(f.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                        feedSubTab === f.id ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {(feedSubTab === 'all' || feedSubTab === 'announcements') && (
                  <div className="space-y-3">
                    {publishedAnnouncements.length === 0 && feedSubTab === 'announcements' && (
                      <p className="text-slate-500 text-sm">Chưa có thông báo nào.</p>
                    )}
                    {pagedFeedAnnouncements.map((a) => {
                      const postKey = `announcements-${a.id}`;
                      const isHighlighted = highlightedPost === postKey;
                      return (
                        <div
                          key={a.id}
                          id={`post-${postKey}`}
                          className={`bg-white p-5 rounded-2xl border shadow-sm space-y-2 transition ${
                            isHighlighted ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="font-bold text-emerald-700">Thông báo</span>
                            <span>• {a.is_pinned ? '📌 Đã ghim • ' : ''}{new Date(a.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                          </div>
                          <h3
                            onClick={() => openAnnouncementDetail(a)}
                            className="font-bold text-lg text-slate-800 cursor-pointer hover:text-emerald-700"
                          >
                            {a.title}
                          </h3>
                          <p
                            onClick={() => openAnnouncementDetail(a)}
                            className="text-slate-600 whitespace-pre-line text-sm line-clamp-4 cursor-pointer"
                          >
                            {a.cleanContent}
                          </p>
                          {a.image_url && (
                            <button type="button" onClick={() => openAnnouncementDetail(a)} className="block w-full pt-1 text-left">
                              <img src={a.image_url} alt={a.title} className="w-full max-h-96 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                            </button>
                          )}
                          <div className="pt-2 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => openAnnouncementDetail(a)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3.5 py-2 rounded-xl transition"
                            >
                              <BookOpen className="w-4 h-4" /> Đọc chi tiết
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPostLink('announcements', a)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
                            >
                              {copiedKey === postKey ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                              {copiedKey === postKey ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <PaginationControls
                      currentPage={feedAnnPage}
                      totalItems={publishedAnnouncements.length}
                      pageSize={PUBLIC_PAGE_SIZE}
                      onPageChange={setFeedAnnPage}
                    />
                  </div>
                )}

                {(feedSubTab === 'all' || feedSubTab === 'news') && (
                  <div className="space-y-3">
                    {allPublishedNews.length === 0 && feedSubTab === 'news' && (
                      <p className="text-slate-500 text-sm">Chưa có bài viết nào.</p>
                    )}
                    {pagedFeedNews.map((n) => {
                      const shareType = n.sourceAnnId ? 'announcements' : 'news';
                      const shareId = n.sourceAnnId || n.id;
                      const postKey = `${shareType}-${shareId}`;
                      return (
                        <div key={n.id} id={`post-${postKey}`} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-medium">{n.category}</span>
                              <span className="text-[11px] text-slate-400">{new Date(n.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
                            </div>
                            {session && n.sourceAnnId && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncementRow(n.sourceAnnId, n.title)}
                                className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                title="Xóa bài này"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <h3
                            onClick={() => openNewsDetail(n)}
                            className="font-bold text-lg text-slate-800 cursor-pointer hover:text-teal-700"
                          >
                            {n.title}
                          </h3>
                          <p
                            onClick={() => openNewsDetail(n)}
                            className="text-slate-600 whitespace-pre-line text-sm line-clamp-4 cursor-pointer"
                          >
                            {n.content}
                          </p>
                          {n.image_url && (
                            <button type="button" onClick={() => openNewsDetail(n)} className="block w-full pt-1 text-left">
                              <img src={n.image_url} alt={n.title} className="w-full max-h-96 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                            </button>
                          )}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openNewsDetail(n)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3.5 py-2 rounded-xl transition"
                              >
                                <BookOpen className="w-4 h-4" /> Đọc chi tiết
                              </button>
                              {n.video_url && (
                                <a href={n.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-xl font-bold">
                                  ▶ Video
                                </a>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyPostLink(shareType, { ...n, id: shareId })}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
                            >
                              {copiedKey === postKey ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                              {copiedKey === postKey ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <PaginationControls
                      currentPage={feedNewsPage}
                      totalItems={allPublishedNews.length}
                      pageSize={PUBLIC_PAGE_SIZE}
                      onPageChange={setFeedNewsPage}
                    />
                  </div>
                )}

                {feedSubTab === 'events' && (
                  <div className="space-y-3">
                    {upcomingEvents.length === 0 && <p className="text-slate-500 text-sm">Chưa có lịch sinh hoạt sắp tới.</p>}
                    {upcomingEvents.map((ev) => {
                      const postKey = `events-${ev.id}`;
                      const isHighlighted = highlightedPost === postKey;
                      return (
                        <div
                          key={ev.id}
                          id={`post-${postKey}`}
                          className={`bg-white p-4 rounded-2xl border shadow-sm flex gap-4 items-center ${
                            isHighlighted ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-100'
                          }`}
                        >
                          <div className="bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl text-center min-w-[76px]">
                            <div className="text-xs font-semibold">{ev.event_date}</div>
                            <div className="text-sm font-bold">{ev.event_time}</div>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-800">{ev.title}</h3>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5" /> {ev.location}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigatePublic('directory', 'map')}
                            className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl shrink-0"
                          >
                            Bản đồ
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {feedSubTab === 'gallery' && (
                  <div>
                    {galleryItems.length === 0 ? (
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                        Chưa có hình ảnh nào được đăng tải. Hình ảnh đính kèm trong các thông báo của thôn sẽ tự động hiển thị tại đây.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {galleryItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openAnnouncementDetail(item)}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group text-left"
                          >
                            <img src={item.image_url} alt={item.title} className="w-full h-52 object-cover group-hover:scale-[1.02] transition" />
                            <div className="p-3">
                              <div className="font-bold text-sm text-slate-800 line-clamp-1">{item.title}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'finance' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Công khai Ủng hộ, Quỹ & Danh sách thôn</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Ban quản lý thôn cập nhật công khai để toàn thể bà con nhân dân cùng theo dõi, giám sát.</p>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm">
                    <div className="text-[11px] font-bold text-emerald-700">Tổng ủng hộ & Thu</div>
                    <div className="text-sm sm:text-base font-extrabold text-emerald-800 mt-1">{formatVND(totalCombinedThu)}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-sm">
                    <div className="text-[11px] font-bold text-rose-700">Tổng đã chi</div>
                    <div className="text-sm sm:text-base font-extrabold text-rose-700 mt-1">{formatVND(totalLedgerChi)}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-sm">
                    <div className="text-[11px] font-bold text-sky-700">Số dư hiện còn</div>
                    <div className="text-sm sm:text-base font-extrabold text-sky-800 mt-1">{formatVND(currentFundBalance)}</div>
                  </div>
                </div>

                <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setFinancePublicSubTab('donations')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${financePublicSubTab === 'donations' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Ủng hộ ({donationItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancePublicSubTab('ledger')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${financePublicSubTab === 'ledger' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Thu – Chi ({ledgerItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancePublicSubTab('lists')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${financePublicSubTab === 'lists' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    DS Thôn ({regularCustomLists.filter((l) => l.is_public).length})
                  </button>
                </div>

                {financePublicSubTab !== 'lists' && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      placeholder={financePublicSubTab === 'donations' ? 'Tìm tên người ủng hộ, xóm hoặc đợt vận động...' : 'Tìm nội dung khoản thu, chi...'}
                      value={searchFinance}
                      onChange={e => setSearchFinance(e.target.value)}
                      className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                )}

                {financePublicSubTab === 'donations' && (
                  <div className="space-y-2.5">
                    {filteredDonationsPublic.length === 0 ? (
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                        Chưa có danh sách ủng hộ nào được đăng tải.
                      </div>
                    ) : (
                      <>
                        {pagedDonationsPublic.map((d, idx) => {
                          const globalIndex = (Math.min(Math.max(1, financeDonPage), Math.max(1, Math.ceil(filteredDonationsPublic.length / PUBLIC_PAGE_SIZE))) - 1) * PUBLIC_PAGE_SIZE + idx + 1;
                          return (
                            <div key={d.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-start gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">#{globalIndex}</span>
                                  <span className="font-bold text-slate-800">{d.name}</span>
                                  {d.role_or_group && <span className="text-xs text-slate-500">({d.role_or_group})</span>}
                                </div>
                                <div className="text-xs text-slate-600">{d.detail}</div>
                                {d.note && <div className="text-xs text-slate-500 italic">{d.note}</div>}
                                <div className="text-[11px] text-slate-400">Ngày ghi nhận: {d.date}</div>
                              </div>
                              <div className="text-right shrink-0">
                                {d.amount > 0 && <div className="font-extrabold text-emerald-700 text-sm sm:text-base">{formatVND(d.amount)}</div>}
                                {d.in_kind && <div className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg mt-1">{d.in_kind}</div>}
                              </div>
                            </div>
                          );
                        })}

                        <PaginationControls
                          currentPage={financeDonPage}
                          totalItems={filteredDonationsPublic.length}
                          pageSize={PUBLIC_PAGE_SIZE}
                          onPageChange={setFinanceDonPage}
                        />
                      </>
                    )}
                  </div>
                )}

                {financePublicSubTab === 'ledger' && (
                  <div className="space-y-2.5">
                    {filteredLedgerPublic.length === 0 ? (
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-sm text-slate-500">
                        Chưa có khoản thu – chi nào được công khai.
                      </div>
                    ) : (
                      <>
                        {pagedLedgerPublic.map((l) => (
                          <div key={l.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-start gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${l.entryType === 'chi' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {l.entryType === 'chi' ? 'CHI' : 'THU'}
                                </span>
                                <span className="font-bold text-slate-800 text-sm">{l.name}</span>
                              </div>
                              <div className="text-xs text-slate-600">{l.detail}</div>
                              {l.note && <div className="text-xs text-slate-500 italic">{l.note}</div>}
                              <div className="text-[11px] text-slate-400">Ngày: {l.date}</div>
                            </div>
                            <div className={`font-extrabold text-sm sm:text-base shrink-0 ${l.entryType === 'chi' ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {l.entryType === 'chi' ? '-' : '+'}{formatVND(l.amount)}
                            </div>
                          </div>
                        ))}

                        <PaginationControls
                          currentPage={financeLedgerPage}
                          totalItems={filteredLedgerPublic.length}
                          pageSize={PUBLIC_PAGE_SIZE}
                          onPageChange={setFinanceLedgerPage}
                        />
                      </>
                    )}
                  </div>
                )}

                {financePublicSubTab === 'lists' && (
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    {regularCustomLists.filter((l) => l.is_public).length === 0 ? (
                      <p className="text-sm text-slate-500 text-center">Chưa có danh sách chuyên đề công khai nào được đăng tải.</p>
                    ) : (
                      regularCustomLists.filter((l) => l.is_public).map((l) => (
                        <div key={l.id} className="border-t pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                          <div className="font-bold text-emerald-800">{l.title}</div>
                          {l.description && <p className="text-xs text-slate-500 mt-0.5">{l.description}</p>}
                          <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                            {customItems.filter((i) => i.list_id === l.id).map((i) => (
                              <li key={i.id}>• <strong>{i.name}</strong> {i.role_or_group && `(${i.role_or_group})`} {i.detail && `– ${i.detail}`}</li>
                            ))}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === 'directory' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Danh bạ, Bản đồ & Mã QR {appSettings.village_name}</h2>

                <div className="flex gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  {[
                    { id: 'officials', label: `Cán bộ & Khẩn cấp (${officials.length})` },
                    { id: 'map', label: 'Bản đồ Nhà VH' },
                    { id: 'qr', label: 'Mã QR chia sẻ' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDirectorySubTab(d.id)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${
                        directorySubTab === d.id ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {directorySubTab === 'officials' && (
                  <div className="space-y-4">
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

                {directorySubTab === 'map' && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="font-extrabold text-emerald-950 flex flex-wrap items-center gap-2">
                          <span>📍 Đã ghim: {appSettings.cultural_house_name}</span>
                          {appSettings.cultural_house_lat && appSettings.cultural_house_lng && (
                            <span className="text-[11px] font-mono bg-white text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                              {appSettings.cultural_house_lat}, {appSettings.cultural_house_lng}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{appSettings.cultural_house_note || appSettings.address}</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <iframe
                        title={`Bản đồ ${appSettings.cultural_house_name}`}
                        src={culturalHouseMapSrc}
                        className="w-full h-72 border-0"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-700" /> {appSettings.cultural_house_name}</div>
                      <p className="text-xs text-slate-500">Địa chỉ: {appSettings.address}</p>
                      <a
                        href={culturalHouseExternalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
                      >
                         Mở chỉ đường tới Nhà văn hóa trên Google Maps <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {directorySubTab === 'qr' && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center space-y-3">
                    <h3 className="font-bold text-lg text-slate-800">Mã QR truy cập nhanh {appSettings.village_name}</h3>
                    <QRImage url={siteUrl} size={220} />
                    <p className="text-xs text-slate-500">Đưa mã này cho bà con quét bằng Zalo hoặc Camera điện thoại để mở ngay ứng dụng.</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'voice' && (
              <div className="space-y-4">
                <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setVoiceSubTab('feedback')}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                      voiceSubTab === 'feedback' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Phản ánh kiến nghị
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceSubTab('suggest')}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                      voiceSubTab === 'suggest' ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4" /> Góp ý xây dựng thôn
                  </button>
                </div>

                {voiceSubTab === 'feedback' && (
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <h2 className="text-xl font-bold text-slate-800">Gửi Phản ánh & Kiến nghị</h2>
                    <p className="text-sm text-slate-500">Không cần đăng nhập. Nội dung và tệp đính kèm được lưu riêng để Ban quản trị thôn tiếp nhận xử lý.</p>
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
                        <option>Ý kiến kiến nghị khác</option>
                      </select>
                      <textarea required rows={4} placeholder="Nhập nội dung phản ánh hoặc kiến nghị của bà con..." value={fbForm.content} onChange={e => setFbForm({ ...fbForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm" />
                      <div className="space-y-2">
                        <label htmlFor="feedback-attachments" className="block text-sm font-semibold text-slate-700">Đính kèm ảnh hoặc tệp (không bắt buộc)</label>
                        <input
                          id="feedback-attachments"
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={handleFeedbackAttachmentSelection}
                          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:font-semibold file:text-amber-800 hover:file:bg-amber-100"
                        />
                        <p className="text-xs text-slate-500">Tối đa 3 tệp, mỗi tệp không quá 8MB (tổng tối đa 15MB).</p>
                        {feedbackAttachmentFiles.length > 0 && (
                          <ul className="space-y-1.5">
                            {feedbackAttachmentFiles.map((file, index) => (
                              <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                                <span className="truncate">{file.name} <span className="text-xs text-slate-500">({(file.size / (1024 * 1024)).toFixed(1)}MB)</span></span>
                                <button type="button" onClick={() => setFeedbackAttachmentFiles(files => files.filter((_, fileIndex) => fileIndex !== index))} className="shrink-0 font-semibold text-red-600 hover:underline">Gỡ</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <button disabled={submittingFeedback} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                        {submittingFeedback ? 'Đang gửi phản ánh...' : 'Gửi phản ánh đến Ban thôn'}
                      </button>
                    </form>
                  </div>
                )}

                {voiceSubTab === 'suggest' && (
                  <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">Góp ý xây dựng {appSettings.village_name}</h2>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                          Đóng góp ý tưởng, hiến kế phát triển kinh tế – văn hóa – cảnh quan thôn quê. Mọi thông tin người góp ý được <strong>bảo mật tuyệt đối</strong>, chỉ <strong>Ban quản trị thôn</strong> nắm thông tin để trao đổi, tiếp thu.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSuggestionSubmit} className="space-y-3 pt-1">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên người góp ý <span className="text-red-600">*</span></label>
                          <input
                            required
                            placeholder="Nhập đầy đủ họ và tên..."
                            value={sugForm.sender_name}
                            onChange={e => setSugForm({ ...sugForm, sender_name: e.target.value })}
                            className="w-full border px-4 py-2.5 rounded-xl text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ <span className="text-red-600">*</span></label>
                          <input
                            required
                            type="tel"
                            placeholder="Nhập số điện thoại..."
                            value={sugForm.sender_phone}
                            onChange={e => setSugForm({ ...sugForm, sender_phone: e.target.value })}
                            className="w-full border px-4 py-2.5 rounded-xl text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Khu vực / Xóm / Hộ gia đình <span className="text-red-600">*</span></label>
                          <input
                            required
                            placeholder="Ví dụ: Xóm 2, thôn An Sơn..."
                            value={sugForm.area}
                            onChange={e => setSugForm({ ...sugForm, area: e.target.value })}
                            className="w-full border px-4 py-2.5 rounded-xl text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Lĩnh vực góp ý</label>
                          <select
                            value={sugForm.topic}
                            onChange={e => setSugForm({ ...sugForm, topic: e.target.value })}
                            className="w-full border px-4 py-2.5 rounded-xl text-sm"
                          >
                            <option>Xây dựng đời sống văn hóa, nông thôn mới</option>
                            <option>Phát triển kinh tế, du lịch vùng Cùa</option>
                            <option>Hạ tầng, đường giao thông, cảnh quan</option>
                            <option>Hoạt động đoàn thể, thanh thiếu niên</option>
                            <option>Chuyển đổi số, cải tiến ứng dụng thôn</option>
                            <option>Góp ý khác cho Ban quản lý thôn</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung góp ý chi tiết <span className="text-red-600">*</span></label>
                        <textarea
                          required
                          rows={4}
                          placeholder="Nhập nội dung góp ý xây dựng thôn An Sơn..."
                          value={sugForm.content}
                          onChange={e => setSugForm({ ...sugForm, content: e.target.value })}
                          className="w-full border px-4 py-2.5 rounded-xl text-sm"
                        />
                      </div>

                      <button
                        disabled={submittingSug}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 rounded-xl disabled:opacity-60"
                      >
                        {submittingSug ? 'Đang gửi góp ý...' : 'Gửi góp ý tới Ban quản trị thôn'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex justify-around py-2 z-40">
        {[
          { id: 'home', label: 'Trang chủ', icon: Home },
          { id: 'feed', label: 'Tin & Lịch', icon: Newspaper },
          { id: 'finance', label: 'Ủng hộ & Quỹ', icon: HeartHandshake },
          { id: 'voice', label: 'Gửi ý kiến', icon: MessageSquare },
          { id: 'directory', label: 'Danh bạ', icon: Compass },
        ].map(n => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => navigatePublic(n.id)} className={`flex flex-col items-center gap-0.5 px-2.5 py-1 ${active ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[11px]">{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal đọc chi tiết bài viết / thông báo */}
      {detailModalPost && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[1px] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setDetailModalPost(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-emerald-50/60">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {detailModalPost.isPinned && (
                  <span className="text-[11px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">📌 Ghim</span>
                )}
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  detailModalPost.priority === 'urgent'
                    ? 'bg-red-100 text-red-700'
                    : detailModalPost.kind === 'news'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {detailModalPost.badge}
                </span>
                {detailModalPost.createdAt && (
                  <span className="text-xs text-slate-500">
                    {new Date(detailModalPost.createdAt).toLocaleString('vi-VN', {
                      timeZone: 'Asia/Ho_Chi_Minh',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailModalPost(null)}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0"
                aria-label="Đóng bài viết"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                {detailModalPost.title}
              </h2>

              <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-line">
                {detailModalPost.content}
              </div>

              {detailModalPost.imageUrl && (
                <div className="space-y-2 pt-1">
                  <a href={detailModalPost.imageUrl} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={detailModalPost.imageUrl}
                      alt={detailModalPost.title}
                      className="w-full max-h-[65vh] object-contain rounded-2xl border border-slate-200 bg-slate-50"
                    />
                  </a>
                  <div className="text-right">
                    <a
                      href={detailModalPost.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                    >
                      Mở ảnh kích thước gốc <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {detailModalPost.videoUrl && (
                <a
                  href={detailModalPost.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  ▶ Xem video hoạt động đính kèm <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleCopyPostLink(detailModalPost.shareType, detailModalPost.shareItem)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-4 py-2.5 rounded-xl transition"
              >
                {copiedKey === `${detailModalPost.shareType}-${detailModalPost.shareItem?.id}` ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedKey === `${detailModalPost.shareType}-${detailModalPost.shareItem?.id}`
                  ? 'Đã sao chép link Zalo'
                  : 'Sao chép link gửi Zalo'}
              </button>
              <button
                type="button"
                onClick={() => setDetailModalPost(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-emerald-800">Chia sẻ {appSettings.village_name}</h3>
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
