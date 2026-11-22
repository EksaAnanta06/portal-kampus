package id.ac.pasim.portal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotificationBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        if (
            !Intent.ACTION_BOOT_COMPLETED.equals(action) &&
            !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
        ) {
            return;
        }

        NotificationNotifier.cleanupLegacyServiceNotification(context);
        NotificationPollReceiver.scheduleNext(
            context,
            NotificationPollReceiver.INITIAL_BG_DELAY_MS
        );
    }
}
