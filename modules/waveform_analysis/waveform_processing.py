"""
波形处理模块
包含波形分析专用的信号处理功能：Hilbert变换、峰值检测、时间差计算
这些功能仅用于波形分析模块
"""

import numpy as np
from scipy.signal import hilbert, find_peaks


def calculate_hilbert_envelope(signal):
    """
    计算 Hilbert 包络
    
    Args:
        signal: 输入信号数组
        
    Returns:
        dict: {'success': bool, 'envelope': array}
    """
    try:
        envelope = np.abs(hilbert(signal))
        return {
            'success': True,
            'envelope': envelope.tolist()
        }
    except Exception as e:
        return {'success': False, 'message': f'Hilbert变换失败: {str(e)}'}


def detect_peaks(signal, time_array=None, min_distance=None, prominence=None):
    """
    检测信号中的峰值
    
    Args:
        signal: 输入信号数组
        time_array: 时间数组（可选）
        min_distance: 峰值之间的最小距离
        prominence: 峰值的最小突出度
        
    Returns:
        dict: {'success': bool, 'peaks': list of {'index': int, 'time': float, 'voltage': float}}
    """
    try:
        # 设置默认参数
        kwargs = {}
        if min_distance is not None:
            kwargs['distance'] = min_distance
        if prominence is not None:
            kwargs['prominence'] = prominence
        
        # 检测峰值
        peak_indices, properties = find_peaks(signal, **kwargs)
        
        # 构建峰值列表
        peaks = []
        for idx in peak_indices:
            peak_info = {
                'index': int(idx),
                'voltage': float(signal[idx])
            }
            if time_array is not None:
                peak_info['time'] = float(time_array[idx])
            peaks.append(peak_info)
        
        return {
            'success': True,
            'peaks': peaks,
            'count': len(peaks)
        }
    except Exception as e:
        return {'success': False, 'message': f'峰值检测失败: {str(e)}'}


def find_peak_near_time(time_array, signal, target_time, window_size=200):
    """
    在指定时间附近查找波峰
    
    Args:
        time_array: 时间数组
        signal: 信号数组
        target_time: 目标时间
        window_size: 搜索窗口大小（点数）
        
    Returns:
        dict: {'success': bool, 'index': int, 'time': float, 'voltage': float}
    """
    try:
        # 找到目标时间对应的索引
        target_idx = np.argmin(np.abs(time_array - target_time))
        
        # 小窗口搜索
        win = min(window_size, len(time_array) - 1)
        search_lo = max(0, target_idx - win)
        search_hi = min(len(time_array), target_idx + win)
        
        peaks, _ = find_peaks(signal[search_lo:search_hi])
        
        if len(peaks) == 0:
            # 回退：全局找峰
            peaks_all, _ = find_peaks(signal)
            if len(peaks_all) == 0:
                return {'success': False, 'message': '未找到峰值'}
            else:
                # 找最靠近 target_idx 的峰
                nearest_peak_idx = np.argmin(np.abs(peaks_all - target_idx))
                peak_idx = peaks_all[nearest_peak_idx]
        else:
            # 局部找到峰，映射回全局索引
            locs_global = search_lo + peaks
            nearest_peak_idx = np.argmin(np.abs(locs_global - target_idx))
            peak_idx = locs_global[nearest_peak_idx]
        
        return {
            'success': True,
            'index': int(peak_idx),
            'time': float(time_array[peak_idx]),
            'voltage': float(signal[peak_idx])
        }
    except Exception as e:
        return {'success': False, 'message': f'查找峰值失败: {str(e)}'}


def calculate_time_difference(time1, time2):
    """
    计算两个时间点之间的时间差
    
    Args:
        time1: 第一个时间点
        time2: 第二个时间点
        
    Returns:
        dict: {'success': bool, 'time_diff': float, 'time_diff_us': float}
    """
    try:
        time_diff = abs(time2 - time1)
        time_diff_us = time_diff * 1e6  # 转换为微秒
        
        return {
            'success': True,
            'time_diff': float(time_diff),
            'time_diff_us': float(time_diff_us)
        }
    except Exception as e:
        return {'success': False, 'message': f'计算时间差失败: {str(e)}'}


def get_available_wavelets():
    """
    获取可用的小波类型列表
    
    Returns:
        dict: {'success': bool, 'wavelets': dict}
    """
    try:
        wavelets = {
            'Daubechies': [f'db{i}' for i in range(1, 11)],
            'Symlets': [f'sym{i}' for i in range(2, 11)],
            'Coiflets': [f'coif{i}' for i in range(1, 6)],
            'Biorthogonal': [f'bior{i}.{j}' for i in range(1, 4) for j in range(1, 4)],
            'Haar': ['haar']
        }
        
        return {
            'success': True,
            'wavelets': wavelets
        }
    except Exception as e:
        return {'success': False, 'message': f'获取小波类型失败: {str(e)}'}


def truncate_signal(time_array, signal_array, truncate_time_us=5.0):
    """
    截断信号前面的数据
    
    Args:
        time_array: 时间数组（微秒）
        signal_array: 信号数组
        truncate_time_us: 截断时间（微秒）
        
    Returns:
        tuple: (truncated_time, truncated_signal)
    """
    # 找到截断点
    truncate_idx = np.searchsorted(time_array, truncate_time_us)
    
    if truncate_idx >= len(time_array):
        truncate_idx = 0
    
    # 截断数据
    truncated_time = time_array[truncate_idx:]
    truncated_signal = signal_array[truncate_idx:]
    
    # 重置时间起点为0
    if len(truncated_time) > 0:
        truncated_time = truncated_time - truncated_time[0]
    
    return truncated_time, truncated_signal


def truncate_signal_range(time_array, signal_array, start_time_us=None, end_time_us=None):
    """
    截取信号指定时间范围的数据
    
    Args:
        time_array: 时间数组（微秒）
        signal_array: 信号数组
        start_time_us: 起始时间（微秒），None表示从信号开头开始
        end_time_us: 结束时间（微秒），None表示到信号末尾
        
    Returns:
        tuple: (truncated_time, truncated_signal)
    """
    # 找到起始截断点
    if start_time_us is not None:
        start_idx = np.searchsorted(time_array, start_time_us)
        if start_idx >= len(time_array):
            start_idx = 0
    else:
        start_idx = 0  # None表示从头开始
    
    # 找到结束截断点
    if end_time_us is not None:
        end_idx = np.searchsorted(time_array, end_time_us)
        if end_idx > len(time_array):
            end_idx = len(time_array)
    else:
        end_idx = len(time_array)  # None表示到末尾
    
    # 截取数据
    truncated_time = time_array[start_idx:end_idx]
    truncated_signal = signal_array[start_idx:end_idx]
    
    # 重置时间起点为0
    if len(truncated_time) > 0:
        truncated_time = truncated_time - truncated_time[0]
    
    return truncated_time, truncated_signal
