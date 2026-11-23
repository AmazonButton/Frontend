import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  CheckSquare,
  Cpu,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';
import {
  isAllocatedDevice,
  isUnassignedWarehouseDevice,
  resolveCustodyStoreId,
  resolveCustodyStoreMeta,
} from '../../utils/device-custody';

export interface BulkCsvRowInput {
  rowId: string;
  deviceId: string;
  buttonCode: string;
  serialNumber: string;
  macAddress: string;
  buttonName: string;
}

export interface BulkCsvValidatedRow extends BulkCsvRowInput {
  errors: string[];
  isValid: boolean;
}

export const SAMPLE_BULK_CSV = [
  'deviceId,buttonCode,serialNumber,macAddress,buttonName',
  'SOB-202601,BTN-2026-01,SN-9901,AA:BB:CC:DD:EE:01,Nut Bam Nuoc 01',
  'SOB-202602,BTN-2026-02,SN-9902,AA:BB:CC:DD:EE:02,Nut Bam Nuoc 02',
].join('\n');

const BULK_CODE_REGEX = /^[A-Za-z0-9_-]{3,50}$/;
const BULK_MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

const splitCsvLine = (line: string, delimiter: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
};

const normalizeCsvHeaderKey = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[\s_-]+/g, '');

export function parseBulkCsvText(rawText: string): BulkCsvRowInput[] {
  const cleaned = String(rawText || '').replace(/^\uFEFF/, '');
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const firstCells = splitCsvLine(firstLine, delimiter).map(normalizeCsvHeaderKey);
  const headerAliases: Record<string, keyof Omit<BulkCsvRowInput, 'rowId'>> = {
    deviceid: 'deviceId',
    madid: 'deviceId',
    buttoncode: 'buttonCode',
    code: 'buttonCode',
    serialnumber: 'serialNumber',
    serial: 'serialNumber',
    macaddress: 'macAddress',
    mac: 'macAddress',
    buttonname: 'buttonName',
    customname: 'buttonName',
    name: 'buttonName',
  };

  const colMap: Partial<Record<keyof Omit<BulkCsvRowInput, 'rowId'>, number>> = {};
  let hasHeader = false;
  firstCells.forEach((key, idx) => {
    const target = headerAliases[key];
    if (target) {
      hasHeader = true;
      if (colMap[target] === undefined) {
        colMap[target] = idx;
      }
    }
  });

  const dataLines = hasHeader ? lines.slice(1) : lines;
  return dataLines.map((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    const getCell = (field: keyof Omit<BulkCsvRowInput, 'rowId'>, fallbackIndex: number) => {
      const idx = hasHeader ? colMap[field] : fallbackIndex;
      return idx !== undefined && cells[idx] !== undefined ? cells[idx].trim() : '';
    };
    return {
      rowId: `csv-row-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
      deviceId: getCell('deviceId', 0),
      buttonCode: getCell('buttonCode', 1),
      serialNumber: getCell('serialNumber', 2),
      macAddress: getCell('macAddress', 3),
      buttonName: getCell('buttonName', 4),
    };
  });
}

export function validateBulkCsvRows(rows: BulkCsvRowInput[]): BulkCsvValidatedRow[] {
  const deviceIdCounts = new Map<string, number>();
  const buttonCodeCounts = new Map<string, number>();

  for (const row of rows) {
    const devKey = row.deviceId.trim().toUpperCase();
    const codeKey = row.buttonCode.trim().toUpperCase();
    if (devKey) {
      deviceIdCounts.set(devKey, (deviceIdCounts.get(devKey) || 0) + 1);
    }
    if (codeKey) {
      buttonCodeCounts.set(codeKey, (buttonCodeCounts.get(codeKey) || 0) + 1);
    }
  }

  return rows.map((row) => {
    const errors: string[] = [];
    const dev = row.deviceId.trim();
    const code = row.buttonCode.trim();
    const mac = row.macAddress.trim();

    if (!dev && !code) {
      errors.push('Cần nhập tối thiểu Mã thiết bị (deviceId) hoặc Mã nút (buttonCode).');
    }
    if (dev) {
      if (!BULK_CODE_REGEX.test(dev)) {
        errors.push('Mã thiết bị chỉ gồm chữ, số, _, - (3-50 ký tự).');
      }
      if ((deviceIdCounts.get(dev.toUpperCase()) || 0) > 1) {
        errors.push(`Trùng Mã thiết bị (${dev.toUpperCase()}) trong danh sách.`);
      }
    }
    if (code) {
      if (!BULK_CODE_REGEX.test(code)) {
        errors.push('Mã nút chỉ gồm chữ, số, _, - (3-50 ký tự).');
      }
      if ((buttonCodeCounts.get(code.toUpperCase()) || 0) > 1) {
        errors.push(`Trùng Mã nút (${code.toUpperCase()}) trong danh sách.`);
      }
    }
    if (mac && !BULK_MAC_REGEX.test(mac)) {
      errors.push('Địa chỉ MAC không hợp lệ (định dạng XX:XX:XX:XX:XX:XX).');
    }

    return {
      ...row,
      errors,
      isValid: errors.length === 0,
    };
  });
}

export interface PlatformDevicesWorkspaceProps {
  unassignedDevices?: any[];
  allDevices?: any[];
  stores?: any[];
  onRefresh?: () => Promise<void> | void;
}

const PAGE_SIZE = 20;
const STORE_PAGE_SIZE = 50;

const isCanceledRequest = (err: any, signal: AbortSignal): boolean =>
  signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';

export const PlatformDevicesWorkspace: React.FC<PlatformDevicesWorkspaceProps> = ({
  unassignedDevices: initialUnassigned,
  allDevices: initialDevices,
  stores: initialStores = [],
  onRefresh,
}) => {
  // Server-paginated Unassigned Warehouse state
  const [unassignedList, setUnassignedList] = useState<any[]>(() =>
    Array.isArray(initialUnassigned) ? initialUnassigned.filter(isUnassignedWarehouseDevice) : []
  );
  const [unassignedPage, setUnassignedPage] = useState(1);
  const [unassignedTotal, setUnassignedTotal] = useState(() =>
    Array.isArray(initialUnassigned) ? initialUnassigned.length : 0
  );
  const [unassignedTotalPages, setUnassignedTotalPages] = useState(1);
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);

  // Server-paginated Allocated Devices state (keyed on custodyStoreId & inventoryState)
  const [allocatedDevices, setAllocatedDevices] = useState<any[]>(() =>
    Array.isArray(initialDevices) ? initialDevices.filter(isAllocatedDevice) : []
  );
  const [allocatedPage, setAllocatedPage] = useState(1);
  const [allocatedTotal, setAllocatedTotal] = useState(() =>
    Array.isArray(initialDevices) ? initialDevices.filter(isAllocatedDevice).length : 0
  );
  const [allocatedTotalPages, setAllocatedTotalPages] = useState(1);
  const [deviceStoreFilter, setDeviceStoreFilter] = useState<string>('ALL');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState<string>('');
  const [loadingAllocated, setLoadingAllocated] = useState(false);

  // Server-paginated & server-searchable Stores state (distinguishes valid empty [] from load errors)
  const [serverStores, setServerStores] = useState<any[]>(initialStores);
  const [storePage, setStorePage] = useState(1);
  const [storeTotalPages, setStoreTotalPages] = useState(1);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [storeTotal, setStoreTotal] = useState(initialStores.length);
  const [storeLoadedOnce, setStoreLoadedOnce] = useState(false);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState('');

  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [batchPrefix, setBatchPrefix] = useState('BTN');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
  const [resetDeviceIdInput, setResetDeviceIdInput] = useState('');
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);

  const [showBulkCsvModal, setShowBulkCsvModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkCsvRowInput[]>([]);
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [bulkImportError, setBulkImportError] = useState('');
  const [bulkImportResult, setBulkImportResult] = useState<{
    count: number;
    message: string;
  } | null>(null);

  const unassignedAbortRef = useRef<AbortController | null>(null);
  const unassignedGenRef = useRef(0);
  const allocatedAbortRef = useRef<AbortController | null>(null);
  const allocatedGenRef = useRef(0);
  const storesAbortRef = useRef<AbortController | null>(null);
  const storesGenRef = useRef(0);
  const storeLoadedOnceRef = useRef(storeLoadedOnce);
  storeLoadedOnceRef.current = storeLoadedOnce;
  const initialStoresRef = useRef(initialStores);
  initialStoresRef.current = initialStores;
  const storeBucketsCacheRef = useRef<{
    allocated: any[];
    stores: any[];
    value: { storeId: string; storeName: string; storeCode: string; devices: any[] }[];
  } | null>(null);

  const loadUnassigned = useCallback(async () => {
    unassignedAbortRef.current?.abort();
    const controller = new AbortController();
    unassignedAbortRef.current = controller;
    const gen = ++unassignedGenRef.current;

    setLoadingUnassigned(true);
    try {
      const res = await api.get('/devices/unassigned', {
        params: {
          page: unassignedPage,
          pageSize: PAGE_SIZE,
          ...(unassignedSearch.trim() ? { search: unassignedSearch.trim() } : {}),
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || gen !== unassignedGenRef.current) return;
      if (res.data?.success && Array.isArray(res.data.data)) {
        const items = res.data.data.filter(isUnassignedWarehouseDevice);
        const p = res.data.pagination || {};
        const rawTotal = p.totalItems ?? p.total;
        const total = rawTotal !== undefined && Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : items.length;
        setUnassignedList(items);
        setUnassignedTotal(total);
        setUnassignedTotalPages(
          Math.max(1, Number(p.totalPages) || Math.ceil(total / PAGE_SIZE) || 1)
        );
      }
    } catch (err) {
      if (isCanceledRequest(err, controller.signal) || gen !== unassignedGenRef.current) return;
    } finally {
      if (gen === unassignedGenRef.current) {
        setLoadingUnassigned(false);
      }
    }
  }, [unassignedPage, unassignedSearch]);

  const loadAllocated = useCallback(async () => {
    allocatedAbortRef.current?.abort();
    const controller = new AbortController();
    allocatedAbortRef.current = controller;
    const gen = ++allocatedGenRef.current;

    setLoadingAllocated(true);
    try {
      const res = await api.get('/devices', {
        params: {
          page: allocatedPage,
          pageSize: PAGE_SIZE,
          allocatedOnly: 'true',
          ...(deviceStoreFilter !== 'ALL' ? { custodyStoreId: deviceStoreFilter } : {}),
          ...(deviceSearchQuery.trim() ? { search: deviceSearchQuery.trim() } : {}),
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || gen !== allocatedGenRef.current) return;
      if (res.data?.success && Array.isArray(res.data.data)) {
        const items = res.data.data.filter(isAllocatedDevice);
        const p = res.data.pagination || {};
        const rawTotal = p.totalItems ?? p.total;
        const total = rawTotal !== undefined && Number.isFinite(Number(rawTotal)) ? Number(rawTotal) : items.length;
        setAllocatedDevices(items);
        setAllocatedTotal(total);
        setAllocatedTotalPages(
          Math.max(1, Number(p.totalPages) || Math.ceil(total / PAGE_SIZE) || 1)
        );
      }
    } catch (err) {
      if (isCanceledRequest(err, controller.signal) || gen !== allocatedGenRef.current) return;
    } finally {
      if (gen === allocatedGenRef.current) {
        setLoadingAllocated(false);
      }
    }
  }, [allocatedPage, deviceStoreFilter, deviceSearchQuery]);

  const loadStores = useCallback(async () => {
    storesAbortRef.current?.abort();
    const controller = new AbortController();
    storesAbortRef.current = controller;
    const gen = ++storesGenRef.current;

    setLoadingStores(true);
    setStoresError('');
    try {
      const res = await api.get('/stores', {
        params: {
          page: storePage,
          pageSize: STORE_PAGE_SIZE,
          ...(storeSearchQuery.trim() ? { search: storeSearchQuery.trim() } : {}),
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || gen !== storesGenRef.current) return;
      if (res.data?.success && Array.isArray(res.data.data)) {
        const rows = res.data.data;
        setServerStores(rows);
        setStoreLoadedOnce(true);
        const p = res.data.pagination || {};
        const rawTotal = p.totalItems ?? p.total;
        const total =
          rawTotal !== undefined && Number.isFinite(Number(rawTotal))
            ? Number(rawTotal)
            : rows.length;
        setStoreTotal(total);
        setStoreTotalPages(
          Math.max(1, Number(p.totalPages) || Math.ceil(total / STORE_PAGE_SIZE) || 1)
        );
      }
    } catch (err: any) {
      if (isCanceledRequest(err, controller.signal) || gen !== storesGenRef.current) return;
      setStoresError(
        err?.response?.data?.message || err?.message || 'Không tải được danh sách cửa hàng.'
      );
      if (!storeLoadedOnceRef.current && !storeSearchQuery.trim() && initialStoresRef.current.length > 0) {
        setServerStores(initialStoresRef.current);
      }
    } finally {
      if (gen === storesGenRef.current) {
        setLoadingStores(false);
      }
    }
  }, [storePage, storeSearchQuery]);

  useEffect(() => {
    void loadUnassigned();
    return () => {
      unassignedAbortRef.current?.abort();
    };
  }, [loadUnassigned]);

  useEffect(() => {
    void loadAllocated();
    return () => {
      allocatedAbortRef.current?.abort();
    };
  }, [loadAllocated]);

  useEffect(() => {
    void loadStores();
    return () => {
      storesAbortRef.current?.abort();
    };
  }, [loadStores]);

  const refreshAll = async () => {
    await Promise.all([loadUnassigned(), loadAllocated(), loadStores()]);
    if (onRefresh) await onRefresh();
  };

  const stores = storeLoadedOnce ? serverStores : initialStores;

  const toggleDeviceSelect = (devId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDeviceIds.length === unassignedList.length && unassignedList.length > 0) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(unassignedList.map((d) => d.deviceId));
    }
  };

  const handleBatchGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingBatch(true);
    try {
      const res = await api.post('/devices/batch-generate', {
        count: Number(batchCount),
        prefix: batchPrefix.trim().toUpperCase(),
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Tạo lô nút bấm thành công');
        setShowBatchModal(false);
        setUnassignedPage(1);
        await refreshAll();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tạo lô nút bấm');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleAllocateDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) {
      toast.warning('Vui lòng chọn cửa hàng cần cấp phát nút');
      return;
    }
    if (selectedDeviceIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 nút bấm từ kho');
      return;
    }

    const selectedStore = stores.find(
      (store) => String(store.id || store.storeId) === selectedStoreId
    );
    if (!selectedStore || (selectedStore.status && selectedStore.status !== 'ACTIVE')) {
      toast.warning('Chỉ có thể bàn giao thiết bị cho cửa hàng đang hoạt động.');
      return;
    }

    setIsProcessingBatch(true);
    try {
      const res = await api.post('/devices/allocate-store', {
        storeId: selectedStoreId,
        deviceIds: selectedDeviceIds,
      });
      if (res.data?.success) {
        setShowAllocateModal(false);
        setSelectedDeviceIds([]);
        setAllocatedPage(1);
        toast.success(res.data.message || 'Cấp phát nút bấm thành công!');
        await refreshAll();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cấp phát nút');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleFactoryReset = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const targetId = resetDeviceIdInput.trim();
    if (!targetId) {
      toast.warning('Vui lòng nhập hoặc chọn mã thiết bị cần khôi phục xuất xưởng');
      return;
    }

    setIsFactoryResetting(true);
    try {
      const res = await api.post(`/devices/${encodeURIComponent(targetId)}/factory-reset`);
      if (res.data?.success) {
        toast.success(
          res.data.message || `Đã khôi phục cài đặt gốc nút [${targetId}] thành công!`
        );
        setShowFactoryResetModal(false);
        setResetDeviceIdInput('');
        await refreshAll();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể khôi phục cài đặt gốc thiết bị');
    } finally {
      setIsFactoryResetting(false);
    }
  };

  const validatedBulkRows = validateBulkCsvRows(bulkRows);
  const invalidBulkCount = validatedBulkRows.filter((row) => !row.isValid).length;
  const validBulkCount = validatedBulkRows.length - invalidBulkCount;
  const exceedsBulkLimit = validatedBulkRows.length > 500;

  const openBulkCsvModal = () => {
    setBulkImportError('');
    setBulkImportResult(null);
    setShowBulkCsvModal(true);
  };

  const applyBulkCsvText = (rawText: string) => {
    setBulkCsvText(rawText);
    setBulkRows(parseBulkCsvText(rawText));
    setBulkImportError('');
    setBulkImportResult(null);
  };

  const handleBulkCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content =
        typeof file.text === 'function'
          ? await file.text()
          : await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(new Error('Không đọc được tệp CSV'));
              reader.readAsText(file);
            });
      applyBulkCsvText(content);
    } catch (err: any) {
      setBulkImportError(err?.message || 'Không thể đọc tệp CSV được chọn.');
    }
  };

  const handleDownloadBulkCsvTemplate = () => {
    if (
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function'
    ) {
      const blob = new Blob([SAMPLE_BULK_CSV], { type: 'text/csv;charset=utf-8;' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'iot-buttons-import-template.csv';
      anchor.click();
      URL.revokeObjectURL?.(href);
      return;
    }
    applyBulkCsvText(SAMPLE_BULK_CSV);
  };

  const handleUpdateBulkRowField = (
    rowId: string,
    field: keyof Omit<BulkCsvRowInput, 'rowId'>,
    value: string
  ) => {
    setBulkImportError('');
    setBulkImportResult(null);
    setBulkRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveBulkRow = (rowId: string) => {
    setBulkImportError('');
    setBulkImportResult(null);
    setBulkRows((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleRemoveInvalidBulkRows = () => {
    const validIds = new Set(validatedBulkRows.filter((r) => r.isValid).map((r) => r.rowId));
    setBulkImportError('');
    setBulkImportResult(null);
    setBulkRows((prev) => prev.filter((row) => validIds.has(row.rowId)));
  };

  const handleAddBlankBulkRow = () => {
    setBulkImportError('');
    setBulkImportResult(null);
    setBulkRows((prev) => [
      ...prev,
      {
        rowId: `csv-row-manual-${Date.now()}-${prev.length + 1}`,
        deviceId: '',
        buttonCode: '',
        serialNumber: '',
        macAddress: '',
        buttonName: '',
      },
    ]);
  };

  const handleSubmitBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImportingBulk) return;
    if (validatedBulkRows.length === 0) {
      setBulkImportError('Vui lòng tải hoặc nhập ít nhất 1 dòng thiết bị hợp lệ.');
      return;
    }
    if (exceedsBulkLimit) {
      setBulkImportError('Tối đa 500 dòng mỗi lần nhập CSV. Vui lòng tách thành nhiều đợt.');
      return;
    }
    if (invalidBulkCount > 0) {
      setBulkImportError(
        `Còn ${invalidBulkCount} dòng lỗi hoặc trùng lặp. Hãy sửa trực tiếp hoặc loại bỏ dòng lỗi trước khi gửi.`
      );
      return;
    }

    setIsImportingBulk(true);
    setBulkImportError('');
    setBulkImportResult(null);
    try {
      const payloadRows = validatedBulkRows.map((r) => {
        const item: Record<string, string> = {};
        if (r.deviceId.trim()) item.deviceId = r.deviceId.trim().toUpperCase();
        if (r.buttonCode.trim()) item.buttonCode = r.buttonCode.trim().toUpperCase();
        if (r.serialNumber.trim()) item.serialNumber = r.serialNumber.trim();
        if (r.macAddress.trim()) item.macAddress = r.macAddress.trim().toUpperCase();
        if (r.buttonName.trim()) item.buttonName = r.buttonName.trim();
        return item;
      });
      const res = await api.post('/devices/bulk-import', { rows: payloadRows });
      if (res.data?.success) {
        const importedCount = Number(res.data?.count ?? payloadRows.length);
        const message =
          res.data?.message || `Đã nhập thành công ${importedCount} nút bấm vào kho hệ thống.`;
        setBulkImportResult({ count: importedCount, message });
        toast.success(message);
        setUnassignedPage(1);
        await refreshAll();
      } else {
        setBulkImportError(res.data?.message || 'Máy chủ không xác nhận nhập lô CSV.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || 'Không thể nhập lô CSV. Dữ liệu đã được giữ lại để kiểm tra.';
      setBulkImportError(msg);
      toast.error(msg);
    } finally {
      setIsImportingBulk(false);
    }
  };

  const storeBuckets = (() => {
    const cached = storeBucketsCacheRef.current;
    if (cached && cached.allocated === allocatedDevices && cached.stores === stores) {
      return cached.value;
    }
    const map = new Map<
      string,
      { storeId: string; storeName: string; storeCode: string; devices: any[] }
    >();
    for (const d of allocatedDevices) {
      const { storeId: sid, storeName, storeCode } = resolveCustodyStoreMeta(d, stores);
      if (!sid) continue;
      if (!map.has(sid)) {
        map.set(sid, { storeId: sid, storeName, storeCode, devices: [] });
      }
      map.get(sid)!.devices.push(d);
    }
    const nextValue = Array.from(map.values());
    storeBucketsCacheRef.current = { allocated: allocatedDevices, stores, value: nextValue };
    return nextValue;
  })();

  const visibleAllocated = allocatedDevices;
  const selectableIds = visibleAllocated
    .filter((d) => !d.customerId)
    .map((d) => d.deviceId);
  const allAllocatedSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedDeviceIds.includes(id));

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="admin-toolbar flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Kho Nút Bấm Trống & Bàn Giao Đại Lý</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {unassignedTotal} nút chưa phân bổ
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Tạo lô thiết bị mới, phân bổ cho cửa hàng và khôi phục thiết bị xuất xưởng.
            </p>
          </div>
        </div>

        <div className="admin-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-medium shadow-sm flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Tạo Lô Nút Bấm Mới</span>
          </button>
          <button
            type="button"
            onClick={openBulkCsvModal}
            className="px-3.5 py-2 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 dark:text-sky-300 text-xs font-medium shadow-xs flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Nhập lô CSV</span>
          </button>
          <button
            type="button"
            disabled={selectedDeviceIds.length === 0}
            onClick={() => setShowAllocateModal(true)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              selectedDeviceIds.length > 0
                ? 'bg-[#0E6BA8] hover:bg-[#0B5586] text-white shadow-sm active:scale-[0.97] cursor-pointer'
                : 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed dark:bg-zinc-800/40 dark:border-zinc-800 dark:text-zinc-600'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Cấp Phát Cho Cửa Hàng ({selectedDeviceIds.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setResetDeviceIdInput('');
              setShowFactoryResetModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-medium flex items-center gap-1.5 active:scale-[0.97] transition-all cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục cài đặt gốc</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Trang {unassignedPage}/{unassignedTotalPages} · Tổng trong kho:{' '}
          <strong>{unassignedTotal}</strong> thiết bị chưa phân bổ.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={unassignedSearch}
            onChange={(e) => {
              setUnassignedSearch(e.target.value);
              setUnassignedPage(1);
            }}
            placeholder="Tìm nút trong kho (mã / tên)..."
            aria-label="Tìm nút chưa phân bổ"
            className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8]"
          />
          <button
            type="button"
            disabled={loadingUnassigned}
            onClick={() => void loadUnassigned()}
            aria-label="Tải lại kho trống"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-[#0E6BA8] cursor-pointer disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingUnassigned ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {unassignedList.length === 0 ? (
        <div className="p-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
          <Boxes className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {unassignedSearch.trim() ? 'Không tìm thấy nút phù hợp trong kho trống' : 'Kho nút tổng đang trống'}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Nhấn nút <strong className="text-zinc-700 dark:text-zinc-300">"Tạo Lô Nút Bấm Mới"</strong>{' '}
            để nạp mã thiết bị vào hệ thống.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            tabIndex={0}
            role="region"
            aria-label="Danh sách nút bấm trong kho"
            className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg"
          >
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-[10px]">
                <tr>
                  <th scope="col" className="py-2.5 px-3 w-10">
                    <button
                      type="button"
                      aria-label="Chọn tất cả thiết bị"
                      onClick={toggleSelectAll}
                      className="flex items-center cursor-pointer"
                    >
                      {selectedDeviceIds.length === unassignedList.length &&
                      unassignedList.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#0E6BA8]" />
                      ) : (
                        <Square className="w-4 h-4 text-zinc-600" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="py-2.5 px-3">Mã thiết bị</th>
                  <th scope="col" className="py-2.5 px-3">Số sê-ri</th>
                  <th scope="col" className="py-2.5 px-3">Mã ghép nối</th>
                  <th scope="col" className="py-2.5 px-3">Tên kết nối</th>
                  <th scope="col" className="py-2.5 px-3">Trạng thái</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {unassignedList.map((dev) => {
                const isSelected = selectedDeviceIds.includes(dev.deviceId);
                return (
                  <tr
                    key={dev.id || dev.deviceId}
                    onClick={() => toggleDeviceSelect(dev.deviceId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-100/70 dark:bg-zinc-800/60'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-850/40'
                    }`}
                  >
                    <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-label={`Chọn thiết bị ${dev.deviceId}`}
                        aria-pressed={isSelected}
                        onClick={() => toggleDeviceSelect(dev.deviceId)}
                        className="cursor-pointer"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0E6BA8]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-600" />
                        )}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                        {dev.deviceId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-[11px]">
                      {dev.serialNumber}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-800 dark:text-zinc-200 font-bold">
                      {dev.pairingCode || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                      <span className="text-[11px] font-sans text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                        SOB-{dev.deviceId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Trong Kho Trống
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setResetDeviceIdInput(dev.deviceId);
                          setShowFactoryResetModal(true);
                        }}
                        className="px-2 py-1 rounded text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/50 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Khôi phục cài đặt gốc</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {unassignedTotalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                Trang {unassignedPage} / {unassignedTotalPages} · Tổng {unassignedTotal} nút
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingUnassigned || unassignedPage <= 1}
                  onClick={() => setUnassignedPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={loadingUnassigned || unassignedPage >= unassignedTotalPages}
                  onClick={() => setUnassignedPage((p) => Math.min(unassignedTotalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>Nút Bấm Đã Cấp Cho Cửa Hàng</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-[#0E6BA8] dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {allocatedTotal} nút
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Theo dõi các nút đang nằm tại kho cửa hàng theo custodyStoreId và trạng thái tồn kho.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={deviceSearchQuery}
              onChange={(e) => {
                setDeviceSearchQuery(e.target.value);
                setAllocatedPage(1);
              }}
              placeholder="Tìm mã nút, cửa hàng..."
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8]"
            />
            <input
              type="text"
              value={storeSearchQuery}
              onChange={(e) => {
                setStoreSearchQuery(e.target.value);
                setStorePage(1);
              }}
              placeholder="Tìm cửa hàng (tên/mã)..."
              aria-label="Tìm cửa hàng trên máy chủ"
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8]"
            />
            <select
              value={deviceStoreFilter}
              onChange={(e) => {
                setDeviceStoreFilter(e.target.value);
                setAllocatedPage(1);
              }}
              aria-label="Lọc nút theo cửa hàng"
              className="px-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8] max-w-md"
            >
              <option value="ALL">Tất cả cửa hàng ({allocatedTotal} nút)</option>
              {stores.map((store) => {
                const sid = String(store.id || store.storeId);
                const storeDevs = allocatedDevices.filter((d) => resolveCustodyStoreId(d) === sid);
                const codesPreview = storeDevs.slice(0, 3).map((d) => d.deviceId).join(', ');
                const suffix =
                  storeDevs.length > 0
                    ? ` — ${storeDevs.length} nút trên trang (${codesPreview}${storeDevs.length > 3 ? ', ...' : ''})`
                    : '';
                return (
                  <option key={sid} value={sid}>
                    {store.name || store.storeName} ({store.code || store.storeCode || `#${sid}`}){suffix}
                  </option>
                );
              })}
            </select>
            {storeTotalPages > 1 && (
              <div className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                <button
                  type="button"
                  disabled={loadingStores || storePage <= 1}
                  onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                  aria-label="Trang cửa hàng trước"
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  ‹
                </button>
                <span>{storePage}/{storeTotalPages}</span>
                <button
                  type="button"
                  disabled={loadingStores || storePage >= storeTotalPages}
                  onClick={() => setStorePage((p) => Math.min(storeTotalPages, p + 1))}
                  aria-label="Trang cửa hàng sau"
                  className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>

        {storeBuckets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {storeBuckets.map((b) => {
              const isActive = deviceStoreFilter === b.storeId;
              const availableCount = b.devices.filter((d) => !d.customerId).length;
              return (
                <button
                  key={b.storeId}
                  type="button"
                  onClick={() => {
                    setDeviceStoreFilter(isActive ? 'ALL' : b.storeId);
                    setAllocatedPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                    isActive
                      ? 'border-[#0E6BA8] bg-sky-50 text-[#0E6BA8] dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <span className="max-w-[180px] truncate font-medium">{b.storeName}</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-sky-100 dark:bg-sky-950/60 text-[#0E6BA8] dark:text-sky-300">
                    {b.devices.length} nút
                  </span>
                  <span className="text-[10px] text-zinc-400">({availableCount} trống)</span>
                </button>
              );
            })}
          </div>
        )}

        {visibleAllocated.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-8 text-center text-xs text-zinc-500">
            Chưa có nút bấm nào phù hợp bộ lọc đang ở cửa hàng.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th scope="col" className="py-2.5 px-3 w-10">
                      <button
                        type="button"
                        aria-label="Chọn tất cả nút chưa gắn khách"
                        disabled={selectableIds.length === 0}
                        onClick={() => {
                          if (allAllocatedSelected) {
                            setSelectedDeviceIds((prev) =>
                              prev.filter((id) => !selectableIds.includes(id))
                            );
                          } else {
                            setSelectedDeviceIds((prev) =>
                              Array.from(new Set([...prev, ...selectableIds]))
                            );
                          }
                        }}
                        className="flex items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {allAllocatedSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0E6BA8]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 font-medium">Mã Thiết Bị</th>
                    <th className="py-2.5 px-3 font-medium">Cửa Hàng Đang Giữ</th>
                    <th className="py-2.5 px-3 font-medium">Khách Hàng</th>
                    <th className="py-2.5 px-3 font-medium">Trạng Thái</th>
                    <th className="py-2.5 px-3 font-medium text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {visibleAllocated.map((dev) => {
                    const { storeName, storeCode } = resolveCustodyStoreMeta(dev, stores);
                    const canSelect = !dev.customerId;
                    const isSelected = selectedDeviceIds.includes(dev.deviceId);
                  return (
                    <tr
                      key={dev.id || dev.deviceId}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-sky-50/60 dark:bg-sky-950/20'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-850/40'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          disabled={!canSelect}
                          onClick={() => toggleDeviceSelect(dev.deviceId)}
                          aria-label={`Chọn nút ${dev.deviceId}`}
                          className="flex items-center cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#0E6BA8]" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-500" />
                          )}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                        <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                          {dev.deviceId}
                        </span>
                        {dev.buttonCode && (
                          <div className="mt-1 text-[10px] font-mono font-normal text-zinc-500 dark:text-zinc-400">
                            {dev.buttonCode}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-800 dark:text-zinc-200">
                        <span className="font-medium">{storeName}</span>
                        {storeCode && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {storeCode}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                        {dev.customer?.fullName ||
                          (dev.customerId ? `Khách #${dev.customerId}` : 'Chưa gắn khách')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            dev.status === 'ACTIVE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {dev.status === 'ACTIVE'
                            ? 'Đang hoạt động'
                            : dev.status === 'INACTIVE'
                              ? 'Chưa kích hoạt'
                              : dev.status || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setResetDeviceIdInput(dev.deviceId);
                            setShowFactoryResetModal(true);
                          }}
                          className="px-2 py-1 rounded text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200/60 dark:border-rose-900/50 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Khôi phục về kho</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {allocatedTotalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                Trang {allocatedPage} / {allocatedTotalPages} · Tổng {allocatedTotal} nút đã cấp
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingAllocated || allocatedPage <= 1}
                  onClick={() => setAllocatedPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={loadingAllocated || allocatedPage >= allocatedTotalPages}
                  onClick={() => setAllocatedPage((p) => Math.min(allocatedTotalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Batch Generate Modal */}
      {createPortal(
        <AnimatePresence>
          {showBatchModal && (
            <div className="admin-ui admin-modal fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain responsive-modal overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowBatchModal(false)}
                className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center">
                    <Boxes className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Tạo Lô Nút Bấm Mới
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Sinh mã serial, mã ghép nối & kho nút chưa phân bổ
                    </p>
                  </div>
                </div>
                <form onSubmit={handleBatchGenerate} className="space-y-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Số lượng nút bấm
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      required
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tiền tố mã thiết bị
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={batchPrefix}
                      onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                      placeholder="BTN"
                      className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isProcessingBatch}
                      onClick={() => setShowBatchModal(false)}
                      className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingBatch}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-[#0E6BA8] hover:bg-[#0B5586] rounded-lg cursor-pointer shadow-sm"
                    >
                      {isProcessingBatch ? 'Đang tạo...' : 'Xác Nhận Tạo Lô Nút'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Allocate Modal */}
      {createPortal(
        <AnimatePresence>
          {showAllocateModal && (
            <div className="admin-ui admin-modal fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain responsive-modal overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAllocateModal(false)}
                className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      Cấp Phát Nút Cho Cửa Hàng
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Bàn giao <strong>{selectedDeviceIds.length}</strong> nút bấm đã chọn
                    </p>
                  </div>
                </div>
                <form onSubmit={handleAllocateDevices} className="space-y-3 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Chọn Cửa Hàng nhận bàn giao nút (Trang {storePage}/{storeTotalPages} · {stores.length}/{storeTotal} cửa hàng)
                    </label>
                    <input
                      type="text"
                      value={storeSearchQuery}
                      onChange={(e) => {
                        setStoreSearchQuery(e.target.value);
                        setStorePage(1);
                      }}
                      placeholder="Tìm cửa hàng theo tên hoặc mã trên máy chủ..."
                      className="mb-2 w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-[#0E6BA8]"
                    />
                    {storesError && (
                      <p className="mb-2 text-[11px] text-rose-600 dark:text-rose-400">
                        {storesError}
                      </p>
                    )}
                    <select
                      required
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900"
                    >
                      <option value="">
                        {stores.length === 0 && storeLoadedOnce
                          ? '-- Không có cửa hàng khớp từ khóa --'
                          : '-- Chọn Cửa Hàng --'}
                      </option>
                      {stores
                        .filter((store) => !store.status || store.status === 'ACTIVE')
                        .map((store) => {
                          const sId = store.id || store.storeId;
                          return (
                            <option key={sId} value={sId}>
                              {store.name} ({store.code}) -{' '}
                              {store.ownerName || store.owner?.fullName || 'Chủ shop'}
                            </option>
                          );
                        })}
                    </select>
                    {storeTotalPages > 1 && (
                      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>Trang cửa hàng {storePage}/{storeTotalPages}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={loadingStores || storePage <= 1}
                            onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                            className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            Trước
                          </button>
                          <button
                            type="button"
                            disabled={loadingStores || storePage >= storeTotalPages}
                            onClick={() => setStorePage((p) => Math.min(storeTotalPages, p + 1))}
                            className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="max-h-36 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-wrap gap-1.5 text-[11px]">
                    {selectedDeviceIds.map((id) => (
                      <span
                        key={id}
                        className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-medium"
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isProcessingBatch}
                      onClick={() => setShowAllocateModal(false)}
                      className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isProcessingBatch}
                      className="px-4 py-1.5 text-xs font-medium text-white bg-[#0E6BA8] hover:bg-[#0B5586] rounded-lg cursor-pointer shadow-sm"
                    >
                      {isProcessingBatch ? 'Đang bàn giao...' : 'Xác Nhận Bàn Giao'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Factory Reset Modal */}
      {createPortal(
        <AnimatePresence>
          {showFactoryResetModal && (
            <div className="admin-ui admin-modal fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain responsive-modal overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isFactoryResetting && setShowFactoryResetModal(false)}
                className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="relative z-10 bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
              >
                <div className="flex items-center space-x-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800 shrink-0">
                    <RotateCcw className="w-5 h-5 stroke-[2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Khôi phục cài đặt gốc
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Thu hồi thiết bị về trạng thái xuất xưởng
                    </p>
                  </div>
                </div>
                <form onSubmit={handleFactoryReset} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                      Mã thiết bị
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: BTN-1891001"
                      value={resetDeviceIdInput}
                      onChange={(e) => setResetDeviceIdInput(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-xs font-bold border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:border-[#0E6BA8]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isFactoryResetting}
                      onClick={() => setShowFactoryResetModal(false)}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isFactoryResetting}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                    >
                      {isFactoryResetting ? 'Đang khôi phục...' : 'Xác Nhận Khôi Phục'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {showBulkCsvModal && (
            <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isImportingBulk && setShowBulkCsvModal(false)}
                className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                aria-label="Nhập lô thiết bị từ CSV"
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10"
              >
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#0E6BA8]" />
                      <span>Nhập Lô Nút Bấm Từ CSV (Xem Trước & Sửa Lỗi)</span>
                    </h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Hỗ trợ cột <code className="font-mono">deviceId, buttonCode, serialNumber, macAddress, buttonName</code> (tối đa 500 dòng/lần). Dòng trùng hoặc sai định dạng sẽ được tô đỏ để sửa tại chỗ.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isImportingBulk}
                    onClick={() => setShowBulkCsvModal(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmitBulkImport} className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Chọn tệp .CSV</span>
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleBulkCsvFileUpload}
                          className="sr-only"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleDownloadBulkCsvTemplate}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Tải file mẫu CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => applyBulkCsvText(SAMPLE_BULK_CSV)}
                        className="px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/30 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100 cursor-pointer"
                      >
                        Điền nhanh dữ liệu mẫu
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        Tổng: {validatedBulkRows.length}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Hợp lệ: {validBulkCount}
                      </span>
                      {invalidBulkCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          Lỗi: {invalidBulkCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                      Dán nội dung CSV (hoặc chỉnh từ tệp đã tải lên)
                    </label>
                    <textarea
                      rows={4}
                      value={bulkCsvText}
                      onChange={(e) => applyBulkCsvText(e.target.value)}
                      placeholder={'deviceId,buttonCode,serialNumber,macAddress,buttonName\nSOB-202601,BTN-2026-01,SN-9901,AA:BB:CC:DD:EE:01,Nut Bam 01'}
                      className="w-full px-3 py-2 text-xs font-mono border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:border-[#0E6BA8]"
                    />
                  </div>

                  {bulkImportError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{bulkImportError}</span>
                    </div>
                  )}

                  {bulkImportResult && (
                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {bulkImportResult.message} (Đã thêm {bulkImportResult.count} thiết bị).
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                        Bảng xem trước & chỉnh sửa từng dòng
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddBlankBulkRow}
                          className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          + Thêm dòng
                        </button>
                        {invalidBulkCount > 0 && (
                          <button
                            type="button"
                            onClick={handleRemoveInvalidBulkRows}
                            className="px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-[11px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                          >
                            Loại bỏ dòng lỗi ({invalidBulkCount})
                          </button>
                        )}
                      </div>
                    </div>

                    {validatedBulkRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 py-6 text-center text-xs text-zinc-500">
                        Chưa có dòng dữ liệu nào. Hãy chọn tệp CSV, dán nội dung CSV hoặc bấm "Điền nhanh dữ liệu mẫu".
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-zinc-50 dark:bg-zinc-800/70 text-[11px] text-zinc-500 sticky top-0 z-10">
                            <tr>
                              <th className="py-2 px-2.5 w-8">#</th>
                              <th className="py-2 px-2">deviceId</th>
                              <th className="py-2 px-2">buttonCode</th>
                              <th className="py-2 px-2">serialNumber</th>
                              <th className="py-2 px-2">macAddress</th>
                              <th className="py-2 px-2">buttonName</th>
                              <th className="py-2 px-2">Kiểm tra</th>
                              <th className="py-2 px-2 w-10 text-right">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {validatedBulkRows.map((row, idx) => (
                              <tr
                                key={row.rowId}
                                className={
                                  row.isValid
                                    ? 'bg-white dark:bg-zinc-900'
                                    : 'bg-rose-50/70 dark:bg-rose-950/25'
                                }
                              >
                                <td className="py-1.5 px-2.5 font-mono text-[11px] text-zinc-400">
                                  {idx + 1}
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={row.deviceId}
                                    onChange={(e) =>
                                      handleUpdateBulkRowField(row.rowId, 'deviceId', e.target.value)
                                    }
                                    placeholder="SOB-..."
                                    aria-label={`Dòng ${idx + 1} deviceId`}
                                    className="w-28 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px] uppercase"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={row.buttonCode}
                                    onChange={(e) =>
                                      handleUpdateBulkRowField(row.rowId, 'buttonCode', e.target.value)
                                    }
                                    placeholder="BTN-..."
                                    aria-label={`Dòng ${idx + 1} buttonCode`}
                                    className="w-28 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px] uppercase"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={row.serialNumber}
                                    onChange={(e) =>
                                      handleUpdateBulkRowField(row.rowId, 'serialNumber', e.target.value)
                                    }
                                    placeholder="SN-..."
                                    className="w-24 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px]"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={row.macAddress}
                                    onChange={(e) =>
                                      handleUpdateBulkRowField(row.rowId, 'macAddress', e.target.value)
                                    }
                                    placeholder="AA:BB:..."
                                    className="w-32 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono text-[11px] uppercase"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="text"
                                    value={row.buttonName}
                                    onChange={(e) =>
                                      handleUpdateBulkRowField(row.rowId, 'buttonName', e.target.value)
                                    }
                                    placeholder="Tên gợi nhớ"
                                    className="w-32 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[11px]"
                                  />
                                </td>
                                <td className="py-1.5 px-2 min-w-[180px]">
                                  {row.isValid ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Hợp lệ
                                    </span>
                                  ) : (
                                    <div className="space-y-0.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                      {row.errors.map((errText, errIdx) => (
                                        <p key={errIdx}>{errText}</p>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBulkRow(row.rowId)}
                                    title="Xóa dòng này"
                                    className="p-1 rounded text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={isImportingBulk}
                      onClick={() => setShowBulkCsvModal(false)}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={
                        isImportingBulk ||
                        validBulkCount === 0 ||
                        invalidBulkCount > 0 ||
                        exceedsBulkLimit
                      }
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#0E6BA8] hover:bg-[#0B5586] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isImportingBulk
                        ? 'Đang nhập kho...'
                        : `Xác Nhận Nhập ${validBulkCount} Thiết Bị`}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
