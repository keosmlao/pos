using System;
using System.Threading.Tasks;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace SmlaoPos;

/// ປ່ອງລູກທີ່ໜ້າ POS ເປີດດ້ວຍ window.open —
///   ບິນ            → ພິມທັນທີແບບບໍ່ຖາມ ແລ້ວປິດ (ເມື່ອເປີດໂໝດພິມໄວ)
///   ໜ້າຈໍລູກຄ້າ    → ສະແດງເປັນປ່ອງປົກກະຕິ
public partial class PopupWindow : Window
{
    private readonly bool _silentPrint;
    private bool _printed;

    public PopupWindow(bool silentPrint)
    {
        _silentPrint = silentPrint;
        InitializeComponent();

        if (_silentPrint)
        {
            // ຕ້ອງໃຫ້ປ່ອງ render ຈຶ່ງພິມໄດ້ — ເອົາໄປໄວ້ນອກຈໍແທນການເຊື່ອງ
            WindowStartupLocation = WindowStartupLocation.Manual;
            Left = -32000; Top = -32000;
            ShowInTaskbar = false;
        }
    }

    public async Task InitAsync()
    {
        Show();
        var env = await App.GetEnvironmentAsync();
        await Web.EnsureCoreWebView2Async(env);
        Web.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

        if (_silentPrint)
        {
            // ກັນໜ້າບິນເອີ້ນ window.print() ເອງ (ຈະເປີດກ່ອງຖາມຊ້ຳ)
            await Web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("window.print = () => {};");
        }
    }

    private async void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (!_silentPrint || _printed) return;
        _printed = true;

        // ໃຫ້ຮູບ/ຟອນໂຫຼດຄົບກ່ອນ
        await Task.Delay(350);
        try
        {
            var settings = App.Env!.CreatePrintSettings();
            if (!string.IsNullOrWhiteSpace(App.Config.PrinterName))
                settings.PrinterName = App.Config.PrinterName;
            settings.MarginTop = settings.MarginBottom = settings.MarginLeft = settings.MarginRight = 0;
            settings.ShouldPrintBackgrounds = true;
            await Web.CoreWebView2.PrintAsync(settings);
        }
        catch { /* ພິມບໍ່ໄດ້ກໍປິດປ່ອງໄປ ບໍ່ໃຫ້ຄ້າງ */ }
        finally { Close(); }
    }
}
