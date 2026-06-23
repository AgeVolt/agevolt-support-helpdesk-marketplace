---
name: agevolt-helpdesk
description: "Pouzi pri praci s AgeVolt helpdeskom: triage poziadaviek, priprava odpovedi zakaznikom, incident summary, eskalacie, servisne postupy, OCPP log export zo staging InfluxDB, interny support handover, analyza ticketov, operacny reboot AgeVolt touchpointu cez WiseCloud alebo remote start/stop nabijania na touchpointe. Skill je vhodny aj ked pouzivatel spomenie podporu, ticket, zakaznika, problem s nabijanim, fakturaciou, aplikaciou, portalom, touchpoint, WiseCloud, MDM, deviceId, OCPP logy, rebootni WPYP, spusti nabijanie alebo zastav nabijanie na touchpointe."
---

# AgeVolt Helpdesk

Tento skill pomaha pri helpdesk a support workflow pre AgeVolt. Pouzivaj ho
pri triedeni poziadaviek, priprave odpovedi, sumarizacii incidentov,
eskalaciach, tvorbe servisnych postupov a operacnych touchpoint ulohach.

## Rychly Postup

1. Najprv urci typ poziadavky: zakaznicka otazka, incident, bug report,
   fakturacia, nabijacia session, portal/aplikacia, hardver, roaming,
   touchpoint reboot, touchpoint remote start/stop alebo interna operacia.
2. Oddel fakty od predpokladov. Nevyplnaj chybajuce cisla, mena, ID nabijaciek,
   fakturacne udaje ani casy udalosti, ak ich pouzivatel nedodal.
3. Ak chyba kriticky kontext, vypytaj si iba najmensi potrebny doplnok:
   ticket ID, zakaznika, krajinu, stanicu/connector, WiseCloud serial, cas
   udalosti, chybovu hlasku, screenshot alebo log.
4. Pri odpovediach zakaznikom pis vecne, kratko a s jasnym dalsim krokom.
5. Pri internych handoveroch pouzi strukturu: stav, dopad, co vieme,
   co chyba, navrhovany dalsi krok, vlastnik.

## Touchpoint Remote Start

Pri poziadavkach ako `spusti nabijanie na touchpointe`, `remote start na
nabijacke`, `spusti lavy konektor pre ucet ... a vozidlo ...` alebo podobnych
operacnych poziadavkach si precitaj
`references/touchpoint-remote-start.md` a postupuj presne podla neho.

Pouzivaj iba server-side MCP tooly `helpdesk_touchpoint_remote_start_preview`
a `helpdesk_touchpoint_remote_start_execute`. Preview spusti az ked mas aspon:
nabijacku alebo adresu/lokalitu, konektor ak ma nabijacka viac portov, email
cieloveho uctu a vozidlo. Ak pouzivatel zada iba mesto/ulicu, najprv zisti
suradnice dostupnym geocoderom alebo si vypytaj GPS/presnejsiu stanicu; tool
vie najbezpecnejsie zvolit touchpoint podla `agevolt.evse.geo`.

Nikdy nevolaj priamy SQL insert, `curl`, HTTP endpoint ani rucny bearer token.
Najprv zavolaj preview, ukaz vyrieseny ucet, vozidlo, tag, touchpoint,
stanicu, konektor a vzdialenost, potom poziadaj o explicitne potvrdenie v
aktualnom chate. Ostry remote start posli iba cez execute s `confirmationId`.
Nehlas, ze fyzicke nabijanie uz zacalo; hlas iba, ze remote start bol zaradeny
do OCPP/OICP workflowu.

## Touchpoint Remote Stop

Pri poziadavkach ako `zastav nabijanie na touchpointe`, `remote stop na
nabijacke`, `zastav lavy konektor pre ucet ... a vozidlo ...` alebo podobnych
operacnych poziadavkach si precitaj
`references/touchpoint-remote-stop.md` a postupuj presne podla neho.

Pouzivaj iba server-side MCP tooly `helpdesk_touchpoint_remote_stop_preview`
a `helpdesk_touchpoint_remote_stop_execute`. Preview spusti az ked mas aspon:
nabijacku alebo adresu/lokalitu, konektor ak ma nabijacka viac portov, email
cieloveho uctu a vozidlo. Ak pouzivatel zada iba mesto/ulicu, najprv zisti
suradnice dostupnym geocoderom alebo si vypytaj GPS/presnejsiu stanicu.

Nikdy nevolaj priamy SQL insert, `curl`, HTTP endpoint ani rucny bearer token.
Najprv zavolaj preview, ukaz vyrieseny ucet, vozidlo, tag, touchpoint,
stanicu, konektor a aktivnu transakciu, potom poziadaj o explicitne
potvrdenie v aktualnom chate. Ostry remote stop posli iba cez execute s
`confirmationId`. Nehlas, ze fyzicke nabijanie sa uz ukoncilo; hlas iba, ze
remote stop workflow bol prijaty alebo aky stav vratil server.

## WiseCloud Touchpoint Reboot

Pri prikazoch ako `rebootni WPYP002417000159`, `reboot touchpoint <serial>`,
`reboot 0159`, `rebootni touchpoint 0159` alebo podobnych operacnych
poziadavkach si precitaj `references/wisecloud-touchpoint-reboot.md` a postupuj
presne podla neho. Ak pouzivatel zada posledne 4 znaky serialu, pouzi najprv
server-side MCP resolver `wisecloud.touchpoint.resolve_serial` (v Codex tool
surface moze byt ako `wisecloud_touchpoint_resolve_serial`), potom over presny
riadok cez `wisecloud.touchpoint.reboot` s `dryRun: true`, vypis plny `Device
SN` a poziadaj o potvrdenie. Ostry reboot posli az po potvrdeni v aktualnom
chate. Ak natívny MCP tool nie je priamo viditelny, zastav a vysvetli, ze treba
refreshnut/aktualizovat AgeVolt Helpdesk MCP tool surface; neobchadzaj to cez
priamy HTTP endpoint ani rucny bearer token. Nikdy neukladaj WiseCloud heslo do
pluginu, suborov ani odpovede.

## OCPP Log Export

Pri poziadavkach typu `posli OCPP log`, `exportuj logy pre deviceId`,
`logy za poslednych 14 dni` alebo `xlsx log stanice` si precitaj
`references/ocpp-log-export-influxdb.md`.

Zdroj pravdy pre export je vzdy staging InfluxDB. Ak je dostupny
automatizacny MCP/tool na OCPP export, mozes ho pouzit ako wrapper. Ak tool
nie je dostupny, nie je to blocker: pokracuj manualne podla InfluxDB runbooku.
Ak chyba pristup k AWS, InfluxDB alebo runtime env, jasne povedz, ktory
konkretny pristup alebo system treba otvorit, a poziadaj pouzivatela o nove
potvrdenie pred dalsim pokusom o prihlasenie alebo spustenie prikazov
vyzadujucich tento pristup.

Default workflow:

- vstupom staci `deviceId` alebo viac `deviceIds`,
- ak pouzivatel nezada rozsah, exportuj poslednych 14 dni po aktualny cas,
- primarne citaj bucket `av_logs`, measurement `OCPP_LOG`,
- ak `av_logs` nevrati data, pouzi legacy fallback z runbooku,
- vystup je vzdy zakaznicky XLSX,
- jeden subor na jeden `deviceId`, nazov `<deviceId>.xlsx`,
- sheet je pomenovany podla `deviceId`,
- bez hlavicky, tri stlpce:
  1. UTC cas v tvare `YYYY-MM-DD HH:mm:ss.SSS UTC`,
  2. payload JSON alebo hodnota `message_name`,
  3. typ riadku `request`, `response` alebo `message_name`.

Nikdy nevypisuj Influx token, AWS secret, API kluc ani hodnoty z Kubernetes
secretov.

## Bezpecnost A Sukromie

- Nevracaj tajne hodnoty, tokeny, hesla, API kluce ani osobne udaje navyse.
- Pri osobnych udajoch pouzi iba minimum potrebne na vyriesenie poziadavky.
- Nepredstieraj, ze si skontroloval helpdesk, CRM, billing, monitoring alebo
  WiseCloud, pokial nemas k dispozicii konkretny nastroj alebo data.
- Ak potrebujes live data, jasne povedz, ktory system alebo export treba
  otvorit.

## Vystupy

Pre zakaznicku odpoved:

```text
Dobrý deň,

...

S pozdravom
AgeVolt
```

Pre internu eskalaciu:

```text
Typ:
Dopad:
Fakty:
Chýba:
Navrhovaný ďalší krok:
Vlastník:
```
