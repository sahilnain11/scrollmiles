import { distanceLabel } from '../analytics/metrics';
import { siteScrollTime } from '../analytics/sites';
import { wrappedDateLabel, type WrappedCard } from './model';

/** Local, self-contained drawing: no page content, fonts, or remote assets. */
export async function renderCard(card: WrappedCard): Promise<Blob> {
  const { stats } = card;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not create the share card.');
  const gradient = context.createLinearGradient(0, 0, 1200, 1200);
  gradient.addColorStop(0, '#d4f88b');
  gradient.addColorStop(1, '#a9db75');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 1200);
  context.strokeStyle = '#20452b22';
  context.lineWidth = 2;
  for (let radius = 150; radius < 1000; radius += 90) {
    context.beginPath();
    context.ellipse(1050, 420, radius, radius * 0.65, -0.5, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = '#203521';
  context.font = 'bold 42px system-ui, sans-serif';
  context.fillText('↟ ScrollMiles', 80, 110);
  context.font = '24px system-ui, sans-serif';
  context.fillText(card.period === 'week' ? 'MY LAST SEVEN DAYS, IN SCROLLING' : 'MY DAY, IN SCROLLING', 80, 220);
  context.font = '26px system-ui, sans-serif';
  context.fillText(wrappedDateLabel(card), 80, 270);
  const distance = distanceLabel(stats.distancePx);
  const distanceText = `${distance.value} ${distance.unit}`;
  let fontSize = 160;
  context.font = `bold ${fontSize}px system-ui, sans-serif`;
  while (context.measureText(distanceText).width > 1040 && fontSize > 48) {
    fontSize -= 4;
    context.font = `bold ${fontSize}px system-ui, sans-serif`;
  }
  context.fillText(distanceText, 70, 450);
  context.font = 'bold 56px system-ui, sans-serif';
  context.fillText('Tiny scrolls. Quite a journey.', 80, 555);
  context.font = '28px system-ui, sans-serif';
  context.fillText('Estimated screen-equivalent distance', 80, 620);
  context.fillStyle = '#203521';
  context.fillRect(80, 760, 1040, 2);
  context.font = 'bold 48px system-ui, sans-serif';
  context.fillText(stats.actions.toLocaleString(), 80, 850);
  context.fillText(siteScrollTime(stats.activeMs), 620, 850);
  context.font = '26px system-ui, sans-serif';
  context.fillText('scroll bursts', 80, 900);
  context.fillText('active scrolling', 620, 900);
  context.font = '24px system-ui, sans-serif';
  context.fillText('Your digital life, measured.', 80, 1085);
  context.fillText('Private by default. Just for fun.', 80, 1125);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error('Could not export the image.')), 'image/png'));
}

/** Downloads the already-rendered preview URL, never re-renders newer totals. */
export function downloadCard(url: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}