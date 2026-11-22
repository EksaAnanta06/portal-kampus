package id.ac.pasim.portal;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

public class NotificationPollReceiver extends BroadcastReceiver {

    private static final String TAG = "PasimNotifPoll";
    public static final int POLL_REQUEST_CODE = 899998;
    public static final long BG_POLL_INTERVAL_MS = 30_000L;
    public static final long INITIAL_BG_DELAY_MS = 15_000L;

    private static PendingIntent createPollPendingIntent(Context context) {
        Intent intent = new Intent(context, NotificationPollReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, POLL_REQUEST_CODE, intent, flags);
    }

    public static void scheduleNext(Context context, long delayMs) {
        if (context == null) return;
        Context appCtx = context.getApplicationContext();
        SharedPreferences prefs = appCtx.getSharedPreferences(
            NotificationNotifier.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        boolean enabled = prefs.getBoolean(NotificationNotifier.KEY_ENABLED, false);
        String serverUrl = NotificationNotifier.normalizeServerOrigin(
            prefs.getString(NotificationNotifier.KEY_SERVER_URL, "")
        );
        String streamToken = prefs.getString(NotificationNotifier.KEY_STREAM_TOKEN, "");

        if (!enabled || serverUrl.isEmpty() || streamToken == null || streamToken.trim().isEmpty()) {
            cancelScheduled(appCtx);
            return;
        }

        AlarmManager alarmManager = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long safeDelay = Math.max(5_000L, delayMs);
        long triggerAt = System.currentTimeMillis() + safeDelay;
        PendingIntent pi = createPollPendingIntent(appCtx);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        } catch (SecurityException se) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pi);
            }
        }
    }

    public static void cancelScheduled(Context context) {
        if (context == null) return;
        Context appCtx = context.getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) appCtx.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(createPollPendingIntent(appCtx));
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        final Context appCtx = context.getApplicationContext();

        SharedPreferences prefs = appCtx.getSharedPreferences(
            NotificationNotifier.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        boolean enabled = prefs.getBoolean(NotificationNotifier.KEY_ENABLED, false);
        final String serverOrigin = NotificationNotifier.normalizeServerOrigin(
            prefs.getString(NotificationNotifier.KEY_SERVER_URL, "")
        );
        final String streamToken = prefs.getString(NotificationNotifier.KEY_STREAM_TOKEN, "");

        if (!enabled || serverOrigin.isEmpty() || streamToken == null || streamToken.trim().isEmpty()) {
            cancelScheduled(appCtx);
            return;
        }

        // Pastikan siklus berikutnya tetap terjadwal meski koneksi sesekali gagal
        scheduleNext(appCtx, BG_POLL_INTERVAL_MS);

        // Jika stream SSE in-process foreground sedang tersambung, lewati polling HTTP
        if (NativePushServicePlugin.isLiveSseActive()) {
            return;
        }

        final PendingResult pendingResult = goAsync();
        final String cleanToken = streamToken.trim();

        new Thread(
            () -> {
                HttpURLConnection conn = null;
                try {
                    long afterId = NotificationNotifier.getLastNotifId(appCtx);
                    String urlStr =
                        serverOrigin + "/api/v1/campus/notifications/pending?after_id=" + afterId;
                    conn = (HttpURLConnection) new URL(urlStr).openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(3500);
                    conn.setReadTimeout(3500);
                    conn.setUseCaches(false);
                    conn.setRequestProperty("User-Agent", "PortalPasimApp/1.0 (Android; Mobile)");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setRequestProperty("ngrok-skip-browser-warning", "true");
                    conn.setRequestProperty("Bypass-Tunnel-Reminder", "true");
                    conn.setRequestProperty("X-Notification-Token", cleanToken);

                    int code = conn.getResponseCode();
                    if (code == 401 || code == 403) {
                        Log.w(TAG, "Poll token revoked (" + code + "), cancelling background poll.");
                        NotificationNotifier.clearAuthAndDisable(appCtx);
                        cancelScheduled(appCtx);
                        return;
                    }

                    if (code == 200) {
                        StringBuilder sb = new StringBuilder();
                        try (
                            BufferedReader reader = new BufferedReader(
                                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
                            )
                        ) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                sb.append(line);
                            }
                        }

                        JSONObject root = new JSONObject(sb.toString());
                        JSONObject data = root.optJSONObject("data");
                        if (data != null) {
                            long latestId = data.optLong("latestId", 0L);
                            if (afterId == 0L && latestId > 0L) {
                                NotificationNotifier.updateLastNotifIdMonotonic(appCtx, latestId);
                            }

                            JSONArray arr = data.optJSONArray("notifications");
                            if (arr != null) {
                                for (int i = 0; i < arr.length(); i++) {
                                    JSONObject notif = arr.optJSONObject(i);
                                    if (notif == null) continue;
                                    long nid = notif.optLong("id", 0L);
                                    if (NotificationNotifier.markIfNewNotification(appCtx, nid)) {
                                        NotificationNotifier.postUserNotification(appCtx, notif, nid);
                                        NativePushServicePlugin.emitIncomingNotification(notif);
                                    }
                                }
                            }
                        }
                    }
                } catch (Exception ex) {
                    Log.d(TAG, "Silent background poll failed: " + ex.getMessage());
                } finally {
                    if (conn != null) {
                        try {
                            conn.disconnect();
                        } catch (Exception ignored) {}
                    }
                    pendingResult.finish();
                }
            },
            "PasimNotifPoll"
        )
            .start();
    }
}
