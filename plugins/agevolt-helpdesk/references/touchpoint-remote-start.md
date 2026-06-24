# Touchpoint Remote Start Nabijania

Pouzi tento runbook, ked operator chce cez helpdesk vzdialene spustit
nabijanie na AgeVolt touchpointe pre konkretny ucet a vozidlo. Ak operator
nevie dodat ucet ani vozidlo, mozes pouzit free workflow, ale iba ak server
potvrdi bud OCPP free charging na EVSE, explicitne operatorom potvrdeny lokalny
touchpoint FreeCharging rezim, alebo fallback tag s neplatenou policy.

## Povinne Vstupy

- nabijacka alebo lokalita: nazov stanice, device ID, touchpoint ID, mesto a
  ulica, alebo GPS suradnice,
- konektor: lavy/pravy alebo 1/2, ak ma nabijacka viac portov,
- email cieloveho AgeVolt uctu a vozidlo: nazov, SPZ, VIN alebo vehicle ID,
- alebo explicitne potvrdene, ze operator nevie dodat ani ucet ani vozidlo a
  chce poziadat o free fallback.
- pri lokalnom free nabijani explicitne potvrdene, ze operator chce
  service-menu/touchpoint FreeCharging rezim na konkretnom konektore.

Ak je nabijacka jednoportova, konektor nie je povinny. Ak operator povie
`lavy`, je to konektor `1`; ak povie `pravy`, je to konektor `2`.

Free fallback nepouzivaj, ak chyba iba jeden z dvojice `accountEmail`/`vehicle`.
Vtedy si vypytaj chybajuci udaj. Free start je povoleny len cez backendovy
preview. Server najprv pouzije `agevolt.evse.free_charging_enabled` alebo OCPP
`FreeCharging` readback pre OCPP free charging; ak nie je zapnuty, skusi
lokalny touchpoint FreeCharging iba ked je vstup
`allowLocalTouchpointFreeCharging: true`; inak alebo potom skusi fallback tag
cez `agevolt.tag_evse_context` a odmietne platenu alebo neoverenu policy.
Lokalny touchpoint FreeCharging pouziva idTag `NOA` (alebo backend env
override) rovnako ako pos-rn servisny free flow a backend nevie tento lokalny
persisted flag spolahlivo overit cez DB readback.

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
Ked posielas `latitude` + `longitude`, mozes ponechat povodny `charger` text
ako kontext, ale backend bude kandidata vyberat podla najblizsieho
`agevolt.evse.geo`; text adresy sa nemusi nachadzat v station/touchpoint meta.

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
   - `accountEmail`: email cieloveho uctu, ak ho mas,
   - `vehicle`: vozidlo, ak ho mas,
   - `allowFreeFallback`: `true` iba ked operator nevie dodat ani ucet ani
     vozidlo; server potom najprv skusi OCPP free charging, volitelne
     explicitny lokalny touchpoint free rezim a az potom fallback tag,
   - `allowLocalTouchpointFreeCharging`: `true` iba ked operator explicitne
     ziada `ako free charging`, potvrdi servisne menu Connector/OCPP
     `FreeCharging`, alebo inak potvrdi lokalny touchpoint free rezim,
   - `customerEmail`: email pre follow-up mail, ak je iny ako AgeVolt ucet
     alebo ide o free fallback,
   - `helpdeskTaskId` alebo `helpdeskSearch`: ak mas konkretny ClickUp ticket
     alebo text na dohladanie helpdesk mailu. Ak je v poziadavke alebo
     viditelnom kontexte ClickUp task URL, napr.
     `https://app.clickup.com/t/9012627644/869dup3wf`, extrahuj `869dup3wf`
     a posli ho ako `helpdeskTaskId`,
   - `maxDistanceMeters`: nechaj default `150`, ak operator neurci inak.
2. Ak preview vrati `preview_ready`, ukaz operatorovi vyriesene hodnoty:
   rezim (`account_vehicle`, `ocpp_free_charging`,
   `touchpoint_local_free_charging` alebo `free_fallback`), ucet ak existuje,
   vozidlo/tag ak existuju, `ocppFreeCharging.idTag` pri OCPP alebo
   touchpoint-local free rezime, stanica/touchpoint, konektor, vzdialenost,
   policy pri free rezime a `confirmationId`. Potom sa opytaj na explicitne
   potvrdenie.
3. Execute volaj iba po potvrdeni v aktualnom chate:
   `helpdesk_touchpoint_remote_start_execute` s `confirmationId`.
4. Ak execute vrati `sent`, reportuj, ze remote start bol zaradeny. Pre
   `account_vehicle` a `free_fallback` ide cez
   `agevolt_fe_sp.remote_start_transaction_v2`; pre `ocpp_free_charging` a
   `touchpoint_local_free_charging` ide priamo cez
   `agevolt_ocpp.evse_station_ocpp_outbox` s action `REMOTE_START` a raw
   `idTag` v payload. Nehovor, ze fyzicke nabijanie uz zacalo; dodanie zavisi
   od OCPP/OICP fronty a stavu stanice.
5. Po execute spracuj `followUp` alebo `notificationDraft`: zapis ClickUp
   komentar do suvisiaceho helpdesk tasku a zakaznicku odpoved posli iba cez
   ClickUp task Email mode alebo specializovany ClickUp email tool podla
   hlavneho skill postupu `Helpdesk Zaznam A Mail`. Nepouzivaj Outlook ani
   osobnu schranku. Toto je povinna sucast workflowu; neukonci odpoved
   operatorovi iba stavom remote startu. Ak `followUp.clickup.status` je
   `created`, backend uz ClickUp komentar vytvoril a nesmies pridat duplikat.

## Typicke Stavy

- `account_not_found`: skontroluj email uctu.
- `vehicle_not_found` alebo `vehicle_ambiguous`: vypytaj si SPZ, VIN alebo
  vehicle ID.
- `tag_not_found` alebo `tag_ambiguous`: treba aktivny jednoznacny tag pre
  vozidlo.
- `target_incomplete`: bol zadany iba ucet alebo iba vozidlo; dopln chybajuci
  udaj alebo pouzi fallback iba ked chyba oboje.
- `free_fallback_tag_not_found`: nie je nakonfigurovany ani jednoznacne
  najdeny aktivny free fallback tag v priestore stanice a EVSE nema zapnuty
  pouzitelny OCPP free charging.
- `free_fallback_tag_ambiguous`: existuje viac moznych fallback tagov; treba
  nakonfigurovat presne fallback tag ID.
- `ocpp_free_charging_station_unavailable`: EVSE ma free charging zapnuty, ale
  stanica nie je online alebo chyba OCPP routing data.
- `ocpp_free_charging_id_tag_invalid`: nakonfigurovany OCPP free idTag je
  prazdny alebo dlhsi ako OCPP limit 20 znakov.
- `touchpoint_local_free_charging_station_unavailable`: bol poziadany lokalny
  touchpoint FreeCharging, ale stanica nie je online alebo chyba OCPP routing.
- `touchpoint_local_free_charging_id_tag_invalid`: lokalny free idTag je
  prazdny alebo dlhsi ako OCPP limit 20 znakov.
- `free_fallback_tag_not_accepted`: fallback tag nema pristup k EVSE alebo nie
  je akceptovany.
- `paid_charging_requires_account`: policy vyzera ako platena; free fallback
  nepokracuje, treba ucet a vozidlo.
- `free_policy_not_verified`: cenu/policy sa nepodarilo spolahlivo overit ako
  neplatenu; free fallback nepokracuje.
- `charger_not_found`, `charger_too_far` alebo `charger_ambiguous`: vypytaj si
  GPS, device ID alebo presnejsiu stanicu.
- `connector_required`: nabijacka ma viac konektorov; vypytaj si lavy/pravy.
- `connector_busy`: na konektore uz bezi aktivna transakcia; nic neposielaj.
- `confirmation_expired`: spusti nove preview.

## Bezpecnost

Remote start je write operacia. Vzdy pouzi preview/execute model, nikdy priamy
execute bez potvrdenia. Pouzi iba minimum osobnych udajov potrebnych na
vyriesenie poziadavky a nevypisuj tajne hodnoty, tokeny ani DB credentials.
Free start je vynimka pre support a nesmie obist platene nabijanie. Pokracuj
iba ak preview vrati `mode: "ocpp_free_charging"` s EVSE/OCPP free flagom
alebo `mode: "touchpoint_local_free_charging"` po explicitnom operatorovom
potvrdeni lokalneho FreeCharging rezimu, alebo `mode: "free_fallback"` s
`policy.paid: false`.
