# 04 — Diário de bordo

Tutorial mostra o caminho limpo. A realidade tem tropeços — e é neles que se aprende a diagnosticar, que é a habilidade que sobrevive quando as versões mudam.

Este documento registra os problemas reais deste projeto, na ordem em que apareceram, com o raciocínio de investigação preservado. Não só "o que resolveu", mas "como se chegou lá".

---

## Caso 1 — A configuração que estava em lugar nenhum

### O sintoma

Antes de instalar qualquer coisa, na revisão do `package.json` gerado pelo template, dois blocos chamaram atenção:

```json
"pnpm": {
  "onlyBuiltDependencies": ["electron", "esbuild"]
}
```

```ini
# .npmrc
shamefully-hoist=true
```

Nenhum erro. Nenhum aviso. O projeto teria instalado sem reclamar.

### O diagnóstico

Ambos estavam mortos, por razões diferentes:

1. O pnpm 11 **não lê mais o campo `pnpm`** do `package.json`. Toda configuração migrou para `pnpm-workspace.yaml`, com chaves em camelCase.
2. A opção `onlyBuiltDependencies` **foi removida** na versão 11, substituída por `allowBuilds`.
3. O `.npmrc` no pnpm 11 só é consultado para autenticação e registry. `shamefully-hoist` ali é ignorado.

O template do electron-vite foi publicado quando o pnpm 10 era corrente. Envelheceu em silêncio.

### Por que isso é perigoso

Esta é a classe de falha mais traiçoeira que existe: **configuração ignorada não gera erro.** O comando roda, termina em verde, e o comportamento é diferente do que o arquivo declara.

Se ninguém tivesse aberto o `package.json`, o problema apareceria semanas depois, de forma deslocada da causa — um build quebrando por falta do hoisting, uma dependência não construída. E ninguém conectaria o efeito com um bloco de configuração que "está lá, claramente escrito".

### A correção

Criar `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  electron: true
  esbuild: true
shamefullyHoist: true
```

E remover os blocos mortos.

### A lição

Ao adotar template de terceiro, **verifique a data**. Um scaffold é uma fotografia do ecossistema no dia em que foi publicado. Quando alguma peça da sua stack é mais nova que essa foto, a diferença precisa ser conferida à mão.

> 🔍 O pnpm ajudou aqui de um jeito elegante: durante o install, ele detectou um pacote com script de build que não estava em `allowBuilds` (o `electron-winstaller`) e **escreveu uma entrada com placeholder no próprio arquivo**: `electron-winstaller: set this to true or false`. Configuração que se autodocumenta ao ser violada é bom design de ferramenta.

---

## Caso 2 — Uma versão fora de suporte, escondida à vista

### O sintoma

O template fixava:

```json
"electron": "^39.2.6"
```

Instalaria perfeitamente. Rodaria perfeitamente.

### O diagnóstico

O Electron lança uma versão maior a cada **8 semanas** e mantém suporte apenas para as **3 mais recentes**. Quando o projeto foi montado, a última era a 42. Suportadas: 42, 41 e 40.

A 39 estava fora — sem correções de segurança.

### Por que isso importa mais no Electron que em outras dependências

Porque o Electron embute o Chromium, e o Chromium é dos componentes mais atacados do mundo do software. Uma versão sem patch não é dívida técnica abstrata: é um navegador com vulnerabilidades conhecidas rodando dentro do seu aplicativo, na máquina do usuário.

### A correção

Alterar para `^42.0.0` **antes** do primeiro install — evitando baixar duas vezes um binário de mais de 200 MB.

### A lição

Não existe "instalar e esquecer" com Electron. Com 8 semanas por ciclo e 3 versões suportadas, a janela é de cerca de 24 semanas. Atualização vira **tarefa agendada**, não reação a problema.

> 🔍 Enquanto este projeto era montado, o Electron 43 foi lançado. A informação sobre "qual é a última versão" envelheceu em dias. As suportadas passaram a ser 43, 42 e 41 — nosso 42.8.0 segue coberto, mas o exemplo é ilustrativo do ritmo.

---

## Caso 3 — `Error: Electron uninstall`

O caso mais instrutivo dos três, porque o erro mente sobre a causa.

### O sintoma

O `pnpm install` foi limpo. O `pnpm dev` começou bem:

```
✓ built in 289ms
electron main process built successfully
electron preload scripts built successfully
dev server running at http://localhost:5173/
```

Main compilou. Preload compilou. Servidor do renderer no ar. E então:

```
error during start dev server and electron app:
Error: Electron uninstall
    at getElectronPath (.../electron-vite/dist/chunks/lib-q6ns0vZr.js:155:19)
```

### A investigação

**Primeira hipótese, e por que foi descartada.** A suspeita natural era o `allowBuilds` — talvez o script de instalação do Electron tivesse sido bloqueado pelo pnpm.

Mas o log do install contradizia isso. Ele mostrava explicitamente os postinstalls que rodaram:

```
node_modules/.pnpm/esbuild@0.28.1/.../esbuild: Running postinstall script, done in 7.6s
node_modules/.pnpm/esbuild@0.25.12/.../esbuild: Running postinstall script, done in 2.3s
```

E o único bloqueado, nomeado no erro:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: electron-winstaller@5.4.0
```

O `electron` não aparecia em nenhuma das duas listas. Nem executado, nem bloqueado. **Ausência é informação.**

**Segundo passo: olhar o disco em vez de teorizar.**

```
node_modules/.pnpm/electron@42.8.0.../node_modules/electron/
├── install.js      ← o script de download existe
├── index.js
├── package.json
└── (nenhuma pasta dist/, nenhum path.txt)
```

Fato estabelecido: o binário do Electron nunca foi baixado. A pergunta virou *por quê*.

**Terceiro passo: ler o `package.json` do próprio Electron.**

```json
{
  "name": "electron",
  "version": "42.8.0",
  "bin": {
    "electron": "cli.js",
    "install-electron": "install.js"
  }
}
```

Aqui a resposta apareceu, e era surpreendente: **não existe campo `scripts`.** O Electron 42 não tem postinstall nenhum.

Lendo o `index.js` do pacote, o modelo novo ficou claro:

```js
const pathFile = path.join(__dirname, 'path.txt');

function downloadElectron() {
  console.log('Downloading Electron binary...');
  spawnSync(process.execPath, [path.join(__dirname, 'install.js')], ...);
}

function getElectronPath() {
  if (fs.existsSync(pathFile)) { /* usa o caminho salvo */ }
  // se não existe, chama downloadElectron()
}
```

O Electron passou a usar **download preguiçoso**: o binário é baixado na primeira vez que alguém faz `require('electron')`, não na instalação.

### A causa raiz

O electron-vite 5.0.0 tem uma implementação **própria** de `getElectronPath`. Ela lê `node_modules/electron/path.txt` diretamente e lança `Electron uninstall` se o arquivo não existir. Ela nunca chama o `index.js` do Electron — portanto nunca aciona o download preguiçoso.

Duas bibliotecas com suposições incompatíveis sobre quando o binário aparece. O electron-vite 5.0.0 é de março de 2026 e assume o modelo antigo; o Electron 42 mudou depois.

### A correção

```powershell
pnpm exec install-electron
```

O pacote expõe o `install.js` como executável (visto no campo `bin`). Rodá-lo diretamente força o download.

### Por que este caso é o mais importante do documento

Porque ele demonstra, de forma concreta, o princípio que abre o [documento 02](02-a-stack-e-o-porque.md):

> Um gerenciador de pacotes entrega reprodutibilidade, não corretude.

Nenhuma ferramenta poderia ter previsto isso. Não é conflito de semver — as versões são compatíveis pelos números. Não é `peerDependency` violada — nenhuma das duas declara nada a respeito. É uma **suposição sobre comportamento de runtime** que uma biblioteca fazia sobre outra, e que deixou de valer.

`pnpm install` verde. Aplicação que não abre.

### A lição de método

O que resolveu o caso não foi conhecimento prévio do bug — foi a sequência de investigação:

1. **Ler o log com atenção ao que *não* está lá.** A ausência do `electron` na lista de postinstalls foi a primeira pista real.
2. **Verificar o estado do disco antes de teorizar.** `path.txt` existe? A pasta `dist/` existe? Fato bate teoria.
3. **Abrir o `package.json` da dependência.** Ele é público, está no seu `node_modules`, e responde perguntas que documentação desatualizada não responde.
4. **Ler o código-fonte da dependência.** O `index.js` do Electron tem 60 linhas legíveis e continha a resposta inteira.

Os passos 3 e 4 são os que a maioria evita, por parecerem avançados. São os mais baratos: os arquivos já estão na sua máquina.

> 🔍 Detalhe curioso: o `pnpm exec install-electron` não imprimiu **nada** e terminou instantaneamente. A explicação provável não é elegância de design, e sim cache — o `@electron/get` guarda os downloads em `%LOCALAPPDATA%\electron\Cache`, e o zip já estava lá, provavelmente colocado pelo `@electron/rebuild` durante o `install-app-deps`. Ou seja: o download tinha acontecido, faltava só a extração para o `node_modules`.

---

## Caso 4 — Tipos descrevendo a versão errada

### O sintoma

Nenhum. Compilava, rodava, sem aviso.

### O diagnóstico

O template trazia `"@types/node": "^22.19.1"`. Mas a barra de versões do próprio aplicativo, ao abrir, informava:

```
Electron v42.8.0 | Chromium v148.0.7778.280 | Node v24.18.0
```

Os tipos descreviam as APIs do Node 22; o runtime era Node 24.

Um segundo indício confirmou: o `package.json` do pacote `electron` declara `"@types/node": "^24.9.0"` entre suas dependências — o próprio Electron se alinha com a 24.

### Por que passa despercebido

Porque é um erro de **omissão**, não de contradição. APIs novas do Node 24 simplesmente não apareceriam no autocompletar, e usá-las daria erro de tipo apesar de funcionarem em execução. Você contornaria sem entender por quê — provavelmente com um `any` no meio do caminho.

### A correção

```json
"@types/node": "^24"
```

Seguido de `pnpm typecheck` para confirmar que subir uma major de tipos não acordou erro em código que compilava. Passou limpo.

### A lição

`@types/node` deve espelhar o Node que **o Electron embute**, não o que está instalado na sua máquina. São coisas diferentes, e a fonte de verdade é `process.versions.node` dentro do main process.

⚠️ E cuidado com a sugestão do pnpm: ele informa que `@types/node 26.1.2` está disponível. Aceitar seria repetir o mesmo erro na direção oposta.

---

## O padrão por trás dos quatro casos

Nenhum dos quatro foi detectado pelo gerenciador de pacotes. Todos passariam por um `pnpm install` verde.

| Caso | Detectável por semver? | Como foi encontrado |
|---|---|---|
| Config do pnpm em lugar morto | Não | Revisão manual antes do install |
| Electron 39 sem suporte | Não | Conhecimento da política de releases |
| `Error: Electron uninstall` | Não | Investigação após falha em execução |
| `@types/node` desalinhado | Não | Comparação com o runtime real |

Compatibilidade de versão e compatibilidade de comportamento são coisas distintas. A primeira é automatizável; a segunda exige leitura, verificação e desconfiança produtiva.

Daí o princípio de trabalho adotado no `CLAUDE.md`: **uma variável por vez.** Este projeto tem quatro fontes independentes de incompatibilidade — Electron, bundler, TypeScript e módulos nativos. Mudar duas coisas antes de validar transforma um diagnóstico de dez minutos numa tarde de bissecção.

Instale. Valide com `pnpm dev`. Commite. Só então siga.

---

## Fase 06 — primeira feature vertical

Três casos novos, todos descobertos na validação do passo 5 — o passo que existe justamente para pegar o que teste automatizado não pega.

### Caso 5 — A documentação dizia uma coisa, o runtime fazia outra

**O sintoma.** Antes de escrever `src/main/features/dataset/lines.ts`, a documentação do `node:readline` (`rl[Symbol.asyncIterator]()`) trazia uma frase que parecia decisiva: "Errors in the input stream are not forwarded." A leitura óbvia: um `for await` sobre `readline.createInterface({ input: fs.createReadStream(...) })` nunca lançaria para `ENOENT` ou `EACCES` — seria preciso um mecanismo à parte (cogitado: `Promise.race` por `.next()` entre o iterador real e um listener de `'error'` no stream) só para transformar isso em `Result`.

**A investigação.** Em vez de implementar a versão complexa em cima da frase da doc, um script de trinta linhas no scratchpad testou os dois casos reais do projeto — caminho inexistente e caminho que é diretório — com `stream.on('error', () => {})` registrado:

```
--- nonexistent file ---
stream error event: ENOENT
for-await threw: ENOENT
--- directory as file ---
stream error event: EISDIR
for-await threw: EISDIR
```

O `for await` **lançou** normalmente nos dois casos, contradizendo a leitura direta da frase.

**A correção.** Doze linhas, sem `Promise.race`:

```ts
async function* readLines(path: string): AsyncGenerator<string> {
  const stream = createReadStream(path)
  stream.on('error', () => {}) // sem isto, 'error' sem handler derruba o processo
  const rl = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of rl) yield line
  } finally {
    rl.close()
  }
}
```

O `stream.on('error', ...)` continua obrigatório — sem handler algum, o `'error'` sem ouvinte derruba o processo Node antes mesmo de chegar ao `for await`. É a presença desse listener (mesmo vazio) que faz o erro tomar o caminho que o `for await` consegue capturar.

**A lição.** Uma frase de documentação genérica descreve um comportamento observado por quem escreveu, num contexto que pode não ser o seu. Antes de desenhar um mecanismo em cima dela, um script de trinta linhas testando o caso real do projeto substitui uma hipótese por um fato — e aqui a implementação real ficou um terço do tamanho da versão desenhada para a hipótese.

### Caso 6 — `rl.close()` não fecha o que parece fechar

**O sintoma.** Ninguém tropeçou nisto em execução — foi antecipado antes de rodar a GUI, ao revisar o que `D6.7` exige ("cancelamento remove a entrada do `Map`... a operação, ao terminar por qualquer via"). A pergunta: `rl.close()` no `finally` do generator é suficiente para parar a leitura de disco quando o consumidor cancela a meio caminho?

**A investigação.** Um script no scratchpad leu um CSV de teste, deu `break` após 5 linhas, e mediu o `stream` do `fs.createReadStream` subjacente:

```
lines read before break: 5
immediately after break: stream.destroyed = false   bytesRead = 65536
data events observed 300ms after break: 0
final: stream.destroyed = false   bytesRead = 131072
```

`bytesRead` **dobrou** nos 300ms seguintes ao `break`, sem nenhum consumidor lendo mais nada. `rl.close()` desliga o controle do `readline` sobre o stream — não o `stream` em si. O buffer interno do `Readable` (`highWaterMark`) seguia puxando do disco por conta própria.

**A correção.** Uma linha a mais no mesmo `finally`:

```ts
} finally {
  rl.close()
  stream.destroy() // sem isto, bytesRead segue crescendo depois do break — confirmado acima
}
```

Reexecutado, o mesmo script confirmou `destroyed = true` e `bytesRead` estável nos 300ms seguintes.

**A lição.** `readline.Interface` e o `stream` que ele envolve são dois objetos com ciclos de vida independentes. Fechar o de cima não fecha o de baixo. Vale para qualquer wrapper de stream do Node: o método "close" do wrapper raramente propaga para a fonte — quando cancelamento de I/O importa, teste o `bytesRead`/`destroyed` do stream real, não só o retorno da função de alto nível.

### Caso 7 — Tela em branco sem nenhum erro no terminal

**O sintoma.** `pnpm build` limpo, `pnpm dev` subiu sem uma linha de erro no terminal — e a janela do app abriu **vazia**, sem nenhum dos painéis. Nenhuma pista no processo onde o `pnpm dev` roda, porque o erro não estava lá: estava no processo do *renderer*, visível só no DevTools da própria janela (F12).

**A investigação.** O Console do DevTools mostrou a causa em duas linhas:

```
Unable to load preload script: .../out/preload/index.js
Error: module not found: zod
```

E o efeito em cascata: `window.api` ficou `undefined` porque o preload nunca terminou de carregar, e todo componente que usa `window.api.*` (a partir de `Versions`, que roda no primeiro `useEffect` da árvore) lançou e derrubou a renderização.

A causa raiz remontava a uma regra que já estava escrita antes desta fase começar, na skill `architecture`: *"`preload/` pode importar `shared/` **(somente tipos)**"* — porque o preload sandboxed é um bundle único, sem `require` funcional para pacotes de terceiros (`externalizeDepsPlugin()` nunca entra nesse bloco do `electron.vite.config.ts`, de propósito). `src/shared/ipc.ts` importa `zod` como valor (para `argsSchema`). O passo 3 desta fase precisava do nome do canal `job:event` como **valor** dentro do preload (para `ipcRenderer.on(...)`), e foi importado direto de `@shared/ipc` — arrastando `zod` para o grafo de dependências do bundle do preload. O bundler deixou `zod` como um `require('zod')` externo não resolvido, e esse `require` só existe de verdade em runtime, no processo sandboxed, onde falha.

**A correção.** `src/shared/channels.ts`, um arquivo em `shared/` que não importa nada além do que ele mesmo declara:

```ts
export const JOB_EVENT_CHANNEL = 'job:event'
```

Preload e main passaram a importar a constante dali, não de `ipc.ts`. Nenhuma outra mudança de arquitetura — a regra já documentada voltou a valer.

**A lição.** `pnpm typecheck`, `pnpm lint` e `pnpm test` não pegam isto: nenhum dos três executa o bundle do preload dentro do sandbox real do Electron. Só `pnpm dev` (ou a fase 07, quando existir) exercita esse caminho. E quando o preload falha ao carregar, o sintoma não aparece onde se espera — o terminal do `pnpm dev` fica limpo, e o erro só existe no DevTools da janela, que precisa ser aberto deliberadamente (F12). Regra prática: **qualquer valor novo exportado de um arquivo em `shared/` que o preload vai consumir por valor (não só por tipo) precisa nascer num arquivo que não importe nada externo** — nunca reaproveitar um arquivo que já importa uma lib como `zod` só porque o tipo relacionado mora lá.

### A medição de desempenho

Com as três correções acima em vigor, o item que o plano pedia para medir e não presumir: `readLines` + `scanDelimited` sobre um CSV de 345,9 MB / 5.000.000 de linhas, gerado por `scripts/generate-large-csv.mjs`, fora do processo Electron (Node puro, sem overhead de IPC):

| Métrica | Valor |
|---|---|
| Tamanho do arquivo | 345,9 MB |
| Linhas | 5.000.000 |
| Tempo total | 3,23 s |
| Throughput | ~107 MB/s |
| Emissões de progresso (throttle 100 ms) | 32 |

Dentro do app (Electron, com IPC e overhead do main process), a validação interativa com o mesmo arquivo confirmou: o escaneamento completa, o resumo aparece na interface, sem travamento perceptível — mas 3 segundos é rápido demais para observar em detalhe arrastar/redimensionar a janela ou testar cancelamento a meio caminho com segurança. Essa parte específica (cancelamento observado ao vivo com Gerenciador de Tarefas, durante um escaneamento real de segundos) não chegou a ser confirmada interativamente nesta sessão — a garantia de que o cancelamento realmente para a leitura vem da medição isolada do Caso 6 acima e do teste automatizado `scanDataset > removes the job entry on finish`, não de uma observação ao vivo dentro do app com um arquivo grande o bastante para dar tempo de clicar.

`for await` sobre `readline` é documentadamente mais lento que a API de evento `'line'` — não investigado aqui; ~107 MB/s já está bem acima do que a interface consegue desenhar, então não é o gargalo desta fase.

---

**Anterior:** [03 — Anatomia do projeto](03-anatomia-do-projeto.md) · **Próximo:** [05 — Próximos passos](05-proximos-passos.md)
