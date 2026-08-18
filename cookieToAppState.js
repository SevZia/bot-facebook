const fs = require('fs');

const netscapeCookies = `.facebook.com\tTRUE\t/\tTRUE\t1821605137\tdatr\tdCSEamuvo3zOPGsN-Tvn0st7
.facebook.com\tTRUE\t/\tTRUE\t1821613493\tsb\tdCSEakVz0G6bUCYV-2-dk-nw
.facebook.com\tTRUE\t/\tTRUE\t1787649955\tlocale\tvi_VN
.facebook.com\tTRUE\t/\tTRUE\t1821605602\tps_l\t1
.facebook.com\tTRUE\t/\tTRUE\t1821605602\tps_n\t1
.facebook.com\tTRUE\t/\tTRUE\t1787658297\tdpr\t1.125
.facebook.com\tTRUE\t/\tTRUE\t1818589493\tc_user\t61578651816697
.facebook.com\tTRUE\t/\tTRUE\t1818589493\txs\t19%3A8ddCcLFlMzPUNA%3A2%3A1787053334%3A-1%3A-1%3A%3AAcyqs5clNBJDcJHdVRnKYp5tRSOS1sDzPVw6F-InBA
.facebook.com\tTRUE\t/\tTRUE\t1794829495\tfr\t1lN2SI11nHV8AfssC.AWcwkOyYsZpUUeQipjZ6Yh3QJlagVgaX-5Rct2BE0V3q0gOZQVE.BqhEUY..AAA.0.0.BqhEUa.AWdzeZubtfb5sPISX7ZGTK1WVSo
.facebook.com\tTRUE\t/\tTRUE\t0\tpresence\tC%7B%22t3%22%3A%5B%5D%2C%22utc3%22%3A1787053497390%2C%22v%22%3A1%7D
.facebook.com\tTRUE\t/\tTRUE\t1787658498\twd\t2276x1055`;

function convertNetscapeToAppState(netscapeStr) {
  const lines = netscapeStr.split('\n');
  const appState = [];

  lines.forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;

    const parts = line.split('\t');
    if (parts.length >= 7) {
      appState.push({
        key: parts[5],
        value: parts[6],
        domain: parts[0],
        path: parts[2],
        hostOnly: false,
        creation: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      });
    }
  });

  return appState;
}

const appStateData = convertNetscapeToAppState(netscapeCookies);
fs.writeFileSync('./appstate.json', JSON.stringify(appStateData, null, 2));

console.log("✅ Đã tạo lại appstate.json thành công!");