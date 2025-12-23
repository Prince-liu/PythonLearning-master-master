"""
应力场测绘模块 - 数据采集
负责波形采集控制、降噪处理、质量评估、基准波形管理
"""

import numpy as np
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

from .field_database import FieldDatabaseManager
from .field_hdf5 import FieldExperimentHDF5


class FieldCapture:
    """应力场数据采集类"""
    
    # 质量评估阈值
    SNR_GOOD = 20.0  # dB
    SNR_WARNING = 15.0  # dB
    QUALITY_SCORE_GOOD = 0.8
    QUALITY_SCORE_WARNING = 0.6
    
    # 应力值有效范围 (MPa)
    STRESS_MIN = -500
    STRESS_MAX = 500
    
    # 时间差有效范围 (ns)
    TIME_DIFF_MIN = -1000
    TIME_DIFF_MAX = 1000
    
    # 相邻点应力差异阈值 (MPa)
    NEIGHBOR_STRESS_DIFF = 50
    
    def __init__(self, db: FieldDatabaseManager, oscilloscope=None):
        """
        初始化采集控制器
        
        Args:
            db: 数据库管理器
            oscilloscope: 示波器实例 (可选)
        """
        self.db = db
        self.oscilloscope = oscilloscope
        self.current_exp_id = None
        self.current_hdf5 = None
        self.baseline_waveform = None
        self.calibration_k = None
        self.baseline_stress = 0.0  # 基准点应力值（绝对应力模式使用）
        
        # 降噪配置
        self.denoise_config = {
            'enabled': True,
            'method': 'wavelet',
            'wavelet': 'sym6',
            'level': 5,
            'threshold_mode': 'soft',
            'threshold_rule': 'heursure'
        }
        
        # 🆕 带通滤波配置
        self.bandpass_config = {
            'enabled': True,
            'lowcut': 1.5,  # MHz
            'highcut': 3.5,  # MHz
            'order': 6
        }
    
    def set_experiment(self, exp_id: str, hdf5: FieldExperimentHDF5, k: float, baseline_stress: float = 0.0):
        """
        设置当前实验
        
        Args:
            exp_id: 实验ID
            hdf5: HDF5文件管理器
            k: 应力系数 (MPa/ns)
            baseline_stress: 基准点应力值 (MPa)，绝对应力模式使用
        """
        self.current_exp_id = exp_id
        self.current_hdf5 = hdf5
        self.calibration_k = k
        self.baseline_stress = baseline_stress
        
        # 先清空旧的基准波形，避免跨实验污染
        self.baseline_waveform = None
        
        # 加载基准波形（如果存在）
        baseline_result = hdf5.load_baseline()
        if baseline_result['success']:
            self.baseline_waveform = baseline_result['data']['waveform']
    
    def set_baseline_stress(self, stress: float) -> Dict[str, Any]:
        """
        设置基准点应力值（用于绝对应力模式）
        
        Args:
            stress: 基准点应力值 (MPa)
        
        Returns:
            dict: 操作结果
        """
        self.baseline_stress = stress
        
        # 更新数据库
        if self.current_exp_id:
            self.db.update_experiment(self.current_exp_id, {
                'baseline_stress': stress
            })
        
        return {"success": True, "message": f"基准点应力值已设置为 {stress} MPa"}
    
    def set_denoise_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        设置降噪配置
        
        Args:
            config: 降噪配置
        
        Returns:
            dict: 操作结果
        """
        self.denoise_config.update(config)
        
        # 保存到HDF5
        if self.current_hdf5:
            snapshot = self.current_hdf5.load_config_snapshot().get('data', {})
            snapshot['denoise'] = self.denoise_config
            self.current_hdf5.save_config_snapshot(snapshot)
        
        return {"success": True, "message": "降噪配置已更新"}
    
    def set_bandpass_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        设置带通滤波配置
        
        Args:
            config: 带通滤波配置 {enabled, lowcut, highcut, order}
        
        Returns:
            dict: 操作结果
        """
        self.bandpass_config.update(config)
        
        # 保存到HDF5
        if self.current_hdf5:
            snapshot = self.current_hdf5.load_config_snapshot().get('data', {})
            snapshot['bandpass'] = self.bandpass_config
            self.current_hdf5.save_config_snapshot(snapshot)
        
        return {"success": True, "message": "带通滤波配置已更新"}
    
    # ==================== 波形采集 ====================
    
    def capture_point(self, point_index: int, auto_denoise: bool = True) -> Dict[str, Any]:
        """
        采集单个测点
        
        Args:
            point_index: 测点索引
            auto_denoise: 是否自动降噪
        
        Returns:
            dict: {
                "success": bool,
                "data": {
                    "point_id": int,
                    "time_diff": float,
                    "stress": float,
                    "quality_score": float,
                    "snr": float,
                    "quality": {...}
                }
            }
        """
        if not self.current_exp_id:
            return {"success": False, "error_code": 4001, "message": "没有设置当前实验"}
        
        if not self.calibration_k:
            return {"success": False, "error_code": 4002, "message": "没有加载标定数据"}
        
        try:
            # 获取测点信息
            point = self.db.get_point(self.current_exp_id, point_index)
            if not point:
                return {"success": False, "error_code": 4003, "message": f"测点 {point_index} 不存在"}
            
            # 采集波形
            waveform = self._acquire_waveform()
            if not waveform:
                return {"success": False, "error_code": 4004, "message": "波形采集失败"}
            
            # 降噪处理
            if auto_denoise and self.denoise_config.get('enabled', True):
                waveform = self._apply_denoise(waveform)
            
            # 评估波形质量
            quality = self.evaluate_waveform_quality(waveform)
            
            # 检查是否是第一个测点（自动设为基准）
            is_baseline = self.baseline_waveform is None
            
            if is_baseline:
                # 设置为基准波形
                self.baseline_waveform = waveform
                time_diff = 0.0
                stress = self.baseline_stress  # 基准点使用设定的基准应力值
                
                # 保存基准波形
                self.current_hdf5.save_baseline(point_index, waveform)
                
                # 更新数据库
                self.db.update_experiment(self.current_exp_id, {
                    'baseline_point_id': point_index,
                    'baseline_stress': self.baseline_stress
                })
            else:
                # 计算时间差
                time_diff = self._calculate_time_diff(waveform, self.baseline_waveform)
                
                # 计算应力值（支持绝对应力模式）
                # σ = σ_基准 + k × Δt
                stress = self.baseline_stress + self.calibration_k * time_diff
            
            # 验证数据
            is_suspicious = False
            validation_warnings = []
            
            if not (self.STRESS_MIN <= stress <= self.STRESS_MAX):
                is_suspicious = True
                validation_warnings.append(f"应力值 {stress:.1f} MPa 超出正常范围")
            
            if not (self.TIME_DIFF_MIN <= time_diff <= self.TIME_DIFF_MAX):
                is_suspicious = True
                validation_warnings.append(f"时间差 {time_diff:.2f} ns 超出正常范围")
            
            # 保存波形数据
            analysis = {
                'time_diff': time_diff,
                'stress': stress,
                'snr': quality['snr'],
                'quality_score': quality['score']
            }
            
            metadata = {
                'x_coord': point['x_coord'],
                'y_coord': point['y_coord'],
                'r_coord': point.get('r_coord'),
                'theta_coord': point.get('theta_coord')
            }
            
            self.current_hdf5.save_point_waveform(point_index, waveform, analysis, metadata)
            
            # 更新数据库
            self.db.update_point(self.current_exp_id, point_index, {
                'time_diff': time_diff,
                'stress_value': stress,
                'status': 'measured',
                'measured_at': datetime.now().isoformat(),
                'quality_score': quality['score'],
                'snr': quality['snr'],
                'is_suspicious': 1 if is_suspicious else 0
            })
            
            # 如果是第一个采集的测点，将实验状态改为"采集中"
            if is_baseline:
                self.db.update_experiment(self.current_exp_id, {'status': 'collecting'})
            
            return {
                "success": True,
                "error_code": 0,
                "data": {
                    "point_id": point_index,
                    "time_diff": time_diff,
                    "stress": stress,
                    "quality_score": quality['score'],
                    "snr": quality['snr'],
                    "quality": quality,
                    "is_baseline": is_baseline,
                    "is_suspicious": is_suspicious,
                    "validation_warnings": validation_warnings
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 4099,
                "message": f"采集测点失败: {str(e)}"
            }
    
    def capture_point_with_waveform(self, point_index: int, waveform: Dict[str, Any], 
                                    auto_denoise: bool = True, bandpass_enabled: bool = True) -> Dict[str, Any]:
        """
        使用前端传入的波形数据采集测点
        
        Args:
            point_index: 测点索引
            waveform: 波形数据 {'time': [], 'voltage': [], 'sample_rate': float}
            auto_denoise: 是否自动降噪
            bandpass_enabled: 是否启用带通滤波
        
        Returns:
            dict: 采集结果
        """
        if not self.current_exp_id:
            return {"success": False, "error_code": 4001, "message": "没有设置当前实验"}
        
        if not self.calibration_k:
            return {"success": False, "error_code": 4002, "message": "没有加载标定数据"}
        
        try:
            # 获取测点信息
            point = self.db.get_point(self.current_exp_id, point_index)
            if not point:
                return {"success": False, "error_code": 4003, "message": f"测点 {point_index} 不存在"}
            
            # 验证波形数据
            if not waveform or not waveform.get('voltage') or not waveform.get('time'):
                return {"success": False, "error_code": 4004, "message": "波形数据无效"}
            
            # 临时保存原始带通滤波配置
            original_bandpass_enabled = self.bandpass_config.get('enabled', True)
            
            # 根据前端传递的参数临时修改配置
            self.bandpass_config['enabled'] = bandpass_enabled
            
            try:
                # 降噪处理
                if auto_denoise and self.denoise_config.get('enabled', True):
                    waveform = self._apply_denoise(waveform)
                
                # 评估波形质量
                quality = self.evaluate_waveform_quality(waveform)
                
                # 获取用户指定的基准点ID
                exp_result = self.db.load_experiment(self.current_exp_id)
                designated_baseline_id = exp_result['data']['experiment'].get('baseline_point_id') if exp_result['success'] else None
                
                # 判断是否是基准点：
                # 1. 如果用户指定了基准点，且当前测点就是指定的基准点，且基准波形还没采集
                # 2. 如果没有指定基准点，且还没有基准波形（兼容旧逻辑）
                is_designated_baseline = designated_baseline_id and point_index == designated_baseline_id
                is_baseline = (is_designated_baseline and self.baseline_waveform is None) or \
                             (not designated_baseline_id and self.baseline_waveform is None)
                
                if is_baseline:
                    # 设置为基准波形
                    self.baseline_waveform = waveform
                    time_diff = 0.0
                    stress = self.baseline_stress  # 基准点使用设定的基准应力值
                    
                    # 保存基准波形
                    self.current_hdf5.save_baseline(point_index, waveform)
                    
                    # 更新数据库
                    self.db.update_experiment(self.current_exp_id, {
                        'baseline_point_id': point_index,
                        'baseline_stress': self.baseline_stress
                    })
                else:
                    # 检查是否有基准波形
                    if self.baseline_waveform is None:
                        # 没有基准波形，提示用户先采集基准点
                        baseline_hint = f"测点 {designated_baseline_id}" if designated_baseline_id else "第一个测点"
                        return {
                            "success": False,
                            "error_code": 4022,
                            "message": f"请先采集基准点（{baseline_hint}）"
                        }
                    
                    # 计算时间差
                    time_diff = self._calculate_time_diff(waveform, self.baseline_waveform)
                    
                    # 计算应力值（支持绝对应力模式）
                    # σ = σ_基准 + k × Δt
                    stress = self.baseline_stress + self.calibration_k * time_diff
            finally:
                # 恢复原始配置
                self.bandpass_config['enabled'] = original_bandpass_enabled
            
            # 验证数据
            is_suspicious = False
            validation_warnings = []
            
            if not (self.STRESS_MIN <= stress <= self.STRESS_MAX):
                is_suspicious = True
                validation_warnings.append(f"应力值 {stress:.1f} MPa 超出正常范围")
            
            if not (self.TIME_DIFF_MIN <= time_diff <= self.TIME_DIFF_MAX):
                is_suspicious = True
                validation_warnings.append(f"时间差 {time_diff:.2f} ns 超出正常范围")
            
            # 保存波形数据
            analysis = {
                'time_diff': time_diff,
                'stress': stress,
                'snr': quality['snr'],
                'quality_score': quality['score']
            }
            
            metadata = {
                'x_coord': point['x_coord'],
                'y_coord': point['y_coord'],
                'r_coord': point.get('r_coord'),
                'theta_coord': point.get('theta_coord')
            }
            
            self.current_hdf5.save_point_waveform(point_index, waveform, analysis, metadata)
            
            # 更新数据库
            self.db.update_point(self.current_exp_id, point_index, {
                'time_diff': time_diff,
                'stress_value': stress,
                'status': 'measured',
                'measured_at': datetime.now().isoformat(),
                'quality_score': quality['score'],
                'snr': quality['snr'],
                'is_suspicious': 1 if is_suspicious else 0
            })
            
            # 如果是第一个采集的测点，将实验状态改为"采集中"
            if is_baseline:
                self.db.update_experiment(self.current_exp_id, {'status': 'collecting'})
            
            return {
                "success": True,
                "error_code": 0,
                "data": {
                    "point_id": point_index,
                    "time_diff": time_diff,
                    "stress": stress,
                    "quality_score": quality['score'],
                    "snr": quality['snr'],
                    "quality": quality,
                    "is_baseline": is_baseline,
                    "is_suspicious": is_suspicious,
                    "validation_warnings": validation_warnings
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 4099,
                "message": f"采集测点失败: {str(e)}"
            }
    
    def _acquire_waveform(self) -> Optional[Dict[str, Any]]:
        """从示波器采集波形"""
        if not self.oscilloscope:
            # 没有示波器连接，返回None
            return None
        
        try:
            # 使用 RAW 模式获取高精度波形数据
            result = self.oscilloscope.获取波形数据_RAW模式_屏幕范围(1)
            if result.get('success'):
                data = result['data']
                return {
                    'time': data['time'],
                    'voltage': data['data'],
                    'sample_rate': data.get('sample_rate', 1e9)
                }
        except Exception:
            pass
        
        # 采集失败
        return None
    
    def _apply_denoise(self, waveform: Dict[str, Any]) -> Dict[str, Any]:
        """应用降噪处理"""
        try:
            import pywt
            
            voltage = np.array(waveform['voltage'])
            wavelet = self.denoise_config.get('wavelet', 'sym6')
            level = self.denoise_config.get('level', 5)
            mode = self.denoise_config.get('threshold_mode', 'soft')
            
            # 小波分解
            coeffs = pywt.wavedec(voltage, wavelet, level=level)
            
            # 计算阈值
            sigma = np.median(np.abs(coeffs[-1])) / 0.6745
            threshold = sigma * np.sqrt(2 * np.log(len(voltage)))
            
            # 应用阈值
            denoised_coeffs = [coeffs[0]]
            for c in coeffs[1:]:
                if mode == 'soft':
                    denoised_coeffs.append(pywt.threshold(c, threshold, mode='soft'))
                else:
                    denoised_coeffs.append(pywt.threshold(c, threshold, mode='hard'))
            
            # 重构信号
            denoised = pywt.waverec(denoised_coeffs, wavelet)
            
            # 确保长度一致
            if len(denoised) > len(voltage):
                denoised = denoised[:len(voltage)]
            
            return {
                'time': waveform['time'],
                'voltage': denoised.tolist(),
                'sample_rate': waveform['sample_rate']
            }
            
        except ImportError:
            # pywavelets未安装，返回原始波形
            return waveform
        except Exception:
            return waveform
    
    def _calculate_time_diff(self, waveform: Dict[str, Any], 
                            baseline: Dict[str, Any]) -> float:
        """
        使用互相关计算时间差（与应力标定模块一致的算法）
        
        Args:
            waveform: 当前波形
            baseline: 基准波形
        
        Returns:
            float: 时间差 (ns)
        """
        from scipy.signal import correlate
        
        基准 = np.array(baseline['voltage'])
        测量 = np.array(waveform['voltage'])
        
        # 确保长度一致
        最小长度 = min(len(基准), len(测量))
        基准 = 基准[:最小长度]
        测量 = 测量[:最小长度]
        
        # 🆕 带通滤波（如果启用）
        if self.bandpass_config and self.bandpass_config.get('enabled', True):
            sample_rate = waveform.get('sample_rate', 1e9)
            基准 = self._apply_bandpass_filter(基准, sample_rate)
            测量 = self._apply_bandpass_filter(测量, sample_rate)
        
        # 频域互相关（使用 mode='same'，与标定模块一致）
        相关 = correlate(测量, 基准, mode='same', method='fft')
        
        # 找到峰值位置（不用 abs，找最大正相关）
        峰值索引 = np.argmax(相关)
        
        # 抛物线插值（亚采样点精度）
        if 1 < 峰值索引 < len(相关) - 2:
            y1 = 相关[峰值索引 - 1]
            y2 = 相关[峰值索引]
            y3 = 相关[峰值索引 + 1]
            
            分母 = y1 - 2*y2 + y3
            if abs(分母) > 1e-10:
                精确偏移 = 峰值索引 + 0.5 * (y1 - y3) / 分母
            else:
                精确偏移 = 峰值索引
        else:
            精确偏移 = 峰值索引
        
        # 转换为时间偏移
        中心索引 = len(基准) // 2
        sample_rate = waveform.get('sample_rate', 1e9)
        声时差_秒 = (精确偏移 - 中心索引) / sample_rate
        声时差_纳秒 = 声时差_秒 * 1e9
        
        return 声时差_纳秒
    
    def _apply_bandpass_filter(self, signal: np.ndarray, sample_rate: float) -> np.ndarray:
        """
        应用巴特沃斯带通滤波器
        
        Args:
            signal: 输入信号
            sample_rate: 采样率 (Hz)
        
        Returns:
            np.ndarray: 滤波后的信号
        """
        try:
            from scipy.signal import butter, filtfilt
            
            # 获取滤波参数（MHz转Hz）
            lowcut = self.bandpass_config.get('lowcut', 1.5) * 1e6
            highcut = self.bandpass_config.get('highcut', 3.5) * 1e6
            order = self.bandpass_config.get('order', 6)
            
            # 奈奎斯特频率
            nyq = 0.5 * sample_rate
            low = lowcut / nyq
            high = highcut / nyq
            
            # 参数检查
            if low <= 0 or low >= 1 or high <= 0 or high >= 1 or low >= high:
                # 参数无效，返回原始信号
                return signal
            
            # 设计巴特沃斯带通滤波器
            b, a = butter(order, [low, high], btype='band')
            
            # 零相位滤波（前向后向滤波）
            filtered = filtfilt(b, a, signal)
            
            return filtered
            
        except Exception as e:
            # 滤波失败，返回原始信号
            return signal
    
    # ==================== 质量评估 ====================
    
    def evaluate_waveform_quality(self, waveform: Dict[str, Any]) -> Dict[str, Any]:
        """
        评估波形质量
        
        Args:
            waveform: 波形数据
        
        Returns:
            dict: {
                "score": float (0-1),
                "snr": float (dB),
                "peak_amplitude": float,
                "is_good": bool,
                "issues": list
            }
        """
        voltage = np.array(waveform['voltage'])
        
        # 计算SNR
        snr = self.calculate_snr(voltage)
        
        # 计算峰值幅度
        peak_amplitude = np.max(np.abs(voltage))
        
        # 计算质量评分
        issues = []
        score = 1.0
        
        # SNR评分
        if snr < self.SNR_WARNING:
            score -= 0.3
            issues.append(f"信噪比较低 ({snr:.1f} dB)")
        elif snr < self.SNR_GOOD:
            score -= 0.1
        
        # 峰值幅度评分
        if peak_amplitude < 0.01:
            score -= 0.3
            issues.append("信号幅度过小")
        elif peak_amplitude > 10:
            score -= 0.2
            issues.append("信号幅度过大，可能饱和")
        
        # 检查是否有明显的信号
        signal_std = np.std(voltage)
        if signal_std < 0.001:
            score -= 0.4
            issues.append("信号变化过小")
        
        score = max(0, min(1, score))
        
        return {
            "score": score,
            "snr": snr,
            "peak_amplitude": peak_amplitude,
            "is_good": score >= self.QUALITY_SCORE_GOOD,
            "is_acceptable": score >= self.QUALITY_SCORE_WARNING,
            "issues": issues
        }
    
    @staticmethod
    def calculate_snr(voltage: np.ndarray) -> float:
        """
        计算信噪比
        
        Args:
            voltage: 电压数组
        
        Returns:
            float: SNR (dB)
        """
        # 简化的SNR计算：信号功率 / 噪声功率
        # 假设信号在中间部分，噪声在两端
        n = len(voltage)
        noise_region = np.concatenate([voltage[:n//10], voltage[-n//10:]])
        signal_region = voltage[n//4:3*n//4]
        
        noise_power = np.var(noise_region)
        signal_power = np.var(signal_region)
        
        if noise_power < 1e-10:
            return 60.0  # 非常高的SNR
        
        snr = 10 * np.log10(signal_power / noise_power)
        return max(0, min(60, snr))  # 限制在0-60 dB
    
    # ==================== 基准波形管理 ====================
    
    def set_baseline_point(self, point_index: int) -> Dict[str, Any]:
        """
        设置基准测点
        
        Args:
            point_index: 测点索引
        
        Returns:
            dict: 操作结果，包含重新计算的点数
        """
        if not self.current_exp_id:
            return {"success": False, "error_code": 4001, "message": "没有设置当前实验"}
        
        if not self.current_hdf5:
            return {"success": False, "error_code": 4020, "message": "HDF5文件未初始化"}
        
        try:
            # 检查HDF5文件是否存在
            if not self.current_hdf5.file_exists():
                return {
                    "success": False,
                    "error_code": 4021,
                    "message": f"HDF5文件不存在: {self.current_hdf5.file_path}"
                }
            
            # 加载该测点的波形
            waveform_result = self.current_hdf5.load_point_waveform(point_index)
            
            if not waveform_result['success']:
                return {
                    "success": False,
                    "error_code": 4010,
                    "message": f"无法加载该测点的波形: {waveform_result.get('message', '未知错误')}"
                }
            
            # 验证波形质量
            waveform = waveform_result['data']['waveform']
            quality = self.evaluate_waveform_quality(waveform)
            
            if quality['snr'] < self.SNR_WARNING:
                return {
                    "success": False,
                    "error_code": 4011,
                    "message": f"波形质量较差 (SNR={quality['snr']:.1f} dB)，建议选择其他测点"
                }
            
            # 更新基准波形
            old_baseline = self.baseline_waveform
            self.baseline_waveform = waveform
            
            # 保存到HDF5
            self.current_hdf5.save_baseline(point_index, waveform)
            
            # 更新数据库
            update_result = self.db.update_experiment(self.current_exp_id, {
                'baseline_point_id': point_index
            })
            
            # 重新计算所有已测量点的应力值
            recalculated = self._recalculate_all_stress_values()
            
            return {
                "success": True,
                "error_code": 0,
                "message": f"基准点已更改为测点 {point_index}",
                "recalculated_points": recalculated
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 4099,
                "message": f"设置基准点失败: {str(e)}"
            }
    
    def _recalculate_all_stress_values(self) -> int:
        """重新计算所有已测量点的应力值"""
        if not self.baseline_waveform or not self.calibration_k:
            return 0
        
        measured_points = self.db.get_measured_points(self.current_exp_id)
        recalculated = 0
        
        for point in measured_points:
            point_index = point['point_index']
            
            # 加载波形
            waveform_result = self.current_hdf5.load_point_waveform(point_index)
            if not waveform_result['success']:
                continue
            
            waveform = waveform_result['data']['waveform']
            
            # 重新计算时间差和应力
            time_diff = self._calculate_time_diff(waveform, self.baseline_waveform)
            # σ = σ_基准 + k × Δt
            stress = self.baseline_stress + self.calibration_k * time_diff
            
            # 更新数据库
            self.db.update_point(self.current_exp_id, point_index, {
                'time_diff': time_diff,
                'stress_value': stress
            })
            
            recalculated += 1
        
        return recalculated
    
    def validate_baseline_quality(self) -> Dict[str, Any]:
        """验证当前基准波形的质量"""
        if not self.baseline_waveform:
            return {"success": False, "is_valid": False, "message": "没有基准波形"}
        
        quality = self.evaluate_waveform_quality(self.baseline_waveform)
        
        return {
            "success": True,
            "is_valid": quality['snr'] >= self.SNR_GOOD,
            "quality": quality,
            "message": "基准波形质量良好" if quality['snr'] >= self.SNR_GOOD else "基准波形质量较差，建议重新采集"
        }
    
    # ==================== 测点操作 ====================
    
    def skip_point(self, point_index: int, reason: str = "") -> Dict[str, Any]:
        """
        跳过测点
        
        Args:
            point_index: 测点索引
            reason: 跳过原因
        
        Returns:
            dict: 操作结果
        """
        if not self.current_exp_id:
            return {"success": False, "error_code": 4001, "message": "没有设置当前实验"}
        
        result = self.db.update_point(self.current_exp_id, point_index, {
            'status': 'skipped',
            'skip_reason': reason
        })
        
        return result
    
    def recapture_point(self, point_index: int, auto_denoise: bool = True) -> Dict[str, Any]:
        """
        重新采集测点
        
        Args:
            point_index: 测点索引
            auto_denoise: 是否自动降噪
        
        Returns:
            dict: 采集结果
        """
        # 直接调用capture_point，会覆盖之前的数据
        return self.capture_point(point_index, auto_denoise)
    
    def test_denoise_effect(self, waveform: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        测试降噪效果
        
        Args:
            waveform: 波形数据 (可选，如果不提供则采集新波形)
        
        Returns:
            dict: {
                "original_snr": float,
                "denoised_snr": float,
                "improvement": float
            }
        """
        if waveform is None:
            waveform = self._acquire_waveform()
            if not waveform:
                return {"success": False, "message": "无法采集波形"}
        
        # 计算原始SNR
        original_quality = self.evaluate_waveform_quality(waveform)
        
        # 应用降噪
        denoised = self._apply_denoise(waveform)
        
        # 计算降噪后SNR
        denoised_quality = self.evaluate_waveform_quality(denoised)
        
        return {
            "success": True,
            "original_snr": original_quality['snr'],
            "denoised_snr": denoised_quality['snr'],
            "improvement": denoised_quality['snr'] - original_quality['snr'],
            "original_quality": original_quality,
            "denoised_quality": denoised_quality
        }
