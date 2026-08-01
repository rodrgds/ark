# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# @generated begin expo-build-properties - expo prebuild (DO NOT MODIFY)
# React Native ExecuTorch reaches these Java classes from native JNI code.
# R8 cannot see those references and otherwise removes or renames the runtime.
-keep class org.pytorch.executorch.** { *; }
-keep class com.swmansion.rnexecutorch.** { *; }

# expo-task-manager loads its headless app loader reflectively by class name.
# R8 cannot see that reference and otherwise strips the class, breaking
# background headless tasks (background track recording) and logging errors
# on every app pause.
-keep class expo.modules.adapters.react.apploader.** { *; }

# ArkZim reaches libkiwix/libzim Java classes and native methods from JNI.
# Release R8 minification can otherwise rename symbols that debug builds keep.
-keep class org.kiwix.** { *; }
-keep class org.kiwix.libzim.** { *; }
-keepclasseswithmembernames class org.kiwix.** { native <methods>; }
-dontwarn org.kiwix.**

# PDFBox can reference the optional Gemalto JPEG2000 decoder when parsing PDFs.
# Ark does not bundle that decoder; OCR/text extraction paths handle failures.
-dontwarn com.gemalto.jp2.JP2Decoder

# Local Expo modules under modules/ (ark-routing, ark-ocr, ark-zim, ark-system-colors)
# are reached only through the ExpoModulesPackageList's modulesMap at
# runtime. R8 cannot see the reflective load() call, so the classes
# would otherwise be stripped from the release APK. Keep the entry
# classes and the JNI bridge that the ark-routing module talks to.
-keep class expo.modules.arkrouting.** { *; }
-keep class expo.modules.arkocr.** { *; }
-keep class expo.modules.arkzim.** { *; }
-keep class expo.modules.arksystemcolors.** { *; }
-keep class com.valhalla.valhalla.** { *; }
-keepclasseswithmembernames class com.valhalla.valhalla.** { native <methods>; }
# @generated end expo-build-properties