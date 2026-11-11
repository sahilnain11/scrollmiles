import { distanceLabel, durationLabel } from '../analytics/metrics';
import type { DayStats } from '../types';

/** Local, self-contained drawing: no page content, fonts, or remote assets. */
export async function exportCard(stats: DayStats, weekly = false): Promise<void> {
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
  context.fillText(weekly ? 'MY LAST SEVEN DAYS, IN SCROLLING' : 'MY DAY, IN SCROLLING', 80, 245);
  const distance = distanceLabel(stats.distancePx);
  context.font = 'bold 160px system-ui, sans-serif';
  context.fillText(`${distance.value} ${distance.unit}`, 70, 450);
  context.font = 'bold 56px system-ui, sans-serif';
  context.fillText('Tiny scrolls. Quite a journey.', 80, 555);
  context.font = '28px system-ui, sans-serif';
  context.fillText('Estimated screen-equivalent distance', 80, 620);
  context.fillStyle = '#203521';
  context.fillRect(80, 760, 1040, 2);
  context.font = 'bold 48px system-ui, sans-serif';
  context.fillText(stats.actions.toLocaleString(), 80, 850);
  context.fillText(durationLabel(stats.activeMs), 620, 850);
  context.font = '26px system-ui, sans-serif';
  context.fillText('scroll bursts', 80, 900);
  context.fillText('active scrolling', 620, 900);
  context.font = '24px system-ui, sans-serif';
  context.fillText('Your digital life, measured.', 80, 1085);
  context.fillText('Private by default. Just for fun.', 80, 1125);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error('Could not export the image.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `scrollmiles-${weekly ? 'week' : stats.date}.png`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}