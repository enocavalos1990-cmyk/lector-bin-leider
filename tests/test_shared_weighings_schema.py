"""Pruebas del esquema D1 usando SQLite (sin Cloudflare ni credenciales)."""
import pathlib
import sqlite3
import unittest

SCHEMA = pathlib.Path(__file__).resolve().parents[1] / "migrations" / "0001_shared_weighings.sql"

class SharedWeighingsSchemaTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workspaces(id,name) VALUES (?,?)", ("w1","Recepción"))
        self.db.execute("""INSERT INTO weighings
            (id,workspace_id,display_number,local_day,started_at)
            VALUES (?,?,?,?,?)""",
            ("p1","w1",1,"2026-10-17","2026-10-17T12:00:00Z"))

    def tearDown(self):
        self.db.close()

    def insert_row(self, row_id, position, bin_code, gross=None, tare=41):
        self.db.execute("""INSERT INTO weighing_rows
            (id,weighing_id,position,bin_code,gross_kg,tare_kg)
            VALUES (?,?,?,?,?,?)""", (row_id,"p1",position,bin_code,gross,tare))

    def test_neto_y_peso_pendiente(self):
        self.insert_row("r1",1,"2589",440,41)
        self.insert_row("r2",2,"2609",None,44)
        self.assertEqual(self.db.execute(
            "SELECT net_kg FROM weighing_rows WHERE id='r1'").fetchone()[0],399)
        self.assertIsNone(self.db.execute(
            "SELECT net_kg FROM weighing_rows WHERE id='r2'").fetchone()[0])
        self.db.execute("UPDATE weighing_rows SET gross_kg=500 WHERE id='r2'")
        self.assertEqual(self.db.execute(
            "SELECT net_kg FROM weighing_rows WHERE id='r2'").fetchone()[0],456)

    def test_orden_estable(self):
        self.insert_row("r1",1,"2589")
        self.insert_row("r2",2,"2609")
        self.insert_row("r3",3,"2616")
        self.db.execute("UPDATE weighing_rows SET gross_kg=450 WHERE id='r2'")
        self.assertEqual([r[0] for r in self.db.execute(
            "SELECT bin_code FROM weighing_rows WHERE weighing_id='p1' ORDER BY position")],
            ["2589","2609","2616"])

    def test_bin_duplicado_se_rechaza_pero_nn_puede_repetirse(self):
        self.insert_row("r1",1,"2589")
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_row("r2",2,"2589")
        self.insert_row("r3",2,"NN")
        self.insert_row("r4",3,"NN")

    def test_posicion_repetida_se_rechaza(self):
        self.insert_row("r1",1,"2589")
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_row("r2",1,"2609")

    def test_tara_invalida_se_rechaza(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_row("r1",1,"2589",440,40)

    def test_dispositivo_exige_workspace_existente(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO authorized_devices
                (id,workspace_id,label,token_hash) VALUES (?,?,?,?)""",
                ("d1","no-existe","PC","hash-de-prueba"))

    def test_pesaje_finalizado_necesita_fecha(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE weighings SET status='finalized' WHERE id='p1'")
        self.db.execute("""UPDATE weighings SET status='finalized',
            finalized_at='2026-10-17T12:20:00Z' WHERE id='p1'""")
        self.assertEqual(self.db.execute(
            "SELECT status FROM weighings WHERE id='p1'").fetchone()[0],"finalized")

if __name__ == "__main__":
    unittest.main()
