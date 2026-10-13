// Hand files picked on one page (the homepage hero) to a tool page's own
// <input type="file">, so the tool runs its normal validation + upload flow.
//
// Every tool index page uses a plain <input type="file" onChange={...}>, so
// instead of teaching 27 pages a new API we navigate there, wait for the
// input to mount, put the files on it via DataTransfer and fire a bubbling
// "change" event, which React's onChange picks up exactly like a real pick.

function acceptsFile(accept, file) {
  if (!accept) return true
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((a) => {
    if (a.startsWith('.')) return name.endsWith(a)
    if (a.endsWith('/*')) return type.startsWith(a.slice(0, -1))
    return type === a
  })
}

function injectInto(input, files) {
  let usable = files.filter((f) => acceptsFile(input.accept, f))
  if (!usable.length) usable = files // let the tool show its own "wrong type" message
  if (!input.multiple) usable = usable.slice(0, 1)
  const dt = new DataTransfer()
  usable.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

// Poll for the tool page's file input for up to ~4s after navigation.
function waitForInput(done) {
  const started = Date.now()
  const tick = () => {
    const input = document.querySelector('input[type="file"]')
    if (input) return done(input)
    if (Date.now() - started < 4000) requestAnimationFrame(tick)
  }
  tick()
}

// router: the object from useLocalizedRouter() (push takes an English path).
export function openToolWithFiles(router, enPath, fileList) {
  const files = Array.from(fileList || [])
  if (!files.length || typeof window === 'undefined') {
    router.push(enPath)
    return
  }
  const events = router.events
  const onDone = () => {
    events.off('routeChangeComplete', onDone)
    waitForInput((input) => injectInto(input, files))
  }
  events.on('routeChangeComplete', onDone)
  router.push(enPath).catch(() => events.off('routeChangeComplete', onDone))
}
