import { currencyLabel, formatBDAmount, formatBHD } from '@/lib/money'
import { useLanguage } from '@/lib/useLanguage'

/**
 * An amount in BD/د.ب from integer fils. `<bdi>` keeps the number and unit together inside RTL text. A negative
 * amount (a loss) puts its number in a left-to-right island: in an Arabic run the minus sign would otherwise end
 * up after the digits.
 */
export function Money({ fils }: { fils: number }) {
  const { language } = useLanguage()
  if (fils < 0) {
    return (
      <bdi>
        <bdi dir="ltr">{formatBDAmount(fils)}</bdi> {currencyLabel(language)}
      </bdi>
    )
  }
  return <bdi>{formatBHD(fils, language)}</bdi>
}
