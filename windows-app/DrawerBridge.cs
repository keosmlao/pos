using System;
using System.IO.Ports;
using System.Printing;
using System.Runtime.InteropServices;

namespace SmlaoPos;

/// ສະພານໃຫ້ໜ້າ POS ເອີ້ນລີ້ນຊັກເງິນ —
/// ໃນໜ້າເວັບເອີ້ນວ່າ: window.chrome.webview.hostObjects.drawer.Kick()
///
/// ຮອງຮັບ 2 ແບບການຕໍ່ສາຍ:
///   1. ລີ້ນຊັກສຽບກັບ "ປີ້ນເຕີ້" (ຊ່ອງ RJ11 ຫຼັງປີ້ນເຕີ້) — ແບບທີ່ໃຊ້ຫຼາຍທີ່ສຸດ
///      → ສົ່ງຄຳສັ່ງ ESC/POS ດິບໆເຂົ້າ spooler ຂອງປີ້ນເຕີ້ ລີ້ນຊັກເປີດ ໂດຍບໍ່ພິມເຈ້ຍ
///   2. ລີ້ນຊັກສຽບ COM port ໂດຍກົງ → ສົ່ງຜ່ານ SerialPort
///
/// ລຳດັບ: ຖ້າຕັ້ງ COM port ໄວ້ → ໃຊ້ serial · ບໍ່ດັ່ງນັ້ນ → ຜ່ານປີ້ນເຕີ້ (fallback serial)
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class DrawerBridge
{
    // ESC p 0 25 250 — ຄຳສັ່ງມາດຕະຖານເປີດລີ້ນຊັກ (pin 2)
    private static readonly byte[] KickCommand = { 0x1b, 0x70, 0x00, 0x19, 0xfa };
    // ບາງລຸ້ນຕໍ່ pin 5 — ສົ່ງທັງສອງເພື່ອໃຫ້ຄຸມທຸກຮຸ່ນ
    private static readonly byte[] KickCommandPin5 = { 0x1b, 0x70, 0x01, 0x19, 0xfa };

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
        var errors = new System.Collections.Generic.List<string>();

        // ຜູ້ໃຊ້ເລືອກ COM port ໄວ້ = ຕັ້ງໃຈໃຊ້ serial
        if (!string.IsNullOrWhiteSpace(cfg.DrawerPort))
        {
            var serialResult = KickSerial(cfg.DrawerPort, cfg);
            if (serialResult == "ok") return "ok";
            errors.Add("serial: " + serialResult);
        }

        // ລີ້ນຊັກຕໍ່ຢູ່ຫຼັງປີ້ນເຕີ້ — ສົ່ງຄຳສັ່ງດິບເຂົ້າ spooler ໂດຍບໍ່ພິມເຈ້ຍ
        var printerResult = KickThroughPrinter(cfg.PrinterName);
        if (printerResult == "ok") return "ok";
        errors.Add("printer: " + printerResult);

        // ສຸດທ້າຍ ລອງ COM port ທຳອິດທີ່ພົບ
        if (string.IsNullOrWhiteSpace(cfg.DrawerPort))
        {
            var first = FirstPort();
            if (!string.IsNullOrWhiteSpace(first))
            {
                var serialResult = KickSerial(first, cfg);
                if (serialResult == "ok") return "ok";
                errors.Add("serial(" + first + "): " + serialResult);
            }
        }

        return string.Join(" · ", errors);
    }

    /// ສົ່ງຄຳສັ່ງເປີດລີ້ນຊັກຜ່ານປີ້ນເຕີ້ (RAW spool job — ບໍ່ມີເຈ້ຍອອກ)
    public string KickThroughPrinter(string printerName)
    {
        var target = string.IsNullOrWhiteSpace(printerName) ? DefaultPrinter() : printerName;
        if (string.IsNullOrWhiteSpace(target)) return "ບໍ່ພົບປີ້ນເຕີ້";

        var payload = new byte[KickCommand.Length + KickCommandPin5.Length];
        Buffer.BlockCopy(KickCommand, 0, payload, 0, KickCommand.Length);
        Buffer.BlockCopy(KickCommandPin5, 0, payload, KickCommand.Length, KickCommandPin5.Length);

        return SendRawToPrinter(target, payload);
    }

    private string KickSerial(string port, Config cfg)
    {
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

    private static string DefaultPrinter()
    {
        try
        {
            var server = new LocalPrintServer();
            return server.DefaultPrintQueue?.FullName ?? "";
        }
        catch { return ""; }
    }

    // ── Win32 spooler: ສົ່ງ byte ດິບໆເຂົ້າປີ້ນເຕີ້ ──────────────────────────
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool OpenPrinterW(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool StartDocPrinterW(IntPtr hPrinter, int level, ref DOCINFOW pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    private static string SendRawToPrinter(string printerName, byte[] bytes)
    {
        var handle = IntPtr.Zero;
        var buffer = IntPtr.Zero;
        try
        {
            if (!OpenPrinterW(printerName, out handle, IntPtr.Zero))
                return "ເປີດປີ້ນເຕີ້ບໍ່ໄດ້ (" + Marshal.GetLastWin32Error() + ")";

            var doc = new DOCINFOW
            {
                pDocName = "POS cash drawer",
                pOutputFile = null,
                pDataType = "RAW",
            };
            if (!StartDocPrinterW(handle, 1, ref doc))
                return "ສ້າງ job ບໍ່ໄດ້ (" + Marshal.GetLastWin32Error() + ")";

            if (!StartPagePrinter(handle))
            {
                EndDocPrinter(handle);
                return "ເລີ່ມ page ບໍ່ໄດ້ (" + Marshal.GetLastWin32Error() + ")";
            }

            buffer = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, buffer, bytes.Length);
            var written = 0;
            var okWrite = WritePrinter(handle, buffer, bytes.Length, out written);

            EndPagePrinter(handle);
            EndDocPrinter(handle);

            if (!okWrite || written != bytes.Length)
                return "ສົ່ງຂໍ້ມູນບໍ່ຄົບ (" + Marshal.GetLastWin32Error() + ")";

            return "ok";
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
        finally
        {
            if (buffer != IntPtr.Zero) Marshal.FreeCoTaskMem(buffer);
            if (handle != IntPtr.Zero) ClosePrinter(handle);
        }
    }
}
