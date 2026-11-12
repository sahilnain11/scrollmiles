import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { describe, expect, it } from 'vitest';

// Run the actual pure metrics module in isolated Node processes whose timezone
// is set before startup. Do not change the user's OS clock/timezone or rely on
// worker-thread process.env.TZ mutations taking effect.
const source = readFileSync(new URL('../src/analytics/metrics.ts', import.meta.url), 'utf8');
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
const insightSource = readFileSync(new URL('../src/analytics/insights.ts', import.meta.url), 'utf8');
const insightCompiled = transpileModule(insightSource, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText
  .replace("'./metrics'", JSON.stringify(moduleUrl));
const insightUrl = `data:text/javascript;base64,${Buffer.from(insightCompiled).toString('base64')}`;
const historySource = readFileSync(new URL('../src/analytics/history.ts', import.meta.url), 'utf8');
const historyCompiled = transpileModule(historySource, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText
  .replace("'./metrics'", JSON.stringify(moduleUrl));
const historyUrl = `data:text/javascript;base64,${Buffer.from(historyCompiled).toString('base64')}`;

function dates(zone: string, instants: string[]) {
  const script = `const {localDate,daysAgo,lastSevenDays}=await import(${JSON.stringify(moduleUrl)});
    const values=${JSON.stringify(instants)}.map(value=>{
      const date=new Date(value);
      return {day:localDate(date),previous:daysAgo(1,date),offset:date.getTimezoneOffset(),week:lastSevenDays([],date).map(day=>day.date)};
    });console.log(JSON.stringify(values));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: zone }, encoding: 'utf8',
  })) as { day: string; previous: string; offset: number; week: string[] }[];
}

describe('isolated timezone and DST calendar checks', () => {
  it('builds calendar months and retained records across DST with one anchored local-date window', () => {
    for (const zone of ['America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
      const script = `const {monthlySummary,retainedRecords}=await import(${JSON.stringify(historyUrl)});
        const {daysAgo,localDate}=await import(${JSON.stringify(moduleUrl)});
        const result=['2026-03-31T09:00:00Z','2026-11-30T09:00:00Z'].map(value=>{
          const now=new Date(value);const history={startDate:daysAgo(89,now),endDate:localDate(now),days:Array.from({length:90},(_,i)=>({date:daysAgo(i,now),distancePx:1,actions:1,activeMs:0}))};
          const month=monthlySummary(history,history.endDate.slice(0,7));return{days:month.days.length,unique:new Set(month.days.map(day=>day.date)).size,saved:month.savedDays,past:retainedRecords(history).pastSavedDays};
        });console.log(JSON.stringify(result));`;
      const results = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' })) as { days: number; unique: number; saved: number; past: number }[];
      expect(results).toEqual([{ days: 31, unique: 31, saved: 31, past: 89 }, { days: 30, unique: 30, saved: 30, past: 89 }]);
    }
  });
  it('keeps 14 distinct completed comparison dates across DST and timezones', () => {
    for (const zone of ['America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati']) {
      const script = `const {compareCompleteWeeks}=await import(${JSON.stringify(insightUrl)});
        const {daysAgo}=await import(${JSON.stringify(moduleUrl)});
        const results=['2026-03-09T12:00:00Z','2026-11-02T12:00:00Z'].map(value=>{
          const now=new Date(value); const days=Array.from({length:14},(_,index)=>({date:daysAgo(index+1,now),distancePx:1,actions:1,activeMs:0}));
          const result=compareCompleteWeeks(days,now);return {state:result.state,current:result.current,previous:result.previous,unique:new Set(days.map(day=>day.date)).size};
        });console.log(JSON.stringify(results));`;
      const results = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ: zone }, encoding: 'utf8' })) as { state: string; unique: number; current: { recordedDays: number }; previous: { recordedDays: number } }[];
      for (const result of results) expect(result).toMatchObject({ state: 'ready', unique: 14, current: { recordedDays: 7 }, previous: { recordedDays: 7 } });
    }
  });
  it('keeps the same day and seven distinct dates across spring-forward', () => {
    const results = dates('America/New_York', ['2026-03-08T06:59:59Z', '2026-03-08T07:00:01Z']);
    expect(results.map(({ day }) => day)).toEqual(['2026-03-08', '2026-03-08']);
    expect(results.map(({ offset }) => offset)).toEqual([300, 240]);
    expect(results.map(({ previous }) => previous)).toEqual(['2026-03-07', '2026-03-07']);
    for (const result of results) expect(new Set(result.week).size).toBe(7);
  });

  it('does not duplicate a calendar day when fall-back repeats 01:30', () => {
    const results = dates('America/New_York', ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']);
    expect(results.map(({ day }) => day)).toEqual(['2026-11-01', '2026-11-01']);
    expect(results.map(({ offset }) => offset)).toEqual([240, 300]);
    expect(results[0]?.week).toEqual(results[1]?.week);
    expect(results[0]?.week[0]).toBe('2026-10-26');
  });

  it('groups the same instant by local date, including zones on different days', () => {
    const instant = ['2026-11-11T00:30:00Z'];
    expect(dates('America/Los_Angeles', instant)[0]?.day).toBe('2026-11-10');
    expect(dates('Asia/Kolkata', instant)[0]?.day).toBe('2026-11-11');
    expect(dates('Pacific/Kiritimati', instant)[0]?.day).toBe('2026-11-11');
  });
});