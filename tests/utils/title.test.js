import { beforeEach, describe, expect, it } from 'vitest'
import { setTitleBadge, setTitleBase } from '@/utils/title'

beforeEach(() => {
  setTitleBadge(0)
  setTitleBase('')
})

describe('the tab title', () => {
  it('is the console’s name on a page that has none of its own', () => {
    expect(document.title).toBe('WebLogic Console')
  })

  it('puts the page in front of it', () => {
    setTitleBase('Servers')
    expect(document.title).toBe('Servers · WebLogic Console')
  })

  it('puts unread alerts in front of everything, so a background tab can say so', () => {
    setTitleBase('Servers')
    setTitleBadge(3)
    expect(document.title).toBe('(3) Servers · WebLogic Console')
  })

  it('keeps the badge across a navigation', () => {
    setTitleBadge(2)
    setTitleBase('Monitoring')
    expect(document.title).toBe('(2) Monitoring · WebLogic Console')
  })

  it('drops the badge when everything has been read', () => {
    setTitleBadge(2)
    setTitleBadge(0)
    expect(document.title).toBe('WebLogic Console')
  })

  it('shows no badge for a count that is not a number', () => {
    setTitleBadge(undefined)
    expect(document.title).toBe('WebLogic Console')
    setTitleBadge('many')
    expect(document.title).toBe('WebLogic Console')
  })
})
