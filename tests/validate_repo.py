#!/usr/bin/env python3
"""Validações estáticas do repositório (sem navegador).

Confere: manifesto da skill, plugin e versão consistentes, arquivos gerados presentes,
exemplos válidos, instaladores em ASCII sem BOM, ausência de chamadas externas na
ferramenta, links e imagens do README e, opcionalmente, termos proibidos.

Termos proibidos (dados reais que não podem ir a público) ficam FORA do repositório:
passe-os em FLUXOORG_PROIBIDOS, separados por vírgula.
  FLUXOORG_PROIBIDOS="empresa x,cliente y" python tests/validate_repo.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = ROOT / "skills" / "fluxoorg"
errors: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        errors.append(msg)


# Skill ------------------------------------------------------------------------
skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
m = re.match(r"^---\n(.*?)\n---\n", skill, re.S)
check(bool(m), "SKILL.md sem frontmatter YAML")
if m:
    front = dict(re.findall(r"^(\w+):\s*(.+)$", m.group(1), re.M))
    check(front.get("name") == "fluxoorg", "SKILL.md: name deve ser 'fluxoorg'")
    desc = front.get("description", "")
    check(20 <= len(desc) <= 1024, "SKILL.md: description deve ter entre 20 e 1024 caracteres")
for ref in re.findall(r"`((?:assets|references|scripts)/[^`\s]+)`", skill):
    check((SKILL_DIR / ref).exists(), f"SKILL.md cita {ref}, que não existe")
check((SKILL_DIR / "agents" / "openai.yaml").exists(), "falta skills/fluxoorg/agents/openai.yaml (Codex)")

# Plugin e versão -------------------------------------------------------------------
version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
check(bool(re.fullmatch(r"\d+\.\d+\.\d+", version)), f"VERSION inválida: {version!r}")
plugin = json.loads((ROOT / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
market = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8"))
check(plugin.get("name") == "fluxoorg", "plugin.json: name deve ser 'fluxoorg'")
check(plugin.get("version") == version, f"plugin.json: versão {plugin.get('version')} difere de VERSION {version}")
entries = [p for p in market.get("plugins", []) if p.get("name") == "fluxoorg"]
check(len(entries) == 1, "marketplace.json: precisa de uma entrada 'fluxoorg'")
if entries:
    check(entries[0].get("version") == version, "marketplace.json: versão difere de VERSION")
check(f"## [{version}]" in (ROOT / "CHANGELOG.md").read_text(encoding="utf-8"), f"CHANGELOG.md sem a versão {version}")
check(f"version: {version}" in (ROOT / "CITATION.cff").read_text(encoding="utf-8"), "CITATION.cff com versão diferente")

# Arquivos gerados ----------------------------------------------------------------
for rel in ["app/index.html", "skills/fluxoorg/assets/fluxoorg.html"]:
    p = ROOT / rel
    check(p.exists(), f"{rel} não existe (rode python scripts/build.py)")
    if p.exists():
        html = p.read_text(encoding="utf-8")
        check("<title>Fluxoorg</title>" in html, f"{rel} sem o título Fluxoorg")
        check(f"v{version}" in html, f"{rel} não mostra a versão {version}")
        check(html.count('<script type="application/json" id="spec"></script>') == 1, f"{rel} sem o marcador vazio da spec")
        # Nada externo em tempo de execução: só a API da Anthropic (modo IA, opcional) e links clicáveis.
        for url in re.findall(r"""https?://[^\s"'`)<>]+""", html):
            ok = url.startswith(("https://api.anthropic.com/", "https://github.com/carlos-dataengineer/fluxoorg", "http://www.w3.org/2000/svg"))
            check(ok, f"{rel} referencia um endereço externo inesperado: {url}")
        check(not re.search(r"<script[^>]+src=|<link[^>]+href=|localStorage|sessionStorage|document\.cookie", html),
              f"{rel} carrega recursos externos ou guarda dados no navegador")

# Exemplos --------------------------------------------------------------------------
res = subprocess.run([sys.executable, str(SKILL_DIR / "scripts" / "render.py"), *map(str, (ROOT / "examples").glob("*.spec.json")), "--check"],
                     capture_output=True, text=True)
check(res.returncode == 0, f"exemplos inválidos: {res.stderr.strip()}")
schema = json.loads((ROOT / "schema" / "fluxoorg.schema.json").read_text(encoding="utf-8"))
check("fluxos" in schema.get("required", []), "schema sem 'fluxos' obrigatório")

# Instaladores ----------------------------------------------------------------------
for rel in ["install.ps1", "uninstall.ps1"]:
    raw = (ROOT / rel).read_bytes()
    check(not raw.startswith(b"\xef\xbb\xbf"), f"{rel} não pode ter BOM (quebra o irm | iex)")
    check(all(b < 128 for b in raw), f"{rel} precisa ser ASCII puro (Windows PowerShell 5.1)")
for rel in ["install.sh", "uninstall.sh"]:
    raw = (ROOT / rel).read_bytes()
    check(raw.startswith(b"#!/usr/bin/env bash"), f"{rel} sem shebang")
    check(b"\r\n" not in raw, f"{rel} precisa de quebras de linha LF")

# READMEs: imagens e links locais -------------------------------------------------------
for name in ["README.md", "README.en.md", "CONTRIBUTING.md", "SECURITY.md", "docs/ARCHITECTURE.md"]:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    for img in re.findall(r'src="((?!https?://)[^"]+)"', text) + re.findall(r"!\[[^\]]*\]\(((?!https?://)[^)]+)\)", text):
        check((path.parent / img).exists(), f"{name} cita a imagem {img}, que não existe")
    for link in re.findall(r"\]\(((?!https?://|#|mailto:)[^)\s]+)\)", text):
        check((path.parent / link.split("#")[0]).exists(), f"{name} aponta para {link}, que não existe")

# Termos proibidos (passados por variável de ambiente, nunca gravados aqui) ------------------
terms = [t.strip().lower() for t in os.environ.get("FLUXOORG_PROIBIDOS", "").split(",") if t.strip()]
if terms:
    for p in ROOT.rglob("*"):
        if ".git" in p.parts or not p.is_file() or p.suffix.lower() in {".png", ".jpg", ".zip"}:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore").lower()
        for t in terms:
            if re.search(r"(?<![a-z0-9])" + re.escape(t) + r"(?![a-z0-9])", text):
                errors.append(f"termo proibido em {p.relative_to(ROOT).as_posix()}: {t!r}")

if errors:
    print("Falhas:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
print("Repositório válido." + (f" ({len(terms)} termos proibidos conferidos)" if terms else ""))
