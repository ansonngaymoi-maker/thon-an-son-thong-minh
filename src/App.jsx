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
const NEWS_ITEMS_PER_SECTION = 5;
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

const NewsSectionControls = ({ sectionIndex, totalItems, onPrevious, onNext }) => {
  const sectionCount = Math.ceil(totalItems / NEWS_ITEMS_PER_SECTION);
  if (sectionCount <= 1) return null;
  const firstItem = sectionIndex * NEWS_ITEMS_PER_SECTION + 1;
  const lastItem = Math.min((sectionIndex + 1) * NEWS_ITEMS_PER_SECTION, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-700">
        Mục {sectionIndex + 1} / {sectionCount} <span className="font-normal text-slate-500">· Bài {firstItem}–{lastItem} / {totalItems}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={sectionIndex === 0}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trước
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={sectionIndex >= sectionCount - 1}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Tiếp
        </button>
      </div>
    </div>
  );
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
  const [showAllHomeNews, setShowAllHomeNews] = useState(false);
  const [homeNewsSectionIndex, setHomeNewsSectionIndex] = useState(0);
  const [feedNewsSectionIndex, setFeedNewsSectionIndex] = useState(0);
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
    if (targetTab === 'feed' && subTab) {
      setFeedSubTab(subTab);
      setFeedNewsSectionIndex(0);
    }
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
  const ensureSystemFinanceList = async (marker, title) => {
    const existing = customLists.find((l) => l.description === marker);
    if (existing) return existing.id;
    const { data, error } = await supabase
      .from('custom_lists')
      .insert([{ title, description: marker, is_public: true, year: new Date().getFullYear() }])
      .select();
    if (error || !data?.[0]) {
      throw new Error(error?.message || 'Không khởi tạo được danh sách công khai');
    }
    return data[0].id;
  };

  const handleSaveDonation = async (e) => {
    e.preventDefault();
    if (!donationForm.donor_name.trim()) return;
    setSavingFinance(true);
    try {
      const listId = await ensureSystemFinanceList(
        DONATION_LIST_MARKER,
        'Danh sách nhân dân & mạnh thường quân ủng hộ'
      );
      const amountNum = parseMoneyAmount(donationForm.amount);
      const inKindClean = donationForm.in_kind.trim();
      const payload = {
        list_id: listId,
        name: donationForm.donor_name.trim(),
        role_or_group: donationForm.area_or_org.trim(),
        phone: String(amountNum),
        detail: donationForm.campaign.trim() || 'Ủng hộ thôn An Sơn',
        notes: encodeMeta({
          amount: amountNum,
          in_kind: inKindClean,
          date: donationForm.date,
          note: donationForm.note.trim(),
        }),
      };

      if (editingDonationId) {
        const { error } = await supabase.from('custom_list_items').update(payload).eq('id', editingDonationId);
        if (error) throw new Error(error.message);
        let msg = 'Đã cập nhật thông tin người ủng hộ!';
        if (sendPushOnDonation) {
          const valDesc = amountNum > 0 ? formatVND(amountNum) : inKindClean || 'đóng góp';
          const pushRes = await dispatchOneSignalPush({
            heading: `Công khai ủng hộ – ${appSettings.village_name}`,
            content: `${payload.name} ủng hộ ${valDesc} (${payload.detail})`,
            launchUrl: `${siteUrl}/?post=finance`,
            target: 'all',
          });
          msg = formatPushResultMessage('Đã cập nhật thông tin ủng hộ!', pushRes);
        }
        showToast(msg, 6000);
      } else {
        const { error } = await supabase.from('custom_list_items').insert([payload]);
        if (error) throw new Error(error.message);
        let msg = 'Đã đăng công khai thông tin ủng hộ cho bà con xem!';
        if (sendPushOnDonation) {
          const valDesc = amountNum > 0 ? formatVND(amountNum) : inKindClean || 'đóng góp';
          const pushRes = await dispatchOneSignalPush({
            heading: `Công khai ủng hộ – ${appSettings.village_name}`,
            content: `Cảm ơn ${payload.name} ủng hộ ${valDesc} (${payload.detail})`,
            launchUrl: `${siteUrl}/?post=finance`,
            target: 'all',
          });
          msg = formatPushResultMessage('Đã đăng công khai thông tin ủng hộ!', pushRes);
        }
        showToast(msg, 6000);
      }

      setEditingDonationId(null);
      setSendPushOnDonation(true);
      setDonationForm({
        donor_name: '',
        area_or_org: '',
        amount: '',
        in_kind: '',
        campaign: 'Vận động xây dựng & hoạt động thôn',
        date: getVietnamDateTimeInputs(0).dateStr,
        note: '',
      });
      await fetchPublicData();
    } catch (err) {
      showToast('Lỗi lưu danh sách ủng hộ: ' + err.message);
    } finally {
      setSavingFinance(false);
    }
  };

  const handleStartEditDonation = (item) => {
    const meta = decodeMeta(item.notes, { amount: parseMoneyAmount(item.phone), in_kind: '', date: '', note: '' });
    setEditingDonationId(item.id);
    setSendPushOnDonation(false);
    setDonationForm({
      donor_name: item.name || '',
      area_or_org: item.role_or_group || '',
      amount: meta.amount ? String(meta.amount) : '',
      in_kind: meta.in_kind || '',
      campaign: item.detail || 'Vận động xây dựng & hoạt động thôn',
      date: meta.date || getVietnamDateTimeInputs(0).dateStr,
      note: meta.note || '',
    });
  };

  const handleSaveLedger = async (e) => {
    e.preventDefault();
    if (!ledgerForm.title.trim()) return;
    setSavingFinance(true);
    try {
      const listId = await ensureSystemFinanceList(
        LEDGER_LIST_MARKER,
        'Công khai Thu – Chi đóng góp ủng hộ thôn'
      );
      const amountNum = parseMoneyAmount(ledgerForm.amount);
      const isChi = ledgerForm.type === 'chi';
      const payload = {
        list_id: listId,
        name: ledgerForm.title.trim(),
        role_or_group: isChi ? 'chi' : 'thu',
        phone: String(amountNum),
        detail: ledgerForm.campaign.trim() || 'Quỹ vận động thôn An Sơn',
        notes: encodeMeta({
          type: isChi ? 'chi' : 'thu',
          amount: amountNum,
          date: ledgerForm.date,
          note: ledgerForm.note.trim(),
        }),
      };

      if (editingLedgerId) {
        const { error } = await supabase.from('custom_list_items').update(payload).eq('id', editingLedgerId);
        if (error) throw new Error(error.message);
        let msg = 'Đã cập nhật khoản thu/chi!';
        if (sendPushOnLedger) {
          const pushRes = await dispatchOneSignalPush({
            heading: `Công khai ${isChi ? 'CHI' : 'THU'} – ${appSettings.village_name}`,
            content: `${isChi ? 'Chi' : 'Thu'} ${formatVND(amountNum)}: ${payload.name}`,
            launchUrl: `${siteUrl}/?post=finance`,
            target: 'all',
          });
          msg = formatPushResultMessage('Đã cập nhật khoản thu/chi!', pushRes);
        }
        showToast(msg, 6000);
      } else {
        const { error } = await supabase.from('custom_list_items').insert([payload]);
        if (error) throw new Error(error.message);
        let msg = 'Đã đăng công khai khoản thu/chi mới!';
        if (sendPushOnLedger) {
          const pushRes = await dispatchOneSignalPush({
            heading: `Công khai ${isChi ? 'CHI' : 'THU'} – ${appSettings.village_name}`,
            content: `${isChi ? 'Chi' : 'Thu'} ${formatVND(amountNum)}: ${payload.name}`,
            launchUrl: `${siteUrl}/?post=finance`,
            target: 'all',
          });
          msg = formatPushResultMessage('Đã đăng công khai khoản thu/chi!', pushRes);
        }
        showToast(msg, 6000);
      }

      setEditingLedgerId(null);
      setSendPushOnLedger(true);
      setLedgerForm({
        type: 'thu',
        title: '',
        amount: '',
        date: getVietnamDateTimeInputs(0).dateStr,
        campaign: 'Quỹ vận động thôn An Sơn',
        note: '',
      });
      await fetchPublicData();
    } catch (err) {
      showToast('Lỗi lưu thu chi: ' + err.message);
    } finally {
      setSavingFinance(false);
    }
  };

  const handleStartEditLedger = (item) => {
    const meta = decodeMeta(item.notes, {
      type: item.role_or_group === 'chi' ? 'chi' : 'thu',
      amount: parseMoneyAmount(item.phone),
      date: '',
      note: '',
    });
    setEditingLedgerId(item.id);
    setSendPushOnLedger(false);
    setLedgerForm({
      type: meta.type === 'chi' ? 'chi' : 'thu',
      title: item.name || '',
      amount: meta.amount ? String(meta.amount) : '',
      date: meta.date || getVietnamDateTimeInputs(0).dateStr,
      campaign: item.detail || 'Quỹ vận động thôn An Sơn',
      note: meta.note || '',
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const normalized = {
        ...DEFAULT_SETTINGS,
        ...settingsForm,
        cultural_house_lat: String(settingsForm.cultural_house_lat || '').trim(),
        cultural_house_lng: String(settingsForm.cultural_house_lng || '').trim(),
      };
      setAppSettings(normalized);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
      }
      const { error } = await supabase.from('app_settings').upsert([{ id: 1, ...normalized }], { onConflict: 'id' });
      if (error) {
        showToast('Đã lưu cài đặt trên thiết bị này (bảng app_settings chưa tạo trên Supabase: ' + error.message + ')', 6000);
      } else {
        showToast('Đã lưu cài đặt và ghim vị trí Nhà văn hóa thôn An Sơn thành công!');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const normalizeHouseholdRow = (rawRow, index) => {
    const entries = Object.entries(rawRow || {});
    const pickValue = (keys) => {
      for (const k of keys) {
        const found = entries.find(([colName]) => colName.toLowerCase().trim() === k.toLowerCase());
        if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
          return String(found[1]).trim();
        }
      }
      return '';
    };

    const household_code =
      pickValue(['household_code', 'ma_ho', 'mã hộ', 'mahộ', 'ma ho', 'mã']) ||
      `AS-${String(households.length + index + 1).padStart(3, '0')}`;
    const head_name = pickValue(['head_name', 'chu_ho', 'chủ hộ', 'chuho', 'chu ho', 'họ tên chủ hộ', 'ho ten chu ho', 'ten chu ho']);
    const area = pickValue(['area', 'khu_vuc', 'khu vực', 'khuvuc', 'xom', 'xóm', 'tổ', 'to']);
    const phone = pickValue(['phone', 'sdt', 'sđt', 'so_dien_thoai', 'số điện thoại', 'dien thoai', 'điện thoại']);
    const rawCount = pickValue(['member_count', 'so_nguoi', 'số người', 'songuoi', 'nhan_khau', 'nhân khẩu', 'so_nhan_khau', 'số nhân khẩu']);
    const parsedCount = parseInt(rawCount.replace(/[^\d]/g, ''), 10);
    const member_count = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 1;
    const notes = pickValue(['notes', 'ghi_chu', 'ghi chú', 'ghichu', 'ghi chu']);

    if (!head_name) return null;
    return { household_code, head_name, area, phone, member_count, notes };
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);
    try {
      const XLSX = await loadXlsxLibrary();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const mapped = jsonRows
        .map((row, idx) => normalizeHouseholdRow(row, idx))
        .filter(Boolean);
      setExcelPreviewRows(mapped);
      if (mapped.length === 0) {
        showToast('Không đọc được dòng hộ dân hợp lệ. Kiểm tra cột Chủ hộ / Mã hộ trong file Excel.');
      } else {
        showToast(`Đã đọc ${mapped.length} hộ dân từ tệp "${file.name}". Bấm "Đẩy lên hệ thống" để lưu.`);
      }
    } catch (err) {
      setExcelPreviewRows([]);
      showToast('Lỗi đọc tệp Excel: ' + (err?.message || 'Vui lòng kiểm tra lại định dạng tệp.'));
    }
  };

  const handlePushExcelToSupabase = async () => {
    if (!excelPreviewRows.length || importingExcel) return;
    setImportingExcel(true);
    try {
      const { error } = await supabase.from('households').insert(excelPreviewRows);
      if (error) {
        showToast('Lỗi đẩy dữ liệu Excel lên hệ thống: ' + error.message, 6000);
        return;
      }
      const count = excelPreviewRows.length;
      setExcelPreviewRows([]);
      setExcelFileName('');
      await fetchAdminData();
      showToast(`Đã đẩy thành công ${count} hộ dân từ file Excel vào hệ thống!`);
    } finally {
      setImportingExcel(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) setAuthError('Sai email hoặc mật khẩu. Vui lòng kiểm tra lại.');
    else {
      syncOneSignalAdminTag(true);
      showToast('Đăng nhập Ban quản trị thành công!');
    }
  };

  const handleLogout = async () => {
    syncOneSignalAdminTag(false);
    await supabase.auth.signOut();
    setMode('public');
    showToast('Đã đăng xuất.');
  };

  const handleFeedbackAttachmentSelection = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if (selectedFiles.length === 0) return;

    const nextFiles = [...feedbackAttachmentFiles];
    let rejectedType = false;
    let rejectedSize = false;
    let rejectedCount = false;
    for (const file of selectedFiles) {
      const mimeType = getFeedbackAttachmentMimeType(file);
      const duplicate = nextFiles.some((existing) =>
        existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified
      );
      if (duplicate) continue;
      if (!mimeType) {
        rejectedType = true;
        continue;
      }
      if (file.size > MAX_FEEDBACK_ATTACHMENT_SIZE) {
        rejectedSize = true;
        continue;
      }
      const totalSize = nextFiles.reduce((sum, existing) => sum + existing.size, 0);
      if (nextFiles.length >= MAX_FEEDBACK_ATTACHMENT_COUNT || totalSize + file.size > MAX_FEEDBACK_ATTACHMENTS_TOTAL_SIZE) {
        rejectedCount = true;
        continue;
      }
      nextFiles.push(file);
    }

    setFeedbackAttachmentFiles(nextFiles);
    if (rejectedType) showToast('Chỉ nhận ảnh, PDF, Word, Excel hoặc tệp văn bản.');
    else if (rejectedSize) showToast('Mỗi tệp đính kèm tối đa 8MB.');
    else if (rejectedCount) showToast('Chọn tối đa 3 tệp, tổng dung lượng không quá 15MB.');
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    const cleanContent = fbForm.content.trim();
    if (!cleanContent) return;
    setSubmittingFeedback(true);
    try {
      const batchId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const attachments = [];
      for (const file of feedbackAttachmentFiles) {
        const mimeType = getFeedbackAttachmentMimeType(file);
        const extension = getFeedbackAttachmentExtension(file, mimeType);
        const fileId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const path = `feedbacks/${batchId}/${fileId}${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(FEEDBACK_ATTACHMENT_BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false, contentType: mimeType });
        if (uploadError) throw new Error(`Không tải được tệp "${file.name}": ${uploadError.message}`);
        attachments.push({
          path,
          name: String(file.name || 'Tệp đính kèm').slice(0, 120),
          size: file.size,
          mimeType,
        });
      }

      const payload = {
        ...fbForm,
        content: packFeedbackContent(cleanContent, attachments),
      };
      const { error } = await supabase.from('feedbacks').insert([payload]);
      if (error) throw new Error(error.message);

      const senderLabel = fbForm.sender_name.trim() || 'Người dân ẩn danh';
      await dispatchOneSignalPush({
        heading: `Phản ánh mới – ${appSettings.village_name}`,
        content: `${senderLabel} (${fbForm.category}): ${cleanContent.slice(0, 90)}`,
        launchUrl: `${siteUrl}/?post=admin-feedbacks`,
        target: 'admins',
      });
      setFbForm({ sender_name: '', sender_phone: '', category: 'Đường làng, ngõ xóm', content: '' });
      setFeedbackAttachmentFiles([]);
      showToast('Đã gửi phản ánh đến Ban quản trị thôn. Cảm ơn bà con!');
    } catch (err) {
      showToast(`Không gửi được phản ánh: ${err?.message || 'Vui lòng thử lại.'}`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDownloadFeedbackAttachment = async (attachment) => {
    try {
      if (!attachment?.path) throw new Error('Thiếu đường dẫn tệp.');
      const { data, error } = await supabase.storage.from(FEEDBACK_ATTACHMENT_BUCKET).download(attachment.path);
      if (error || !data) throw new Error(error?.message || 'Vui lòng thử lại.');
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = String(attachment.name || 'tep-dinh-kem').replace(/[\\/:*?"<>|]/g, '_');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      showToast('Không tải được tệp đính kèm: ' + (err?.message || 'Vui lòng thử lại.'));
    }
  };

  const handleSuggestionSubmit = async (e) => {
    e.preventDefault();
    const cleanName = sugForm.sender_name.trim();
    const cleanPhone = sugForm.sender_phone.trim();
    const cleanArea = sugForm.area.trim();
    const cleanContent = sugForm.content.trim();

    if (!cleanName || !cleanPhone || !cleanArea || !cleanContent) {
      showToast('Vui lòng nhập đầy đủ Họ tên, Số điện thoại, Khu vực/Xóm và Nội dung góp ý.');
      return;
    }

    setSubmittingSug(true);
    try {
      const payload = {
        sender_name: cleanName,
        sender_phone: `${cleanPhone} (${cleanArea})`,
        category: `[GÓP Ý] ${sugForm.topic}`,
        content: cleanContent,
      };
      const { error } = await supabase.from('feedbacks').insert([payload]);
      if (!error) {
        await dispatchOneSignalPush({
          heading: `Góp ý mới cho thôn – ${appSettings.village_name}`,
          content: `${cleanName} (${cleanArea}): ${cleanContent.slice(0, 90)}`,
          launchUrl: `${siteUrl}/?post=admin-feedbacks`,
          target: 'admins',
        });
        setSugForm({
          sender_name: '',
          sender_phone: '',
          area: '',
          topic: 'Xây dựng đời sống văn hóa, nông thôn mới',
          content: '',
        });
        showToast('Đã gửi góp ý tâm huyết tới Ban quản trị thôn. Xin trân trọng cảm ơn!');
      } else {
        showToast('Lỗi gửi góp ý: ' + error.message);
      }
    } finally {
      setSubmittingSug(false);
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

  const handleNewsImageChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const mimeType = getNewsImageMimeType(file);
    if (!mimeType) {
      showToast('Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc HEIC.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB). Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    if (newsImagePreview) URL.revokeObjectURL(newsImagePreview);
    setNewsImageFile(file);
    setNewsImagePreview(URL.createObjectURL(file));
  };

  const clearNewsImage = () => {
    if (newsImagePreview) URL.revokeObjectURL(newsImagePreview);
    setNewsImageFile(null);
    setNewsImagePreview('');
  };

  const formatPushResultMessage = (baseSuccessMsg, pushRes) => {
    if (pushRes.ok) {
      return `${baseSuccessMsg} Đã gửi chuông báo tới điện thoại bà con!`;
    }
    return `${baseSuccessMsg} (Lỗi gửi push: ${pushRes.reason})`;
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

      const scheduledMs = useAnnSchedule ? parseVietnamScheduledMs(annScheduleDate, annScheduleTime) : 0;
      const isFutureScheduled = Boolean(useAnnSchedule && scheduledMs > Date.now() + 15000);

      const packedContent = useAnnSchedule
        ? packScheduledItem({
            cleanContent: annForm.content,
            scheduleDate: annScheduleDate,
            scheduleTime: annScheduleTime,
            sendPush: sendPushOnAnn,
            isNewsPost: false,
          })
        : annForm.content;

      const payload = image_url
        ? { ...annForm, content: packedContent, image_url }
        : { ...annForm, content: packedContent };

      const { data: insertedRows, error } = await supabase.from('announcements').insert([payload]).select();
      if (!error) {
        const created = insertedRows?.[0];
        let msg = isFutureScheduled
          ? `Đã hẹn giờ đăng thông báo vào ${annScheduleDate} lúc ${annScheduleTime} (GMT+7)! Tới giờ máy chủ sẽ tự đăng và báo chuông.`
          : 'Đã đăng thông báo mới!';

        if (!isFutureScheduled && sendPushOnAnn) {
          const pushRes = await dispatchOneSignalPush({
            heading: `Thông báo mới – ${appSettings.village_name}`,
            content: annForm.title,
            launchUrl: created ? getPostShareUrl('announcements', created.id) : siteUrl,
            imageUrl: image_url,
            target: 'all',
          });
          msg = formatPushResultMessage('Đã đăng thông báo!', pushRes);
        }

        const nextLater = getVietnamDateTimeInputs(5);
        setAnnForm({ title: '', content: '', priority: 'normal', is_pinned: false });
        setUseAnnSchedule(false);
        setAnnScheduleDate(nextLater.dateStr);
        setAnnScheduleTime(nextLater.timeStr);
        clearAnnImage();
        fetchPublicData();
        showToast(msg, 6000);
      } else {
        showToast('Lỗi đăng thông báo: ' + error.message);
      }
    } finally {
      setUploadingAnn(false);
    }
  };

  const handleNewsSubmit = async (e) => {
    e.preventDefault();
    setUploadingNews(true);
    try {
      let imageUrl = '';
      if (newsImageFile) {
        const mimeType = getNewsImageMimeType(newsImageFile);
        const extension = NEWS_IMAGE_EXTENSIONS[mimeType];
        const fileId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const filePath = `news-${fileId}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('anh-thong-bao')
          .upload(filePath, newsImageFile, { cacheControl: '3600', upsert: false, contentType: mimeType });
        if (uploadError) throw new Error('Lỗi tải ảnh lên: ' + uploadError.message);
        imageUrl = supabase.storage.from('anh-thong-bao').getPublicUrl(filePath).data.publicUrl;
      }

      const scheduledMs = useNewsSchedule ? parseVietnamScheduledMs(newsScheduleDate, newsScheduleTime) : 0;
      const isFutureScheduled = Boolean(useNewsSchedule && scheduledMs > Date.now() + 15000);

      if (isFutureScheduled) {
        const packedContent = packScheduledItem({
          cleanContent: newsForm.content,
          scheduleDate: newsScheduleDate,
          scheduleTime: newsScheduleTime,
          sendPush: sendPushOnNews,
          isNewsPost: true,
        });
        const scheduledNews = {
          title: newsForm.title,
          content: packedContent,
          priority: 'normal',
          is_pinned: false,
        };
        if (imageUrl) scheduledNews.image_url = imageUrl;
        const { error } = await supabase.from('announcements').insert([scheduledNews]);
        if (error) throw new Error(error.message);

        const nextLater = getVietnamDateTimeInputs(5);
        setNewsForm({ title: '', content: '', category: 'Hoạt động cộng đồng', video_url: '' });
        clearNewsImage();
        setUseNewsSchedule(false);
        setNewsScheduleDate(nextLater.dateStr);
        setNewsScheduleTime(nextLater.timeStr);
        fetchPublicData();
        showToast(`Đã hẹn giờ đăng tin tức lúc ${newsScheduleDate} ${newsScheduleTime} (GMT+7)! Tới giờ máy chủ sẽ tự đăng và đẩy chuông báo.`, 6000);
        return;
      }

      const newsPayload = { ...newsForm, content: packNewsContent(newsForm.content, imageUrl) };
      const { data: insertedRows, error } = await supabase.from('news').insert([newsPayload]).select();
      if (error) throw new Error(error.message);
      const created = insertedRows?.[0];
      let msg = 'Đã đăng bài viết!';
      if (sendPushOnNews) {
        const pushRes = await dispatchOneSignalPush({
          heading: `Tin tức mới – ${appSettings.village_name}`,
          content: newsForm.title,
          launchUrl: created ? getPostShareUrl('news', created.id) : siteUrl,
          imageUrl: imageUrl || undefined,
          target: 'all',
        });
        msg = formatPushResultMessage('Đã đăng bài viết!', pushRes);
      }
      setNewsForm({ title: '', content: '', category: 'Hoạt động cộng đồng', video_url: '' });
      clearNewsImage();
      setUseNewsSchedule(false);
      fetchPublicData();
      showToast(msg, 6000);
    } catch (err) {
      showToast('Lỗi đăng tin: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setUploadingNews(false);
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
          if (session) {
            await OneSignal.User?.addTag?.('is_admin', 'true');
          }
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
    const data = { exported_at: new Date().toISOString(), version: APP_VERSION, settings: appSettings, announcements, news, officials, events, feedbacks, households, residents, customLists, customItems };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sao-luu-thon-an-son-${getVietnamDateTimeInputs(0).dateStr}.json`;
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

  const nowMs = Date.now();
  const todayIso = getVietnamDateTimeInputs(0).dateStr;

  const formattedAnnouncements = announcements.map((a) => {
    const parsed = parseScheduledItem(a.content);
    const isScheduledPending = Boolean(parsed.hasSchedule && parsed.publishAtMs > nowMs && !parsed.pushedDone);
    return {
      ...a,
      cleanContent: parsed.cleanContent,
      publishAtMs: parsed.publishAtMs,
      publishLabel: parsed.publishLabel,
      isNewsPost: parsed.isNewsPost,
      isScheduledPending,
    };
  });

  const publishedAnnouncements = formattedAnnouncements.filter((a) => !a.isScheduledPending && !a.isNewsPost);
  const scheduledNewsDrafts = formattedAnnouncements.filter((a) => a.isNewsPost);
  const publishedScheduledNews = scheduledNewsDrafts.filter((a) => !a.isScheduledPending);
  const scheduledPendingItems = formattedAnnouncements.filter((a) => a.isScheduledPending && !a.isNewsPost);

  const allPublishedNews = [
    ...publishedScheduledNews.map((item) => {
      const parsed = parseNewsContent(item.cleanContent);
      return {
        id: `sch-${item.id}`,
        sourceAnnId: item.id,
        title: item.title,
        content: parsed.content,
        image_url: item.image_url || parsed.imageUrl,
        category: 'Tin tức hẹn giờ',
        created_at: item.created_at,
        video_url: '',
      };
    }),
    ...news.map((item) => {
      const parsed = parseNewsContent(item.content);
      return { ...item, content: parsed.content, image_url: parsed.imageUrl };
    }),
  ];
  const allPublishedNewsSections = [];
  for (let index = 0; index < allPublishedNews.length; index += NEWS_ITEMS_PER_SECTION) {
    allPublishedNewsSections.push(allPublishedNews.slice(index, index + NEWS_ITEMS_PER_SECTION));
  }
  const lastNewsSectionIndex = Math.max(0, allPublishedNewsSections.length - 1);
  const safeHomeNewsSectionIndex = Math.min(homeNewsSectionIndex, lastNewsSectionIndex);
  const safeFeedNewsSectionIndex = Math.min(feedNewsSectionIndex, lastNewsSectionIndex);
  const homeNewsItems = showAllHomeNews
    ? (allPublishedNewsSections[safeHomeNewsSectionIndex] || [])
    : allPublishedNews.slice(0, 1);
  const feedNewsItems = allPublishedNewsSections[safeFeedNewsSectionIndex] || [];

  const upcomingEvents = events.filter((ev) => {
    const info = parseEventInfo(ev);
    if (!info.evtDate) return true;
    return info.evtDate >= todayIso;
  });

  const donationSystemList = customLists.find((l) => l.description === DONATION_LIST_MARKER);
  const ledgerSystemList = customLists.find((l) => l.description === LEDGER_LIST_MARKER);
  const regularCustomLists = customLists.filter(
    (l) => l.description !== DONATION_LIST_MARKER && l.description !== LEDGER_LIST_MARKER
  );

  const donationItems = (donationSystemList
    ? customItems.filter((i) => i.list_id === donationSystemList.id)
    : []
  ).map((item) => {
    const meta = decodeMeta(item.notes, { amount: parseMoneyAmount(item.phone), in_kind: '', date: '', note: '' });
    return {
      ...item,
      amount: parseMoneyAmount(meta.amount ?? item.phone),
      in_kind: meta.in_kind || '',
      date: meta.date || (item.created_at ? item.created_at.slice(0, 10) : ''),
      note: meta.note || '',
    };
  });

  const ledgerItems = (ledgerSystemList
    ? customItems.filter((i) => i.list_id === ledgerSystemList.id)
    : []
  ).map((item) => {
    const meta = decodeMeta(item.notes, {
      type: item.role_or_group === 'chi' ? 'chi' : 'thu',
      amount: parseMoneyAmount(item.phone),
      date: '',
      note: '',
    });
    return {
      ...item,
      entryType: meta.type === 'chi' ? 'chi' : 'thu',
      amount: parseMoneyAmount(meta.amount ?? item.phone),
      date: meta.date || (item.created_at ? item.created_at.slice(0, 10) : ''),
      note: meta.note || '',
    };
  });

  const totalDonatedMoney = donationItems.reduce((sum, d) => sum + d.amount, 0);
  const totalLedgerThu = ledgerItems.filter((l) => l.entryType === 'thu').reduce((sum, l) => sum + l.amount, 0);
  const totalLedgerChi = ledgerItems.filter((l) => l.entryType === 'chi').reduce((sum, l) => sum + l.amount, 0);
  const totalCombinedThu = totalDonatedMoney + totalLedgerThu;
  const currentFundBalance = totalCombinedThu - totalLedgerChi;

  const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });
  const galleryItems = publishedAnnouncements.filter(a => a.image_url);
  const culturalHouseMapSrc = buildCulturalHouseMapUrl(appSettings);
  const culturalHouseExternalUrl = buildCulturalHouseExternalUrl(appSettings);

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
              <h1 className="text-2xl font-bold text-slate-800">Ban Quản Trị {appSettings.village_name}</h1>
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
            <button onClick={goHomePublic} className="w-full mt-4 text-sm text-slate-500 hover:text-emerald-700">
              ← Quay lại trang công khai cho người dân
            </button>
          </div>
        </div>
      );
    }

    const newReceivedCount = feedbacks.filter(f => f.status === 'received').length;
    const activeFeedbacks = feedbacks.filter(fb => fb.status !== 'resolved');
    const resolvedFeedbacks = feedbacks.filter(fb => fb.status === 'resolved');
    const feedbackListSource = showResolvedFeedback ? resolvedFeedbacks : activeFeedbacks;
    const filteredFeedbackList = feedbackListSource.filter((fb) => {
      if (feedbackFilter === 'suggestion') return isSuggestionRecord(fb);
      if (feedbackFilter === 'feedback') return !isSuggestionRecord(fb);
      return true;
    });

    const adminMenu = [
      { id: 'overview', label: 'Tổng quan', icon: HomeIcon, color: 'bg-slate-100 text-slate-700' },
      { id: 'announcements', label: 'Thông báo', icon: Bell, color: 'bg-red-50 text-red-600' },
      { id: 'news', label: 'Tin tức', icon: Newspaper, color: 'bg-emerald-50 text-emerald-700' },
      { id: 'finance', label: 'Ủng hộ & Thu chi', icon: HeartHandshake, color: 'bg-rose-50 text-rose-600' },
      { id: 'officials', label: 'Cán bộ', icon: Users, color: 'bg-sky-50 text-sky-700' },
      { id: 'events', label: 'Lịch thôn', icon: Calendar, color: 'bg-teal-50 text-teal-700' },
      { id: 'feedbacks', label: `Phản ánh & Góp ý (${newReceivedCount})`, icon: MessageSquare, color: 'bg-amber-50 text-amber-700' },
      { id: 'households', label: 'Hộ dân & Dân cư', icon: Shield, color: 'bg-indigo-50 text-indigo-700' },
      { id: 'lists', label: 'Danh sách mở rộng', icon: ListPlus, color: 'bg-purple-50 text-purple-700' },
      { id: 'qr', label: 'Mã QR & In ấn', icon: QrCode, color: 'bg-cyan-50 text-cyan-700' },
      { id: 'settings', label: 'Cài đặt', icon: Settings, color: 'bg-orange-50 text-orange-700' },
      { id: 'system', label: 'Sao lưu & Phiên bản', icon: RefreshCw, color: 'bg-lime-50 text-lime-700' },
    ];

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
        {toast && <div className="fixed top-4 right-4 z-50 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-lg no-print max-w-sm text-sm">{toast}</div>}

        <aside className="w-full md:w-64 bg-emerald-900 text-white p-4 flex flex-col no-print">
          <div className="mb-4 md:mb-6 pb-3 md:pb-4 border-b border-emerald-800 flex items-center justify-between md:block">
            <button
              type="button"
              onClick={goHomePublic}
              className="text-left group cursor-pointer"
              title="Bấm để về Trang chủ người dân"
            >
              <h2 className="font-bold text-lg flex items-center gap-1.5 group-hover:text-emerald-200 transition">
                <Home className="w-4 h-4 shrink-0" /> QUẢN TRỊ AN SƠN
              </h2>
              <p className="text-xs text-emerald-300 truncate">{session.user.email} • {APP_VERSION}</p>
            </button>
            <div className="flex gap-2 md:hidden">
              <button onClick={goHomePublic} className="bg-emerald-800 hover:bg-emerald-700 px-3 py-1.5 rounded-lg text-xs font-medium">Trang dân</button>
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
            <button onClick={goHomePublic} className="flex-1 bg-emerald-800 hover:bg-emerald-700 py-2 rounded-lg text-xs font-medium">Trang dân</button>
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
              <h1 className="text-2xl font-bold text-slate-800">Tổng quan hệ thống {appSettings.village_name}</h1>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'announcements', label: 'Thông báo', val: publishedAnnouncements.length, color: 'bg-emerald-600 hover:bg-emerald-700' },
                  { id: 'finance', label: 'Lượt ủng hộ / Thu chi', val: donationItems.length + ledgerItems.length, color: 'bg-rose-600 hover:bg-rose-700' },
                  { id: 'households', label: 'Hộ dân (Nội bộ)', val: households.length, color: 'bg-indigo-600 hover:bg-indigo-700' },
                  { id: 'feedbacks', label: 'Phản ánh & Góp ý mới', val: newReceivedCount, color: 'bg-amber-600 hover:bg-amber-700' },
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
                <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle className="w-4 h-4 shrink-0" /> Có giao diện đọc chi tiết, phân trang và xóa phản ánh/góp ý kèm tệp đính kèm.</p>
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={useAnnSchedule}
                      onChange={e => setUseAnnSchedule(e.target.checked)}
                    />
                    <Clock className="w-4 h-4" /> Hẹn ngày giờ đăng
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <input type="checkbox" checked={sendPushOnAnn} onChange={e => setSendPushOnAnn(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                  </label>
                </div>

                {useAnnSchedule && (
                  <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Ngày hẹn đăng (Giờ VN)</label>
                      <input required type="date" value={annScheduleDate} onChange={e => setAnnScheduleDate(e.target.value)} className="w-full border bg-white px-3 py-2 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Giờ hẹn đăng (Giờ VN)</label>
                      <input required type="time" value={annScheduleTime} onChange={e => setAnnScheduleTime(e.target.value)} className="w-full border bg-white px-3 py-2 rounded-xl text-sm" />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button disabled={uploadingAnn} className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> {uploadingAnn ? 'Đang lưu...' : useAnnSchedule ? 'Lưu hẹn giờ đăng' : 'Đăng thông báo ngay'}
                  </button>
                </div>
              </form>

              {scheduledPendingItems.length > 0 && (
                <div className="space-y-2.5">
                  <h2 className="text-sm font-extrabold uppercase text-amber-800">Đang hẹn giờ chờ đăng ({scheduledPendingItems.length})</h2>
                  {scheduledPendingItems.map((a) => (
                    <div key={`sch-${a.id}`} className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-bold text-amber-800">⏰ Hẹn đăng: {a.publishLabel}</div>
                        <div className="font-bold text-slate-800">{a.title}</div>
                        <p className="text-xs text-slate-600 whitespace-pre-line">{a.cleanContent}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncementRow(a.id, a.title)}
                        className="text-red-600 hover:bg-red-100 bg-white border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                        title="Xóa mục hẹn giờ"
                      >
                        <Trash2 className="w-4 h-4" /> Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {publishedAnnouncements.map(a => (
                  <div key={a.id} className="bg-white p-4 rounded-xl border flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="font-bold text-slate-800">{a.is_pinned && '📌 '}{a.title}</div>
                      <p className="text-sm text-slate-600 whitespace-pre-line">{a.cleanContent}</p>
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
                    <button
                      type="button"
                      onClick={() => handleDeleteAnnouncementRow(a.id, a.title)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0"
                      title="Xóa thông báo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {adminTab === 'news' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Tin tức & Hoạt động</h1>
              <form onSubmit={handleNewsSubmit} className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
                <input required placeholder="Tiêu đề bài viết..." value={newsForm.title} onChange={e => setNewsForm({ ...newsForm, title: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <textarea required rows={4} placeholder="Nội dung bài viết..." value={newsForm.content} onChange={e => setNewsForm({ ...newsForm, content: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl" />
                <input placeholder="Link video YouTube (nếu có)..." value={newsForm.video_url} onChange={e => setNewsForm({ ...newsForm, video_url: e.target.value })} className="w-full border px-4 py-2.5 rounded-xl text-sm" />
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Ảnh kèm tin tức (không bắt buộc)</div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    <Upload className="w-4 h-4" /> Chọn ảnh
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif" onChange={handleNewsImageChange} className="sr-only" />
                  </label>
                  <p className="text-xs text-slate-500">Ảnh JPG, PNG, WEBP, GIF hoặc HEIC; tối đa 5MB.</p>
                  {newsImagePreview && (
                    <div className="flex flex-wrap items-start gap-3">
                      <img src={newsImagePreview} alt="Xem trước ảnh tin tức" className="max-h-48 rounded-xl border border-slate-200 object-contain" />
                      <button type="button" onClick={clearNewsImage} className="text-sm font-semibold text-red-600 hover:underline">Gỡ ảnh</button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={useNewsSchedule}
                      onChange={e => setUseNewsSchedule(e.target.checked)}
                    />
                    <Clock className="w-4 h-4" /> Hẹn ngày giờ đăng
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <input type="checkbox" checked={sendPushOnNews} onChange={e => setSendPushOnNews(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                  </label>
                </div>

                {useNewsSchedule && (
                  <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200 grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Ngày hẹn đăng (Giờ VN)</label>
                      <input required type="date" value={newsScheduleDate} onChange={e => setNewsScheduleDate(e.target.value)} className="w-full border bg-white px-3 py-2 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Giờ hẹn đăng (Giờ VN)</label>
                      <input required type="time" value={newsScheduleTime} onChange={e => setNewsScheduleTime(e.target.value)} className="w-full border bg-white px-3 py-2 rounded-xl text-sm" />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button disabled={uploadingNews} className="bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-semibold disabled:opacity-60">
                    {uploadingNews ? (newsImageFile ? 'Đang tải ảnh và đăng tin...' : 'Đang đăng tin...') : useNewsSchedule ? 'Lưu hẹn giờ đăng tin' : 'Đăng bài viết ngay'}
                  </button>
                </div>
              </form>

              {scheduledNewsDrafts.length > 0 && (
                <div className="space-y-2.5">
                  <h2 className="text-sm font-extrabold uppercase text-amber-800">
                    Tin tức hẹn giờ / đã đặt lịch ({scheduledNewsDrafts.length}) — Bấm Xóa để gỡ ngay
                  </h2>
                  {scheduledNewsDrafts.map((item) => (
                    <div key={`news-sch-${item.id}`} className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 flex justify-between items-start gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-bold text-amber-800">
                          ⏰ {item.isScheduledPending ? `Đang hẹn: ${item.publishLabel}` : `Đã tới giờ hẹn (${item.publishLabel})`}
                        </div>
                        <div className="font-bold text-slate-800">{item.title}</div>
                        <p className="text-xs text-slate-600 whitespace-pre-line">{item.cleanContent}</p>
                        {item.image_url && <img src={item.image_url} alt={item.title} className="max-h-40 rounded-xl border object-contain" />}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncementRow(item.id, item.title)}
                        className="text-red-600 hover:bg-red-100 bg-white border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                        title="Xóa bài hẹn giờ này"
                      >
                        <Trash2 className="w-4 h-4" /> Xóa
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {news.map(n => {
                  const parsed = parseNewsContent(n.content);
                  return (
                    <div key={n.id} className="bg-white p-4 rounded-xl border flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="font-bold">{n.title}</div>
                        <p className="text-sm text-slate-600 whitespace-pre-line">{parsed.content}</p>
                        {parsed.imageUrl && <img src={parsed.imageUrl} alt={n.title} className="max-h-40 rounded-xl border object-contain" />}
                        <button
                          type="button"
                          onClick={() => handleCopyPostLink('news', n)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition"
                        >
                          {copiedKey === `news-${n.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedKey === `news-${n.id}` ? 'Đã sao chép link Zalo' : 'Sao chép link gửi Zalo'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNewsRow(n.id, n.title)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0"
                        title="Xóa bài viết"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {adminTab === 'events' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Quản lý Lịch sinh hoạt cộng đồng</h1>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const pubMs = useEvtSchedule ? parseVietnamScheduledMs(evtPublishDate, evtPublishTime) : 0;
                const packedDesc = useEvtSchedule && pubMs
                  ? `${SCHEDULE_META_PREFIX}${JSON.stringify({ publishAtMs: pubMs, publishLabel: `${evtPublishDate} ${evtPublishTime} (GMT+7)`, sendPush: sendPushOnEvent, pushedDone: pubMs <= Date.now() + 15000 })}\n${evtForm.description || ''}`
                  : (evtForm.description || '');
                const payload = {
                  title: evtForm.title,
                  event_date: evtForm.event_date,
                  event_time: evtForm.event_time,
                  location: evtForm.location,
                  category: evtForm.category,
                  description: packedDesc,
                };
                const { data: insertedRows, error } = await supabase.from('events').insert([payload]).select();
                if (!error) {
                  const created = insertedRows?.[0];
                  const isFutureSch = Boolean(useEvtSchedule && pubMs > Date.now() + 15000);
                  let msg = isFutureSch
                    ? `Đã hẹn giờ đăng lịch lúc ${evtPublishDate} ${evtPublishTime} (GMT+7)!`
                    : 'Đã thêm lịch sinh hoạt!';
                  if (!isFutureSch && sendPushOnEvent) {
                    const pushRes = await dispatchOneSignalPush({
                      heading: `Lịch sinh hoạt – ${appSettings.village_name}`,
                      content: `${evtForm.title} (${evtForm.event_time} ngày ${evtForm.event_date})`,
                      launchUrl: created ? getPostShareUrl('events', created.id) : siteUrl,
                      target: 'all',
                    });
                    msg = formatPushResultMessage('Đã thêm lịch sinh hoạt!', pushRes);
                  }
                  const nextLater = getVietnamDateTimeInputs(5);
                  setEvtForm({ title: '', event_date: '', event_time: '19:30', location: appSettings.cultural_house_name, category: 'Họp dân', description: '' });
                  setUseEvtSchedule(false);
                  setEvtPublishDate(nextLater.dateStr);
                  setEvtPublishTime(nextLater.timeStr);
                  fetchPublicData();
                  showToast(msg, 6000);
                } else showToast('Lỗi: ' + error.message);
              }} className="bg-white p-6 rounded-2xl border space-y-3">
                <div className="grid md:grid-cols-3 gap-3">
                  <input required placeholder="Tên sự kiện / cuộc họp" value={evtForm.title} onChange={e => setEvtForm({ ...evtForm, title: e.target.value })} className="border px-3 py-2 rounded-xl" />
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Ngày diễn ra lịch</label>
                    <input required type="date" value={evtForm.event_date} onChange={e => setEvtForm({ ...evtForm, event_date: e.target.value })} className="w-full border px-3 py-2 rounded-xl text-sm" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">Giờ diễn ra</label>
                    <input placeholder="Giờ (VD: 19:30)" value={evtForm.event_time} onChange={e => setEvtForm({ ...evtForm, event_time: e.target.value })} className="w-full border px-3 py-2 rounded-xl text-sm" />
                  </div>
                  <input placeholder="Địa điểm" value={evtForm.location} onChange={e => setEvtForm({ ...evtForm, location: e.target.value })} className="border px-3 py-2 rounded-xl md:col-span-2" />
                  <button className="bg-emerald-700 text-white rounded-xl font-semibold py-2">+ Đăng lịch</button>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <input
                      type="checkbox"
                      checked={useEvtSchedule}
                      onChange={e => setUseEvtSchedule(e.target.checked)}
                    />
                    <Clock className="w-4 h-4" /> Hẹn ngày giờ đăng tin lịch
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <input type="checkbox" checked={sendPushOnEvent} onChange={e => setSendPushOnEvent(e.target.checked)} /> Đẩy chuông báo tới điện thoại bà con
                  </label>
                </div>

                {useEvtSchedule && (
                  <div className="bg-amber-50/80 p-3 rounded-xl border border-amber-200 grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Ngày hẹn đăng tin lịch (Giờ VN)</label>
                      <input required type="date" value={evtPublishDate} onChange={e => setEvtPublishDate(e.target.value)} className="w-full border bg-white px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">Giờ hẹn đăng tin lịch (Giờ VN)</label>
                      <input required type="time" value={evtPublishTime} onChange={e => setEvtPublishTime(e.target.value)} className="w-full border bg-white px-3 py-1.5 rounded-xl text-xs" />
                    </div>
                  </div>
                )}
              </form>

              <div className="space-y-2">
                {events.map(ev => {
                  const info = parseEventInfo(ev);
                  return (
                    <div key={ev.id} className="bg-white p-4 rounded-xl border flex justify-between items-center">
                      <div>
                        <div className="font-bold">{ev.title}</div>
                        <div className="text-sm text-slate-500">{ev.event_date} • {ev.event_time} • {ev.location}</div>
                        {info.publishLabel && <div className="text-[11px] text-emerald-700 mt-0.5">Hẹn đăng: {info.publishLabel}</div>}
                      </div>
                      <button onClick={async () => { await supabase.from('events').delete().eq('id', ev.id); fetchPublicData(); }} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {adminTab === 'finance' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">Quản lý Ủng hộ & Công khai Thu – Chi</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Mỗi lần đăng mới, hệ thống tự động gửi thông báo chuông tới điện thoại bà con.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      exportCSV(
                        'danh-sach-ung-ho-thon-an-son.csv',
                        donationItems.map((d) => ({
                          Ho_ten: d.name,
                          Xom_don_vi: d.role_or_group,
                          So_tien_VND: d.amount,
                          Hien_vat: d.in_kind,
                          Dot_van_dong: d.detail,
                          Ngay: d.date,
                          Ghi_chu: d.note,
                        }))
                      )
                    }
                    className="bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Xuất Excel Ủng hộ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportCSV(
                        'cong-khai-thu-chi-thon-an-son.csv',
                        ledgerItems.map((l) => ({
                          Loai: l.entryType === 'chi' ? 'Chi' : 'Thu',
                          Noi_dung: l.name,
                          So_tien_VND: l.amount,
                          Quy_dot: l.detail,
                          Ngay: l.date,
                          Ghi_chu: l.note,
                        }))
                      )
                    }
                    className="bg-sky-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Xuất Excel Thu – Chi
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
                  <div className="text-xs font-bold uppercase text-emerald-700">Tổng thu & Ủng hộ tiền mặt</div>
                  <div className="text-2xl font-extrabold text-emerald-800 mt-1">{formatVND(totalCombinedThu)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Ủng hộ: {formatVND(totalDonatedMoney)} • Thu khác: {formatVND(totalLedgerThu)}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm">
                  <div className="text-xs font-bold uppercase text-rose-700">Tổng đã chi</div>
                  <div className="text-2xl font-extrabold text-rose-700 mt-1">{formatVND(totalLedgerChi)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{ledgerItems.filter((l) => l.entryType === 'chi').length} khoản chi đã công khai</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm">
                  <div className="text-xs font-bold uppercase text-sky-700">Số dư quỹ hiện còn</div>
                  <div className="text-2xl font-extrabold text-sky-800 mt-1">{formatVND(currentFundBalance)}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Tự động cập nhật khi thêm/sửa</div>
                </div>
              </div>

              <div className="bg-white p-5 md:p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg text-emerald-900 flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5 text-rose-600" />
                    {editingDonationId ? 'Chỉnh sửa thông tin người ủng hộ' : '+ Đăng người dân / mạnh thường quân ủng hộ'}
                  </h2>
                  {editingDonationId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDonationId(null);
                        setSendPushOnDonation(true);
                        setDonationForm({
                          donor_name: '',
                          area_or_org: '',
                          amount: '',
                          in_kind: '',
                          campaign: 'Vận động xây dựng & hoạt động thôn',
                          date: getVietnamDateTimeInputs(0).dateStr,
                          note: '',
                        });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Hủy sửa
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveDonation} className="grid md:grid-cols-3 gap-3">
                  <input
                    required
                    placeholder="Họ và tên người ủng hộ / Gia đình *"
                    value={donationForm.donor_name}
                    onChange={e => setDonationForm({ ...donationForm, donor_name: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Xóm / Khu vực / Đơn vị (VD: Xóm 1)"
                    value={donationForm.area_or_org}
                    onChange={e => setDonationForm({ ...donationForm, area_or_org: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Số tiền ủng hộ (VNĐ, VD: 500000)"
                    value={donationForm.amount}
                    onChange={e => setDonationForm({ ...donationForm, amount: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Hiện vật ủng hộ (nếu có, VD: 5 bao xi măng)"
                    value={donationForm.in_kind}
                    onChange={e => setDonationForm({ ...donationForm, in_kind: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Đợt vận động / Mục đích"
                    value={donationForm.campaign}
                    onChange={e => setDonationForm({ ...donationForm, campaign: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="date"
                    value={donationForm.date}
                    onChange={e => setDonationForm({ ...donationForm, date: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Ghi chú thêm (tùy chọn)"
                    value={donationForm.note}
                    onChange={e => setDonationForm({ ...donationForm, note: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm md:col-span-3"
                  />
                  <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                      <input
                        type="checkbox"
                        checked={sendPushOnDonation}
                        onChange={e => setSendPushOnDonation(e.target.checked)}
                      />
                      Đẩy chuông báo tới điện thoại bà con
                    </label>
                    <button
                      disabled={savingFinance}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl px-6 py-2.5 text-sm disabled:opacity-60"
                    >
                      {savingFinance ? 'Đang lưu...' : editingDonationId ? 'Cập nhật ủng hộ' : '+ Đăng công khai ủng hộ'}
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-xs uppercase text-slate-600">
                      <tr>
                        <th className="p-3">Người ủng hộ</th>
                        <th className="p-3">Xóm / Đơn vị</th>
                        <th className="p-3">Số tiền / Hiện vật</th>
                        <th className="p-3">Đợt vận động</th>
                        <th className="p-3">Ngày</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400 text-xs">Chưa có dữ liệu người ủng hộ nào.</td>
                        </tr>
                      ) : (
                        donationItems.map((d) => (
                          <tr key={d.id} className="border-b last:border-0 hover:bg-slate-50/70">
                            <td className="p-3 font-bold text-slate-800">{d.name}</td>
                            <td className="p-3 text-slate-600">{d.role_or_group || '—'}</td>
                            <td className="p-3">
                              {d.amount > 0 && <div className="font-bold text-emerald-700">{formatVND(d.amount)}</div>}
                              {d.in_kind && <div className="text-xs text-amber-700 font-medium">+ {d.in_kind}</div>}
                              {d.amount === 0 && !d.in_kind && <span className="text-slate-400">0 đ</span>}
                            </td>
                            <td className="p-3 text-xs text-slate-600">{d.detail}</td>
                            <td className="p-3 text-xs text-slate-500">{d.date}</td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEditDonation(d)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg"
                                title="Sửa dòng này"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Xóa khoản ủng hộ của "${d.name}"?`)) {
                                    await supabase.from('custom_list_items').delete().eq('id', d.id);
                                    fetchPublicData();
                                  }
                                }}
                                className="inline-flex items-center text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white p-5 md:p-6 rounded-2xl border border-sky-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg text-sky-900 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-sky-700" />
                    {editingLedgerId ? 'Chỉnh sửa khoản Thu – Chi' : '+ Đăng công khai khoản Thu – Chi'}
                  </h2>
                  {editingLedgerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLedgerId(null);
                        setSendPushOnLedger(true);
                        setLedgerForm({
                          type: 'thu',
                          title: '',
                          amount: '',
                          date: getVietnamDateTimeInputs(0).dateStr,
                          campaign: 'Quỹ vận động thôn An Sơn',
                          note: '',
                        });
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      Hủy sửa
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveLedger} className="grid md:grid-cols-3 gap-3">
                  <select
                    value={ledgerForm.type}
                    onChange={e => setLedgerForm({ ...ledgerForm, type: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                  >
                    <option value="thu">Khoản THU (+)</option>
                    <option value="chi">Khoản CHI (-)</option>
                  </select>
                  <input
                    required
                    placeholder="Nội dung khoản thu / chi *"
                    value={ledgerForm.title}
                    onChange={e => setLedgerForm({ ...ledgerForm, title: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm md:col-span-2"
                  />
                  <input
                    required
                    type="number"
                    min={0}
                    placeholder="Số tiền (VNĐ) *"
                    value={ledgerForm.amount}
                    onChange={e => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Nguồn quỹ / Đợt hoạt động"
                    value={ledgerForm.campaign}
                    onChange={e => setLedgerForm({ ...ledgerForm, campaign: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    type="date"
                    value={ledgerForm.date}
                    onChange={e => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm"
                  />
                  <input
                    placeholder="Chứng từ / Người thực hiện / Ghi chú"
                    value={ledgerForm.note}
                    onChange={e => setLedgerForm({ ...ledgerForm, note: e.target.value })}
                    className="border px-3.5 py-2.5 rounded-xl text-sm md:col-span-3"
                  />
                  <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 text-sm font-semibold text-sky-900">
                      <input
                        type="checkbox"
                        checked={sendPushOnLedger}
                        onChange={e => setSendPushOnLedger(e.target.checked)}
                      />
                      Đẩy chuông báo tới điện thoại bà con
                    </label>
                    <button
                      disabled={savingFinance}
                      className="bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl px-6 py-2.5 text-sm disabled:opacity-60"
                    >
                      {savingFinance ? 'Đang lưu...' : editingLedgerId ? 'Cập nhật Thu – Chi' : '+ Đăng công khai Thu – Chi'}
                    </button>
                  </div>
                </form>

                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-xs uppercase text-slate-600">
                      <tr>
                        <th className="p-3">Loại</th>
                        <th className="p-3">Nội dung khoản thu / chi</th>
                        <th className="p-3">Số tiền</th>
                        <th className="p-3">Quỹ / Đợt</th>
                        <th className="p-3">Ngày</th>
                        <th className="p-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400 text-xs">Chưa có khoản thu chi nào được đăng tải.</td>
                        </tr>
                      ) : (
                        ledgerItems.map((l) => (
                          <tr key={l.id} className="border-b last:border-0 hover:bg-slate-50/70">
                            <td className="p-3">
                              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${l.entryType === 'chi' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                                {l.entryType === 'chi' ? 'CHI' : 'THU'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{l.name}</div>
                              {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
                            </td>
                            <td className={`p-3 font-bold ${l.entryType === 'chi' ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {l.entryType === 'chi' ? '-' : '+'}{formatVND(l.amount)}
                            </td>
                            <td className="p-3 text-xs text-slate-600">{l.detail}</td>
                            <td className="p-3 text-xs text-slate-500">{l.date}</td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleStartEditLedger(l)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg"
                                title="Sửa dòng này"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`Xóa khoản "${l.name}"?`)) {
                                    await supabase.from('custom_list_items').delete().eq('id', l.id);
                                    fetchPublicData();
                                  }
                                }}
                                className="inline-flex items-center text-red-500 hover:bg-red-50 p-1.5 rounded-lg"
                                title="Xóa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'settings' && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold text-slate-800">Cài đặt hệ thống & Ghim Nhà văn hóa</h1>
              <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border shadow-sm space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên hiển thị của thôn</label>
                    <input
                      required
                      value={settingsForm.village_name}
                      onChange={e => setSettingsForm({ ...settingsForm, village_name: e.target.value })}
                      className="w-full border px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dòng địa danh phụ</label>
                    <input
                      required
                      value={settingsForm.subtitle}
                      onChange={e => setSettingsForm({ ...settingsForm, subtitle: e.target.value })}
                      className="w-full border px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h2 className="font-bold text-emerald-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Thiết lập điểm ghim Nhà văn hóa thôn An Sơn trên bản đồ
                  </h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên địa điểm ghim</label>
                      <input
                        required
                        value={settingsForm.cultural_house_name}
                        onChange={e => setSettingsForm({ ...settingsForm, cultural_house_name: e.target.value })}
                        className="w-full border px-4 py-2.5 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Từ khóa tìm kiếm bản đồ</label>
                      <input
                        value={settingsForm.cultural_house_query}
                        onChange={e => setSettingsForm({ ...settingsForm, cultural_house_query: e.target.value })}
                        placeholder="Nhà văn hóa thôn An Sơn, Cam Lộ, Quảng Trị"
                        className="w-full border px-4 py-2.5 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Vĩ độ (Latitude – ghim tọa độ chính xác)</label>
                      <input
                        value={settingsForm.cultural_house_lat}
                        onChange={e => setSettingsForm({ ...settingsForm, cultural_house_lat: e.target.value })}
                        placeholder="Ví dụ: 16.74527"
                        className="w-full border px-4 py-2.5 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Kinh độ (Longitude – ghim tọa độ chính xác)</label>
                      <input
                        value={settingsForm.cultural_house_lng}
                        onChange={e => setSettingsForm({ ...settingsForm, cultural_house_lng: e.target.value })}
                        placeholder="Ví dụ: 106.9635"
                        className="w-full border px-4 py-2.5 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú điểm ghim</label>
                    <input
                      value={settingsForm.cultural_house_note}
                      onChange={e => setSettingsForm({ ...settingsForm, cultural_house_note: e.target.value })}
                      className="w-full border px-4 py-2.5 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Khẩu hiệu / Mô tả trang công khai</label>
                  <input
                    value={settingsForm.public_notice}
                    onChange={e => setSettingsForm({ ...settingsForm, public_notice: e.target.value })}
                    className="w-full border px-4 py-2.5 rounded-xl text-sm"
                  />
                </div>

                <div className="flex justify-end">
                  <button disabled={savingSettings} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 py-2.5 rounded-xl">
                    {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
                  </button>
                </div>
              </form>
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

          {adminTab === 'feedbacks' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold">Phản ánh & Góp ý từ bà con (Nội bộ)</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Chỉ người đăng nhập Quản trị mới nhận chuông báo và xem được danh sách này.</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 bg-white p-1 rounded-xl border text-xs font-semibold">
                  {[
                    { id: 'all', label: `Tất cả (${feedbackListSource.length})` },
                    { id: 'suggestion', label: `Góp ý (${feedbackListSource.filter(isSuggestionRecord).length})` },
                    { id: 'feedback', label: `Phản ánh (${feedbackListSource.filter(fb => !isSuggestionRecord(fb)).length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFeedbackFilter(f.id)}
                      className={`px-3 py-1.5 rounded-lg transition ${feedbackFilter === f.id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowResolvedFeedback(value => !value)}
                    aria-pressed={showResolvedFeedback}
                    className={`px-3 py-1.5 rounded-lg transition ${showResolvedFeedback ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {showResolvedFeedback ? 'Đang xử lý' : `Kho lưu trữ (${resolvedFeedbacks.length})`}
                  </button>
                </div>
              </div>

              {filteredFeedbackList.length === 0 && (
                <p className="text-slate-500 text-sm">
                  {showResolvedFeedback ? 'Kho lưu trữ chưa có nội dung đã phản hồi trong nhóm này.' : 'Không có phản ánh hoặc góp ý đang xử lý trong nhóm này.'}
                </p>
              )}
              {filteredFeedbackList.map(fb => {
                const isSug = isSuggestionRecord(fb);
                const displayCat = isSug ? fb.category.replace(/^\[GÓP Ý\]\s*/, '') : fb.category;
                const parsedFeedback = parseFeedbackContent(fb.content);
                const isDeletingThis = deletingFeedbackId === fb.id;
                return (
                  <div key={fb.id} className={`bg-white p-5 rounded-2xl border space-y-2 ${isSug ? 'border-l-4 border-l-emerald-600' : 'border-l-4 border-l-amber-500'}`}>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${isSug ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {isSug ? 'GÓP Ý XÂY DỰNG THÔN' : 'PHẢN ÁNH KIẾN NGHỊ'}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{displayCat}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={fb.status} onChange={(e) => handleFeedbackStatusChange(fb.id, e.target.value)} className="border rounded-lg px-2 py-1 text-xs">
                          <option value="received">Đã tiếp nhận</option>
                          <option value="reviewing">Đang xem xét</option>
                          <option value="resolved">Đã phản hồi / Xử lý</option>
                        </select>
                        <button
                          type="button"
                          disabled={isDeletingThis}
                          onClick={() => handleDeleteFeedback(fb)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
                          title={isSug ? 'Xóa góp ý này' : 'Xóa phản ánh này'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {isDeletingThis ? 'Đang xóa...' : 'Xóa'}
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-800 whitespace-pre-line">{parsedFeedback.content}</p>
                    {parsedFeedback.attachments.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="text-xs font-bold text-slate-700">Tệp đính kèm</div>
                        <div className="flex flex-wrap gap-2">
                          {parsedFeedback.attachments.map((attachment, index) => (
                            <button
                              key={`${attachment.path}-${index}`}
                              type="button"
                              onClick={() => handleDownloadFeedbackAttachment(attachment)}
                              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
                            >
                              <Download className="h-4 w-4 shrink-0" />
                              <span className="truncate">{attachment.name || 'Tải tệp đính kèm'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                      <strong>Người gửi:</strong> {fb.sender_name || 'Ẩn danh'} • <strong>Liên hệ / Khu vực:</strong> {fb.sender_phone || 'Không cung cấp'} • <span className="text-slate-400">{new Date(fb.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                );
              })}
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

                      {allPublishedNews.slice(0, showAllHomeNews ? allPublishedNews.length : 1).map((n, index) => {
                        const isFirstNewsToggle = index === 0 && allPublishedNews.length > 1;
                        return (
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
                            <h3 className="font-bold text-slate-800 text-base leading-snug">
                              <button
                                type="button"
                                onClick={() => isFirstNewsToggle ? setShowAllHomeNews(value => !value) : navigatePublic('feed', 'news')}
                                aria-expanded={isFirstNewsToggle ? showAllHomeNews : undefined}
                                title={isFirstNewsToggle ? (showAllHomeNews ? 'Bấm để thu gọn danh sách tin tức' : 'Bấm để xem tất cả tin tức') : 'Mở mục tin tức'}
                                className="flex w-full items-center justify-between gap-2 text-left hover:text-emerald-700"
                              >
                                <span>{n.title}</span>
                                {isFirstNewsToggle && (
                                  <span className="shrink-0 text-xs font-semibold text-teal-700">
                                    {showAllHomeNews ? 'Thu gọn' : 'Xem tất cả'}
                                  </span>
                                )}
                              </button>
                            </h3>
                            <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-line">{n.content}</p>
                            {n.image_url && <img src={n.image_url} alt={n.title} className="w-full max-h-40 object-contain rounded-xl border border-slate-100 bg-slate-50" />}
                          </div>
                        );
                      })}
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
                      onClick={() => {
                        setFeedSubTab(f.id);
                        setFeedNewsSectionIndex(0);
                      }}
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
                    {allPublishedNews.map((n) => (
                      <div key={n.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-medium">{n.category}</span>
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
                        <h3 className="font-bold text-lg text-slate-800">{n.title}</h3>
                        <p className="text-slate-600 whitespace-pre-line text-sm">{n.content}</p>
                        {n.image_url && (
                          <a href={n.image_url} target="_blank" rel="noreferrer" className="block pt-1">
                            <img src={n.image_url} alt={n.title} className="w-full max-h-96 object-contain rounded-xl border border-slate-100 bg-slate-50" />
                          </a>
                        )}
                        {n.video_url && (
                          <a href={n.video_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-sky-700 font-semibold underline">
                            ▶ Xem video hoạt động
                          </a>
                        )}
                      </div>
                    ))}
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
