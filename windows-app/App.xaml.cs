using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace SmlaoPos;

public partial class App : Application
{
    private static Mutex? _singleInstance;

    public static Config Config { get; set; } = new();
    public static CoreWebView2Environment? Env { get; private set; }
    public static DrawerBridge Drawer { get; private set; } = null!;
    public static LocalStore Store { get; private set; } = null!;
    public static ShellWindow? Shell { get; set; }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // ບໍ່ໃຫ້ເປີດຊ້ອນຫຼາຍແອັບ
        _singleInstance = new Mutex(true, "SMLAO_POS_DESKTOP", out var isNew);
        if (!isNew)
        {
            MessageBox.Show("SMLAO POS ເປີດຢູ່ແລ້ວ", "SMLAO POS", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        Config = Config.Load();
        Store = new LocalStore();
        Drawer = new DrawerBridge(() => Config, cfg => cfg.Save());

        Shell = new ShellWindow();
        Shell.Show();
    }

    /// WebView2 environment ໃຊ້ຮ່ວມກັນທຸກປ່ອງ (cookie/localStorage ຊຸດດຽວ)
    public static async Task<CoreWebView2Environment> GetEnvironmentAsync()
    {
        if (Env != null) return Env;
        var dataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "SMLAO POS", "WebView2");
        Directory.CreateDirectory(dataDir);
        Env = await CoreWebView2Environment.CreateAsync(null, dataDir);
        return Env;
    }
}
