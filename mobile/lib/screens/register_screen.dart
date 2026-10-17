import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  static const Color primaryBlack = Color(0xFF111827);
  static const Color borderColor = Color(0xFFE5E7EB);
  static const Color inputBg = Color(0xFFF9FAFB);

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _currentStep = 1;
  String _selectedRole = 'Cư dân'; // 'Cư dân', 'Cửa hàng', 'Giao hàng'

  // Controllers Step 1
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Controllers Step 2
  final _apartmentController = TextEditingController();
  final _buildingController = TextEditingController();
  final _storeCodeController = TextEditingController();
  final _storeNameController = TextEditingController();
  final _storeAddressController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _agreeTerms = true;
  bool _isLoading = false;

  // Validation errors
  String? _nameError;
  String? _phoneError;
  String? _emailError;
  String? _passwordError;
  String? _confirmError;

  Timer? _emailDebounce;
  bool _emailAvailable = true;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _apartmentController.dispose();
    _buildingController.dispose();
    _storeCodeController.dispose();
    _storeNameController.dispose();
    _storeAddressController.dispose();
    _emailDebounce?.cancel();
    super.dispose();
  }

  void _checkEmailDebounce(String email) {
    _emailDebounce?.cancel();
    if (email.length < 5 || !email.contains('@')) return;
    _emailDebounce = Timer(const Duration(milliseconds: 600), () async {
      final available = await context.read<AuthProvider>().checkEmailAvailable(email);
      if (mounted) {
        setState(() {
          _emailAvailable = available;
          if (!available) {
            _emailError = 'Email này đã được sử dụng!';
          } else {
            _emailError = null;
          }
        });
      }
    });
  }

  bool _validateStep1() {
    setState(() {
      _nameError = null;
      _phoneError = null;
      _emailError = null;
      _passwordError = null;
      _confirmError = null;
    });

    bool isValid = true;

    if (_nameController.text.trim().isEmpty) {
      setState(() => _nameError = 'Vui lòng nhập họ và tên.');
      isValid = false;
    }

    final phone = _phoneController.text.trim();
    if (phone.isEmpty || !RegExp(r'^[0-9]{10,11}$').hasMatch(phone)) {
      setState(() => _phoneError = 'Vui lòng nhập SĐT hợp lệ (10-11 số).');
      isValid = false;
    }

    final email = _emailController.text.trim();
    if (email.isEmpty || !RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(email)) {
      setState(() => _emailError = 'Vui lòng nhập email đúng định dạng.');
      isValid = false;
    } else if (!_emailAvailable) {
      setState(() => _emailError = 'Email này đã tồn tại trên hệ thống.');
      isValid = false;
    }

    final password = _passwordController.text;
    if (password.length < 8) {
      setState(() => _passwordError = 'Mật khẩu phải từ 8 ký tự trở lên.');
      isValid = false;
    }

    if (password != _confirmPasswordController.text) {
      setState(() => _confirmError = 'Mật khẩu xác nhận không khớp.');
      isValid = false;
    }

    return isValid;
  }

  void _goToStep2() {
    if (_validateStep1()) {
      setState(() => _currentStep = 2);
    }
  }

  void _backToStep1() {
    setState(() => _currentStep = 1);
  }

  void _handleSubmit() async {
    if (!_agreeTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng đồng ý với Điều khoản dịch vụ!'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final auth = context.read<AuthProvider>();

      String apiRole = 'CUSTOMER';
      if (_selectedRole == 'Cửa hàng') apiRole = 'STORE_OWNER';
      if (_selectedRole == 'Giao hàng') apiRole = 'TECHNICIAN';

      final result = await auth.register(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        fullName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
        role: apiRole,
        storeCode: _storeCodeController.text.trim().isEmpty ? null : _storeCodeController.text.trim(),
        storeName: _selectedRole == 'Cửa hàng' ? _storeNameController.text.trim() : null,
        storeAddress: _selectedRole == 'Cửa hàng' ? _storeAddressController.text.trim() : null,
        apartment: _selectedRole == 'Cư dân' ? _apartmentController.text.trim() : null,
        building: _selectedRole == 'Cư dân' ? _buildingController.text.trim() : null,
      );

      if (!mounted) return;

      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đăng ký thành công! Vui lòng đăng nhập.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? 'Đăng ký thất bại, vui lòng thử lại.'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primaryBlack = RegisterScreen.primaryBlack;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Back button Header
              GestureDetector(
                onTap: () {
                  if (_currentStep == 2) {
                    _backToStep1();
                  } else {
                    Navigator.pop(context);
                  }
                },
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.arrow_back_ios_new, size: 14, color: Colors.grey),
                    const SizedBox(width: 6),
                    Text(
                      _currentStep == 2 ? 'Quay lại' : 'Đăng nhập',
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // 2. Title & Step Indicator Row
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Tạo tài khoản',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: primaryBlack,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _currentStep == 1 ? 'Thông tin cơ bản' : 'Bảo mật & căn hộ',
                          style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),

                  // Step Indicators Animated
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: _currentStep == 1 ? 24 : 12,
                            height: 6,
                            decoration: BoxDecoration(
                              color: _currentStep == 1 ? primaryBlack : Colors.grey.shade400,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                          const SizedBox(width: 4),
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: _currentStep == 2 ? 24 : 12,
                            height: 6,
                            decoration: BoxDecoration(
                              color: _currentStep == 2 ? primaryBlack : Colors.grey.shade300,
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Bước /2',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // 3. Step 1 / Step 2 Smooth Animated CrossFade
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 350),
                crossFadeState: _currentStep == 1 ? CrossFadeState.showFirst : CrossFadeState.showSecond,
                firstChild: _buildStep1(),
                secondChild: _buildStep2(),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // WIDGET BƯỚC 1
  Widget _buildStep1() {
    const primaryBlack = RegisterScreen.primaryBlack;
    const borderColor = RegisterScreen.borderColor;
    const inputBg = RegisterScreen.inputBg;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 3 Role Cards with Animated Container
        Row(
          children: [
            _buildRoleCard('Cư dân', Icons.home_work_outlined),
            const SizedBox(width: 8),
            _buildRoleCard('Cửa hàng', Icons.storefront_outlined),
            const SizedBox(width: 8),
            _buildRoleCard('Giao hàng', Icons.delivery_dining_outlined),
          ],
        ),

        const SizedBox(height: 24),

        // Full Name
        _buildInputField(
          controller: _nameController,
          hint: 'Họ và tên',
          icon: Icons.person_outline,
          error: _nameError,
          primaryBlack: primaryBlack,
          borderColor: borderColor,
          inputBg: inputBg,
        ),

        const SizedBox(height: 14),

        // Phone
        _buildInputField(
          controller: _phoneController,
          hint: 'Số điện thoại',
          icon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          error: _phoneError,
          primaryBlack: primaryBlack,
          borderColor: borderColor,
          inputBg: inputBg,
        ),

        const SizedBox(height: 14),

        // Email
        _buildInputField(
          controller: _emailController,
          hint: 'Email',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          error: _emailError,
          onChanged: _checkEmailDebounce,
          primaryBlack: primaryBlack,
          borderColor: borderColor,
          inputBg: inputBg,
        ),

        const SizedBox(height: 14),

        // Password
        _buildInputField(
          controller: _passwordController,
          hint: 'Mật khẩu (tối thiểu 8 ký tự)',
          icon: Icons.lock_outline,
          obscureText: _obscurePassword,
          error: _passwordError,
          suffixIcon: IconButton(
            icon: Icon(
              _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 20,
              color: Colors.grey.shade600,
            ),
            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
          ),
          primaryBlack: primaryBlack,
          borderColor: borderColor,
          inputBg: inputBg,
        ),

        const SizedBox(height: 14),

        // Confirm Password
        _buildInputField(
          controller: _confirmPasswordController,
          hint: 'Xác nhận mật khẩu',
          icon: Icons.lock_outline,
          obscureText: _obscureConfirm,
          error: _confirmError,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureConfirm ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 20,
              color: Colors.grey.shade600,
            ),
            onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
          ),
          primaryBlack: primaryBlack,
          borderColor: borderColor,
          inputBg: inputBg,
        ),

        const SizedBox(height: 24),

        // Nút Tiếp theo →
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _goToStep2,
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryBlack,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text(
              'Tiếp theo →',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Quay lại đăng nhập
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Đã có tài khoản? ', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: const Text(
                'Đăng nhập',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: primaryBlack),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // WIDGET BƯỚC 2
  Widget _buildStep2() {
    const primaryBlack = RegisterScreen.primaryBlack;
    const borderColor = RegisterScreen.borderColor;
    const inputBg = RegisterScreen.inputBg;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Summary Info Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8F9FA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFF4F5F7),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _selectedRole == 'Cư dân'
                      ? Icons.home_work_outlined
                      : _selectedRole == 'Cửa hàng'
                          ? Icons.storefront_outlined
                          : Icons.delivery_dining_outlined,
                  color: primaryBlack,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _nameController.text.isNotEmpty ? _nameController.text : 'Chưa đặt tên',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: primaryBlack),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      ' • ',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: _backToStep1,
                child: const Text('Sửa', style: TextStyle(color: primaryBlack, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        if (_selectedRole == 'Cư dân') ...[
          _buildInputField(
            controller: _apartmentController,
            hint: 'Số căn hộ (ví dụ: A12-04)',
            icon: Icons.meeting_room_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            controller: _buildingController,
            hint: 'Tòa nhà / Khu chung cư',
            icon: Icons.apartment_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            controller: _storeCodeController,
            hint: 'Mã cửa hàng phục vụ (không bắt buộc)',
            icon: Icons.qr_code_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
        ] else if (_selectedRole == 'Cửa hàng') ...[
          _buildInputField(
            controller: _storeNameController,
            hint: 'Tên cửa hàng / Doanh nghiệp',
            icon: Icons.store_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
          const SizedBox(height: 14),
          _buildInputField(
            controller: _storeAddressController,
            hint: 'Địa chỉ cửa hàng',
            icon: Icons.place_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
        ] else ...[
          _buildInputField(
            controller: _storeAddressController,
            hint: 'Khu vực nhận giao hàng',
            icon: Icons.map_outlined,
            primaryBlack: primaryBlack,
            borderColor: borderColor,
            inputBg: inputBg,
          ),
        ],

        const SizedBox(height: 20),

        // Checkbox Terms
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: _agreeTerms,
                activeColor: primaryBlack,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                onChanged: (val) => setState(() => _agreeTerms = val ?? true),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Tôi đồng ý với Điều khoản dịch vụ và Chính sách quyền riêng tư của SmartOrderButton',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.4),
              ),
            ),
          ],
        ),

        const SizedBox(height: 24),

        // Nút Tạo tài khoản
        SizedBox(
          width: double.infinity,
          height: 56,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryBlack,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                  )
                : const Text(
                    'Tạo tài khoản',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ],
    );
  }

  // Helper Role Card
  Widget _buildRoleCard(String title, IconData icon) {
    const primaryBlack = RegisterScreen.primaryBlack;
    const borderColor = RegisterScreen.borderColor;
    final isSelected = _selectedRole == title;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedRole = title),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          height: 100,
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFF4F5F7) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? primaryBlack : borderColor,
              width: isSelected ? 1.6 : 1.0,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: isSelected ? primaryBlack : Colors.grey.shade600, size: 26),
              const SizedBox(height: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  color: isSelected ? primaryBlack : Colors.grey.shade700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Helper Input Field
  Widget _buildInputField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    required Color primaryBlack,
    required Color borderColor,
    required Color inputBg,
    TextInputType? keyboardType,
    bool obscureText = false,
    Widget? suffixIcon,
    String? error,
    Function(String)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          decoration: BoxDecoration(
            color: inputBg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: error != null ? const Color(0xFFEF4444) : borderColor,
              width: 1.2,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            children: [
              Icon(icon, color: Colors.grey.shade600, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: keyboardType,
                  obscureText: obscureText,
                  onChanged: onChanged,
                  style: TextStyle(fontSize: 15, color: primaryBlack),
                  decoration: InputDecoration(
                    hintText: hint,
                    hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
              if (suffixIcon != null) suffixIcon,
            ],
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 12),
            child: Text(error, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
          ),
      ],
    );
  }
}
