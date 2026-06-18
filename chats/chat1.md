# Watcharr: Spotweb automatiseringstool

_Started 2026-06-18 19:20 UTC_

---

## User

Mijn collega Robin heeft een behoefte/idee voor een nieuwe app. Deze willen we zelf ontwikkelen met Claude Code. Voordat we Claude Code aan het werk zetten willen we eerst onderzoeken wat er reeds beschikbaar is, eventueel ideeen en inspiratie opdoen en van daaruit een gedegen plan orchestreren. Onderdeel daarvan is het uitproberen van deze nieuwe design functionaliteit om een wireframe te ontwerpen. Hieronder vindt je zijn prompt/idee. Analyseer deze, doe onderzoek naar eventuele referenties en probeer een beeld te vormen van wat we functioneel en technisch zoeken.

input van Robin:

Genereer een nieuwe tool 'Watcharr' net als Radarr/Sonarr.
Deze tool heeft als functie dat je zelf kan bepalen wat er wordt gedownload vanuit Spotweb o.b.v. filters, je maakt per item een Watch aan.
Hiermee worden niet direct films of series bedoeld want daarin zijn de bestaande tools al pro in.
Als voorbeeld van zo'n Watch zou ik nemen:
- Alles van poster: solem
- Categorie: PDF (moet je kunnen selecteren net als in de browsertree van Spotweb)
- Titel, bevat niet: ebook
Je kan opgeven per toegevoegde "Watch" hoevaak hij gecontroleerd moet worden (bijvoorbeeld elk uur).
De tool gaat dan alle items naar de download client sturen.
Er moet ervoor gezorgd worden dat items niet dubbel worden gedownload als de Watch opnieuw gaat zoeken, dat moet dus worden bijgehouden.
Een leuke nice-to-have is dat je per Watch statistieken kan zien; hoeveel items er naar de download client zijn toegestuurd e.d.
Je moet Watches kunnen toevoegen, bewerken en verwijderen.
Deze tool moet ook in docker draaien en uit 1 instance bestaan.
Hij mag verbinden met een externe mariadb die al in een docker draait.
Daar mag hij een eigen database gebruiken.
De tool moet verbinden met Spotweb (Spottarr of direct in de spotweb mariadb is ook een optie), toe te voegen net als bij de Arr apps. Dat mag via de API van spotweb zelf (als het handiger is mag hij ook direct in de mariadb zoeken).
Je moet een download client kunnen toevoegen (SABnzbd, NZBGet), net als de Arr apps.
Qua layout voldoen de Arr apps, dus voor Watcharr ongeveer hetzelfde gebruiken.

## Assistant

Goed idee om eerst te verkennen. Laat me kort onderzoek doen naar de referenties (Spotweb categorieën, Arr-app layout) zodat de wireframe klopt, en dan stel ik je een paar gerichte vragen.Ik heb genoeg context over Spotweb en de Arr-apps. Korte samenvatting van wat ik heb gevonden, daarna een paar vragen voordat ik wireframes ga schetsen.

**Wat ik begrijp van het idee + referenties:**

- **Arr-layout** = linker sidebar (Library / Calendar / Activity / Wanted / Settings / System), donker thema, "+ Add" flow, en onder Settings o.a. *Download Clients*, *Indexers*, *Profiles*. Voor Watcharr vertaalt dat naar: **Watches** (i.p.v. Movies) · **Activity** (queue/history van wat naar de client is gestuurd, inclusief dedup-tracking) · **Settings** (Spotweb-verbinding + download client SABnzbd/NZBGet).
- **Spotweb-filters** kennen velden als titel, poster, datum (stamp), filesize, reacties (commentcount) en rating, plus een **categorie-boom**: hoofdcategorieën Beeld, Geluid, Spellen en Applicaties, met per categorie subvelden (Formaat, Bron, Taal/Bitrate, Genre, Platform). Includes/excludes werken met tree-codes als `cat0_z0_d0`, waarbij een uitsluiting wordt aangegeven met een `~` ervoor. Dat is precies de "bevat niet"-logica uit Robins voorbeeld.

Dit geeft me een sterke basis. Nu de richtinggevende vragen:

_[tool: questions_v2]_

_[tool: web_search]_

_[tool: web_search]_

## User

Questions timed out; go with defaults

## Assistant

Vragen zijn getimeout — ik ga met verstandige defaults: low-fi sketchy wireframes in het Nederlands, alle kernschermen, en de filter-builder in 3 UX-varianten naast elkaar. Eerst een sketchy hand-drawn font en de opzet.

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

_[tool: screenshot]_

The wireframes render cleanly. Klaar — **Watcharr Wireframes.dc.html** staat open in je preview.

**Wat erin zit** (sketchy, Nederlands, scrollend storyboard):
- **0 · Flow** — de pipeline Spotweb → Watch-filter → dedup-check → download-client, met de eigen MariaDB die verstuurde spots bijhoudt.
- **1 · Watches-overzicht** — Arr-achtige sidebar + compacte tabel (status, filter-chips, interval, laatste run, verzonden-teller). Robins voorbeeld-watch "Solem PDF's" is verwerkt.
- **2 · Filter-builder in 3 richtingen** — naast elkaar om te kiezen: **A** klassiek formulier, **B** rule-builder (condities + AND/OR), **C** Spotweb categorie-boom met aanvinken/uitsluiten.
- **3 · Watch-detail + statistieken** — stat-cards, mini-grafiek, recente items incl. "overgeslagen (dubbel)".
- **4 · Activity** — centrale log over alle watches, dedup zichtbaar.
- **5 · Settings** — Spotweb (API óf direct MariaDB) en download-client (SABnzbd/NZBGet), met "Test verbinding".

Gele notities geven ontwerpkeuzes uit. In **Tweaks** kun je de notities aan/uit zetten en de accentkleur wisselen.

**Logische vervolgstap:** kies samen met Robin één filter-builder-richting (A/B/C) — dan werk ik die uit tot een strakker beeld als basis voor het Claude Code-plan. Wil je ook dat ik de globale Settings (interval, categorie-mapping, notificaties, login) als apart scherm uitteken?

## User

Save as standalone HTML: Watcharr Wireframes.dc.html

## Assistant

_[tool: read_file]_

Only external dependency is the Google Fonts stylesheet (bundler inlines it) plus local `support.js`. No code-referenced assets. I just need to add the required thumbnail, then bundle.

_[tool: str_replace_edit]_

_[tool: super_inline_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

Bundled cleanly, no errors. Standalone file is ready.

_[tool: present_fs_item_for_download]_

Klaar — **Watcharr Wireframes.html** is een volledig zelfstandig bestand (fonts inline, werkt offline). Download via de kaart hierboven.

## User

Save this design as a PDF: Watcharr Wireframes.dc.html

## Assistant

This is a wide scrolling canvas, so I'll print it as a large landscape page sized to fit the widest row, keeping each frame-row from splitting across pages.

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

No errors. Opening the print dialog.

_[tool: open_for_print]_

Print-tab geopend — kies in het dialoog **Save as PDF** (laat "Background graphics" aanstaan voor de kleuren). Het PDF is op groot landscape-formaat zodat de brede frame-rijen passen; elke rij blijft als geheel bij elkaar.

