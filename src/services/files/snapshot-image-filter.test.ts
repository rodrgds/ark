import { describe, expect, test } from 'bun:test';
import { filterSnapshotChrome } from '@/services/files/snapshot-image-filter';

const BASE_URL = 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage';

describe('filterSnapshotChrome', () => {
  test('drops the FoodSafety.gov print icon and keeps article content', () => {
    const html = `
      <main>
        <p>Refrigerator: keep at 40 &deg;F or below.</p>
        <p><img src="/sites/default/files/2024-03/icon-printthis.png" alt="Print" width="16" height="16" class="icon-printthis" /></p>
        <p>Freezer: 0 &deg;F keeps food safe.</p>
        <p><img src="/sites/default/files/styles/large/public/2024-05/fridge-thermometer.jpg" alt="Refrigerator thermometer" width="640" height="480" /></p>
      </main>
    `;

    const filtered = filterSnapshotChrome(html, BASE_URL);

    expect(filtered).not.toContain('icon-printthis');
    expect(filtered).not.toContain('Print');
    expect(filtered).toContain('fridge-thermometer.jpg');
    expect(filtered).toContain('Refrigerator: keep at 40');
    expect(filtered).toContain('Freezer: 0 &deg;F keeps food safe.');
  });

  test('drops images inside header/nav/footer chrome and chrome-classed images', () => {
    const html = `
      <main>
        <header>
          <a href="/"><img src="/img/logo.png" alt="Logo" width="200" height="60" /></a>
          <nav>
            <a href="/a"><img src="/icons/chevron-right.svg" alt="Next" width="12" height="12" /></a>
          </nav>
        </header>
        <article>
          <p><a href="https://twitter.com/share" class="share-this"><img src="/img/twitter.png" alt="twitter" width="20" height="20" /></a></p>
          <p>Survival instructions.</p>
          <div style="background-image: url('/icons/printthis.png'); padding: 8px;">Print me</div>
          <p><img src="/img/real-chart.png" alt="Power outage chart" width="800" height="600" /></p>
        </article>
        <footer><img src="/img/social-fb.png" alt="facebook" width="24" height="24" /></footer>
      </main>
    `;

    const filtered = filterSnapshotChrome(html, BASE_URL);

    expect(filtered).not.toContain('twitter.png');
    expect(filtered).not.toContain('chevron-right.svg');
    expect(filtered).not.toContain('social-fb.png');
    expect(filtered).not.toContain('logo.png');
    expect(filtered).not.toContain('printthis.png');
    expect(filtered).toContain('real-chart.png');
    expect(filtered).toContain('Survival instructions');
  });

  test('drops images that are too small even when path is benign', () => {
    const html = `
      <main>
        <p><img src="/img/spacer.png" alt="" width="1" height="1" /></p>
        <p><img src="/img/big-photo.png" alt="Photo" width="1024" height="768" /></p>
      </main>
    `;

    const filtered = filterSnapshotChrome(html, BASE_URL);
    expect(filtered).not.toContain('spacer.png');
    expect(filtered).toContain('big-photo.png');
  });

  test('keeps CDC-style featured images with empty alt and role=presentation when not in chrome', () => {
    const html = `
      <main>
        <figure class="dfe-curated-link__image dfe-image__featured">
          <div class="image-container aspect-ratio-fluid">
            <a href="/water-emergency/communication-resources/fact-sheet-wash-your-hands.html" title="Fact Sheet: Wash Your Hands">
              <img src="/water-emergency/media/images/Wash-Your-Hands.JPG" alt="" role="presentation" width="593" height="769" />
            </a>
          </div>
        </figure>
        <h2>Wash your hands</h2>
      </main>
    `;
    const filtered = filterSnapshotChrome(
      html,
      'https://www.cdc.gov/water-emergency/safety/guidelines-for-personal-hygiene-during-an-emergency.html'
    );
    expect(filtered).toContain('Wash-Your-Hands.JPG');
  });

  test('keeps article images with the Ready.gov static path pattern only when non-icon', () => {
    const html = `
      <main>
        <p><img src="/sites/default/files/inline-images/steps.png" alt="Step 1" width="900" height="400" /></p>
        <p><img src="/sites/default/files/2024-03/icons/sprite-share.png" alt="share" width="20" height="20" /></p>
      </main>
    `;

    const filtered = filterSnapshotChrome(html, BASE_URL);
    expect(filtered).toContain('steps.png');
    expect(filtered).not.toContain('sprite-share.png');
  });
});
