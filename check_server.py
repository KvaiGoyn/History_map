import socket
import time
import sys

def check_port(port):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result == 0
    except:
        return False

print("Проверка портов...")
for port in [8000, 8080, 3000]:
    if check_port(port):
        print(f"✓ Порт {port} открыт")
        print(f"  Сайт доступен по адресу: http://localhost:{port}/")
    else:
        print(f"✗ Порт {port} закрыт")

print("\nДля открытия сайта в браузере:")
print("1. Откройте браузер")
print("2. Введите адрес: http://localhost:8000/")
print("3. Или: http://localhost:8080/ (если старый сервер еще работает)")