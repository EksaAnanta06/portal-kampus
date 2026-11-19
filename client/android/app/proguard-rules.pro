# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve Capacitor bridge and Javascript interfaces
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.Bridge { *; }

# Keep all Capacitor plugins
-keep class id.ac.pasim.portal.** { *; }

# Keep enum methods for plugins
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Preserve line numbers for debugging stack traces
-keepattributes SourceFile,LineNumberTable
