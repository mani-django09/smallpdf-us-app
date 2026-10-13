// "Advertisement" caption shown above ad slots, in the page's language.
// Uses the shared common.json key so it works on every page (including pages
// that keep their own inline translation objects). t() has no English
// fallback, so a page without messages would print the raw key — guard it.
import { useTranslations } from '../lib/i18n'

export default function AdLabel() {
  const { t } = useTranslations()
  const label = t('ads.label')
  return label === 'ads.label' ? 'Advertisement' : label
}
