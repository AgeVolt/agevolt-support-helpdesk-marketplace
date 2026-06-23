#!/usr/bin/env node
const url = process.env.AGEVOLT_HELPDESK_MCP_URL ||
  "https://av-agent.agevolt.com/mcp/helpdesk";
let id = 0;

async function request(method, params = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params })
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const message = await response.json();
  if (message.error) throw new Error(`${method}: ${message.error.message || JSON.stringify(message.error)}`);
  return message;
}

try {
  await request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  const list = await request("tools/list", {});
  const names = list.result.tools.map((tool) => tool.name);
  for (const required of [
    "helpdesk.meta.get_status",
    "helpdesk_touchpoint_remote_start_preview",
    "helpdesk_touchpoint_remote_start_execute",
    "wisecloud.touchpoint.resolve_serial",
    "wisecloud.touchpoint.reboot"
  ]) {
    if (!names.includes(required)) throw new Error(`Missing tool ${required}`);
  }
  const status = await request("tools/call", { name: "helpdesk.meta.get_status", arguments: {} });
  const text = status.result.content[0].text;
  const parsed = JSON.parse(text);
  if (parsed.status !== "ok") throw new Error("Unexpected status payload");
  console.log(`ok - ${url} - tools: ${names.join(", ")}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
