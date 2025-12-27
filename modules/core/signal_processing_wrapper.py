"""
信号处理包装模块
为 Web API 提供类型转换和错误处理
"""

import numpy as np
from . import signal_processing
from ..waveform_analysis import waveform_processing


class SignalProcessingWrapper:
    """信号处理包装类，处理 Web 层的类型转换和参数验证"""
    
    def __init__(self):
        """初始化"""
        pass
    
    def 小波降噪(self, 信号数据, 小波类型='sym6', 分解层数=5, 阈值方法='soft', 阈值模式='heursure'):
        """
        应用小波降噪（Web API 包装）
        
        参数:
            信号数据: 信号数组（可能是列表或numpy数组）
            小波类型: 小波类型字符串
            分解层数: 分解层数（可能是字符串或整数）
            阈值方法: 阈值方法
            阈值模式: 阈值模式
        
        返回:
            {"success": bool, "denoised_signal": array, ...}
        """
        try:
            # 类型转换：JavaScript 数组 → numpy 数组
            信号 = np.array(信号数据)
            
            # 参数验证和类型转换
            if not 小波类型 or 小波类型 == '':
                小波类型 = 'sym6'
            
            if not isinstance(分解层数, int):
                分解层数 = int(分解层数) if 分解层数 else 5
            
            if not 阈值方法:
                阈值方法 = 'soft'
            
            if not 阈值模式:
                阈值模式 = 'heursure'
            
            # 调用底层信号处理函数
            return signal_processing.apply_wavelet_denoising(
                信号, 小波类型, 分解层数, 阈值方法, 阈值模式
            )
        except Exception as e:
            return {
                'success': False,
                'message': f'小波降噪失败: {str(e)}'
            }
    
    def 带通滤波(self, 信号数据, 采样率, 低频截止, 高频截止, 滤波器阶数=6):
        """
        应用带通滤波（Web API 包装）
        
        参数:
            信号数据: 信号数组（可能是列表或numpy数组）
            采样率: 采样率（Hz）
            低频截止: 低频截止频率（Hz）
            高频截止: 高频截止频率（Hz）
            滤波器阶数: 滤波器阶数（默认6）
        
        返回:
            {"success": bool, "filtered": array, ...}
        """
        try:
            # 类型转换：JavaScript 数组 → numpy 数组
            信号 = np.array(信号数据)
            
            # 参数验证和类型转换
            采样率 = float(采样率)
            低频截止 = float(低频截止)
            高频截止 = float(高频截止)
            
            if not isinstance(滤波器阶数, int):
                滤波器阶数 = int(滤波器阶数) if 滤波器阶数 else 6
            
            # 调用底层信号处理函数
            return signal_processing.apply_bandpass_filter(
                信号, 采样率, 低频截止, 高频截止, 滤波器阶数
            )
        except Exception as e:
            return {
                'success': False,
                'message': f'带通滤波失败: {str(e)}'
            }
    
    def Hilbert变换(self, 信号数据):
        """
        计算Hilbert包络（Web API 包装）
        
        参数:
            信号数据: 信号数组
        
        返回:
            {"success": bool, "envelope": array, ...}
        """
        try:
            # 类型转换
            信号 = np.array(信号数据)
            
            # 调用波形分析模块的信号处理函数
            return waveform_processing.calculate_hilbert_envelope(信号)
        except Exception as e:
            return {
                'success': False,
                'message': f'Hilbert变换失败: {str(e)}'
            }
    
    def 检测峰值(self, 信号数据, 时间数据=None, 最小距离=None, 突出度=None):
        """
        检测信号峰值（Web API 包装）
        
        参数:
            信号数据: 信号数组
            时间数据: 时间数组（可选）
            最小距离: 峰值最小距离
            突出度: 峰值突出度
        
        返回:
            {"success": bool, "peaks": array, ...}
        """
        try:
            # 类型转换
            信号 = np.array(信号数据)
            时间 = np.array(时间数据) if 时间数据 else None
            
            # 调用波形分析模块的信号处理函数
            return waveform_processing.detect_peaks(信号, 时间, 最小距离, 突出度)
        except Exception as e:
            return {
                'success': False,
                'message': f'峰值检测失败: {str(e)}'
            }
    
    def 查找时间附近峰值(self, 时间数据, 信号数据, 目标时间, 窗口大小=200):
        """
        在指定时间附近查找峰值（Web API 包装）
        
        参数:
            时间数据: 时间数组
            信号数据: 信号数组
            目标时间: 目标时间点
            窗口大小: 搜索窗口大小
        
        返回:
            {"success": bool, "peak_time": float, ...}
        """
        try:
            # 类型转换
            时间 = np.array(时间数据)
            信号 = np.array(信号数据)
            
            # 调用波形分析模块的信号处理函数
            return waveform_processing.find_peak_near_time(时间, 信号, 目标时间, 窗口大小)
        except Exception as e:
            return {
                'success': False,
                'message': f'查找峰值失败: {str(e)}'
            }
    
    def 计算时间差(self, 时间1, 时间2):
        """
        计算两个时间点的时间差（Web API 包装）
        
        参数:
            时间1: 第一个时间点
            时间2: 第二个时间点
        
        返回:
            {"success": bool, "time_difference": float, ...}
        """
        try:
            # 调用波形分析模块的信号处理函数
            return waveform_processing.calculate_time_difference(时间1, 时间2)
        except Exception as e:
            return {
                'success': False,
                'message': f'计算时间差失败: {str(e)}'
            }
    
    def 获取可用小波类型(self):
        """
        获取可用的小波类型列表（Web API 包装）
        
        返回:
            {"success": bool, "wavelets": list}
        """
        try:
            # 调用波形分析模块的信号处理函数
            return waveform_processing.get_available_wavelets()
        except Exception as e:
            return {
                'success': False,
                'message': f'获取小波类型失败: {str(e)}'
            }
