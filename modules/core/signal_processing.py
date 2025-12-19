"""
信号处理模块
包含小波降噪、Hilbert变换、峰值检测等功能
整合自 WaveDealer 项目
"""

import numpy as np
from scipy.signal import hilbert, find_peaks
import pywt


def apply_wavelet_denoising(signal, wavelet='sym6', level=5, threshold_method='soft', threshold_mode='heursure'):
    """
    应用小波降噪
    
    Args:
        signal: 输入信号
        wavelet: 小波类型 (如 'db4', 'sym6', 'coif2')
        level: 分解层数
        threshold_method: 阈值方法 ('soft' 或 'hard')
        threshold_mode: 阈值模式 ('universal', 'heursure', 'minimax')
        
    Returns:
        dict: {'success': bool, 'denoised': array, 'threshold': float, 'sigma': float}
    """
    try:
        # 参数验证和默认值设置
        if not wavelet or wavelet == '' or wavelet is None:
            wavelet = 'sym6'
        
        if not isinstance(level, int) or level < 1:
            level = 5
        
        if threshold_method not in ['soft', 'hard']:
            threshold_method = 'soft'
        
        if threshold_mode not in ['universal', 'heursure', 'minimax']:
            threshold_mode = 'heursure'
        
        # 使用 PyWavelets 进行小波分解
        coeffs = pywt.wavedec(signal, wavelet, level=level)
        
        # 对每一层细节系数应用阈值
        coeffs_thresh = [coeffs[0]]  # 保留近似系数
        threshold_used = 0
        sigma_used = 0
        
        for i in range(1, len(coeffs)):
            detail_coeffs = coeffs[i]
            N = len(detail_coeffs)
            
            # 估计该层的噪声标准差
            sigma = np.median(np.abs(detail_coeffs)) / 0.6745
            sigma_used = max(sigma_used, sigma)
            
            if sigma < 1e-10:  # 避免除零
                coeffs_thresh.append(detail_coeffs)
                continue
            
            # 根据模式选择阈值
            if threshold_mode == 'heursure':
                # Heursure: 自适应选择 Universal 或 SURE 阈值
                thr_universal = sigma * np.sqrt(2 * np.log(N))
                thr_sure = _calculate_sure_threshold(detail_coeffs, sigma)
                
                # 计算两种阈值的风险
                risk_universal = (N - 2 * np.sum(np.abs(detail_coeffs) < thr_universal) + 
                                np.sum(np.minimum(np.abs(detail_coeffs), thr_universal)**2))
                risk_sure = _calculate_sure_risk(detail_coeffs, thr_sure, sigma)
                
                # 选择风险更小的阈值
                threshold = thr_sure if risk_sure < risk_universal else thr_universal
                
            elif threshold_mode == 'minimax':
                # Minimax 阈值
                if N > 32:
                    threshold = sigma * (0.3936 + 0.1829 * np.log2(N))
                else:
                    threshold = 0
            else:
                # Universal 阈值（默认）
                threshold = sigma * np.sqrt(2 * np.log(N))
            
            threshold_used = max(threshold_used, threshold)
            
            # 应用阈值
            coeffs_thresh.append(pywt.threshold(detail_coeffs, threshold, mode=threshold_method))
        
        # 重构信号
        denoised = pywt.waverec(coeffs_thresh, wavelet)
        
        # 确保长度一致
        if len(denoised) > len(signal):
            denoised = denoised[:len(signal)]
        elif len(denoised) < len(signal):
            denoised = np.pad(denoised, (0, len(signal) - len(denoised)), mode='edge')
        
        return {
            'success': True,
            'denoised': denoised.tolist(),
            'threshold': float(threshold_used),
            'sigma': float(sigma_used)
        }
    except Exception as e:
        return {'success': False, 'message': f'小波降噪失败: {str(e)}'}


def _calculate_sure_threshold(coeffs, sigma):
    """计算 SURE 阈值"""
    N = len(coeffs)
    abs_coeffs = np.abs(coeffs)
    sorted_coeffs = np.sort(abs_coeffs)
    
    # 计算每个可能阈值的 SURE 风险
    risks = []
    thresholds = sorted_coeffs[::max(1, N//100)]
    
    for thr in thresholds:
        risk = _calculate_sure_risk(coeffs, thr, sigma)
        risks.append(risk)
    
    if len(risks) > 0:
        min_idx = np.argmin(risks)
        return thresholds[min_idx]
    else:
        return sigma * np.sqrt(2 * np.log(N))


def _calculate_sure_risk(coeffs, threshold, sigma):
    """计算 SURE 风险"""
    N = len(coeffs)
    abs_coeffs = np.abs(coeffs)
    
    below_thr = np.sum(abs_coeffs < threshold)
    risk = (N - 2 * below_thr + 
            np.sum(np.minimum(abs_coeffs, threshold)**2) / (sigma**2 + 1e-10))
    
    return risk


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


def calculate_cross_correlation(signal1, signal2):
    """
    使用 FFT 加速的互相关计算
    
    Args:
        signal1: 参考信号数组
        signal2: 对比信号数组
        
    Returns:
        tuple: (correlation, lags) - 互相关结果和滞后值数组
    """
    from scipy.signal import correlate
    
    # 归一化信号
    s1 = (signal1 - np.mean(signal1)) / (np.std(signal1) + 1e-10)
    s2 = (signal2 - np.mean(signal2)) / (np.std(signal2) + 1e-10)
    
    # 使用 FFT 方法（速度提升 50-100 倍）
    correlation = correlate(s1, s2, mode='full', method='fft')
    
    # 归一化
    correlation = correlation / len(signal1)
    
    # 计算滞后值
    lags = np.arange(-len(signal2) + 1, len(signal1))
    
    return correlation, lags


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


def truncate_signal_range(time_array, signal_array, start_time_us=5.0, end_time_us=None):
    """
    截取信号指定时间范围的数据
    
    Args:
        time_array: 时间数组（微秒）
        signal_array: 信号数组
        start_time_us: 起始时间（微秒）
        end_time_us: 结束时间（微秒），None表示不截断右侧
        
    Returns:
        tuple: (truncated_time, truncated_signal)
    """
    # 找到起始截断点
    start_idx = np.searchsorted(time_array, start_time_us)
    if start_idx >= len(time_array):
        start_idx = 0
    
    # 找到结束截断点
    if end_time_us is not None:
        end_idx = np.searchsorted(time_array, end_time_us)
        if end_idx > len(time_array):
            end_idx = len(time_array)
    else:
        end_idx = len(time_array)
    
    # 截取数据
    truncated_time = time_array[start_idx:end_idx]
    truncated_signal = signal_array[start_idx:end_idx]
    
    # 重置时间起点为0
    if len(truncated_time) > 0:
        truncated_time = truncated_time - truncated_time[0]
    
    return truncated_time, truncated_signal
