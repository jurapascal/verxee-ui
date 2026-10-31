<?php
// Copy to sso.config.php (keep it OUT of git and out of the auto-deploy), fill in the secrets.
return [
    'providers' => [
        // Alba Rosa Hub — register the app in the hub first; it gives you client_id + client_secret.
        'hub' => [
            'issuer' => 'https://alba-rosa.cz/hub',
            'client_id' => 'my-app',
            'client_secret' => 'from-the-hub',
            'label' => 'Alba Rosa Hub',
        ],
        // Google — console.cloud.google.com → APIs & Services → Credentials → OAuth client (Web application).
        'google' => [
            'client_id' => '1234-abc.apps.googleusercontent.com',
            'client_secret' => 'from-google',
            // 'hd' => 'example.com', // only Google Workspace accounts of this domain
        ],
    ],
    // One callback for all providers; must be registered EXACTLY like this at every provider.
    'redirect_uri' => 'https://alba-rosa.cz/my-app/auth.php',
    // Optional gate on top of the app's own user table:
    // 'allowed_domains' => ['alba-rosa.cz'],
    // 'allowed_emails' => ['someone@gmail.com'],
];
