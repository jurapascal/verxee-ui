<?php
// Minimal OpenID Connect provider for tests ONLY (php -S 127.0.0.1:PORT tests/sso/fake-idp.php).
// State lives in files under $DIR; behaviour switches via $DIR/mode.json written by run.php.
declare(strict_types=1);
$DIR = getenv('FAKE_IDP_DIR') ?: sys_get_temp_dir() . '/vx-fake-idp';
@mkdir($DIR, 0700, true);
$ISS = 'http://' . $_SERVER['HTTP_HOST'];
$mode = is_file("$DIR/mode.json") ? json_decode(file_get_contents("$DIR/mode.json"), true) : [];
$b64u = fn (string $r): string => rtrim(strtr(base64_encode($r), '+/', '-_'), '=');
if (!is_file("$DIR/key.pem")) { $k = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]); openssl_pkey_export($k, $pem); file_put_contents("$DIR/key.pem", $pem); }
$key = openssl_pkey_get_private(file_get_contents("$DIR/key.pem"));
$det = openssl_pkey_get_details($key);
$json = function ($d, int $code = 200) { http_response_code($code); header('Content-Type: application/json'); echo json_encode($d); exit; };
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path === '/.well-known/openid-configuration') $json([
    'issuer' => $mode['issuer'] ?? $ISS, 'authorization_endpoint' => "$ISS/authorize", 'token_endpoint' => "$ISS/token",
    'jwks_uri' => "$ISS/jwks", 'end_session_endpoint' => "$ISS/logout", 'code_challenge_methods_supported' => ['S256'],
]);
if ($path === '/jwks') $json(['keys' => [['kty' => 'RSA', 'use' => 'sig', 'alg' => 'RS256', 'kid' => 'k1', 'n' => $b64u($det['rsa']['n']), 'e' => $b64u($det['rsa']['e'])]]]);
if ($path === '/authorize') {
    $q = $_GET;
    $back = $q['redirect_uri'] . '?';
    if (($q['prompt'] ?? '') === 'none' && !empty($mode['logged_out'])) { header('Location: ' . $back . http_build_query(['error' => 'login_required', 'state' => $q['state']]), true, 302); exit; }
    $code = bin2hex(random_bytes(8));
    file_put_contents("$DIR/code-$code.json", json_encode($q));
    header('Location: ' . $back . http_build_query(['code' => $code, 'state' => $q['state'], 'iss' => $ISS]), true, 302);
    exit;
}
if ($path === '/token') {
    [$id, $secret] = array_map('rawurldecode', explode(':', base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'] ?? '', 6)), 2) + [1 => '']);
    if ($id !== 'app1' || $secret !== 's3cret') $json(['error' => 'invalid_client'], 401);
    $f = "$DIR/code-" . preg_replace('/[^a-f0-9]/', '', $_POST['code'] ?? '') . '.json';
    if (!is_file($f)) $json(['error' => 'invalid_grant'], 400);
    $a = json_decode(file_get_contents($f), true); unlink($f);
    if ($a['redirect_uri'] !== ($_POST['redirect_uri'] ?? '')) $json(['error' => 'invalid_grant'], 400);
    if ($b64u(hash('sha256', $_POST['code_verifier'] ?? '', true)) !== $a['code_challenge']) $json(['error' => 'invalid_grant', 'error_description' => 'pkce'], 400);
    $claims = array_merge(['iss' => $ISS, 'aud' => 'app1', 'sub' => 'u-42', 'email' => 'jane@alba-rosa.cz', 'email_verified' => true, 'name' => 'Jane Doe',
        'nonce' => $a['nonce'], 'iat' => time(), 'exp' => time() + 300, 'roles' => ['admin']], $mode['claims'] ?? []);
    $h = $b64u(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => 'k1'])); $p = $b64u(json_encode($claims));
    openssl_sign("$h.$p", $sig, $key, OPENSSL_ALGO_SHA256);
    if (!empty($mode['bad_sig'])) $sig = strrev($sig);
    $json(['access_token' => 'x', 'token_type' => 'Bearer', 'id_token' => "$h.$p." . $b64u($sig)]);
}
http_response_code(404);
