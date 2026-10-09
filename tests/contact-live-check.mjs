import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const site = 'https://cosscoll.github.io/Cosme-Collomb/'
const endpoint = 'https://api.web3forms.com/submit'
const marker = 'PORTFOLIO-WEB3FORMS-LIVE-' + Date.now()
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitForPublishedForm() {
  let lastError
  for (let attempt = 1; attempt <= 36; attempt++) {
    try {
      const res = await fetch(site + '?live-form-check=' + Date.now(),
        { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(12000) })
      assert.equal(res.status, 200)
      const html = await res.text()
      const asset = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
      assert.ok(asset, 'Published website has no JavaScript entrypoint')
      const jsRes = await fetch(new URL(asset, site),
        { signal: AbortSignal.timeout(12000) })
      assert.equal(jsRes.status, 200)
      const js = await jsRes.text()
      assert.ok(js.includes('api.web3forms.com/submit'),
        'Public website still serves a previous form integration')
      assert.ok(js.includes('data-service'),
        'Public JS is missing the form test marker')
      console.log('Verified PUBLIC bundle includes Web3Forms at', asset)
      return
    } catch (error) {
      lastError = error
      console.log('Waiting for latest published form', attempt, error.message)
      await pause(10000)
    }
  }
  throw new Error('Latest form not available on public GitHub Pages: ' + lastError?.message)
}

await waitForPublishedForm()

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage', '--disable-gpu-sandbox']
})

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.on('pageerror', error => console.error('Browser JS error:', error.message))
  page.on('requestfailed', request => {
    if (request.url().startsWith(endpoint))
      console.error('Web3Forms request failed:', request.failure()?.errorText)
  })
  let apiResponse = null
  page.on('response', async response => {
    if (response.url().startsWith(endpoint)) {
      const body = await response.text().catch(() => '(unreadable)')
      apiResponse = { status: response.status(), body: body.slice(0, 600) }
      console.log('WEB3FORMS_API_RESPONSE', JSON.stringify(apiResponse))
    }
  })

  await page.goto(site + '?run=' + Date.now() + '#/contact',
    { waitUntil: 'domcontentloaded', timeout: 60000 })
  const form = page.locator('form[data-service="web3forms"]')
  await form.waitFor({ state: 'visible', timeout: 60000 })
  assert.equal(await form.locator('input[name="access_key"]').count(), 1)
  assert.equal(await form.locator('input[name="botcheck"]').count(), 1)
  console.log('Verified public contact form and spam trap; test subject:', marker)

  await form.locator('input[name="name"]').fill('Contrôle technique portfolio')
  await form.locator('input[name="email"]').fill('pro.collomb@gmail.com')
  await form.locator('input[name="subject"]').fill(marker)
  await form.locator('textarea[name="message"]').fill(
    'Message de contrôle technique automatisé envoyé depuis le véritable formulaire GitHub Pages. Référence : ' + marker)
  await form.locator('button[type="submit"]').click()
  const status = form.locator('[role="status"]')
  await page.waitForFunction(() => {
    const text = document.querySelector('form[data-service="web3forms"] [role="status"]')?.textContent || ''
    return text.includes('Le service a accepté') || text.includes('Envoi non confirmé') ||
      text.includes('Connexion au service')
  }, null, { timeout: 60000 })
  const message = (await status.innerText()).trim()
  console.log('PUBLIC_FORM_RESULT', JSON.stringify({ marker, message, apiResponse }))
  assert.ok(message.includes('Le service a accepté'), 'Public form did not confirm delivery')
  assert.equal(apiResponse?.status, 200, 'Web3Forms did not return HTTP 200')
  assert.ok(JSON.parse(apiResponse.body).success === true, 'Web3Forms did not report success')
  console.log('LIVE FORM SUBMISSION CONFIRMED BY PROVIDER; check Gmail for subject:', marker)
} finally {
  await browser.close()
}
