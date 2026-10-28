"""Pruebas ligeras de integración de los paneles, sin desplegar."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
class PanelsSmokeTest(unittest.TestCase):
 def setUp(self):
  self.pc=(ROOT/"pc.html").read_text(encoding="utf-8")
  self.mobile=(ROOT/"mobile-sync.html").read_text(encoding="utf-8")
  self.api=(ROOT/"src/sync-api.js").read_text(encoding="utf-8")
 def test_pc_inicia_y_finaliza(self):
  self.assertIn("'/weighings','POST'",self.pc)
  self.assertIn("'/finalize','POST'",self.pc)
  self.assertIn("expected_revision:state.weighing.revision",self.pc)
 def test_movil_inicia_y_finaliza(self):
  self.assertIn("'/weighings','POST'",self.mobile)
  self.assertIn("'/finalize','POST'",self.mobile)
  self.assertIn("expected_revision:w.revision",self.mobile)
 def test_pc_enter_guarda_y_avanza(self):
  self.assertIn("event.key!=='Enter'",self.pc)
  self.assertIn("await saveAndAdvance(row.id,input)",self.pc)
  self.assertIn("nextInput.focus()",self.pc)
 def test_panels_consultan_estado(self):
  for source in (self.pc,self.mobile):
   self.assertIn("setInterval(async()=>",source)
   self.assertIn("await refresh()",source) if source==self.mobile else self.assertIn("await refreshList()",source)
 def test_no_tokens_grabados_en_almacenamiento(self):
  for source in (self.pc,self.mobile):
   self.assertNotIn("localStorage.setItem",source)
   self.assertNotIn("sessionStorage.setItem",source)
 def test_bin_manual_permanece_si_falla_guardado(self):
  self.assertIn("return await run(async()=>",self.mobile)
  self.assertIn("if(saved)$(\'manual\').value=\'\'",self.mobile)
  self.assertIn("return false",self.mobile)
 def test_login_con_usuario_y_contrasena(self):
  for panel in (self.pc,self.mobile):
   self.assertIn('id="username"',panel)
   self.assertIn('id="password"',panel)
   self.assertIn("'/api/login'",panel)
 def test_backend_valida_permisos_y_cierre(self):
  self.assertIn("login_sessions",self.api)
  self.assertIn("status='active'",self.api)
  self.assertIn("revision=revision+1",self.api)

if __name__=="__main__":unittest.main()
