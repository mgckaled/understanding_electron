# Ambiente de desenvolvimento

Consulta rara: só se abre ao montar uma máquina, ao decidir modelo local, ou quando algo do editor/antivírus atrapalha. Saiu do [`CLAUDE.md`](../../../CLAUDE.md) no `R-7` por isso — ele é lido em **toda** sessão, e nada aqui decide a primeira linha de um arquivo.

⚠️ **Tudo abaixo é da máquina, não do repositório.** Ao trocar de máquina, refazer a medição antes de reaproveitar qualquer decisão que dependa destes números.

---

### O que está versionado

`.vscode/settings.json` exclui `node_modules`, `out` e `dist` do observador de arquivos — com pnpm, o `.pnpm` tem dezenas de milhares de entradas, e o padrão do VS Code só exclui o primeiro nível. Também fixa `typescript.tsdk` no TypeScript do projeto, para o editor não divergir do `pnpm typecheck`.

⚠️ **Consequência operacional:** com `node_modules` fora do watcher, o editor não percebe pacote novo sozinho. Depois de `pnpm add`, rode `Ctrl+Shift+P → Developer: Reload Window`. Sintoma quando esquecer: import válido marcado como não resolvido.

`.vscode/extensions.json` recomenda ESLint, Prettier e EditorConfig, e marca as extensões de Python como indesejadas.

### O que **não** está versionado (registrado aqui porque não deixa rastro)

**Exclusões do Windows Defender**, aplicadas em 3 de agosto de 2026 na máquina de desenvolvimento:

```powershell
Add-MpPreference -ExclusionPath "C:\rocketseat\projetos"
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\pnpm"
Add-MpPreference -ExclusionProcess "node.exe"
```

*Motivo:* o antivírus escaneia em tempo real cada arquivo lido. `pnpm install`, indexação do TypeScript e build do Vite leem dezenas de milhares de arquivos pequenos — no Windows, isso costuma responder pela maior parte da lentidão percebida.

*Custo assumido:* proteção em tempo real reduzida nesses caminhos. O raciocínio é que o conteúdo é controlado e o `minimumReleaseAge` do pnpm 11 já filtra pacote recém-publicado. **É uma troca, não um ajuste gratuito.**

*Para reverter:* `Remove-MpPreference -ExclusionPath "..."` com os mesmos caminhos.

*Ao trocar de máquina:* precisa ser refeito, e os caminhos provavelmente mudam.

**Máquina e modelos locais** — registrado aqui porque **decide escolhas do aplicativo** e não deixa rastro no repositório (medido em ago/2026):

| | |
|---|---|
| CPU | Intel i5-8265U — 4 núcleos / 8 threads |
| RAM | 16 GB. **Não há um número de "livre" — há uma faixa**, remedida em 05/09/2026: **~8,5 GB** com só o terminal (o gerenciador de tarefas reporta 8,7–8,9; arredondado para baixo de propósito) · **6,5–7,0 GB** com o VS Code aberto, variando conforme o que ele está fazendo. A variação de ~1,5–2 GB é da ordem do peso de um modelo da frota, e é por isso que o teto de contexto se lê em runtime em vez de ser chumbado — ver [`plan/implemented/15`](../../plan/implemented/15-orcamento-de-contexto-e-modelo.md) § D15.2. ⚠️ Um terceiro cenário (ambiente com navegador e mensageiro abertos) já foi medido no passado e **não** foi remedido — remeça antes de citar um número para ele |
| GPU | NVIDIA MX150, 2 GB VRAM, CUDA configurado (herança do mill.tools, que a reserva para o Whisper) — mas o app roda **CPU-only por decisão testada, não por ausência de hardware**: `num_gpu` forçado no `gemma3:1b` foi medido e descartado para geração, penalidade já presente em contexto comum (não só extremo), sem estouro de VRAM — números e protocolo em [`docs/reference/models/ollama-models-gpu-analysis.md`](../../reference/models/ollama-models-gpu-analysis.md) |
| Ollama | 0.32.14 (atualizado fora do app, 18/08/2026 — era 0.32.6), servindo de `C:\ollama-models` (`OLLAMA_MODELS` do `ollama serve`; o app é agnóstico ao caminho) |

**Frota Ollama: 8 modelos distintos** (13 entradas no `/api/tags`, 5 delas variantes `-custom`).

📖 **Tabela completa** — peso, teto treinado, KV/token, `capabilities`, papel, desinstalados e o porquê de o teto de contexto ser da máquina: [`docs/reference/models/README.md`](../../reference/models/README.md#frota-instalada). O dono mudou de lugar em ago/2026 justamente porque este arquivo é lido em **toda** sessão, inclusive nas que não tocam IA. **Ao instalar ou remover um modelo, é lá que se atualiza.**

As quatro regras de escolha de modelo, o protocolo de sonda de um modelo residente por vez, e a armadilha `capabilities`/`/api/show` (R-6, ago/2026): skill [`ai`](../../../.claude/skills/ai/SKILL.md).

**Ao trocar de máquina, refazer a medição** antes de reaproveitar qualquer decisão que dependa destes números (default de `num_thread`, modelo padrão, recusa de *tool calling*).

### Pendente

**Perfil do VS Code.** A extensão do Python continua ativa e carregando neste workspace; `python.analysis.exclude` silencia os avisos do node-gyp, mas não impede o carregamento. Um perfil (`File → Preferences → Profiles`) contendo só ESLint, Prettier e EditorConfig resolveria de verdade. Note que perfil é configuração de máquina — não viaja no repositório.

---

## Limitar o Node a metade da CPU

O portão saturava a máquina: com a suíte rodando, um trabalho concorrente de referência ia de **1930 ms para 4894 ms** — 2,5× mais lento, que é a travada percebida ao usar o notebook.

| Modo | trabalho concorrente | degradação |
|---|---|---|
| máquina livre | 1930 ms | — |
| 8 workers (default do Vitest, um por thread lógica) | 4894 ms | 2,5× |
| prioridade baixa (`start /low`) | 4665 ms | 2,4× — não resolve |
| 4 workers (`maxWorkers: '50%'`) | ~4300 ms | 2,2× |
| **afinidade em 4 das 8 CPUs** | **2862 ms** | **1,5×** |

**Prioridade não desocupa thread:** os workers seguem nas oito lógicas, e o escalonador só divide melhor as fatias. Limitar o número de workers ajuda pouco pelo mesmo motivo — quatro workers **sem** afinidade migram entre as oito, e nenhuma fica livre. Só a afinidade reserva CPU por construção.

**O que está aplicado no repositório:** `maxWorkers: '50%'` no `vitest.config.ts` — só o Vitest paraleliza (medido: `typecheck` é 1 processo, `lint` é 0), então é onde o limite tem efeito.

**O que depende desta máquina, e por isso mora aqui:** fixar o **terminal inteiro** com afinidade, já que a máscara é herdada por toda a descendência — `pnpm`, `node`, `tsc`, workers.

```bat
start /affinity F <terminal>
```

`F` = `0b1111` = as 4 primeiras de 8 threads lógicas. Confirmado que o Node passa a reportar `availableParallelism() === 4`, então toda ferramenta que consulta esse número se auto-ajusta — e que netos herdam.

⚠️ **Se adotar isso, tire o `maxWorkers: '50%'` do `vitest.config.ts`**, ou vira 50% de 4 = **dois** workers, limite duplo.

⚠️ **Não tente aplicar afinidade de dentro de um hook** — as duas formas óbvias falham, cada uma para um lado. Diagnóstico em [`ARMADILHAS.md`](../../ARMADILHAS.md).
