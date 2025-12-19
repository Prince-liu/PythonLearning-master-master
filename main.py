"""
普源示波器实时波形显示系统
主程序入口
"""

from web_gui import 启动


if __name__ == "__main__":
    try:
        启动()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        import sys
        sys.stderr.write(f"\n错误: {e}\n")
