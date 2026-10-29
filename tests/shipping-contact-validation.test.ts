import assert from 'node:assert/strict';
import test from 'node:test';
import { getShippingContactErrors, normalizeShippingContact } from '../src/services/shipping-contact-validation.ts';
import type { ShippingContactField } from '../src/services/shipping-contact-validation.ts';

const validContact = { customerName: 'Nguyễn Văn An', customerPhone: '0900000000', deliveryAddress: '12/3 Test Street, Test Ward, Test City' };
const cases: Array<[ShippingContactField, string, boolean]> = [
      ['customerName', '', false], ['customerName', '   ', false], ['customerName', 'An', false],
      ['customerName', 'Nguyễn Văn 123', false], ['customerName', 'Nguyễn @ An', false],
      ['customerName', 'Nguyễn 😀 An', false], ['customerName', '<script> An', false],
      ['customerName', 'Nguyễn\u200b Văn An', false], ['customerName', 'Nguyễn\nVăn An', false],
      ['customerName', 'A'.repeat(101) + ' An', false],
      ['customerName', '  Nguyễn   Văn An  ', true], ['customerName', 'Nguyễn Văn An'.normalize('NFD'), true],
      ['customerName', "Jean-Luc O’Neill", true],
      ['customerPhone', '', false], ['customerPhone', '090000000', false],
      ['customerPhone', '09000000000', false], ['customerPhone', '090000000a', false],
      ['customerPhone', '090 000 0000', false], ['customerPhone', '090-000-0000', false],
      ['customerPhone', '(090)0000000', false], ['customerPhone', '+84900000000', false],
      ['customerPhone', '0000000000', false], ['customerPhone', '0123456789', false],
      ['customerPhone', '０９００００００００', false], ['customerPhone', '0900000000<script>', false],
      ['customerPhone', ' 0900000000 ', true], ['customerPhone', '0300000000', true],
      ['customerPhone', '0500000000', true], ['customerPhone', '0700000000', true],
      ['customerPhone', '0800000000', true], ['customerPhone', '0900000000', true],
      ['deliveryAddress', '', false], ['deliveryAddress', '     ', false],
      ['deliveryAddress', 'abc', false], ['deliveryAddress', '12345678901234567890', false],
      ['deliveryAddress', 'aaaaaaaaaaaaaaaaaaaa', false],
      ['deliveryAddress', '12 Đường Kiểm Thử <script>', false],
      ['deliveryAddress', '12 Đường Kiểm Thử 😀', false],
      ['deliveryAddress', '12 Đường Kiểm Thử @#$%', false],
      ['deliveryAddress', '12 Đường Kiểm Thử\u200b', false],
      ['deliveryAddress', 'A '.repeat(128), true],
      ['deliveryAddress', 'A '.repeat(129), false],
      ['deliveryAddress', 'Thôn Kiểm Thử, xã Kiểm Thử, tỉnh Kiểm Thử', true],
      ['deliveryAddress', 'Căn 2.03 (tầng 2), tòa A, 12/3 Đường Kiểm Thử', true],
      ['deliveryAddress', '  12/3 Đường Kiểm Thử\nphường Kiểm Thử, TP Hồ Chí Minh  ', true],
];
for (const [field, value, valid] of cases) {
  test(field + ' ' + JSON.stringify(value), () => {
    const errors = getShippingContactErrors({ ...validContact, [field]: value });
    assert.equal(!errors[field], valid);
  });
}
test('Normalization preserves the entered digits and Vietnamese accents', () => {
  const normalized = normalizeShippingContact({ ...validContact, customerName: validContact.customerName.normalize('NFD'), customerPhone: ' 0900000000 ', deliveryAddress: '  12/3 Test Street,\nTest Ward, Test City  ' });
  assert.equal(normalized.customerName, validContact.customerName);
  assert.equal(normalized.customerPhone, '0900000000');
  assert.equal(normalized.deliveryAddress, validContact.deliveryAddress);
});
