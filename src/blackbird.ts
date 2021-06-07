import {ActivityInfo, BlackbirdResponse, PointRecord} from "./interface";
import {log} from "./log";



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
