<?php

declare(strict_types=1);

/**
 * Verxee SSO — OpenID Connect sign-in for PHP apps ("Sign in with Alba Rosa Hub", "Sign in with Google", any OIDC provider).
 *
 * One file, no dependencies (PHP 8.1+, ext-openssl, ext-curl). Authorization code flow + PKCE S256, state, nonce,
 * RS256 id_token verified against the provider's JWKS. The app keeps its own users and roles; the provider only
 * says WHO the person is (verified e-mail + stable `sub`).
 *
 *   $sso = new VerxeeSso(require __DIR__ . '/sso.config.php');
 *   header('Location: ' . $sso->start('hub', ['return' => $_GET['return'] ?? '/', 'prompt' => $_GET['prompt'] ?? null]));
 *   …
 *   $id = $sso->finish($_GET);   // ['provider','sub','email','name','picture','roles','claims','return','id_token']
 *
 * Errors throw VerxeeSsoError; ->reason is machine-readable ('login_required' for a failed silent sign-in),
 * ->getMessage() is safe to show to people. See docs/sso.html.
 */
final class VerxeeSsoError extends RuntimeException
{
    public function __construct(string $message, public readonly string $reason = 'error', public readonly string $returnTo = '')
    {
        parent::__construct($message);
    }
}

final class VerxeeSso
{
    public const VERSION = '1.0.0';

    /** Known providers: only issuer + quirks; client_id/secret always come from your config. */
    private const PRESETS = [
        'google' => ['issuer' => 'https://accounts.google.com', 'issuer_aliases' => ['accounts.google.com'], 'label' => 'Google'],
    ];
    private const SILENT_ERRORS = ['login_required', 'interaction_required', 'consent_required', 'account_selection_required'];
    private const SESSION_KEY = '_verxee_sso';
    private const FLOW_TTL = 600;

    /** @var array<string, array<string, mixed>> */
    private array $providers = [];
    private string $redirectUri;
    private string $cacheDir;
    /** @var list<string> */
    private array $allowedEmails;
    /** @var list<string> */
    private array $allowedDomains;
    private bool $allowHttp;
    private int $leeway;

    /**
     * @param array{
     *   providers: array<string, array{issuer?: string, client_id: string, client_secret?: string, scope?: string, hd?: string, label?: string}>,
     *   redirect_uri: string,
     *   allowed_emails?: list<string>, allowed_domains?: list<string>,
     *   cache_dir?: string, allow_http?: bool, leeway?: int
     * } $config
     */
    public function __construct(array $config)
    {
        foreach ($config['providers'] ?? [] as $id => $p) {
            $p = array_merge(self::PRESETS[$id] ?? [], $p);
            if (!preg_match('/^[a-z0-9_-]{1,32}$/', (string) $id) || empty($p['issuer']) || empty($p['client_id'])) {
                throw new InvalidArgumentException("Verxee SSO: provider '$id' needs issuer and client_id.");
            }
            $p['issuer'] = rtrim((string) $p['issuer'], '/');
            $this->providers[(string) $id] = $p;
        }
        if (!$this->providers) throw new InvalidArgumentException('Verxee SSO: no providers configured.');
        $this->redirectUri = (string) ($config['redirect_uri'] ?? '');
        if ($this->redirectUri === '') throw new InvalidArgumentException('Verxee SSO: redirect_uri is required.');
        $this->allowedEmails = array_values(array_map('strtolower', $config['allowed_emails'] ?? []));
        $this->allowedDomains = array_values(array_map(fn ($d) => strtolower(ltrim((string) $d, '@')), $config['allowed_domains'] ?? []));
        $this->allowHttp = (bool) ($config['allow_http'] ?? false); // only for local tests
        $this->leeway = (int) ($config['leeway'] ?? 60);
        $this->cacheDir = rtrim((string) ($config['cache_dir'] ?? sys_get_temp_dir() . '/verxee-sso-' . substr(hash('sha256', __DIR__), 0, 12)), '/');
    }

    /** @return list<string> configured provider ids */
    public function providers(): array { return array_keys($this->providers); }

    public function label(string $provider): string { return (string) ($this->providers[$provider]['label'] ?? $provider); }

    // ───────────────────────── sign-in ─────────────────────────

    /**
     * Begin sign-in: returns the URL to send the browser to (303). Needs an active PHP session.
     * @param array{return?: ?string, prompt?: ?string, login_hint?: ?string, max_age?: ?int} $opt
     */
    public function start(string $provider, array $opt = []): string
    {
        $p = $this->provider($provider);
        $this->needSession();
        $d = $this->discovery($p);
        $state = self::rand(); $nonce = self::rand(); $verifier = self::rand(48);
        $flows = array_filter((array) ($_SESSION[self::SESSION_KEY] ?? []), fn ($f) => is_array($f) && time() - (int) ($f['t'] ?? 0) < self::FLOW_TTL);
        $flows = array_slice($flows, -4, null, true); // a few parallel tabs, never unbounded
        $flows[$state] = ['p' => $provider, 'n' => $nonce, 'v' => $verifier, 't' => time(), 'r' => self::safeReturn($opt['return'] ?? null)];
        $_SESSION[self::SESSION_KEY] = $flows;

        $q = [
            'response_type' => 'code', 'client_id' => $p['client_id'], 'redirect_uri' => $this->redirectUri,
            'scope' => $p['scope'] ?? 'openid email profile', 'state' => $state, 'nonce' => $nonce,
            'code_challenge' => self::b64u(hash('sha256', $verifier, true)), 'code_challenge_method' => 'S256',
        ];
        $prompt = (string) ($opt['prompt'] ?? '');
        if (in_array($prompt, ['none', 'login', 'consent', 'select_account'], true)) $q['prompt'] = $prompt;
        if (!empty($opt['login_hint'])) $q['login_hint'] = (string) $opt['login_hint'];
        if (isset($opt['max_age'])) $q['max_age'] = (string) (int) $opt['max_age'];
        if (!empty($p['hd'])) $q['hd'] = (string) $p['hd']; // Google Workspace domain hint (still checked in finish)
        $ep = (string) $d['authorization_endpoint'];
        return $ep . (str_contains($ep, '?') ? '&' : '?') . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Finish sign-in on the redirect_uri. Returns the verified identity or throws VerxeeSsoError.
     * Regenerate the session id after this (VerxeeSso::login() helper does it) before storing the user.
     * @param array<string, mixed> $query usually $_GET
     * @return array{provider: string, sub: string, email: string, name: string, picture: string, roles: list<string>, claims: array<string, mixed>, return: string, id_token: string}
     */
    public function finish(array $query): array
    {
        $this->needSession();
        $state = (string) ($query['state'] ?? '');
        $flows = (array) ($_SESSION[self::SESSION_KEY] ?? []);
        $flow = $state !== '' && isset($flows[$state]) && is_array($flows[$state]) ? $flows[$state] : null;
        if ($flow !== null) { unset($flows[$state]); $_SESSION[self::SESSION_KEY] = $flows; } // single use
        if ($flow === null || time() - (int) $flow['t'] > self::FLOW_TTL) {
            throw new VerxeeSsoError('Sign-in expired or belongs to another browser. Start again.', 'state');
        }
        $ret = (string) $flow['r'];
        if (isset($query['error'])) {
            $e = preg_replace('/[^a-z_]/', '', (string) $query['error']);
            if (in_array($e, self::SILENT_ERRORS, true)) throw new VerxeeSsoError('Not signed in at the provider.', 'login_required', $ret);
            throw new VerxeeSsoError($e === 'access_denied' ? 'Sign-in was cancelled.' : 'The provider refused the sign-in (' . $e . ').', $e ?: 'error', $ret);
        }
        $p = $this->provider((string) $flow['p']);
        if (isset($query['iss']) && !$this->issuerMatches($p, (string) $query['iss'])) throw new VerxeeSsoError('Answer came from an unexpected server.', 'iss', $ret);
        $code = (string) ($query['code'] ?? '');
        if ($code === '') throw new VerxeeSsoError('The provider returned no code.', 'code', $ret);

        $d = $this->discovery($p);
        $post = ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $this->redirectUri, 'code_verifier' => (string) $flow['v']];
        $secret = (string) ($p['client_secret'] ?? '');
        $basic = null;
        if ($secret !== '' && ($p['auth_method'] ?? 'basic') === 'basic') $basic = [(string) $p['client_id'], $secret];
        else { $post['client_id'] = (string) $p['client_id']; if ($secret !== '') $post['client_secret'] = $secret; }
        $tok = $this->http((string) $d['token_endpoint'], $post, $basic);
        $jwt = $tok['id_token'] ?? null;
        if (!is_string($jwt)) throw new VerxeeSsoError('The provider returned no id_token.', 'token', $ret);

        $claims = $this->verify($p, $jwt, (string) $flow['n']);
        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        $verified = $claims['email_verified'] ?? false;
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new VerxeeSsoError('The provider did not send an e-mail address.', 'email', $ret);
        if ($verified !== true && $verified !== 'true') throw new VerxeeSsoError('The e-mail address is not verified at the provider.', 'email', $ret);
        if (!empty($p['hd']) && ($claims['hd'] ?? '') !== $p['hd']) throw new VerxeeSsoError('This account is not from the allowed organisation.', 'denied', $ret);
        if (!$this->emailAllowed($email)) throw new VerxeeSsoError('This account has no access to the app.', 'denied', $ret);

        $roles = $claims['roles'] ?? [];
        return [
            'provider' => (string) $flow['p'], 'sub' => (string) $claims['sub'], 'email' => $email,
            'name' => (string) ($claims['name'] ?? trim(($claims['given_name'] ?? '') . ' ' . ($claims['family_name'] ?? ''))),
            'picture' => (string) ($claims['picture'] ?? ''),
            'roles' => is_array($roles) ? array_values(array_filter($roles, 'is_string')) : [],
            'claims' => $claims, 'return' => $ret, 'id_token' => $jwt,
        ];
    }

    /** URL that also signs the person out at the provider (RP-initiated logout), or null if it has none. */
    public function logoutUrl(string $provider, string $postLogoutRedirect = '', string $idTokenHint = ''): ?string
    {
        $d = $this->discovery($this->provider($provider));
        $ep = $d['end_session_endpoint'] ?? null;
        if (!is_string($ep) || $ep === '') return null;
        $q = array_filter(['client_id' => $this->providers[$provider]['client_id'], 'post_logout_redirect_uri' => $postLogoutRedirect, 'id_token_hint' => $idTokenHint]);
        return $ep . (str_contains($ep, '?') ? '&' : '?') . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
    }

    // ───────────────────────── helpers for apps ─────────────────────────

    /**
     * Start the PHP session with safe cookie flags.
     * $crossSiteFrame = true when the app is on ANOTHER site than the hub (e.g. accom.ubysys.tech inside alba-rosa.cz/hub):
     * then the cookie must be SameSite=None; Secure; Partitioned or browsers drop it inside the iframe.
     * Same site (alba-rosa.cz/app inside alba-rosa.cz/hub) keeps the default SameSite=Lax.
     */
    public static function sessionStart(string $name = 'VXSESSID', bool $crossSiteFrame = false, string $path = '/'): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        $https = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        session_name($name);
        session_set_cookie_params([
            'lifetime' => 0, 'path' => $path, 'secure' => $https || $crossSiteFrame, 'httponly' => true,
            // PHP < 8.5 has no "partitioned" option; the attribute rides along in samesite (CHIPS).
            'samesite' => $crossSiteFrame ? 'None; Partitioned' : 'Lax',
        ]);
        session_start();
    }

    /** Store the signed-in user after finish(): new session id (no fixation), then your user array. */
    public static function login(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        $_SESSION['since'] = time();
    }

    /** Only local paths ("/app/x?y#z"); anything else → $default. Prevents open redirects. */
    public static function safeReturn(mixed $r, string $default = '/'): string
    {
        $r = is_string($r) ? trim($r) : '';
        if ($r === '' || $r[0] !== '/' || str_starts_with($r, '//') || str_contains($r, '\\') || preg_match('/[\x00-\x1f]/', $r)) return $default;
        return $r;
    }

    /** Append vx_sso=ok|fail for the Verxee UI sign-in screen (it strips the flag again). */
    public static function withResult(string $return, string $result): string
    {
        $hash = '';
        if (($i = strpos($return, '#')) !== false) { $hash = substr($return, $i); $return = substr($return, 0, $i); }
        return $return . (str_contains($return, '?') ? '&' : '?') . 'vx_sso=' . rawurlencode($result) . $hash;
    }

    // ───────────────────────── internals ─────────────────────────

    /** @return array<string, mixed> */
    private function provider(string $id): array
    {
        if (!isset($this->providers[$id])) throw new VerxeeSsoError('Unknown sign-in provider.', 'provider');
        return $this->providers[$id];
    }

    private function needSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) throw new LogicException('Verxee SSO needs an active PHP session (VerxeeSso::sessionStart()).');
    }

    private function issuerMatches(array $p, string $iss): bool
    {
        $iss = rtrim($iss, '/');
        return hash_equals($p['issuer'], $iss) || in_array($iss, (array) ($p['issuer_aliases'] ?? []), true);
    }

    private function emailAllowed(string $email): bool
    {
        if (!$this->allowedEmails && !$this->allowedDomains) return true;
        if (in_array($email, $this->allowedEmails, true)) return true;
        return in_array(substr(strrchr($email, '@') ?: '', 1), $this->allowedDomains, true);
    }

    /** @return array<string, mixed> */
    private function discovery(array $p): array
    {
        $d = $this->cached('disc-' . $p['issuer'], 3600, fn () => $this->http($p['issuer'] . '/.well-known/openid-configuration'));
        if (!$this->issuerMatches($p, (string) ($d['issuer'] ?? ''))) throw new VerxeeSsoError('The provider reports a different issuer than configured.', 'discovery');
        foreach (['authorization_endpoint', 'token_endpoint', 'jwks_uri'] as $k) {
            if (!is_string($d[$k] ?? null) || !$this->urlOk($d[$k])) throw new VerxeeSsoError('Provider discovery is incomplete.', 'discovery');
        }
        $pkce = (array) ($d['code_challenge_methods_supported'] ?? ['S256']); // Google omits it but supports S256
        if (!in_array('S256', $pkce, true)) throw new VerxeeSsoError('The provider does not support PKCE S256.', 'discovery');
        return $d;
    }

    /** @return array<string, mixed> claims */
    private function verify(array $p, string $jwt, string $nonce): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) throw new VerxeeSsoError('Invalid sign-in token.', 'token');
        $h = json_decode(self::b64uDec($parts[0]), true);
        $c = json_decode(self::b64uDec($parts[1]), true);
        $sig = self::b64uDec($parts[2]);
        if (!is_array($h) || !is_array($c)) throw new VerxeeSsoError('Invalid sign-in token.', 'token');
        if (($h['alg'] ?? '') !== 'RS256') throw new VerxeeSsoError('Unsupported token signature.', 'token');

        $jwksUri = (string) $this->discovery($p)['jwks_uri'];
        $ok = false;
        foreach ([false, true] as $refresh) { // unknown kid → fetch JWKS once more (key rotation)
            $jwks = $this->cached('jwks-' . $jwksUri, $refresh ? 0 : 3600, fn () => $this->http($jwksUri));
            foreach ((array) ($jwks['keys'] ?? []) as $k) {
                if (!is_array($k) || ($k['kty'] ?? '') !== 'RSA' || ($k['use'] ?? 'sig') !== 'sig') continue;
                if (isset($h['kid']) && ($k['kid'] ?? null) !== $h['kid']) continue;
                $pub = openssl_pkey_get_public(self::jwkToPem($k));
                if ($pub !== false && openssl_verify($parts[0] . '.' . $parts[1], $sig, $pub, OPENSSL_ALGO_SHA256) === 1) { $ok = true; break 2; }
            }
        }
        if (!$ok) throw new VerxeeSsoError('Token signature does not match.', 'token');

        $now = time();
        if (!$this->issuerMatches($p, (string) ($c['iss'] ?? ''))) throw new VerxeeSsoError('Token was issued by an unexpected server.', 'token');
        $aud = (array) ($c['aud'] ?? []);
        if (!in_array($p['client_id'], $aud, true) || (count($aud) > 1 && ($c['azp'] ?? '') !== $p['client_id'])) throw new VerxeeSsoError('Token is not meant for this app.', 'token');
        if (!is_numeric($c['exp'] ?? null) || (int) $c['exp'] + $this->leeway < $now) throw new VerxeeSsoError('Sign-in expired. Try again.', 'token');
        if (is_numeric($c['iat'] ?? null) && (int) $c['iat'] - $this->leeway > $now) throw new VerxeeSsoError('Token is from the future (clock skew).', 'token');
        if (!hash_equals($nonce, (string) ($c['nonce'] ?? ''))) throw new VerxeeSsoError('Sign-in does not belong to this browser.', 'token');
        if ((string) ($c['sub'] ?? '') === '') throw new VerxeeSsoError('Token has no user id.', 'token');
        return $c;
    }

    private function urlOk(string $u): bool
    {
        return str_starts_with($u, 'https://') || ($this->allowHttp && str_starts_with($u, 'http://'));
    }

    /** @return array<string, mixed> */
    private function http(string $url, ?array $post = null, ?array $basic = null): array
    {
        if (!$this->urlOk($url)) throw new VerxeeSsoError('Provider address must be https.', 'http');
        $ch = curl_init($url);
        $hdr = ['Accept: application/json'];
        $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_FOLLOWLOCATION => false,
              CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | ($this->allowHttp ? CURLPROTO_HTTP : 0)];
        if ($post !== null) { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = http_build_query($post); $hdr[] = 'Content-Type: application/x-www-form-urlencoded'; }
        if ($basic) $hdr[] = 'Authorization: Basic ' . base64_encode(rawurlencode($basic[0]) . ':' . rawurlencode($basic[1]));
        $o[CURLOPT_HTTPHEADER] = $hdr;
        curl_setopt_array($ch, $o);
        $res = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $j = is_string($res) ? json_decode($res, true) : null;
        if (!is_array($j) || $code >= 400) {
            error_log('Verxee SSO: ' . strtok($url, '?') . ' → HTTP ' . $code . (is_array($j) && isset($j['error']) ? ' ' . preg_replace('/[^a-z_]/', '', (string) $j['error']) : ''));
            throw new VerxeeSsoError('The sign-in server is not answering. Try again in a moment.', 'http');
        }
        return $j;
    }

    /** Small file cache for discovery + JWKS (public data only). @return array<string, mixed> */
    private function cached(string $key, int $ttl, callable $load): array
    {
        $f = $this->cacheDir . '/' . hash('sha256', $key) . '.json';
        if ($ttl > 0 && is_file($f) && time() - (int) filemtime($f) < $ttl) {
            $j = json_decode((string) file_get_contents($f), true);
            if (is_array($j)) return $j;
        }
        $j = $load();
        if (!is_dir($this->cacheDir)) @mkdir($this->cacheDir, 0700, true);
        @file_put_contents($f, json_encode($j), LOCK_EX);
        return $j;
    }

    private static function rand(int $bytes = 32): string { return self::b64u(random_bytes($bytes)); }
    private static function b64u(string $raw): string { return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }
    private static function b64uDec(string $s): string
    {
        $r = preg_match('/^[A-Za-z0-9_-]*$/', $s) ? base64_decode(strtr($s, '-_', '+/'), true) : false;
        if ($r === false) throw new VerxeeSsoError('Invalid sign-in token.', 'token');
        return $r;
    }

    /** RSA JWK → PEM public key (DER by hand, no libraries). */
    private static function jwkToPem(array $k): string
    {
        $len = static function (int $n): string { if ($n < 128) return chr($n); $b = ltrim(pack('N', $n), "\0"); return chr(0x80 | strlen($b)) . $b; };
        $int = static function (string $raw) use ($len): string { $raw = ltrim($raw, "\0"); if ($raw === '' || ord($raw[0]) > 0x7f) $raw = "\0" . $raw; return "\x02" . $len(strlen($raw)) . $raw; };
        $seq = static fn (string $b): string => "\x30" . $len(strlen($b)) . $b;
        $rsa = $seq($int(self::b64uDec((string) ($k['n'] ?? ''))) . $int(self::b64uDec((string) ($k['e'] ?? ''))));
        $spki = $seq($seq("\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00") . "\x03" . $len(strlen($rsa) + 1) . "\0" . $rsa);
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($spki), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
}
