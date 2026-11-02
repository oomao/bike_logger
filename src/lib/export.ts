import { getDb, memberName, type Ride } from './store';
import { xmlEsc } from './format';

// TCX 可以手動上傳到 Strava
export function toTcx(r: Ride): string {
  const iso = (ms: number) => new Date(ms).toISOString();
  const pts = r.samples
    .map(([t, p, c, s, hr, dist]) =>
      '<Trackpoint><Time>' + iso(r.start + t * 1000) + '</Time>' +
      '<DistanceMeters>' + (dist || 0) + '</DistanceMeters>' +
      (hr ? '<HeartRateBpm><Value>' + Math.round(hr) + '</Value></HeartRateBpm>' : '') +
      (c != null ? '<Cadence>' + Math.min(254, Math.round(c)) + '</Cadence>' : '') +
      '<Extensions><ns3:TPX>' +
      (s != null ? '<ns3:Speed>' + (s / 3.6).toFixed(2) + '</ns3:Speed>' : '') +
      (p != null ? '<ns3:Watts>' + Math.round(p) + '</ns3:Watts>' : '') +
      '</ns3:TPX></Extensions></Trackpoint>')
    .join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">\n' +
    '<Activities><Activity Sport="Biking"><Id>' + iso(r.start) + '</Id>\n' +
    '<Lap StartTime="' + iso(r.start) + '"><TotalTimeSeconds>' + r.duration + '</TotalTimeSeconds><DistanceMeters>' + r.distance + '</DistanceMeters>' +
    '<Calories>' + Math.min(65535, r.kcal) + '</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod>\n<Track>\n' + pts + '\n</Track></Lap>\n' +
    '<Notes>家庭飛輪紀錄 - ' + xmlEsc(memberName(r.memberId)) + '</Notes></Activity></Activities></TrainingCenterDatabase>\n';
}

export function tcxName(r: Ride) {
  return 'ride-' + memberName(r.memberId) + '-' + new Date(r.start).toISOString().slice(0, 16).replace(/[:T]/g, '') + '.tcx';
}

export function toCsv(): string {
  const head = ['日期', '家人', '時間(分)', '距離(km)', '卡路里', '平均功率W', '最大功率W', '平均踏頻rpm', '平均速度km/h', '平均心率', '平均阻力'];
  const q = (v: unknown) => (v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const lines = getDb().rides
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((r) => [
      new Date(r.start).toLocaleString('zh-TW', { hour12: false }), memberName(r.memberId), (r.duration / 60).toFixed(1),
      (r.distance / 1000).toFixed(2), r.kcal, r.avgPower, r.maxPower, r.avgCadence, r.avgSpeed, r.avgHr, r.avgResistance,
    ].map(q).join(','));
  return '﻿' + [head.join(',')].concat(lines).join('\n');
}
