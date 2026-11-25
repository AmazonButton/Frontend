import test from 'node:test';
import assert from 'node:assert/strict';

const isFrontendDir = import.meta.url.includes('/frontend/tests/');
const prefixes = isFrontendDir ? ['../src/'] : ['../src/', '../frontend/src/'];
for (const prefix of prefixes) {
  test(`${prefix}kyc helper resolves IN_REVIEW NAME_MISMATCH, DUPLICATE_DOCUMENT, USER_DOCUMENT_CONFLICT, and REVOKED`, async () => {
    const { getKycReviewReasonMeta, getKycStatusLabel, resolveCustomerKycState } = await import(`${prefix}utils/kyc.mjs`);

    const session83 = {
      sessionId: '83',
      status: 'IN_REVIEW',
      reviewReason: 'NAME_MISMATCH',
      metadata: {
        fullName: 'Bảo Hồ Gia Lê',
        documentNumberMasked: '********1153',
        identityCheck: {
          expectedNormalized: 'NGUYEN VAN THANH',
          ocrNormalized: 'BAO HO GIA LE',
          reason: 'NAME_MISMATCH',
        },
      },
    };
    const state = resolveCustomerKycState(session83, { fullName: 'Nguyễn Văn Thành', kycStatus: 'IN_REVIEW' });
    assert.equal(state.isInReview, true);
    assert.equal(state.isApproved, false);
    assert.equal(state.isPending, false);
    assert.equal(state.isDeclined, false);
    assert.equal(state.reviewMeta.code, 'NAME_MISMATCH');
    assert.match(state.reviewMeta.description, /NGUYEN VAN THANH/);
    assert.match(state.reviewMeta.description, /Bảo Hồ Gia Lê/);
    assert.equal(state.reviewMeta.docMasked, '********1153');

    const dup = getKycReviewReasonMeta('DUPLICATE_DOCUMENT');
    assert.equal(dup.code, 'DUPLICATE_DOCUMENT');
    assert.match(dup.description, /1 CCCD/);

    const conflict = getKycReviewReasonMeta('USER_DOCUMENT_CONFLICT');
    assert.equal(conflict.code, 'USER_DOCUMENT_CONFLICT');

    const revoked = resolveCustomerKycState(null, { kycStatus: 'REVOKED' });
    assert.equal(revoked.isRevoked, true);
    assert.equal(revoked.isApproved, false);
    assert.equal(getKycStatusLabel('IN_REVIEW'), 'Chờ xem xét');
    assert.equal(getKycStatusLabel('REVOKED'), 'Đã thu hồi');
  });

  test(`${prefix}admin-workflows exposes reviewIdentitySession and revokeUserIdentity matching backend DTOs`, async () => {
    const { reviewIdentitySession, revokeUserIdentity } = await import(`${prefix}pages/admin/admin-workflows.mjs`);
    const calls = [];
    const client = {
      async post(url, body) {
        calls.push({ method: 'POST', url, body });
        return { data: { success: true, data: { status: 'DECLINED', reviewReason: 'ADMIN_DECLINED' } } };
      },
      async get(url) {
        calls.push({ method: 'GET', url });
        return { data: { success: true, data: { sessionId: '83', status: 'DECLINED', reviewReason: 'ADMIN_DECLINED' } } };
      },
    };

    const reviewed = await reviewIdentitySession(client, '83', {
      decision: 'APPROVE',
      reason: 'Khớp giấy tờ bổ sung',
      acceptOcrNameAsVerified: true,
    });
    assert.equal(reviewed.sessionId, '83');
    assert.deepEqual(calls[0], {
      method: 'POST',
      url: '/identity-verifications/sessions/83/review',
      body: { decision: 'APPROVE', reason: 'Khớp giấy tờ bổ sung', acceptOcrNameAsVerified: true },
    });
    assert.equal(calls[1].url, '/identity-verifications/sessions/83');

    await assert.rejects(reviewIdentitySession(client, '83', { decision: 'APPROVE', reason: 'ab' }), /3 ký tự/);
    await assert.rejects(revokeUserIdentity(client, '306', 'abcd'), /5 ký tự/);

    await revokeUserIdentity(client, '306', 'Thu hồi do lệch chủ sở hữu');
    assert.deepEqual(calls[2], {
      method: 'POST',
      url: '/identity-verifications/users/306/revoke',
      body: { reason: 'Thu hồi do lệch chủ sở hữu' },
    });
  });
}
