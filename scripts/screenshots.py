#!/usr/bin/env python3
"""Gera as capturas de tela do README em docs/images/ (só dados fictícios).

Requer: pip install playwright && python -m playwright install chromium
Uso:    python scripts/screenshots.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "app" / "index.html").as_uri()
OUT = ROOT / "docs" / "images"


def hide_toast(page) -> None:
    page.evaluate("document.querySelector('#toast').classList.remove('on')")


def shot(page, name: str, **kw) -> None:
    hide_toast(page)
    page.wait_for_timeout(350)  # transição de saída do aviso
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / name), **kw)
    print(f"gerado: docs/images/{name}")


def main() -> int:
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(channel="msedge")
        ctx = browser.new_context(viewport={"width": 1600, "height": 1000}, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(APP)
        page.wait_for_timeout(600)

        # 1. Quadro de exemplo inteiro, sem o painel lateral
        page.locator("#btnSide").click()
        page.locator("#zFit").click()
        page.wait_for_timeout(300)
        shot(page, "quadro.png")

        # 2. Zoom no primeiro fluxo, numa cópia editável (sem a faixa de protegido)
        page.locator("#bnDup").click()
        hide_toast(page)
        page.locator("#zFit").click()
        page.locator("#zIn").click()
        page.locator("#zIn").click()
        page.wait_for_timeout(200)
        box = page.locator("#world .cont").first.bounding_box()
        if box:
            page.mouse.move(800, 500)
            page.mouse.wheel(box["x"] - 60, box["y"] - 235)
        page.wait_for_timeout(200)
        shot(page, "detalhe.png")

        # 3. Transcrição colada + revisão
        page.locator("#btnSide").click()
        page.locator("#btnSample").click()
        page.locator("#btnAnalyze").click()
        page.wait_for_timeout(400)
        page.locator("#side").evaluate("el=>el.scrollTop=0")
        shot(page, "transcricao.png", clip={"x": 0, "y": 0, "width": 392, "height": 1000})
        page.locator("#review").scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        shot(page, "revisao.png", clip={"x": 0, "y": 0, "width": 392, "height": 1000})

        # 4. Fluxo gerado pelo modo local (sem IA)
        page.locator("#btnBuild").click()
        page.wait_for_timeout(400)
        page.locator("#btnSide").click()
        page.locator("#zFit").click()
        page.wait_for_timeout(300)
        shot(page, "modo-local.png")

        # 5. Raias por participante
        page.locator("#btnSide").click()
        page.locator("#optLayout").select_option("lanes")
        page.locator("#btnGen").click()
        page.locator("#btnSide").click()
        page.locator("#zFit").click()
        page.wait_for_timeout(300)
        shot(page, "raias.png")

        # 6. Imagem social (1280x640) para o preview do link
        social = ctx.new_page()
        social.set_viewport_size({"width": 1280, "height": 640})
        social.goto(APP)
        social.wait_for_timeout(500)
        social.locator("#btnSide").click()
        social.locator("#zFit").click()
        social.wait_for_timeout(300)
        shot(social, "social.png")

        # 7. Celular
        m = ctx.new_page()
        m.set_viewport_size({"width": 390, "height": 844})
        m.goto(APP)
        m.wait_for_timeout(500)
        m.locator("#zFit").click()
        m.wait_for_timeout(200)
        shot(m, "celular.png")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
