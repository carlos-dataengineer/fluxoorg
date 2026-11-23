#!/usr/bin/env python3
"""Gera um HTML do Fluxoorg com um ou mais fluxos já montados a partir de specs JSON.

A spec segue references/FORMATO.md (o mesmo JSON que o "Modo IA" da ferramenta aceita).
O arquivo gerado funciona offline e pode ser editado e salvo de novo pela própria ferramenta.

Uso:
  python render.py reuniao.spec.json -o reuniao.html
  python render.py a.spec.json b.spec.json -o reunioes.html --open
  python render.py reuniao.spec.json --check      # só valida a spec

Só usa a biblioteca padrão do Python (3.8+).
"""
from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE.parent / "assets" / "fluxoorg.html"
MARK = '<script type="application/json" id="spec"></script>'
STEP_TYPES = {"etapa", "sistema", "condicao", "step", "system", "condition"}


def first(obj: dict, *keys):
    for k in keys:
        if isinstance(obj, dict) and obj.get(k) is not None:
            return obj[k]
    return None


def validate(spec, name: str) -> list[str]:
    """Erros que impedem o fluxo de ser montado (avisos não bloqueiam)."""
    errs: list[str] = []
    if not isinstance(spec, dict):
        return [f"{name}: a spec deve ser um objeto JSON"]
    flows = first(spec, "fluxos", "flows") or []
    if not flows and first(spec, "etapas", "steps", "nodes"):
        flows = [spec]
    if not isinstance(flows, list) or not flows:
        return [f"{name}: falta 'fluxos' com pelo menos um fluxo"]
    for fi, fl in enumerate(flows, 1):
        steps = first(fl, "etapas", "steps", "nodes") or []
        if not steps:
            errs.append(f"{name}: fluxo {fi} sem 'etapas'")
            continue
        ids = set()
        for si, st in enumerate(steps, 1):
            if isinstance(st, str):
                ids.add(f"s{si}")
                continue
            sid = str(first(st, "id") or f"s{si}")
            if sid in ids:
                errs.append(f"{name}: fluxo {fi} tem o id de etapa repetido {sid!r}")
            ids.add(sid)
            if not str(first(st, "texto", "text", "label") or "").strip():
                errs.append(f"{name}: fluxo {fi}, etapa {sid} sem texto")
            tipo = first(st, "tipo", "type", "kind")
            if tipo and str(tipo).lower() not in STEP_TYPES:
                errs.append(f"{name}: fluxo {fi}, etapa {sid} com tipo desconhecido {tipo!r} (use etapa, sistema ou condicao)")
        for li in first(fl, "ligacoes", "links", "edges") or []:
            a, b = str(first(li, "de", "from")), str(first(li, "para", "to"))
            for end in (a, b):
                if end not in ids:
                    errs.append(f"{name}: fluxo {fi} liga a etapa inexistente {end!r}")
    return errs


def render(specs: list, template: Path = TEMPLATE) -> str:
    html = template.read_text(encoding="utf-8")
    if html.count(MARK) != 1:
        raise SystemExit(f"{template} não tem o marcador da spec. Reinstale o Fluxoorg.")
    payload = json.dumps(specs if len(specs) > 1 else specs[0], ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("<", "\\u003c")  # nunca fecha a tag <script> por acidente
    return html.replace(MARK, MARK.replace("></script>", ">" + payload + "</script>"))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Gera um HTML do Fluxoorg a partir de specs JSON.")
    ap.add_argument("specs", nargs="+", type=Path, help="arquivo(s) .json no formato de references/FORMATO.md")
    ap.add_argument("-o", "--out", type=Path, help="HTML de saída (padrão: nome da primeira spec com .html)")
    ap.add_argument("--open", action="store_true", help="abre o resultado no navegador")
    ap.add_argument("--check", action="store_true", help="só valida as specs, sem gerar HTML")
    args = ap.parse_args(argv)

    specs, errors = [], []
    for p in args.specs:
        try:
            spec = json.loads(p.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as e:
            errors.append(f"{p.name}: não consegui ler o JSON ({e})")
            continue
        errors += validate(spec, p.name)
        specs.append(spec)
    if errors:
        print("Spec inválida:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    if args.check:
        print(f"{len(specs)} spec(s) válida(s).")
        return 0

    out = args.out or args.specs[0].with_name(args.specs[0].name.split(".")[0] + ".html")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(specs), encoding="utf-8", newline="\n")
    print(f"gerado: {out}")
    if args.open:
        webbrowser.open(out.resolve().as_uri())
    return 0


if __name__ == "__main__":
    sys.exit(main())
