package id.ac.pasim.portal;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePushServicePlugin.class);
        super.onCreate(savedInstanceState);
        NotificationNotifier.cleanupLegacyServiceNotification(this);
        dispatchLinkFromIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchLinkFromIntent(intent);
    }

    private void dispatchLinkFromIntent(Intent intent) {
        if (intent == null) return;
        String link = intent.getStringExtra(NotificationNotifier.EXTRA_REFERENCE_LINK);
        if (link != null && !link.trim().isEmpty()) {
            intent.removeExtra(NotificationNotifier.EXTRA_REFERENCE_LINK);
            NativePushServicePlugin.dispatchNotificationLink(link);
        }
    }
}
