import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import '../services/api_service.dart';
import '../services/socket_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  String? _token;
  String? _refreshToken;
  bool _loading = true;
  String? _errorMessage;

  UserModel? get user => _user;
  String? get token => _token;
  bool get loading => _loading;
  bool get isAuthenticated => _user != null && _token != null;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    loadSession();
  }

  Future<void> loadSession() async {
    _loading = true;
    notifyListeners();

    try {
      await ApiService().init();
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString('smart_order_token');
      final savedRefreshToken = prefs.getString('smart_order_refresh_token');
      final savedUserJson = prefs.getString('smart_order_user');

      if (savedToken != null && savedUserJson != null) {
        _token = savedToken;
        _refreshToken = savedRefreshToken;
        _user = UserModel.fromJson(jsonDecode(savedUserJson));

        // Validate token with /auth/me
        final meRes = await ApiService().get('/auth/me');
        if (meRes.success && meRes.data != null) {
          final meData = meRes.data is Map<String, dynamic> ? meRes.data : {};
          if (meData['user'] != null) {
            _user = UserModel.fromJson(meData['user']);
            await prefs.setString('smart_order_user', jsonEncode(_user!.toJson()));
          }
        }

        _initSocketForUser();
      } else {
        // Tự động kết nối tài khoản khách hàng mặc định (An) để người dùng vào thẳng app
        // không bị chặn bởi màn hình đăng nhập!
        await autoLoginDefaultCustomer();
      }
    } catch (e) {
      debugPrint('Lỗi tải phiên đăng nhập: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void _initSocketForUser() {
    SocketService().initSocket();
    if (_user?.customerProfileId != null) {
      SocketService().subscribeToCustomer(_user!.customerProfileId!);
    }
  }

  Future<bool> autoLoginDefaultCustomer() async {
    return login('customer@smartorder.local', 'Password123!', isSilent: true);
  }

  Future<bool> login(String email, String password, {bool isSilent = false}) async {
    _errorMessage = null;
    if (!isSilent) {
      _loading = true;
      notifyListeners();
    }

    try {
      final res = await ApiService().post('/auth/login', {
        'email': email.trim(),
        'password': password,
      });

      if (res.success && res.data != null) {
        final data = res.data is Map<String, dynamic> ? res.data : {};
        _token = data['token'] ?? data['accessToken'];
        _refreshToken = data['refreshToken'];
        _user = UserModel.fromJson(data['user'] ?? {});

        final prefs = await SharedPreferences.getInstance();
        if (_token != null) {
          await prefs.setString('smart_order_token', _token!);
        }
        if (_refreshToken != null) {
          await prefs.setString('smart_order_refresh_token', _refreshToken!);
        }
        if (_user != null) {
          await prefs.setString('smart_order_user', jsonEncode(_user!.toJson()));
        }

        _initSocketForUser();

        _loading = false;
        notifyListeners();
        return true;
      } else {
        _errorMessage = res.message ?? 'Email hoặc mật khẩu không chính xác';
        _loading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Lỗi kết nối máy chủ: $e';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  /// Đăng ký tài khoản mới
  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String fullName,
    required String phone,
    String? username,
    String role = 'CUSTOMER',
    String? storeCode,
    String? storeName,
    String? storePhone,
    String? storeEmail,
    String? storeAddress,
    String? apartment,
    String? building,
    String? deliveryAddress,
  }) async {
    _errorMessage = null;
    _loading = true;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        'email': email.trim(),
        'password': password,
        'fullName': fullName.trim(),
        'phone': phone.trim(),
        'role': role,
      };

      if (username != null && username.isNotEmpty) body['username'] = username.trim();
      if (storeCode != null && storeCode.isNotEmpty) body['storeCode'] = storeCode.trim();
      if (storeName != null && storeName.isNotEmpty) body['storeName'] = storeName.trim();
      if (storePhone != null && storePhone.isNotEmpty) body['storePhone'] = storePhone.trim();
      if (storeEmail != null && storeEmail.isNotEmpty) body['storeEmail'] = storeEmail.trim();
      if (storeAddress != null && storeAddress.isNotEmpty) body['storeAddress'] = storeAddress.trim();
      if (apartment != null && apartment.isNotEmpty) body['apartment'] = apartment.trim();
      if (building != null && building.isNotEmpty) body['building'] = building.trim();
      if (deliveryAddress != null && deliveryAddress.isNotEmpty) body['deliveryAddress'] = deliveryAddress.trim();

      final res = await ApiService().post('/auth/register', body);

      _loading = false;
      notifyListeners();

      if (res.success) {
        return {'success': true, 'message': res.message ?? 'Đăng ký thành công!'};
      } else {
        return {'success': false, 'message': res.message ?? 'Đăng ký thất bại'};
      }
    } catch (e) {
      _loading = false;
      notifyListeners();
      return {'success': false, 'message': 'Lỗi kết nối: $e'};
    }
  }

  /// Quên mật khẩu
  Future<Map<String, dynamic>> forgotPassword(String email) async {
    _loading = true;
    notifyListeners();

    try {
      final res = await ApiService().post('/auth/forgot-password', {
        'email': email.trim(),
      });

      _loading = false;
      notifyListeners();

      return {
        'success': res.success,
        'message': res.message ?? (res.success ? 'Đã gửi mã xác nhận!' : 'Thất bại'),
      };
    } catch (e) {
      _loading = false;
      notifyListeners();
      return {'success': false, 'message': 'Lỗi kết nối: $e'};
    }
  }

  /// Đặt lại mật khẩu
  Future<Map<String, dynamic>> resetPassword(String token, String newPassword) async {
    _loading = true;
    notifyListeners();

    try {
      final res = await ApiService().post('/auth/reset-password', {
        'token': token.trim(),
        'newPassword': newPassword,
      });

      _loading = false;
      notifyListeners();

      return {
        'success': res.success,
        'message': res.message ?? (res.success ? 'Đã đặt lại mật khẩu!' : 'Thất bại'),
      };
    } catch (e) {
      _loading = false;
      notifyListeners();
      return {'success': false, 'message': 'Lỗi kết nối: $e'};
    }
  }

  /// Xác minh email
  Future<Map<String, dynamic>> verifyEmail(String verificationToken) async {
    _loading = true;
    notifyListeners();

    try {
      final res = await ApiService().post('/auth/verify-email', {
        'token': verificationToken.trim(),
      });

      _loading = false;
      notifyListeners();

      return {
        'success': res.success,
        'message': res.message ?? (res.success ? 'Email đã được xác minh!' : 'Mã không hợp lệ'),
      };
    } catch (e) {
      _loading = false;
      notifyListeners();
      return {'success': false, 'message': 'Lỗi kết nối: $e'};
    }
  }

  /// Gửi lại email xác minh
  Future<Map<String, dynamic>> resendVerification(String email) async {
    try {
      final res = await ApiService().post('/auth/resend-verification', {
        'email': email.trim(),
      });

      return {
        'success': res.success,
        'message': res.message ?? (res.success ? 'Đã gửi lại mã!' : 'Thất bại'),
      };
    } catch (e) {
      return {'success': false, 'message': 'Lỗi kết nối: $e'};
    }
  }

  /// Check email availability
  Future<bool> checkEmailAvailable(String email) async {
    try {
      final res = await ApiService().get('/auth/check-email?email=${Uri.encodeComponent(email.trim())}');
      if (res.success && res.data != null) {
        return res.data['available'] == true;
      }
      return true;
    } catch (_) {
      return true;
    }
  }

  /// Check username availability
  Future<bool> checkUsernameAvailable(String username) async {
    try {
      final res = await ApiService().get('/auth/check-username?username=${Uri.encodeComponent(username.trim())}');
      if (res.success && res.data != null) {
        return res.data['available'] == true;
      }
      return true;
    } catch (_) {
      return true;
    }
  }

  Future<void> logout() async {
    // Call server logout
    try {
      await ApiService().post('/auth/logout', {
        'refreshToken': _refreshToken,
      });
    } catch (_) {}

    _user = null;
    _token = null;
    _refreshToken = null;
    SocketService().disconnect();

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('smart_order_token');
    await prefs.remove('smart_order_refresh_token');
    await prefs.remove('smart_order_user');

    notifyListeners();
  }

  Future<void> updateServerUrl(String newUrl) async {
    await ApiService().setBaseUrl(newUrl);
    SocketService().disconnect();
    SocketService().initSocket();
    if (_user?.customerProfileId != null) {
      SocketService().subscribeToCustomer(_user!.customerProfileId!);
    }
    notifyListeners();
  }
}
