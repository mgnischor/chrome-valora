# Valora – Calculadora Empresarial

[English](README.md) · **Português (Brasil)** · [Español](README.es-ES.md)

Uma extensão do Chrome (Manifest V3), escrita em TypeScript, com calculadoras de negócios para retorno
sobre o investimento, margens e preços, liquidez, endividamento, análise de investimentos e
financiamentos. Tudo é calculado no seu dispositivo.

## Recursos

- **29 calculadoras em seis grupos**, cada uma com a fórmula exibida abaixo dos resultados:

    | Grupo                        | Calculadoras                                                                                                                                                                                                                                      |
    | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Retornos                     | ROI · CAGR · ROE e ROA (com o multiplicador de patrimônio)                                                                                                                                                                                        |
    | Rentabilidade e preços       | Margem e markup · Preço para uma margem desejada · Ponto de equilíbrio                                                                                                                                                                            |
    | Liquidez e solvência         | Liquidez corrente, seca e imediata e capital de giro · Ciclo de conversão de caixa · Endividamento                                                                                                                                                |
    | Análise contábil             | Margens da DRE · DuPont (3 e 5 etapas) · Modelo Fleuriet · Z-score de Altman · Alavancagem operacional e financeira · Depreciação                                                                                                                 |
    | Investimento e financiamento | VPL, TIR, índice de lucratividade e payback (simples e descontado) · Valor futuro · Parcela de financiamento · WACC (CAPM) · EVA · Fluxo de caixa livre (FCFF, FCFE) · Preço e duration de títulos · Conversão de taxas e taxa real · SAC x Price |
    | Selic e dólar                | Renda fixa atrelada à Selic · Poupança x Selic · Compra de dólares · Dólar x Selic                                                                                                                                                                |

- **Números do jeito que você digita** – `1,234.56`, `1.234,56`, `1 234,56`, `R$ 1.500`, `12,5%` e
  `(300)` para −300 são todos entendidos, e casos ambíguos como `1.234` são resolvidos pelo idioma do seu
  navegador (`src/core/parse.ts`).
- **Selic e dólar do Banco Central do Brasil** (opcional, desativado por padrão) – ative as _taxas ao
  vivo_ e os campos de Selic e dólar das calculadoras de mercado se preenchem sozinhos. O Chrome pede
  autorização para um único host, `api.bcb.gov.br`, e a extensão passa a ler duas séries temporais
  públicas. Veja [Taxas ao vivo](#taxas-ao-vivo).
- **Indicadores coloridos** – resultados com uma leitura consagrada aparecem em vermelho (ruim), na cor normal
  (neutro) ou em verde (bom), com uma pequena marca ▼ ● ▲ para que a cor não seja o único sinal. Passe o mouse
  sobre o valor para ver como ele se lê, a regra por trás e uma legenda. Veja
  [Classificação dos indicadores](#classificação-dos-indicadores).
- **Resultados honestos** – o que não pode ser calculado (divisor zero, uma TIR que não existe, um
  payback que nunca é atingido) aparece como _Indefinido_, em vez de `NaN`, `Infinity` ou um número
  inventado. Os campos usados como divisor rejeitam zero logo na entrada.
- **Convenções exatas** – ROI, margem e markup são coisas diferentes e são identificados como tais;
  percentuais são digitados como percentuais e armazenados como frações; o ponto de equilíbrio é
  arredondado para cima em unidades inteiras, sem ruído de ponto flutuante.
- **Opções de exibição** – 30 moedas (ou nenhuma), de 0 a 4 casas decimais para percentuais e índices, e
  um símbolo de moeda que segue o seu idioma.
- **Copiar resultados** – copia o nome da calculadora, os seus dados e os resultados como texto simples.
- **Exemplo / Limpar** – preencha uma calculadora com valores de exemplo para ver como funciona, ou
  limpe-a.
- **Lembra o que você digitou** (opcional, ativado por padrão) – fica apenas na memória do navegador e é
  apagado quando o Chrome fecha. Veja [Privacidade](#privacidade).
- **Popup espaçoso**, que usa os 640 × 400 px completos que um popup de extensão pode ter.
- **Localizado em 31 idiomas**, do inglês e do português do Brasil ao hindi, ao árabe (da direita para a
  esquerda), ao japonês e ao hauçá. O idioma segue o navegador por padrão e pode ser trocado nas
  configurações. As traduções são contextuais: a Selic brasileira vira a taxa básica de juros do principal
  mercado de cada idioma (_taux directeur_, _Leitzins_, repo rate, 政策金利 …). Veja
  [Localização](#localização) e [`docs/localization.md`](docs/localization.md) (em inglês).
- **Tema claro / escuro**, acessível pelo teclado, sem análises de uso e sem acesso à rede, a menos que
  você ative as taxas ao vivo.
- Abra o popup com `Ctrl+Shift+K` (`Command+Shift+K` no macOS); altere o atalho em
  `chrome://extensions/shortcuts`.

## Instalação (a partir do código-fonte)

Requer Node.js 20.12 ou mais recente.

```bash
npm install
npm run build
```

Depois abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem
compactação** e selecione a pasta `dist/`.

## Desenvolvimento

| Comando             | Finalidade                                                            |
| ------------------- | --------------------------------------------------------------------- |
| `npm run build`     | Build de produção em `dist/`: JS, HTML, CSS e JSON minificados        |
| `npm run package`   | Compila, verifica e compacta em `release/valora-<versão>.zip`         |
| `npm run watch`     | Recompila a cada alteração (sem minificar, com source maps embutidos) |
| `npm run typecheck` | Executa `tsc --noEmit` em modo estrito                                |
| `npm test`          | Executa os testes unitários (Vitest)                                  |
| `npm run icons`     | Regenera `public/icons/*.png` (gerador sem dependências)              |
| `npm run check`     | Verificação de tipos, testes e build                                  |

Depois de recompilar, clique no botão de recarregar no cartão da extensão em `chrome://extensions`.

### Estrutura do projeto

```
public/                 Arquivos estáticos copiados para dist/ (manifesto, HTML, CSS, ícones)
scripts/                Ferramentas de build: build, package, minify, zip, gerador de ícones e idiomas do manifesto
src/locales/            Traduções: 31 idiomas, um arquivo JSON cada (en_US é a fonte)
src/core/               Lógica pura, sem DOM: parser, matemática financeira, regras brasileiras, calculadoras, validação
src/shared/             Configurações, rascunho, formatação, i18n, cliente opcional do Banco Central
src/popup/              Interface do popup
docs/                   Respostas da Chrome Web Store e a política de privacidade
tests/                  Testes unitários (Vitest) de core/, shared/, dos idiomas, do manifesto e do build
```

## Notas de projeto

### Uma calculadora é dado mais uma função

Cada entrada de `src/core/calculators.ts` declara seus campos de entrada (tipo, limites, valor padrão,
exemplo), suas saídas (tipo) e uma função `calculate` pura. O popup monta o formulário, as mensagens de
validação, os resultados e o texto copiado para a área de transferência a partir dessa descrição, então
a interface não tem código específico por calculadora. `readInputs` valida o texto digitado campo a
campo; `evaluate` executa a calculadora e converte em `null` toda saída que não seja um número finito.

### O núcleo não sabe nada sobre idiomas nem exibição

As calculadoras devolvem números e um _tipo_ (`currency`, `percent`, `ratio`, `multiple`, `number`,
`days`); a validação informa _códigos_ de erro. Rótulos, unidades, formatos numéricos por idioma e
mensagens de erro são produzidos por `src/shared/` e pelo popup.

### Taxas são frações

O usuário digita `12,5 %` e o valor é armazenado como `0.125`. Toda a matemática de
`src/core/finance.ts` usa frações por período, então as mesmas funções servem para um CAGR anual e para
um financiamento mensal.

### TIR

A TIR é a taxa em que o VPL é zero. Ela não tem forma fechada, e fluxos de caixa que mudam de sinal mais
de uma vez podem ter várias respostas. `internalRateOfReturn` percorre o fator de crescimento `1 + r`
numa grade logarítmica (de cerca de −99,9 % a +109.500 %), refina cada mudança de sinal por bisseção e
devolve a raiz mais próxima de zero. Devolve `null` quando os fluxos de caixa nunca mudam de sinal, em
vez de divergir como uma iteração de Newton simples.

### Payback

O payback (descontado ou não) interpola linearmente dentro do período em que o fluxo de caixa acumulado
passa a ser não negativo, por exemplo 2,5 períodos quando metade do fluxo do terceiro período é
necessária. É `null` quando o investimento não é recuperado dentro dos fluxos de caixa informados.

### Leitura de números

Quando `.` e `,` aparecem juntos, o último é o separador decimal. Quando só um tipo aparece mais de uma
vez, ele é separador de milhar. Quando aparece uma única vez, é o separador decimal, a menos que seja o
separador do _outro_ idioma seguido de exatamente três dígitos e de um grupo inicial de um a três dígitos
(assim `1.234` é 1.234 no Brasil e 1,234 nos Estados Unidos, enquanto `1.5` é 1,5 em qualquer lugar). As
listas de fluxos de caixa são separadas por quebras de linha ou ponto e vírgula, nunca por vírgulas, que
são separador decimal em muitos idiomas.

### Taxas ao vivo

`src/shared/market.ts` é o único código que acessa a rede. Ele só roda depois que o usuário ativa as
**taxas ao vivo** e o Chrome concede a permissão de host opcional para `https://api.bcb.gov.br/*`.

- **O que é solicitado:** dois `GET` anônimos de séries temporais públicas da API SGS do Banco Central: a
  meta Selic (série 432, % ao ano) e a cotação do dólar comercial, venda (série 1, R$ por US$), cada uma
  dos últimos 30 dias. Sem cookies, sem credenciais, nada sobre o usuário.
- **Valores com data futura:** a série da Selic é publicada com datas antecipadas (a meta decidida numa
  reunião do Copom vale a partir de uma data posterior). As requisições terminam hoje, e `latestUntil`
  também ignora o que tiver data posterior a hoje, usando então a observação mais recente que sobrar.
- **Validação:** uma resposta só é aceita se for uma lista de observações bem formadas e com valores
  plausíveis (Selic acima de 0 % e até 100 %, dólar acima de 0 e até 1.000). Qualquer outra coisa é
  descartada e mostrada como falha, nunca usada.
- **Cache:** o último download válido fica em `chrome.storage.local` por 15 minutos e para uso offline.
- **Preenchimento de campos:** um campo marcado com `source` em `src/core/calculators.ts` (`selic` ou
  `usdBrl`) é preenchido quando está vazio. O botão **Usar taxas** sobrescreve os campos. Campos que o
  usuário digitou nunca são alterados sem que ele perceba.
- **Desativar** remove a permissão e apaga os valores baixados. Se a permissão for revogada em
  `chrome://extensions`, a opção se desliga sozinha na próxima vez que o popup abrir.

### As calculadoras de Selic e dólar

Seguem convenções brasileiras, simplificadas para planejamento (`src/core/brazil.ts`):

- As taxas são anuais, na base de 252 dias úteis, e um produto que paga "110 % da Selic" paga 110 % da
  taxa _diária_, o que não é 110 % da taxa anual. Um mês tem 21 dias úteis.
- O imposto de renda segue a tabela regressiva: 22,5 % até 180 dias, 20 % até 360, 17,5 % até 720 e 15 %
  acima, com um mês médio de 365 ÷ 12 dias (assim seis meses são 183 dias, na faixa de 20 %). Produtos
  como LCI e LCA são isentos.
- A poupança paga 0,5 % ao mês enquanto a meta Selic está acima de 8,5 % ao ano, e 70 % da Selic caso
  contrário (Lei 12.703/2012). A Taxa Referencial (TR) é considerada zero.
- _Dólar x Selic_ compara os dois lados antes dos impostos e encontra a cotação do dólar em que ficar em
  dólar empata com a Selic. Supõe que o investimento em dólar rende a taxa informada, em dólares.
- _Compra de dólares_ aplica o spread do banco sobre a cotação e o IOF sobre a operação, de modo que os
  dólares recebidos são `reais ÷ (cotação × (1 + spread) × (1 + IOF))`.

As taxas e as regras mudam com o tempo: a tabela de imposto, a regra da poupança e as alíquotas de IOF
cabem ao usuário conferir. O IOF e o spread são dados de entrada, não valores padrão.

### Modelos contábeis

`src/core/accounting.ts` reúne os modelos. Cada um é uma função pura com testes de respostas conhecidas.

- **Fleuriet** – CDG = fundos permanentes − ativo não circulante; NCG = ativo circulante operacional − passivo
  circulante operacional; T = CDG − NCG. O tipo (I a VI) vem dos sinais dessas três grandezas, e zero conta
  como positivo. Definir T como CDG − NCG pressupõe um balanço equilibrado.
- **DuPont** – 3 etapas (margem × giro do ativo × multiplicador de patrimônio) e 5 etapas (carga tributária ×
  carga de juros × margem operacional × giro do ativo × multiplicador de patrimônio). Um fator que dividiria
  por zero, como a carga tributária quando o LAIR é 0, aparece como _Indefinido_.
- **Altman** – o Z-score original (limites 1,81 e 2,99) e o Z″-score para mercados emergentes (4,35 e 5,85),
  ambos com os mesmos dados. O valor do patrimônio é o valor de mercado nas companhias abertas e o valor
  contábil nas demais.
- **Depreciação** – linear, saldos decrescentes em dobro (nunca abaixo do valor residual e sem passar para
  linear) e soma dos dígitos dos anos.
- **DRE** – um prejuízo não paga imposto e também não vira restituição.
- **Títulos** são precificados em data de cupom, sem juros acumulados. **SAC e Price** usam a taxa anual ÷ 12,
  como a calculadora de financiamento. As demais (graus de alavancagem, WACC com CAPM, EVA, fluxo de caixa
  livre, conversão de taxas) usam fórmulas de livro-texto.

### Classificação dos indicadores

Uma saída pode ter uma regra `rating` em `src/core/calculators.ts`, e `evaluate` a converte em `bad`, `neutral`
ou `good` (`src/core/rating.ts`). Há três tipos de regra:

- **Faixas** – dois limites e uma direção. Quando quanto mais melhor, um valor abaixo do primeiro limite é
  ruim, um acima do segundo é bom e o que fica entre eles, limites incluídos, é neutro. Quando quanto menos
  melhor, é o espelho. Dois limites iguais formam um teste de sinal (prejuízo é ruim, lucro é bom).
- **Contra uma entrada** – um limite pode ser o id de um campo de entrada, de modo que a TIR é comparada com a
  taxa de desconto informada pelo usuário.
- **Categorias** – um tipo de Fleuriet ou uma zona de Altman é associado a uma classificação.

Os limites são regras práticas, e o que é saudável varia conforme o setor, o que a legenda informa. Saídas sem
regra (um preço, uma parcela, uma duration) mantêm a cor normal.

| Indicador                     | Ruim               | Neutro             | Bom                |
| ----------------------------- | ------------------ | ------------------ | ------------------ |
| Liquidez corrente             | < 1                | 1 – 1,5            | > 1,5              |
| Liquidez seca                 | < 0,8              | 0,8 – 1            | > 1                |
| Liquidez imediata             | < 0,2              | 0,2 – 0,5          | > 0,5              |
| Dívida sobre patrimônio       | > 2                | 1 – 2              | < 1                |
| Cobertura de juros            | < 1,5              | 1,5 – 3            | > 3                |
| Ciclo de conversão de caixa   | > 60 dias          | 0 – 60 dias        | < 0 dias           |
| ROE                           | < 0 %              | 0 – 10 %           | > 10 %             |
| ROA                           | < 0 %              | 0 – 5 %            | > 5 %              |
| Z de Altman                   | < 1,81             | 1,81 – 2,99        | > 2,99             |
| Z″ de Altman                  | < 4,35             | 4,35 – 5,85        | > 5,85             |
| Tipo de Fleuriet              | IV, V, VI          | III                | I, II              |
| Lucro, margem, VPL, EVA, FCL… | < 0                | 0                  | > 0                |
| TIR                           | < taxa de desconto | = taxa de desconto | > taxa de desconto |
| Índice de lucratividade       | < 1                | 1                  | > 1                |

### Permissões

| Permissão                                    | Motivo                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `storage`                                    | Lembrar suas opções de exibição e guardar na memória o que você digitou      |
| `https://api.bcb.gov.br/*` _(host opcional)_ | Baixar a Selic e a cotação do dólar, somente se você ativar as taxas ao vivo |

Nenhuma permissão de host obrigatória, nenhum script de conteúdo e nenhum service worker. A extensão não
tem nada a fazer enquanto o popup está fechado. `tests/manifest.test.ts` falha se uma permissão for
adicionada sem a justificativa correspondente em `docs/chrome-web-store.md`, e verifica que a política de
segurança de conteúdo permite conexões a essa única origem e a nenhuma outra. `npm run package` também
falha se o código empacotado mencionar qualquer endereço web fora das origens que o manifesto permite.

### Privacidade

O que você digita é usado para calcular os resultados e é descartado quando o popup fecha, a menos que
você mantenha ativada a opção **Lembrar o que digitei enquanto o navegador estiver aberto**. Nesse caso
fica em `chrome.storage.session`: apenas na memória do navegador, nunca gravado em disco, apagado quando
o Chrome fecha e removido imediatamente quando você desativa a opção. Somente suas opções de exibição
(moeda, casas decimais, última calculadora, se as taxas ao vivo estão ativas) são gravadas, por meio de
`chrome.storage.sync`, e por isso acompanham o seu perfil do Chrome. A extensão não faz requisições de
rede a menos que você ative as taxas ao vivo, e essas requisições não levam nada sobre você. Veja
[`docs/privacy-policy.md`](docs/privacy-policy.md).

### Não é aconselhamento financeiro

Os resultados são estimativas matemáticas feitas com fórmulas de livro-texto. Exceto o imposto de renda
das calculadoras atreladas à Selic, ignoram impostos, tarifas, inflação e risco, e as taxas baixadas
podem estar atrasadas ou ser revisadas. Consulte um profissional qualificado antes de decisões
importantes.

### Localização

O popup está traduzido para 31 idiomas: inglês, chinês (simplificado e tradicional), espanhol, hindi,
bengali, português do Brasil, russo, japonês, panjabi, marata, telugo, turco, coreano, francês, alemão,
vietnamita, tâmil, urdu, javanês, italiano, árabe, guzerate, persa, bhojpuri, hauçá, canarim, indonésio,
polonês, malaiala e ucraniano. Por padrão o idioma segue o do navegador, e as configurações permitem
escolher outro, o que o `chrome.i18n` não faz. Por isso as traduções vão dentro da extensão e são lidas
por `src/shared/i18n.ts`, no mesmo formato de mensagens do Chrome (marcadores `$1` e `$NOME$`). Os idiomas do
navegador são associados à tradução mais próxima: `pt-PT` usa o português do Brasil, `es-419` usa o
espanhol, `zh-TW`/`zh-HK` usam o chinês tradicional, qualquer outro chinês usa o simplificado e todo o
resto cai para o inglês.

- **As mensagens** ficam em `src/locales/<código>.json`, no formato do `messages.json` do Chrome. O inglês
  (`en_US`) é a fonte; os demais arquivos precisam definir as mesmas chaves e marcadores.
- **Os textos do próprio Chrome** (nome, descrição, dica do botão da barra de ferramentas, descrição do
  atalho) vêm de `_locales`. O build gera essas pastas a partir de `src/locales`, mas só para os 26 idiomas
  que o Chrome suporta. Panjabi, urdu, javanês, bhojpuri e hauçá não têm idioma de interface no Chrome, então
  a página de extensões do Chrome mostra inglês para eles. A extensão em si está totalmente traduzida.
- **Tradução contextual.** O texto é adaptado a cada mercado, em vez de traduzido palavra por palavra. A
  Selic vira a taxa básica de juros do principal mercado do idioma (_taux directeur_, _Leitzins_,
  _ключевая ставка_, repo rate, _政策金利_ …); produtos e impostos brasileiros sem equivalente (_CDB_,
  _LCI_, _poupança_, _IOF_) mantêm o nome e são explicados na própria frase.
  [`docs/localization.md`](docs/localization.md) lista o termo usado em cada idioma.
- **O texto estático do popup** é localizado na inicialização, e de novo sempre que o idioma muda, por
  `applyTranslations`, em `src/shared/i18n.ts`, por meio de atributos `data-i18n` no HTML. As mensagens
  montadas no código usam `t("chave", substituições)`. As chaves são verificadas contra `en_US.json` e
  `src/shared/catalog.ts` é tipado de modo que um idioma sem alguma mensagem não compila.
- **Idiomas da direita para a esquerda** (árabe, persa, urdu) definem `dir="rtl"` na página e espelham o
  layout. Campos numéricos, fórmulas e valores dos resultados continuam da esquerda para a direita.
- **Os textos das calculadoras seguem uma convenção de nomes**, montada em `src/shared/labels.ts`:
  `calc_<id>_name`, `calc_<id>_desc`, `calc_<id>_formula`, `field_<id>_<campo>`, `out_<id>_<saída>`,
  `choice_<id>_<campo>_<valor>` e `group_<grupo>`. O compilador não consegue verificar essas chaves,
  então `tests/i18n.test.ts` confere que toda calculadora, campo, saída e opção tem mensagem em todos os
  idiomas e que nenhuma mensagem está sem uso.
- **Números e moedas** são formatados com `Intl.NumberFormat` no idioma ativo, sempre com algarismos
  latinos, para que os resultados combinem com as fórmulas e possam ser lidos de volta. O analisador também
  aceita algarismos nativos (arábico-índicos, persas, devanágari, bengali, de largura total…), o
  agrupamento indiano (`12,34,567`) e as marcas decimais e de milhar árabes. As sugestões de moeda seguem
  o idioma e a região.
- **Adicionar um idioma:** copie `src/locales/en_US.json` para `src/locales/<código>.json` e traduza cada
  `message` (mantenha os blocos `placeholders` como estão); adicione uma entrada em `LOCALES`, em
  `src/shared/locales.ts` (código, nome no próprio idioma, tag de idioma, direção); adicione o import e a
  entrada em `src/shared/catalog.ts`. Se o Chrome suporta o idioma como idioma de interface, acrescente
  também o código a `MANIFEST_LOCALES`, em `scripts/manifest-locales.mjs`. Os testes então conferem que o
  novo arquivo tem as mesmas chaves e marcadores do inglês, que está traduzido e não é uma cópia, que os
  nomes dos produtos brasileiros foram mantidos, que nenhuma mensagem está sem uso e que a descrição cabe
  no limite de 132 caracteres da Web Store.
- **Testar um idioma:** escolha-o nas configurações, ou inicie o Chrome com `--lang=pt-BR` para testar a
  escolha automática.
- **Situação da revisão:** as traduções não foram revisadas por falantes nativos; veja
  [`docs/localization.md`](docs/localization.md).

### Adicionar uma calculadora

1. Adicione uma entrada em `src/core/calculators.ts` (campos, saídas, `calculate`) e à lista
   `CALCULATORS`. Reutilize as funções de `src/core/finance.ts` sempre que possível e acrescente testes
   com respostas conhecidas em `tests/calculators.test.ts`.
2. Adicione suas mensagens a todos os idiomas, seguindo a convenção de nomes acima (`npm test` lista o
   que está faltando).
3. Execute `npm run check`.

## Licença

Apache License 2.0. Veja [`LICENSE.md`](LICENSE.md).
