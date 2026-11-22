package id.ac.pasim.portal;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativePushService")
public class NativePushServicePlugin extends Plugin {

    private static final String TAG = "PasimPushPlugin";

    private static volatile NativePushServicePlugin activeInstance = null;
    private static volatile String pendingLink = null;
    private static volatile boolean appInForeground = false;
    private static volatile boolean sseConnected = false;

    private volatile boolean sseRunning = false;
    private volatile HttpURLConnection activeConn = null;
    private Thread sseThread = null;
    private String activeServerUrl = null;
    private String activeStreamToken = null;

    @Override
    public void load() {
        super.load();
        activeInstance = this;
        appInForeground = true;
        NotificationNotifier.cleanupLegacyServiceNotification(getContext());
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        appInForeground = true;
        startForegroundSseIfConfigured();
    }

    @Override
    protected void handleOnStop() {
        appInForeground = false;
        stopForegroundSse();
        NotificationPollReceiver.scheduleNext(
            getContext(),
            NotificationPollReceiver.INITIAL_BG_DELAY_MS
        );
        super.handleOnStop();
    }

    @Override
    protected void handleOnDestroy() {
        appInForeground = false;
        stopForegroundSse();
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void startService(PluginCall call) {
        String rawServerUrl = call.getString("serverUrl", "");
        String streamToken = call.getString("streamToken", "");
        String normalizedOrigin = NotificationNotifier.normalizeServerOrigin(rawServerUrl);

        if (normalizedOrigin.isEmpty() || streamToken == null || streamToken.trim().isEmpty()) {
            call.reject("serverUrl dan streamToken wajib diisi.");
            return;
        }

        double lastIdDouble = call.getDouble("lastNotificationId", 0d);
        long lastNotificationId = Double.isFinite(lastIdDouble) ? (long) lastIdDouble : 0L;

        Context ctx = getContext();
        NotificationNotifier.cleanupLegacyServiceNotification(ctx);

        SharedPreferences prefs = ctx.getSharedPreferences(
            NotificationNotifier.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        prefs
            .edit()
            .putBoolean(NotificationNotifier.KEY_ENABLED, true)
            .putString(NotificationNotifier.KEY_SERVER_URL, normalizedOrigin)
            .putString(NotificationNotifier.KEY_STREAM_TOKEN, streamToken.trim())
            .apply();

        long storedLastId = NotificationNotifier.updateLastNotifIdMonotonic(ctx, lastNotificationId);

        NotificationPollReceiver.scheduleNext(ctx, NotificationPollReceiver.BG_POLL_INTERVAL_MS);
        restartSseIfNeeded(normalizedOrigin, streamToken.trim());

        JSObject ret = new JSObject();
        ret.put("started", true);
        ret.put("lastNotificationId", storedLastId);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        stopForegroundSse();
        Context ctx = getContext();
        NotificationNotifier.clearAuthAndDisable(ctx);
        NotificationPollReceiver.cancelScheduled(ctx);
        NotificationNotifier.cleanupLegacyServiceNotification(ctx);

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateLastNotificationId(PluginCall call) {
        double lastIdDouble = call.getDouble("lastNotificationId", 0d);
        long incoming = Double.isFinite(lastIdDouble) ? (long) lastIdDouble : 0L;
        long updated = NotificationNotifier.updateLastNotifIdMonotonic(getContext(), incoming);

        JSObject ret = new JSObject();
        ret.put("lastNotificationId", updated);
        call.resolve(ret);
    }

    @PluginMethod
    public void consumePendingLink(PluginCall call) {
        String link = pendingLink;
        pendingLink = null;
        JSObject ret = new JSObject();
        ret.put("link", link);
        call.resolve(ret);
    }

    @PluginMethod
    public void isConfigured(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            NotificationNotifier.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        boolean enabled = prefs.getBoolean(NotificationNotifier.KEY_ENABLED, false);
        String token = prefs.getString(NotificationNotifier.KEY_STREAM_TOKEN, "");
        JSObject ret = new JSObject();
        ret.put("configured", enabled && token != null && !token.trim().isEmpty());
        call.resolve(ret);
    }

    public static boolean isLiveSseActive() {
        return appInForeground && sseConnected;
    }

    private void startForegroundSseIfConfigured() {
        Context ctx = getContext();
        if (ctx == null) return;
        SharedPreferences prefs = ctx.getSharedPreferences(
            NotificationNotifier.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        boolean enabled = prefs.getBoolean(NotificationNotifier.KEY_ENABLED, false);
        String serverUrl = NotificationNotifier.normalizeServerOrigin(
            prefs.getString(NotificationNotifier.KEY_SERVER_URL, "")
        );
        String streamToken = prefs.getString(NotificationNotifier.KEY_STREAM_TOKEN, "");

        if (enabled && !serverUrl.isEmpty() && streamToken != null && !streamToken.trim().isEmpty()) {
            restartSseIfNeeded(serverUrl, streamToken.trim());
        }
    }

    private synchronized void restartSseIfNeeded(String serverOrigin, String streamToken) {
        if (!appInForeground) return;
        if (
            sseRunning &&
            sseThread != null &&
            sseThread.isAlive() &&
            serverOrigin.equals(activeServerUrl) &&
            streamToken.equals(activeStreamToken)
        ) {
            return;
        }
        stopForegroundSse();
        activeServerUrl = serverOrigin;
        activeStreamToken = streamToken;
        sseRunning = true;
        sseThread = new Thread(
            () -> runForegroundSseLoop(serverOrigin, streamToken),
            "PasimFgNotifStream"
        );
        sseThread.start();
    }

    private synchronized void stopForegroundSse() {
        sseRunning = false;
        sseConnected = false;
        activeServerUrl = null;
        activeStreamToken = null;
        HttpURLConnection conn = activeConn;
        activeConn = null;
        if (conn != null) {
            try {
                conn.disconnect();
            } catch (Exception ignored) {}
        }
        if (sseThread != null) {
            sseThread.interrupt();
            sseThread = null;
        }
    }

    private void runForegroundSseLoop(String serverOrigin, String streamToken) {
        long backoffMs = 3000L;
        Context appCtx = getContext() != null ? getContext().getApplicationContext() : null;
        if (appCtx == null) return;

        while (sseRunning && appInForeground) {
            HttpURLConnection conn = null;
            try {
                long afterId = NotificationNotifier.getLastNotifId(appCtx);
                String urlStr =
                    serverOrigin + "/api/v1/campus/notifications/stream?after_id=" + afterId;
                conn = (HttpURLConnection) new URL(urlStr).openConnection();
                activeConn = conn;
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(45000);
                conn.setUseCaches(false);
                conn.setRequestProperty("User-Agent", "PortalPasimApp/1.0 (Android; Mobile)");
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setRequestProperty("Cache-Control", "no-cache");
                conn.setRequestProperty("ngrok-skip-browser-warning", "true");
                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true");
                conn.setRequestProperty("X-Notification-Token", streamToken);

                int code = conn.getResponseCode();
                if (code == 401 || code == 403) {
                    Log.w(TAG, "Foreground SSE token revoked (" + code + ").");
                    NotificationNotifier.clearAuthAndDisable(appCtx);
                    NotificationPollReceiver.cancelScheduled(appCtx);
                    sseRunning = false;
                    sseConnected = false;
                    break;
                }

                if (code == 200) {
                    sseConnected = true;
                    backoffMs = 3000L;
                    try (
                        BufferedReader reader = new BufferedReader(
                            new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)
                        )
                    ) {
                        String currentEvent = "message";
                        StringBuilder dataBuf = new StringBuilder();
                        String line;
                        while (sseRunning && appInForeground && (line = reader.readLine()) != null) {
                            if (line.isEmpty()) {
                                if (dataBuf.length() > 0) {
                                    handleSseEvent(appCtx, currentEvent, dataBuf.toString());
                                    currentEvent = "message";
                                    dataBuf.setLength(0);
                                }
                            } else if (line.startsWith(":")) {
                                // SSE keepalive comment
                            } else if (line.startsWith("event:")) {
                                currentEvent = line.substring(6).trim();
                            } else if (line.startsWith("data:")) {
                                if (dataBuf.length() > 0) dataBuf.append('\n');
                                dataBuf.append(line.substring(5).trim());
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                if (sseRunning && appInForeground) {
                    Log.d(TAG, "Foreground SSE reconnecting: " + ex.getMessage());
                }
            } finally {
                sseConnected = false;
                activeConn = null;
                if (conn != null) {
                    try {
                        conn.disconnect();
                    } catch (Exception ignored) {}
                }
            }

            if (!sseRunning || !appInForeground) break;

            try {
                Thread.sleep(backoffMs);
            } catch (InterruptedException ignored) {
                if (!sseRunning || !appInForeground) break;
            }
            backoffMs = Math.min(15000L, backoffMs == 3000L ? 5000L : backoffMs + 5000L);
        }
    }

    private void handleSseEvent(Context appCtx, String eventName, String rawData) {
        if (!"notification".equals(eventName)) {
            return;
        }
        try {
            JSONObject json = new JSONObject(rawData);
            long notifId = json.optLong("id", 0L);
            if (!NotificationNotifier.markIfNewNotification(appCtx, notifId)) {
                return;
            }
            NotificationNotifier.postUserNotification(appCtx, json, notifId);
            emitIncomingNotification(json);
        } catch (Exception ex) {
            Log.w(TAG, "Failed parsing foreground SSE notification: " + ex.getMessage());
        }
    }

    public static void emitIncomingNotification(JSONObject notifJson) {
        NativePushServicePlugin instance = activeInstance;
        if (instance == null || notifJson == null) return;
        try {
            JSObject jsObj = JSObject.fromJSONObject(notifJson);
            instance.notifyListeners("notificationReceived", jsObj, false);
        } catch (Exception ignored) {}
    }

    public static void dispatchNotificationLink(String link) {
        if (link == null || link.trim().isEmpty() || "null".equalsIgnoreCase(link.trim())) {
            return;
        }
        String cleanLink = link.trim();
        NativePushServicePlugin instance = activeInstance;
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("link", cleanLink);
            instance.notifyListeners("notificationLinkTapped", data, true);
        } else {
            pendingLink = cleanLink;
        }
    }
}
