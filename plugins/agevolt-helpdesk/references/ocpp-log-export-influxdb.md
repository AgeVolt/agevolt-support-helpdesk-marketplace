# OCPP Log Export cez InfluxDB

Tento runbook pouzi pri helpdesk poziadavkach typu "poslite aktualny OCPP log
stanice" alebo "export logov pre deviceId".

## Co sa exportuje

- Zdroj: staging InfluxDB.
- Aktualny V2 zdroj: bucket `av_logs`, measurement `OCPP_LOG`.
- Zakladne tagy: `device_id`, `space_id`.
- Zakladne fields: `message_name`, `request`, `response`.
- Default casovy rozsah: poslednych 14 dni po aktualny cas, ak zakaznik
  nezadal iny rozsah.
- Vystup pre zakaznika: XLSX bez hlavicky, jeden sheet na jeden `deviceId`.
- Nazov suboru: `<deviceId>.xlsx`.
- Sheet name: `<deviceId>`.

Ak je dostupny automatizacny MCP/tool na OCPP export, mozes ho pouzit ako
wrapper. Ak tool nie je dostupny, nie je to blocker: pokracuj manualne podla
tohto runbooku. Az ked chyba pristup k AWS, InfluxDB alebo runtime env, jasne
povedz, ktory konkretny pristup alebo system treba otvorit, a poziadaj
pouzivatela o nove potvrdenie pred dalsim pokusom o prihlasenie alebo
spustenie prikazov vyzadujucich tento pristup.

## Access bootstrap

Ak `INFLUX_URL`, `INFLUX_ORG` alebo `INFLUXDB_CONNECTION_TOKEN` nie su
nastavene v aktualnom shelli, agent nema skoncit iba tymto zistenim. Najprv
skus pripravit staging pristup:

```bash
export INFLUX_URL="https://influxdb-staging.agevolt.com"
export INFLUX_ORG="Agevolt"
export INFLUXDB_CONNECTION_TOKEN="$(aws secretsmanager get-secret-value --secret-id influxdb-secrets --query SecretString --output text | jq -r '.["influxdb-admin-token"]')"
```

Pouzi iba schvaleny staging AWS profil alebo ops shell. Prikaz nesmie vypisat
hodnotu tokenu do odpovede, logu ani suboru. Ak AWS CLI, SSO session, profil,
network alebo opravnenie chyba, neodpovedaj ako finalny blocker. Jasne pomenuj,
co chyba, a poziadaj pouzivatela o nove potvrdenie/approval na refresh loginu
alebo spustenie potrebneho prikazu.

## Flux query pre aktualny V2 Influx

Pouzi staging `INFLUX_URL`, `INFLUX_ORG` a `INFLUXDB_CONNECTION_TOKEN` z runtime
prostredia, napr. z data-service podu alebo schvaleneho ops shellu. Tokeny ani
secret hodnoty nikdy nevypisuj do odpovede.

```flux
deviceId = "<deviceId>"

from(bucket: "av_logs")
  |> range(start: -14d)
  |> filter(fn: (r) => r._measurement == "OCPP_LOG")
  |> filter(fn: (r) =>
    (exists r.device_id and r.device_id == deviceId) or
    (exists r.deviceId and r.deviceId == deviceId) or
    (exists r.connectionId and r.connectionId == deviceId)
  )
  |> filter(fn: (r) =>
    r._field == "message_name" or
    r._field == "request" or
    r._field == "response"
  )
  |> keep(columns: ["_time", "_field", "_value", "device_id", "deviceId", "connectionId", "space_id"])
  |> sort(columns: ["_time"])
```

Ak potrebujes presny interval, pouzi explicitne UTC casy:

```flux
  |> range(
    start: time(v: "<startUtc>"),
    stop: time(v: "<stopUtc>")
  )
```

## Curl priklad

Flux uloz do docasneho suboru, napr. `/tmp/ocpp-log.flux`, a spusti query cez
Influx API. Pouzi iba shell, ktory uz ma nastavene env pre staging.

```bash
curl -sS "$INFLUX_URL/api/v2/query?org=$INFLUX_ORG" \
  -H "Authorization: Token $INFLUXDB_CONNECTION_TOKEN" \
  -H "Content-Type: application/vnd.flux" \
  -H "Accept: application/csv" \
  --data-binary @/tmp/ocpp-log.flux \
  > /tmp/<deviceId>.csv
```

## XLSX format pre zakaznika

Z CSV sprav XLSX bez hlavicky s tromi stlpcami:

1. UTC cas vo formate `YYYY-MM-DD HH:mm:ss.SSS UTC`.
2. Hodnota `_value`:
   - pri `_field == "request"` je to request payload JSON,
   - pri `_field == "response"` je to response payload JSON,
   - pri `_field == "message_name"` je to nazov OCPP message.
3. Typ riadku: hodnota `_field`, teda `request`, `response` alebo
   `message_name`.

Kazdy Influx riadok zostava samostatnym XLSX riadkom. Zachovaj casove zoradenie
podla `_time`.

## Legacy fallback

Ak `av_logs` nevrati ziadne data, moze ist o starsie data pred V2 migraciou.
Vtedy dohladaj `space_id`/`thing_id` pre stanicu podla `deviceId`, napr. cez
MySQL view `agevolt.thing_station_for_ocpp`, kde `device_id = <deviceId>`.
Legacy bucket moze byt samotny `space_id` a tagy mozu pouzivat camelCase:
`deviceId` a `connectionId`.

Legacy query skus s bucketom `space_id`:

```flux
deviceId = "<deviceId>"

from(bucket: "<space_id>")
  |> range(start: -14d)
  |> filter(fn: (r) => r._measurement == "OCPP_LOG")
  |> filter(fn: (r) =>
    (exists r.deviceId and r.deviceId == deviceId) or
    (exists r.device_id and r.device_id == deviceId) or
    (exists r.connectionId and r.connectionId == deviceId)
  )
  |> filter(fn: (r) =>
    r._field == "message_name" or
    r._field == "request" or
    r._field == "response"
  )
  |> keep(columns: ["_time", "_field", "_value", "device_id", "deviceId", "connectionId"])
  |> sort(columns: ["_time"])
```

## Zakaznicka odpoved

Po prilozeni XLSX:

```text
Dobry den,

v prilohe Vam zasielame aktualny log zo stanice <deviceId>.

S pozdravom
AgeVolt
```
