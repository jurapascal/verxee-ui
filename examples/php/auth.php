<?php
// Reference sign-in endpoint for a PHP app using Verxee SSO. One file handles everything:
//   auth.php?provider=hub&return=/my-app/   → start (add &prompt=none for a silent try)
//   auth.php?code=…&state=…                 → callback from the provider
//   auth.php?logout=1                       → sign out (POST with CSRF in a real app)
//   auth.php?me=1                           → JSON of the signed-in user for VerxeeUI.app({ auth: { urls: { session } } })
declare(strict_types=1);
require __DIR__ . '/../../server/php/VerxeeSso.php';

VerxeeSso::sessionStart('MYAPPSESS', crossSiteFrame: false, path: '/');
$sso = new VerxeeSso(require __DIR__ . '/sso.config.php');

/** The app decides who may enter and with which role. Identity comes from the provider, roles stay here. */
function find_app_user(array $id): ?array
{
    $users = [ // in a real app: SELECT … FROM users WHERE email = ? (and remember $id['provider'] + $id['sub'])
        'admin@example.com' => ['name' => 'Jane Admin', 'permissions' => ['*']],
    ];
    $u = $users[$id['email']] ?? null;
    return $u ? $u + ['email' => $id['email'], 'sub' => $id['sub'], 'provider' => $id['provider']] : null;
}

header('Cache-Control: no-store');

if (isset($_GET['me'])) {
    header('Content-Type: application/json');
    $u = $_SESSION['user'] ?? null;
    if (!$u) { http_response_code(401); echo '{}'; exit; }
    echo json_encode(['name' => $u['name'], 'email' => $u['email'], 'permissions' => $u['permissions']]);
    exit;
}

if (isset($_GET['logout'])) {
    $provider = $_SESSION['user']['provider'] ?? null;
    $_SESSION = [];
    session_regenerate_id(true);
    // Signing out of the app only. To also leave the hub: header('Location: ' . $sso->logoutUrl($provider, 'https://…/'));
    header('Location: ./', true, 303);
    exit;
}

if (isset($_GET['code']) || isset($_GET['error'])) {
    try {
        $id = $sso->finish($_GET);
    } catch (VerxeeSsoError $e) {
        // silent attempt failed (not signed in at the hub) → back to the app, which shows its sign-in screen
        if ($e->reason === 'login_required') { header('Location: ' . VerxeeSso::withResult($e->returnTo ?: '/', 'fail'), true, 303); exit; }
        http_response_code(400);
        echo '<!doctype html><meta charset="utf-8"><title>Sign-in failed</title><p>' . htmlspecialchars($e->getMessage()) . '</p><p><a href="./">Back</a></p>';
        exit;
    }
    $user = find_app_user($id);
    if (!$user) { http_response_code(403); echo '<!doctype html><meta charset="utf-8"><p>Your account has no access to this app.</p>'; exit; }
    VerxeeSso::login($user);
    header('Location: ' . VerxeeSso::withResult($id['return'], 'ok'), true, 303);
    exit;
}

$provider = (string) ($_GET['provider'] ?? '');
try {
    header('Location: ' . $sso->start($provider, ['return' => $_GET['return'] ?? '/', 'prompt' => $_GET['prompt'] ?? null]), true, 303);
} catch (VerxeeSsoError $e) {
    http_response_code(400);
    echo '<!doctype html><meta charset="utf-8"><p>' . htmlspecialchars($e->getMessage()) . '</p>';
}
