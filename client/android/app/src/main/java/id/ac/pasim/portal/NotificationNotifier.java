package id.ac.pasim.portal;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

public final class NotificationNotifier {

    public static final String PREFS_NAME = "pasim_bg_push";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_SERVER_URL = "server_url";
    public static final String KEY_STREAM_TOKEN = "stream_token";
    public static final String KEY_LAST_NOTIF_ID = "last_notif_id";
    public static final String EXTRA_REFERENCE_LINK = "pasim_reference_link";

    public static final String CHANNEL_GENERAL = "pasim_general";
    public static final String CHANNEL_FOCUS = "pasim_focus";
    private static final String LEGACY_CHANNEL_BG = "pasim_bg_service";
    private static final int LEGACY_SERVICE_NOTIF_ID = 899999;
    private static final String BRAND_COLOR_HEX = "#8B1E24";

    private static final Object NOTIF_ID_LOCK = new Object();
    private static volatile Bitmap cachedLargeIcon = null;

    private NotificationNotifier() {}

    public static void cleanupLegacyServiceNotification(Context context) {
        if (context == null) return;
        try {
            NotificationManagerCompat.from(context).cancel(LEGACY_SERVICE_NOTIF_ID);
        } catch (Exception ignored) {}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                try {
                    nm.deleteNotificationChannel(LEGACY_CHANNEL_BG);
                } catch (Exception ignored) {}
            }
        }
    }

    public static void ensureChannels(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
            (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        NotificationChannel generalChannel = new NotificationChannel(
            CHANNEL_GENERAL,
            "Notifikasi Portal Kampus",
            NotificationManager.IMPORTANCE_HIGH
        );
        generalChannel.setDescription("Info kampus, materi, komentar, suka, dan aktivitas akun.");
        generalChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        generalChannel.enableVibration(true);
        manager.createNotificationChannel(generalChannel);

        NotificationChannel focusChannel = new NotificationChannel(
            CHANNEL_FOCUS,
            "Timer Fokus & Pengingat Belajar",
            NotificationManager.IMPORTANCE_HIGH
        );
        focusChannel.setDescription("Alarm sesi Pomodoro dan pengingat jadwal/deadline tugas.");
        focusChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        focusChannel.enableVibration(true);
        manager.createNotificationChannel(focusChannel);
    }

    public static long getLastNotifId(Context context) {
        synchronized (NOTIF_ID_LOCK) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return Math.max(0L, prefs.getLong(KEY_LAST_NOTIF_ID, 0L));
        }
    }

    public static long updateLastNotifIdMonotonic(Context context, long candidateId) {
        synchronized (NOTIF_ID_LOCK) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            long current = Math.max(0L, prefs.getLong(KEY_LAST_NOTIF_ID, 0L));
            long next = Math.max(current, Math.max(0L, candidateId));
            if (next != current) {
                prefs.edit().putLong(KEY_LAST_NOTIF_ID, next).apply();
            }
            return next;
        }
    }

    public static boolean markIfNewNotification(Context context, long incomingId) {
        if (incomingId <= 0L) return false;
        synchronized (NOTIF_ID_LOCK) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            long current = Math.max(0L, prefs.getLong(KEY_LAST_NOTIF_ID, 0L));
            if (incomingId <= current) {
                return false;
            }
            prefs.edit().putLong(KEY_LAST_NOTIF_ID, incomingId).apply();
            return true;
        }
    }

    public static void clearAuthAndDisable(Context context) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean(KEY_ENABLED, false).remove(KEY_STREAM_TOKEN).apply();
    }

    public static String normalizeServerOrigin(String raw) {
        if (raw == null) return "";
        String cleaned = raw.trim();
        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        if (cleaned.endsWith("/api/v1")) {
            cleaned = cleaned.substring(0, cleaned.length() - "/api/v1".length());
        }
        while (cleaned.endsWith("/")) {
            cleaned = cleaned.substring(0, cleaned.length() - 1);
        }
        return cleaned;
    }

    private static Bitmap getLargeIconBitmap(Context context) {
        if (cachedLargeIcon == null) {
            try {
                cachedLargeIcon =
                    BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_notif_pasim);
            } catch (Exception ignored) {
                cachedLargeIcon = null;
            }
        }
        return cachedLargeIcon;
    }

    public static void postUserNotification(Context context, JSONObject json, long notifId) {
        if (context == null || json == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                return;
            }
        }

        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        if (!nm.areNotificationsEnabled()) {
            return;
        }

        ensureChannels(context);

        String type = json.optString("type", "system");
        String channelId = ("focus_reminder".equals(type) || "task_deadline".equals(type))
            ? CHANNEL_FOCUS
            : CHANNEL_GENERAL;
        String title = json.optString("title", "Portal Pasim");
        if (title.isEmpty() || "null".equalsIgnoreCase(title)) title = "Portal Pasim";
        String body = json.optString("message", "");
        if ("null".equalsIgnoreCase(body)) body = "";

        int androidNotifId = (int) (500000L + (Math.max(1L, notifId) % 390000L));

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setAction(Intent.ACTION_MAIN);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        String refLink = json.optString("reference_link", "");
        if (!refLink.isEmpty() && !"null".equalsIgnoreCase(refLink)) {
            launchIntent.putExtra(EXTRA_REFERENCE_LINK, refLink);
        }

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            androidNotifId,
            launchIntent,
            pendingFlags
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_pasim)
            .setColor(Color.parseColor(BRAND_COLOR_HEX))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(false)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);

        Bitmap largeIcon = getLargeIconBitmap(context);
        if (largeIcon != null) {
            builder.setLargeIcon(largeIcon);
        }

        nm.notify(androidNotifId, builder.build());
    }
}
