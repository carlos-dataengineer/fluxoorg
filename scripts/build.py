#!/usr/bin/env python3
"""Monta o Fluxoorg (um único HTML) a partir das fontes em src/.

Fontes:
  src/template.html   estrutura, estilos e marcação (fragmento que começa em <title>)
  src/engine.js       motor de análise da transcrição (sem DOM, testável)
  src/app.js          quadro, edição, revisão e salvamento
  examples/orbita.spec.json   fluxo de exemplo exibido na primeira abertura

Saídas (não edite à mão):
  app/index.html                          abre direto no navegador e no GitHub Pages
  skills/fluxoorg/assets/fluxoorg.html    mesma ferramenta, usada pela skill e pelo instalador

Uso:
  python scripts/build.py          gera os arquivos
  python scripts/build.py --check  falha se os arquivos gerados estiverem desatualizados
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUTPUTS = [ROOT / "app" / "index.html", ROOT / "skills" / "fluxoorg" / "assets" / "fluxoorg.html"]

# Mesmo esqueleto que o Claude usa ao publicar um artefato: o arquivo abre igual no
# navegador e, se for publicado como artefato, não ganha um segundo esqueleto.
SKELETON_HEAD = (
    '<!doctype html><html lang="pt-BR"><head><meta charset=utf8>'
    '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
    "<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);"
    "padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}"
    "body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}"
    "img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n"
)
SKELETON_TAIL = "\n</body></html>\n"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8").replace("\r\n", "\n")


def json_for_script(obj) -> str:
    """JSON seguro dentro de <script>: '<' vira \\u003c (evita fechar a tag)."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def build() -> str:
    version = read(ROOT / "VERSION").strip()
    template = read(SRC / "template.html").strip("\n")
    if not template.startswith("<title>Fluxoorg</title>"):
        raise SystemExit("src/template.html deve começar com <title>Fluxoorg</title> (fragmento, sem <html>/<body>).")
    engine = read(SRC / "engine.js").rstrip("\n")
    app = read(SRC / "app.js").rstrip("\n")
    demo = json.loads(read(ROOT / "examples" / "orbita.spec.json"))
    for name, code in (("engine.js", engine), ("app.js", app)):
        if "</script" in code.lower():
            raise SystemExit(f"src/{name} não pode conter '</script' literal (use '<'+'/script>').")
    page = (
        template.replace("/*@DEMO*/", json_for_script(demo))
        .replace("/*@ENGINE*/", engine)
        .replace("/*@APP*/", app)
        .replace("@VERSION@", version)
    )
    return SKELETON_HEAD + page + SKELETON_TAIL


def main() -> int:
    check = "--check" in sys.argv
    content = build()
    stale = []
    for path in OUTPUTS:
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == content:
            continue
        if check:
            stale.append(path.relative_to(ROOT).as_posix())
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
            print(f"gerado: {path.relative_to(ROOT).as_posix()}")
    if stale:
        print("Arquivos desatualizados. Rode: python scripts/build.py")
        for s in stale:
            print(f"  - {s}")
        return 1
    if check:
        print("Arquivos gerados em dia.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
