"""Verifica que la entrada única preserve el lector original y exponga nuevos paneles."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
class OriginalWorkerRoutesTest(unittest.TestCase):
    def test_usa_el_lector_existente(self):
        s=(ROOT/'src/worker-entry.js').read_text(encoding='utf-8')
        self.assertIn("import originalHtml from '../index.html'",s)
        self.assertIn("'/'",s)
        self.assertIn("'/index.html':originalHtml",s)
    def test_pc_movil_y_api_en_mismo_worker(self):
        s=(ROOT/'src/worker-entry.js').read_text(encoding='utf-8')
        for path in ("'/pc'","'/movil'","'/api/'"):
            self.assertIn(path,s)
        self.assertIn("syncApi.fetch(request,env)",s)
    def test_no_hay_despliegue_automatico_en_configuracion(self):
        s=(ROOT/'wrangler.example.toml').read_text(encoding='utf-8')
        self.assertIn('database_id = "7ef1c560-a37e-4c90-b898-a9456107f7ac"',s)
        self.assertIn('name = "lector-bin-leider"',s)
if __name__=='__main__':unittest.main()
