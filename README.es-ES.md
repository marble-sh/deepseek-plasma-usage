# Uso de DeepSeek — un widget de Plasma 6

- 🇬🇧/🇺🇸 [![English](https://img.shields.io/badge/Language-English-blue)](README.md)
- 🇨🇳 [![简体中文](https://img.shields.io/badge/Language-简体中文-EE1C25)](README.zh-CN.md)
- 🇮🇳 [![हिन्दी](https://img.shields.io/badge/Language-हिन्दी-FF9933)](README.hi-IN.md)
- 🇮🇩 [![Bahasa Indonesia](https://img.shields.io/badge/Language-Bahasa%20Indonesia-CE1126)](README.id-ID.md)
- 🇫🇷 [![Français](https://img.shields.io/badge/Language-Français-0055A4)](README.fr-FR.md)
- 🇷🇺 [![Русский](https://img.shields.io/badge/Language-Русский-0039A6)](README.ru-RU.md)

> [!NOTE]
> Este archivo es una traducción automática del README en inglés. No ha sido
> revisada por ningún hablante nativo. El `README.md` en inglés es la versión
> autoritativa y la política de traducción se describe en `translate/README.md`.

Un applet de KDE Plasma 6 pequeño y sin dependencias que muestra el saldo y el
uso de tu API de DeepSeek en el panel, con una ventana emergente detallada.

- **Panel:** un icono más el número que elijas (saldo, gasto de hoy, tokens de
  hoy, gasto del período o gasto acumulado).
- **Ventana emergente:** saldo; gasto de hoy, del período y acumulado; una
  estimación de los "días restantes"; tokens de entrada, de salida y en caché, y
  recuentos de solicitudes; un minigráfico del gasto diario y un desglose por
  clave de API.
- **Los secretos se guardan en KWallet**, nunca en el archivo de configuración
  del widget.
- **Sin dependencias de ejecución** más allá de Plasma y Qt: el acceso a la red
  es `XMLHttpRequest` de QML, el análisis sintáctico es JavaScript puro y se
  accede a KWallet mediante `kwallet-query`.

![Modo completo](docs/images/rich-mode.es-ES.png)

Como chip del panel: el icono, el número que elijas y el punto de hora
pico/fuera de hora pico:

![Chip del panel](docs/images/panel-mode.png)

## Instalación

```sh
./install.sh            # install or upgrade for the current user
./install.sh --pack     # write deepseek-usage.plasmoid for distribution
./install.sh --uninstall
```

Luego añade **Uso de DeepSeek** a un panel o al escritorio. Haz clic derecho en
el widget → _Configurar…_ para añadir tus credenciales.

## Credenciales

Existen dos credenciales distintas y no son intercambiables.

|                   | Clave de API                             | Token de sesión                                                                      |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Dónde conseguirla | <https://platform.deepseek.com/api_keys> | el valor que conserva el sitio de la plataforma después de que inicias sesión        |
| Alcance           | el acceso a la API de tu cuenta          | **acceso completo a la cuenta**, incluida la creación y eliminación de claves de API |
| Te proporciona    | solo el saldo                            | saldo, gasto acumulado e historial de uso                                            |
| Se guarda como    | `deepseek-api-key` en KWallet            | `deepseek-session-token` en KWallet                                                  |

### Cómo obtener el token de sesión

1. Inicia sesión en <https://platform.deepseek.com> en tu navegador.
2. Abre las Herramientas de Desarrollador (F12, o ⌥⌘I en macOS).
3. Abre la pestaña **Application** (**Storage** en Firefox) → **Local Storage** → `https://platform.deepseek.com`.
4. Busca la clave llamada `userToken` y copia su valor. Ese es tu token de sesión.

> **Consejo:** El valor es largo. Cópialo exactamente como se muestra; no añadas espacios ni saltos de línea.

Ambas se escriben en KWallet (cartera `kdewallet`, carpeta `Plasma`) y se leen
de vuelta con `kwallet-query`. La clave de API por sí sola basta para el saldo;
añadir el token de sesión habilita las secciones de uso. Si el token de sesión
deja de funcionar, el widget recurre al saldo y te explica por qué.

> [!WARNING]
> El token de sesión es tan poderoso como tu contraseña. Trátalo como tal y
> elimínalo de KWallet si dejas de usar el modo completo.

## Fuentes de datos

El widget es un híbrido porque DeepSeek expone dos API que no tienen relación
entre sí.

**API oficial** (`api.deepseek.com`): autenticada mediante clave de API,
documentada y fiable, pero solo informa del saldo:

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <API_KEY>
```

**API de la plataforma** (`platform.deepseek.com/api/v0`): el backend que hay
detrás de la página web de uso. Se autentica mediante sesión y **no está
documentada**, por lo que puede cambiar en cualquier momento:

```
GET /users/get_user_summary
GET /usage/by_api_key/amount?start=&end=&tz=
GET /usage/by_api_key/cost?start=&end=&tz=
authorization: Bearer <SESSION_TOKEN>
```

Dos peculiaridades que conviene conocer:

- La API de la plataforma responde **HTTP 200 incluso cuando falla la
  autenticación**, e incluye el estado real en el cuerpo JSON
  (`{"code":40003,...}`). Por eso el widget clasifica los resultados a partir
  del contenido de la respuesta, nunca del estado HTTP.
- Las cargas útiles de costo y de tokens anidan sus series de forma distinta
  (`data.biz_data.data[].series[]` para el costo, `data.biz_data.series[]` para
  los tokens).

Como no existe un endpoint de "uso" documentado, las cifras de gasto y el valor
de "días restantes" estimados se **derivan** de esta API y se etiquetan como
tales en la ventana emergente.

## Configuración

| Ajuste                     | Valor predeterminado | Significado                                           |
| -------------------------- | -------------------- | ----------------------------------------------------- |
| Intervalo de actualización | 300 s                | con qué frecuencia se consulta (mínimo 30 s)          |
| El panel muestra           | Saldo                | qué número aparece en el panel                        |
| Período de costo           | 30 días              | ventana para los totales del período y el minigráfico |
| Ocultar todos los montos   | desactivado          | reemplaza cada monto en pantalla por puntos           |

El desglose por clave solo muestra los **nombres** de las claves de API. El id
de clave enmascarado que informa la plataforma nunca se muestra en ningún lugar,
a propósito.

## Precios de hora pico y fuera de hora pico

DeepSeek cobra la mitad del precio fuera de sus horas pico, así que el widget
muestra qué tarifa está vigente: un punto pequeño en el chip del panel, y el
estado junto con el tiempo restante en la ventana emergente y la información
sobre herramientas.

- **verde** — fuera de hora pico: estás pagando la tarifa con descuento
- **rojo** — hora pico: estás pagando el precio completo
- **neutro** — desconocido: consulta más abajo

El horario está [documentado](https://api-docs.deepseek.com/quick_start/pricing)
como _de 01:00 a 04:00 y de 06:00 a 10:00 UTC, de lunes a viernes, excepto los
días festivos públicos de China_; todas las demás horas son fuera de hora pico,
incluidos los fines de semana y los días festivos por completo.

### Por qué puede decir "Desconocido"

La parte de esa regla relativa al día de la semana y a la hora del día es exacta
y se aplica siempre. La excepción de los días festivos es distinta: el Consejo
de Estado publica las fechas del año siguiente solo en noviembre o diciembre y
puede modificarlas, así que son datos que hay que mantener a mano y que no se
pueden derivar.

Por eso el widget no adivina. `CHINESE_HOLIDAYS` en `contents/ui/js/peak.js`
contiene el calendario publicado, bloque por bloque, para los años que se han
anunciado:

```js
addRange("2026-10-01", "2026-10-07"); // National Day
```

Cuando se pregunta por un año que la tabla no cubre, el estado se informa como
**Desconocido** en lugar de suponer que esos días son días laborables normales,
ya que suponerlo indicaría hora pico mientras DeepSeek cobraba la tarifa fuera
de hora pico. Tampoco deben añadirse fechas estimadas, por la misma razón pero
en sentido contrario: una entrada incorrecta reclamaría un descuento que no
existe.

### Mantenerlo actualizado

`node --test tests/peak.test.mjs` incluye una alarma de mantenimiento
deliberada: **falla cuando la tabla deja de cubrir el año en curso**, y también
falla si algún año cubierto parece estar a medias. Añade el año recién publicado
con `addRange()` y las pruebas vuelven a pasar. Se anuncia en
noviembre/diciembre para el año siguiente, así que esa es la tarea anual.

## Desarrollo

La lógica de análisis, de formato y de los comandos de KWallet vive en módulos
de JavaScript puro dentro de `contents/ui/js/`, de modo que se puede probar sin
una sesión de Plasma:

```sh
node --test tests/api.test.mjs tests/format.test.mjs tests/wallet.test.mjs
```

`tests/mock-platform-server.mjs` sirve las estructuras de datos grabadas de la
API de la plataforma, que es la única manera de ejercitar el modo completo sin
credenciales reales. Mientras haces pruebas, apunta `PLATFORM_BASE` de
`contents/ui/js/api.js` a `http://127.0.0.1:8731/api/v0` y luego vuelve a
dejarlo como estaba.

Comprobaciones estáticas del lado de QML:

```sh
qmllint contents/ui/*.qml contents/config/config.qml
```

Renderizar el applet una vez por idioma, para detectar texto mal codificado o
texto que se desborda de la ventana emergente (el hindi y el ruso ocupan mucho
más que el inglés):

```sh
tests/capture-locales.sh /tmp/shots zh_CN ru_RU hi_IN
```

### Integración continua

Las comprobaciones anteriores se ejecutan en CI (`.github/workflows/ci.yml`), en
un runner de Ubuntu estándar y sin Plasma: `node --test`,
`./translate/build.sh --check`, una comprobación de sintaxis de QML con
`qmllint` y `./install.sh --pack` para demostrar que el archivo de distribución
todavía se compila. `qmllint` en Qt 6 no resuelve ninguna importación, así que
no necesita paquetes de KDE, y eso es lo que hace posible esa tarea.

Un flujo de trabajo no se ejecuta en cada push.
`.github/workflows/holiday-alarm.yml` ejecuta `tests/peak.test.mjs` el día
primero de cada mes, porque ese archivo contiene una alarma deliberada: falla
cuando la tabla de días festivos de China deja de cubrir el año en curso, y el
Consejo de Estado solo publica las fechas del año siguiente en noviembre o
diciembre. Una ejecución en rojo allí es el recordatorio de añadir los bloques
publicados con `addRange()`, no un error.

## Traducciones

El widget incluye 17 catálogos: chino simplificado, inglés (India), hindi,
indonesio, francés, ruso (Rusia y Bielorrusia), español (España y cuatro
variantes latinoamericanas), además de alias de idioma sin región que amplían el
mecanismo de reserva de configuración regional de Qt. Las traducciones están en
`translate/`; consulta [`translate/README.md`](translate/README.md) para conocer
el flujo de trabajo y el formato de la tabla.

Este README también está traducido; los enlaces de idioma que aparecen al
principio de la página apuntan a esos archivos. Son **traducciones automáticas
de este documento, mantenidas en un solo archivo por idioma**: las variantes
regionales de los catálogos (`en_IN`, `ru_BY`, `es_419` y los cuatro códigos de
español latinoamericano) comparten el README de su idioma en lugar de repetirlo.

```sh
./translate/merge.sh          # re-extract template.pot after changing i18n() calls
./translate/build.sh          # regenerate .po and compile .mo
./translate/build.sh --check  # CI: fail if any catalogue is out of date
```

> [!WARNING]
> **Todos los catálogos son generados automáticamente y nunca han sido revisados
> por un hablante nativo.** Cada `.po` lo registra en su encabezado, y su campo
> `Language-Team` sigue siendo el marcador de posición de gettext "ningún
> catálogo ha sido reclamado". Trátalos como un punto de partida, no como una
> traducción terminada.
>
> **Prioridad de revisión: hindi, ruso y chino simplificado** — los idiomas en
> los que es más probable que se use este widget y aquellos en los que una
> traducción sin revisar es menos aceptable. Todo lo demás es un extra.

La vía elegida para solucionarlo son **los propios equipos de traducción de
KDE** (decisión D13): es la única que produce traducciones _revisadas_ por
personas que realmente hablan el idioma. `Messages.sh`, en la raíz del
repositorio, ya es el punto de entrada que esperan las herramientas de KDE, y
`translate/README.md` enumera los pasos concretos; la principal condición previa
es que el widget tiene que estar en un repositorio de KDE para que los equipos
puedan adoptarlo. Las configuraciones de Crowdin/Transifex se conservan solo
como alternativa, marcadas explícitamente como nunca ejecutadas.

## Licencia

GPL-2.0-or-later. Consulta `LICENSE`.
