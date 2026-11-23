# Como contribuir

Obrigado pelo interesse! Código, documentação, exemplos de transcrição e relatos de erro são bem-vindos.
Boas primeiras contribuições estão marcadas com [`good first issue`](https://github.com/carlos-dataengineer/fluxoorg/labels/good%20first%20issue).

## Antes de começar

- Procure uma [issue](https://github.com/carlos-dataengineer/fluxoorg/issues) parecida ou abra uma nova.
- Para mudanças grandes, combine a ideia na issue antes de escrever o código.

## Estrutura

| Pasta | O quê |
|---|---|
| `src/template.html` | Estrutura, estilos e marcação |
| `src/engine.js` | Motor de análise da transcrição (sem DOM, testado em `tests/test_engine.py`) |
| `src/app.js` | Quadro, edição, revisão, salvamento e modo IA |
| `examples/` | Transcrições e spec **fictícias** |
| `skills/fluxoorg/` | Skill para Claude Code e Codex (`SKILL.md`, `scripts/render.py`, `references/`) |
| `app/`, `skills/fluxoorg/assets/` | **Gerados** por `scripts/build.py`. Não edite à mão |

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Fluxo

1. Faça um fork e crie uma branch (`git checkout -b minha-melhoria`).
2. Edite os arquivos em `src/` e gere a ferramenta:
   ```bash
   python scripts/build.py
   ```
3. Rode os testes:
   ```bash
   python tests/validate_repo.py
   pip install playwright && python -m playwright install chromium
   python tests/test_engine.py
   python tests/test_smoke.py
   ```
4. Mudou o motor? Acrescente um caso em `tests/test_engine.py` com uma frase fictícia que mostre o comportamento.
5. Mudou a interface? Atualize as imagens com `python scripts/screenshots.py` e o README.
6. Registre a mudança em `CHANGELOG.md`, na seção `[Não publicado]`.
7. Abra o Pull Request preenchendo o modelo. Use [Conventional Commits](https://www.conventionalcommits.org/pt-br/) nas mensagens (`feat:`, `fix:`, `docs:`…).

## Regras do projeto

- A ferramenta continua **um único HTML, offline, sem dependências** em tempo de execução e sem rastreamento.
- Nada sai do computador da pessoa sem ação explícita dela (o único envio é o modo IA com a chave dela).
- Exemplos, testes e imagens usam **apenas dados fictícios**. Nunca cole transcrições reais em issues ou PRs.
- Nada de segredos, tokens ou credenciais em código, testes ou issues.
- `install.ps1` e `uninstall.ps1` precisam ser **ASCII puro, sem BOM** (Windows PowerShell 5.1 e `irm | iex`).
- Texto de interface em português claro; termos técnicos só quando necessários.

## Nova versão (mantenedores)

Atualize `VERSION`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` e `CHANGELOG.md`,
rode `python scripts/build.py`, faça o merge na `main` e crie a tag `vX.Y.Z`. O workflow de release
publica o ZIP da skill e o HTML.
