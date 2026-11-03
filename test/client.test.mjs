// Behavioural test for the forked browser bundle: the permission surfaces must
// apply cleanly, carry no RiskConfirmation element, and switch a gated preset
// immediately instead of opening a modal.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'

const SOURCE = new URL('../lib/client.js', import.meta.url)
const FRAGMENT = Symbol.for('test.fragment')

const PRIMITIVES = {
  Menu: 'Menu',
  RiskConfirmation: 'RiskConfirmation',
  IconChevronDownOutlineRegular: 'IconChevronDown',
  PermissionIconReadOnlyRegular: 'IconReadOnly',
  PermissionIconWorkspaceWriteRegular: 'IconWorkspaceWrite',
  PermissionIconFullAccessRegular: 'IconFullAccess',
  PermissionIconAutoReviewRegular: 'IconAutoReview',
}

const CATALOG = {
  options: [
    { value: 'read-only', name: 'Read Only' },
    { value: 'workspace-write', name: 'Workspace Write' },
    { value: 'danger-full-access', name: 'Full access' },
    { value: 'auto', name: 'Auto review' },
  ],
  defaultOptions: [
    { value: 'read-only', name: 'Read Only' },
    { value: 'workspace-write', name: 'Workspace Write' },
    { value: 'danger-full-access', name: 'Full access' },
  ],
  defaultPreset: 'workspace-write',
}

function storeOf(initial) {
  let value = initial
  return {
    getSnapshot: () => value,
    set: (next) => { value = next },
    update: (fn) => { fn(value) },
    subscribe: () => () => {},
  }
}

function required(specifier) {
  if (specifier === 'react/jsx-runtime') {
    return {
      Fragment: FRAGMENT,
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    }
  }
  if (specifier === 'react') {
    return {
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useEffect: () => {},
      useMemo: (factory) => factory(),
      useCallback: (fn) => fn,
    }
  }
  if (specifier === '@deepseek-ai/dsh-client-store') return { createSnapshotStore: storeOf }
  if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVES
  throw new Error(`unexpected require: ${specifier}`)
}

async function loadBundle() {
  const calls = { session: [], settings: [] }
  let registration
  const window = { __ModuleLoader__: { load: (value) => { registration = value } } }
  new Function('window', fs.readFileSync(SOURCE, 'utf8'))(window)
  assert.equal(registration.id, 'dsh-permission-no-confirm')

  const slots = []
  const decorations = []
  const settingsView = {
    ns: 'permission',
    writable: true,
    revision: 3,
    value: { defaultPreset: 'workspace-write' },
  }
  const connection = {
    generation: { subscribe: () => () => {}, getSnapshot: () => ({ id: 'generation-1' }) },
  }
  const ctx = {
    get: (name) => name === 'commandUi'
      ? {
          dismiss: () => {},
          decorate: (decoration) => { decorations.push(decoration); return () => {} },
        }
      : name === 'connection'
        ? connection
        : undefined,
    sessions: {
      binding: () => ({
        session: {
          sessionId: 's1',
          projections: {
            faceOf: () => ({ getSnapshot: () => ({ currentValue: 'workspace-write' }) }),
          },
          command: async (line) => {
            calls.session.push(line)
            return { ok: true, value: { matched: true } }
          },
        },
      }),
    },
    effect: (fn) => { fn(); return () => {} },
    locale: {
      register: () => () => {},
      bind: () => (key, values) => (values === undefined ? key : `${key}:${values.name}`),
    },
    remote: {
      $on: () => () => {},
      permissionPresets: { catalog: async () => ({ ok: true, value: CATALOG }) },
      settings: {
        mutate: async (ns, ops, revision) => {
          calls.settings.push({ ns, ops, revision })
          return { ok: true, value: settingsView }
        },
      },
    },
    connection,
    configForms: {
      describe: () => ({
        subscribe: () => () => {},
        getSnapshot: () => ({ view: { writable: true, namespaces: [settingsView] }, error: null }),
        ensure: async () => {},
      }),
    },
    slots: {
      inject: (name, register) => { register(); return () => {} },
      register: (options, component) => { slots.push({ options, component }); return () => {} },
    },
  }

  const mod = registration.factory(required)
  mod.apply(ctx)
  // let the catalog directory's first read settle before surfaces render
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { mod, slots, decorations, calls }
}

function elements(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) elements(child, out)
    return out
  }
  if (node === null || typeof node !== 'object') return out
  out.push(node)
  if (node.type === FRAGMENT) elements(node.props.children, out)
  else if (node.props.children !== undefined) elements(node.props.children, out)
  return out
}

function findElement(tree, type) {
  const match = elements(tree).find((node) => node.type === type)
  if (match === undefined) throw new Error(`no ${String(type)} element in the rendered tree`)
  return match
}

const rendered = (tree) => {
  const all = elements(tree)
  assert.equal(all.some((node) => node.type === PRIMITIVES.RiskConfirmation), false, 'rendered tree contains RiskConfirmation')
  return all
}

test('bundle registers the permission surfaces and applies cleanly', async () => {
  const { mod, slots, decorations } = await loadBundle()
  assert.deepEqual(mod.inject, [
    'commandUi',
    'connection',
    'sessions',
    'slots',
    'locale',
    'remote',
    'remote.permissionPresets',
    'remote.settings',
    'configForms',
    'settingsSchema',
  ])
  assert.deepEqual(slots.map((entry) => entry.options.name), ['settings.general.item', 'conversation.input.permission'])
  assert.equal(slots[0].options.id, 'permission')
  assert.equal(decorations[0].name, 'permission')
})

test('settings row switches to Full access without a gate', async () => {
  const { slots } = await loadBundle()
  const row = slots[0]
  const injected = row.options.inject()
  const state = {
    status: 'ready',
    error: null,
    writable: true,
    currentValue: 'workspace-write',
    options: [
      { id: 'read-only', label: 'Read Only' },
      { id: 'workspace-write', label: 'Workspace Write' },
      { id: 'danger-full-access', label: 'Full access' },
    ],
    revision: 3,
  }
  const selected = []
  const tree = row.component({
    ...injected,
    usePermission: (selector) => selector(state),
    t: (key) => key,
    select: (preset) => { selected.push(preset); return Promise.resolve(true) },
  })
  rendered(tree)
  const menu = findElement(tree, PRIMITIVES.Menu)
  menu.props.onSelect('danger-full-access')
  assert.deepEqual(selected, ['danger-full-access'])
})

test('composer picker switches to Full access without a gate', async () => {
  const { slots } = await loadBundle()
  const picker = slots[1]
  const injected = picker.options.inject('s1')
  const selected = []
  const tree = picker.component({
    ...injected,
    locked: false,
    useProjection: () => ({ currentValue: 'workspace-write' }),
    usePermissionCatalog: (selector) => selector(injected.hooks.permissionCatalog.getSnapshot()),
    t: (key) => key,
    select: (preset) => { selected.push(preset); return Promise.resolve(true) },
  })
  rendered(tree)
  const menu = findElement(tree, PRIMITIVES.Menu)
  menu.props.onSelect('danger-full-access')
  assert.deepEqual(selected, ['danger-full-access'])
})

test('composer picker also switches to the experimental Auto review without a gate', async () => {
  const { slots } = await loadBundle()
  const picker = slots[1]
  const injected = picker.options.inject('s1')
  const selected = []
  const tree = picker.component({
    ...injected,
    locked: false,
    useProjection: () => ({ currentValue: 'workspace-write' }),
    usePermissionCatalog: (selector) => selector(injected.hooks.permissionCatalog.getSnapshot()),
    t: (key) => key,
    select: (preset) => { selected.push(preset); return Promise.resolve(true) },
  })
  const autoAll = rendered(tree)
  assert.equal(autoAll.some((node) => node.type === PRIMITIVES.Menu), true)
  findElement(tree, PRIMITIVES.Menu).props.onSelect('auto')
  assert.deepEqual(selected, ['auto'])
})

test('/permission popup options carry no confirmation metadata', async () => {
  const { decorations } = await loadBundle()
  const decoration = decorations[0]
  assert.equal(decoration.ui.kind, 'popupSelect')
  const options = await decoration.ui.options({ sessionId: 's1' })
  assert.deepEqual(options.map((option) => option.id), ['read-only', 'workspace-write', 'danger-full-access', 'auto'])
  for (const option of options) {
    assert.equal('confirmation' in option, false, `option ${option.id} still carries confirmation metadata`)
  }
  assert.equal(options.find((option) => option.id === 'auto').badge, 'auto.badge')
})
