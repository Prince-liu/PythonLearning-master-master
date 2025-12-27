"""
信号处理模块
包含小波降噪、互相关计算等共享功能
整合自 WaveDealer 项目
"""

import numpy as np
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


def calculate_cross_correlation(signal1, signal2):
    """
    使用 FFT 加速的互相关计算（频域互相关，默认方法）
    
    Args:
        signal1: 参考信号数组
        signal2: 对比信号数组
        
    Returns:
        tuple: (correlation, lags) - 互相关结果和滞后值数组
    
    注意：
        - 只去均值，不归一化标准差
        - 不除以长度，保持波形形状
        - 适合时间差测量和可视化
    """
    from scipy.signal import correlate
    
    # 去除直流分量（只去均值）
    s1 = signal1 - np.mean(signal1)
    s2 = signal2 - np.mean(signal2)
    
    # 使用 FFT 方法（速度提升 50-100 倍）
    correlation = correlate(s1, s2, mode='full', method='fft')
    
    # 计算滞后值
    lags = np.arange(-len(signal2) + 1, len(signal1))
    
    return correlation, lags




def find_peak_with_parabolic_interpolation(correlation):
    """
    使用抛物线插值查找互相关峰值的精确位置（亚采样点精度）
    
    这个函数通过对峰值附近的三个点进行抛物线拟合，
    可以获得比直接取最大值更高的精度（亚采样点级别）。
    
    Args:
        correlation: 互相关结果数组
        
    Returns:
        tuple: (peak_index, peak_value)
            - peak_index: 精确的峰值索引（浮点数，包含亚采样点精度）
            - peak_value: 峰值处的相关性值
    
    算法说明：
        使用三点抛物线插值公式：
        精确偏移 = 峰值索引 + 0.5 * (y1 - y3) / (y1 - 2*y2 + y3)
        
        其中 y1, y2, y3 分别是峰值左侧、峰值、峰值右侧的值
    """
    # 找到整数峰值位置
    峰值索引 = np.argmax(correlation)
    峰值 = correlation[峰值索引]
    
    # 抛物线插值（亚采样点精度）
    # 需要确保峰值不在边界上，否则无法进行三点插值
    if 1 < 峰值索引 < len(correlation) - 2:
        y1 = correlation[峰值索引 - 1]  # 左侧点
        y2 = correlation[峰值索引]      # 峰值点
        y3 = correlation[峰值索引 + 1]  # 右侧点
        
        # 计算抛物线插值的分母
        分母 = y1 - 2*y2 + y3
        
        # 避免除零错误（当三点共线时分母为0）
        if abs(分母) > 1e-10:
            # 计算精确的峰值偏移
            精确偏移 = 0.5 * (y1 - y3) / 分母
            精确峰值索引 = 峰值索引 + 精确偏移
        else:
            # 三点共线，使用整数峰值位置
            精确峰值索引 = float(峰值索引)
    else:
        # 峰值在边界上，无法进行三点插值，使用整数峰值位置
        精确峰值索引 = float(峰值索引)
    
    return 精确峰值索引, 峰值



def apply_bandpass_filter(signal, sampling_rate, lowcut, highcut, order=6):
    """
    应用巴特沃斯带通滤波器
    
    Args:
        signal: 输入信号（电压数组）
        sampling_rate: 采样率 (Hz)
        lowcut: 低频截止频率 (Hz)
        highcut: 高频截止频率 (Hz)
        order: 滤波器阶数（默认6）
        
    Returns:
        dict: {
            'success': bool,
            'filtered': array,  # 滤波后的信号
            'message': str      # 错误信息（如果失败）
        }
    
    注意：
        - 使用 scipy.signal.butter 设计滤波器
        - 使用 sosfiltfilt 进行零相位滤波（前向-后向滤波）
        - 自动验证频率范围的有效性
    """
    try:
        from scipy import signal as scipy_signal
        
        # 参数验证
        if sampling_rate <= 0:
            return {
                'success': False,
                'message': f'采样率无效: {sampling_rate} Hz'
            }
        
        if lowcut <= 0 or highcut <= 0:
            return {
                'success': False,
                'message': f'截止频率必须为正数: lowcut={lowcut}, highcut={highcut}'
            }
        
        if lowcut >= highcut:
            return {
                'success': False,
                'message': f'低频截止必须小于高频截止: lowcut={lowcut}, highcut={highcut}'
            }
        
        # 计算归一化频率
        nyquist = sampling_rate / 2
        low = lowcut / nyquist
        high = highcut / nyquist
        
        # 验证归一化频率范围
        if low <= 0 or low >= 1:
            return {
                'success': False,
                'message': f'低频截止超出有效范围: {lowcut} Hz (Nyquist: {nyquist} Hz)'
            }
        
        if high <= 0 or high >= 1:
            return {
                'success': False,
                'message': f'高频截止超出有效范围: {highcut} Hz (Nyquist: {nyquist} Hz)'
            }
        
        if low >= high:
            return {
                'success': False,
                'message': f'归一化频率范围无效: low={low}, high={high}'
            }
        
        # 设计巴特沃斯带通滤波器（使用 SOS 格式以提高数值稳定性）
        sos = scipy_signal.butter(order, [low, high], btype='band', output='sos')
        
        # 应用零相位滤波（前向-后向滤波）
        filtered_signal = scipy_signal.sosfiltfilt(sos, signal)
        
        return {
            'success': True,
            'filtered': filtered_signal.tolist() if hasattr(filtered_signal, 'tolist') else filtered_signal
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': f'带通滤波失败: {str(e)}'
        }
