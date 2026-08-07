# 06 — A montanha de configuração

Conte os arquivos de configuração deste projeto: passam de vinte. Agora conte as funcionalidades entregues ao usuário final: uma, e ela abre um arquivo de texto.

A desproporção é chocante quando você percebe, e a reação natural é achar que alguém exagerou. Este documento defende que não — e, mais útil que a defesa, explica **de onde vem cada arquivo**, para que você saiba qual mexer quando algo quebrar.

---

## A pergunta

> Por que um aplicativo de desktop exige tanta configuração antes de fazer qualquer coisa?

A resposta curta cabe numa frase:

> Porque um app Electron é **três programas em ambientes incompatíveis dentro de um repositório só**, e cada ferramenta da cadeia precisa saber de qual deles você está falando.

Um site é um alvo. Um servidor Node é um alvo. Um app Electron é três — main, preload e renderer —, com globais diferentes, formatos de módulo diferentes e regras de segurança diferentes. Toda ferramenta que toca o código precisa dessa informação: o compilador de tipos, o bundler, o analisador de código, o executor de testes, o empacotador.

Não é uma ferramenta configurada cinco vezes. São cinco ferramentas que precisam da mesma verdade, e nenhuma delas lê a configuração da outra.

> 🔍 Vale relativizar a queixa. Um projeto nativo equivalente teria arquivo de build por plataforma, manifesto de permissões, configuração de assinatura e um sistema de build próprio. A configuração não nasceu com o JavaScript — ela ficou **visível**, porque está em texto no seu repositório em vez de escondida atrás de uma interface gráfica.

---

## Organizando pela pergunta que cada arquivo responde

Listar por ordem alfabética não ensina nada. O que ajuda é agrupar por **pergunta respondida** — porque é assim que você vai procurar quando precisar.

### "O que compilar, e para onde?"

| Arquivo | Papel |
|---|---|
| `electron.vite.config.ts` | Três blocos, um por alvo. Cada um com suas regras. |
| `config/aliases.ts` | Os atalhos de importação, num lugar só |

O arquivo de build é o mais direto de entender: ele tem literalmente uma chave `main`, uma `preload` e uma `renderer`. O que confunde é que **o mesmo código-fonte pode precisar de tratamento oposto** dependendo do bloco em que está.

O exemplo mais afiado é o preload. Com o sandbox ligado, ele não consegue carregar biblioteca de terceiro em tempo de execução — logo, tudo que ele usa precisa ser embutido no arquivo final. O main, ao contrário, resolve dependências normalmente e não deve embutir nada. É a mesma ferramenta, com a decisão invertida entre dois blocos vizinhos.

### "Que tipos existem aqui?"

| Arquivo | Cobre |
|---|---|
| `tsconfig.json` | nada — só aponta para os outros três |
| `tsconfig.node.json` | main, preload, shared, core, workers |
| `tsconfig.web.json` | renderer, e o apoio de teste |
| `tsconfig.e2e.json` | os testes que dirigem o aplicativo real |

Quatro arquivos, três projetos. O detalhamento está no [caderno 03](03-anatomia-do-projeto.md); o que interessa aqui é *por que são vários*: com um só, você poderia importar o sistema de arquivos dentro de um componente de interface e o compilador aprovaria.

⚠️ **Armadilha real deste projeto.** Sem o campo `types`, o compilador inclui automaticamente todos os pacotes de tipos instalados. No dia em que você adiciona esse campo — para declarar as funções globais de teste, por exemplo — essa inclusão automática **é substituída pela sua lista**. Tipos que entravam sozinhos param de entrar, e a verificação quebra num lugar sem relação nenhuma com o que você mexeu. Vale para qualquer projeto que ganhe `types` pela primeira vez.

### "O que conta como erro?"

| Arquivo | Papel |
|---|---|
| `eslint.config.mjs` | o que é defeito |
| `.prettierrc.yaml` | como o código se parece |
| `.prettierignore` | o que o formatador não toca |
| `.editorconfig` | o mínimo que todo editor entende |

A divisão entre os dois primeiros costuma confundir. A regra prática: **formatador cuida do que não muda o significado** (aspas, vírgula final, largura de linha); **analisador cuida do que muda** (variável não usada, dependência faltando, importação proibida).

O `.editorconfig` parece redundante com o formatador, e não é: ele é entendido por praticamente todo editor sem instalar nada, então garante o básico — codificação, fim de linha, indentação — mesmo para quem abrir o projeto sem as extensões instaladas.

🔍 O uso mais interessante do analisador neste projeto não é pegar variável não usada — é **transformar arquitetura em regra verificável**. A tabela de qual camada pode importar qual está escrita ali como configuração. Regra que existe só em documento é regra que se descobre violada seis arquivos depois.

### "O que é teste, e como rodar?"

| Arquivo | Papel |
|---|---|
| `vitest.config.ts` | testes rápidos, em dois ambientes simulados |
| `playwright.config.ts` | testes que sobem o aplicativo de verdade |
| `test/` | apoio: simulação da ponte, preparação do ambiente de interface |

São duas ferramentas porque são dois problemas. Uma roda em milissegundos simulando o ambiente; a outra abre uma janela real e clica nela, e cobra segundos ou minutos por isso. Detalhes no [caderno 09](09-testar-tres-processos.md).

⚠️ **Armadilha real.** Um padrão de arquivo mal ancorado — `src/shared/**` sem barra inicial — não significa "a pasta shared da raiz". Ele casa com **qualquer** caminho que contenha esse segmento, em qualquer profundidade. Como o projeto tem dois diretórios chamados `shared/`, a métrica de cobertura passou a incluir código que não deveria medir, sem erro nenhum, distorcendo o número em silêncio. Vale para qualquer par de pastas com nome repetido na árvore.

### "O que instalar, e como?"

| Arquivo | Papel |
|---|---|
| `package.json` | dependências, comandos, identidade |
| `pnpm-workspace.yaml` | como o gerenciador se comporta |
| `pnpm-lock.yaml` | a árvore exata resolvida — **commitado, sempre** |
| `.npmrc` | vazio |

O arquivo de trava é o que garante que a instalação de amanhã produza a mesma árvore de hoje. Ele é gerado, não editado à mão, e vai versionado — sem ele, cada máquina resolve versões por conta própria e "funciona na minha máquina" volta a ser uma frase possível.

🔍 **O `.npmrc` vazio merece um parágrafo**, porque é um fóssil instrutivo. Ele já teve conteúdo: configuração do gerenciador de pacotes. Uma versão maior mudou o lugar onde essa configuração mora, e o arquivo passou a ser **ignorado em silêncio** — sem aviso, sem erro, com a configuração aparentemente lá. O projeto rodou um tempo assim, achando ter ligado uma opção que não estava ligada. Hoje o arquivo continua existindo, vazio, porque a única coisa que ainda se lê dele é autenticação de registro. É um bom lembrete: **configuração ignorada é pior que configuração ausente**, porque a ausente você percebe.

### "O que vira instalador?"

| Arquivo | Papel |
|---|---|
| `electron-builder.yml` | o que entra no pacote, e como ele se instala |
| `build/` | ícones por plataforma e permissões declaradas |

Este é o arquivo com o maior potencial de dano silencioso do projeto, e vale entender por quê.

**O empacotador lê o disco, não o histórico do repositório.** Um arquivo que está no `.gitignore` — portanto nunca versionado — continua existindo na máquina de quem faz o build, e entra no pacote se a lista de inclusão não o excluir. Este projeto descobriu, inspecionando o pacote gerado, que uma chave de API pessoal estava sendo empacotada dentro do instalador exatamente por esse caminho.

A correção que importa não foi acrescentar a exclusão faltante — foi **inverter a lógica**: em vez de listar o que fica de fora, listar o que entra. Lista de exclusão só enumera o que alguém lembrou, e apodrece a cada arquivo novo na raiz; lista de inclusão faz o esquecimento cair para o lado seguro.

⚠️ E a verificação nunca é ler o padrão e concluir: é **abrir o pacote gerado e conferir o conteúdo**. Nenhum comando de verificação de tipos, análise ou teste inspeciona o que foi empacotado.

### "O que é da máquina, e não do projeto?"

| Arquivo | Papel |
|---|---|
| `.gitignore` | o que não entra no histórico |
| `.vscode/` | ajustes de editor que valem a pena compartilhar |
| `.claude/` | configuração do assistente: regras, automações |

A pasta do editor levanta uma pergunta legítima: por que versionar preferência de ferramenta pessoal? A resposta é que **algumas dessas preferências não são pessoais** — são consequência da estrutura do projeto. Excluir diretórios enormes do observador de arquivos e apontar o editor para o compilador do projeto (e não o embutido nele) evitam problemas concretos que todo mundo teria.

⚠️ **Armadilha real, e das piores.** Este projeto tinha ali duas chaves com nome errado. O editor **descarta chave desconhecida sem avisar** — nada de erro, nada de sublinhado. A configuração parecia ativa, estava inerte, e a documentação do projeto afirmava um efeito que não acontecia. Configuração de editor não falha: ela silencia. A única verificação é observar o efeito.

---

## A lição que amarra tudo

Depois de percorrer os arquivos, o padrão fica visível:

> **Toda configuração que existe em dois lugares é uma divergência esperando acontecer.**

Não é hipótese. Este projeto tem quatro pares assim, e três já divergiram de verdade:

| O par | O que acontece quando divergem |
|---|---|
| Atalhos de importação no bundler **e** no compilador de tipos | O editor reclama e o build funciona — ou o contrário. Sintoma desconcertante, causa invisível. |
| Cor de fundo no CSS **e** na criação da janela | Um flash da cor errada ao abrir, antes de a interface pintar. Some quando você vai investigar. |
| Identificador do app no código **e** no empacotador | O sistema operacional trata atalho e processo como aplicações diferentes: ícone não agrupa, notificação perde o dono. |
| O que o histórico ignora **e** o que o pacote exclui | Arquivo local — inclusive segredo — viaja para dentro do instalador. |

Três defesas possíveis, em ordem de preferência:

1. **Fonte única de verdade.** Um arquivo que as duas ferramentas leem. É o que `config/aliases.ts` faz pelo bundler e pelo executor de testes.
2. **Verificação automática.** Um teste que falha quando os dois valores divergem — é o que existe hoje para o identificador do aplicativo.
3. **Comentário cruzado.** Cada lado aponta para o outro: *"ao mudar aqui, mude lá"*. É a defesa mais fraca, porque depende de alguém ler — mas é infinitamente melhor que nada, e às vezes é a única possível, quando as duas ferramentas não têm formato em comum.

⚠️ Repare que a defesa 1 **não é sempre alcançável**, e o projeto é honesto quanto a isso: os atalhos de importação estão em `config/aliases.ts` para o bundler, mas os arquivos de tipos precisam repetir a mesma lista no formato deles. As duas ferramentas não leem o mesmo arquivo. Esse par continua sendo mantido à mão, com comentário cruzado — e é candidato a gerar divergência algum dia.

---

## O que fazer com isso na prática

Três hábitos que este projeto adotou e que valem em qualquer stack:

**Ao adicionar um tipo novo de arquivo local**, pergunte-se em quantas listas ele precisa aparecer. Segredo, cache e configuração de ferramenta normalmente aparecem em duas: a do histórico e a do pacote.

**Ao mudar configuração entre versões maiores de uma ferramenta**, confirme que ela ainda está sendo lida. Não confie na ausência de erro — configuração ignorada não avisa.

**Ao criar o segundo lugar onde um valor mora**, pare e escolha uma das três defesas ali mesmo. É a decisão mais barata de tomar naquele instante e a mais cara de descobrir depois.

---

**Anterior:** [05 — Próximos passos](05-proximos-passos.md) · **Índice:** [README](README.md) · **Próximo:** [07 — Camadas e o contrato](07-camadas-e-contrato.md)
