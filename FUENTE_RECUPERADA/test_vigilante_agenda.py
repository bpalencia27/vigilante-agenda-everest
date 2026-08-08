#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pruebas del nucleo del Vigilante de Agenda.

Cubren la logica que decide si hubo fraude, que es la que no puede fallar.
No exigen navegador ni Playwright: el motor es puro a proposito.

    python -m unittest test_vigilante_agenda -v
    pytest test_vigilante_agenda.py -q
"""

import csv
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from vigilante_agenda import (
    CONFIANZA_PARCIAL,
    CONFIANZA_PLENA,
    EN_REGLA,
    EXCLUIDA,
    INASISTENCIA,
    PENDIENTE,
    PREVENTIVA,
    REGISTRO_EXTEMPORANEO,
    TZ_BOGOTA,
    CitaObservada,
    Config,
    MotorAuditoria,
    _sanear_celda,
    clasificar_estado,
    extraer_documento,
    extraer_edad,
    guardar_reportes,
    normalizar_texto,
    parsear_fecha_es,
    parsear_hora_12h,
)

FECHA = dt.date(2026, 7, 28)


def t(hora, minuto, segundo=0):
    """Instante de hoy en hora de Bogota."""
    return dt.datetime.combine(FECHA, dt.time(hora, minuto, segundo), tzinfo=TZ_BOGOTA)


def cita(hora_texto="06:00 AM", estado="Sin presentarse", doc="43013650", idx=0):
    return CitaObservada(
        hora_texto=hora_texto,
        documento=doc,
        nombre="GLADYS ELENA ALVAREZ",
        estado_dom=estado,
        indice=idx,
    )


class TestNormalizacion(unittest.TestCase):
    def test_quita_tildes_y_espacios(self):
        self.assertEqual(normalizar_texto("  Atendió   la\n cita "), "ATENDIO LA CITA")

    def test_none_y_vacio(self):
        self.assertEqual(normalizar_texto(None), "")
        self.assertEqual(normalizar_texto(""), "")

    def test_clasificacion_de_estados_reales(self):
        self.assertEqual(clasificar_estado("Sin presentarse"), "PENDIENTE")
        self.assertEqual(clasificar_estado("En Sala"), "CONFIRMADO")
        self.assertEqual(clasificar_estado("  ATENDIDO  "), "CONFIRMADO")
        self.assertEqual(clasificar_estado("Atendida"), "CONFIRMADO")
        self.assertEqual(clasificar_estado("Cancelada"), "EXCLUIDA")

    def test_estado_desconocido_es_pendiente(self):
        # Conservador: puede sobrar una alerta, nunca faltar una.
        self.assertEqual(clasificar_estado("Estado nuevo de la IPS"), "PENDIENTE")


class TestParseoDeHora(unittest.TestCase):
    def test_formato_real_de_everest(self):
        self.assertEqual(parsear_hora_12h("06:40 AM"), (6, 40))
        self.assertEqual(parsear_hora_12h("11:30 AM"), (11, 30))

    def test_mediodia_y_medianoche(self):
        # El error clasico de %I/%p: 12 AM son las 00:00, no las 12:00.
        self.assertEqual(parsear_hora_12h("12:00 AM"), (0, 0))
        self.assertEqual(parsear_hora_12h("12:05 PM"), (12, 5))
        self.assertEqual(parsear_hora_12h("01:15 PM"), (13, 15))

    def test_variantes_de_escritura(self):
        self.assertEqual(parsear_hora_12h("12:05 p. m."), (12, 5))
        self.assertEqual(parsear_hora_12h("6:40am"), (6, 40))
        self.assertEqual(parsear_hora_12h("18:30"), (18, 30))

    def test_basura(self):
        for malo in (None, "", "Consultar", "25:99", "13:00 PM"):
            self.assertIsNone(parsear_hora_12h(malo), malo)


class TestParseoDeFechaYPaciente(unittest.TestCase):
    def test_fecha_en_espanol_del_encabezado(self):
        self.assertEqual(parsear_fecha_es("martes, 28 de julio de 2026"), FECHA)

    def test_fecha_numerica(self):
        self.assertEqual(parsear_fecha_es("Ultima cita: 28/07/2026"), FECHA)

    def test_fecha_invalida(self):
        self.assertIsNone(parsear_fecha_es("sin fecha"))
        self.assertIsNone(parsear_fecha_es("31 de febrero de 2026"))

    def test_documento_y_edad(self):
        crudo = " 43013650, 70 años"
        self.assertEqual(extraer_documento(crudo), "43013650")
        self.assertEqual(extraer_edad(crudo), "70")

    def test_documento_con_separadores(self):
        self.assertEqual(extraer_documento(" 1.234.567, 45 años"), "1234567")

    def test_documento_ausente(self):
        self.assertEqual(extraer_documento(""), "")
        # La edad NO debe colarse como documento: exigir 5-15 digitos evita
        # que la cita quede indexada por "70" y se mezcle con otra fila.
        self.assertEqual(extraer_documento(" , 70 años"), "")


class TestMaquinaDeEstados(unittest.TestCase):
    def motor(self, **kw):
        return MotorAuditoria(Config(**kw), FECHA)

    def test_llegada_dentro_de_la_gracia(self):
        m = self.motor()
        m.procesar([cita()], t(6, 0, 30))
        m.procesar([cita(estado="En Sala")], t(6, 4))
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, EN_REGLA)
        self.assertEqual(reg.confianza, CONFIANZA_PLENA)

    def test_llegada_a_tiempo_avisa_en_verde(self):
        """El medico debe ver que el paciente llego, no solo que no hubo falta."""
        m = self.motor()
        m.procesar([cita()], t(6, 0, 30))
        eventos = m.procesar([cita(estado="En Sala")], t(6, 4))
        self.assertEqual(len(eventos), 1)
        ev = eventos[0]
        self.assertEqual(ev.tipo, EN_REGLA)
        self.assertIn("A TIEMPO", ev.mensaje)
        self.assertIn("06:00", ev.quien)
        self.assertIn("Gladys", ev.quien)
        self.assertIn("sala", ev.detalle)
        # El detalle no repite el titulo del aviso: en pantalla van separados.
        self.assertNotIn("A TIEMPO", ev.detalle)

    def test_ya_confirmado_al_abrir_no_genera_aviso_verde(self):
        """Si al abrir el vigilante la fila ya estaba En Sala, no vio llegar a
        nadie: eso va al recuento del arranque, no a un aviso por paciente.

        Sigue contando como EN_REGLA (esta dentro de su ventana), pero sin
        anunciar una llegada que nadie presencio.
        """
        m = self.motor()
        eventos = m.procesar([cita(estado="En Sala")], t(6, 2))
        self.assertEqual(eventos, [])
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, EN_REGLA)
        self.assertEqual(reg.ultimo_visto_pendiente, "")

    def test_el_verde_vuelve_en_cuanto_se_observa_una_llegada(self):
        """Tras el arranque, las llegadas siguientes SI se avisan."""
        m = self.motor()
        # Una ya estaba confirmada al abrir; la otra llega despues.
        ya = cita(estado="En Sala")
        otra = cita(estado="Sin presentarse", doc="99887766", idx=1)
        eventos = m.procesar([ya, otra], t(6, 1))
        self.assertEqual(eventos, [], "la que ya estaba no debe avisar")
        eventos = m.procesar(
            [ya, cita(estado="En Sala", doc="99887766", idx=1)], t(6, 3))
        self.assertEqual(len(eventos), 1, "la llegada observada si avisa")
        self.assertEqual(eventos[0].tipo, EN_REGLA)

    def test_el_verde_se_avisa_una_sola_vez(self):
        m = self.motor()
        m.procesar([cita()], t(6, 0, 30))          # primero se ve pendiente
        self.assertEqual(len(m.procesar([cita(estado="En Sala")], t(6, 1))), 1)
        for minuto in (2, 3, 4, 5):
            self.assertEqual(m.procesar([cita(estado="En Sala")], t(6, minuto)), [])

    def test_arranque_tardio_no_acusa_a_nadie(self):
        """Regresion: el build del 29-07-2026 declaraba REGISTRO_EXTEMPORANEO
        con confianza PLENA a quien ya estaba en sala en la primera lectura.

        El "retraso" que reportaba era la distancia entre la hora de la cita y
        la hora de arranque del programa, no un retraso del paciente. Sin haber
        visto la fila pendiente no hay nada que acusar: ni alerta, ni PLENA.
        """
        m = self.motor()
        eventos = m.procesar([cita(estado="En Sala")], t(9, 0))
        self.assertEqual(eventos, [])
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, EN_REGLA)
        self.assertEqual(reg.confianza, CONFIANZA_PARCIAL)
        self.assertNotEqual(reg.resultado, REGISTRO_EXTEMPORANEO)
        self.assertEqual(reg.ultimo_visto_pendiente, "")

    def test_atendido_cuenta_como_llegada_no_como_excluida(self):
        """Regresion: el build del 29-07-2026 mandaba 'Atendido' a EXCLUIDA y
        los pacientes ya atendidos desaparecian del conteo del turno."""
        for estado in ("Atendido", "Atendida", "En atencion", "Atendiendo"):
            with self.subTest(estado=estado):
                m = self.motor()
                m.procesar([cita()], t(6, 0, 30))
                eventos = m.procesar([cita(estado=estado)], t(6, 4))
                reg = next(iter(m.registros.values()))
                self.assertEqual(reg.resultado, EN_REGLA)
                self.assertEqual(len(eventos), 1)

    def test_el_segundo_5_59_todavia_es_gracia(self):
        m = self.motor()
        eventos = m.procesar([cita()], t(6, 5, 59))
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo, PREVENTIVA)
        self.assertEqual(next(iter(m.registros.values())).resultado, PENDIENTE)

    def test_a_las_6_00_es_inasistencia(self):
        m = self.motor()
        m.procesar([cita()], t(6, 5, 59))
        eventos = m.procesar([cita()], t(6, 6, 0))
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo, INASISTENCIA)
        self.assertIn("AUSENCIA", eventos[0].mensaje)
        self.assertEqual(next(iter(m.registros.values())).resultado, INASISTENCIA)

    def test_registro_extemporaneo_es_el_hallazgo_rojo(self):
        m = self.motor()
        m.procesar([cita()], t(6, 5))
        m.procesar([cita()], t(6, 6))                       # inasistencia
        eventos = m.procesar([cita(estado="En Sala")], t(6, 20))
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo, REGISTRO_EXTEMPORANEO)
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, REGISTRO_EXTEMPORANEO)
        self.assertEqual(reg.confianza, CONFIANZA_PLENA)
        self.assertIn("20 min", reg.nota)

    def test_cada_alerta_se_emite_una_sola_vez(self):
        m = self.motor()
        m.procesar([cita()], t(6, 5))
        self.assertEqual(len(m.procesar([cita()], t(6, 6))), 1)
        for minuto in (7, 8, 9, 30):
            self.assertEqual(m.procesar([cita()], t(6, minuto)), [])

    def test_cita_cancelada_no_genera_alerta(self):
        m = self.motor()
        eventos = m.procesar([cita(estado="Cancelada")], t(9, 0))
        self.assertEqual(eventos, [])
        self.assertEqual(next(iter(m.registros.values())).resultado, EXCLUIDA)

    def test_arranque_tardio_no_certifica_lo_que_no_vio(self):
        """El vigilante arranca a las 9 y la cita de las 6 ya figura 'En Sala'.

        No puede saber si la marcaron a las 6:02 o a las 8:50, asi que la
        registra como EN_REGLA pero con confianza PARCIAL.
        """
        m = self.motor()
        m.procesar([cita(estado="En Sala")], t(9, 0))
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, EN_REGLA)
        self.assertEqual(reg.confianza, CONFIANZA_PARCIAL)
        self.assertIn("no se puede certificar", reg.nota)

    def test_confirmacion_justo_en_el_corte_es_plena(self):
        """Visto pendiente a las 6:05:50 y presente a las 6:06:05: la ventana
        ciega es de segundos, se puede afirmar que llego a tiempo."""
        m = self.motor()
        m.procesar([cita()], t(6, 5, 50))
        m.procesar([cita(estado="En Sala")], t(6, 6, 5))
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.resultado, EN_REGLA)
        self.assertEqual(reg.confianza, CONFIANZA_PLENA)

    def test_dos_pacientes_a_la_misma_hora_son_dos_registros(self):
        """La version anterior los mezclaba: buscaba el texto de la hora y se
        quedaba con la primera coincidencia."""
        m = self.motor()
        a = cita(doc="43013650", idx=0)
        b = cita(doc="43433955", idx=1, estado="En Sala")
        m.procesar([a, b], t(6, 6))
        self.assertEqual(len(m.registros), 2)
        resultados = {r.documento: r.resultado for r in m.registros.values()}
        self.assertEqual(resultados["43013650"], INASISTENCIA)
        self.assertEqual(resultados["43433955"], EN_REGLA)

    def test_fila_sin_documento_usa_la_posicion(self):
        m = self.motor()
        m.procesar([cita(doc="", idx=3)], t(6, 1))
        self.assertIn("POS003", next(iter(m.registros.values())).clave)

    def test_hora_ilegible_se_ignora_sin_romper(self):
        m = self.motor()
        self.assertEqual(m.procesar([cita(hora_texto="Consultar")], t(9, 0)), [])
        self.assertEqual(m.registros, {})

    def test_agenda_fuera_de_vista_no_inventa_inasistencias(self):
        """Si el medico entra a una historia clinica, la lista desaparece del
        DOM. Un snapshot vacio no debe convertir a nadie en infractor."""
        m = self.motor()
        m.procesar([cita()], t(6, 1))
        eventos = m.procesar([], t(6, 30))
        self.assertEqual(eventos, [])
        self.assertEqual(next(iter(m.registros.values())).resultado, PENDIENTE)

    def test_datos_del_paciente_no_se_borran_al_repintar(self):
        """Angular puede entregar una pasada con los labels aun vacios."""
        m = self.motor()
        m.procesar([cita()], t(6, 1))
        incompleta = CitaObservada(hora_texto="06:00 AM", documento="43013650", indice=0)
        m.procesar([incompleta], t(6, 2))
        reg = next(iter(m.registros.values()))
        self.assertEqual(reg.nombre, "GLADYS ELENA ALVAREZ")

    def test_gracia_configurable(self):
        m = self.motor(gracia_seg=119)          # 1:59
        self.assertEqual(m.procesar([cita()], t(6, 1, 59)), [])
        self.assertEqual(len(m.procesar([cita()], t(6, 2, 0))), 1)


class TestPersistenciaYReporte(unittest.TestCase):
    def test_estado_sobrevive_un_reinicio(self):
        m = MotorAuditoria(Config(), FECHA)
        m.procesar([cita()], t(6, 5))
        m.procesar([cita()], t(6, 6))                        # inasistencia
        revivido = MotorAuditoria.desde_dict(json.loads(json.dumps(m.a_dict())), Config())

        # No debe repetir la alerta ya emitida...
        self.assertEqual(revivido.procesar([cita()], t(6, 10)), [])
        # ...pero si debe seguir cazando el registro extemporaneo.
        eventos = revivido.procesar([cita(estado="En Sala")], t(6, 25))
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo, REGISTRO_EXTEMPORANEO)

    def test_csv_para_excel_en_espanol(self):
        m = MotorAuditoria(Config(), FECHA)
        m.procesar([cita()], t(6, 5))
        m.procesar([cita()], t(6, 6))
        with tempfile.TemporaryDirectory() as tmp:
            ruta_csv, ruta_json = guardar_reportes(m, Path(tmp))
            crudo = ruta_csv.read_bytes()
            self.assertTrue(crudo.startswith(b"\xef\xbb\xbf"), "falta el BOM")
            texto = crudo.decode("utf-8-sig")
            filas = list(csv.reader(texto.splitlines(), delimiter=";"))
            self.assertEqual(filas[0][0], "JORNADA / TURNO AUDITADO")
            self.assertEqual(filas[2][0], "Fecha")
            self.assertEqual(filas[3][3], "43013650")
            self.assertEqual(filas[3][8], "Inasistencia")
            self.assertIn("Resumen del turno", texto)
            datos = json.loads(ruta_json.read_text(encoding="utf-8"))
            self.assertEqual(datos["resumen"][INASISTENCIA], 1)

    def test_neutraliza_formulas_de_excel(self):
        # Los nombres llegan de otro sistema: '=cmd|...' no puede ejecutarse.
        self.assertEqual(_sanear_celda("=1+1"), "'=1+1")
        self.assertEqual(_sanear_celda("-HIPERVINCULO(...)"), "'-HIPERVINCULO(...)")
        self.assertEqual(_sanear_celda("GLADYS ALVAREZ"), "GLADYS ALVAREZ")
        self.assertEqual(_sanear_celda(None), "")

    def test_reporte_no_se_corrompe_a_medias(self):
        m = MotorAuditoria(Config(), FECHA)
        m.procesar([cita()], t(6, 6))
        with tempfile.TemporaryDirectory() as tmp:
            salida = Path(tmp)
            guardar_reportes(m, salida)
            m.procesar([cita(estado="En Sala")], t(6, 30))
            guardar_reportes(m, salida)
            # Una sola version del archivo y ningun temporal huerfano.
            self.assertEqual(len(list(salida.glob("*.csv"))), 1)
            self.assertEqual(list(salida.glob("*.tmp")), [])


class TestFinDeTurno(unittest.TestCase):
    def motor(self, **kw):
        return MotorAuditoria(Config(**kw), FECHA)

    def test_resumen_de_cierre_muestra_metricas_ejecutivas(self):
        from vigilante_agenda import resumen_de_cierre
        m = self.motor()
        m.procesar([cita()], t(6, 0, 30))
        m.procesar([cita(estado="En Sala")], t(6, 4))
        titulo, balance = resumen_de_cierre(m)
        self.assertIn("RESUMEN DE JORNADA", titulo)
        self.assertIn("1 a tiempo", balance)

    def test_resumen_de_cierre_multiples_ausencias(self):
        from vigilante_agenda import resumen_de_cierre
        m = self.motor()
        for i, doc in enumerate(("11111111", "22222222")):
            m.procesar([cita(doc=doc, idx=i)], t(6, 5))
            m.procesar([cita(doc=doc, idx=i)], t(6, 7))
        _, balance = resumen_de_cierre(m)
        self.assertIn("2 ausencias", balance)

    def test_el_reporte_dice_confirmacion_tardia(self):
        """El aviso y la columna del CSV deben llamarse igual."""
        from vigilante_agenda import ETIQUETAS_RESULTADO, TITULOS_AVISO
        self.assertEqual(ETIQUETAS_RESULTADO[REGISTRO_EXTEMPORANEO],
                         "Confirmación extemporánea")
        self.assertIn("EXTEMPORÁNEA", TITULOS_AVISO[REGISTRO_EXTEMPORANEO])
        m = self.motor()
        m.procesar([cita()], t(6, 5))
        m.procesar([cita()], t(6, 6))
        m.procesar([cita(estado="En Sala")], t(6, 20))
        fila = m.filas_csv()[0]
        self.assertEqual(fila[8], "Confirmación extemporánea")

    def test_ultima_hora_de_la_agenda(self):
        m = MotorAuditoria(Config(), FECHA)
        m.procesar(
            [cita("06:00 AM", doc="1", idx=0), cita("11:40 AM", doc="2", idx=1)],
            t(6, 0),
        )
        self.assertEqual(m.ultima_hora_cita(), t(11, 40))


if __name__ == "__main__":
    unittest.main(verbosity=2)
