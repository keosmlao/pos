using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SmlaoPos;

/// ຄ່າຕັ້ງຂອງແອັບ — ເກັບເປັນ JSON ທີ່
/// %APPDATA%\SMLAO POS\config.json (ຮູບແບບດຽວກັນກັບແອັບ Electron)
public class Config
{
    [JsonPropertyName("serverUrl")] public string ServerUrl { get; set; } = "http://localhost:3000";
    [JsonPropertyName("silentPrint")] public bool SilentPrint { get; set; }
    [JsonPropertyName("printerName")] public string PrinterName { get; set; } = "";
    [JsonPropertyName("openPosOnStart")] public bool OpenPosOnStart { get; set; }
    [JsonPropertyName("drawerPort")] public string DrawerPort { get; set; } = "";

    [JsonPropertyName("width")] public int Width { get; set; } = 1366;
    [JsonPropertyName("height")] public int Height { get; set; } = 800;
    [JsonPropertyName("posWidth")] public int PosWidth { get; set; } = 1366;
    [JsonPropertyName("posHeight")] public int PosHeight { get; set; } = 800;
    [JsonPropertyName("posLeft")] public double PosLeft { get; set; } = double.NaN;
    [JsonPropertyName("posTop")] public double PosTop { get; set; } = double.NaN;
    [JsonPropertyName("posFullScreen")] public bool PosFullScreen { get; set; }

    private static readonly JsonSerializerOptions JsonOpts = new() { WriteIndented = true };

    public static string Dir => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SMLAO POS");

    public static string Path_ => System.IO.Path.Combine(Dir, "config.json");

    public static Config Load()
    {
        try
        {
            if (File.Exists(Path_))
                return JsonSerializer.Deserialize<Config>(File.ReadAllText(Path_)) ?? new Config();
        }
        catch { /* ໄຟລ໌ເສຍ → ໃຊ້ຄ່າເລີ່ມຕົ້ນ */ }
        return new Config();
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Dir);
            File.WriteAllText(Path_, JsonSerializer.Serialize(this, JsonOpts));
        }
        catch { /* ຂຽນບໍ່ໄດ້ກໍບໍ່ໃຫ້ແອັບລົ້ມ */ }
    }

    /// URL ທີ່ສະອາດແລ້ວ (ບໍ່ມີ / ທ້າຍ)
    public string CleanServerUrl => (ServerUrl ?? "").Trim().TrimEnd('/');

    public bool IsOurOrigin(string url)
    {
        try { return new Uri(url).GetLeftPart(UriPartial.Authority) == new Uri(CleanServerUrl).GetLeftPart(UriPartial.Authority); }
        catch { return false; }
    }
}
