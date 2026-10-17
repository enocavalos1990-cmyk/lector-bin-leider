"""Prueba SQLite de asignación de posiciones usada por la API D1."""
import pathlib
import sqlite3
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "migrations" / "0001_shared_weighings.sql"
API = ROOT / "src" / "sync-api.js"

class ServerPositionsTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript(SCHEMA.read_text(encoding="utf-8"))
        self.db.execute("INSERT INTO workspaces(id,name) VALUES ('w1','Recepción')")
        self.db.execute("INSERT INTO weighings(id,workspace_id,display_number,local_day,started_at) VALUES ('p1','w1',1,'2026-10-17','2026-10-17T12:00:00Z')")
        # Obtiene la sentencia SQL real, evitando probar una copia diferente.
        source = API.read_text(encoding="utf-8")
        marker = 'INSERT INTO weighing_rows(id,weighing_id,position,bin_code,folio,manual,gross_kg,tare_kg) SELECT '
        self.assertIn(marker,source)
        self.insert_sql = source.split(marker,1)[1].split('"',1)[0]
        self.insert_sql = marker + self.insert_sql

    def tearDown(self):
        self.db.close()

    def add(self,id,code):
        return self.db.execute(self.insert_sql,(id,code,code,0,None,41,"p1","w1")).rowcount

    def test_asigna_filas_seguidas_y_mantiene_orden(self):
        self.assertEqual(self.add("r1","2589"),1)
        self.assertEqual(self.add("r2","2609"),1)
        self.assertEqual(self.add("r3","2616"),1)
        self.assertEqual(self.db.execute("SELECT position,bin_code FROM weighing_rows ORDER BY position").fetchall(),
                         [(1,"2589"),(2,"2609"),(3,"2616")])

    def test_rechaza_codigo_duplicado(self):
        self.add("r1","2589")
        with self.assertRaises(sqlite3.IntegrityError):
            self.add("r2","2589")

    def test_no_agrega_bin_despues_del_cierre(self):
        self.add("r1","2589")
        self.db.execute("UPDATE weighings SET status='finalized',finalized_at='2026-10-17T12:20:00Z' WHERE id='p1'")
        self.assertEqual(self.add("r2","2609"),0)
        self.assertEqual(self.db.execute("SELECT count(*) FROM weighing_rows").fetchone()[0],1)

if __name__=="__main__":
    unittest.main()
