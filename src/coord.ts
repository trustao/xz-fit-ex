import coordtransform from 'coordtransform';

coordtransform.bod09towgs84 = function (...args) {
  // @ts-ignore
  return this.bd09togcj02(...this.gcj02towgs84(...args))
}


export function transformCoord(lon: number, lat: number) {
  const point = coordtransform.bod09towgs84(lon, lat);
  return {lon: point[0], lat: point[1]}
}
