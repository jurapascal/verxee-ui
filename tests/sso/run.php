<?php
// php tests/sso/run.php — starts the fake provider and walks VerxeeSso through real HTTP flows.
declare(strict_types=1);
require __DIR__ . '/../../server/php/VerxeeSso.php';

$probe = stream_socket_server('tcp://127.0.0.1:0'); $port = (int) substr(strrchr(stream_socket_get_name($probe, false), ':'), 1); fclose($probe); // a free port
$dir = sys_get_temp_dir() . '/vx-fake-idp-' . $port; @mkdir($dir, 0700, true);
$srv = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", __DIR__ . '/fake-idp.php'], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, null, ['FAKE_IDP_DIR' => $dir]);
register_shutdown_function(function () use ($srv, $dir) { proc_terminate($srv); exec("rm -rf " . escapeshellarg($dir)); });
for ($i = 0; $i < 50 && !str_contains((string) @file_get_contents("http://127.0.0.1:$port/jwks"), '"kid":"k1"'); $i++) usleep(100000);
if ($i === 50) { fwrite(STDERR, "fake provider did not start on :$port\n"); exit(1); }

ini_set('session.save_path', $dir); session_id('t' . $port); @session_start();
$iss = "http://127.0.0.1:$port";
$cfg = ['providers' => ['hub' => ['issuer' => $iss, 'client_id' => 'app1', 'client_secret' => 's3cret']],
        'redirect_uri' => 'https://app.test/auth.php', 'allow_http' => true, 'cache_dir' => "$dir/cache"];
$mode = fn (array $m) => file_put_contents("$dir/mode.json", json_encode($m));

/** Browser stand-in: follow the authorize URL once and return the callback query. */
function authorize(string $url): array
{
    $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_FOLLOWLOCATION => false]);
    $res = (string) curl_exec($ch); curl_close($ch);
    preg_match('/^Location: (.+)$/mi', $res, $m);
    parse_str((string) parse_url(trim($m[1] ?? ''), PHP_URL_QUERY), $q);
    return $q;
}

$fail = 0; $n = 0;
function check(string $name, callable $fn): void
{
    global $fail, $n; $n++;
    try { $fn(); echo "  ok   $name\n"; } catch (Throwable $e) { $fail++; echo "  FAIL $name — " . get_class($e) . ': ' . $e->getMessage() . "\n"; }
}
function expectError(callable $fn, string $reason): void
{
    try { $fn(); } catch (VerxeeSsoError $e) { if ($e->reason !== $reason) throw new Exception("reason {$e->reason}, wanted $reason"); return; }
    throw new Exception("no error, wanted $reason");
}
function eq($a, $b): void { if ($a !== $b) throw new Exception(var_export($a, true) . ' !== ' . var_export($b, true)); }

echo "VerxeeSso " . VerxeeSso::VERSION . " — fake provider on :$port\n";
$sso = new VerxeeSso($cfg);

check('happy path returns verified identity + return path', function () use ($sso, $mode) {
    $mode([]);
    $q = authorize($sso->start('hub', ['return' => '/app/orders?x=1#top']));
    $id = $sso->finish($q);
    eq($id['email'], 'jane@alba-rosa.cz'); eq($id['sub'], 'u-42'); eq($id['provider'], 'hub'); eq($id['roles'], ['admin']); eq($id['return'], '/app/orders?x=1#top');
});
check('state is single-use (replay rejected)', function () use ($sso, $mode) {
    $mode([]); $q = authorize($sso->start('hub')); $sso->finish($q);
    expectError(fn () => $sso->finish($q), 'state');
});
check('silent sign-in without hub session → login_required with return', function () use ($sso, $mode) {
    $mode(['logged_out' => true]);
    $q = authorize($sso->start('hub', ['prompt' => 'none', 'return' => '/app/']));
    try { $sso->finish($q); throw new Exception('no error'); } catch (VerxeeSsoError $e) { eq($e->reason, 'login_required'); eq($e->returnTo, '/app/'); }
});
check('tampered signature rejected', function () use ($sso, $mode) {
    $mode(['bad_sig' => true]); $q = authorize($sso->start('hub'));
    expectError(fn () => $sso->finish($q), 'token');
});
check('token for another app (aud) rejected', function () use ($sso, $mode) {
    $mode(['claims' => ['aud' => 'other-app']]); $q = authorize($sso->start('hub'));
    expectError(fn () => $sso->finish($q), 'token');
});
check('wrong nonce rejected', function () use ($sso, $mode) {
    $mode(['claims' => ['nonce' => 'evil']]); $q = authorize($sso->start('hub'));
    expectError(fn () => $sso->finish($q), 'token');
});
check('expired token rejected', function () use ($sso, $mode) {
    $mode(['claims' => ['exp' => time() - 3600]]); $q = authorize($sso->start('hub'));
    expectError(fn () => $sso->finish($q), 'token');
});
check('unverified e-mail rejected', function () use ($sso, $mode) {
    $mode(['claims' => ['email_verified' => false]]); $q = authorize($sso->start('hub'));
    expectError(fn () => $sso->finish($q), 'email');
});
check('allowlist: other domain denied, listed domain passes', function () use ($cfg, $mode) {
    $mode(['claims' => ['email' => 'mallory@evil.test']]);
    $s = new VerxeeSso($cfg + ['allowed_domains' => ['alba-rosa.cz']]);
    $q = authorize($s->start('hub')); expectError(fn () => $s->finish($q), 'denied');
    $mode([]); $q = authorize($s->start('hub')); eq($s->finish($q)['email'], 'jane@alba-rosa.cz');
});
check('discovery with a different issuer rejected', function () use ($cfg, $mode, $dir) {
    $mode(['issuer' => 'https://evil.test']);
    $s = new VerxeeSso(array_merge($cfg, ['cache_dir' => "$dir/cache2"]));
    expectError(fn () => $s->start('hub'), 'discovery');
});
check('unknown provider rejected', fn () => expectError(fn () => $sso->start('nope'), 'provider'));
check('safeReturn blocks open redirects', function () {
    foreach (['https://evil.test/', '//evil.test', '/\\evil', "/a\nb", 'javascript:x', '', null, 42] as $bad) eq(VerxeeSso::safeReturn($bad, '/home'), '/home');
    eq(VerxeeSso::safeReturn('/app/x?y=1#z'), '/app/x?y=1#z');
});
check('withResult keeps query and hash', function () {
    eq(VerxeeSso::withResult('/app/#/orders', 'ok'), '/app/?vx_sso=ok#/orders');
    eq(VerxeeSso::withResult('/app/?a=1', 'fail'), '/app/?a=1&vx_sso=fail');
});
check('logoutUrl uses end_session_endpoint', function () use ($sso, $mode, $iss) {
    $mode([]); $u = $sso->logoutUrl('hub', 'https://app.test/');
    eq(str_starts_with((string) $u, "$iss/logout?client_id=app1&post_logout_redirect_uri="), true);
});

echo ($fail ? "$fail of $n FAILED\n" : "all $n passed\n");
exit($fail ? 1 : 0);
