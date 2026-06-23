# AgeVolt Helpdesk

Starter index pre buduce helpdesk pravidla, sablony a odkazy na zdroje.

## Tematicke Okruhy

- zakaznicka podpora
- incident triage
- nabijacie sessions
- fakturacia a platby
- portal a mobilna aplikacia
- hardver a servis
- interne eskalacie
- WiseCloud touchpoint operacie
- touchpoint remote start/stop nabijania vratane OCPP free charging, touchpoint-local free charging/fallback startu a ClickUp/mail follow-upu

## Runbooky

- [Touchpoint Remote Start Nabijania](../touchpoint-remote-start.md) - postup pre bezpecne spustenie nabijania na touchpointe cez MCP preview/execute workflow, vratane OCPP free charging, explicitneho touchpoint-local free charging alebo fallbacku len pre neplatene nabijanie.
- [Touchpoint Remote Stop Nabijania](../touchpoint-remote-stop.md) - postup pre bezpecne zastavenie aktivneho nabijania na touchpointe cez MCP preview/execute workflow a helpdesk follow-up.
- [WiseCloud Touchpoint Reboot](../wisecloud-touchpoint-reboot.md) - postup pre prikazy typu `rebootni <serial>` cez server-side MCP tool `wisecloud.touchpoint.reboot`.
- [OCPP Log Export cez InfluxDB](../ocpp-log-export-influxdb.md) - postup pre XLSX export OCPP logov zo staging InfluxDB podla `deviceId`.
