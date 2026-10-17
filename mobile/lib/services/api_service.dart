import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiResponse {
  final bool success;
  final dynamic data;
  final String? message;
  final int statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.message,
    required this.statusCode,
  });
}

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static const String _defaultUrlKey = 'smart_order_custom_base_url';
  String? _customBaseUrl;

  /// Determine standard default URL according to runtime platform:
  /// - Android physical/emulator: 10.0.2.2 or localhost
  /// - Web / Windows desktop / iOS: localhost
  static String get defaultBaseUrl {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      // IP mạng LAN của máy tính đang chạy backend để điện thoại thật kết nối
      return 'http://192.168.1.129:5000';
    }
    return 'http://localhost:5000';
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _customBaseUrl = prefs.getString(_defaultUrlKey);
    // Tự động nâng cấp nếu app trước đó từng lưu IP cũ
    if (_customBaseUrl != null &&
        (_customBaseUrl!.contains('192.168.1.125') ||
         _customBaseUrl!.contains('192.168.1.126'))) {
      _customBaseUrl = defaultBaseUrl;
      await prefs.setString(_defaultUrlKey, _customBaseUrl!);
    }
  }

  String get baseUrl => _customBaseUrl ?? defaultBaseUrl;

  Future<void> setBaseUrl(String url) async {
    _customBaseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_defaultUrlKey, _customBaseUrl!);
  }

  String get apiUrl => '$baseUrl/api';

  Future<Map<String, String>> _getHeaders([Map<String, String>? extraHeaders]) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('smart_order_token');
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }
    return headers;
  }

  /// Auto refresh token khi nhận 401
  Future<bool> _tryRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    final refreshToken = prefs.getString('smart_order_refresh_token');
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final url = Uri.parse('$apiUrl/auth/refresh');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': refreshToken}),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(utf8.decode(response.bodyBytes));
        if (decoded['success'] == true && decoded['accessToken'] != null) {
          await prefs.setString('smart_order_token', decoded['accessToken']);
          if (decoded['refreshToken'] != null) {
            await prefs.setString('smart_order_refresh_token', decoded['refreshToken']);
          }
          return true;
        }
      }
    } catch (e) {
      debugPrint('⚠️ Token refresh failed: $e');
    }
    return false;
  }

  Future<ApiResponse> get(String endpoint) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('$apiUrl$endpoint');
      var response = await http.get(url, headers: headers).timeout(
            const Duration(seconds: 10),
          );

      // Auto refresh token on 401
      if (response.statusCode == 401 && !endpoint.contains('/auth/')) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          final newHeaders = await _getHeaders();
          response = await http.get(url, headers: newHeaders).timeout(
                const Duration(seconds: 10),
              );
        }
      }

      return _handleResponse(response);
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Lỗi kết nối máy chủ ($baseUrl): $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse> post(
    String endpoint, [
    Map<String, dynamic>? body,
    Map<String, String>? extraHeaders,
  ]) async {
    try {
      final headers = await _getHeaders(extraHeaders);
      final url = Uri.parse('$apiUrl$endpoint');
      var response = await http
          .post(
            url,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 12));

      // Auto refresh token on 401
      if (response.statusCode == 401 && !endpoint.contains('/auth/')) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          final newHeaders = await _getHeaders(extraHeaders);
          response = await http.post(
            url,
            headers: newHeaders,
            body: body != null ? jsonEncode(body) : null,
          ).timeout(const Duration(seconds: 12));
        }
      }

      return _handleResponse(response);
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Lỗi kết nối máy chủ ($baseUrl): $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse> put(String endpoint, [Map<String, dynamic>? body]) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('$apiUrl$endpoint');
      var response = await http
          .put(
            url,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 401 && !endpoint.contains('/auth/')) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          final newHeaders = await _getHeaders();
          response = await http.put(
            url,
            headers: newHeaders,
            body: body != null ? jsonEncode(body) : null,
          ).timeout(const Duration(seconds: 12));
        }
      }

      return _handleResponse(response);
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Lỗi kết nối máy chủ ($baseUrl): $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse> patch(String endpoint, [Map<String, dynamic>? body]) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('$apiUrl$endpoint');
      var response = await http
          .patch(
            url,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(const Duration(seconds: 12));

      if (response.statusCode == 401 && !endpoint.contains('/auth/')) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          final newHeaders = await _getHeaders();
          response = await http.patch(
            url,
            headers: newHeaders,
            body: body != null ? jsonEncode(body) : null,
          ).timeout(const Duration(seconds: 12));
        }
      }

      return _handleResponse(response);
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Lỗi kết nối máy chủ ($baseUrl): $e',
        statusCode: 500,
      );
    }
  }

  Future<ApiResponse> delete(String endpoint) async {
    try {
      final headers = await _getHeaders();
      final url = Uri.parse('$apiUrl$endpoint');
      var response = await http.delete(url, headers: headers).timeout(
            const Duration(seconds: 12),
          );

      if (response.statusCode == 401 && !endpoint.contains('/auth/')) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          final newHeaders = await _getHeaders();
          response = await http.delete(url, headers: newHeaders).timeout(
                const Duration(seconds: 12),
              );
        }
      }

      return _handleResponse(response);
    } catch (e) {
      return ApiResponse(
        success: false,
        message: 'Lỗi kết nối máy chủ ($baseUrl): $e',
        statusCode: 500,
      );
    }
  }

  ApiResponse _handleResponse(http.Response response) {
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return ApiResponse(
          success: decoded is Map<String, dynamic> ? (decoded['success'] ?? true) : true,
          data: decoded is Map<String, dynamic> ? (decoded['data'] ?? decoded) : decoded,
          message: decoded is Map<String, dynamic> ? decoded['message'] : null,
          statusCode: response.statusCode,
        );
      } else {
        return ApiResponse(
          success: false,
          data: decoded is Map<String, dynamic> ? decoded : null,
          message: decoded is Map<String, dynamic>
              ? (decoded['message'] ?? 'Yêu cầu thất bại (${response.statusCode})')
              : 'Lỗi: ${response.statusCode}',
          statusCode: response.statusCode,
        );
      }
    } catch (_) {
      return ApiResponse(
        success: response.statusCode >= 200 && response.statusCode < 300,
        message: response.body.isNotEmpty ? response.body : 'Mã phản hồi ${response.statusCode}',
        statusCode: response.statusCode,
      );
    }
  }
}
