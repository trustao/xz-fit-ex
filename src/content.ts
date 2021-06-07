import {log} from "./log";
import {FitEncoder} from 'gpx2fit';
import {transformCoord} from "./coord";
import {ActivityInfo, PointRecord} from "./interface";

run();
function run() {
  log('Load');
  initEx();
}

function initEx() {
  setTimeout(() => {
    const script = document.createElement('script');
    script.innerText = `
initButton();
window.addEventListener('popstate',() => {
  initButton();
});
window.addEventListener('click',() => {
  setTimeout(() => {
    initButton();
  }, 1000)
}, true);

function initButton() {
  if (location.hostname === 'www.blackbirdsport.com' && /\\/user\\/records\\/\\d+/.test(location.pathname) || location.hash.startsWith('#!/workout/')) {
    createButton();
  } else {
    const btn = document.getElementById('__ex_fit_exporter_by_tr');
    btn?.remove();
  }
}

function createButton() {
  let btn = document.getElementById('__ex_fit_exporter_by_tr');
  if (btn) {
    return;
  }
  btn = document.createElement('div');
  btn.id = '__ex_fit_exporter_by_tr';
  btn.innerText = '导出Fit';
  btn.style.cssText = "position: fixed;top: 0;right: 10px;z-index: 9999;background: #ff9800;color: rgb(255, 255, 255);line-height: 22px;height: 22px;padding: 0 10px;border-radius: 0 0 4px 4px;cursor: pointer;font-size: 12px;box-shadow: 0 0 4px -1px #fff;";
  btn.addEventListener('click', () => {
    if (location.hostname === 'www.blackbirdsport.com') {
      exportCallbackBlackBird()
    } else {
      exportCallback()
    }
  });
  document.body.appendChild(btn);
}

function exportCallback() {
  const root = document.querySelector('#app').__vue__;
  const originData = root.$store.state.workout.workoutInfo.originData;
  const lonLat = root.$store.state.workout.sportData.lngLat || [];
  const points = root.$store.state.workout.sportData.points || [];
  if (!points.length) {
    alert('导出失败，数据加载未完成。');
    return;
  }
  window.postMessage(JSON.stringify({originData, points: points.map((e, i) => ({...e, lon: lonLat[i].lng, lat: lonLat[i].lat}))}), '*');
}

function exportCallbackBlackBird() {
  const arr = location.pathname.split('/');
  const id = arr[arr.length - 1];
  fetch('/api/records/' + id + '/data', {
    credentials: 'same-origin'
  }).then(function (response) {
    return response.json();
  }).then(function (myJson) {
    const originData = {
      start_time: myJson.content.startTime,
      end_time: myJson.content.endTime,
      distance: +myJson.content.distance,
      duration: +myJson.content.duration,
      elevation_gain: +myJson.content.sumHeight,
      avg_speed: +myJson.content.distance / +myJson.content.duration,
      title: id,
      max_altitude: 0,
      max_speed: 0,
    };
    let mA = 0;
    let mS = 0;
    const points = myJson.content.track.split(';').map(i => {
      const [lat, lon, altitude, speed, heartrate, cadence, _, t, mt] = i.split(',').map(ii => ii === '' ? null : +ii);
      const s = speed / 3600;
      mA = altitude > mA ? altitude : mA;
      mS = s > mS ? s : mS;
      const time = originData.start_time + t * 1000;
      return {lat, lon, altitude, heartrate, cadence, time, speed: s};
    });
    originData.max_speed = mS;
    originData.max_altitude = mA;
    if (!points.length) {
      alert('导出失败。');
      return;
    }
    window.postMessage(JSON.stringify({originData, points}), '*');
  }).catch(err => {
    console.error(err);
    alert('导出失败。');
  })
}
`;
    document.head.appendChild(script);
  }, 0);

  window.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data) as {originData: ActivityInfo, points: PointRecord[]};
      log('MSG', data);
      if (data?.originData && data.points?.length) {
        exportFit(data.originData, data.points.map(i => {
          const {lon, lat} = transformCoord(i.lon, i.lat);
          return {...i, time: timeFix(i.time), lon, lat}
        }));
      }
    } catch (e) {
      console.error(e)
    }
  })
}
function timeFix(value: number) {
  return value + 28800000;
}

function exportFit(originData: ActivityInfo, points: PointRecord[]) {
  const encoder = new FitEncoder();
  const st = points[0].time;
  const et = points[points.length - 1].time;
  const tt = Math.round((et- st) / 1000);
  encoder.writeFileId({type: 'activity', time_created: st})
  encoder.writeEvent({
    timestamp: st,
    event: 'timer',
    event_type: 'start',
    event_group: 0,
  });

  let lastP: PointRecord;
  let distance = 0;
  const t = [];
  points.forEach(i => {
    if (lastP) {
      distance += haversine(lastP, i);
    }
    lastP = i;
    const item = {
      timestamp: i.time,
      position_lat: i.lat,
      position_long: i.lon,
      altitude: i.altitude,
      distance,
      heart_rate: i.heartrate,
      cadence: i.cadence,
      speed: i.speed,
    };
    t.push(item);
    encoder.writeRecord(item);
  })

  const overview = {
    event: 'lap',
    event_type: 'stop',
    sport: 'cycling',
    start_time: st,
    start_position_lat: points[0].lat,
    start_position_long: points[0].lon,
    avg_speed: originData.avg_speed,
    total_moving_time: originData.duration,
    total_elapsed_time: tt,
    total_timer_time: tt,
    max_speed: originData.max_speed,
    max_altitude: originData.max_altitude,
    // @ts-ignore
    min_altitude: Math.min(...points.map(i => i.altitude)),
    total_distance: originData.distance,
    total_ascent: originData.elevation_gain,
    total_descent: originData.elevation_loss
  };

  encoder.writeEvent({
    timestamp: et,
    event: 'timer',
    event_type: 'stop_disable_all',
    event_group: 0
  });
  encoder.writeMessage('lap', overview);
  encoder.writeMessage('session', {...overview, num_laps: 1, first_lap_index: 0});

  encoder.writeMessage('activity', {
    'timestamp': et,
    'total_timer_time': overview.total_timer_time,
    'local_timestamp': et,
    'num_sessions': 1,
    'type': 'manual',
    'event': 'activity',
    'event_type': 'stop'
  });

  setTimeout(() => {
    downloadFile(encoder, originData.title);
  }, 1000)
}

function downloadFile(encoder: FitEncoder, title: string) {
  const blob = encoder.createBlob();
  const url = URL.createObjectURL(blob);
  const anchorElement = document.createElement('a');
  anchorElement.download = `${title}.fit`;
  anchorElement.href = url;
  anchorElement.click();
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000);
}

function haversine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d;
}

