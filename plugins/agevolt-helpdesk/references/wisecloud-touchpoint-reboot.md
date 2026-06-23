# WiseCloud Touchpoint Reboot

Use this runbook when the user asks to reboot an AgeVolt touchpoint by full
WiseCloud serial number or by the last 4 serial characters, for example
`rebootni WPYP002417000159`, `reboot touchpoint WPYP002417000159`,
`reboot 0159`, or `rebootni touchpoint 0159`.

## Guardrails

- Reboot exactly one device per request.
- Accept either an exact WiseCloud device serial number or exactly the last 4
  serial characters. A 4-character suffix is allowed only through the
  server-side WiseCloud unique resolver; never expand it from memory, local
  notes, or nearby matches.
- If the serial/suffix is missing or ambiguous, ask for it.
- If the user explicitly says to reboot a specific serial, that is permission to
  start the safe verification workflow for that serial only.
- Before sending the final WiseCloud command, verify the exact serial again and
  ask the user to confirm the resolved full `Device SN` in the current chat.
- Do not use nearby or partial serial matches other than the exact last-4
  resolver. Do not reboot multiple rows.
- Do not click or send `Shutdown`, `Restore`, `Clear password`, `Lock device`,
  or other destructive menu items.

## Automated MCP Workflow

1. If the user provided exactly 4 serial characters, call the read-only MCP
   tool `wisecloud.touchpoint.resolve_serial` first. In Codex this may be
   exposed as `wisecloud_touchpoint_resolve_serial`.
2. Continue only when the resolver returns `status: "resolved"` and exactly one
   full `serial`. Show the resolved full `Device SN` to the user. If it returns
   `not_found`, `multiple_suffix_matches`, `session_expired`,
   `configuration_required`, `verification_code_required`, or an API error,
   stop and report that no reboot command was sent.
3. If the user provided a full serial, normalize it and use it directly as the
   candidate exact `Device SN`.
4. Call `wisecloud.touchpoint.reboot` with the exact full serial and
   `dryRun: true` to verify the WiseCloud row. In Codex this may be exposed as
   `wisecloud_touchpoint_reboot`.
5. If the dry run returns `dry_run_ok`, show the exact `Device SN` and useful
   safe row details such as device name/type/status/online state, then ask for
   explicit confirmation before sending the live reboot.
6. Only after confirmation in the current chat, call
   `wisecloud.touchpoint.reboot` again with the exact full serial and
   `dryRun: false`.
7. If the tool returns `sent`, report that the WiseCloud reboot command was
   sent. Do not claim physical reboot completion.
8. If the tool returns `configuration_required`, explain which secure source is
   missing. Do not ask the user to paste the WiseCloud password into chat.
9. If the tool returns `verification_code_required`, use the current one-time
   code from the configured mailbox/code provider, or ask the user only for the
   one-time code and retry the same tool.
10. If the tool returns `not_found`, `multiple_exact_matches`, `device_frozen`,
   or an API error, stop and report that no reboot command was sent.

## Server-Side Runtime Configuration

Helpdesk uses the central AgeVolt HTTP MCP architecture:

- plugin MCP config points to
  `https://av-agent.agevolt.com/mcp/helpdesk`;
- direct JSON fallback endpoint is the same AgeVolt server endpoint;
- WiseCloud credentials and AVDP_NOTIF verification-code retrieval live only on
  the AgeVolt server side;
- end users do not run setup scripts, configure Keychain, or paste passwords.

The server must be configured once by an admin with `WISECLOUD_TOKEN` or
`WISECLOUD_PASSWORD_MD5` plus `WISECLOUD_CODE_PROVIDER_URL` that returns the
newest login/operation code from AVDP_NOTIF. Do not commit actual secrets into
the plugin or source config.

## Browser Workflow Fallback

Use this if the MCP tool is unavailable or cannot complete safely.

1. Open `https://wisecloud-us.wiseasy.com/device/list`.
2. If redirected to login:
   - fill `mdm@agevolt.com`,
   - fill the WiseCloud password from a secure source,
   - click `Send code`,
   - retrieve the newest AVDP_NOTIF verification code,
   - enter the code and click `Login`.
3. On `Device List`, find the `Device SN` field.
4. Enter the exact serial number from the user request and submit search
   with Enter or the `Query` button.
5. Wait for the table to update.
6. Verify there is exactly one row and its `Device SN` exactly equals the
   requested serial.
7. In the row's `Operation` column, open `More` by hover or click.
8. Click `Reboot`.
9. In the `Reboot` confirmation dialog, verify the serial again.
10. Click `OK`.
11. Report that the reboot command was sent. Do not claim the physical device
    has already completed rebooting unless WiseCloud confirms that separately.

## Authentication

- WiseCloud URL: `https://wisecloud-us.wiseasy.com/device/list`.
- AgeVolt WiseCloud MDM username: `mdm@agevolt.com`.
- Do not store the password in plugin files, chat memory, logs, or generated
  artifacts. For the automated workflow, use only the server-side
  `php/config.local.php` on the MCP host. Browser fallback is for a human
  operator with their own approved secure source.
- Login code endpoint/code email goes to the `AVDP_NOTIF` mailbox/group from
  WiseCloud with a subject like `WiseCloud login security verification`.
- Use the newest code only. Codes are short-lived.

## Failure Handling

- If login fails, stop and report the failure. Do not retry repeatedly.
- If a verification code expires, request or fetch a fresh code.
- If the serial is not found, report that no matching WiseCloud device was
  found and that no command was sent.
- If WiseCloud shows multiple rows, stop and ask for a more specific serial.
- If the `More` menu or `Reboot` action is unavailable, report the current
  row status and do not try another action as a workaround.
