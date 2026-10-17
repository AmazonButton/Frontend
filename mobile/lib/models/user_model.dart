class UserModel {
  final String id;
  final String email;
  final String? username;
  final String fullName;
  final String? phone;
  final String role;
  final String? customerProfileId;
  final String? storeId;
  final String? householdId;
  final bool emailVerified;
  final bool isActive;

  UserModel({
    required this.id,
    required this.email,
    this.username,
    required this.fullName,
    this.phone,
    required this.role,
    this.customerProfileId,
    this.storeId,
    this.householdId,
    this.emailVerified = false,
    this.isActive = true,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      username: json['username'],
      fullName: json['fullName'] ?? '',
      phone: json['phone'],
      role: json['role'] ?? 'CUSTOMER',
      customerProfileId: json['customerProfileId'],
      storeId: json['storeId'],
      householdId: json['householdId'],
      emailVerified: json['emailVerified'] ?? false,
      isActive: json['isActive'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'fullName': fullName,
      'phone': phone,
      'role': role,
      'customerProfileId': customerProfileId,
      'storeId': storeId,
      'householdId': householdId,
      'emailVerified': emailVerified,
      'isActive': isActive,
    };
  }

  bool get isCustomer => role == 'CUSTOMER';
  bool get isStoreRole => ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF'].contains(role);
  bool get isSuperAdmin => role == 'SUPER_ADMIN';
  bool get isTechnician => role == 'TECHNICIAN';
}
