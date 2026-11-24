// Runs on smallpdf.us tool pages that the extension opened with ?ext_handoff=1.
// Asks the service worker for the file the user was looking at and drops it
// into the page's own upload input, exactly as if the user had picked it — the
// page then validates, size-checks and uploads it through its normal path.

(function () {
  if (!/[?&]ext_handoff=1\b/.test(location.search)) return

  const MESSAGES = {
    loading: 'Bringing your file over…',
    done: (name) => `Loaded "${name}" from your tab`,
    failed: 'This website did not let us bring the file over. Choose it below instead.',
    tooLarge: 'This file is too big to bring over automatically. Choose it below instead.',
  }

  // ── Small toast, self-contained so it can't clash with the page's CSS ──
  let toast
  function show(text, kind) {
    if (!toast) {
      toast = document.createElement('div')
      toast.setAttribute('role', 'status')
      toast.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
        'z-index:2147483647', 'max-width:min(92vw,460px)', 'padding:12px 16px',
        'border-radius:12px', 'font:600 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif',
        'box-shadow:0 10px 30px rgba(20,19,15,.25)', 'border:2px solid #14130F',
        'transition:opacity .3s',
      ].join(';')
      document.documentElement.appendChild(toast)
    }
    toast.textContent = text
    toast.style.background = kind === 'error' ? '#FFF1F1' : kind === 'ok' ? '#C6F432' : '#FFFFFF'
    toast.style.color = '#14130F'
    toast.style.opacity = '1'
    if (kind !== 'loading') {
      clearTimeout(show.t)
      show.t = setTimeout(() => { toast.style.opacity = '0' }, 4500)
    }
  }

  function fromBase64(b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  // Pick the upload input that accepts this kind of file. Tool pages have one;
  // checking `accept` avoids a stray input elsewhere on the page.
  function findInput(file) {
    const inputs = [...document.querySelectorAll('input[type="file"]')]
    if (!inputs.length) return null
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const ok = inputs.find((el) => {
      const accept = (el.getAttribute('accept') || '').toLowerCase()
      if (!accept) return false
      return accept.split(',').some((a) => {
        a = a.trim()
        return a === '.' + ext || a === file.type || (a.endsWith('/*') && file.type.startsWith(a.slice(0, -1)))
      })
    })
    return ok || inputs[0]
  }

  function waitForInput(file, timeoutMs) {
    return new Promise((resolve) => {
      const start = Date.now()
      ;(function poll() {
        const el = findInput(file)
        // Give React a moment after the input appears so its handlers are attached.
        if (el) return setTimeout(() => resolve(el), 400)
        if (Date.now() - start > timeoutMs) return resolve(null)
        setTimeout(poll, 150)
      })()
    })
  }

  show(MESSAGES.loading, 'loading')

  chrome.runtime.sendMessage({ type: 'get-handoff' }, async (res) => {
    if (chrome.runtime.lastError || !res || res.none) {
      if (toast) toast.style.opacity = '0'
      return
    }
    if (res.error) {
      show(res.error === 'too_large' ? MESSAGES.tooLarge : MESSAGES.failed, 'error')
      return
    }

    const file = new File([fromBase64(res.data)], res.name, { type: res.type || '' })
    const input = await waitForInput(file, 15000)
    if (!input) {
      show(MESSAGES.failed, 'error')
      return
    }

    const dt = new DataTransfer()
    dt.items.add(file)
    input.files = dt.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    show(MESSAGES.done(file.name), 'ok')
    // The URL keeps ?ext_handoff=1 on purpose: rewriting it would fight the
    // site's router. A reload simply finds nothing pending and stays quiet.
  })
})()
