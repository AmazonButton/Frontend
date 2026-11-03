export function getGooglePopupError(error: { type?: string; error?: string; error_description?: string }): string {
  if (error.type === 'popup_failed_to_open') return 'Không mở được cửa sổ Google. Vui lòng cho phép popup cho trang này rồi thử lại.';
  if (error.type === 'popup_closed') return 'Bạn đã đóng cửa sổ Google trước khi hoàn tất đăng nhập. Vui lòng thử lại.';
  if (error.error === 'access_denied') return 'Bạn chưa cấp quyền đăng nhập Google. Vui lòng thử lại và xác nhận quyền truy cập.';
  return error.error_description || 'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.';
}

export function getGoogleLoginError(error: any): string {
  const message = error?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && message.every((value) => typeof value === 'string') && message.length) return message.join('; ');
  if (error?.response?.status === 409) return 'Máy chủ chưa thể đăng nhập Google do xung đột thông tin tài khoản (409). Nếu đã có tài khoản, hãy thử đăng nhập bằng email và mật khẩu đã đăng ký hoặc liên hệ hỗ trợ.';
  if (error?.response?.status === 401) return error?.response?.data?.message || 'Máy chủ từ chối xác thực Google (401). Vui lòng thử đăng nhập lại.';
  return typeof error?.message === 'string' && error.message ? error.message : 'Không thể xác thực với Google. Vui lòng thử lại.';
}
