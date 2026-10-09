import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const site = 'https://cosscoll.github.io/Cosme-Collomb/'
const marker = 'PORTFOLIO-NATIVE-POST-' + Date.now()
const redirect = site + '?native-submit-check=' + encodeURIComponent(marker) + '#/contact'
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--disable-gpu-sandbox']
})

try {
  const page = await browser.newPage()
  page.on('console', m => { if (m.type() === 'error') console.log('BROWSER_CONSOLE', m.text().slice(0, 250)) })
  page.on('response', r => {
    if (r.url().startsWith('https://api.web3forms.com/submit')) {
      console.log('WEB3FORMS_NATIVE_RESPONSE', r.status(),
        JSON.stringify({ location: r.headers()['location'] || null, contentType:r.headers()['content-type'] || null }))
    }
  })
  await page.goto(site + '#/contact', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('form[data-service="web3forms"]').waitFor({timeout:45000})
  console.log('NATIVE_POST_TEST_SUBJECT',marker)
  await page.evaluate(({marker,redirect}) => {
    const source = document.querySelector('form[data-service="web3forms"]')
    const access = source.querySelector('[name="access_key"]')?.value
    if (!access) throw new Error('Live form lacks access key')
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = 'https://api.web3forms.com/submit'
    for (const [name,value] of Object.entries({
      access_key: access,
      name: 'Contrôle technique formulaire',
      email: 'pro.collomb@gmail.com',
      subject: marker,
      message: 'Essai automatisé de soumission HTML native depuis le portfolio public. Référence : ' + marker,
      redirect: redirect,
      from_name: 'Portfolio Cosme Collomb'
    })) {
      const input=document.createElement('input')
      input.type='hidden'
      input.name=name
      input.value=value
      form.appendChild(input)
    }
    document.body.appendChild(form)
    form.submit()
  }, {marker,redirect})
  try {
    await page.waitForURL(url => url.href.includes('native-submit-check='), {timeout:45000})
  } catch {
    console.log('NATIVE_FINAL_URL',page.url())
    console.log('NATIVE_BODY_PREVIEW',(await page.locator('body').innerText().catch(()=>'' )).slice(0,700))
    throw new Error('Native form did not return to the successful redirect URL')
  }
  assert.ok(page.url().includes('native-submit-check='))
  console.log('NATIVE_SUBMISSION_SUCCESS_REDIRECT',marker)
} finally {
  await browser.close()
}
