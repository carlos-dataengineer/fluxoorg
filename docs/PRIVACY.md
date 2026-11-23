# Privacidade

Reuniões têm nomes, clientes, números e decisões internas. O Fluxoorg foi feito para que nada disso saia do seu computador sem você decidir.

| Situação | O que acontece com a transcrição |
|---|---|
| Modo local (**Analisar e revisar**, **Gerar direto**) | Processada só no navegador. Nenhuma requisição de rede. |
| **Copiar prompt** | Vai para a área de transferência. Você decide onde colar. |
| **Colar JSON** | Só o JSON colado é lido, no navegador. |
| **Gerar com IA** | Enviada a `api.anthropic.com` com a **sua** chave, pelo próprio navegador. A chave fica só na memória da página e some ao fechar. Use apenas se a política da sua empresa permitir. |
| **Salvar HTML** / **Salvar .json** | Os fluxos ficam dentro do arquivo baixado. Guarde-o como guardaria a transcrição. |
| Skill no Claude Code ou Codex | O agente lê a transcrição para escrever a spec (como em qualquer conversa com ele) e grava o HTML numa pasta local. Por padrão não publica nada. |
| Demo no GitHub Pages | A página é estática: tudo continua no seu navegador. O GitHub registra o acesso à página, como em qualquer site. |

A ferramenta não usa cookies, `localStorage`, análise de uso, fontes ou scripts de terceiros.

## Dicas

- Antes de compartilhar um quadro, use **Duplicar** e apague o que for sensível, ou troque nomes por papéis.
- Não anexe transcrições reais em issues. Para relatar um erro, troque nomes e números por dados fictícios.
