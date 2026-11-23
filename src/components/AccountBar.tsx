import { SYNC_ICON, type SyncStatus } from '../game/index.ts'
import { Button } from './Button.tsx'
import { Icon } from './Icon.tsx'
import styles from './AccountBar.module.css'

export interface AccountBarProps {
  /** 登入的人；null 是訪客 */
  user: { name: string; avatarUrl: string | null } | null
  /** 沒給就不顯示登入按鈕（這個版本沒有設定雲端功能） */
  onSignIn?: () => void
  onSignOut?: () => void
  /** 同步狀態；訪客沒有 */
  sync?: SyncStatus
  /** 有給而且狀態是 warn 時，顯示「重試」按鈕 */
  onRetrySync?: () => void
}

/** 主選單右上角的帳號列：訪客標示與登入按鈕，或登入者、同步狀態與登出按鈕 */
export function AccountBar({ user, onSignIn, onSignOut, sync, onRetrySync }: AccountBarProps) {
  if (!user) {
    return (
      <div className={styles.bar}>
        <span className={styles.guest} title={onSignIn ? '紀錄只存在這個瀏覽器，登入後可以存到雲端' : '這個版本沒有開啟登入功能，紀錄只存在這個瀏覽器'}>
          <Icon name="user" /> 訪客
        </span>
        {onSignIn && (
          <Button size="small" onClick={onSignIn}>
            <Icon name="key" /> 登入
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className={styles.bar}>
      {sync && (
        <span className={`${styles.sync} ${styles[sync.tone]}`} role="status">
          <Icon name={SYNC_ICON[sync.tone]} /> {sync.text}
          {sync.tone === 'warn' && onRetrySync && (
            <button type="button" className={styles.retry} onClick={onRetrySync}>
              重試
            </button>
          )}
        </span>
      )}
      <span className={styles.user}>
        {user.avatarUrl ? <img className={styles.avatar} src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <Icon name="paw" tone="pink" />}
        <span className={styles.name}>{user.name}</span>
      </span>
      <Button variant="ghost" size="small" onClick={onSignOut}>
        登出
      </Button>
    </div>
  )
}
