# Valora – Calculadora Empresarial

[English](README.md) · **Português (Brasil)** · [Español](README.es-ES.md)

Uma extensão do Chrome (Manifest V3), escrita em TypeScript, com calculadoras de negócios para retorno
sobre o investimento, margens e preços, liquidez, endividamento, análise de investimentos e
financiamentos. Tudo é calculado no seu dispositivo.

## Recursos

- **16 calculadoras em cinco grupos**, cada uma com a fórmula exibida abaixo dos resultados:

    | Grupo                        | Calculadoras                                                                                                 |
    | ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
    | Retornos                     | ROI · CAGR · ROE e ROA (com o multiplicador de patrimônio)                                                   |
    | Rentabilidade e preços       | Margem e markup · Preço para uma margem desejada · Ponto de equilíbrio                                       |
    | Liquidez e solvência         | Liquidez corrente, seca e imediata e capital de giro · Ciclo de conversão de caixa · Endividamento           |
    | Investimento e financiamento | VPL, TIR, índice de lucratividade e payback (simples e descontado) · Valor futuro · Parcela de financiamento |
    | Selic e dólar                | Renda fixa atrelada à Selic · Poupança x Selic · Compra de dólares · Dólar x Selic                           |

- **Números do jeito que você digita** – `1,234.56`, `1.234,56`, `1 234,56`, `R$ 1.500`, `12,5%` e
  `(300)` para −300 são todos entendidos, e casos ambíguos como `1.234` são resolvidos pelo idioma do seu
  navegador (`src/core/parse.ts`).
- **Selic e dólar do Banco Central do Brasil** (opcional, desativado por padrão) – ative as _taxas ao
  vivo_ e os campos de Selic e dólar das calculadoras de mercado se preenchem sozinhos. O Chrome pede
  autorização para um único host, `api.bcb.gov.br`, e a extensão passa a ler duas séries temporais
  públicas. Veja [Taxas ao vivo](#taxas-ao-vivo).
- **Resultados honestos** – o que não pode ser calculado (divisor zero, uma TIR que não existe, um
  payback que nunca é atingido) aparece como _Indefinido_, em vez de `NaN`, `Infinity` ou um número
  inventado. Os campos usados como divisor rejeitam zero logo na entrada.
- **Convenções exatas** – ROI, margem e markup são coisas diferentes e são identificados como tais;
  percentuais são digitados como percentuais e armazenados como frações; o ponto de equilíbrio é
  arredondado para cima em unidades inteiras, sem ruído de ponto flutuante.
- **Opções de exibição** – 14 moedas (ou nenhuma), de 0 a 4 casas decimais para percentuais e índices, e
  um símbolo de moeda que segue o seu idioma.
- **Copiar resultados** – copia o nome da calculadora, os seus dados e os resultados como texto simples.
- **Exemplo / Limpar** – preencha uma calculadora com valores de exemplo para ver como funciona, ou
  limpe-a.
- **Lembra o que você digitou** (opcional, ativado por padrão) – fica apenas na memória do navegador e é
  apagado quando o Chrome fecha. Veja [Privacidade](#privacidade).
- **Popup espaçoso**, que usa os 640 × 400 px completos que um popup de extensão pode ter.
- **Localizado** em inglês (EUA), português do Brasil e espanhol. A extensão segue automaticamente o
  idioma da interface do navegador; qualquer outro idioma usa o inglês. Veja
  [Localização](#localização).
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
public/_locales/        Traduções: en_US (padrão), pt_BR e es
scripts/                Ferramentas de build: build, package, minify, zip e gerador de ícones
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

A extensão usa o sistema `chrome.i18n` do próprio Chrome, então o idioma sempre segue o idioma da
interface do navegador e não exige nenhuma configuração. O Chrome escolhe a melhor correspondência: um
idioma exato como `pt_BR`, depois o idioma base como `es` e, por fim, o idioma padrão `en_US`.

- **As mensagens** ficam em `public/_locales/<idioma>/messages.json`. O manifesto (nome, descrição, dica
  do botão da barra de ferramentas, descrição do atalho) usa referências `__MSG_<chave>__`.
- **O texto estático do popup** é localizado na inicialização por `applyTranslations`, em
  `src/shared/i18n.ts`, por meio de atributos `data-i18n` no HTML. As mensagens montadas no código usam
  `t("chave", substituições)`, e as chaves são verificadas pelo compilador contra `en_US/messages.json`.
- **Os textos das calculadoras seguem uma convenção de nomes**, montada em `src/shared/labels.ts`:
  `calc_<id>_name`, `calc_<id>_desc`, `calc_<id>_formula`, `field_<id>_<campo>`, `out_<id>_<saída>`,
  `choice_<id>_<campo>_<valor>` e `group_<grupo>`. O compilador não consegue verificar essas chaves,
  então `tests/i18n.test.ts` confere que toda calculadora, campo, saída e opção tem mensagem em todos os
  idiomas e que nenhuma mensagem está sem uso.
- **Números e moedas** são formatados com `Intl.NumberFormat` no idioma da interface do navegador.
- **Adicionar um idioma:** copie `public/_locales/en_US` para uma nova pasta com o nome do idioma (por
  exemplo `fr` ou `de`), traduza cada `message` e mantenha os blocos `placeholders` inalterados. Depois
  acrescente o nome da pasta a `EXPECTED_LOCALES` em `tests/i18n.test.ts`.
- **Testar um idioma:** inicie o Chrome com `--lang=pt-BR` (ou mude o idioma em
  `chrome://settings/languages` e reinicie o Chrome) e recarregue a extensão.

### Adicionar uma calculadora

1. Adicione uma entrada em `src/core/calculators.ts` (campos, saídas, `calculate`) e à lista
   `CALCULATORS`. Reutilize as funções de `src/core/finance.ts` sempre que possível e acrescente testes
   com respostas conhecidas em `tests/calculators.test.ts`.
2. Adicione suas mensagens a todos os idiomas, seguindo a convenção de nomes acima (`npm test` lista o
   que está faltando).
3. Execute `npm run check`.

## Licença

Apache License 2.0. Veja [`LICENSE.md`](LICENSE.md).
