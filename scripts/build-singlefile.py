import json, re, os, sys, glob

DIST = sys.argv[1]
OUT = sys.argv[2]

html = open(os.path.join(DIST, "index.html"), encoding="utf-8").read()
js_path = sorted(glob.glob(os.path.join(DIST, "assets/index-*.js")))[0]
css_path = sorted(glob.glob(os.path.join(DIST, "assets/index-*.css")))[0]
worker_path = sorted(glob.glob(os.path.join(DIST, "assets/parser.worker-*.js")))[0]

js = open(js_path, encoding="utf-8").read()
css = open(css_path, encoding="utf-8").read()
worker = open(worker_path, encoding="utf-8").read()

worker_name = os.path.basename(worker_path)
TARGET = 'new URL(""+new URL("%s",import.meta.url).href,import.meta.url)' % worker_name
assert TARGET in js, "worker url expression not found: " + worker_name
js = js.replace(TARGET, 'URL.createObjectURL(new Blob([__WORKER_SRC__],{type:"text/javascript"}))')

html = re.sub(
    r'<meta http-equiv="Content-Security-Policy" content="[^"]*">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' blob: data:; '
    "script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; "
    "font-src 'self' data:; frame-src 'none'; object-src 'none'\">",
    html,
)
html = re.sub(r'<link rel="stylesheet"[^>]*href="\./assets/index-[^"]*\.css"[^>]*>',
              lambda m: "<style>\n" + css + "\n</style>", html)
assert "<style>" in html, "css inline failed"

js_inline = "const __WORKER_SRC__=" + json.dumps(worker, ensure_ascii=False) + ";\n" + js
html = re.sub(r'<script type="module"[^>]*src="\./assets/index-[^"]*\.js"></script>',
              lambda m: '<script type="module">\n' + js_inline + "\n</script>", html)
assert "__WORKER_SRC__" in html, "js inline failed"

open(OUT, "w", encoding="utf-8").write(html)
print("built", OUT, len(html.encode("utf-8")), "bytes ; assets:", os.path.basename(js_path), os.path.basename(css_path), worker_name)
