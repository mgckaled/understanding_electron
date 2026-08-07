# 02 — Como escolher a stack

Escolher versão de biblioteca parece burocracia até o dia em que uma escolha errada custa uma tarde. Este documento não lista as versões deste projeto — elas estão em [`CLAUDE.md`](../../CLAUDE.md), e mudam. Ele registra **como decidir**, que é a parte que continua valendo depois que todos esses números tiverem virado história.

> 📌 **Convenção deste caderno.** Número de versão, data de release e comparação do tipo "X saiu em tal mês" envelhecem a cada ciclo. Onde forem indispensáveis, o texto aponta para o dono: [`CLAUDE.md`](../../CLAUDE.md) para a stack em uso, [`ROADMAP.md`](../ROADMAP.md) para o que falta subir e por que está parado.

---

## O princípio que guiou tudo

> Um gerenciador de pacotes entrega **reprodutibilidade**, não **corretude**.

Vale desdobrar, porque essa frase economiza muita frustração.

Quando você instala dependências, o gerenciador resolve versões seguindo as regras do **semver** (*semantic versioning*, o padrão `MAIOR.MENOR.CORREÇÃO` que quase todo pacote JavaScript usa) e verifica as **peerDependencies** — declarações do tipo "eu funciono com a versão 19 desta biblioteca, mas não a instalo por você".

Isso garante que a mesma instalação em outra máquina produza a mesma árvore de dependências. É reprodutibilidade, e é valiosa.

O que ele **não** faz é saber se as peças funcionam juntas de verdade. Ele não sabe que uma ferramenta de build assume um comportamento que outra biblioteca mudou. Não sabe que uma opção de configuração foi removida numa versão nova. Não sabe se um módulo compilado bate com a versão do runtime que vai carregá-lo.

Nada disso é expressável como semver ou peer dependency. E é exatamente aí que uma stack Electron quebra — como o [diário de bordo](04-diario-de-bordo.md) documenta com casos reais deste projeto.

**A consequência prática:** instalação verde não é aplicação que abre. A única prova de que a stack funciona é rodar o aplicativo. Daí o princípio de trabalho do projeto: instale **uma variável por vez**, valide, e só então siga.

---

## Runtime: por que LTS

**LTS** significa *Long Term Support* — linhas de versão que recebem correção por anos em vez de meses.

O Node alterna de forma previsível: versões de número par entram em LTS, ímpares são de vida curta e servem para experimentar novidade. A linha mais nova, chamada *Current*, recebe recurso novo primeiro e ainda pode mudar comportamento.

O critério que aplicamos: **para uma base de aprendizado, estabilidade vale mais que novidade.** Você quer que o tempo gasto seja com o problema que está estudando, não com uma regressão da semana passada numa ferramenta.

### A confusão que pega todo mundo

⚠️ O Node instalado na sua máquina **não é** o Node que roda dentro do Electron. São dois, completamente separados.

- O Node **local** executa as *ferramentas*: o bundler, o compilador de tipos, o gerenciador de pacotes, o linter.
- O Node **embutido no Electron** executa o *seu aplicativo*, no processo main.

Às vezes os números quase coincidem, e isso é sorte da versão atual — não regra. Em outras versões maiores do Electron eles divergem bastante.

**Como saber com certeza:** `process.versions.node`, lido dentro do processo main. É a fonte, e é a única que não mente.

> 🔍 Essa distinção não é acadêmica. Um erro real deste projeto foi ter os tipos do Node numa versão diferente da que o Electron embute: o compilador descrevia APIs de um runtime que não era o que ia executar. Estava tudo "verde" e tudo errado. Ao subir de versão maior do Electron, reconferir esse par é obrigatório.

---

## Gerenciador de pacotes: o que muda de verdade

A escolha aqui não é sobre velocidade, embora ela apareça. É sobre **o formato do `node_modules`**.

O modelo tradicional empilha todas as dependências — inclusive as dependências das suas dependências — num diretório plano. O efeito colateral é que seu código consegue importar pacotes que você **nunca declarou**. Isso se chama **dependência fantasma** (*phantom dependency*).

É insidioso porque funciona. Funciona na sua máquina, funciona no CI, e quebra no dia em que a dependência intermediária muda de versão e para de trazer o pacote junto. O sintoma chega meses depois do erro, sem relação aparente com a mudança que o causou.

Um gerenciador com layout **estrito** impede isso por construção: o que você não declarou, você não enxerga.

### Três endurecimentos que valem conhecer

Independentemente da ferramenta e da versão, estes três padrões vêm se tornando comuns e cada um pega alguém desprevenido:

1. **Configuração muda de lugar entre versões maiores.** Um campo que era lido no manifesto do projeto pode passar a ser ignorado — **em silêncio**, que é a parte ruim. Este projeto carregou configuração em lugar morto por um tempo sem perceber; o caso está no [diário de bordo](04-diario-de-bordo.md). Ao subir de versão maior, conferir onde a configuração deve morar é parte do trabalho, não detalhe.

2. **Scripts de instalação passam a falhar em vez de avisar.** Muitos pacotes executam código durante a instalação — o *postinstall*. Isso é execução de código arbitrário na sua máquina, vindo de um pacote que você talvez nem tenha escolhido diretamente. A tendência atual é exigir autorização explícita, pacote a pacote. É proteção de cadeia de suprimentos, e ataques por esse vetor são reais.

3. **Pacote recém-publicado fica em quarentena.** A lógica: pacote comprometido costuma ser detectado e despublicado em poucas horas. Esperar um dia antes de aceitar uma versão nova elimina boa parte do risco por um custo quase nulo.

### Quando abrir mão de uma proteção

Este projeto liga uma opção que **desfaz** o layout estrito, voltando ao diretório plano. Não é descuido — é um recuo consciente, porque a ferramenta de empacotamento espera esse formato ao lidar com módulos nativos.

O que torna isso aceitável não é a decisão em si, é o registro: está anotado como troca, com o evento que a reabre (a chegada do primeiro módulo nativo). **Decisão registrada com gatilho é dívida controlada; decisão silenciosa é dívida esquecida.**

---

## Electron: por que atualizar não pode ser reativo

O Electron embute o Chromium. O Chromium é, com boa margem, o componente com mais vulnerabilidades descobertas por mês em qualquer stack de software.

Some a isso duas características da política de releases do projeto: a cadência entre versões maiores é **curta** (semanas, não anos) e o suporte cobre apenas **as poucas versões mais recentes**. As duas juntas produzem uma conclusão incômoda:

> A janela entre "estou na versão mais nova" e "estou fora de suporte" é de poucos meses.

Versão fora de suporte significa um navegador sem correção de segurança dentro do seu aplicativo — distribuído para o usuário final, na máquina dele.

**A consequência de projeto:** atualizar o Electron precisa ser **tarefa agendada**, não reação a um aviso. Se você só atualiza quando algo quebra, você já passou meses vulnerável. Os números atuais da política estão na [documentação oficial de releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines); a pendência deste projeto está no [`ROADMAP.md`](../ROADMAP.md).

⚠️ Um efeito colateral que surpreende: **o template com que você começa já pode estar fora de suporte.** Geradores de projeto fixam a versão do dia em que foram publicados, e ficam parados. Conferir isso é a primeira coisa a fazer depois de gerar um projeto — foi assim que este começou.

---

## Ferramenta de build: por que uma específica para Electron

Um app Electron tem **três alvos de compilação com necessidades opostas**. Main e preload rodam em Node: acesso a sistema de arquivos, formato de módulo de Node. O renderer roda no navegador: sem acesso ao sistema, formato de módulo web.

Uma ferramenta de build genérica sabe fazer um desses. Uma específica para Electron orquestra os três, cada um com sua configuração, e ainda reinicia o processo do aplicativo quando o código do main muda.

**O que ganhamos em desenvolvimento** é o *HMR* (*Hot Module Replacement*): você salva um arquivo e a tela atualiza em milissegundos, preservando o estado da aplicação. Num app de dados isso vale muito — você não quer reabrir um arquivo de 2 GB a cada ajuste de CSS.

### O critério diante de compatibilidade não declarada

Vale registrar como decidimos, porque a situação se repete.

Uma versão nova de uma ferramenta central sai, com ganho real de desempenho. A camada que a integra ao Electron é de época parecida e **não declara** suporte a ela. Não há afirmação de compatibilidade nem de incompatibilidade — há silêncio.

O critério que aplicamos: **num projeto cujo objetivo é aprender X, não gaste energia depurando a integração de Y.** Ficar na versão anterior custa desempenho de build; avançar pode custar dias de investigação que não ensinam nada sobre Electron.

O que torna a decisão saudável é o que vem junto: um **plano B mapeado** (qual alternativa declara suporte) e um **gatilho** para revisitar. Registrado no [`ROADMAP.md`](../ROADMAP.md).

> 🔍 Como conferir suporte de verdade, sem depender de post de blog: leia o campo `peerDependencies` no manifesto do pacote instalado, dentro de `node_modules`. É a declaração formal do que o autor afirma suportar — e já contradisse, aqui, resultado de busca na web que dizia o contrário.

---

## Sistema de tipos: por que importa mais num app de dados

Análise de dados é território de **erro silencioso**. Uma coluna que às vezes vem nula, um índice fora do intervalo, uma data que chega como texto. Esses bugs não estouram — eles produzem um número errado que ninguém questiona, num relatório que alguém usa para decidir.

O sistema de tipos transforma parte dessa categoria em erro de compilação, que é a hora mais barata possível de descobrir.

Duas opções que valem ligar quando o projeto amadurecer, e que quase ninguém liga:

- **acesso indexado verificado** — acessar `array[5]` passa a devolver um tipo que pode ser indefinido, obrigando você a tratar o caso. Incomoda no começo, e é exatamente a que pega bug de análise de dados.
- **propriedades opcionais exatas** — distingue "a propriedade não existe" de "a propriedade existe e vale indefinido".

⚠️ **Sobre migrar de versão maior de compilador:** releases de transição removem o que estava obsoleto há tempo, e mudam padrões. Trate como exercício isolado, com seu próprio commit — nunca junto de outra mudança. É o princípio de uma variável por vez aplicado ao lugar onde ele mais paga.

---

## Interface: escolher pelo ecossistema

A escolha de biblioteca de interface aqui não foi estética. O problema central deste aplicativo é **exibir tabelas enormes e gráficos**, e o critério foi onde vivem as bibliotecas mais maduras para grade virtualizada e visualização.

É um critério que vale generalizar: quando o seu problema tem uma peça difícil e específica, escolha o ecossistema que já resolveu aquela peça. A ergonomia da biblioteca você contorna; a ausência de uma tabela virtualizada madura você não.

> 🔍 **Um detalhe que gera dúvida:** a biblioteca de interface aparece entre as dependências de *desenvolvimento*, não de produção. Está correto. Ela é compilada para dentro do pacote final do renderer durante o build — não precisa existir como módulo instalado na máquina do usuário. A regra geral: em Electron, o que o bundler embute é dependência de desenvolvimento; o que é carregado em tempo de execução, não.

---

## Módulos nativos e ABI: o ponto mais frágil

Este é o conceito que mais dá problema e o menos conhecido de quem vem do desenvolvimento web.

Um **módulo nativo** é um pacote que contém código C ou C++ **compilado**, não só JavaScript. Bancos de dados embutidos, bibliotecas de criptografia e processamento de imagem costumam ser assim.

**ABI** (*Application Binary Interface*) é o contrato de baixo nível entre esse binário compilado e o runtime que o carrega. Se o binário foi compilado esperando um contrato e o runtime oferece outro, ele não carrega — e a mensagem de erro raramente ajuda.

Aqui está o problema específico do Electron: como ele embute um Node próprio, **um módulo compilado para o Node da sua máquina pode não carregar dentro do Electron.** São contratos diferentes.

A solução tradicional é recompilar o módulo contra o runtime de destino, e existe ferramenta para isso — ela roda automaticamente na instalação deste projeto. Funciona, mas cobra: você passa a depender de uma cadeia de compilação C++ instalada e funcionando em toda máquina que rodar o projeto.

### A saída que muda o cálculo

**N-API** (também chamada Node-API) é uma camada de interface deliberadamente **estável entre versões**. Um módulo escrito contra ela funciona em diferentes versões do Node — e do Electron — sem recompilar.

Escolher um pacote que usa N-API foi critério explícito neste projeto. A alternativa seria assumir a manutenção de uma matriz de builds — plataforma × arquitetura × versão de ABI —, multiplicada a cada atualização do Electron. Isso é trabalho de infraestrutura contínuo, e ele compete com o objetivo de aprender.

**A pergunta a fazer diante de qualquer módulo nativo:** ele usa N-API, ou vou precisar recompilar? A resposta muda o custo de manutenção do projeto por anos.

---

## Ferramental de qualidade

Um analisador de código busca padrões problemáticos; um formatador encerra discussões sobre estilo aplicando um padrão sem opinião. Vale ter ambos desde o primeiro dia, por um motivo que não é o óbvio: **eles transformam convenção em verificação.**

Uma regra que existe só na cabeça de quem escreveu é uma regra que se descobre violada seis arquivos depois. Este projeto usa isso deliberadamente — a tabela de quais camadas podem importar quais é uma regra do analisador, não um parágrafo de documento.

---

## O resumo, em uma pergunta por peça

| Peça | A pergunta que decide |
|---|---|
| Runtime local | Está em suporte longo? Vai durar mais que este projeto? |
| Runtime embutido | É o mesmo do local? (Quase nunca. Confira em `process.versions`.) |
| Gerenciador de pacotes | O layout impede dependência fantasma? |
| Electron | Está dentro da janela de suporte **hoje**, e quando sai dela? |
| Ferramenta de build | Ela entende os três alvos, ou vou orquestrar na mão? |
| Compilador de tipos | Migração de versão maior está isolada em commit próprio? |
| Biblioteca de interface | O ecossistema já resolveu a peça difícil do meu problema? |
| Módulo nativo | Usa N-API, ou vou manter matriz de builds? |

As respostas deste projeto, com as versões correspondentes, estão em [`CLAUDE.md`](../../CLAUDE.md). O raciocínio de cada decisão tomada e descartada está em [`docs/HISTORY.md`](../HISTORY.md).

---

**Anterior:** [01 — O que é Electron](01-o-que-e-electron.md) · **Índice:** [README](README.md) · **Próximo:** [03 — Anatomia do projeto](03-anatomia-do-projeto.md)
