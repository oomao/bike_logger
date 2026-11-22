// node --experimental-strip-types scripts/test-fitness.ts
import { insight, point, weightAt, wkgLevel } from '../src/lib/fitness.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`));
};
const W: [number, number][] = [[100, 70], [200, 68], [300, 66]];
eq('weightAt before first', weightAt(W, 50), null);
eq('weightAt middle', weightAt(W, 250), 68);
eq('weightAt after last', weightAt(W, 999), 66);
eq('no weights', weightAt(undefined, 10), null);
eq('point', point(150, 75), { ftp: 150, kg: 75, wkg: 2 });
eq('point no weight', point(150, null).wkg, null);

eq('level man 30', wkgLevel(2.0, 'm', 30), ['一般', 'ok']);
eq('level man 30 low', wkgLevel(1.2, 'm', 30), ['剛起步', 'low']);
eq('level man 30 good', wkgLevel(3.0, 'm', 30), ['不錯', 'good']);
eq('level woman 30 great', wkgLevel(2.9, 'f', 30), ['很強', 'great']);
eq('level age adjust (70 → ×0.6)', wkgLevel(1.0, 'f', 70), ['一般', 'ok']); // 女 70 歲門檻 [0.72,1.2,1.68]
eq('level age clamp (100 → ×0.6)', wkgLevel(0.5, 'm', 100), ['剛起步', 'low']);
eq('level no sex', wkgLevel(2, undefined, 40), null);

eq('insight lost weight, ftp up', insight(point(165, 66), point(150, 70)), 'W/kg 從 2.1 到 2.5，體重少了 4 公斤，體能也進步了。');
eq('insight lost weight, ftp flat', insight(point(150, 66), point(150, 70)), 'W/kg 從 2.1 到 2.3，主要是體重少了 4 公斤，體能沒有掉。');
eq('insight ftp up only', insight(point(165, 70), point(150, 70)), 'W/kg 從 2.1 到 2.4，體能進步了 15 W。');
eq('insight gained weight', insight(point(150, 78), point(150, 70)), 'W/kg 從 2.1 到 1.9，主要是體重多了 8 公斤，體能沒有掉。');
eq('insight ftp down', insight(point(135, 70), point(150, 70)), 'W/kg 從 2.1 到 1.9，體能比 4 週前低一點，偶爾騎硬一點會回來。');
eq('insight flat', insight(point(150, 70), point(150, 70)), 'W/kg 跟 4 週前差不多（2.1）。');
eq('insight no past weight', insight(point(150, 70), point(150, null)), null);

console.log(fail ? `\n${fail} 項失敗` : '\n全部通過');
process.exit(fail ? 1 : 0);
