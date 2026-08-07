using System;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;

namespace SmlaoPos;

/// ປ່ອງດຽວຂອງແອັບ = ໜ້າຂາຍ (POS) ເທົ່ານັ້ນ — ຫຼັງບ້ານໃຫ້ໄປໃຊ້ browser
public partial class ShellWindow : Window
{
    private bool _showingOffline;

    public ICommand FullScreenCommand { get; }
    public ICommand ReloadCommand { get; }
    public ICommand SettingsCommand { get; }

    public ShellWindow()
    {
        InitializeComponent();

        FullScreenCommand = new Relay(ToggleFullScreen);
        ReloadCommand = new Relay(async () => await ReloadSafelyAsync());
        SettingsCommand = new Relay(OpenSettings);

        var cfg = App.Config;
        Width = cfg.PosWidth; Height = cfg.PosHeight;
        if (!double.IsNaN(cfg.PosLeft) && !double.IsNaN(cfg.PosTop))
        {
            WindowStartupLocation = WindowStartupLocation.Manual;
            Left = cfg.PosLeft; Top = cfg.PosTop;
        }
        if (cfg.PosFullScreen) { WindowStyle = WindowStyle.None; WindowState = WindowState.Maximized; }
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        var env = await App.GetEnvironmentAsync();
        await Web.EnsureCoreWebView2Async(env);
        var core = Web.CoreWebView2;

        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.AreDevToolsEnabled = false;

        // ໜ້າ POS ເອີ້ນລີ້ນຊັກຜ່ານ window.chrome.webview.hostObjects.drawer.Kick()
        core.AddHostObjectToScript("drawer", App.Drawer);

        core.NavigationStarting += OnNavigationStarting;
        core.NavigationCompleted += OnNavigationCompleted;
        core.HistoryChanged += OnHistoryChanged;
        core.NewWindowRequested += OnNewWindowRequested;
        core.WebMessageReceived += OnWebMessageReceived;

        // ສະຄຣິບສຳເນົາຄິວບິນ offline ລົງຖານຂໍ້ມູນ + ກູ້ຄືນຕອນເປີດແອັບ
        await core.AddScriptToExecuteOnDocumentCreatedAsync(QueueMirrorScript);

        Navigate(App.Config.CleanServerUrl);
    }

    public void Navigate(string url)
    {
        if (Web.CoreWebView2 == null) return;
        _showingOffline = false;
        try { Web.CoreWebView2.Navigate(url); } catch { ShowOffline(); }
    }

    private void ShowOffline()
    {
        if (Web.CoreWebView2 == null) return;
        _showingOffline = true;
        Web.CoreWebView2.NavigateToString(OfflinePage.Html);
    }

    private static bool IsAdmin(string url)
    {
        try { return new Uri(url).AbsolutePath.StartsWith("/admin", StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }

    private static bool IsCustomerDisplay(string url)
    {
        try { return new Uri(url).AbsolutePath.Equals("/customer", StringComparison.OrdinalIgnoreCase); }
        catch { return false; }
    }

    // ແອັບນີ້ມີແຕ່ໜ້າຂາຍ — ຫຼັງບ້ານເປີດບໍ່ໄດ້
    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        if (IsAdmin(e.Uri)) e.Cancel = true;
    }

    // Next.js ຍ້າຍໜ້າຝັ່ງ client (router.push) ບໍ່ຜ່ານ NavigationStarting
    private void OnHistoryChanged(object? sender, object e)
    {
        if (Web.CoreWebView2 == null) return;
        if (!IsAdmin(Web.CoreWebView2.Source)) return;
        _ = Web.CoreWebView2.ExecuteScriptAsync("history.back()");
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess) return;
        // ໂຫຼດບໍ່ສຳເລັດ → ໜ້າ offline ຂອງເຮົາ (ມີປຸ່ມລອງໃໝ່ + ຕັ້ງຄ່າ)
        // ແທນໜ້າ error ຂອງ Chromium
        if (!_showingOffline) ShowOffline();
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        var raw = e.TryGetWebMessageAsString();
        if (string.IsNullOrEmpty(raw)) return;

        if (raw == "retry") { Navigate(App.Config.CleanServerUrl); return; }
        if (raw == "settings") { OpenSettings(); return; }

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var type = doc.RootElement.GetProperty("type").GetString();

            // ໜ້າ POS ສົ່ງຄິວບິນ offline ມາທຸກ 5 ວິ → ສຳເນົາລົງ SQLite
            if (type == "queue")
            {
                App.Store.SyncQueue(doc.RootElement.GetProperty("data").GetString() ?? "[]");
            }
            // ເປີດແອັບໃໝ່ແລ້ວ localStorage ຫວ່າງ → ກູ້ບິນທີ່ຄ້າງຈາກຖານຂໍ້ມູນ
            else if (type == "restore-request")
            {
                var pending = App.Store.PendingOrders();
                Web.CoreWebView2.PostWebMessageAsString(
                    JsonSerializer.Serialize(new { type = "restore", data = pending }));
            }
        }
        catch { /* ຂໍ້ຄວາມທີ່ອ່ານບໍ່ອອກ ບໍ່ຕ້ອງເຮັດຫຍັງ */ }
    }

    private async void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        var deferral = e.GetDeferral();
        try
        {
            var isDisplay = IsCustomerDisplay(e.Uri ?? "");
            var popup = new PopupWindow(App.Config.SilentPrint && !isDisplay) { Owner = this };
            await popup.InitAsync();
            e.NewWindow = popup.Web.CoreWebView2;
            e.Handled = true;
        }
        catch { /* ປ່ອຍໃຫ້ WebView2 ຈັດການເອງ */ }
        finally { deferral.Complete(); }
    }

    private async Task ReloadSafelyAsync()
    {
        if (Web.CoreWebView2 == null) return;
        if (_showingOffline) { Navigate(App.Config.CleanServerUrl); return; }

        // ⚠️ ເນັດຫຼຸດ: ຫ້າມໂຫຼດໃໝ່ — ໜ້າ POS ຈະຫາຍ ແລະ ໂຫຼດຄືນບໍ່ໄດ້ຈົນກວ່າເນັດຈະມາ
        var online = await Web.CoreWebView2.ExecuteScriptAsync("navigator.onLine");
        if (online == "false")
        {
            MessageBox.Show(this,
                "ຕອນນີ້ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ — ຍັງບໍ່ໂຫຼດໃໝ່\n\n" +
                "ໜ້າ POS ທີ່ເປີດຢູ່ຍັງຂາຍໄດ້ປົກກະຕິ ບິນຖືກເກັບໄວ້ໃນຖານຂໍ້ມູນຂອງເຄື່ອງ\n" +
                "ແລະ ຈະສົ່ງຂຶ້ນ server ໃຫ້ອັດຕະໂນມັດເມື່ອເນັດກັບມາ.",
                "ເນັດຫຼຸດ", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }
        Web.CoreWebView2.Reload();
    }

    private void ToggleFullScreen()
    {
        if (WindowStyle == WindowStyle.None)
        {
            WindowStyle = WindowStyle.SingleBorderWindow;
            WindowState = WindowState.Normal;
        }
        else
        {
            WindowStyle = WindowStyle.None;
            WindowState = WindowState.Maximized;
        }
    }

    private void OpenSettings()
    {
        new SettingsWindow { Owner = this }.ShowDialog();
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        // ຍັງມີບິນຄ້າງສົ່ງ → ເຕືອນກ່ອນປິດ (ບິນບໍ່ຫາຍ ແຕ່ຈະຍັງບໍ່ຂຶ້ນ server)
        var pending = App.Store.PendingCount();
        if (pending > 0)
        {
            var answer = MessageBox.Show(this,
                $"ຍັງມີບິນ offline {pending} ໃບທີ່ຍັງບໍ່ທັນສົ່ງຂຶ້ນ server.\n" +
                "ບິນຖືກເກັບໄວ້ໃນຖານຂໍ້ມູນຂອງເຄື່ອງແລ້ວ ແລະ ຈະສົ່ງໃຫ້ເມື່ອເປີດແອັບຄັ້ງໜ້າຕອນມີເນັດ.\n\n" +
                "ຕ້ອງການປິດແອັບບໍ?",
                "ມີບິນຄ້າງສົ່ງ", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (answer == MessageBoxResult.No) { e.Cancel = true; return; }
        }

        var cfg = App.Config;
        cfg.PosFullScreen = WindowStyle == WindowStyle.None;
        if (WindowState == WindowState.Normal && WindowStyle != WindowStyle.None)
        {
            cfg.PosWidth = (int)Width; cfg.PosHeight = (int)Height;
            cfg.PosLeft = Left; cfg.PosTop = Top;
        }
        cfg.Save();
    }

    /// ແລ່ນໃນໜ້າ POS: ສົ່ງຄິວບິນ offline ມາໃຫ້ແອັບເກັບລົງ SQLite ທຸກ 5 ວິ
    /// ແລະ ກູ້ຄືນຈາກຖານຂໍ້ມູນຖ້າ localStorage ຫວ່າງ (ໂປຣໄຟລ໌ຖືກລ້າງ / ຍ້າຍເຄື່ອງ)
    private const string QueueMirrorScript = """
        (function () {
          const KEY = 'pos_offline_orders_v1';
          const read = () => { try { return localStorage.getItem(KEY) || '[]'; } catch { return '[]'; } };
          const post = (msg) => { try { window.chrome.webview.postMessage(JSON.stringify(msg)); } catch (e) {} };

          window.chrome.webview.addEventListener('message', (event) => {
            let msg; try { msg = JSON.parse(event.data); } catch { return; }
            if (msg.type !== 'restore') return;
            try {
              const fromDb = JSON.parse(msg.data || '[]');
              const current = JSON.parse(read());
              const seen = new Set(current.map(x => x.ref));
              const merged = current.concat(fromDb.filter(x => x && x.ref && !seen.has(x.ref)));
              if (merged.length !== current.length) localStorage.setItem(KEY, JSON.stringify(merged));
            } catch (e) {}
          });

          window.addEventListener('load', () => {
            post({ type: 'restore-request' });
            post({ type: 'queue', data: read() });
          });
          setInterval(() => post({ type: 'queue', data: read() }), 5000);
          window.addEventListener('beforeunload', () => post({ type: 'queue', data: read() }));
        })();
        """;
}

/// ຄຳສັ່ງງ່າຍໆ ສຳລັບ KeyBinding
public class Relay : ICommand
{
    private readonly Action _run;
    public Relay(Action run) => _run = run;
    public event EventHandler? CanExecuteChanged { add { } remove { } }
    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => _run();
}
