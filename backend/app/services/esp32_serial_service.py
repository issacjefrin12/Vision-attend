"""ESP32 serial notifier with cooldown protection."""
from __future__ import annotations

import os
import time
from threading import Lock

try:
    import serial
except ImportError:  # pragma: no cover - depends on optional serial deps
    serial = None


ESP32_PORT = os.getenv("ESP32_SERIAL_PORT", "COM9")
ESP32_BAUD = int(os.getenv("ESP32_SERIAL_BAUD", "115200"))
ESP32_TIMEOUT = float(os.getenv("ESP32_SERIAL_TIMEOUT", "1"))
cooldown = float(os.getenv("ESP32_SERIAL_COOLDOWN", "3"))

esp = None
last_sent_time = 0.0
_send_lock = Lock()

if serial is not None:
    try:
        esp = serial.Serial(ESP32_PORT, ESP32_BAUD, timeout=ESP32_TIMEOUT)
        time.sleep(2)
    except Exception as exc:  # pragma: no cover - hardware dependent
        print(f"ESP32 serial unavailable on {ESP32_PORT}: {exc}")
        esp = None


class ESP32SerialService:
    """Send attendance recognition status to ESP32 over serial."""

    def _send(self, message: str) -> bool:
        global last_sent_time
        if esp is None:
            return False

        now = time.time()
        with _send_lock:
            if now - last_sent_time <= cooldown:
                return False

            try:
                esp.write(message.encode())
                last_sent_time = now
                return True
            except Exception as exc:  # pragma: no cover - hardware dependent
                print("ESP32 serial error:", exc)
                return False

    def send_success(self, student_name: str) -> bool:
        return self._send(f"SUCCESS:{student_name}\n")

    def send_error(self) -> bool:
        return self._send("ERROR\n")


esp32_serial_service = ESP32SerialService()
