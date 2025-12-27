"""
波形分析模块
负责波形文件管理、加载和分析
"""

import numpy as np
import os
import glob
from datetime import datetime

# 常量定义
DEFAULT_TRUNCATE_START_US = 5.0  # 默认截断前5微秒
MIN_DATA_POINTS = 10  # 最小数据点数
MAX_SAMPLING_INTERVAL_US = 1000  # 最大采样间隔（微秒）
MAX_LENGTH_DIFF_RATIO = 0.1  # 信号长度最大差异比例


class WaveformAnalysis:
    """波形分析功能类"""
    
    def __init__(self, window=None):
        """
        初始化
        window: pywebview窗口实例（用于文件对话框）
        """
        self.window = window
        self.互相关信号列表 = []  # 存储多个信号用于互相关分析
        self.互相关结果 = []  # 存储互相关计算结果
        
        # 🆕 降噪配置（与标定/单轴模块一致）
        self.denoise_config = {
            'enabled': True,
            'method': 'wavelet',
            'wavelet': 'sym6',
            'level': 5,
            'threshold_mode': 'soft',
            'threshold_rule': 'heursure'
        }
        
        # 🆕 带通滤波配置（与标定/单轴模块一致）
        self.bandpass_config = {
            'enabled': False,  # 默认关闭（保持向后兼容）
            'lowcut': 1.5,  # MHz
            'highcut': 3.5,  # MHz
            'order': 6
        }
    
    def 选择打开文件(self):
        """打开文件选择对话框"""
        try:
            import webview
            
            # 获取默认保存目录
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    directory=默认目录,
                    file_types=(
                        '所有波形文件 (*.npy;*.csv;*.h5;*.hdf5)',
                        'NumPy文件 (*.npy)',
                        'CSV文件 (*.csv)',
                        'HDF5文件 (*.h5;*.hdf5)',
                        '所有文件 (*.*)'
                    )
                )
                
                if 文件路径:
                    if isinstance(文件路径, tuple):
                        文件路径 = 文件路径[0]
                    
                    return {"success": True, "path": 文件路径}
                else:
                    return {"success": False, "message": "用户取消了打开"}
            else:
                return {"success": False, "message": "窗口未初始化"}
        except Exception as e:
            return {"success": False, "message": f"打开对话框失败: {str(e)}"}
    
    def 获取波形文件列表(self, 目录路径=None):
        """获取指定目录下的所有波形文件"""
        try:
            if 目录路径 is None:
                文档目录 = os.path.expanduser('~/Documents')
                目录路径 = os.path.join(文档目录, 'OscilloscopeWaveforms')
                
                if not os.path.exists(目录路径):
                    os.makedirs(目录路径)
            
            # 查找所有支持的波形文件格式
            文件列表 = []
            for 扩展名 in ['*.npy', '*.csv', '*.h5', '*.hdf5']:
                文件模式 = os.path.join(目录路径, 扩展名)
                文件列表.extend(glob.glob(文件模式))
            
            # 获取文件信息
            文件信息列表 = []
            for 文件路径 in sorted(文件列表, reverse=True):
                文件名 = os.path.basename(文件路径)
                文件大小 = os.path.getsize(文件路径)
                修改时间 = datetime.fromtimestamp(os.path.getmtime(文件路径))
                
                文件信息列表.append({
                    'name': 文件名,
                    'path': 文件路径,
                    'size': 文件大小,
                    'modified': 修改时间.strftime('%Y-%m-%d %H:%M:%S')
                })
            
            return {
                "success": True,
                "files": 文件信息列表,
                "directory": 目录路径
            }
        except Exception as e:
            return {"success": False, "message": f"获取文件列表失败: {str(e)}"}
    
    def 加载波形文件(self, 文件路径):
        """从NPY、CSV或HDF5文件加载波形数据"""
        try:
            文件扩展名 = os.path.splitext(文件路径)[1].lower()
            
            if 文件扩展名 == '.npy':
                # 加载NPY文件
                数据 = np.load(文件路径, allow_pickle=True).item()
                
                波形数据 = {
                    'time': 数据['time'].tolist(),
                    'voltage': 数据['voltage'].tolist(),
                    'vScale': 数据.get('v_scale', 1.0),
                    'vOffset': 数据.get('v_offset', 0.0),
                    'hScale': 数据.get('timebase', 1e-6),
                    'sampleRate': 数据.get('sample_rate', 0),
                    'memoryDepth': 数据.get('memory_depth', 'unknown'),
                    'channel': 数据.get('channel', 1),
                    'points': 数据.get('points', len(数据['time'])),
                    'timestamp': 数据.get('timestamp', 'unknown')
                }
            
            elif 文件扩展名 in ['.h5', '.hdf5']:
                # 加载HDF5文件
                try:
                    import h5py
                except ImportError:
                    return {"success": False, "message": "需要安装 h5py: pip install h5py"}
                
                with h5py.File(文件路径, 'r') as f:
                    # 尝试不同的数据结构
                    # 结构1: 应力标定格式（有 reference_waveform 或 stress_xxx 组）
                    if 'reference_waveform' in f:
                        # 加载基准波形
                        ref_group = f['reference_waveform']
                        时间 = np.array(ref_group['time'])
                        电压 = np.array(ref_group['voltage'])
                        
                        波形数据 = {
                            'time': 时间.tolist(),
                            'voltage': 电压.tolist(),
                            'vScale': ref_group.attrs.get('v_scale', 1.0),
                            'vOffset': ref_group.attrs.get('v_offset', 0.0),
                            'hScale': ref_group.attrs.get('timebase', 1e-6),
                            'sampleRate': ref_group.attrs.get('sample_rate', 0),
                            'memoryDepth': 'unknown',
                            'channel': 1,
                            'points': len(时间),
                            'timestamp': 'HDF5 file'
                        }
                    else:
                        # 结构2: 查找第一个包含 time 和 voltage 的组
                        波形数据 = None
                        for key in f.keys():
                            if isinstance(f[key], h5py.Group):
                                group = f[key]
                                if 'time' in group and 'voltage' in group:
                                    时间 = np.array(group['time'])
                                    电压 = np.array(group['voltage'])
                                    
                                    波形数据 = {
                                        'time': 时间.tolist(),
                                        'voltage': 电压.tolist(),
                                        'vScale': group.attrs.get('v_scale', 1.0),
                                        'vOffset': group.attrs.get('v_offset', 0.0),
                                        'hScale': group.attrs.get('timebase', 1e-6),
                                        'sampleRate': group.attrs.get('sample_rate', 0),
                                        'memoryDepth': 'unknown',
                                        'channel': group.attrs.get('channel', 1),
                                        'points': len(时间),
                                        'timestamp': 'HDF5 file'
                                    }
                                    break
                        
                        if 波形数据 is None:
                            return {"success": False, "message": "HDF5文件中未找到波形数据（需要 time 和 voltage 数据集）"}
            
            elif 文件扩展名 == '.csv':
                # 加载CSV文件，手动解析以处理空列
                编码列表 = ['utf-8-sig', 'utf-8', 'gbk', 'latin-1']
                lines = None
                
                for 编码 in 编码列表:
                    try:
                        with open(文件路径, 'r', encoding=编码) as f:
                            lines = f.readlines()
                        break
                    except UnicodeDecodeError:
                        continue
                
                if lines is None:
                    return {"success": False, "message": "无法读取CSV文件，编码不支持"}
                
                # 跳过表头，解析数据
                时间列表 = []
                电压列表 = []
                
                for i, line in enumerate(lines):
                    if i == 0:  # 跳过表头
                        continue
                    
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        parts = line.split(',')
                        # 只取前两列（时间和电压），忽略后面的空列
                        if len(parts) >= 2:
                            时间值 = parts[0].strip()
                            电压值 = parts[1].strip()
                            
                            # 跳过空值
                            if 时间值 and 电压值:
                                时间列表.append(float(时间值))
                                电压列表.append(float(电压值))
                    except (ValueError, IndexError):
                        continue
                
                if len(时间列表) == 0:
                    return {"success": False, "message": "CSV文件中没有有效数据"}
                
                时间 = np.array(时间列表)
                电压 = np.array(电压列表)
                
                波形数据 = {
                    'time': 时间.tolist(),
                    'voltage': 电压.tolist(),
                    'vScale': 1.0,
                    'vOffset': 0.0,
                    'hScale': 1e-6,
                    'sampleRate': 0,
                    'memoryDepth': 'unknown',
                    'channel': 1,
                    'points': len(时间),
                    'timestamp': 'unknown'
                }
            else:
                return {"success": False, "message": f"不支持的文件格式: {文件扩展名}"}
            
            return {"success": True, "data": 波形数据}
        except Exception as e:
            return {"success": False, "message": f"加载失败: {str(e)}"}
    
    def 选择多个CSV文件(self):
        """打开文件选择对话框，允许选择多个CSV文件"""
        try:
            import webview
            
            # 获取默认保存目录
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径列表 = self.window.create_file_dialog(
                    webview.OPEN_DIALOG,
                    directory=默认目录,
                    allow_multiple=True,
                    file_types=('CSV文件 (*.csv)', '所有文件 (*.*)')
                )
                
                if 文件路径列表:
                    return {"success": True, "paths": 文件路径列表}
                else:
                    return {"success": False, "message": "用户取消了选择"}
            else:
                return {"success": False, "message": "窗口未初始化"}
        except Exception as e:
            return {"success": False, "message": f"选择文件失败: {str(e)}"}
    
    # ==================== 信号处理配置 ====================
    
    def set_denoise_config(self, config):
        """
        设置降噪配置
        
        Args:
            config: 降噪配置字典
            
        Returns:
            dict: 操作结果
        """
        self.denoise_config.update(config)
        return {"success": True, "message": "降噪配置已更新"}
    
    def get_denoise_config(self):
        """
        获取当前降噪配置
        
        Returns:
            dict: 降噪配置
        """
        return {"success": True, "data": self.denoise_config}
    
    def set_bandpass_config(self, config):
        """
        设置带通滤波配置
        
        Args:
            config: 带通滤波配置字典
            
        Returns:
            dict: 操作结果
        """
        self.bandpass_config.update(config)
        return {"success": True, "message": "带通滤波配置已更新"}
    
    def get_bandpass_config(self):
        """
        获取当前带通滤波配置
        
        Returns:
            dict: 带通滤波配置
        """
        return {"success": True, "data": self.bandpass_config}
    
    # ==================== 互相关分析 ====================
    
    def 加载多个CSV文件(self, 文件路径列表):
        """
        加载多个CSV文件用于互相关分析
        
        只加载原始数据，不进行信号处理
        信号处理在计算互相关时进行
        """
        try:
            self.互相关信号列表 = []
            
            for idx, 文件路径 in enumerate(文件路径列表):
                # 加载CSV文件
                编码列表 = ['utf-8-sig', 'utf-8', 'gbk', 'latin-1']
                lines = None
                
                for 编码 in 编码列表:
                    try:
                        with open(文件路径, 'r', encoding=编码) as f:
                            lines = f.readlines()
                        break
                    except UnicodeDecodeError:
                        continue
                
                if lines is None:
                    continue
                
                # 解析数据
                时间列表 = []
                电压列表 = []
                
                for i, line in enumerate(lines):
                    if i == 0:  # 跳过表头
                        continue
                    
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        parts = line.split(',')
                        if len(parts) >= 2:
                            时间值 = parts[0].strip()
                            电压值 = parts[1].strip()
                            
                            if 时间值 and 电压值:
                                时间列表.append(float(时间值))
                                电压列表.append(float(电压值))
                    except (ValueError, IndexError):
                        continue
                
                if len(时间列表) == 0:
                    continue
                
                时间 = np.array(时间列表)
                电压 = np.array(电压列表)
                
                # 检测时间单位并转换为微秒
                if 时间[-1] < 1.0:
                    时间 = 时间 * 1e6  # 秒转微秒
                
                # 计算采样率（用于带通滤波）
                采样率 = None
                if len(时间) > 1:
                    采样间隔 = (时间[1] - 时间[0]) * 1e-6  # 微秒转秒
                    采样率 = 1.0 / 采样间隔 if 采样间隔 > 0 else 1e9
                else:
                    采样率 = 1e9
                
                # 保存原始信号信息（不进行任何处理）
                文件名 = os.path.basename(文件路径)
                self.互相关信号列表.append({
                    'name': 文件名,
                    'path': 文件路径,
                    'original_time': 时间.tolist(),
                    'original_voltage': 电压.tolist(),
                    'sampling_rate': 采样率
                })
            
            if len(self.互相关信号列表) < 2:
                return {"success": False, "message": "至少需要2个有效的CSV文件"}
            
            return {
                "success": True,
                "count": len(self.互相关信号列表),
                "files": [s['name'] for s in self.互相关信号列表]
            }
        except Exception as e:
            return {"success": False, "message": f"加载文件失败: {str(e)}"}
    
    def 计算互相关(self, 参考信号索引, truncate_start=None, truncate_end=None):
        """
        计算参考信号与其他信号的互相关
        
        处理流程：
        1. 带通滤波（如果启用）
        2. 小波降噪（如果启用）
        3. 信号截取
        4. 计算互相关
        
        Args:
            参考信号索引: 参考信号的索引
            truncate_start: 截取起始时间（微秒），None表示从信号开头开始
            truncate_end: 截取结束时间（微秒），None表示到信号末尾
        """
        try:
            from modules.core import signal_processing
            from modules.core.signal_processing import (
                calculate_cross_correlation, 
                find_peak_with_parabolic_interpolation
            )
            from . import waveform_processing
            
            if len(self.互相关信号列表) < 2:
                return {"success": False, "message": "信号数量不足"}
            
            if 参考信号索引 < 0 or 参考信号索引 >= len(self.互相关信号列表):
                return {"success": False, "message": "参考信号索引无效"}
            
            # 使用频域互相关
            cross_corr_func = calculate_cross_correlation
            
            # ========== 处理参考信号 ==========
            参考信号 = self.互相关信号列表[参考信号索引]
            参考时间原始 = np.array(参考信号['original_time'])
            参考电压原始 = np.array(参考信号['original_voltage'])
            参考采样率 = 参考信号['sampling_rate']
            
            # 1. 带通滤波（如果启用）
            if self.bandpass_config.get('enabled', False):
                lowcut = self.bandpass_config.get('lowcut', 1.5) * 1e6  # MHz转Hz
                highcut = self.bandpass_config.get('highcut', 3.5) * 1e6
                order = self.bandpass_config.get('order', 6)
                
                滤波结果 = signal_processing.apply_bandpass_filter(
                    参考电压原始, 参考采样率, lowcut, highcut, order
                )
                
                if 滤波结果['success']:
                    参考电压原始 = np.array(滤波结果['filtered'])
            
            # 2. 小波降噪（如果启用）
            if self.denoise_config.get('enabled', True):
                wavelet = self.denoise_config.get('wavelet', 'sym6')
                level = self.denoise_config.get('level', 5)
                threshold_mode = self.denoise_config.get('threshold_mode', 'soft')
                
                降噪结果 = signal_processing.apply_wavelet_denoising(
                    参考电压原始, wavelet, level, threshold_mode, 'heursure'
                )
                
                if 降噪结果['success']:
                    参考电压原始 = np.array(降噪结果['denoised'])
            
            # 3. 根据用户指定范围截取参考信号
            参考时间, 参考电压 = waveform_processing.truncate_signal_range(参考时间原始, 参考电压原始, truncate_start, truncate_end)
            
            # 验证截取后的数据
            if len(参考时间) < MIN_DATA_POINTS:
                return {"success": False, "message": f"截取后数据点过少（{len(参考时间)}点），请调整截取范围"}
            
            # 计算采样间隔（微秒）
            if len(参考时间) < 2:
                return {"success": False, "message": "参考信号数据点不足"}
            
            dt = 参考时间[1] - 参考时间[0]
            
            # 验证采样间隔合理性
            if dt <= 0:
                return {"success": False, "message": f"采样间隔异常（{dt} μs），时间数据可能未排序"}
            if dt > MAX_SAMPLING_INTERVAL_US:
                return {"success": False, "message": f"采样间隔过大（{dt} μs），数据可能有误"}
            
            self.互相关结果 = []
            
            # ========== 计算参考信号与其他信号的互相关 ==========
            for i, 信号 in enumerate(self.互相关信号列表):
                if i == 参考信号索引:
                    continue  # 跳过参考信号自己
                
                # 处理对比信号
                对比时间原始 = np.array(信号['original_time'])
                对比电压原始 = np.array(信号['original_voltage'])
                对比采样率 = 信号['sampling_rate']
                
                # 1. 带通滤波（如果启用）
                if self.bandpass_config.get('enabled', False):
                    lowcut = self.bandpass_config.get('lowcut', 1.5) * 1e6
                    highcut = self.bandpass_config.get('highcut', 3.5) * 1e6
                    order = self.bandpass_config.get('order', 6)
                    
                    滤波结果 = signal_processing.apply_bandpass_filter(
                        对比电压原始, 对比采样率, lowcut, highcut, order
                    )
                    
                    if 滤波结果['success']:
                        对比电压原始 = np.array(滤波结果['filtered'])
                
                # 2. 小波降噪（如果启用）
                if self.denoise_config.get('enabled', True):
                    wavelet = self.denoise_config.get('wavelet', 'sym6')
                    level = self.denoise_config.get('level', 5)
                    threshold_mode = self.denoise_config.get('threshold_mode', 'soft')
                    
                    降噪结果 = signal_processing.apply_wavelet_denoising(
                        对比电压原始, wavelet, level, threshold_mode, 'heursure'
                    )
                    
                    if 降噪结果['success']:
                        对比电压原始 = np.array(降噪结果['denoised'])
                
                # 3. 对比信号也使用相同的截取范围
                _, 对比电压 = waveform_processing.truncate_signal_range(对比时间原始, 对比电压原始, truncate_start, truncate_end)
                
                # 验证对比信号数据
                if len(对比电压) < MIN_DATA_POINTS:
                    continue
                
                # 验证信号长度一致性（允许小幅差异）
                if abs(len(参考电压) - len(对比电压)) > len(参考电压) * MAX_LENGTH_DIFF_RATIO:
                    continue
                
                # 使用选定的互相关函数
                try:
                    correlation, lags = cross_corr_func(参考电压, 对比电压)
                except Exception as e:
                    continue
                
                # 找到最大相关性位置（使用抛物线插值获得亚采样点精度）
                精确峰值索引, max_correlation = find_peak_with_parabolic_interpolation(correlation)
                max_idx = int(精确峰值索引)  # 整数索引用于获取对应的lag值
                
                # 计算精确的滞后值
                max_lag = lags[max_idx] + (精确峰值索引 - max_idx)
                
                # 计算时间延迟（微秒）
                # 注意：负值表示对比信号相对于参考信号提前（左移）
                time_delay_us = -max_lag * dt  # 取反，单位为微秒
                time_lags_us = -lags * dt  # 时滞轴也取反，单位为微秒
                
                # 为了减少数据传输量，对互相关结果进行降采样
                # 保留每10个点中的1个点用于绘图
                step = max(1, len(correlation) // 2000)  # 最多保留2000个点
                correlation_sampled = correlation[::step].tolist()
                time_lags_us_sampled = time_lags_us[::step].tolist()
                
                self.互相关结果.append({
                    'reference_name': 参考信号['name'],
                    'compare_name': 信号['name'],
                    'max_correlation': float(max_correlation),
                    'max_lag': int(max_lag),
                    'time_delay_us': float(time_delay_us),
                    'correlation': correlation_sampled,
                    'time_lags_us': time_lags_us_sampled
                })
            
            return {
                "success": True,
                "results": self.互相关结果,
                "reference_name": 参考信号['name']
            }
        except Exception as e:
            return {"success": False, "message": f"计算互相关失败: {str(e)}"}
    
    def 导出互相关结果(self, 文件路径):
        """导出互相关结果到CSV文件"""
        try:
            if len(self.互相关结果) == 0:
                return {"success": False, "message": "没有可导出的结果"}
            
            with open(文件路径, 'w', encoding='utf-8-sig') as f:
                # 写入表头
                f.write('参考信号,对比信号,最大相关性,最大滞后(样本),时间延迟(μs),时间延迟(ns)\n')
                
                # 写入数据
                for 结果 in self.互相关结果:
                    time_delay_us = 结果['time_delay_us']
                    time_delay_ns = time_delay_us * 1000
                    
                    f.write(f"{结果['reference_name']},{结果['compare_name']},")
                    f.write(f"{结果['max_correlation']:.6f},{结果['max_lag']},")
                    f.write(f"{time_delay_us:.6f},{time_delay_ns:.2f}\n")
            
            return {"success": True, "path": 文件路径}
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}
    
    def 选择CSV保存路径(self):
        """打开CSV文件保存对话框"""
        try:
            import webview
            
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename='互相关结果.csv',
                    file_types=('CSV文件 (*.csv)',)
                )
                
                if 文件路径:
                    if isinstance(文件路径, tuple):
                        文件路径 = 文件路径[0]
                    
                    if not 文件路径.endswith('.csv'):
                        文件路径 += '.csv'
                    
                    return {"success": True, "path": 文件路径}
                else:
                    return {"success": False, "message": "用户取消了保存"}
            else:
                return {"success": False, "message": "窗口未初始化"}
        except Exception as e:
            return {"success": False, "message": f"保存对话框失败: {str(e)}"}
