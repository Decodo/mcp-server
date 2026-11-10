#!/usr/bin/env python3
"""Validate a ChatGPT/Codex plugin package against OpenAI's documented submission rules."""
import json, os, re, struct, sys

ROOT = sys.argv[1]
errs, warns, oks = [], [], []
def err(c, m): errs.append(f"[{c}] {m}")
def warn(m): warns.append(m)
def ok(m): oks.append(m)

CATEGORIES = {"Productivity","Creativity","Developer Tools","Business & Operations",
    "Data & Analytics","Communication","Education & Research","Security","Finance",
    "Healthcare","Travel","Entertainment","Other"}

def rel_lum(hexc):
    r, g, b = (int(hexc[i:i+2], 16)/255 for i in (1, 3, 5))
    f = lambda c: c/12.92 if c <= 0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi+0.05)/(lo+0.05)

def png_size(path):
    with open(path, 'rb') as f:
        head = f.read(24)
    if head[:8] != b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack('>II', head[16:24])

p = os.path.join(ROOT, 'plugin.json')
if not os.path.isfile(p): err('plugin_manifest_missing', 'no plugin.json at plugin root'); print('\n'.join(errs)); sys.exit(1)
M = json.load(open(p))

# --- root manifest ---
if M.get('$schema') != 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json':
    err('plugin_manifest_missing', 'unexpected $schema')
else: ok('$schema')
n = M.get('name','')
if not n: err('plugin_name_missing','name required')
elif len(n) > 64: err('plugin_name_too_long', f'{len(n)}>64')
elif not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', n): err('plugin_name_format', n)
else: ok(f'name "{n}"')
v = M.get('version','')
if not v: err('plugin_version_missing','version required')
elif not re.fullmatch(r'\d+\.\d+\.\d+(?:[-+].*)?', v): err('plugin_version_not_semver', v)
else: ok(f'version {v}')
d = M.get('description','')
if not d: err('plugin_description_missing','description required')
elif len(d) > 1024: err('plugin_description_too_long', f'{len(d)}>1024')
else: ok(f'description {len(d)} chars (<=1024)')
a = M.get('author') or {}
if not a.get('name'): err('plugin_developer_missing','author.name required')
else: ok(f'author.name "{a["name"]}"')
for f_, lim in (('url',2048),):
    u = a.get(f_)
    if u and not u.startswith('https://'): err(f'plugin_author_{f_}_not_https', u)
hp = M.get('homepage')
if hp and not hp.startswith('https://'): err('plugin_homepage_format', hp)

ext = (M.get('extensions') or {}).get('com.openai') or {}
I = ext.get('interface') or {}
if not isinstance(I, dict): err('plugin_interface_wrong_type','interface must be object')

def strfield(key, code, final_lim, pkg_lim, required=True, oneline=True):
    val = I.get(key)
    if val is None:
        if required: err(f'plugin_{code}_wrong_type', f'{key} required')
        return
    if not isinstance(val, str) or not val.strip():
        err(f'plugin_{code}_empty', key); return
    if oneline and '\n' in val: err(f'plugin_{code}_character_unsupported', f'{key} must be one line')
    if len(val) > pkg_lim: err(f'plugin_{code}_too_long', f'{key} {len(val)}>{pkg_lim} (package)')
    elif len(val) > final_lim: err(f'submission_{code}_too_long', f'{key} {len(val)}>{final_lim} (final directory)')
    else: ok(f'{key} {len(val)} chars (final limit {final_lim})')

strfield('displayName','display_name',30,80)
strfield('shortDescription','subtitle',30,240)
strfield('longDescription','description',4000,4000,oneline=False)
strfield('developerName','developer_name',80,120)

cat = I.get('category')
if cat is None: warn('category omitted -> defaults to "Other"')
elif cat not in CATEGORIES: err('plugin_category_unknown', repr(cat))
else: ok(f'category "{cat}"')

caps = I.get('capabilities')
if caps is None: warn('capabilities omitted (required for Codex format)')
elif not isinstance(caps, list): err('plugin_capabilities_wrong_type','must be list')
elif len(caps) > 20: err('plugin_capabilities_too_many', f'{len(caps)}>20')
else:
    for c in caps:
        if not isinstance(c,str) or not c.strip(): err('plugin_capability_empty', repr(c))
        elif len(c) > 120: err('plugin_capability_too_long', f'{len(c)}>120: {c}')
        elif '\n' in c: err('plugin_capability_invalid','must be one line')
    ok(f'capabilities: {len(caps)} entries, max len {max(len(c) for c in caps)}')

for key, code in (('websiteURL','website_url'),('supportURL','support_url'),
                  ('privacyPolicyURL','privacy_policy_url'),('termsOfServiceURL','terms_of_service_url')):
    u = I.get(key)
    if not u: err(f'plugin_{code}_empty', f'{key} required for remote MCP review')
    elif not u.startswith('https://'): err(f'plugin_{code}_format', u)
    elif len(u) > 1024: err(f'plugin_{code}_too_long', f'{len(u)}>1024 (final)')
    else: ok(f'{key} {u}')
urls = {I.get(k) for k in ('privacyPolicyURL','termsOfServiceURL')}
if len(urls) == 1: warn('privacyPolicyURL and termsOfServiceURL are identical')

dp = I.get('defaultPrompt')
if dp is not None:
    dp = [dp] if isinstance(dp,str) else dp
    if not isinstance(dp,list): err('plugin_default_prompt_wrong_type','string or list')
    else:
        if len(dp) > 3: err('plugin_default_prompt_too_many', f'{len(dp)}>3')
        if len({x.strip().lower() for x in dp}) != len(dp): err('plugin_default_prompt_duplicate','not unique')
        for x in dp:
            if '@' in x: err('plugin_default_prompt_mention', x)
            if len(x) > 128: err('plugin_default_prompt_too_long', f'{len(x)}>128 (final): {x}')
        ok(f'defaultPrompt: {len(dp)} entries, max len {max(len(x) for x in dp)} (final limit 128)')

for key, bg, label in (('brandColor','#FFFFFF','white'),('brandColorDark','#212121','#212121')):
    c = I.get(key)
    if c is None: continue
    if not re.fullmatch(r'#[0-9A-Fa-f]{6}', c): err(f'plugin_brand_color_format', f'{key}={c}'); continue
    r = contrast(c, bg)
    if r < 2.0: err(f'plugin_brand_color_contrast', f'{key} {c} vs {label} = {r:.2f}:1 (<2:1)')
    else: ok(f'{key} {c} contrast vs {label} = {r:.2f}:1')

# --- images ---
for key, code in (('logo','plugin_logo_path_missing'),('composerIcon','plugin_composer_icon_path_missing')):
    path = I.get(key)
    if not path: err(code, f'interface.{key} is required'); continue
    if not path.startswith('./'): err('branding_asset_path_missing_root_prefix', f'{key}={path}')
    if '..' in path or path.startswith('/'): err('declared_asset_path_unsafe', path)
    fp = os.path.join(ROOT, path[2:] if path.startswith('./') else path)
    if not os.path.isfile(fp): err('declared_asset_file_missing', path); continue
    ext_ = os.path.splitext(fp)[1].lower()
    if ext_ not in ('.png','.jpg','.jpeg','.webp','.svg'): err('image_file_format_unsupported', ext_); continue
    sz = os.path.getsize(fp)
    if sz > 5*1024*1024: err('image_file_too_large', f'{sz}B > 5MiB')
    if ext_ == '.png':
        dim = png_size(fp)
        if not dim: err('raster_image_extension_content_mismatch', f'{path} is not a PNG')
        else:
            w,h = dim
            if w != h: err('raster_image_not_square', f'{w}x{h}')
            elif w < 48: err('raster_image_dimensions_too_small', f'{w}x{h} < 48x48')
            elif w > 4096: err('raster_image_dimensions_too_large', f'{w}x{h}')
            else: ok(f'{key} {path} {w}x{h} PNG, {sz/1024:.1f} KiB')

# --- review ---
R = ext.get('review') or {}
tc = R.get('test_cases') or {}
pos, neg = tc.get('positive') or [], tc.get('negative') or []
if len(pos) != 5: err('submission', f'need exactly 5 positive test cases, found {len(pos)}')
else: ok('5 positive test cases')
if len(neg) != 3: err('submission', f'need exactly 3 negative test cases, found {len(neg)}')
else: ok('3 negative test cases')
for i, c in enumerate(pos):
    for f_ in ('description','prompt','tools_triggered','expected_behavior'):
        if not c.get(f_): err('submission', f'positive[{i}] missing {f_}')
for i, c in enumerate(neg):
    for f_ in ('description','prompt'):
        if not c.get(f_): err('submission', f'negative[{i}] missing {f_}')
if not R.get('demo_recording_url'):
    warn('review.demo_recording_url absent - required for MCP review; enter it in the dashboard Review details')
for bad in ('test_credentials','reviewer_instructions'):
    if bad in R: err('submission', f'review.{bad} is rejected in ZIP metadata - enter it in the dashboard')
if not ext.get('publication',{}).get('release_notes'): warn('publication.release_notes absent - required for submission')
else: ok('release_notes present')

# --- onboardingSkill / skills ---
osk = ext.get('onboardingSkill')
skills_dir = os.path.join(ROOT,'skills')
skill_dirs = [d for d in os.listdir(skills_dir) if os.path.isdir(os.path.join(skills_dir,d))] if os.path.isdir(skills_dir) else []
if not skill_dirs: warn('no skills/ - "archive_plugin_files_missing" says a public ZIP needs >=1 valid skill')
for s in skill_dirs:
    if s.startswith('.'): err('skill_directory_hidden', s); continue
    sm = os.path.join(skills_dir, s, 'SKILL.md')
    if not os.path.isfile(sm): err('skill_manifest_missing', s); continue
    t = open(sm, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n(.*)$', t, re.S)
    if not m: err('skill_frontmatter_missing', s); continue
    fm, body = m.group(1), m.group(2)
    nm = re.search(r'^name:\s*(\S.*)$', fm, re.M)
    ds = re.search(r'^description:\s*(\S.*(?:\n[ \t]+.*)*)$', fm, re.M)
    if not nm: err('skill_name_missing', s)
    if not ds: err('skill_description_missing', s)
    else:
        dstr = ' '.join(ds.group(1).split())
        if len(dstr) > 1024: err('skill_description_too_long', f'{len(dstr)}>1024')
    if not body.strip(): err('skill_body_empty', s)
    ident = f"{n}:{nm.group(1).strip() if nm else ''}"
    if len(ident) > 64: err('skill_identity_too_long', ident)
    ok(f'skill "{s}" ok (identity "{ident}", {len(ident)} chars)')
if osk:
    fp = os.path.join(ROOT, osk[2:] if osk.startswith('./') else osk)
    if not os.path.isfile(fp): err('declared_asset_file_missing', f'onboardingSkill {osk}')
    else: ok(f'onboardingSkill -> {osk}')

# --- mcp.json ---
mp = os.path.join(ROOT,'mcp.json')
if not os.path.isfile(mp): warn('no mcp.json')
else:
    MC = json.load(open(mp))
    servers = MC.get('mcpServers')
    if not isinstance(servers, dict) or not servers: err('mcp_servers_missing','mcpServers object required')
    else:
        if len(servers) != 1: err('submission', f'exactly one MCP server allowed, found {len(servers)}')
        for sn, sv in servers.items():
            if not sn.strip(): err('mcp_server_name_empty','')
            if not isinstance(sv, dict): err('mcp_server_wrong_type', sn); continue
            if sv.get('headers'): err('submission', f'non-empty headers on "{sn}" are rejected for public submission')
            u = sv.get('url','')
            if not u.startswith('https://'): err('submission', f'MCP url must be HTTPS: {u}')
            auth = ((sv.get('extensions') or {}).get('com.openai') or {}).get('auth') or {}
            at = auth.get('type')
            if at == 'none': err('submission', 'auth type "none" on a protected server')
            if at == 'api_key': warn('api_key auth: the portal has no API-key connection flow; contact OpenAI')
            cl = auth.get('client') or {}
            if cl and cl.get('mode') not in ('provided','dcr','cimd'): err('submission', f'client.mode {cl.get("mode")}')
            if cl.get('mode') in ('dcr','cimd') and cl.get('clientId'): err('submission','clientId not allowed with dcr/cimd')
            if 'clientSecret' in auth: err('submission','clientSecret is rejected in the manifest')
            ok(f'mcp server "{sn}" {sv.get("type")} {u} auth={at} client.mode={cl.get("mode")}')

print("\n=== PASSED ===")
for o in oks: print(" ✓", o)
if warns:
    print("\n=== WARNINGS (non-blocking / action elsewhere) ===")
    for w in warns: print(" ⚠", w)
print("\n=== ERRORS ===")
if errs:
    for e in errs: print(" ✗", e)
else: print(" none")
sys.exit(1 if errs else 0)
