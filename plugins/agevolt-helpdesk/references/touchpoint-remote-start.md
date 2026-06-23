# Touchpoint Remote Start Nabijania

Pouzi tento runbook, ked operator chce cez helpdesk vzdialene spustit
nabijanie na AgeVolt touchpointe pre konkretny ucet a vozidlo.

## Povinne Vstupy

- nabijacka alebo lokalita: nazov stanice, device ID, touchpoint ID, mesto a
  ulica, alebo GPS suradnice,
- konektor: lavy/pravy alebo 1/2, ak ma nabijacka viac portov,
- email cieloveho AgeVolt uctu,
- vozidlo: nazov, SPZ, VIN alebo vehicle ID.

Ak je nabijacka jednoportova, konektor nie je povinny. Ak operator povie
`lavy`, je to konektor `1`; ak povie `pravy`, je to konektor `2`.

## Resolver Nabijacky

Zdroj pravdy pre touchpoint je server-side MCP tool, ktory cita databazu:

- `agevolt.pos_touchpoint`,
- `agevolt.evse_station.touchpoint_id`,
- `agevolt.evse.geo`,
- `agevolt.evse.connector_id`.

Ak operator zada iba mesto a ulicu, najprv zisti suradnice adresy dostupnym
geocoderom/browserom a odovzdaj `latitude` + `longitude` do preview toolu. Ak
geocoder nie je dostupny alebo adresa nie je jednoznacna, vypytaj si GPS,
presnejsi nazov stanice alebo device ID. Nehadaj touchpoint z pamati.

## MCP Workflow

Pouzivaj priamo MCP tooly zo servera `agevolt-helpdesk`:

- `helpdesk_touchpoint_remote_start_preview`,
- `helpdesk_touchpoint_remote_start_execute`.

Nevolaj HTTP endpointy cez shell, `curl`, browser URL ani iny fallback. Necitaj
`.codex/.credentials.json`, neskladaj Authorization token rucne a neposielaj
priamy SQL insert do outboxu. Ak MCP tooly nie su v aktualnom chate viditelne,
zastav workflow a poziadaj o refresh/upgrade AgeVolt Helpdesk pluginu alebo MCP
login/refresh. Nepokracuj obchadzanim server-side MCP.

1. Zavolaj `helpdesk_touchpoint_remote_start_preview` s parametrami:
   - `charger`: text lokality/stanice, ak ho mas,
   - `latitude` a `longitude`: ak su dostupne zo zadanej adresy,
   - `connector`: `left`, `right`, `1` alebo `2`, ak treba,
   - `accountEmail`: email cieloveho uctu,
   - `vehicle`: vozidlo,
   - `maxDistanceMeters`: nechaj default `150`, ak operator neurci inak.
2. Ak preview vrati `preview_ready`, ukaz operatorovi vyriesene hodnoty:
   ucet, vozidlo, tag, stanica/touchpoint, konektor, vzdialenost a
   `confirmationId`. Potom sa opytaj na explicitne potvrdenie.
3. Execute volaj iba po potvrdeni v aktualnom chate:
   `helpdesk_touchpoint_remote_start_execute` s `confirmationId`.
4. Ak execute vrati `sent`, reportuj, ze remote start bol zaradeny cez
   `agevolt_fe_sp.remote_start_transaction_v2`. Nehovor, ze fyzicke nabijanie
   uz zacalo; dodanie zavisi od OCPP/OICP fronty a stavu stanice.

## Typicke Stavy

- `account_not_found`: skontroluj email uctu.
- `vehicle_not_found` alebo `vehicle_ambiguous`: vypytaj si SPZ, VIN alebo
  vehicle ID.
- `tag_not_found` alebo `tag_ambiguous`: treba aktivny jednoznacny tag pre
  vozidlo.
- `charger_not_found`, `charger_too_far` alebo `charger_ambiguous`: vypytaj si
  GPS, device ID alebo presnejsiu stanicu.
- `connector_required`: nabijacka ma viac konektorov; vypytaj si lavy/pravy.
- `connector_busy`: na konektore uz bezi aktivna transakcia; nic neposielaj.
- `confirmation_expired`: spusti nove preview.

## Bezpecnost

Remote start je write operacia. Vzdy pouzi preview/execute model, nikdy priamy
execute bez potvrdenia. Pouzi iba minimum osobnych udajov potrebnych na
vyriesenie poziadavky a nevypisuj tajne hodnoty, tokeny ani DB credentials.
