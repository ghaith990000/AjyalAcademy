import { formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'

/** An amount in BD/د.ب from integer fils. `<bdi>` keeps the number and unit together inside RTL text. */
export function Money({ fils }: { fils: number }) {
  const { language } = useLanguage()
  return <bdi>{formatBHD(fils, language)}</bdi>
}
