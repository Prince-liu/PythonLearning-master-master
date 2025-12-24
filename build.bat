@echo off
chcp 65001 >nul 2>&1

REM Activate virtual environment
echo Activating virtual environment...
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found, using system Python
)
echo.

cls
mode con cols=120 lines=40
echo ========================================
echo Oscilloscope Signal Analysis Tool
echo Nuitka Build Script
echo ========================================
echo.
echo Building standalone executable...
echo This may take 10-20 minutes, please wait...
echo.

python -m nuitka ^
    --standalone ^
    --jobs=6 ^
    --lto=no ^
    --mingw64 ^
    --assume-yes-for-downloads ^
    --low-memory ^
    --enable-plugin=anti-bloat ^
    --nofollow-import-to=torch ^
    --nofollow-import-to=torchvision ^
    --nofollow-import-to=pandas ^
    --nofollow-import-to=unittest ^
    --nofollow-import-to=pytest ^
    --nofollow-import-to=setuptools ^
    --nofollow-import-to=IPython ^
    --nofollow-import-to=notebook ^
    --nofollow-import-to=tkinter ^
    --nofollow-import-to=doctest ^
    --nofollow-import-to=pytz ^
    --nofollow-import-to=jaraco ^
    --nofollow-import-to=matplotlib.tests ^
    --nofollow-import-to=scipy.tests ^
    --enable-plugin=no-qt ^
    --include-package=webview ^
    --include-package=numpy ^
    --include-package=scipy ^
    --include-package=pywt ^
    --include-package=h5py ^
    --include-package=pyvisa ^
    --include-package=shapely ^
    --include-package=matplotlib ^
    --include-package=openpyxl ^
    --include-package-data=scipy ^
    --include-package-data=shapely ^
    --nofollow-import-to=webview.platforms.android ^
    --nofollow-import-to=webview.platforms.cocoa ^
    --nofollow-import-to=webview.platforms.qt ^
    --nofollow-import-to=webview.platforms.gtk ^
    --nofollow-import-to=pywt.tests ^
    --include-data-dir=static=static ^
    --include-data-dir=modules=modules ^
    --windows-console-mode=force ^
    --output-dir=dist ^
    main.py

if errorlevel 1 (
    echo.
    echo ========================================
    echo Build Failed!
    echo ========================================
    echo.
    echo Possible reasons:
    echo 1. Nuitka not installed or incompatible version
    echo 2. MinGW64 compiler not installed
    echo 3. Missing dependencies or version conflicts
    echo.
    echo Please check:
    echo - pip install nuitka
    echo - pip install ordered-set
    echo - Ensure MinGW64 is installed
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Output directory: dist\main.dist\
echo Executable: dist\main.dist\main.exe
echo.
echo Notes:
echo 1. First run requires NI-VISA or Keysight IO Libraries
echo 2. Requires Edge WebView2 Runtime (built-in on Windows 10/11)
echo 3. Data directory will be created automatically on first run
echo.
pause
