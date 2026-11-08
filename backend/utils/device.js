/**
 * "Chrome on Windows" from a User-Agent string - enough to recognise your
 * own devices in the sign-in list without a parsing library.
 */

const BROWSERS = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox|FxiOS/, 'Firefox'],
  [/Chrome|CriOS/, 'Chrome'],
  [/Safari/, 'Safari'],
];

const SYSTEMS = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

const describeDevice = (ua = '') => {
  if (!ua) return 'Unknown device';
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (!browser && !system) return /curl|node|axios|postman|python/i.test(ua) ? 'Script or API client' : 'Unknown device';
  return [browser || 'Browser', system].filter(Boolean).join(' on ');
};

/** Client IP, honouring one proxy hop; IPv4-mapped IPv6 shown as IPv4. */
const clientIp = (req) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || '';
  return ip.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
};

module.exports = { describeDevice, clientIp };
