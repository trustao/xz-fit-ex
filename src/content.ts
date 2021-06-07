import {log} from "./log";
import {FitEncoder} from 'gpx2fit';
import {transformCoord} from "./coord";

log('Init');
setTimeout(() => {
  const script = document.createElement('script');
  script.innerText = `
if (location.hash.startsWith('#!/workout/')) {
  createButton();
}
function createButton() {
  const btn = document.createElement('div');
  btn.innerText = '导出Fit';
  btn.style.cssText = "position: fixed;top: 0;right: 10px;z-index: 9999;background: #ff9800;color: rgb(255, 255, 255);line-height: 22px;height: 22px;padding: 0 10px;border-radius: 0 0 4px 4px;cursor: pointer;font-size: 12px;box-shadow: 0 0 4px -1px #fff;";
  btn.addEventListener('click', exportCallback);
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
`;
  document.body.appendChild(script);
}, 0);

window.addEventListener('message', (ev) => {
  try {
    const data = JSON.parse(ev.data) as {originData: ActivityInfo, points: PointRecord[]};
    log('MSG', data);
    exportFit(data.originData, data.points.map(i => {
      const {lon, lat} = transformCoord(i.lon, i.lat);
      return {...i, time: timeFix(i.time), lon, lat}
    }));
  } catch (e) {
    console.error(e)
  }
})

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

interface PointRecord {
  altitude: number
  cadence: number
  heartrate: number
  power: number
  speed: number
  time: number
  lon: number
  lat: number
}

interface ActivityInfo {
  avg_cadence: number;
  avg_heartrate: number;
  avg_speed: number;
  avg_wheel_rpm: number;
  cadence_source: number;
  calories: number;
  category: number;
  client_id: number;
  comment_count: number;
  create_time: number;
  credits: number;
  deleted: boolean
  desc: string
  distance: number;
  down_avg_speed: number;
  down_distance: number;
  down_duration: number;
  duration: number;
  elevation_gain: number;
  elevation_loss: number;
  encoding_points: string
  end_cadence: number;
  end_time: number;
  end_wheel: number;
  extra_time: number;
  flat_avg_speed: number;
  flat_distance: number;
  flat_duration: number;
  heart_source: number;
  hidden: boolean
  is_export: number;
  is_like: number;
  is_valid: number;
  like_count: number;
  loc_source: number;
  map_hidden: number;
  map_id: number;
  max_altitude: number;
  max_cadence: number;
  max_grade: number;
  max_heartrate: number;
  max_speed: number;
  max_wheel_rpm: number;
  merge_record: string
  min_grade: number;
  modify_time: number;
  offset_lat: number;
  offset_lng: number;
  original_distance: number;
  original_duration: number;
  pic_url: string
  poi: string
  point_counts: number;
  powerAvg: number;
  powerFTP: number;
  powerIF: number;
  powerMax: number;
  powerNP: number;
  powerSource: number;
  powerTSS: number;
  powerVI: number;
  segment_index: string
  sport: number;
  sport_change_count: number;
  start_cadence: number;
  start_time: number;
  start_wheel: number;
  step: number;
  threed_workout: string
  thumbnail: string
  title: string
  up_avg_speed: number;
  up_distance: number;
  up_duration: number;
  upload_time: string
  user: number;
  user_name: string
  uuid: string
  workout_id: number;
}
