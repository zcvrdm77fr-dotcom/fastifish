import { test, expect } from '@playwright/test';

test('winter mode saves a hole and its catch locally and reopens the journal offline', async ({ page, context }, testInfo) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 61.4947, longitude: 23.7384 });
  await page.addInitScript(device => {
    localStorage.setItem('device_view', device);
    if (!localStorage.getItem('user_language')) localStorage.setItem('user_language', 'fi');
  }, testInfo.project.name.startsWith('mobile') ? 'phone' : 'desktop');
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());

  await page.goto('/');
  await page.getByRole('link', { name: 'Pilkkitila' }).click();
  await expect(page.getByRole('heading', { name: 'Pilkkitila', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reikäkartta', exact: true }).click();
  await page.getByRole('button', { name: 'Merkitse GPS:llä' }).click();
  const hole = page.getByRole('dialog', { name: 'Uusi reikä' });
  await expect(hole.getByText('61.49470°, 23.73840°')).toBeVisible();
  await hole.getByLabel('Reiän nimi').fill('Kaislikon reuna');
  await hole.getByLabel('Veden syvyys (m)').fill('4.6');
  await hole.getByLabel('Oma jäämittaus (cm)').fill('0');
  await hole.getByRole('button', { name: 'Tallenna reikä' }).click();
  const entry = page.getByRole('article').filter({ hasText: 'Kaislikon reuna' });
  await expect(entry.getByText(/4,6 m/)).toBeVisible();
  await expect(entry.getByText(/Mitattu 0 cm/)).toBeVisible();

  await entry.getByRole('button', { name: 'Kirjaa saalis' }).click();
  const journal = page.getByRole('dialog', { name: 'Uusi saalis' });
  await expect(journal.getByLabel('Reikä').locator('option:checked')).toHaveText('Kaislikon reuna');
  await journal.getByLabel('Määrä').fill('2');
  await journal.getByLabel('Pisin kala (cm)').fill('28');
  await journal.getByLabel('Pilkkiviehe').fill('Morripilkki');
  await journal.getByRole('button', { name: 'Tallenna saalis' }).click();

  await page.getByRole('link', { name: 'Päiväkirja' }).click();
  await expect(page.getByRole('heading', { name: 'Ahven × 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { name: 'Perch × 2' })).toBeVisible();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reachedNetwork = await page.evaluate(async () => {
    try {
      await fetch('/llms.txt?ice-offline-check=1', { cache: 'no-store' });
      return true;
    } catch {
      return false;
    }
  });
  expect(reachedNetwork).toBe(false);
  await expect(page.getByRole('heading', { name: 'Perch × 2' })).toBeVisible();
  await expect(page.getByText(/Kaislikon reuna · Morripilkki/)).toBeVisible();
  await page.getByRole('link', { name: 'Hole map', exact: true }).click();
  await expect(page.getByRole('heading', { name: '1 · Kaislikon reuna' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  page.once('dialog', prompt => prompt.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(/No holes yet/)).toBeVisible();
  await page.getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(page.getByText(/Kaislikon reuna · Morripilkki/)).toBeVisible();
});

test('winter forecast handles missing fields and unresolved towns while keeping ice reports separate', async ({ page }) => {
  const validTime = new Date().toISOString();
  const reading = (field, value) => `
    <f:BsWfsElement><g:pos>61.49911 23.78712</g:pos><f:Time>${validTime}</f:Time>
    <f:ParameterName>${field}</f:ParameterName><f:ParameterValue>${value}</f:ParameterValue></f:BsWfsElement>`;
  await page.route('https://opendata.fmi.fi/wfs?**', async route => {
    const place = new URL(route.request().url()).searchParams.get('place');
    if (place !== 'Tampere') {
      await route.fulfill({ status: 400, body: '<ExceptionText>No locations found for the place</ExceptionText>' });
      return;
    }
    await route.fulfill({
      contentType: 'application/xml',
      body: `<root xmlns:f="http://xml.fmi.fi/schema/wfs/2.0" xmlns:g="http://www.opengis.net/gml/3.2">${reading('Temperature', -6)}${reading('FeelsLike', -9)}${reading('WindSpeedMS', 3)}${reading('TotalCloudCover', 60)}${reading('WindGust', 'NaN')}</root>`
    });
  });
  await page.goto('/pilkki.html');
  await page.getByLabel('Paikkakunta').fill('Tampere');
  await page.getByRole('button', { name: 'Hae', exact: true }).click();
  await expect(page.getByText('Tampere', { exact: true })).toBeVisible();
  await expect(page.getByText('−6 °C', { exact: true })).toBeVisible();
  const score = page.getByRole('region', { name: 'Kelimittari' });
  await expect(score.getByText('/ 100', { exact: true })).toBeVisible();
  await score.getByLabel('Kohdekala').selectOption('burbot');
  await score.getByText('Tuntikohtaiset kelipisteet').click();
  await expect(score.getByRole('meter')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Pilkkikeli' }).getByText('—', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Järvien jäätilanne/ })).toHaveAttribute('href', 'https://www.vesi.fi/jaatilanne/');
  await page.getByLabel('Paikkakunta').fill('tuntematon');
  await page.getByRole('button', { name: 'Hae', exact: true }).click();
  await expect(page.getByText(/Paikkakuntaa ei löytynyt/)).toBeVisible();
  await expect(page.getByText('−6 °C', { exact: true })).toBeHidden();
});

test('depth layers switch on the hole map and a lake depth lookup uses the selected point', async ({ page }) => {
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYt8AAAAASUVORK5CYII=', 'base64');
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
  await page.route('https://paikkatiedot.ymparisto.fi/geoserver/inspire_el/wms?**', route => {
    if (new URL(route.request().url()).searchParams.get('request') === 'GetFeatureInfo') {
      return route.fulfill({ json: { features: [{ properties: { syvyysvali_m: '3-6' } }] } });
    }
    return route.fulfill({ contentType: 'image/png', body: pixel });
  });
  await page.route('https://ows.emodnet-bathymetry.eu/wms?**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
  await page.goto('/pilkki.html#kartta');
  await expect(page.getByText('Lähennä karttaa nähdäksesi syvyystason.')).toBeVisible();
  await page.route('https://opendata.fmi.fi/wfs?**', route => route.fulfill({
    contentType: 'application/xml',
    body: `<root xmlns:f="http://xml.fmi.fi/schema/wfs/2.0" xmlns:g="http://www.opengis.net/gml/3.2">
      <f:BsWfsElement><g:pos>61.4225 23.0345</g:pos><f:Time>${new Date().toISOString()}</f:Time>
      <f:ParameterName>Temperature</f:ParameterName><f:ParameterValue>-5</f:ParameterValue></f:BsWfsElement>
    </root>`
  }));
  await page.getByRole('link', { name: 'Suunnittele', exact: true }).click();
  await page.getByLabel('Paikkakunta').fill('Sastamala');
  await page.getByRole('button', { name: 'Hae', exact: true }).click();
  await expect(page.getByText('−5 °C', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reikäkartta', exact: true }).click();
  await page.getByRole('button', { name: 'Syvyys kartan pisteessä' }).click();
  await expect(page.getByText('Kartta-aineiston syvyysväli 3–6 m')).toBeVisible();
  const sea = page.waitForRequest(request => request.url().includes('ows.emodnet-bathymetry.eu/wms'));
  await page.getByLabel('Karttataso').selectOption('sea');
  await sea;
  await expect(page.getByText(/EMODnetin merisyvyydet/)).toBeVisible();
  await expect(page.getByText(/Kartta-aineiston syvyysväli/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Suuri kartta' }).click();
  await expect(page.getByRole('button', { name: 'Suuri kartta' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Suuri kartta' })).toHaveAttribute('aria-pressed', 'false');
});
