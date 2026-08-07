using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace SmlaoPos;

/// ຖານຂໍ້ມູນຊົ່ວຄາວໃນເຄື່ອງ (SQLite) — ໃຊ້ພັກຂໍ້ມູນຕອນເນັດຫຼຸດ:
///   offline_orders : ບິນທີ່ຂາຍແລ້ວແຕ່ຍັງບໍ່ທັນສົ່ງຂຶ້ນ server
///   parked_carts   : ກະຕ່າທີ່ພັກໄວ້ຊົ່ວຄາວ
///
/// ໜ້າ POS ຍັງເກັບຄິວຂອງມັນໃນ localStorage ຄືເກົ່າ (ໃຊ້ໄດ້ທັງ browser),
/// ແອັບນີ້ເຮັດໜ້າທີ່ "ສຳເນົາລົງຖານຂໍ້ມູນ" ໃຫ້ອີກຊັ້ນ — ຖ້າໂປຣໄຟລ໌ WebView2
/// ຖືກລ້າງ ຫຼື ເຄື່ອງດັບ ບິນທີ່ຄ້າງຍັງກູ້ຄືນໄດ້.
[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public class LocalStore
{
    private readonly string _connectionString;

    public LocalStore()
    {
        Directory.CreateDirectory(Config.Dir);
        var dbPath = Path.Combine(Config.Dir, "pos-local.db");
        _connectionString = new SqliteConnectionStringBuilder { DataSource = dbPath }.ToString();
        Init();
    }

    private SqliteConnection Open()
    {
        var conn = new SqliteConnection(_connectionString);
        conn.Open();
        return conn;
    }

    private void Init()
    {
        using var conn = Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS offline_orders (
              ref        TEXT PRIMARY KEY,
              sold_at    TEXT NOT NULL,
              payload    TEXT NOT NULL,
              status     TEXT NOT NULL DEFAULT 'pending',
              synced_at  TEXT,
              saved_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS parked_carts (
              id         TEXT PRIMARY KEY,
              label      TEXT,
              payload    TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            """;
        cmd.ExecuteNonQuery();
    }

    // ── ບິນ offline ───────────────────────────────────────────────

    /// ບັນທຶກຄິວທັງໝົດທີ່ໜ້າ POS ສົ່ງມາ (JSON array ຂອງ {ref, sold_at, payload})
    /// ບິນທີ່ຫາຍໄປຈາກຄິວ = ສົ່ງຂຶ້ນ server ແລ້ວ → ໝາຍວ່າ synced
    public string SyncQueue(string queueJson)
    {
        try
        {
            var entries = JsonSerializer.Deserialize<List<QueueEntry>>(queueJson) ?? new();
            using var conn = Open();
            using var tx = conn.BeginTransaction();

            var stillPending = new HashSet<string>();
            foreach (var entry in entries)
            {
                if (string.IsNullOrWhiteSpace(entry.Ref)) continue;
                stillPending.Add(entry.Ref);
                using var up = conn.CreateCommand();
                up.CommandText = """
                    INSERT INTO offline_orders (ref, sold_at, payload, status)
                    VALUES ($ref, $soldAt, $payload, 'pending')
                    ON CONFLICT(ref) DO UPDATE SET payload = excluded.payload
                    """;
                up.Parameters.AddWithValue("$ref", entry.Ref);
                up.Parameters.AddWithValue("$soldAt", entry.SoldAt ?? DateTime.Now.ToString("o"));
                up.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(entry.Payload));
                up.ExecuteNonQuery();
            }

            using var done = conn.CreateCommand();
            done.CommandText = """
                UPDATE offline_orders
                   SET status = 'synced', synced_at = datetime('now','localtime')
                 WHERE status = 'pending'
                   AND ($keepAll = 1 OR ref NOT IN (SELECT value FROM json_each($refs)))
                """;
            done.Parameters.AddWithValue("$refs", JsonSerializer.Serialize(stillPending));
            done.Parameters.AddWithValue("$keepAll", 0);
            done.ExecuteNonQuery();

            tx.Commit();
            return "ok";
        }
        catch (Exception ex) { return ex.Message; }
    }

    /// ບິນທີ່ຍັງຄ້າງ — ໃຊ້ກູ້ຄືນໃສ່ localStorage ຕອນເປີດແອັບ
    public string PendingOrders()
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT ref, sold_at, payload FROM offline_orders WHERE status = 'pending' ORDER BY saved_at";
            using var reader = cmd.ExecuteReader();
            var rows = new List<QueueEntry>();
            while (reader.Read())
            {
                rows.Add(new QueueEntry
                {
                    Ref = reader.GetString(0),
                    SoldAt = reader.GetString(1),
                    Payload = JsonSerializer.Deserialize<JsonElement>(reader.GetString(2)),
                });
            }
            return JsonSerializer.Serialize(rows);
        }
        catch { return "[]"; }
    }

    public int PendingCount()
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM offline_orders WHERE status = 'pending'";
            return Convert.ToInt32(cmd.ExecuteScalar());
        }
        catch { return 0; }
    }

    // ── ກະຕ່າທີ່ພັກໄວ້ ───────────────────────────────────────────────

    public string ParkCart(string id, string label, string payloadJson)
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                INSERT INTO parked_carts (id, label, payload) VALUES ($id, $label, $payload)
                ON CONFLICT(id) DO UPDATE SET label = excluded.label, payload = excluded.payload
                """;
            cmd.Parameters.AddWithValue("$id", id);
            cmd.Parameters.AddWithValue("$label", label ?? "");
            cmd.Parameters.AddWithValue("$payload", payloadJson);
            cmd.ExecuteNonQuery();
            return "ok";
        }
        catch (Exception ex) { return ex.Message; }
    }

    public string ParkedCarts()
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT id, label, payload, created_at FROM parked_carts ORDER BY created_at DESC";
            using var reader = cmd.ExecuteReader();
            var rows = new List<Dictionary<string, object?>>();
            while (reader.Read())
            {
                rows.Add(new Dictionary<string, object?>
                {
                    ["id"] = reader.GetString(0),
                    ["label"] = reader.GetString(1),
                    ["payload"] = JsonSerializer.Deserialize<JsonElement>(reader.GetString(2)),
                    ["created_at"] = reader.GetString(3),
                });
            }
            return JsonSerializer.Serialize(rows);
        }
        catch { return "[]"; }
    }

    public string RemoveParked(string id)
    {
        try
        {
            using var conn = Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM parked_carts WHERE id = $id";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
            return "ok";
        }
        catch (Exception ex) { return ex.Message; }
    }

    public class QueueEntry
    {
        [System.Text.Json.Serialization.JsonPropertyName("ref")] public string Ref { get; set; } = "";
        [System.Text.Json.Serialization.JsonPropertyName("sold_at")] public string? SoldAt { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("payload")] public JsonElement Payload { get; set; }
    }
}
