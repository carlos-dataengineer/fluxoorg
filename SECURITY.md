# Política de segurança

## Versões suportadas

Só a versão mais recente (branch `main` e a última tag) recebe correções.

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Use o [relato privado de vulnerabilidades](https://github.com/carlos-dataengineer/fluxoorg/security/advisories/new) do GitHub, com:

- o que acontece e o impacto;
- passos para reproduzir, com uma transcrição ou spec **fictícia**;
- versão e ambiente (navegador, Claude Code, Codex, sistema).

A resposta inicial vem em até 7 dias.

## Escopo

- **A ferramenta** (`src/`): injeção de HTML ou script por transcrição, JSON colado, projeto aberto ou rótulos; vazamento de dados para fora do navegador.
- **O modo IA**: a chave da API deve ficar só na memória da página e ir só para `api.anthropic.com`.
- **A skill** (`skills/fluxoorg`): instruções que levem o agente a expor a transcrição ou executar algo não pedido; `render.py` escrevendo fora do caminho pedido.
- **Os instaladores** (`install.*`, `uninstall.*`): apagar ou sobrescrever arquivos fora das pastas do Fluxoorg.

## Como a ferramenta trata seus dados

- Tudo roda no navegador. Sem servidor, sem cookies, sem análise de uso, sem bibliotecas externas.
- A transcrição só sai do computador se você usar **Gerar com IA**, que envia o texto à API da Anthropic com a **sua** chave. A chave não é salva em lugar nenhum.
- **Salvar HTML** grava os fluxos dentro do arquivo. Trate esse arquivo como trataria a própria transcrição.

Mais detalhes em [docs/PRIVACY.md](docs/PRIVACY.md).
