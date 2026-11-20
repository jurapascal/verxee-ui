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
 *
 * Alba Rosa Hub extras (1.1, hub v1.7+):
 *   $id = $sso->passwordLogin('hub', $email, $password);    // the app's own sign-in form, checked against the hub password
 *   $ev = $sso->provisioning('hub', $_POST['token']);        // the hub creates / switches off accounts (POST to your provision URL)
 *   $gt = $sso->googleToken('hub', $id['sub'], ['calendar']); // Google access token of that person, from the hub
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
    public const VERSION = '1.1.0';

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
        $post = ['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => $this->redirectUri, 'code_verifier' => (string) $flow['v']] + $this->clientPost($p);
        $tok = $this->http((string) $d['token_endpoint'], $post, $this->clientBasic($p));
        $jwt = $tok['id_token'] ?? null;
        if (!is_string($jwt)) throw new VerxeeSsoError('The provider returned no id_token.', 'token', $ret);

        return $this->identity($p, (string) $flow['p'], $this->verify($p, $jwt, (string) $flow['n']), $jwt, $ret);
    }

    /** Checks the claims of a verified id_token and builds the identity array. */
    private function identity(array $p, string $provider, array $claims, string $jwt, string $ret): array
    {
        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        $verified = $claims['email_verified'] ?? false;
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new VerxeeSsoError('The provider did not send an e-mail address.', 'email', $ret);
        if ($verified !== true && $verified !== 'true') throw new VerxeeSsoError('The e-mail address is not verified at the provider.', 'email', $ret);
        if (!empty($p['hd']) && ($claims['hd'] ?? '') !== $p['hd']) throw new VerxeeSsoError('This account is not from the allowed organisation.', 'denied', $ret);
        if (!$this->emailAllowed($email)) throw new VerxeeSsoError('This account has no access to the app.', 'denied', $ret);

        $roles = $claims['roles'] ?? [];
        return [
            'provider' => $provider, 'sub' => (string) $claims['sub'], 'email' => $email,
            'name' => (string) ($claims['name'] ?? trim(($claims['given_name'] ?? '') . ' ' . ($claims['family_name'] ?? ''))),
            'picture' => (string) ($claims['picture'] ?? ''),
            'roles' => is_array($roles) ? array_values(array_filter($roles, 'is_string')) : [],
            'claims' => $claims, 'return' => $ret, 'id_token' => $jwt,
        ];
    }

    // ───────────────────────── Alba Rosa Hub extras ─────────────────────────

    /**
     * The app's own e-mail + password form, checked against the HUB password (one password everywhere, nothing copied).
     * Returns the same identity array as finish() (return = ''). Throws VerxeeSsoError with ->reason:
     *   'unknown_user' — not a person of the hub, or the hub does not let them into this app → you may check your own accounts
     *   'bad_password' — wrong password (the hub counts it towards its rate limit)
     *   'no_password'  — the person signs in to the hub with Google or a passkey only: send them to the hub (start())
     *   'rate_limited' — too many attempts, wait 15 minutes
     *   'http'         — the hub does not answer
     * @return array{provider: string, sub: string, email: string, name: string, picture: string, roles: list<string>, claims: array<string, mixed>, return: string, id_token: string}
     */
    public function passwordLogin(string $provider, string $email, string $password): array
    {
        $p = $this->provider($provider);
        $d = $this->discovery($p);
        if (!in_array('password', (array) ($d['grant_types_supported'] ?? []), true)) throw new VerxeeSsoError('The provider does not check passwords for apps.', 'unsupported');
        $nonce = self::rand();
        [$code, $tok] = $this->httpRaw((string) $d['token_endpoint'], ['grant_type' => 'password', 'username' => strtolower(trim($email)), 'password' => $password, 'nonce' => $nonce] + $this->clientPost($p), $this->clientBasic($p));
        if ($code !== 200 || !is_string($tok['id_token'] ?? null)) {
            $why = preg_replace('/[^a-z_]/', '', (string) ($tok['error_description'] ?? ''));
            $map = ['unknown_user' => 'This account cannot sign in to the app.', 'bad_password' => 'Wrong e-mail or password.', 'no_password' => 'This account has no password. Sign in through the hub.', 'rate_limited' => 'Too many attempts. Try again in 15 minutes.'];
            if (isset($map[$why])) throw new VerxeeSsoError($map[$why], $why);
            throw new VerxeeSsoError('The sign-in server is not answering. Try again in a moment.', 'http');
        }
        return $this->identity($p, $provider, $this->verify($p, $tok['id_token'], $nonce), $tok['id_token'], '');
    }

    /**
     * An account event pushed by the hub (POST to your provisioning URL, field `token`). Verifies the signature (JWKS), issuer,
     * audience, expiry, type and one-time use. Answer the hub with JSON {"ok": true, "account": "created|exists|updated|disabled"}.
     *   event 'grant'  = the person may use the app now → create the account (or switch it on again); no password needed,
     *                    sign-in goes through the hub (or passwordLogin()).
     *   event 'revoke' = access was taken away in the hub → switch the account off (do not delete data).
     * @return array{event: string, sub: string, email: string, emails: list<string>, name: string, actor: ?array, claims: array<string, mixed>}
     */
    public function provisioning(string $provider, string $token): array
    {
        $p = $this->provider($provider);
        $h = json_decode(self::b64uDec(explode('.', $token)[0] ?? ''), true);
        if (!is_array($h) || ($h['typ'] ?? '') !== 'hub-provision+jwt') throw new VerxeeSsoError('Not an account event of the hub.', 'token');
        $c = $this->verify($p, $token, '');
        $event = (string) ($c['hub_event'] ?? '');
        if (!in_array($event, ['grant', 'revoke'], true)) throw new VerxeeSsoError('Unknown account event.', 'token');
        $jti = (string) ($c['jti'] ?? '');
        if ($jti === '' || !$this->once('prov-' . $p['issuer'] . '|' . $jti, (int) $c['exp'] + $this->leeway)) throw new VerxeeSsoError('This account event was already used.', 'replay');
        $email = strtolower(trim((string) ($c['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) throw new VerxeeSsoError('The event has no e-mail address.', 'email');
        $emails = [];
        foreach (array_merge([$email], (array) ($c['emails'] ?? [])) as $e) if (is_string($e) && filter_var($e, FILTER_VALIDATE_EMAIL)) $emails[strtolower($e)] = true;
        return ['event' => $event, 'sub' => (string) $c['sub'], 'email' => $email, 'emails' => array_keys($emails), 'name' => (string) ($c['name'] ?? ''),
                'actor' => is_array($c['hub_actor'] ?? null) ? $c['hub_actor'] : null, 'claims' => $c];
    }

    /**
     * Google access token of one person (their `sub` from sign-in), handed out by the hub — the person connected Google once in
     * the hub, the app never asks Google itself. $services: 'calendar', 'gmail', 'drive', 'contacts' (default: all the app is
     * registered for in the hub). Throws VerxeeSsoError reason 'google_connect' when the person has to connect / allow Google
     * first: send their browser (top level, not the iframe) to ->returnTo, the hub's page, which comes back to $return.
     * Other reasons: 'access_denied', 'google_not_registered', 'google_error', 'http'. Cache the token until expires_in.
     * @param list<string> $services
     * @return array{access_token: string, expires_in: int, scope: string, services: list<string>, email: string}
     */
    public function googleToken(string $provider, string $sub, array $services = [], string $return = ''): array
    {
        $p = $this->provider($provider);
        $d = $this->discovery($p);
        $ep = $d['hub_google_token_endpoint'] ?? null;
        if (!is_string($ep) || !$this->urlOk($ep)) throw new VerxeeSsoError('The provider does not hand out Google access.', 'unsupported');
        [$code, $j] = $this->httpRaw($ep, array_filter(['sub' => $sub, 'services' => implode(',', $services), 'return' => $return]) + $this->clientPost($p), $this->clientBasic($p));
        if ($code === 200 && is_string($j['access_token'] ?? null)) {
            return ['access_token' => $j['access_token'], 'expires_in' => (int) ($j['expires_in'] ?? 0), 'scope' => (string) ($j['scope'] ?? ''),
                    'services' => array_values((array) ($j['services'] ?? [])), 'email' => (string) ($j['email'] ?? '')];
        }
        $e = preg_replace('/[^a-z_]/', '', (string) ($j['error'] ?? ''));
        $msg = is_string($j['error_description'] ?? null) ? $j['error_description'] : 'Google access through the hub failed.';
        if (in_array($e, ['google_not_connected', 'google_scope_missing', 'google_consent_required'], true)) {
            $url = (string) ($j['connect_url'] ?? '');
            throw new VerxeeSsoError($msg, 'google_connect', $this->urlOk($url) ? $url : '');
        }
        throw new VerxeeSsoError($msg, $e !== '' ? $e : 'http');
    }

    /** The hub's page where a person connects Google / allows this app (for a "Napojit Google v hubu" button). */
    public function googleConnectUrl(string $provider, array $services = [], string $return = ''): string
    {
        $p = $this->provider($provider);
        $ep = (string) ($this->discovery($p)['hub_google_connect_endpoint'] ?? '');
        if (!$this->urlOk($ep)) throw new VerxeeSsoError('The provider does not hand out Google access.', 'unsupported');
        $q = array_filter(['client_id' => (string) $p['client_id'], 'services' => implode(',', $services), 'return' => $return]);
        return $ep . (str_contains($ep, '?') ? '&' : '?') . http_build_query($q, '', '&', PHP_QUERY_RFC3986);
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

    /** Client secret in the POST body when the provider wants client_secret_post (or there is no secret). */
    private function clientPost(array $p): array
    {
        $secret = (string) ($p['client_secret'] ?? '');
        if ($secret !== '' && ($p['auth_method'] ?? 'basic') === 'basic') return [];
        return ['client_id' => (string) $p['client_id']] + ($secret !== '' ? ['client_secret' => $secret] : []);
    }

    /** @return ?array{0: string, 1: string} client_secret_basic credentials */
    private function clientBasic(array $p): ?array
    {
        $secret = (string) ($p['client_secret'] ?? '');
        return $secret !== '' && ($p['auth_method'] ?? 'basic') === 'basic' ? [(string) $p['client_id'], $secret] : null;
    }

    /** true the first time a key is seen (until $until), false afterwards — one-time use of pushed tokens. */
    private function once(string $key, int $until): bool
    {
        $dir = $this->cacheDir . '/once';
        if (!is_dir($dir)) @mkdir($dir, 0700, true);
        if (random_int(1, 50) === 1) foreach (glob($dir . '/*') ?: [] as $f) if ((int) @file_get_contents($f) < time()) @unlink($f);
        $f = $dir . '/' . hash('sha256', $key);
        $h = @fopen($f, 'x');                   // atomic: only one request can create it
        if ($h === false) return false;
        fwrite($h, (string) $until);
        fclose($h);
        return true;
    }

    /** @return array<string, mixed> */
    private function http(string $url, ?array $post = null, ?array $basic = null): array
    {
        [$code, $j] = $this->httpRaw($url, $post, $basic);
        if ($code >= 400 || $j === null) {
            error_log('Verxee SSO: ' . strtok($url, '?') . ' → HTTP ' . $code . (is_array($j) && isset($j['error']) ? ' ' . preg_replace('/[^a-z_]/', '', (string) $j['error']) : ''));
            throw new VerxeeSsoError('The sign-in server is not answering. Try again in a moment.', 'http');
        }
        return $j;
    }

    /** @return array{0: int, 1: ?array<string, mixed>} HTTP status and JSON body (null when the answer was not JSON) */
    private function httpRaw(string $url, ?array $post = null, ?array $basic = null): array
    {
        if (!$this->urlOk($url)) throw new VerxeeSsoError('Provider address must be https.', 'http');
        $ch = curl_init($url);
        $hdr = ['Accept: application/json'];
        // A User-Agent is required: WEDOS (and other shared hosts) answer UA-less requests with 401/429.
        $o = [CURLOPT_USERAGENT => 'VerxeeSso/' . self::VERSION . ' (+https://github.com/jurapascal/verxee-ui)', CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 6, CURLOPT_FOLLOWLOCATION => false,
              CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | ($this->allowHttp ? CURLPROTO_HTTP : 0)];
        if ($post !== null) { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = http_build_query($post); $hdr[] = 'Content-Type: application/x-www-form-urlencoded'; }
        if ($basic) $hdr[] = 'Authorization: Basic ' . base64_encode(rawurlencode($basic[0]) . ':' . rawurlencode($basic[1]));
        $o[CURLOPT_HTTPHEADER] = $hdr;
        curl_setopt_array($ch, $o);
        $res = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $j = is_string($res) ? json_decode($res, true) : null;
        if ($res === false || $code === 0) throw new VerxeeSsoError('The sign-in server is not answering. Try again in a moment.', 'http');
        return [$code, is_array($j) ? $j : null];
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
