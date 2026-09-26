# DeepSeek Usage — un widget Plasma 6

- 🇬🇧/🇺🇸 [![English](https://img.shields.io/badge/Language-English-blue)](README.md)
- 🇨🇳 [![简体中文](https://img.shields.io/badge/Language-简体中文-EE1C25)](README.zh-CN.md)
- 🇮🇳 [![हिन्दी](https://img.shields.io/badge/Language-हिन्दी-FF9933)](README.hi-IN.md)
- 🇮🇩 [![Bahasa Indonesia](https://img.shields.io/badge/Language-Bahasa%20Indonesia-CE1126)](README.id-ID.md)
- 🇫🇷 [![Français](https://img.shields.io/badge/Language-Français-0055A4)](README.fr-FR.md)
- 🇷🇺 [![Русский](https://img.shields.io/badge/Language-Русский-0039A6)](README.ru-RU.md)
- 🇪🇸 [![Español](https://img.shields.io/badge/Language-Español-F1BF00)](README.es-ES.md)

> [!NOTE]
> Ce fichier est une traduction automatique du README anglais : il n'a pas été
> relu par un locuteur natif. Le fichier `README.md` en anglais fait autorité, et
> la politique de traduction est décrite dans `translate/README.md`.

Un petit applet KDE Plasma 6 sans dépendances qui affiche votre solde et votre
consommation de l'API DeepSeek dans le panneau, avec une fenêtre contextuelle
détaillée.

- **Panneau :** une icône accompagnée du nombre de votre choix (solde, dépenses
  du jour, jetons du jour, dépenses de la période ou dépenses cumulées).
- **Fenêtre contextuelle :** solde, dépenses du jour/de la période/cumulées, une
  estimation des « jours restants », les jetons d'entrée/de sortie/en cache et le
  nombre de requêtes, un mini-graphique des dépenses journalières et une
  répartition par clé d'API.
- **Les secrets résident dans KWallet**, jamais dans le fichier de configuration
  du widget.
- **Aucune dépendance à l'exécution** en dehors de Plasma et Qt : l'accès au
  réseau se fait via `XMLHttpRequest` en QML, l'analyse en JavaScript pur, et
  KWallet est interrogé via `kwallet-query`.

![Mode riche](docs/images/rich-mode.png)

Comme pastille de panneau — l'icône, le nombre de votre choix et le point
heures pleines/heures creuses :

![Pastille du panneau](docs/images/panel-mode.png)

## Installation

```sh
./install.sh            # install or upgrade for the current user
./install.sh --pack     # write deepseek-usage.plasmoid for distribution
./install.sh --uninstall
```

Ajoutez ensuite **DeepSeek Usage** à un panneau ou au bureau. Faites un clic
droit sur le widget → *Configurer…* pour ajouter vos identifiants.

## Identifiants

Il existe deux types d'identifiants différents, et ils ne sont pas
interchangeables.

| | Clé d'API | Jeton de session |
|---|---|---|
| Où l'obtenir | <https://platform.deepseek.com/api_keys> | la valeur que le site de la plateforme conserve après votre connexion |
| Portée | l'accès à l'API de votre compte | **l'accès complet au compte**, y compris la création et la suppression de clés d'API |
| Vous donne | le solde uniquement | le solde, les dépenses cumulées et l'historique d'utilisation |
| Stocké sous | `deepseek-api-key` dans KWallet | `deepseek-session-token` dans KWallet |

Les deux sont écrits dans KWallet (portefeuille `kdewallet`, dossier `Plasma`)
et relus avec `kwallet-query`. La clé d'API suffit à elle seule pour le solde ;
ajouter le jeton de session active les sections d'utilisation. Si le jeton de
session cesse de fonctionner, le widget se rabat sur le solde et vous en explique
la raison.

> [!WARNING]
> Le jeton de session est aussi puissant que votre mot de passe. Traitez-le comme
> tel, et supprimez-le de KWallet si vous cessez d'utiliser le mode riche.

## Sources de données

Le widget est hybride parce que DeepSeek expose deux API sans rapport l'une avec
l'autre.

**API officielle** (`api.deepseek.com`) — authentifiée par clé d'API, documentée,
fiable, mais elle ne rapporte que le solde :

```
GET https://api.deepseek.com/user/balance
Authorization: Bearer <API_KEY>
```

**API de la plateforme** (`platform.deepseek.com/api/v0`) — le backend derrière
la page web d'utilisation. Elle est authentifiée par session et **non
documentée**, elle peut donc changer à tout moment :

```
GET /users/get_user_summary
GET /usage/by_api_key/amount?start=&end=&tz=
GET /usage/by_api_key/cost?start=&end=&tz=
authorization: Bearer <SESSION_TOKEN>
```

Deux particularités à connaître :

- L'API de la plateforme répond **HTTP 200 même en cas d'échec
  d'authentification**, en plaçant le véritable statut dans le corps JSON
  (`{"code":40003,...}`). Le widget classe donc les résultats d'après la charge
  utile, jamais d'après le statut HTTP.
- Les charges utiles de coût et de jetons imbriquent leurs séries différemment
  (`data.biz_data.data[]
  .series[]` pour le coût, `data.biz_data.series[]` pour les jetons).

Comme il n'existe aucun point de terminaison « usage » documenté, les chiffres de
dépenses et la valeur « jours restants estimés » sont **dérivés** de cette API et
sont signalés comme tels dans la fenêtre contextuelle.

## Configuration

| Paramètre | Valeur par défaut | Signification |
|---|---|---|
| Intervalle d'actualisation | 300 s | fréquence d'interrogation (minimum 30 s) |
| Affichage du panneau | Solde | quel nombre apparaît dans le panneau |
| Période de coût | 30 jours | fenêtre pour les totaux de la période et le mini-graphique |
| Masquer tous les montants | désactivé | remplacer chaque montant à l'écran par des puces |

La répartition par clé ne liste que les **noms** des clés d'API. L'identifiant de
clé masqué que rapporte la plateforme n'est délibérément jamais affiché nulle
part.

## Tarification heures pleines et heures creuses

DeepSeek facture à moitié prix en dehors de ses heures pleines, c'est pourquoi le
widget indique quel tarif est en vigueur : un petit point sur la pastille du
panneau, ainsi que l'état et le temps qu'il reste dans la fenêtre contextuelle et
l'infobulle.

- **vert** — heures creuses : vous payez le tarif réduit
- **rouge** — heures pleines : vous payez le plein tarif
- **neutre** — inconnu : voir ci-dessous

Le calendrier est [documenté](https://api-docs.deepseek.com/quick_start/pricing)
comme étant *de 01:00 à 04:00 et de 06:00 à 10:00 UTC, du lundi au vendredi, hors
jours fériés chinois* ; toutes les autres heures sont en heures creuses, y
compris les week-ends et les jours fériés dans leur intégralité.

### Pourquoi il peut indiquer « Inconnu »

La partie de cette règle concernant le jour de la semaine et l'heure de la
journée est exacte et s'applique toujours. L'exception des jours fériés est
différente : le Conseil d'État ne publie les dates de l'année suivante qu'en
novembre ou décembre et peut les réviser ; il s'agit donc de données qui doivent
être maintenues à la main et qui ne peuvent pas être déduites.

Le widget ne devinera donc pas. `CHINESE_HOLIDAYS` dans
`contents/ui/js/peak.js` contient le calendrier publié, bloc par bloc, pour les
années qui ont été annoncées :

```js
addRange("2026-10-01", "2026-10-07"); // National Day
```

Lorsqu'on l'interroge sur une année que le tableau ne couvre pas, l'état est
signalé comme **Inconnu** plutôt que de supposer que ces jours sont des jours
ouvrables ordinaires — une telle supposition signalerait des heures pleines alors
que DeepSeek facturerait le tarif heures creuses. Les dates estimées ne doivent
pas non plus être ajoutées, pour la même raison mais dans l'autre sens : une
entrée erronée revendiquerait une réduction qui n'existe pas.

### Le tenir à jour

`node --test tests/peak.test.mjs` inclut une alarme de maintenance délibérée :
elle **échoue dès que le tableau ne couvre plus l'année en cours**, et échoue
aussi si une année couverte semble à moitié remplie. Ajoutez l'année nouvellement
publiée avec `addRange()` et les tests repassent au vert. Publiée en
novembre/décembre pour l'année suivante, c'est donc la corvée annuelle.

## Développement

La logique d'analyse, de formatage et des commandes KWallet réside dans des
modules JavaScript purs sous `contents/ui/js/`, afin de pouvoir être testée sans
session Plasma :

```sh
node --test tests/api.test.mjs tests/format.test.mjs tests/wallet.test.mjs
```

`tests/mock-platform-server.mjs` sert les formes de charge utile enregistrées de
l'API de la plateforme, ce qui est le seul moyen d'exercer le mode riche sans
identifiants réels. Pointez `PLATFORM_BASE` dans `contents/ui/js/api.js` vers
`http://127.0.0.1:8731/api/v0` pendant vos tests, puis remettez-le comme avant.

Vérifications statiques pour la partie QML :

```sh
qmllint contents/ui/*.qml contents/config/config.qml
```

Rendre l'applet une fois par locale, afin de repérer le mojibake ou le texte qui
déborde de la fenêtre contextuelle (le hindi et le russe sont bien plus longs que
l'anglais) :

```sh
tests/capture-locales.sh /tmp/shots zh_CN ru_RU hi_IN
```

### Intégration continue

Les vérifications ci-dessus s'exécutent en CI (`.github/workflows/ci.yml`), sur un
runner Ubuntu standard et sans Plasma : `node --test`,
`./translate/build.sh --check`, une vérification de syntaxe QML avec `qmllint`,
et `./install.sh --pack` pour prouver que l'archive de distribution se construit
toujours. `qmllint` sous Qt 6 ne résout aucune importation, il n'a donc besoin
d'aucun paquet KDE, ce qui est précisément ce qui rend cette tâche possible.

Un workflow ne s'exécute pas lors d'un push. `.github/workflows/holiday-alarm.yml`
exécute `tests/peak.test.mjs` le premier de chaque mois, car ce fichier contient
une alarme délibérée : elle échoue dès que le tableau des jours fériés chinois
cesse de couvrir l'année en cours, et le Conseil d'État ne publie les dates de
l'année suivante qu'en novembre ou décembre. Une exécution en rouge à cet endroit
est le rappel d'ajouter les blocs publiés avec `addRange()`, et non un bug.

## Traductions

Le widget est livré avec 17 catalogues : chinois simplifié, anglais (Inde), hindi,
indonésien, français, russe (Russie et Biélorussie), espagnol (Espagne et quatre
variantes latino-américaines), plus des alias de langue nue qui élargissent le
repli de locale de Qt. Les traductions se trouvent dans `translate/` ; voir
[`translate/README.md`](translate/README.md) pour le flux de travail et le format
du tableau.

Ce README est également traduit ; les liens de langue en haut de la page pointent
vers ces fichiers. Ce sont des **traductions automatiques de ce document, à
raison d'un fichier par langue** — les variantes régionales des catalogues
(`en_IN`, `ru_BY`, `es_419` et les quatre codes d'espagnol latino-américain)
partagent le README de leur langue au lieu de le répéter.

```sh
./translate/merge.sh          # re-extract template.pot after changing i18n() calls
./translate/build.sh          # regenerate .po and compile .mo
./translate/build.sh --check  # CI: fail if any catalogue is out of date
```

> [!WARNING]
> **Chaque catalogue est généré automatiquement et n'a jamais été relu par un
> locuteur natif.** Chaque fichier `.po` le consigne dans son en-tête, et son
> champ `Language-Team` est encore l'espace réservé de gettext « aucun catalogue
> n'a été revendiqué ». Considérez-les comme un point de départ, non comme une
> traduction achevée.
>
> **Priorité de relecture : hindi, russe et chinois simplifié** — les langues dans
> lesquelles ce widget a le plus de chances d'être utilisé, et celles où une
> traduction non relue est le moins acceptable. Tout le reste est un bonus.

La voie choisie pour y remédier est celle des **propres équipes de traduction de
KDE** (décision D13) : c'est la seule qui produise des traductions *relues* par
des personnes qui parlent réellement la langue. `Messages.sh` à la racine du
dépôt est déjà le point d'entrée attendu par l'outillage de KDE, et
`translate/README.md` énumère les étapes concrètes — la principale condition
préalable étant que le widget doit résider dans un dépôt KDE avant que les
équipes puissent le prendre en charge. Les configurations Crowdin/Transifex ne
sont conservées qu'à titre de solution de repli, explicitement marquées comme
jamais exécutées.

## Licence

GPL-2.0-or-later. Voir `LICENSE`.
