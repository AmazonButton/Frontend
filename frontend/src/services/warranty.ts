export type WarrantyFaultGroup = 'GROUP_A' | 'GROUP_B' | 'GROUP_C' | 'GROUP_D';

export type WarrantyTicketStatus = 'PENDING' | 'APPROVED_SWAP' | 'RESOLVED' | 'REJECTED';

export interface WarrantyFaultOption {
  code: string;
  label: string;
  description: string;
}

export interface WarrantyGroupConfig {
  id: WarrantyFaultGroup;
  title: string;
  shortLabel: string;
  deductionMin: number;
  deductionMax: number;
  defaultDeduction: number;
  customerPolicy: string;
  storeAdminPolicy: string;
  badgeClass: string;
  faults: WarrantyFaultOption[];
}

export const WARRANTY_GROUPS: Record<WarrantyFaultGroup, WarrantyGroupConfig> = {
  GROUP_A: {
    id: 'GROUP_A',
    title: 'Nhóm A: Lỗi Tự Nhiên & Kỹ Thuật (Bảo hành miễn phí 100%)',
    shortLabel: 'Nhóm A · Miễn phí 0%',
    deductionMin: 0,
    deductionMax: 0,
    defaultDeduction: 0,
    customerPolicy: 'Đổi mới 1-1 miễn phí 100%, giữ nguyên 100% tiền cọc.',
    storeAdminPolicy: 'Store gom nút lỗi/hết pin gửi lại Admin; Admin cấp bù nút mới vào kho Store miễn phí.',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    faults: [
      { code: 'LOW_BATTERY', label: 'Pin yếu / Chai pin (< 15%)', description: 'Pin tụt nhanh hoặc báo pin yếu tự nhiên sau 6-12 tháng.' },
      { code: 'BUTTON_STUCK', label: 'Liệt nút / Lờn lò xo / Kẹt nút', description: 'Phím bấm không nảy, kẹt phím hoặc không nhận thao tác nhấn.' },
      { code: 'HARDWARE_FAULT', label: 'Lỗi mạch / LED / Buzzer / Wi-Fi', description: 'Hỏng linh kiện phần cứng, không lên đèn hoặc mất kết nối mạch.' },
    ],
  },
  GROUP_B: {
    id: 'GROUP_B',
    title: 'Nhóm B: Sự Cố Mạng & Trẻ Em (Hỗ trợ từ xa 0đ — Không đổi nút)',
    shortLabel: 'Nhóm B · Hỗ trợ 0đ',
    deductionMin: 0,
    deductionMax: 0,
    defaultDeduction: 0,
    customerPolicy: 'Miễn phí 100% (0đ): Hỗ trợ cấu hình lại Wi-Fi qua BLE hoặc bật Khóa Trẻ Em / tăng giữ nút 2s.',
    storeAdminPolicy: 'Không phát sinh chi phí phần cứng giữa Store và Admin.',
    badgeClass: 'bg-sky-50 text-[#0E6BA8] border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    faults: [
      { code: 'WIFI_CHANGED', label: 'Đổi mật khẩu Wi-Fi / Đổi Router', description: 'Nút nháy đèn đỏ mất kết nối do đổi mạng Wi-Fi gia đình.' },
      { code: 'CHILD_SPAM_DETECTED', label: 'Trẻ em bấm phá liên tục', description: 'Cần bật Khóa Trẻ Em từ xa hoặc tăng thời gian nhấn giữ lên 2 giây.' },
    ],
  },
  GROUP_C: {
    id: 'GROUP_C',
    title: 'Nhóm C: Hư Hỏng Vật Lý Nhẹ Do Khách/Trẻ Em (Khấu trừ 30% cọc)',
    shortLabel: 'Nhóm C · Khấu trừ 30%',
    deductionMin: 30,
    deductionMax: 30,
    defaultDeduction: 30,
    customerPolicy: 'Đổi nút lành lặn cho khách dùng tiếp, khấu trừ 30% tiền cọc (30.000đ trên cọc 100.000đ).',
    storeAdminPolicy: 'Store chuyển 30.000đ phí thay vỏ nhựa ABS/PC về Admin để thay vỏ mới.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    faults: [
      { code: 'TIER_C_SHELL_CRACK_30%', label: 'Rơi vỡ / Nứt vỏ nhựa ngoài', description: 'Vỏ ngoài nứt vỡ nhưng mạch ESP32-S3 bên trong vẫn hoạt động.' },
    ],
  },
  GROUP_D: {
    id: 'GROUP_D',
    title: 'Nhóm D: Hư Hỏng Nặng / Mất Nút Do Lỗi Cư Dân (Khấu trừ 70%–100% cọc)',
    shortLabel: 'Nhóm D · Khấu trừ 70–100%',
    deductionMin: 70,
    deductionMax: 100,
    defaultDeduction: 100,
    customerPolicy: 'Khấu trừ 70%–100% tiền cọc (70.000đ–100.000đ). Khách dùng tiếp cần cọc lại để nhận nút mới.',
    storeAdminPolicy: 'Store chuyển tiền cọc đã khấu trừ về Admin; Admin khóa nút cũ và cấp nút mới cho Store.',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    faults: [
      { code: 'WATER_DAMAGE', label: 'Rơi nước / Ngâm nước ngập mạch', description: 'Nút bị vào nước gây chập, oxy hóa bo mạch.' },
      { code: 'FIRE_HEAT_DAMAGE', label: 'Cháy nhựa / Cháy nổ pin do nhiệt', description: 'Đặt sát bếp gas hoặc nguồn nhiệt cao gây biến dạng, cháy pin.' },
      { code: 'PCB_CRUSHED', label: 'Đập nát bo mạch PCB', description: 'Tác động lực mạnh làm gãy/nát mạch điện tử bên trong.' },
      { code: 'DEVICE_LOST', label: 'Làm mất nút khi chuyển nhà / sử dụng', description: 'Không thu hồi được thiết bị vật lý.' },
    ],
  },
};

export interface WarrantyTicket {
  id: string;
  deviceId: string;
  storeId?: string;
  storeName?: string;
  faultGroup: WarrantyFaultGroup;
  faultCode: string;
  faultLabel: string;
  depositAmount: number;
  deductionPercent: number;
  deductionAmount: number;
  refundAmount: number;
  inspectionNote: string;
  status: WarrantyTicketStatus;
  reportedBy: string;
  reportedRole: string;
  replacementDeviceId?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'sob_warranty_tickets_v1';

export function calculateWarrantyDeduction(
  depositAmount: number,
  group: WarrantyFaultGroup,
  customPercent?: number
): { percent: number; deductionAmount: number; refundAmount: number } {
  const cfg = WARRANTY_GROUPS[group];
  const rawPercent = customPercent !== undefined ? Number(customPercent) : cfg.defaultDeduction;
  const percent = Math.min(cfg.deductionMax, Math.max(cfg.deductionMin, Number.isFinite(rawPercent) ? rawPercent : cfg.defaultDeduction));
  const safeDeposit = Math.max(0, Number(depositAmount) || 0);
  const deductionAmount = Math.round((safeDeposit * percent) / 100);
  const refundAmount = Math.max(0, safeDeposit - deductionAmount);
  return { percent, deductionAmount, refundAmount };
}

export function loadWarrantyTickets(): WarrantyTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWarrantyTickets(tickets: WarrantyTicket[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    // Ignore storage quota errors
  }
}

export function createWarrantyTicket(input: {
  deviceId: string;
  storeId?: string;
  storeName?: string;
  faultGroup: WarrantyFaultGroup;
  faultCode: string;
  depositAmount?: number;
  deductionPercent?: number;
  inspectionNote?: string;
  reportedBy?: string;
  reportedRole?: string;
}): WarrantyTicket {
  const cfg = WARRANTY_GROUPS[input.faultGroup];
  const fault = cfg.faults.find((f) => f.code === input.faultCode) || cfg.faults[0];
  const depositAmount = Number(input.depositAmount) > 0 ? Number(input.depositAmount) : 100000;
  const { percent, deductionAmount, refundAmount } = calculateWarrantyDeduction(
    depositAmount,
    input.faultGroup,
    input.deductionPercent
  );
  const now = new Date().toISOString();
  const ticket: WarrantyTicket = {
    id: `WRT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    deviceId: input.deviceId.trim().toUpperCase(),
    storeId: input.storeId ? String(input.storeId) : undefined,
    storeName: input.storeName || undefined,
    faultGroup: input.faultGroup,
    faultCode: fault.code,
    faultLabel: fault.label,
    depositAmount,
    deductionPercent: percent,
    deductionAmount,
    refundAmount,
    inspectionNote: (input.inspectionNote || '').trim() || fault.description,
    status: 'PENDING',
    reportedBy: input.reportedBy || 'Nhân viên hệ thống',
    reportedRole: input.reportedRole || 'STAFF',
    createdAt: now,
    updatedAt: now,
  };
  const current = loadWarrantyTickets();
  saveWarrantyTickets([ticket, ...current]);
  return ticket;
}

export function updateWarrantyTicket(
  ticketId: string,
  patch: Partial<Pick<WarrantyTicket, 'status' | 'replacementDeviceId' | 'adminNote'>>
): WarrantyTicket[] {
  const current = loadWarrantyTickets();
  const next = current.map((t) =>
    t.id === ticketId
      ? {
          ...t,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
      : t
  );
  saveWarrantyTickets(next);
  return next;
}
