# Changelog

Todas as mudanças relevantes deste projeto ficam aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [1.0.0] - 2026-11-23

Primeira versão pública.

### Adicionado
- Ferramenta em um único HTML, offline: transcrição de reunião (Teams, Meet, Zoom, `.vtt`, `.srt` ou texto) vira um quadro editável com seções, etapas, sistemas, decisões ◇ com saídas sim/não, quadros de dores, decisões, pendências, regras e necessidades, e tabela de termos.
- Modo local sem IA: detecta falantes, separa frases, descarta perguntas e conversa solta, classifica cada frase e agrupa por assunto. Tela de revisão antes de montar.
- Layouts "linha do processo" e "raias por participante".
- Modo IA opcional: prompt pronto para copiar no Claude, colar o JSON de volta ou enviar direto à API com a chave da pessoa (não é salva).
- Editor de quadro: mover, redimensionar, setas, texto, seções, cores, desfazer/refazer, zoom, proteção contra edição e duplicação.
- Projeto com várias abas; salvar como `.json` ou como HTML com os fluxos embutidos.
- Exemplo fictício protegido na primeira abertura.
- Layout para telas pequenas (painel lateral vira gaveta).
- Skill `fluxoorg` para Claude Code e Codex, com `scripts/render.py` (spec JSON → HTML) e guia do formato.
- Esquema JSON da spec em `schema/fluxoorg.schema.json`.
- Instaladores de um comando (`install.ps1`, `install.sh`) e desinstaladores.
- Testes do motor e de fumaça no navegador (Playwright), validação do repositório, CI em Linux, macOS e Windows, release automático e demo no GitHub Pages.

[Não publicado]: https://github.com/carlos-dataengineer/fluxoorg/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/carlos-dataengineer/fluxoorg/releases/tag/v1.0.0
