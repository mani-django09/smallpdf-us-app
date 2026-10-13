// Navigate to a tool's download page with a FULL page load instead of router.push.
//
// Why: AdSense counts one page view per document load and its vignette (full-screen)
// ads only trigger on real navigations — with client-side routing the whole
// tool → preview → download flow counted as a single page view and vignettes never
// showed. Everything the download pages need is in the URL or sessionStorage, both of
// which survive a reload.
import { localePath } from './route-translations'

export function goToDownload(router, enPath) {
  if (typeof window === 'undefined') return router.push(enPath)
  let url = localePath(enPath, router.locale || 'en')
  // trailingSlash: true — add it ourselves so the browser doesn't take an extra 308 hop
  const q = url.indexOf('?')
  const path = q === -1 ? url : url.slice(0, q)
  if (!path.endsWith('/')) url = path + '/' + (q === -1 ? '' : url.slice(q))
  window.location.assign(url)
}
