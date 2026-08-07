'use client';

let drawerPort = null;

const DRAWER_KICK_COMMAND = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

// ແອັບ Windows (.NET + WebView2) ເປີດລີ້ນຊັກຜ່ານ COM port ໃຫ້ໂດຍກົງ —
// ບໍ່ຕ້ອງຂໍສິດເລືອກ port ຄືນ Web Serial ຂອງ browser
function hostDrawer() {
  try { return window.chrome?.webview?.hostObjects?.drawer || null; } catch { return null; }
}

export function isCashDrawerSupported() {
  if (hostDrawer()) return true;
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

async function getDrawerPort(requestPort = false) {
  if (!isCashDrawerSupported()) {
    return { ok: false, reason: 'unsupported' };
  }

  if (drawerPort) return { ok: true, port: drawerPort };

  const ports = await navigator.serial.getPorts();
  drawerPort = ports[0] || null;

  if (!drawerPort && requestPort) {
    try {
      drawerPort = await navigator.serial.requestPort();
    } catch (error) {
      return { ok: false, reason: 'not_configured', error };
    }
  }

  if (!drawerPort) {
    return { ok: false, reason: 'not_configured' };
  }

  return { ok: true, port: drawerPort };
}

export async function connectCashDrawer() {
  const result = await getDrawerPort(true);
  if (!result.ok) return result;

  return openCashDrawer({ requestPort: false });
}

export async function openCashDrawer({ requestPort = false } = {}) {
  const host = hostDrawer();
  if (host) {
    try {
      const answer = await host.Kick();
      if (String(answer) === 'ok') return { ok: true };
      return { ok: false, reason: 'host_error', error: new Error(String(answer)) };
    } catch (error) {
      return { ok: false, reason: 'host_error', error };
    }
  }

  const result = await getDrawerPort(requestPort);
  if (!result.ok) return result;

  const port = result.port;
  try {
    if (!port.readable && !port.writable) {
      await port.open({ baudRate: 9600 });
    }

    const writer = port.writable.getWriter();
    await writer.write(DRAWER_KICK_COMMAND);
    writer.releaseLock();

    await port.close();
    return { ok: true };
  } catch (error) {
    drawerPort = null;
    return {
      ok: false,
      reason: 'write_failed',
      error,
    };
  }
}
