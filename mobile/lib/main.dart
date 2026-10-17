import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'constants/app_colors.dart';
import 'providers/auth_provider.dart';
import 'providers/device_provider.dart';
import 'providers/order_provider.dart';
import 'providers/smart_supply_provider.dart';
import 'screens/main_navigation.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SmartOrderApp());
}

class SmartOrderApp extends StatelessWidget {
  const SmartOrderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => DeviceProvider()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
        ChangeNotifierProvider(create: (_) => SmartSupplyProvider()..fetchAllHouseholdData()),
      ],
      child: MaterialApp(
        title: 'SmartSupply — IoT Household Platform',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.light,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            primary: AppColors.primary,
            surface: AppColors.surface,
          ),
          scaffoldBackgroundColor: AppColors.background,
          fontFamily: 'Roboto',
          cardTheme: CardThemeData(
            color: AppColors.surface,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.cardBorder),
            ),
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.white,
            foregroundColor: AppColors.textPrimary,
            elevation: 0,
            centerTitle: true,
          ),
        ),
        darkTheme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            brightness: Brightness.dark,
            primary: AppColors.primary,
            surface: AppColors.darkSurface,
          ),
          scaffoldBackgroundColor: AppColors.darkBackground,
          fontFamily: 'Roboto',
          cardTheme: CardThemeData(
            color: AppColors.darkSurface,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: AppColors.darkBorder),
            ),
          ),
          appBarTheme: const AppBarTheme(
            backgroundColor: AppColors.darkSurface,
            foregroundColor: AppColors.textLight,
            elevation: 0,
            centerTitle: true,
          ),
        ),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    // Loading → Show Splash Screen
    if (auth.loading) {
      return const SplashScreen();
    }

    // Not authenticated → Show Login Screen
    if (!auth.isAuthenticated) {
      return const LoginScreen();
    }

    // Authenticated → Route based on user role
    return _buildRoleBasedNavigation(auth);
  }

  Widget _buildRoleBasedNavigation(AuthProvider auth) {
    final role = auth.user?.role ?? 'CUSTOMER';

    switch (role) {
      case 'CUSTOMER':
        // Customer: 5-Tab Navigation (Home/Insights/Devices/Orders/Household)
        return const MainNavigation();

      case 'STORE_OWNER':
      case 'STORE_MANAGER':
      case 'STORE_STAFF':
        // Store: Hiện tại dùng Customer layout, sau này sẽ tạo StoreNavigation
        // TODO: Phase 3 — StoreMainNavigation
        return const MainNavigation();

      case 'SUPER_ADMIN':
        // Admin: Hiện tại dùng Customer layout, sau này sẽ tạo AdminNavigation
        // TODO: Phase 4 — AdminMainNavigation
        return const MainNavigation();

      case 'TECHNICIAN':
        // Technician: Hiện tại dùng Customer layout
        // TODO: Phase 4 — TechnicianNavigation
        return const MainNavigation();

      default:
        return const LoginScreen();
    }
  }
}
