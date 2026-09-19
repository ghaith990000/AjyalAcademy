import { adminNav } from '@/app/nav'
import { AppShell } from './AppShell'

export function AdminShell() {
  return <AppShell nav={adminNav} role="admin" />
}
