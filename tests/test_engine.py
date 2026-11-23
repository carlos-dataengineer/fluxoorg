#!/usr/bin/env python3
"""Testes do motor de análise (src/engine.js), rodando no Chromium via Playwright.

Requer: pip install playwright && python -m playwright install chromium
Uso:    python tests/test_engine.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
ENGINE = (ROOT / "src" / "engine.js").read_text(encoding="utf-8")
ORBITA = (ROOT / "examples" / "reuniao-orbita.txt").read_text(encoding="utf-8")
TEAMS = (ROOT / "examples" / "reuniao-teams.vtt").read_text(encoding="utf-8")
SPEC = json.loads((ROOT / "examples" / "orbita.spec.json").read_text(encoding="utf-8"))
OPTS = {"systems": "HubSpot, Stripe, ERP, Databricks, WhatsApp, site", "detail": 14, "panels": True}

failures: list[str] = []


def expect(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        failures.append(msg)


def main() -> int:
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="msedge")
        page = browser.new_page()
        page.set_content("<html><body></body></html>")
        page.add_script_tag(content=ENGINE)
        E = lambda js, *a: page.evaluate(f"(a)=>{{const E=window.FluxoorgEngine;{js}}}", list(a))

        print("parseTranscript")
        r = E("return E.parseTranscript(a[0])", ORBITA)
        expect(r["people"] == ["Marina", "Rafael", "Bruno"], f"falantes 'Nome:' detectados ({r['people']})")
        r = E("return E.parseTranscript(a[0])", TEAMS)
        expect(r["people"] == ["Júlia Prado", "Diego Neves"], f"falantes de .vtt <v> detectados ({r['people']})")
        expect(not any("-->" in t["text"] for t in r["turns"]), "marcas de tempo do .vtt descartadas")
        srt = "1\n00:00:01,000 --> 00:00:03,000\nAna Lima 00:01\nPrimeiro o pedido entra no ERP.\n"
        r = E("return E.parseTranscript(a[0])", srt)
        expect(r["people"] == ["Ana Lima"], f"formato Teams 'Nome 00:01' em linha própria ({r['people']})")
        r = E("return E.parseTranscript(a[0])", "Nota: isto é um rótulo, não uma pessoa.\nO pedido entra no ERP.")
        expect(r["people"] == [], "rótulo que aparece uma vez só não vira falante")

        print("splitSentences / cleanSentence")
        s = E("return E.splitSentences(a[0])", "Primeiro o lead entra. Depois o SDR liga; por fim fecha.")
        expect(len(s) == 3, f"divide por ponto e ponto e vírgula ({s})")
        c = E("return E.cleanSentence(a[0])", "então, aí o financeiro aprova o reembolso, né?")
        expect(c == "O financeiro aprova o reembolso", f"remove muletas de fala ({c!r})")
        c = E("return E.cleanSentence(a[0])", "Em seguida o executivo envia a proposta.")
        expect(c == "O executivo envia a proposta", f"remove conectivo de sequência ({c!r})")

        print("analyze")
        a = E("return E.analyze(a[0],a[1])", ORBITA, OPTS)
        kinds = {}
        for it in a["items"]:
            kinds.setdefault(it["kind"], []).append(it["text"])
        expect(a["date"] == "12/03/2026", f"data da reunião detectada ({a['date']!r})")
        expect(len(kinds.get("step", [])) + len(kinds.get("sys", [])) >= 5, "pelo menos 5 etapas de processo")
        expect(any("HubSpot" in t for t in kinds.get("sys", [])), "etapa com sistema vira 'sys'")
        expect(len(kinds.get("cond", [])) >= 1, "frase 'Se X, Y' vira decisão ◇")
        expect(any("ID único" in t for t in kinds.get("dec", [])), "decisão tomada detectada")
        expect(any("dicionário" in t for t in kinds.get("pen", [])), "pendência detectada")
        expect(any("manualmente" in t for t in kinds.get("pain", [])), "dor detectada")
        expect(not any(t.endswith("?") and "proposta" in t for v in kinds.values() for t in v), "perguntas soltas descartadas")
        gloss = dict(map(tuple, a["gloss"]))
        expect(gloss.get("ARR", "").startswith("receita recorrente"), f"glossário extrai siglas ({gloss})")
        expect(not any(t.startswith(("MQL", "ARR")) for v in kinds.values() for t in v), "definição de sigla não vira etapa")
        expect(any(s["title"] == "Onboarding" for s in a["secs"]), "título de seção sem 'Agora sobre o'")
        expect(len(a["secs"]) >= 2, f"'Agora sobre…' abre uma nova seção ({[s['title'] for s in a['secs']]})")
        less = E("return E.analyze(a[0],Object.assign({},a[1],{detail:4,panels:false}))", ORBITA, OPTS)
        expect(all(i["kind"] in ("step", "sys", "cond") for i in less["items"]), "sem quadros quando panels=false")

        print("buildEdges / specFromRows")
        edges = E("return E.buildEdges(a[0])", [
            {"id": "s1", "kind": "step"}, {"id": "s2", "kind": "cond"},
            {"id": "s3", "kind": "step"}, {"id": "s4", "kind": "step", "alt": True}, {"id": "s5", "kind": "step"}])
        expect({"from": "s2", "to": "s3", "label": "sim"} in edges, "condição liga 'sim' à próxima etapa")
        expect({"from": "s2", "to": "s4", "label": "não"} in edges, "'Senão:' liga o 'não' da condição")
        expect(any(e["to"] == "s5" for e in edges), "os dois ramos se juntam depois")

        print("specFromJson")
        sp = E("return E.specFromJson(a[0])", SPEC)
        expect(len(sp["flows"]) == 2 and len(sp["flows"][0]["nodes"]) == 8, "lê fluxos e etapas em português")
        expect(sp["flows"][0]["nodes"][3]["kind"] == "cond", "tipo 'condicao' vira losango")
        expect(len(sp["panels"]) == 5 and len(sp["tables"]) == 1, "lê quadros e tabelas")
        en = E("return E.specFromJson(a[0])", {"title": "T", "steps": ["A", "B", "C"], "decisions": ["x"]})
        expect(len(en["flows"]) == 1 and len(en["flows"][0]["edges"]) == 2, "aceita chaves em inglês e liga em sequência")
        expect(any(pp["t"] == "Decisões" for pp in en["panels"]), "atalho 'decisions' vira quadro")
        nasty = E("return E.specFromJson(a[0])", {"fluxos": [{"etapas": [{"texto": "<img src=x onerror=alert(1)>"}]}]})
        expect(nasty["flows"][0]["nodes"][0]["text"].startswith("<img"), "texto bruto preservado (o app escapa ao desenhar)")

        print("buildPrompt")
        pr = E("return E.buildPrompt(a[0])", "Ana: teste")
        expect('"fluxos"' in pr and pr.rstrip().endswith("Ana: teste"), "prompt traz o formato e a transcrição")
        expect("cortada" in E("return E.buildPrompt('x'.repeat(130000))"), "transcrição gigante é cortada")

        browser.close()
    print()
    if failures:
        print(f"{len(failures)} falha(s).")
        return 1
    print("Motor OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
