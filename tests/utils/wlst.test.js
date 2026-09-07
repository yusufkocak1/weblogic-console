import { describe, expect, it } from 'vitest'
import {
  curlFor,
  curlForDeploy,
  curlForEdits,
  curlForServerAction,
  wlstForDeploy,
  wlstForEdits,
  wlstForServerAction,
  wlstForTargets,
  wlstForUndeploy,
  wlstPath,
} from '@/utils/wlst'

const CONTEXT = { domain: 'base_domain', username: 'weblogic', baseUrl: 'http://admin:7001' }

describe('wlstPath', () => {
  it('is the root for the edit tree itself', () => {
    expect(wlstPath('/edit')).toBe('/')
    expect(wlstPath('/edit/')).toBe('/')
    expect(wlstPath('')).toBe('/')
  })

  it('capitalises a collection and keeps the member name', () => {
    expect(wlstPath('/edit/servers/ms1')).toBe('/Servers/ms1')
    expect(wlstPath('/edit/clusters/cluster1')).toBe('/Clusters/cluster1')
  })

  it('repeats the parent name for a singleton child', () => {
    // A server's SSL MBean is /Servers/ms1/SSL/ms1, not /Servers/ms1/SSL.
    expect(wlstPath('/edit/servers/ms1/SSL')).toBe('/Servers/ms1/SSL/ms1')
    expect(wlstPath('/edit/servers/ms1/serverStart')).toBe('/Servers/ms1/ServerStart/ms1')
  })

  it('gives a domain-level singleton the domain name', () => {
    expect(wlstPath('/edit/log', { domain: 'base_domain' })).toBe('/Log/base_domain')
  })

  it('defaults the domain name when none was given', () => {
    expect(wlstPath('/edit/log')).toBe('/Log/domain')
  })

  it('names a generated JDBC parameter MBean NO_NAME_0', () => {
    expect(wlstPath('/edit/JDBCSystemResources/ds1/JDBCResource/JDBCConnectionPoolParams')).toBe(
      '/JDBCSystemResources/ds1/JDBCResource/ds1/JDBCConnectionPoolParams/NO_NAME_0',
    )
  })

  it('decodes a member name that had to be escaped in the URL', () => {
    expect(wlstPath('/edit/servers/my%20server')).toBe('/Servers/my server')
  })

  it('leaves a collection with no member as a bare capitalised segment', () => {
    expect(wlstPath('/edit/servers')).toBe('/Servers/domain')
  })
})

describe('wlstForEdits', () => {
  const script = wlstForEdits(
    [{ path: '/edit/servers/ms1/SSL', attributes: { enabled: true, listenPort: 7002 } }],
    CONTEXT,
  )

  it('carries the header warning about MBean paths', () => {
    expect(script).toContain('# Equivalent WLST for what this screen is about to do.')
  })

  it('connects over t3, since t3 shares the listen port with HTTP', () => {
    expect(script).toContain("connect('weblogic', '<password>', 't3://admin:7001')")
  })

  it('connects over t3s when the console is on https', () => {
    expect(wlstForEdits([], { ...CONTEXT, baseUrl: 'https://admin:7002' })).toContain('t3s://admin:7002')
  })

  it('performs the same three steps the console does', () => {
    const lines = script.split('\n')
    expect(lines).toContain('edit()')
    expect(lines).toContain('startEdit()')
    expect(lines[lines.length - 1]).toBe('activate()')
    expect(lines.indexOf('startEdit()')).toBeLessThan(lines.indexOf("cd('/Servers/ms1/SSL/ms1')"))
  })

  it('writes each attribute through its setter', () => {
    expect(script).toContain('cmo.setEnabled(true)')
    expect(script).toContain('cmo.setListenPort(7002)')
  })

  it('writes strings as Python literals with quotes escaped', () => {
    const out = wlstForEdits([{ path: '/edit/servers/ms1', attributes: { machine: "it's" } }], CONTEXT)
    expect(out).toContain("cmo.setMachine('it\\'s')")
  })

  it('writes an absent value as None', () => {
    const out = wlstForEdits([{ path: '/edit/servers/ms1', attributes: { machine: null } }], CONTEXT)
    expect(out).toContain('cmo.setMachine(None)')
  })

  it('writes booleans the way WLST spells them', () => {
    const out = wlstForEdits([{ path: '/edit/servers/ms1', attributes: { a: true, b: false } }], CONTEXT)
    expect(out).toContain('cmo.setA(true)')
    expect(out).toContain('cmo.setB(false)')
  })

  it('still produces a runnable lock/activate pair with no edits at all', () => {
    const out = wlstForEdits([], CONTEXT).split('\n')
    expect(out).toContain('startEdit()')
    expect(out[out.length - 1]).toBe('activate()')
  })
})

describe('wlstForServerAction', () => {
  it('translates each lifecycle action', () => {
    expect(wlstForServerAction('ms1', 'start', CONTEXT)).toContain("start('ms1', 'Server')")
    expect(wlstForServerAction('ms1', 'suspend', CONTEXT)).toContain("suspend('ms1', 'Server')")
    expect(wlstForServerAction('ms1', 'resume', CONTEXT)).toContain("resume('ms1', 'Server')")
  })

  it('distinguishes a graceful shutdown from a forced one', () => {
    expect(wlstForServerAction('ms1', 'shutdown', CONTEXT)).toContain("ignoreSessions='false'")
    const forced = wlstForServerAction('ms1', 'forceShutdown', CONTEXT)
    expect(forced).toContain("force='true'")
    expect(forced).toContain("ignoreSessions='true'")
  })

  it('says so rather than inventing a command it has no equivalent for', () => {
    expect(wlstForServerAction('ms1', 'restartSSL', CONTEXT)).toContain('has no direct WLST equivalent')
  })
})

describe('wlstForDeploy and wlstForUndeploy', () => {
  it('names the archive, its targets, its staging mode and its plan', () => {
    const out = wlstForDeploy(
      { name: 'myapp', path: '/tmp/myapp.war', targets: ['cluster1'], stagingMode: 'nostage', plan: '/tmp/plan.xml' },
      CONTEXT,
    )
    expect(out).toContain(
      "deploy('myapp', '/tmp/myapp.war', targets='cluster1', stageMode='nostage', planPath='/tmp/plan.xml')",
    )
  })

  it('leaves a placeholder path when the archive has not been chosen yet', () => {
    expect(wlstForDeploy({ name: 'myapp' }, CONTEXT)).toContain("deploy('myapp', '/path/to/archive')")
  })

  it('joins several targets with commas', () => {
    expect(wlstForDeploy({ name: 'myapp', targets: ['ms1', 'ms2'] }, CONTEXT)).toContain("targets='ms1,ms2'")
  })

  it('undeploys with targets, or from everywhere when none are given', () => {
    expect(wlstForUndeploy('myapp', ['ms1'], CONTEXT)).toContain("undeploy('myapp', targets='ms1')")
    expect(wlstForUndeploy('myapp', [], CONTEXT)).toContain("undeploy('myapp')")
  })
})

describe('wlstForTargets', () => {
  it('writes one assign per target inside a lock', () => {
    const out = wlstForTargets('AppDeployment', 'myapp', ['ms1', 'cluster1'], CONTEXT)
    expect(out).toContain("assign('AppDeployment', 'myapp', 'Target', 'ms1')")
    expect(out).toContain("assign('AppDeployment', 'myapp', 'Target', 'cluster1')")
    expect(out.split('\n')).toContain('startEdit()')
  })

  it('warns rather than silently emitting nothing when no target is selected', () => {
    expect(wlstForTargets('AppDeployment', 'myapp', [], CONTEXT)).toContain('deployed nowhere')
  })
})

describe('curl equivalents', () => {
  it('sends the header WebLogic requires for a state-changing call', () => {
    expect(curlFor('POST', '/edit/servers/ms1', {}, CONTEXT)).toContain("-H 'X-Requested-By: wl-console'")
  })

  it('adds a JSON content type only when there is a body', () => {
    expect(curlFor('POST', '/x', {}, CONTEXT)).toContain("-H 'Content-Type: application/json'")
    expect(curlFor('GET', '/x', undefined, CONTEXT)).not.toContain('Content-Type')
  })

  it('writes the body as JSON on its own line', () => {
    expect(curlFor('POST', '/x', { a: 1 }, CONTEXT)).toContain(`-d '{"a":1}'`)
  })

  it('addresses the REST management API under the console’s base URL', () => {
    expect(curlFor('GET', '/domainConfig', undefined, CONTEXT)).toContain(
      "'http://admin:7001/management/weblogic/latest/domainConfig'",
    )
  })

  it('spells out the three steps of a staged change', () => {
    const out = curlForEdits([{ path: '/edit/servers/ms1', attributes: { listenPort: 7003 } }], CONTEXT)
    expect(out).toContain('/edit/changeManager/startEdit')
    expect(out).toContain('/edit/changeManager/activateChanges')
    expect(out.indexOf('startEdit')).toBeLessThan(out.indexOf('activateChanges'))
  })

  it('escapes a server name in a lifecycle URL', () => {
    expect(curlForServerAction('my server', 'start', CONTEXT)).toContain('serverLifeCycleRuntimes/my%20server/start')
  })

  it('spells a deployment out as multipart parts rather than as a body', () => {
    const out = curlForDeploy({ name: 'myapp', path: '/tmp/a.war', targets: ['servers/ms1'] }, CONTEXT)
    expect(out).toContain('-F "deployment=@/tmp/a.war"')
    expect(out).toContain('"identity":["servers","ms1"]')
  })
})
