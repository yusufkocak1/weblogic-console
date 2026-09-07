import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/api/config', () => ({
  changeManager: vi.fn(),
  pendingChanges: vi.fn(),
  startEdit: vi.fn(() => Promise.resolve({})),
  activateChanges: vi.fn(() => Promise.resolve({})),
  undoChanges: vi.fn(() => Promise.resolve({})),
  cancelEdit: vi.fn(() => Promise.resolve({})),
  updateMBean: vi.fn(() => Promise.resolve({})),
}))

import * as config from '@/api/config'
import { useChangesStore } from '@/stores/changes'

const forbidden = () => Object.assign(new Error('nope'), { isForbidden: true, status: 403 })

let store

beforeEach(() => {
  setActivePinia(createPinia())
  store = useChangesStore()
  config.changeManager.mockResolvedValue({ locked: false, hasChanges: false })
  config.pendingChanges.mockResolvedValue(null)
})

describe('reading the lock', () => {
  it('reports who holds it and what is waiting', async () => {
    config.changeManager.mockResolvedValue({
      locked: true,
      lockOwner: 'weblogic',
      hasChanges: true,
      mergeNeeded: false,
    })
    config.pendingChanges.mockResolvedValue({ items: [] })
    await store.refresh()
    expect(store).toMatchObject({ locked: true, lockOwner: 'weblogic', hasChanges: true, loaded: true })
    expect(store.editSessionOpen).toBe(true)
  })

  it('calls an edit session open when changes are waiting even with no lock held', async () => {
    config.changeManager.mockResolvedValue({ locked: false, hasChanges: true })
    config.pendingChanges.mockResolvedValue({ items: [] })
    await store.refresh()
    expect(store.editSessionOpen).toBe(true)
  })

  it('does not ask for the pending list when nothing is pending', async () => {
    await store.refresh()
    expect(config.pendingChanges).not.toHaveBeenCalled()
    expect(store.pendingKnown).toBe(true)
    expect(store.pending).toEqual([])
  })

  it('treats a role that cannot reach the edit tree as an answer, not a failure', async () => {
    config.changeManager.mockRejectedValue(forbidden())
    await expect(store.refresh()).resolves.toBeUndefined()
    expect(store).toMatchObject({ forbidden: true, loaded: true, locked: false })
  })

  it('still throws anything that is not a refusal', async () => {
    config.changeManager.mockRejectedValue(new Error('the AdminServer is gone'))
    await expect(store.refresh()).rejects.toThrow('the AdminServer is gone')
  })

  it('says the pending list is unknown when the release does not expose it', async () => {
    config.changeManager.mockResolvedValue({ locked: true, hasChanges: true })
    config.pendingChanges.mockResolvedValue(null)
    await store.refresh()
    expect(store.pendingKnown).toBe(false)
    expect(store.pending).toEqual([])
  })
})

describe('describing a pending change', () => {
  const describeOne = async (change) => {
    config.changeManager.mockResolvedValue({ locked: true, hasChanges: true })
    config.pendingChanges.mockResolvedValue({ items: [change] })
    await store.refresh()
    return store.pending[0]
  }

  it('names the attribute and the MBean it is on', async () => {
    expect(
      await describeOne({
        property: 'MaxThreads',
        mbean: 'com.bea:Name=ms1,Type=Server',
        oldValue: 10,
        newValue: 20,
      }),
    ).toEqual({ text: 'MaxThreads on ms1', detail: 'modify: 10 → 20' })
  })

  it('reads the alternative spellings other releases use', async () => {
    expect(await describeOne({ attribute: 'Enabled', mBean: 'Name=ssl1', old: false, new: true })).toMatchObject({
      text: 'Enabled on ssl1',
    })
  })

  it('takes the last segment of an identity path when there is no JMX name', async () => {
    expect(await describeOne({ property: 'ListenPort', identity: '/servers/ms1' })).toMatchObject({
      text: 'ListenPort on ms1',
    })
  })

  it('writes an empty side in words rather than leaving a blank', async () => {
    expect((await describeOne({ property: 'Machine', mbean: 'Name=ms1', oldValue: '', newValue: 'm1' })).detail).toBe(
      'modify: (empty) → m1',
    )
  })

  it('names the operation when there are no values to show', async () => {
    expect(await describeOne({ property: 'Server', mbean: 'Name=ms2', operation: 'add' })).toEqual({
      text: 'Server on ms2',
      detail: 'add',
    })
  })

  it('keeps a change it cannot read as JSON rather than dropping it', async () => {
    const out = await describeOne({ something: 'unexpected' })
    expect(out.text).toBe('{"something":"unexpected"}')
  })

  it('passes a change that is already a sentence straight through', async () => {
    expect(await describeOne('Server ms1 was added')).toEqual({ text: 'Server ms1 was added', detail: '' })
  })
})

describe('saving', () => {
  it('takes the lock first when this session does not hold one', async () => {
    await store.save([{ path: '/edit/servers/ms1', attributes: { listenPort: 7003 } }])
    expect(config.startEdit).toHaveBeenCalled()
    expect(config.updateMBean).toHaveBeenCalledWith('/edit/servers/ms1', { listenPort: 7003 })
  })

  it('does not take a lock it already holds', async () => {
    config.changeManager.mockResolvedValue({ locked: true, hasChanges: false })
    await store.save([{ path: '/edit/servers/ms1', attributes: { a: 1 } }])
    expect(config.startEdit).not.toHaveBeenCalled()
  })

  it('writes every edit it was given', async () => {
    await store.save([
      { path: '/edit/servers/ms1', attributes: { a: 1 } },
      { path: '/edit/servers/ms2', attributes: { b: 2 } },
    ])
    expect(config.updateMBean).toHaveBeenCalledTimes(2)
  })

  it('re-reads the bar after a partial failure, since earlier writes are pending', async () => {
    config.updateMBean.mockRejectedValueOnce(new Error('refused'))
    await expect(store.save([{ path: '/edit/servers/ms1', attributes: { a: 1 } }])).rejects.toThrow('refused')
    expect(store.busy).toBe('')
    // Once before the write and once after the failure.
    expect(config.changeManager).toHaveBeenCalledTimes(2)
  })

  it('leaves the buttons usable even when the re-read itself fails', async () => {
    config.changeManager.mockResolvedValueOnce({ locked: false, hasChanges: false })
    config.changeManager.mockRejectedValueOnce(new Error('gone'))
    await store.save([])
    expect(store.busy).toBe('')
  })
})

describe('activating and discarding', () => {
  it('activates and then re-reads', async () => {
    await store.activate()
    expect(config.activateChanges).toHaveBeenCalled()
    expect(store.busy).toBe('')
  })

  it('throws away the pending set and releases the lock', async () => {
    config.changeManager.mockResolvedValue({ locked: true, hasChanges: true })
    config.pendingChanges.mockResolvedValue({ items: [] })
    await store.refresh()
    await store.discard()
    expect(config.undoChanges).toHaveBeenCalled()
    expect(config.cancelEdit).toHaveBeenCalled()
  })

  it('does not undo a pending set that does not exist, but still releases the lock', async () => {
    await store.refresh()
    await store.discard()
    expect(config.undoChanges).not.toHaveBeenCalled()
    expect(config.cancelEdit).toHaveBeenCalled()
  })

  it('does not report a lock that had already timed out as a failure', async () => {
    config.cancelEdit.mockRejectedValueOnce(new Error('no edit session'))
    await expect(store.discard()).resolves.toBeUndefined()
  })
})

describe('switching domains', () => {
  it('forgets everything the old domain said', async () => {
    config.changeManager.mockResolvedValue({ locked: true, lockOwner: 'weblogic', hasChanges: true })
    config.pendingChanges.mockResolvedValue({ items: ['a change'] })
    await store.refresh()
    store.reset()
    expect(store).toMatchObject({ locked: false, lockOwner: '', hasChanges: false, loaded: false, pending: [] })
  })
})
