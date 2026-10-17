pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            file("local.properties").takeIf { it.exists() }?.inputStream()?.use { properties.load(it) }
            val prop = properties.getProperty("flutter.sdk")
            if (prop != null && file(prop).exists()) prop else "D:/flutter"
        }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.7.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.0" apply false
}

include(":app")
