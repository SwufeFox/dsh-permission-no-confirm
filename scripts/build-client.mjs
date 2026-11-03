// Derive lib/client.js from the shipped permission-presets browser bundle, with
// the risk-gate modal removed. Every edit is asserted so a shipped-bundle change
// fails loudly instead of silently producing a wrong artifact.
import fs from 'node:fs'

const target = new URL('../lib/client.js', import.meta.url)
const lines = fs.readFileSync(target, 'utf8').split('\n')
const MODULE_ID = 'dsh-permission-no-confirm'

const edits = new Map()
const expect = (from, prefix) => {
  const actual = lines[from - 1]
  if (actual === undefined || !actual.startsWith(prefix)) {
    throw new Error(`line ${from} does not start with ${JSON.stringify(prefix)}: ${JSON.stringify(actual)}`)
  }
}
const replace = (from, to, block, prefix) => {
  if (prefix !== undefined) expect(from, prefix)
  edits.set(`${from}-${to}`, { from, to, block })
}

// --- registration id -------------------------------------------------------
replace(2, 2, [`\tid: ${JSON.stringify(MODULE_ID)},`], '\tid: "@deepseek-ai/dsh-client-ui-permission-presets",')

// --- PermissionSelect state -------------------------------------------------
replace(314, 315, [], '\t\t\tconst [confirmation, setConfirmation]')

// effect that closed the popup when the gate/catalog went stale
replace(316, 326, [
  '\t\t\t(0, react.useEffect)(() => {',
  '\t\t\t\tif (!locked && selection !== void 0 && catalog !== null) return;',
  '\t\t\t\tsetOpen(false);',
  '\t\t\t}, [',
  '\t\t\t\tcatalog,',
  '\t\t\t\tlocked,',
  '\t\t\t\tselection',
  '\t\t\t]);',
], '\t\t\t(0, react.useEffect)(() => {')

replace(331, 331, ['\t\t\tconst busy = pick !== null;'], '\t\t\tconst busy = pick !== null || confirmation !== null;')

// choose(): no gated branch, a pick submits immediately
replace(361, 365, [], '\t\t\t\tif (id === "danger-full-access" || id === "auto") {')

// gate helpers and copy
replace(368, 379, [], '\t\t\tconst closeConfirmation = () => {')

// JSX tail: drop the RiskConfirmation sibling
replace(416, 431, ['\t\t\t})] });'], '\t\t\t}), confirmation !== null && (0, react_jsx_runtime.jsx)(')

// --- PermissionRow state ----------------------------------------------------
replace(467, 468, [], '\t\t\tconst [confirmingFullAccess, setConfirmingFullAccess]')

replace(472, 477, [
  '\t\t\t(0, react.useEffect)(() => {',
  '\t\t\t\tif (state.writable && state.status !== "unavailable") return;',
  '\t\t\t\tsetOpen(false);',
  '\t\t\t}, [state.status, state.writable]);',
], '\t\t\t(0, react.useEffect)(() => {')

replace(480, 480, ['\t\t\tconst busy = state.status === "loading" || state.status === "saving";'], '\t\t\tconst busy = state.status === "loading"')

// Menu onSelect: no gated branch
replace(509, 513, [], '\t\t\t\t\t\tif (id === "danger-full-access") {')

// JSX tail: drop the RiskConfirmation sibling
replace(530, 550, ['\t\t\t})] });'], '\t\t\t}), (0, react_jsx_runtime.jsx)(')

// --- slash popup option metadata -------------------------------------------
replace(736, 751, [
  '\t\tfunction optionsOf(catalog, currentValue, t) {',
  '\t\t\treturn catalog.options.map((option) => ({',
  '\t\t\t\tid: option.value,',
  '\t\t\t\tlabel: option.value === "auto" ? t("auto.label") : displayPermissionPreset(option.value, option.name, t),',
  '\t\t\t\t...option.value === "auto" ? { badge: t("auto.badge") } : {},',
  '\t\t\t\t...option.value === "auto" ? { detail: t("auto.description") } : option.description !== void 0 ? { detail: option.description } : {},',
  '\t\t\t\t...option.value === currentValue ? { active: true } : {}',
  '\t\t\t}));',
  '\t\t}',
], '\t\tfunction optionsOf(catalog, currentValue, t) {')

// --- dictionaries -----------------------------------------------------------
replace(159, 172, [
  '\t\tconst zh = {',
  '\t\t\t"title": "权限",',
  '\t\t\t"description": "选择新会话的默认权限模式",',
  '\t\t\t"loading": "加载中",',
  '\t\t\t"unavailable": "不可用",',
  '\t\t\t"preset.readOnly": "仅可查看",',
  '\t\t\t"preset.workspaceWrite": "工作区内修改",',
  '\t\t\t"preset.fullAccess": "完全权限"',
  '\t\t};',
], '\t\tconst zh = {')

replace(174, 187, [
  '\t\tconst en = {',
  '\t\t\t"title": "Permission",',
  '\t\t\t"description": "Choose the default permission mode for new sessions",',
  '\t\t\t"loading": "Loading",',
  '\t\t\t"unavailable": "Unavailable",',
  '\t\t\t"preset.readOnly": "Read Only",',
  '\t\t\t"preset.workspaceWrite": "Workspace Write",',
  '\t\t\t"preset.fullAccess": "Full access"',
  '\t\t};',
], '\t\tconst en = {')

replace(189, 207, [
  '\t\tconst accessZh = {',
  '\t\t\t"mode": "访问模式，当前：{name}",',
  '\t\t\t"preset.readOnly": "仅可查看",',
  '\t\t\t"preset.workspaceWrite": "工作区内修改",',
  '\t\t\t"preset.fullAccess": "完全权限",',
  '\t\t\t"auto.label": "自动审查",',
  '\t\t\t"auto.badge": "EXP",',
  '\t\t\t"auto.description": "无沙箱运行；每次原生工具调用和 PTC 内层调用前由同一模型进行实验性审查。"',
  '\t\t};',
], '\t\tconst accessZh = {')

replace(209, 227, [
  '\t\tconst accessEn = {',
  '\t\t\t"mode": "Access mode, current: {name}",',
  '\t\t\t"preset.readOnly": "Read Only",',
  '\t\t\t"preset.workspaceWrite": "Workspace Write",',
  '\t\t\t"preset.fullAccess": "Full access",',
  '\t\t\t"auto.label": "Auto review",',
  '\t\t\t"auto.badge": "EXP",',
  '\t\t\t"auto.description": "Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call."',
  '\t\t};',
], '\t\tconst accessEn = {')

// --- splice ----------------------------------------------------------------
const covered = [...edits.values()].sort((a, b) => a.from - b.from)
const rebuilt = []
let cursor = 1
for (const edit of covered) {
  if (edit.from < cursor) throw new Error(`overlapping edit at line ${edit.from}`)
  for (; cursor < edit.from; cursor += 1) rebuilt.push(lines[cursor - 1])
  rebuilt.push(...edit.block)
  cursor = edit.to + 1
}
for (; cursor <= lines.length; cursor += 1) rebuilt.push(lines[cursor - 1])

const text = rebuilt.join('\n')
fs.writeFileSync(target, text)
console.log(`wrote ${text.split('\n').length} lines (${text.length} bytes)`)
