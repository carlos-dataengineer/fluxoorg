#!/usr/bin/env python3
"""Teste de fumaça: abre o Fluxoorg num navegador real e percorre os fluxos principais.

Requer: pip install playwright && python -m playwright install chromium
Uso:    python tests/test_smoke.py
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "app" / "index.html").as_uri()
SPEC = ROOT / "examples" / "orbita.spec.json"
RENDER = ROOT / "skills" / "fluxoorg" / "scripts" / "render.py"

failures: list[str] = []


def expect(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        failures.append(msg)


def flows(page) -> list[str]:
    return page.locator("#flowSel option").all_inner_texts()


def count(page, sel: str) -> int:
    return page.locator("#world " + sel).count()


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="fluxoorg-"))
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="msedge")
        ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        page = ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        print("Abertura")
        page.goto(APP)
        page.wait_for_timeout(600)
        expect(page.title() == "Fluxoorg", f"título da página ({page.title()!r})")
        expect(len(flows(page)) == 1 and "Orbita" in flows(page)[0], f"exemplo fictício aberto ({flows(page)})")
        expect(page.locator("#banner").is_visible(), "exemplo vem protegido contra edição")
        expect(count(page, ".shape") >= 16, "exemplo desenhou as etapas")
        expect(count(page, ".shape.k-diamond") == 2, "exemplo tem as duas decisões ◇")
        expect(page.locator("#arrows path[data-arrow]").count() >= 15, "exemplo tem as setas")
        expect(count(page, "table.tbl") == 1, "exemplo tem a tabela de termos")

        print("Proteção e duplicação")
        page.locator("#bnDup").click()
        expect(len(flows(page)) == 2 and "(cópia)" in flows(page)[1], "Duplicar cria uma cópia editável")
        before = count(page, ".shape")
        page.locator("#tbShape").click()
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        expect(count(page, ".shape") == before + 1, "+ Etapa adiciona uma caixa na cópia")
        page.locator("#tbUndo").click()
        expect(count(page, ".shape") == before, "Desfazer remove a caixa")

        print("Transcrição → revisão → quadro")
        page.locator("#btnSample").click()
        expect("Marina, Rafael, Bruno" in page.locator("#txInfo").inner_text(), "contagem de falas e falantes")
        page.locator("#btnAnalyze").click()
        rows = page.locator("#revList .ri").count()
        expect(rows >= 10, f"revisão lista os itens ({rows})")
        expect(page.locator("#revList .rsec").count() >= 2, "revisão mostra as seções")
        page.locator("#revList .ri .rk").first.select_option("ign")
        page.locator("#btnBuild").click()
        page.wait_for_timeout(300)
        expect(len(flows(page)) == 3, "Montar cria uma aba nova sem mexer nas outras")
        expect(count(page, ".shape.k-diamond") >= 1, "decisão ◇ desenhada")
        expect(count(page, ".cont") >= 4, "seções e quadros desenhados")
        expect(count(page, "table.tbl") == 1, "tabela de termos desenhada")

        print("Raias e geração direta")
        page.locator("#optLayout").select_option("lanes")
        page.locator("#btnGen").click()
        page.wait_for_timeout(300)
        labels = page.locator("#world .clabel").all_inner_texts()
        expect(any("· Rafael" in label for label in labels), "layout por raias usa os participantes")

        print("Modo JSON (resposta do Claude)")
        page.locator("#aiBox summary").click()
        page.locator("#jsonIn").fill("Claro! Segue:\n```json\n" + SPEC.read_text(encoding="utf-8") + "\n```")
        page.locator("#btnJsonGen").click()
        page.wait_for_timeout(300)
        expect(len(flows(page)) == 5, "JSON com texto em volta é aceito")
        page.locator("#jsonIn").fill("{quebrado")
        page.locator("#btnJsonGen").click()
        expect("JSON inválido" in page.locator("#toast").inner_text(), "JSON inválido avisa sem quebrar")
        page.evaluate("document.querySelector('#jsonIn').value=JSON.stringify({fluxos:[{etapas:[{texto:'<img src=x onerror=window.__xss=1>'}]}]})")
        page.locator("#btnJsonGen").click()
        page.wait_for_timeout(300)
        expect(page.evaluate("window.__xss") is None and count(page, "img") == 0, "texto com HTML é escapado")

        print("Salvar HTML e reabrir")
        with page.expect_download() as dl:
            page.locator("#btnSaveHtml").click()
        saved = tmp / "salvo.html"
        dl.value.save_as(saved)
        with page.expect_download() as dl:
            page.locator("#btnSaveJson").click()
        dl.value.save_as(tmp / "salvo.json")
        p2 = ctx.new_page()
        p2.on("pageerror", lambda e: errors.append(str(e)))
        p2.goto(saved.as_uri())
        p2.wait_for_timeout(500)
        expect(len(flows(p2)) == 6, f"HTML salvo reabre com todos os fluxos ({len(flows(p2))})")
        p2.close()

        print("HTML gerado pela skill (render.py)")
        out = tmp / "skill.html"
        res = subprocess.run([sys.executable, str(RENDER), str(SPEC), "-o", str(out)], capture_output=True, text=True)
        expect(res.returncode == 0, "render.py gera o arquivo")
        p3 = ctx.new_page()
        p3.on("pageerror", lambda e: errors.append(str(e)))
        p3.goto(out.as_uri())
        p3.wait_for_timeout(500)
        expect(flows(p3) == ["Exemplo · Orbita, do lead ao cliente ativo"], f"spec injetada vira o fluxo, sem o exemplo ({flows(p3)})")
        expect(not p3.locator("#banner").is_visible(), "fluxo da skill já vem editável")
        with p3.expect_download() as dl:
            p3.locator("#btnSaveHtml").click()
        again = tmp / "skill-salvo.html"
        dl.value.save_as(again)
        p3.goto(again.as_uri())
        p3.wait_for_timeout(500)
        expect(len(flows(p3)) == 1, "salvar o HTML da skill não duplica o fluxo")

        bad = tmp / "ruim.json"
        bad.write_text('{"fluxos":[{"etapas":[{"id":"s1","texto":"A"}],"ligacoes":[{"de":"s1","para":"s9"}]}]}', encoding="utf-8")
        res = subprocess.run([sys.executable, str(RENDER), str(bad), "--check"], capture_output=True, text=True)
        expect(res.returncode == 1 and "s9" in res.stderr, "render.py recusa ligação para etapa inexistente")

        print("Celular")
        m = ctx.new_page()
        m.set_viewport_size({"width": 390, "height": 844})
        m.on("pageerror", lambda e: errors.append(str(e)))
        m.goto(APP)
        m.wait_for_timeout(400)
        expect(m.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "sem rolagem horizontal no celular")

        expect(not errors, f"nenhum erro de JavaScript ({errors[:3]})")
        browser.close()
    print()
    if failures:
        print(f"{len(failures)} falha(s).")
        return 1
    print("Fumaça OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
