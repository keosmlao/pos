using System;
using System.IO.Ports;
using System.Runtime.InteropServices;

namespace SmlaoPos;

/// ສະພານໃຫ້ໜ້າ POS ເອີ້ນລີ້ນຊັກເງິນຜ່ານ serial ໂດຍກົງ —
/// ໜ້າເຊື່ອຖືກວ່າ Web Serial ຂອງ browser ທີ່ຕ້ອງຂໍສິດເລືອກ port ທຸກເທື່ອ.
/// ໃນໜ້າເວັບເອີ້ນວ່າ: window.chrome.webview.hostObjects.drawer.Kick()
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class DrawerBridge
{
    // ESC p 0 25 250 — ຄຳສັ່ງມາດຕະຖານເປີດລີ້ນຊັກ
    private static readonly byte[] KickCommand = { 0x1b, 0x70, 0x00, 0x19, 0xfa };

    private readonly Func<Config> _config;
    private readonly Action<Config> _saveConfig;

    public DrawerBridge(Func<Config> config, Action<Config> saveConfig)
    {
        _config = config;
        _saveConfig = saveConfig;
    }

    /// ລາຍຊື່ COM port ທີ່ມີໃນເຄື່ອງ (ໃຫ້ໜ້າຕັ້ງຄ່າໃຊ້)
    public string[] ListPorts()
    {
        try { return SerialPort.GetPortNames(); } catch { return Array.Empty<string>(); }
    }

    /// ເປີດລີ້ນຊັກ — ຄືນ "ok" ຫຼື ຂໍ້ຄວາມຜິດພາດ
    public string Kick()
    {
        var cfg = _config();
        var port = string.IsNullOrWhiteSpace(cfg.DrawerPort) ? FirstPort() : cfg.DrawerPort;
        if (string.IsNullOrWhiteSpace(port)) return "ບໍ່ພົບ COM port ຂອງລີ້ນຊັກ";

        try
        {
            using var serial = new SerialPort(port, 9600);
            serial.Open();
            serial.Write(KickCommand, 0, KickCommand.Length);
            serial.Close();

            // ຈື່ port ທີ່ໃຊ້ໄດ້ໄວ້ ຈະບໍ່ຕ້ອງຫາໃໝ່ເທື່ອໜ້າ
            if (cfg.DrawerPort != port) { cfg.DrawerPort = port; _saveConfig(cfg); }
            return "ok";
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }

    private static string FirstPort()
    {
        try
        {
            var ports = SerialPort.GetPortNames();
            return ports.Length > 0 ? ports[0] : "";
        }
        catch { return ""; }
    }
}
