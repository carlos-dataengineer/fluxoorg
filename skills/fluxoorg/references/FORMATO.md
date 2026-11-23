# Formato da spec do Fluxoorg

A spec é um JSON que descreve a reunião. O Fluxoorg lê esse JSON e monta o quadro sozinho:
posição das caixas, seções, setas, cores, quadros e tabelas. Você só descreve **o quê**, nunca **onde**.

É o mesmo formato que o botão **Copiar prompt** pede ao Claude e que o campo **Colar JSON** aceita.
O esquema formal está em [`schema/fluxoorg.schema.json`](../../../schema/fluxoorg.schema.json) no repositório.

## Exemplo mínimo

```json
{
  "titulo": "Devolução de pedidos",
  "fluxos": [
    {
      "titulo": "Do pedido ao reembolso",
      "etapas": [
        {"id": "s1", "texto": "Cliente abre a devolução no site", "tipo": "etapa"},
        {"id": "s2", "texto": "ERP valida o prazo", "tipo": "sistema"},
        {"id": "s3", "texto": "Produto chegou avariado?", "tipo": "condicao"},
        {"id": "s4", "texto": "Abrir chamado com a transportadora", "tipo": "etapa"},
        {"id": "s5", "texto": "Produto volta ao estoque", "tipo": "etapa"}
      ],
      "ligacoes": [
        {"de": "s1", "para": "s2"},
        {"de": "s2", "para": "s3"},
        {"de": "s3", "para": "s4", "rotulo": "sim"},
        {"de": "s3", "para": "s5", "rotulo": "não"}
      ]
    }
  ]
}
```

## Campos

| Campo | Tipo | Obrigatório | Para quê |
|---|---|---|---|
| `titulo` | texto | não | Título grande do quadro e nome da aba |
| `resumo` | texto | não | Frase de conclusão logo abaixo do título (até 10 palavras) |
| `data` | texto | não | Data da reunião, `dd/mm/aaaa` |
| `participantes` | lista de textos | não | `"Nome (papel)"`, aparece no subtítulo |
| `fluxos` | lista | **sim** | Um fluxo por processo ou assunto; cada um vira uma seção |
| `fluxos[].titulo` | texto | não | Nome da seção |
| `fluxos[].etapas` | lista | **sim** | Caixas do fluxo, na ordem em que o processo acontece |
| `etapas[].id` | texto | recomendado | Identificador único no fluxo (`s1`, `s2`…), usado nas ligações |
| `etapas[].texto` | texto | **sim** | Até ~15 palavras, verbo no presente |
| `etapas[].tipo` | `etapa` · `sistema` · `condicao` | não | `sistema` = caixa azul; `condicao` = losango ◇ com saídas sim/não |
| `etapas[].raia` | texto | não | Quem executa; usado no layout **Raias por participante** |
| `fluxos[].ligacoes` | lista | não | Setas `{"de", "para", "rotulo"}`. Sem ligações, as etapas são ligadas em sequência |
| `quadros` | lista | não | Listas laterais: `{"titulo", "tipo", "itens"}` |
| `quadros[].tipo` | `dor` · `decisao` · `pendencia` · `regra` · `necessidade` | não | Define a cor (pêssego, verde ou branco) |
| `tabelas` | lista | não | `{"titulo", "colunas": [...], "linhas": [[...]]}` para códigos, valores e prazos |

**Atalhos aceitos:** chaves em inglês (`title`, `flows`, `steps`, `text`, `type`, `lane`, `links`/`edges`,
`from`, `to`, `label`, `panels`, `items`, `tables`, `cols`, `rows`), etapas como texto simples
(`"etapas": ["A", "B"]`), uma spec sem `fluxos` com `etapas` direto na raiz, e listas soltas
`dores`/`pains`, `decisoes`/`decisions`, `pendencias`/`action_items`, `regras`/`rules`.

## Boas práticas para quem escreve a spec (pessoa ou IA)

1. **Ordem do processo, não da conversa.** As pessoas falam fora de ordem; o fluxo não.
2. **Um fluxo por assunto.** Se a reunião passou por vendas e depois por onboarding, são dois fluxos. No máximo ~12 etapas por fluxo.
3. **Condições são perguntas.** `"texto": "Pagamento aprovado?"`, com duas ligações rotuladas `sim` e `não`. Os ramos podem se juntar de novo.
4. **Preserve o que foi dito.** Nomes, códigos, números e datas exatamente como na transcrição. Não invente etapas.
5. **Fora do fluxo, nos quadros.** Dores, decisões, pendências (`"responsável: ação (prazo)"`), regras e necessidades vão em `quadros`; listas de códigos e prazos vão em `tabelas`.
6. **Textos curtos, sem ponto final.** O quadro é lido de longe.

## Gerar o HTML

```bash
python skills/fluxoorg/scripts/render.py reuniao.spec.json -o reuniao.html --open
python skills/fluxoorg/scripts/render.py reuniao.spec.json --check   # só valida
```

Várias specs no mesmo comando viram várias abas no mesmo arquivo.
