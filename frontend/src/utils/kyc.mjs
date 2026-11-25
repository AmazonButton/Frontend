export const KYC_STATUS_META = {
  APPROVED: { label: 'Đã xác minh', tone: 'approved' },
  IN_REVIEW: { label: 'Chờ xem xét', tone: 'warning' },
  PENDING: { label: 'Đang chờ xác minh', tone: 'pending' },
  DECLINED: { label: 'Chưa đạt xác minh', tone: 'danger' },
  REJECTED: { label: 'Bị từ chối', tone: 'danger' },
  EXPIRED: { label: 'Đã hết hạn', tone: 'danger' },
  ABANDONED: { label: 'Đã hủy giữa chừng', tone: 'danger' },
  REVOKED: { label: 'Đã thu hồi', tone: 'danger' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
  UNVERIFIED: { label: 'Chưa xác minh', tone: 'pending' },
};

export function getKycStatusLabel(status) {
  const normalized = String(status || 'PENDING').toUpperCase();
  return KYC_STATUS_META[normalized]?.label || status || 'Đang cập nhật';
}

/**
 * @param {string | null | undefined} reviewReason
 * @param {Record<string, any> | null} [metadata]
 * @param {string | null} [fallbackExpectedName]
 */
export function getKycReviewReasonMeta(reviewReason, metadata = null, fallbackExpectedName = null) {
  const code = String(reviewReason || '').toUpperCase();
  const check = metadata?.identityCheck || {};
  const ocrName = metadata?.fullName || check?.ocrNormalized || null;
  const expectedName = check?.expectedNormalized || fallbackExpectedName || null;
  const docMasked = metadata?.documentNumberMasked || metadata?.documentNumber || null;

  switch (code) {
    case 'NAME_MISMATCH':
      return {
        code,
        title: 'Họ tên tài khoản không khớp với CCCD',
        description:
          ocrName && expectedName
            ? `Tên tài khoản (${expectedName}) không trùng khớp với họ tên trích xuất từ CCCD (${ocrName}). Vui lòng dùng đúng CCCD chính chủ hoặc chờ Quản trị viên xét duyệt.`
            : 'Họ tên trên giấy tờ tùy thân không trùng khớp với tên tài khoản hiện tại. Vui lòng dùng đúng CCCD chính chủ hoặc chờ Quản trị viên xét duyệt.',
        expectedName,
        ocrName,
        docMasked,
      };
    case 'DUPLICATE_DOCUMENT':
      return {
        code,
        title: 'Số CCCD đã được gắn với tài khoản khác',
        description:
          'Hệ thống áp dụng nguyên tắc 1 CCCD – 1 tài khoản. Giấy tờ này đã được xác minh cho một tài khoản khác trước đó.',
        expectedName,
        ocrName,
        docMasked,
      };
    case 'USER_DOCUMENT_CONFLICT':
      return {
        code,
        title: 'CCCD mới không khớp giấy tờ đã xác minh trước đó',
        description:
          'Tài khoản này đã định danh với một số CCCD khác. Không thể thay thế bằng giấy tờ của người khác.',
        expectedName,
        ocrName,
        docMasked,
      };
    case 'OCR_DATA_MISSING':
    case 'LEGACY_OCR_MISSING':
    case 'LEGACY_BACKFILL_REQUIRED':
      return {
        code,
        title: 'Thiếu thông tin OCR từ giấy tờ tùy thân',
        description:
          'Không đọc được đầy đủ họ tên hoặc số CCCD từ ảnh chụp. Vui lòng thực hiện xác minh lại với ảnh giấy tờ rõ nét, không bị chói sáng.',
        expectedName,
        ocrName,
        docMasked,
      };
    case 'ADMIN_DECLINED':
      return {
        code,
        title: 'Hồ sơ không được Quản trị viên phê duyệt',
        description:
          metadata?.lastAdminReview?.reason ||
          'Hồ sơ không đạt điều kiện đối soát thủ công. Vui lòng tạo phiên mới với giấy tờ chính chủ.',
        expectedName,
        ocrName,
        docMasked,
      };
    case 'REVOKED_BY_ADMIN':
      return {
        code,
        title: 'Trạng thái định danh đã bị thu hồi',
        description:
          metadata?.revokedAudit?.reason ||
          'Quản trị viên đã thu hồi xác minh danh tính của tài khoản này. Bạn có thể thực hiện xác minh lại.',
        expectedName,
        ocrName,
        docMasked,
      };
    default:
      if (!code) return null;
      return {
        code,
        title: `Hồ sơ đang chờ đối soát (${code})`,
        description: 'Hệ thống đang giữ hồ sơ để kiểm tra tính hợp lệ của thông tin định danh.',
        expectedName,
        ocrName,
        docMasked,
      };
  }
}

/**
 * @param {Record<string, any> | null | undefined} latestSession
 * @param {Record<string, any> | null | undefined} user
 * @param {boolean} [starting]
 */
export function resolveCustomerKycState(latestSession, user, starting = false) {
  const latestStatus = String(latestSession?.status || '').toUpperCase();
  const userKycStatus = String(user?.kycStatus || '').toUpperCase();
  const effective = latestSession ? latestStatus : userKycStatus;

  const isRevoked = effective === 'REVOKED';
  const isApproved = !isRevoked && effective === 'APPROVED';
  const isInReview = !isApproved && !isRevoked && effective === 'IN_REVIEW';
  const isPending = !isApproved && !isInReview && !isRevoked && (effective === 'PENDING' || Boolean(starting));
  const isDeclined =
    !isApproved &&
    !isInReview &&
    !isPending &&
    !isRevoked &&
    Boolean(latestSession) &&
    ['DECLINED', 'REJECTED', 'FAILED', 'EXPIRED', 'ABANDONED'].includes(effective);

  const reviewReason = latestSession?.reviewReason || latestSession?.metadata?.identityCheck?.reason || null;
  const reviewMeta = getKycReviewReasonMeta(reviewReason, latestSession?.metadata, user?.fullName || null);

  return {
    status: effective || 'UNVERIFIED',
    isApproved,
    isInReview,
    isPending,
    isDeclined,
    isRevoked,
    reviewReason,
    reviewMeta,
  };
}
