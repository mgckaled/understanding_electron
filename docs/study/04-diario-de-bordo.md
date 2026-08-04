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

**Anterior:** [03 — Anatomia do projeto](03-anatomia-do-projeto.md) · **Próximo:** [05 — Próximos passos](05-proximos-passos.md)
