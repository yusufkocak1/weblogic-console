import { useConnectionStore } from '@/stores/connection'
import { useUiStore } from '@/stores/ui'
import { t } from '@/i18n'

/**
 * Brings a saved profile back to life. Everything but the password is on file,
 * so the PasswordPrompt collects that one field and the error, if any, is shown
 * inside the prompt rather than as a toast the user has to connect back to the
 * dialog they were just in.
 *
 * @param {import('vue').Ref} promptRef ref to a PasswordPrompt component
 */
export function useReconnect(promptRef) {
  const connection = useConnectionStore()
  const ui = useUiStore()

  return async function reconnect(profile) {
    const answer = await promptRef.value?.ask(profile)
    if (!answer) return false
    try {
      await connection.connect({ ...profile, password: answer.password })
      answer.done()
      ui.success(t('Connected'), t('Now working on {name}.', { name: profile.name }))
      return true
    } catch (err) {
      answer.fail(err)
      return false
    }
  }
}
