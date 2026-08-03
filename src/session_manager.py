"""
Modulo SessionManager: Extrae las cookies de sesión activas del navegador Google Chrome del médico 
para permitir peticiones HTTP en segundo plano a Everest sin abrir una segunda ventana ni romper la sesión.
"""

import os
import shutil
import sqlite3
import win32crypt
import json
import base64
from typing import Dict, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class ChromeSessionManager:
    def __init__(self, target_domain: str = "neps.everestintelligent.com"):
        self.target_domain = target_domain
        self.user_data_path = os.path.expanduser(
            r"~\AppData\Local\Google\Chrome\User Data"
        )
        self.cookies: Dict[str, str] = {}

    def _get_encryption_key(self) -> Optional[bytes]:
        """Obtiene la clave de cifrado Local State de Chrome en Windows."""
        local_state_path = os.path.join(self.user_data_path, "Local State")
        if not os.path.exists(local_state_path):
            return None

        try:
            with open(local_state_path, "r", encoding="utf-8") as f:
                local_state = json.load(f)

            encrypted_key = base64.b64decode(
                local_state["os_crypt"]["encrypted_key"]
            )
            # Quitar prefijo 'DPAPI' (5 bytes)
            encrypted_key = encrypted_key[5:]
            # Descifrar con DPAPI
            decrypted_key = win32crypt.CryptUnprotectData(encrypted_key, None, None, None, 0)[1]
            return decrypted_key
        except Exception as e:
            print(f"[SessionManager] Error obteniendo clave de cifrado: {e}")
            return None

    def _decrypt_cookie_value(self, encrypted_value: bytes, key: Optional[bytes]) -> str:
        """Descifra el valor de la cookie en Chrome (v10+ usa AES-256-GCM)."""
        if not encrypted_value:
            return ""

        try:
            # Si comienza con v10 o v11
            if encrypted_value[:3] in [b'v10', b'v11'] and key:
                nonce = encrypted_value[3:15]
                ciphertext = encrypted_value[15:]
                aesgcm = AESGCM(key)
                decrypted = aesgcm.decrypt(nonce, ciphertext, None)
                return decrypted.decode('utf-8')
            else:
                # DPAPI legacy
                decrypted = win32crypt.CryptUnprotectData(encrypted_value, None, None, None, 0)[1]
                return decrypted.decode('utf-8')
        except Exception:
            return ""

    def extract_cookies(self, profile: str = "Default") -> Dict[str, str]:
        """
        Lee y descifra la base de datos de cookies de Chrome para el dominio Everest.
        Copia temporalmente la base de datos para no bloquearla si Chrome está abierto.
        """
        cookie_db_path = os.path.join(self.user_data_path, profile, "Network", "Cookies")
        if not os.path.exists(cookie_db_path):
            # Intentar sin la subcarpeta Network (versiones anteriores)
            cookie_db_path = os.path.join(self.user_data_path, profile, "Cookies")

        if not os.path.exists(cookie_db_path):
            print(f"[SessionManager] Base de datos de cookies no encontrada en: {cookie_db_path}")
            return {}

        temp_db = os.path.join(os.environ.get("TEMP", "."), "everest_cookies_temp.db")
        try:
            shutil.copy2(cookie_db_path, temp_db)
        except Exception as e:
            print(f"[SessionManager] Error copiando BD de cookies: {e}")
            return {}

        key = self._get_encryption_key()
        extracted: Dict[str, str] = {}

        try:
            conn = sqlite3.connect(temp_db)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name, encrypted_value, value FROM cookies WHERE host_key LIKE ?",
                (f"%{self.target_domain}%",)
            )

            for name, enc_val, val in cursor.fetchall():
                if val:
                    extracted[name] = val
                elif enc_val:
                    decrypted_val = self._decrypt_cookie_value(enc_val, key)
                    if decrypted_val:
                        extracted[name] = decrypted_val

            conn.close()
        except Exception as e:
            print(f"[SessionManager] Error leyendo tabla de cookies: {e}")
        finally:
            if os.path.exists(temp_db):
                try:
                    os.remove(temp_db)
                except Exception:
                    pass

        self.cookies = extracted
        return extracted

if __name__ == "__main__":
    manager = ChromeSessionManager()
    cookies = manager.extract_cookies()
    print(f"Cookies extraídas para Everest: {len(cookies)} encontradas.")
