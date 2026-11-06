import React, { useRef, useState } from 'react';
import { Loader2, Unlink } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';
import { canRemoveDeviceProducts, createDeviceProductRemoval, hasDeviceProducts, type ProductRemovalDevice } from '../../services/device-product-removal';
import { WorkflowDialog, WorkflowNotice, workflowButton, workflowSecondary } from '../operations/WorkflowUI';

export const DeviceProductRemoval: React.FC<{ device: ProductRemovalDevice; role: string; disabled?: boolean; onRemoved: () => Promise<unknown> }> = ({ device, role, disabled, onRemoved }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(false);
  const submitting = useRef(false);
  const controller = useRef(createDeviceProductRemoval(api, device, role));
  if (!canRemoveDeviceProducts(role) || !hasDeviceProducts(device)) return null;
  const remove = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      if (await controller.current.run(onRemoved)) {
        toast.success(`Đã gỡ sản phẩm khỏi nút ${device.deviceId}.`);
        setOpen(false);
      }
    } catch (failure: any) {
      setRemoved(controller.current.removed);
      const message = failure?.response?.data?.message || failure?.message;
      setError(Array.isArray(message) ? message.join('. ') : message || 'Chưa thể hoàn tất thao tác. Vui lòng thử lại.');
    } finally { submitting.current = false; setBusy(false); }
  };
  return <div className="border-t border-slate-100 pt-4 dark:border-white/10">
    <button type="button" disabled={disabled || busy} onClick={() => { setOpen(true); setError(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"><Unlink className="h-4 w-4" />Gỡ sản phẩm khỏi nút</button>
    <WorkflowDialog open={open} title="Gỡ sản phẩm khỏi nút bấm?" description={`Thiết bị: ${device.deviceId}`} busy={busy} onClose={() => { if (!busy) setOpen(false); }}>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">Toàn bộ sản phẩm đang gán sẽ được gỡ khỏi nút này. Bạn cần gán lại sản phẩm trước khi dùng nút để đặt hàng.</p>
      {error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
      {removed && <WorkflowNotice>Lệnh gỡ đã được xử lý. Nút bên dưới chỉ tải và kiểm tra lại dữ liệu, không gửi thêm lệnh gỡ.</WorkflowNotice>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className={workflowSecondary}>Giữ nguyên</button><button type="button" disabled={busy} onClick={remove} className={`${workflowButton} bg-rose-600 hover:bg-rose-700`}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{busy ? 'Đang xử lý…' : removed ? 'Tải lại dữ liệu' : 'Xác nhận gỡ sản phẩm'}</button></div>
    </WorkflowDialog>
  </div>;
};
