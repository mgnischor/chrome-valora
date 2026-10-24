# Valora – Calculadora Empresarial

[English](README.md) · [Português (Brasil)](README.pt-BR.md) · **Español**

Una extensión de Chrome (Manifest V3), escrita en TypeScript, con calculadoras de negocios para
rentabilidad de la inversión, márgenes y precios, liquidez, endeudamiento, análisis de inversiones y
financiación. Todo se calcula en tu dispositivo.

## Características

- **29 calculadoras en seis grupos**, cada una con su fórmula visible debajo de los resultados:

    | Grupo                    | Calculadoras                                                                                                                                                                                                                                  |
    | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Rendimientos             | ROI · TCAC · ROE y ROA (con el multiplicador de capital)                                                                                                                                                                                      |
    | Rentabilidad y precios   | Margen y markup · Precio para un margen objetivo · Punto de equilibrio                                                                                                                                                                        |
    | Liquidez y solvencia     | Ratios corriente, ácida y de efectivo y capital de trabajo · Ciclo de conversión de efectivo · Apalancamiento                                                                                                                                 |
    | Análisis contable        | Márgenes del estado de resultados · DuPont (3 y 5 pasos) · Modelo Fleuriet · Z-score de Altman · Apalancamiento operativo y financiero · Depreciación                                                                                         |
    | Inversión y financiación | VAN, TIR, índice de rentabilidad y recuperación (simple y descontada) · Valor futuro · Cuota de préstamo · WACC (CAPM) · EVA · Flujo de caja libre (FCFF, FCFE) · Precio y duración de bonos · Conversión de tasas y tasa real · SAC vs Price |
    | Selic y dólar            | Renta fija ligada a la Selic · Ahorro (poupança) vs Selic · Compra de dólares · Dólar vs Selic                                                                                                                                                |

- **Números como los escribes** – `1,234.56`, `1.234,56`, `1 234,56`, `R$ 1.500`, `12,5%` y `(300)`
  para −300 se entienden todos, y los casos ambiguos como `1.234` se resuelven según el idioma de tu
  navegador (`src/core/parse.ts`).
- **Selic y dólar del Banco Central de Brasil** (opcional, desactivado por defecto) – activa las _tasas
  en vivo_ y los campos de Selic y dólar de las calculadoras de mercado se rellenan solos. Chrome te pide
  permiso para un único host, `api.bcb.gov.br`, y la extensión pasa a leer dos series temporales
  públicas. Consulta [Tasas en vivo](#tasas-en-vivo).
- **Indicadores con colores** – los resultados con una lectura consolidada se muestran en rojo (malo), en el
  color normal (neutro) o en verde (bueno), con una pequeña marca ▼ ● ▲ para que el color no sea la única señal.
  Pasa el ratón sobre el valor para ver cómo se lee, la regla que hay detrás y una leyenda. Consulta
  [Clasificación de los indicadores](#clasificación-de-los-indicadores).
- **Resultados honestos** – lo que no se puede calcular (un divisor cero, una TIR que no existe, una
  recuperación que nunca se alcanza) se muestra como _Indefinido_ en lugar de `NaN`, `Infinity` o un
  número inventado. Los campos que se usan como divisor rechazan el cero desde el principio.
- **Convenciones exactas** – ROI, margen y markup son cosas distintas y se rotulan como tales; los
  porcentajes se escriben como porcentajes y se guardan como fracciones; el punto de equilibrio se
  redondea hacia arriba a unidades enteras sin ruido de coma flotante.
- **Opciones de visualización** – 16 monedas (o ninguna), de 0 a 4 decimales para porcentajes e índices,
  y un símbolo de moneda que sigue tu idioma.
- **Copiar resultados** – copia el nombre de la calculadora, tus datos y los resultados como texto plano.
- **Ejemplo / Borrar** – rellena una calculadora con valores de ejemplo para ver cómo funciona, o bórrala.
- **Recuerda lo que escribiste** (opcional, activado por defecto) – se guarda solo en la memoria del
  navegador y se borra al cerrar Chrome. Consulta [Privacidad](#privacidad).
- **Popup amplio** que usa los 640 × 400 px completos que puede tener el popup de una extensión.
- **Localizada** en inglés (EE. UU.), portugués de Brasil, español, francés, alemán, italiano, ruso y polaco.
  La extensión sigue automáticamente
  el idioma de la interfaz del navegador; cualquier otro idioma usa inglés. Consulta
  [Localización](#localización).
- **Tema claro / oscuro**, accesible con teclado, sin analíticas y sin acceso a la red, salvo que
  actives las tasas en vivo.
- Abre el popup con `Ctrl+Shift+K` (`Command+Shift+K` en macOS); cámbialo en
  `chrome://extensions/shortcuts`.

## Instalación (desde el código fuente)

Requiere Node.js 20.12 o posterior.

```bash
npm install
npm run build
```

Después abre `chrome://extensions`, activa el **Modo de desarrollador**, haz clic en **Cargar
descomprimida** y selecciona la carpeta `dist/`.

## Desarrollo

| Comando             | Finalidad                                                              |
| ------------------- | ---------------------------------------------------------------------- |
| `npm run build`     | Compilación de producción en `dist/`: JS, HTML, CSS y JSON minificados |
| `npm run package`   | Compila, verifica y comprime en `release/valora-<versión>.zip`         |
| `npm run watch`     | Recompila al cambiar (sin minificar, con source maps incrustados)      |
| `npm run typecheck` | Ejecuta `tsc --noEmit` en modo estricto                                |
| `npm test`          | Ejecuta las pruebas unitarias (Vitest)                                 |
| `npm run icons`     | Regenera `public/icons/*.png` (generador sin dependencias)             |
| `npm run check`     | Comprobación de tipos, pruebas y compilación                           |

Tras recompilar, pulsa el botón de recarga en la tarjeta de la extensión en `chrome://extensions`.

### Estructura del proyecto

```
public/                 Archivos estáticos copiados a dist/ (manifiesto, HTML, CSS, iconos)
public/_locales/        Traducciones: en_US (por defecto), pt_BR, es, fr, de, it, ru y pl
scripts/                Herramientas de compilación: build, package, minify, zip y generador de iconos
src/core/               Lógica pura, sin DOM: analizador, matemática financiera, reglas brasileñas, calculadoras, validación
src/shared/             Ajustes, borrador, formato, i18n, cliente opcional del Banco Central
src/popup/              Interfaz del popup
docs/                   Respuestas de la Chrome Web Store y la política de privacidad
tests/                  Pruebas unitarias (Vitest) de core/, shared/, los idiomas, el manifiesto y la compilación
```

## Notas de diseño

### Una calculadora es dato más una función

Cada entrada de `src/core/calculators.ts` declara sus campos de entrada (tipo, límites, valor por
defecto, ejemplo), sus salidas (tipo) y una función `calculate` pura. El popup construye el formulario,
los mensajes de validación, los resultados y el texto que se copia al portapapeles a partir de esa
descripción, de modo que la interfaz no tiene código específico por calculadora. `readInputs` valida el
texto escrito campo por campo; `evaluate` ejecuta la calculadora y convierte en `null` toda salida que no
sea un número finito.

### El núcleo no sabe nada de idiomas ni de visualización

Las calculadoras devuelven números y un _tipo_ (`currency`, `percent`, `ratio`, `multiple`, `number`,
`days`); la validación informa _códigos_ de error. Las etiquetas, las unidades, los formatos numéricos
por idioma y los mensajes de error los producen `src/shared/` y el popup.

### Las tasas son fracciones

El usuario escribe `12,5 %` y se guarda como `0.125`. Toda la matemática de `src/core/finance.ts` usa
fracciones por período, así que las mismas funciones sirven para una TCAC anual y para un préstamo
mensual.

### TIR

La TIR es la tasa en la que el VAN es cero. No tiene forma cerrada, y los flujos de caja que cambian de
signo más de una vez pueden tener varias respuestas. `internalRateOfReturn` recorre el factor de
crecimiento `1 + r` en una malla logarítmica (de aproximadamente −99,9 % a +109.500 %), refina cada
cambio de signo por bisección y devuelve la raíz más cercana a cero. Devuelve `null` cuando los flujos
nunca cambian de signo, en lugar de divergir como lo haría una iteración de Newton simple.

### Recuperación de la inversión (payback)

La recuperación (descontada o no) interpola linealmente dentro del período en que el flujo de caja
acumulado pasa a ser no negativo, por ejemplo 2,5 períodos cuando hace falta la mitad del flujo del
tercer período. Es `null` cuando la inversión no se recupera con los flujos de caja indicados.

### Lectura de números

Cuando aparecen `.` y `,` juntos, el último es el separador decimal. Cuando solo aparece un tipo más de
una vez, es separador de miles. Cuando aparece una sola vez, es el separador decimal, salvo que sea el
separador del _otro_ idioma seguido de exactamente tres dígitos y de un grupo inicial de uno a tres
dígitos (así `1.234` es 1.234 en Brasil y 1,234 en Estados Unidos, mientras que `1.5` es 1,5 en todas
partes). Las listas de flujos de caja se separan por saltos de línea o punto y coma, nunca por comas, que
son el separador decimal en muchos idiomas.

### Tasas en vivo

`src/shared/market.ts` es el único código que toca la red. Solo se ejecuta después de que el usuario
activa las **tasas en vivo** y Chrome concede el permiso de host opcional para
`https://api.bcb.gov.br/*`.

- **Qué se solicita:** dos `GET` anónimos de series temporales públicas de la API SGS del Banco Central:
  la meta Selic (serie 432, % anual) y la cotización del dólar comercial, venta (serie 1, R$ por US$),
  cada una de los últimos 30 días. Sin cookies, sin credenciales, nada sobre el usuario.
- **Valores con fecha futura:** la serie de la Selic se publica con fechas anticipadas (la meta decidida
  en una reunión del Copom rige desde una fecha posterior). Las solicitudes terminan hoy, y `latestUntil`
  además ignora lo que tenga fecha posterior a hoy y toma la observación más reciente que quede.
- **Validación:** una respuesta solo se acepta si es una lista de observaciones bien formadas y con
  valores plausibles (una Selic mayor que 0 % y hasta 100 %, un dólar mayor que 0 y hasta 1.000).
  Cualquier otra cosa se descarta y se muestra como un fallo, nunca se usa.
- **Caché:** la última descarga válida se guarda en `chrome.storage.local` durante 15 minutos y para uso
  sin conexión.
- **Relleno de campos:** un campo marcado con `source` en `src/core/calculators.ts` (`selic` o `usdBrl`)
  se rellena cuando está vacío. El botón **Usar tasas** sobrescribe los campos. Los campos que el usuario
  ha escrito nunca se cambian a sus espaldas.
- **Desactivarlas** elimina el permiso y borra las cifras descargadas. Si el permiso se revoca en
  `chrome://extensions`, el ajuste se desactiva solo la próxima vez que se abra el popup.

### Las calculadoras de Selic y dólar

Siguen convenciones brasileñas, simplificadas para planificar (`src/core/brazil.ts`):

- Las tasas son anuales, en base de 252 días hábiles, y un producto que paga "110 % de la Selic" paga
  110 % de la tasa _diaria_, que no es 110 % de la tasa anual. Un mes tiene 21 días hábiles.
- El impuesto a la renta sigue la tabla regresiva: 22,5 % hasta 180 días, 20 % hasta 360, 17,5 % hasta
  720 y 15 % más allá, con un mes medio de 365 ÷ 12 días (así seis meses son 183 días, en el tramo del
  20 %). Productos como LCI y LCA están exentos.
- La cuenta de ahorro (poupança) paga 0,5 % al mes mientras la meta Selic está por encima de 8,5 % anual
  y 70 % de la Selic en caso contrario (Ley 12.703/2012). La Tasa Referencial (TR) se considera cero.
- _Dólar vs Selic_ compara ambos lados antes de impuestos y halla la cotización del dólar en la que
  quedarse en dólares empata con la Selic. Supone que la inversión en dólares rinde la tasa indicada, en
  dólares.
- _Compra de dólares_ aplica el spread del banco sobre la cotización y el IOF sobre la operación, de modo
  que los dólares recibidos son `reales ÷ (cotización × (1 + spread) × (1 + IOF))`.

Las tasas y las reglas cambian con el tiempo: la tabla de impuestos, la regla de la poupança y las
alícuotas del IOF debe comprobarlas el usuario. El IOF y el spread son datos de entrada, no valores por
defecto.

### Modelos contables

`src/core/accounting.ts` reúne los modelos. Cada uno es una función pura con pruebas de respuestas conocidas.

- **Fleuriet** – CDG = fondos permanentes − activo no corriente; NCG = activo corriente operativo − pasivo
  corriente operativo; T = CDG − NCG. El tipo (I a VI) sale de los signos de esas tres magnitudes, y el cero
  cuenta como positivo. Definir T como CDG − NCG presupone un balance equilibrado.
- **DuPont** – 3 pasos (margen × rotación de activos × multiplicador de capital) y 5 pasos (carga fiscal ×
  carga de intereses × margen operativo × rotación de activos × multiplicador de capital). Un factor que
  dividiría entre cero, como la carga fiscal cuando el BAI es 0, se muestra como _Indefinido_.
- **Altman** – el Z-score original (límites 1,81 y 2,99) y el Z″-score para mercados emergentes (4,35 y
  5,85), ambos con los mismos datos. El valor del patrimonio es el valor de mercado en las empresas cotizadas
  y el valor contable en las demás.
- **Depreciación** – lineal, saldo decreciente doble (nunca por debajo del valor residual y sin pasar a
  lineal) y suma de los dígitos de los años.
- **Estado de resultados** – una pérdida no paga impuesto y tampoco se convierte en devolución.
- **Los bonos** se valoran en una fecha de cupón, sin intereses devengados. **SAC y Price** usan la tasa
  anual ÷ 12, como la calculadora de préstamos. Las demás (grados de apalancamiento, WACC con CAPM, EVA,
  flujo de caja libre, conversión de tasas) usan fórmulas de libro de texto.

### Clasificación de los indicadores

Una salida puede llevar una regla `rating` en `src/core/calculators.ts`, y `evaluate` la convierte en `bad`,
`neutral` o `good` (`src/core/rating.ts`). Hay tres tipos de regla:

- **Tramos** – dos límites y una dirección. Cuando más es mejor, un valor por debajo del primer límite es malo,
  uno por encima del segundo es bueno y lo que queda entre ambos, límites incluidos, es neutro. Cuando menos es
  mejor, es el reflejo. Dos límites iguales forman una prueba de signo (una pérdida es mala, un beneficio es
  bueno).
- **Frente a una entrada** – un límite puede ser el id de un campo de entrada, de modo que la TIR se compara con
  la tasa de descuento que introdujo el usuario.
- **Categorías** – un tipo de Fleuriet o una zona de Altman se asocia a una clasificación.

Los límites son reglas prácticas, y lo saludable varía según el sector, algo que la leyenda indica. Las salidas
sin regla (un precio, una cuota, una duración) mantienen el color normal.

| Indicador                         | Malo                | Neutro              | Bueno               |
| --------------------------------- | ------------------- | ------------------- | ------------------- |
| Ratio corriente                   | < 1                 | 1 – 1,5             | > 1,5               |
| Prueba ácida                      | < 0,8               | 0,8 – 1             | > 1                 |
| Ratio de efectivo                 | < 0,2               | 0,2 – 0,5           | > 0,5               |
| Deuda sobre patrimonio            | > 2                 | 1 – 2               | < 1                 |
| Cobertura de intereses            | < 1,5               | 1,5 – 3             | > 3                 |
| Ciclo de conversión de efectivo   | > 60 días           | 0 – 60 días         | < 0 días            |
| ROE                               | < 0 %               | 0 – 10 %            | > 10 %              |
| ROA                               | < 0 %               | 0 – 5 %             | > 5 %               |
| Z de Altman                       | < 1,81              | 1,81 – 2,99         | > 2,99              |
| Z″ de Altman                      | < 4,35              | 4,35 – 5,85         | > 5,85              |
| Tipo de Fleuriet                  | IV, V, VI           | III                 | I, II               |
| Beneficio, margen, VAN, EVA, FCL… | < 0                 | 0                   | > 0                 |
| TIR                               | < tasa de descuento | = tasa de descuento | > tasa de descuento |
| Índice de rentabilidad            | < 1                 | 1                   | > 1                 |

### Permisos

| Permiso                                      | Motivo                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `storage`                                    | Recordar tus opciones de visualización y guardar en memoria lo que escribiste   |
| `https://api.bcb.gov.br/*` _(host opcional)_ | Descargar la Selic y la cotización del dólar, solo si activas las tasas en vivo |

Sin permisos de host obligatorios, sin scripts de contenido y sin service worker. La extensión no tiene
nada que hacer mientras el popup está cerrado. `tests/manifest.test.ts` falla si se añade un permiso sin
su justificación correspondiente en `docs/chrome-web-store.md`, y comprueba que la política de seguridad
de contenido permite conexiones a ese único origen y a ningún otro. `npm run package` también falla si el
código empaquetado menciona cualquier dirección web fuera de los orígenes que el manifiesto permite.

### Privacidad

Lo que escribes se usa para calcular los resultados y se descarta al cerrar el popup, salvo que dejes
activada la opción **Recordar lo que escribí mientras el navegador esté abierto**. En ese caso vive en
`chrome.storage.session`: solo en la memoria del navegador, nunca se escribe en disco, se borra al cerrar
Chrome y se elimina de inmediato al desactivar la opción. Solo tus opciones de visualización (moneda,
decimales, última calculadora, si las tasas en vivo están activas) se guardan, mediante
`chrome.storage.sync`, por lo que acompañan a tu perfil de Chrome. La extensión no hace solicitudes de
red salvo que actives las tasas en vivo, y esas solicitudes no llevan nada sobre ti. Consulta
[`docs/privacy-policy.md`](docs/privacy-policy.md).

### No es asesoramiento financiero

Los resultados son estimaciones matemáticas obtenidas con fórmulas de libro de texto. Salvo el impuesto a
la renta de las calculadoras ligadas a la Selic, ignoran impuestos, comisiones, inflación y riesgo, y las
tasas descargadas pueden estar retrasadas o ser revisadas. Consulta a un profesional cualificado antes de
tomar decisiones importantes.

### Localización

La extensión usa el sistema `chrome.i18n` del propio Chrome, así que el idioma siempre sigue el de la
interfaz del navegador y no necesita ningún ajuste. Chrome elige la mejor coincidencia: un idioma exacto
como `pt_BR`, después el idioma base como `es` y, por último, el idioma por defecto `en_US`.

- **Los mensajes** están en `public/_locales/<idioma>/messages.json`. El manifiesto (nombre,
  descripción, texto del botón de la barra de herramientas, descripción del atajo) usa referencias
  `__MSG_<clave>__`.
- **El texto estático del popup** se localiza al iniciar con `applyTranslations`, en
  `src/shared/i18n.ts`, mediante atributos `data-i18n` en el HTML. Los mensajes construidos en código
  usan `t("clave", sustituciones)`, y el compilador comprueba las claves contra `en_US/messages.json`.
- **Los textos de las calculadoras siguen una convención de nombres**, construida en
  `src/shared/labels.ts`: `calc_<id>_name`, `calc_<id>_desc`, `calc_<id>_formula`,
  `field_<id>_<campo>`, `out_<id>_<salida>`, `choice_<id>_<campo>_<valor>` y `group_<grupo>`. El
  compilador no puede comprobar esas claves, así que `tests/i18n.test.ts` verifica que cada calculadora,
  campo, salida y opción tenga mensaje en todos los idiomas y que no haya ningún mensaje sin usar.
- **Los números y las monedas** se formatean con `Intl.NumberFormat` en el idioma de la interfaz del
  navegador.
- **Añadir un idioma:** copia `public/_locales/en_US` a una carpeta nueva con el nombre del idioma (por
  ejemplo `fr` o `de`), traduce cada `message` y deja los bloques `placeholders` sin cambios. Después
  añade el nombre de la carpeta a `EXPECTED_LOCALES` en `tests/i18n.test.ts`.
- **Probar un idioma:** inicia Chrome con `--lang=pt-BR` (o cambia el idioma en
  `chrome://settings/languages` y reinicia Chrome) y recarga la extensión.

### Añadir una calculadora

1. Añade una entrada a `src/core/calculators.ts` (campos, salidas, `calculate`) y a la lista
   `CALCULATORS`. Reutiliza las funciones de `src/core/finance.ts` siempre que puedas y añade pruebas con
   respuestas conocidas en `tests/calculators.test.ts`.
2. Añade sus mensajes a todos los idiomas, siguiendo la convención de nombres anterior (`npm test` indica
   qué falta).
3. Ejecuta `npm run check`.

## Licencia

Apache License 2.0. Consulta [`LICENSE.md`](LICENSE.md).
