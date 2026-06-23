# Touchpoint Remote Stop Nabijania

Pouzi tento runbook, ked operator chce cez helpdesk vzdialene zastavit
prebiehajuce nabijanie na AgeVolt touchpointe pre konkretny ucet a vozidlo.

## Povinne Vstupy

- nabijacka alebo lokalita: nazov stanice, device ID, touchpoint ID, mesto a
  ulica, alebo GPS suradnice,
- konektor: lavy/pravy alebo 1/2, ak ma nabijacka viac portov,
- email cieloveho AgeVolt uctu,
- vozidlo: nazov, SPZ, VIN alebo vehicle ID.

Ak je nabijacka jednoportova, konektor nie je povinny. Ak operator povie
`lavy`, je to konektor `1`; ak povie `pravy`, je to konektor `2`.

## Resolver Nabijacky A Transakcie

Zdroj pravdy pre touchpoint a aktivnu transakciu je server-side MCP tool,
ktory cita databazu:

- `agevolt.pos_touchpoint`,
- `agevolt.evse_station.touchpoint_id`,
- `agevolt.evse.geo`,
- `agevolt.evse.connector_id`,
- `agevolt.tx_evse_active`,
- `agevolt.vehicle_tag`.

Ak operator zada iba mesto a ulicu, najprv zisti suradnice adresy dostupnym
geocoderom/browserom a odovzdaj `latitude` + `longitude` do preview toolu. Ak
geocoder nie je dostupny alebo adresa nie je jednoznacna, vypytaj si GPS,
presnejsi nazov stanice alebo device ID. Nehadaj touchpoint z pamati.

Preview musi overit, ze na vybranom konektore bezi aktivna transakcia a ze jej
tag patri k zadanemu uctu a vozidlu. Ak to nesedi, remote stop neposielaj.

## MCP Workflow

Pouzivaj priamo MCP tooly zo servera `agevolt-helpdesk`:

- `helpdesk_touchpoint_remote_stop_preview`,
- `helpdesk_touchpoint_remote_stop_execute`.

Nevolaj HTTP endpointy cez shell, `curl`, browser URL ani iny fallback. Necitaj
`.codex/.credentials.json`, neskladaj Authorization token rucne a neposielaj
priamy SQL insert do outboxu. Ak MCP tooly nie su v aktualnom chate viditelne,
zastav workflow a poziadaj o refresh/upgrade AgeVolt Helpdesk pluginu alebo MCP
login/refresh. Nepokracuj obchadzanim server-side MCP.

1. Zavolaj `helpdesk_touchpoint_remote_stop_preview` s parametrami:
   - `charger`: text lokality/stanice, ak ho mas,
   - `latitude` a `longitude`: ak su dostupne zo zadanej adresy,
   - `connector`: `left`, `right`, `1` alebo `2`, ak treba,
   - `accountEmail`: email cieloveho uctu,
   - `vehicle`: vozidlo,
   - `maxDistanceMeters`: nechaj default `150`, ak operator neurci inak.
2. Ak preview vrati `preview_ready`, ukaz operatorovi vyriesene hodnoty:
   ucet, vozidlo, tag, stanica/touchpoint, konektor, aktivnu transakciu,
   vzdialenost a `confirmationId`. Potom sa opytaj na explicitne potvrdenie.
3. Execute volaj iba po potvrdeni v aktualnom chate:
   `helpdesk_touchpoint_remote_stop_execute` s `confirmationId`.
4. Ak execute vrati `stopped`, reportuj, ze remote stop workflow bol prijaty
   cez `agevolt_fe_sp.remote_stop_transaction`. Nehovor, ze fyzicke nabijanie
   je urcite ukoncene bez kontroly finalneho stavu stanice alebo session.

## Typicke Stavy

- `account_not_found`: skontroluj email uctu.
- `vehicle_not_found` alebo `vehicle_ambiguous`: vypytaj si SPZ, VIN alebo
  vehicle ID.
- `charger_not_found`, `charger_too_far` alebo `charger_ambiguous`: vypytaj si
  GPS, device ID alebo presnejsiu stanicu.
- `connector_required`: nabijacka ma viac konektorov; vypytaj si lavy/pravy.
- `connector_idle`: na konektore nebezi aktivna transakcia.
- `target_mismatch`: aktivna transakcia nepatri k zadanemu uctu a vozidlu.
- `transaction_changed`: medzi preview a execute sa zmenila aktivna transakcia;
  spusti nove preview.
- `already_stopped`: transakcia skoncila pred execute; nic neposielaj znova.
- `station_unavailable`: chyba OCPP kontext stanice alebo je stanica offline.
- `stop_timeout`: stop bol poslany, ale transakcia nebola ukoncena do limitu;
  over stav stanice/session pred dalsim pokusom.
- `confirmation_expired`: spusti nove preview.

## Bezpecnost

Remote stop je write operacia. Vzdy pouzi preview/execute model, nikdy priamy
execute bez potvrdenia. Stopuj iba transakciu, ktoru preview spojilo s
konkretnym uctom a vozidlom. Pouzi iba minimum osobnych udajov potrebnych na
vyriesenie poziadavky a nevypisuj tajne hodnoty, tokeny ani DB credentials.
