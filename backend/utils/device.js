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

const os = require('os');
const dgram = require('dgram');

const LOOPBACK = /^(127\.|::1$|localhost$)/;
const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd][0-9a-f]{2}:|fe80:)/i;
// VirtualBox, VMware, Hyper-V, WSL and Docker adapters aren't "this computer on the network"
const VIRTUAL = /virtual|vbox|vmware|vethernet|hyper-v|wsl|docker|loopback|bluetooth/i;

/** Best guess from the adapters: a real Wi-Fi / Ethernet IPv4 address. */
const fromAdapters = () => {
  const list = Object.entries(os.networkInterfaces())
    .flatMap(([name, addrs]) => (addrs || []).map((a) => ({ ...a, name })))
    .filter((a) => (a.family === 'IPv4' || a.family === 4) && !a.internal && !VIRTUAL.test(a.name));
  const pick = list.find((a) => /wi-?fi|wlan|wireless/i.test(a.name)) || list.find((a) => PRIVATE.test(a.address)) || list[0];
  return pick?.address || '';
};

/**
 * This machine's own network address, for connections that arrive over
 * loopback: when the browser runs on the same computer as the server, that
 * computer IS the device. Found by asking the OS which local address it would
 * route outgoing traffic from (a UDP "connect" picks a route but sends
 * nothing), so virtual adapters are never chosen. Cached; refreshed every
 * few minutes in case the computer changes network.
 */
let lanIp = fromAdapters();
const detectRoute = () => {
  const sock = dgram.createSocket('udp4');
  sock.on('error', () => sock.close());
  sock.connect(53, '1.1.1.1', () => {
    try { lanIp = sock.address().address || lanIp; } catch { /* keep the adapter guess */ }
    sock.close();
  });
};
try { detectRoute(); setInterval(detectRoute, 5 * 60 * 1000).unref(); } catch { /* offline: adapter guess */ }

const hostLanIp = () => lanIp;

/**
 * The device's IP address. Behind the hosting proxy this is the public
 * address the device connects from (first X-Forwarded-For hop); on a local
 * network it is the device's LAN address; from this same computer it is this
 * computer's LAN address.
 */
const clientIp = (req) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = (forwarded || req.ip || req.socket?.remoteAddress || '')
    .replace(/^::ffff:/, '')
    .replace(/^::1$/, '127.0.0.1');
  if (LOOPBACK.test(ip)) return hostLanIp() || '127.0.0.1';
  return ip;
};

/** 'internet' | 'local network' | 'this computer', for showing next to an IP. */
const networkKind = (ip = '') => {
  if (!ip) return '';
  if (LOOPBACK.test(ip) || ip === lanIp) return 'this computer';
  if (PRIVATE.test(ip)) return 'local network';
  return 'internet';
};

module.exports = { describeDevice, clientIp, networkKind, hostLanIp };
