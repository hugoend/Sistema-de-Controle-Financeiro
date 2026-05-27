@echo off
title Inicializador - Finanças da Família
cd /d "%~dp0"

:: Ativa o ambiente virtual se ele existir
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

echo [1/3] Iniciando o servidor Python...
:: Inicia o servidor em uma nova janela para não bloquear este script
start "Servidor - Finanças da Família" python app.py

echo [2/3] Aguardando o servidor carregar (3 segundos)...
timeout /t 3 /nobreak >nul

echo [3/3] Abrindo o navegador em http://localhost:5000...
start http://localhost:5000

exit