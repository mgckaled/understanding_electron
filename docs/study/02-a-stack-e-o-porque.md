# 02 — A stack e o porquê

Escolher versão de biblioteca parece burocracia até o dia em que uma escolha errada custa uma tarde. Este documento registra o raciocínio por trás de cada peça — inclusive das que decidimos **não** usar.

## O princípio que guiou tudo

> Um gerenciador de pacotes entrega **reprodutibilidade**, não **corretude**.

Vale desdobrar, porque essa frase economiza muita frustração.

Quando você roda `pnpm install`, ele resolve versões seguindo as regras do **semver** (*semantic versioning*, o padrão `MAIOR.MENOR.CORREÇÃO` que quase todo pacote JavaScript usa) e verifica as `peerDependencies` — declarações do tipo "eu funciono com React 19, mas não instalo o React por você".

Isso garante que a mesma instalação em outra máquina produza exatamente a mesma árvore de dependências. É reprodutibilidade, e é valiosa.

O que ele **não** faz é saber se as peças funcionam juntas de verdade. Ele não sabe que uma ferramenta de build assume um comportamento que outra biblioteca mudou. Não sabe que uma opção de configuração foi removida numa versão nova. Não sabe se um módulo compilado bate com a versão do runtime.

Nada disso é expressável como semver ou peer dependency. E é exatamente aí que a stack Electron quebra — como o [diário de bordo](04-diario-de-bordo.md) documenta com dois casos reais deste projeto.

Por isso as versões abaixo foram escolhidas uma a uma.

---

## Node.js 24 (local)

**O que é:** o ambiente que executa JavaScript fora do navegador.

**Por que a 24:** é a versão em **Active LTS**. *LTS* significa *Long Term Support* — linhas de versão que recebem correções por anos em vez de meses. O Node alterna: versões pares viram LTS, ímpares são experimentais. A 24 tem suporte garantido até abril de 2028.

**Por que não a 26:** ela existe e é a "Current" — a linha mais nova, que recebe as novidades primeiro e ainda pode mudar comportamento. Só entra em LTS em outubro de 2026. Para uma base de aprendizado, estabilidade vale mais que novidade.

⚠️ **A confusão mais comum:** o Node 24 que você instalou na sua máquina **não é** o Node que roda dentro do Electron. São dois completamente separados.

- O Node local executa as *ferramentas*: Vite, TypeScript, pnpm, ESLint.
- O Node embutido no Electron executa o *seu aplicativo*, no processo main.

No nosso caso a coincidência é quase perfeita — local 24.19.0, embutido 24.18.0 — mas isso é sorte da versão atual do Electron, não regra. Em outras majors do Electron esses números divergem bastante. Quando precisar saber com certeza qual Node o app usa, consulte `process.versions.node` dentro do main process.

> 🔍 Foi exatamente essa distinção que levou à correção do `@types/node` neste projeto. O template vinha com os tipos do Node 22; como o Electron 42 embute o Node 24, os tipos estavam descrevendo APIs de uma versão diferente da que roda de fato.

---

## pnpm 11.18.0

**O que é:** um gerenciador de pacotes, alternativa ao npm.

**Por que pnpm:** ele instala cada versão de cada pacote **uma única vez** no computador inteiro, num diretório central chamado *store*, e cria links para dentro dos projetos. Dez projetos usando React 19 guardam um React no disco, não dez.

O ganho maior, porém, é outro: o pnpm monta o `node_modules` de forma **estrita**. No npm, todas as dependências — inclusive as dependências das suas dependências — ficam empilhadas num diretório plano, e seu código consegue importar pacotes que você nunca declarou. Isso se chama **dependência fantasma** (*phantom dependency*), e é insidioso: funciona na sua máquina, quebra quando a dependência intermediária muda de versão e para de trazer o pacote junto. O pnpm impede isso por construção.

**Por que a 11:** é a versão atual. Ela reescreveu o índice do store para SQLite (mais rápido) e endureceu os padrões de segurança.

⚠️ **O que muda da 10 para a 11 e pega desprevenido:**

1. **Configuração mudou de lugar.** O campo `pnpm` do `package.json` não é mais lido. O `.npmrc` só serve para autenticação e registry. Tudo o mais vai para `pnpm-workspace.yaml`, com chaves em camelCase.

2. **Scripts de instalação agora falham em vez de avisar.** Muitos pacotes rodam código na instalação — o chamado **postinstall**. Até a versão 10 isso acontecia com um aviso; na 11 é erro, a menos que você autorize explicitamente o pacote na chave `allowBuilds`. É uma proteção de cadeia de suprimentos: script de postinstall é execução de código arbitrário na sua máquina, e ataques por esse vetor são reais.

3. **Pacotes recém-publicados são bloqueados.** O padrão `minimumReleaseAge` é de 1440 minutos — 24 horas. A lógica é que pacote comprometido costuma ser detectado e despublicado em poucas horas, então esperar um dia elimina boa parte do risco.

O `pnpm-workspace.yaml` final deste projeto:

```yaml
allowBuilds:
  electron: true
  electron-winstaller: false
  esbuild: true
shamefullyHoist: true
```

Sobre `electron-winstaller: false` — ele gera instaladores no formato Squirrel.Windows, e o electron-builder usa NSIS por padrão. Negamos explicitamente. A regra é negar por padrão e liberar sob demanda.

Sobre `shamefullyHoist: true` — o nome é uma piada dos autores do pnpm ("hoist vergonhoso"). Ele desliga a estrutura estrita e volta ao `node_modules` plano do npm. Veio do template porque o `electron-builder` espera esse layout ao recompilar módulos nativos. É um recuo consciente: abrimos mão da proteção contra dependência fantasma em troca de compatibilidade com uma ferramenta.

---

## Electron 42.8.0

**Por que não a 39 do template:** o Electron corta uma versão maior a cada **8 semanas** e mantém suporte apenas para as **3 mais recentes**. O template do electron-vite foi publicado por volta de março de 2026 e fixava a 39 — que já estava fora da janela de suporte quando fomos usá-lo.

Isso não é detalhe cosmético. O Electron embute o Chromium, e o Chromium é o componente com mais vulnerabilidades descobertas por mês em qualquer stack de software. Versão fora de suporte significa navegador sem correção de segurança dentro do seu aplicativo.

**A consequência para o projeto:** atualizar o Electron não pode ser reativo. Com 8 semanas por ciclo e 3 versões suportadas, você tem cerca de 24 semanas antes de sair da janela. Vira tarefa agendada.

> 🔍 Enquanto montávamos o projeto, o Electron 43 foi lançado. As versões suportadas hoje são 43, 42 e 41 — nosso 42.8.0 segue coberto. Mas o exemplo é ilustrativo: a informação envelheceu em questão de dias.

---

## electron-vite 5.0.0 + Vite 7

**O que é o Vite:** uma ferramenta de build para web. Ela faz duas coisas bem distintas. Em desenvolvimento, serve seu código com **HMR** (*Hot Module Replacement*) — você salva um arquivo e a tela atualiza sozinha em milissegundos, preservando o estado da aplicação. Em produção, empacota tudo em arquivos otimizados.

**Por que o electron-vite e não o Vite puro:** um app Electron tem três alvos de compilação com necessidades opostas. Main e preload rodam em Node (formato CommonJS/ESM de Node, acesso a `fs`, `path`). O renderer roda no navegador (ESM, sem acesso ao sistema). O electron-vite orquestra os três, cada um com sua configuração, e ainda reinicia o processo Electron quando o código do main muda.

**Por que Vite 7 e não 8:** aqui a decisão foi conservadora e merece transparência.

O Vite 8 é estável desde março de 2026 e traz o **Rolldown**, um bundler escrito em Rust que promete builds de 10 a 30 vezes mais rápidos. É tentador.

O problema: o electron-vite 5.0.0 é da mesma época e não declara suporte ao Vite 8. Não encontramos afirmação explícita nem de compatibilidade nem de incompatibilidade. Diante da incerteza, num projeto cujo objetivo é *aprender Electron*, ficamos no Vite 7 — não faz sentido gastar a energia depurando integração de bundler.

Se algum dia for preciso migrar, o `vite-plugin-electron` (mantido pela mesma organização) declara suporte explícito a Vite 7 e 8. É o plano B documentado.

⚠️ **Cuidado com uma armadilha correlata:** o `@vitejs/plugin-react` tem uma linha 6.x que provavelmente acompanha o Vite 8. Ficamos na 5.x. Aceitar a sugestão de atualização do pnpm aqui quebraria a instalação.

---

## TypeScript 5.9.3

**O que é:** JavaScript com sistema de tipos. Você declara que uma função recebe número e devolve texto, e o compilador reclama antes de rodar se você violar isso.

**Por que importa num app de dados:** análise de dados é território de erro silencioso. Uma coluna que às vezes vem `null`, um índice fora do intervalo, uma data que chega como texto. Esses bugs não estouram — eles produzem um número errado que ninguém questiona. O sistema de tipos transforma parte dessa categoria em erro de compilação.

**Por que não o TypeScript 6 ou 7:** o TS 7 saiu em julho de 2026, com o compilador reescrito em Go e cerca de 10× mais rápido. O TS 6 é a ponte entre os dois mundos.

O TS 6 é explicitamente uma **release de transição**: ele remove o que estava marcado como obsoleto há várias versões. Saem `moduleResolution: "node"`, `baseUrl`, suporte a target ES5 e os formatos de módulo `amd`, `umd` e `systemjs`. E vários padrões mudam de valor.

O template veio com 5.9.3. Decidimos validar a base primeiro e tratar a migração como exercício isolado — coerente com o princípio de uma variável por vez. Já mapeamos um ponto que vai quebrar: `tsconfig.web.json` usa `baseUrl: "."`, e o campo `paths` funciona sem ele desde o TS 4.1. A ferramenta `tsc --ts6-migration` gera o relatório completo quando chegar a hora.

**Configurações recomendadas quando migrar:** além de `strict`, vale ligar `noUncheckedIndexedAccess` (acessar `array[5]` passa a devolver um tipo que pode ser `undefined`, forçando você a tratar) e `exactOptionalPropertyTypes`. As duas incomodam no começo e são exatamente as que pegam bug em código de análise de dados.

---

## React 19.2.8

**Por que React:** a escolha foi pelo ecossistema, não por preferência estética. O problema central deste app é exibir tabelas enormes e gráficos, e é no React que vivem as bibliotecas mais maduras para isso — TanStack Table para grades virtualizadas, ECharts e visx para visualização.

**Por que a 19.2.8 especificamente:** é a versão estável atual. Não existe React 20.

> 🔍 Pesquisando sobre React 19 você vai esbarrar em alertas sobre o **React2Shell** (CVE-2025-55182), classificado com severidade máxima. Ele **não afeta este projeto**: é uma falha de desserialização no protocolo Flight dos *React Server Components*, e num app Electron não existe servidor RSC — o React roda só no renderer. Vale saber disso para não entrar em pânico e não gastar tempo com uma mitigação desnecessária.

**Detalhe que costuma gerar dúvida:** o React está em `devDependencies`, não em `dependencies`. Está correto. O React é compilado para dentro do pacote final do renderer durante o build; ele não precisa existir como módulo instalado quando o app roda na máquina do usuário.

---

## electron-builder 26

**O que faz:** transforma a pasta do projeto em algo instalável — `.exe` no Windows, `.dmg` no macOS, `.AppImage`/`.deb` no Linux. Cuida de assinatura de código, ícones e atualização automática.

**Por que importa desde já:** ele já apareceu no `postinstall` do projeto, rodando `install-app-deps`. Esse comando invoca o `@electron/rebuild`, que **recompila módulos nativos contra a ABI do Electron**.

Destrinchando: um **módulo nativo** é um pacote npm que contém código C ou C++ compilado, não só JavaScript. **ABI** (*Application Binary Interface*) é o contrato de baixo nível entre esse binário e o runtime que o carrega. Como o Electron embute um Node próprio, um módulo compilado para o Node da sua máquina pode não carregar dentro do Electron. O `install-app-deps` resolve isso recompilando.

Esse mecanismo é exatamente o que vai ser exercitado quando o DuckDB entrar no projeto — e é um bom sinal que ele já esteja funcionando antes disso.

---

## Ferramental auxiliar

**ESLint** analisa o código em busca de padrões problemáticos. **Prettier** formata automaticamente, encerrando discussões sobre estilo. Ambos vieram do template configurados.

> 🔍 Existe uma alternativa moderna chamada **Biome**, que faz lint e formatação num único binário escrito em Rust, muito mais rápido. Vale considerar se o ESLint começar a incomodar pela lentidão — mas trocar ferramenta que já funciona não é prioridade num projeto de aprendizado.

---

## Resumo das decisões

| Decisão | Alternativa recusada | Razão |
|---|---|---|
| Node 24 LTS | Node 26 Current | Estabilidade sobre novidade |
| pnpm 11 | npm | `node_modules` estrito, store compartilhado |
| Electron 42 | Electron 39 (template) | 39 fora da janela de suporte |
| Vite 7 | Vite 8 + Rolldown | Suporte do electron-vite não confirmado |
| TypeScript 5.9 | TypeScript 6 ou 7 | Migração como exercício isolado depois |
| React 19 | Vue, Svelte | Ecossistema de tabela e gráfico |
| DuckDB via N-API | Python sidecar, SQLite | Um runtime só, colunar, sem recompilar |

---

**Anterior:** [01 — O que é Electron](01-o-que-e-electron.md) · **Próximo:** [03 — Anatomia do projeto](03-anatomia-do-projeto.md)
