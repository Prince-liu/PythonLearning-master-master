"""
实时采集模块
负责实时显示逻辑、文件保存（NPY/CSV/HDF5）
"""

from .realtime_capture import RealtimeCapture

__all__ = ['RealtimeCapture']
