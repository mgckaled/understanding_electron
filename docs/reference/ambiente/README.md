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

