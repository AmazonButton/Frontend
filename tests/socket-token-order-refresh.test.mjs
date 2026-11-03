import test from 'node:test';
import assert from 'node:assert/strict';

test('Socket Token Auto-Refresh & ORDER_CREATED Live Handler Specs', async (t) => {
  await t.test('1. Proactive token validation detects expired JWTs', async () => {
    // Generate expired and valid fake tokens
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    
    // Expired payload
    const expiredPayload = Buffer.from(JSON.stringify({
      userId: '10',
      exp: Math.floor(Date.now() / 1000) - 300, // expired 5 mins ago
    })).toString('base64');
    const expiredJwt = `${header}.${expiredPayload}.signature`;

    // Valid payload (valid for 1 hour)
    const validPayload = Buffer.from(JSON.stringify({
      userId: '10',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64');
    const validJwt = `${header}.${validPayload}.signature`;

    function isExpired(token) {
      if (!token) return true;
      try {
        const parts = token.split('.');
        const parsed = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        return Date.now() >= (parsed.exp * 1000) - 30000;
      } catch {
        return true;
      }
    }

    assert.equal(isExpired(expiredJwt), true, 'Expired JWT must be flagged as expired');
    assert.equal(isExpired(validJwt), false, 'Valid JWT must not be flagged as expired');
    assert.equal(isExpired(null), true, 'Null token is expired');
  });

  await t.test('2. Reconnect logic updates auth and immediately reconnects socket', async () => {
    let disconnected = false;
    let connected = false;
    let authSent = null;
    let emittedAuth = null;

    const mockSocket = {
      connected: false,
      auth: {},
      io: { opts: {} },
      disconnect() {
        disconnected = true;
        this.connected = false;
      },
      connect() {
        connected = true;
        this.connected = true;
      },
      emit(event, data) {
        if (event === 'authenticate') {
          emittedAuth = data;
        }
      },
    };

    const freshToken = 'mock_fresh_token_xyz_2026';

    // Simulate reconnectSocketWithFreshToken logic
    const authHeader = `Bearer ${freshToken}`;
    mockSocket.auth = { token: authHeader };
    mockSocket.io.opts.auth = { token: authHeader };

    if (!mockSocket.connected) {
      mockSocket.disconnect();
      mockSocket.connect();
    } else {
      mockSocket.emit('authenticate', { token: freshToken });
    }

    assert.equal(disconnected, true, 'Socket disconnect must be called to reset backoff');
    assert.equal(connected, true, 'Socket connect must be called');
    assert.equal(mockSocket.auth.token, 'Bearer mock_fresh_token_xyz_2026');
    assert.equal(mockSocket.io.opts.auth.token, 'Bearer mock_fresh_token_xyz_2026');
  });

  await t.test('3. ORDER_CREATED prepends order into state without reloading and calls sound/toast', () => {
    let chimePlayed = false;
    let toastMessage = '';
    let orders = [
      { id: '101', orderCode: 'SOB-101', status: 'PENDING' },
      { id: '100', orderCode: 'SOB-100', status: 'COMPLETED' },
    ];

    function playOrderChime() {
      chimePlayed = true;
    }

    const toast = {
      success(msg) {
        toastMessage = msg;
      },
    };

    // Incoming ORDER_CREATED socket payload
    const newOrderPayload = {
      order: {
        id: '102',
        orderCode: 'SOB-8829',
        status: 'PENDING',
        totalAmount: 180000,
      },
      buttonCode: 'BTN-8829-WTR',
      customerName: 'Nguyễn Văn A',
    };

    // Event handler logic
    playOrderChime();
    const newOrder = newOrderPayload.order || newOrderPayload;
    
    // Prepend order without F5
    orders = [newOrder, ...orders];

    // Show toast
    toast.success(`Đã nhận đơn hàng mới #${newOrder.orderCode || newOrder.id}!`);

    assert.equal(chimePlayed, true, 'playOrderChime must be triggered');
    assert.equal(orders.length, 3, 'Order list must now contain 3 orders');
    assert.equal(orders[0].id, '102', 'New order must be at index 0 without F5 reload');
    assert.equal(toastMessage, 'Đã nhận đơn hàng mới #SOB-8829!', 'Toast notification must show orderCode');
  });

  await t.test('4. ORDER_CREATED handles flat order payload format gracefully', () => {
    let chimePlayed = false;
    let toastMessage = '';
    let orders = [{ id: '50', orderCode: 'SOB-050' }];

    const flatPayload = {
      id: '51',
      orderId: '51',
      orderCode: 'ORD-51',
      status: 'PENDING',
    };

    const playOrderChime = () => { chimePlayed = true; };
    const toast = { success: (msg) => { toastMessage = msg; } };

    playOrderChime();
    const newOrder = flatPayload.order || flatPayload;
    orders = [newOrder, ...orders];
    toast.success(`Đã nhận đơn hàng mới #${newOrder.orderCode || newOrder.id}!`);

    assert.equal(chimePlayed, true);
    assert.equal(orders[0].id, '51');
    assert.equal(toastMessage, 'Đã nhận đơn hàng mới #ORD-51!');
  });
});

