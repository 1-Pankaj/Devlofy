---
source_file: ".agents/skills/expo-skill-feedback/scripts/telemetry_common.cjs"
type: "code"
community: "Community 67"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Community_67
---

# telemetry_common.cjs

## Connections
- [[INSTALLATION_ID_PATH]] - `contains` [EXTRACTED]
- [[NOTE never put a PostHog personal API key (phx_...) here — those are secret.]] - `rationale_for` [EXTRACTED]
- [[OPT_IN_PATH]] - `contains` [EXTRACTED]
- [[crypto]] - `contains` [EXTRACTED]
- [[detectHarness()]] - `indirect_call` [INFERRED]
- [[fs_3]] - `contains` [EXTRACTED]
- [[https]] - `contains` [EXTRACTED]
- [[isCI()]] - `indirect_call` [INFERRED]
- [[os]] - `contains` [EXTRACTED]
- [[path_3]] - `contains` [EXTRACTED]
- [[platformProps()]] - `indirect_call` [INFERRED]
- [[readInstallationId()]] - `contains` [EXTRACTED]
- [[ref_crypto]] - `imports_from` [EXTRACTED]
- [[ref_fs]] - `imports_from` [EXTRACTED]
- [[ref_https]] - `imports_from` [EXTRACTED]
- [[ref_os]] - `imports_from` [EXTRACTED]
- [[ref_path]] - `imports_from` [EXTRACTED]
- [[sendToPosthog()]] - `indirect_call` [INFERRED]
- [[skill-event.cjs]] - `imports_from` [EXTRACTED]
- [[telemetry.cjs]] - `imports_from` [EXTRACTED]
- [[telemetryActive()]] - `indirect_call` [INFERRED]
- [[telemetryConfigured()]] - `indirect_call` [INFERRED]
- [[telemetryEnvSignal()]] - `indirect_call` [INFERRED]
- [[telemetryIdentity()]] - `indirect_call` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/Community_67