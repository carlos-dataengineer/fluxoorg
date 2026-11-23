---
name: fluxoorg
description: Transforma a transcrição de uma reunião (Teams, Meet, Zoom, .vtt, .srt ou texto) em um fluxo visual editável, com etapas do processo, decisões, sistemas, dores, pendências, regras e tabela de termos, num único HTML offline. Use quando a pessoa pedir "fluxoorg", "/fluxoorg", para transformar uma reunião ou transcrição em fluxo, fluxograma, mapa de processo ou resumo visual, ou para abrir a ferramenta Fluxoorg.
---

# Fluxoorg

O Fluxoorg é uma ferramenta pronta, em um único arquivo HTML. **Nunca reescreva a ferramenta e nunca desenhe o quadro à mão**: você escreve uma *spec* JSON e o script `scripts/render.py` monta o HTML com a ferramenta da pasta `assets/`.

| Arquivo | Para quê |
|---|---|
| `assets/fluxoorg.html` | A ferramenta completa. Abre direto no navegador. |
| `scripts/render.py` | Injeta uma ou mais specs no HTML. Só biblioteca padrão do Python. |
| `references/FORMATO.md` | Formato da spec e boas práticas. **Leia antes de escrever a primeira spec.** |

## Privacidade antes de tudo

Transcrições costumam ter nomes, clientes e números internos. Por padrão o resultado fica **só no computador da pessoa** (arquivo local). Não publique como artefato, não envie a serviços externos e não cole a transcrição em lugar nenhum sem a pessoa pedir.

## 1. Pessoa pediu só para abrir a ferramenta

1. Copie `assets/fluxoorg.html` para `~/Fluxoorg/fluxoorg.html` (crie a pasta; não sobrescreva um arquivo diferente sem perguntar).
2. Abra no navegador: Windows `Start-Process "$HOME\Fluxoorg\fluxoorg.html"` · macOS `open ~/Fluxoorg/fluxoorg.html` · Linux `xdg-open ~/Fluxoorg/fluxoorg.html`.
3. Explique em uma linha: colar a transcrição → **Analisar e revisar** → **Montar fluxo no quadro**. Funciona offline.

## 2. Pessoa trouxe uma transcrição (caminho principal)

1. **Leia a transcrição inteira** (arquivo ou texto colado). Arquivos `.vtt`/`.srt` têm marcas de tempo: ignore-as.
2. **Escreva a spec** seguindo `references/FORMATO.md`:
   - etapas na ordem do processo, um fluxo por assunto, até ~12 etapas cada;
   - `tipo: "condicao"` para perguntas de decisão, com ligações `sim`/`não`;
   - `tipo: "sistema"` quando a etapa acontece em um sistema;
   - `raia` = quem executa;
   - dores, decisões, pendências (`"responsável: ação (prazo)"`), regras e necessidades em `quadros`; códigos e prazos em `tabelas`;
   - preserve nomes, números e datas como foram ditos. **Não invente.** Se algo ficou ambíguo, coloque em `pendencia` como "a confirmar".
3. Salve a spec num arquivo temporário (ex.: `reuniao.spec.json`) e valide:
   `python <pasta-da-skill>/scripts/render.py reuniao.spec.json --check`
   Corrija o que o script apontar.
4. Gere o HTML na pasta que a pessoa indicar (padrão `~/Fluxoorg/`), com um nome que diga o assunto:
   `python <pasta-da-skill>/scripts/render.py reuniao.spec.json -o ~/Fluxoorg/<assunto>.html --open`
   Sem Python disponível: copie `assets/fluxoorg.html`, abra e cole a spec no campo **Modo IA → Colar JSON**.
5. Responda com: o caminho do arquivo, um resumo de 3 a 5 linhas (fluxos, decisões e pendências principais) e o aviso de que o quadro é editável e pode ser salvo pelo botão **Salvar HTML**.

Várias reuniões de uma vez: uma spec por reunião no mesmo comando → um arquivo com uma aba por reunião.

## 3. Publicar como artefato (só se a pessoa pedir)

Com a ferramenta Artifact disponível e **pedido explícito da pessoa**, publique o HTML gerado no passo 2 (`icon: "flow"`). Lembre que o artefato leva o conteúdo da reunião para a conta dela no Claude.

## O que não fazer

- Não altere `assets/fluxoorg.html`, não "melhore" o CSS nem gere outra ferramenta parecida.
- Não use a chave de API da pessoa nem o botão **Gerar com IA**: você já é a IA; escreva a spec.
- Não deixe a spec temporária com dados da reunião em pastas públicas ou versionadas.
