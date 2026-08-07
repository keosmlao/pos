using System;
using System.IO.Ports;
using System.Printing;
using System.Windows;

namespace SmlaoPos;

public partial class SettingsWindow : Window
{
    public SettingsWindow() => InitializeComponent();

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        var cfg = App.Config;
        UrlBox.Text = cfg.CleanServerUrl;
        SilentBox.IsChecked = cfg.SilentPrint;

        PrinterBox.Items.Add("— printer ຄ່າເລີ່ມຕົ້ນຂອງເຄື່ອງ —");
        PrinterBox.SelectedIndex = 0;
        try
        {
            var server = new LocalPrintServer();
            foreach (var queue in server.GetPrintQueues(new[]
                     { EnumeratedPrintQueueTypes.Local, EnumeratedPrintQueueTypes.Connections }))
            {
                PrinterBox.Items.Add(queue.Name);
                if (queue.Name == cfg.PrinterName) PrinterBox.SelectedIndex = PrinterBox.Items.Count - 1;
            }
        }
        catch { /* ບໍ່ມີ printer ກໍໃຊ້ຄ່າເລີ່ມຕົ້ນ */ }

        PortBox.Items.Add("— ຫາເອງອັດຕະໂນມັດ —");
        PortBox.SelectedIndex = 0;
        try
        {
            foreach (var port in SerialPort.GetPortNames())
            {
                PortBox.Items.Add(port);
                if (port == cfg.DrawerPort) PortBox.SelectedIndex = PortBox.Items.Count - 1;
            }
        }
        catch { /* ບໍ່ມີ COM port */ }

        var pending = App.Store.PendingCount();
        PendingText.Text = pending > 0
            ? $"📴 ມີບິນ offline {pending} ໃບຄ້າງຢູ່ໃນຖານຂໍ້ມູນຂອງເຄື່ອງ"
            : "✓ ບໍ່ມີບິນຄ້າງສົ່ງ";
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        var url = (UrlBox.Text ?? "").Trim().TrimEnd('/');
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            MessageBox.Show(this, "URL ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ http:// ຫຼື https://",
                "URL ບໍ່ຖືກຕ້ອງ", MessageBoxButton.OK, MessageBoxImage.Warning);
            return;
        }

        var cfg = App.Config;
        cfg.ServerUrl = url;
        cfg.SilentPrint = SilentBox.IsChecked == true;
        cfg.PrinterName = PrinterBox.SelectedIndex > 0 ? (string)PrinterBox.SelectedItem : "";
        cfg.DrawerPort = PortBox.SelectedIndex > 0 ? (string)PortBox.SelectedItem : "";
        cfg.Save();

        App.Shell?.Navigate(cfg.CleanServerUrl);
        Close();
    }

    private void OnCancel(object sender, RoutedEventArgs e) => Close();
}
