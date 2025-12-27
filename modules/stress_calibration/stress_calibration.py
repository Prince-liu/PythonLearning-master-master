"""
应力系数标定模块
负责互相关计算、HDF5/CSV导出等功能
"""

import numpy as np
from datetime import datetime


class StressCalibration:
    """应力系数标定功能类"""
    
    def __init__(self, window=None):
        """
        初始化
        window: pywebview窗口实例（用于文件对话框）
        """
        self.window = window
        self.data_manager = None  # 延迟初始化
        
        # 🆕 降噪配置（与单轴模块一致）
        self.denoise_config = {
            'enabled': True,
            'method': 'wavelet',
            'wavelet': 'sym6',
            'level': 5,
            'threshold_mode': 'soft',
            'threshold_rule': 'heursure'
        }
        
        # 🆕 带通滤波配置（与单轴模块一致）
        self.bandpass_config = {
            'enabled': True,
            'lowcut': 1.5,  # MHz
            'highcut': 3.5,  # MHz
            'order': 6
        }
    
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
    
    def 计算互相关声时差(self, 基准波形, 测量波形, 采样率, 基准时间=None, 测量时间=None):
        """
        计算两个波形之间的声时差（使用互相关算法）
        返回: 声时差（纳秒）
        
        Args:
            基准波形: 基准电压数组
            测量波形: 测量电压数组
            采样率: 采样率 (Hz)
            基准时间: 基准波形的时间数组（可选）
            测量时间: 测量波形的时间数组（可选）
        """
        try:
            from modules.core.signal_processing import calculate_cross_correlation, find_peak_with_parabolic_interpolation
            
            基准 = np.array(基准波形)
            测量 = np.array(测量波形)
            
            # 如果有时间数组，先对齐到相同的时间范围
            if 基准时间 is not None and 测量时间 is not None:
                基准_time = np.array(基准时间)
                测量_time = np.array(测量时间)
                
                if len(基准_time) > 0 and len(测量_time) > 0:
                    # 找到重叠的时间范围
                    t_start = max(基准_time[0], 测量_time[0])
                    t_end = min(基准_time[-1], 测量_time[-1])
                    
                    if t_start < t_end:
                        # 在基准波形中找到对应的索引范围
                        基准_mask = (基准_time >= t_start) & (基准_time <= t_end)
                        测量_mask = (测量_time >= t_start) & (测量_time <= t_end)
                        
                        基准_aligned = 基准[基准_mask]
                        测量_aligned = 测量[测量_mask]
                        
                        # 只有重叠区域足够大才使用对齐后的数据
                        if len(基准_aligned) >= 100 and len(测量_aligned) >= 100:
                            基准 = 基准_aligned
                            测量 = 测量_aligned
            
            # 确保两个波形长度相同
            最小长度 = min(len(基准), len(测量))
            基准 = 基准[:最小长度]
            测量 = 测量[:最小长度]
            
            # 使用共享的互相关函数（FFT加速，mode='full'）
            相关, lags = calculate_cross_correlation(基准, 测量)
            
            # 找到峰值位置（使用抛物线插值获得亚采样点精度）
            精确峰值索引, 峰值相关性 = find_peak_with_parabolic_interpolation(相关)
            峰值索引 = int(精确峰值索引)  # 整数索引用于获取对应的lag值
            
            # 计算精确的滞后值（使用抛物线插值的小数部分）
            精确滞后 = lags[峰值索引] + (精确峰值索引 - 峰值索引)
            
            # 转换为时间偏移（注意：负值表示测量信号相对于基准信号提前）
            声时差_秒 = -精确滞后 / 采样率  # 取反以匹配原有逻辑
            声时差_纳秒 = 声时差_秒 * 1e9
            
            return {
                "success": True,
                "time_shift_ns": 声时差_纳秒,
                "correlation_peak": float(峰值相关性)
            }
        except Exception as e:
            return {"success": False, "message": f"互相关计算失败: {str(e)}"}
    
    def 保存HDF5格式(self, 文件路径, 实验数据):
        """保存实验数据到HDF5格式（简化版本，只保存应力-时间差数据）"""
        try:
            import h5py
            
            with h5py.File(文件路径, 'w') as f:
                # 保存元数据
                meta_group = f.create_group('metadata')
                for key, value in 实验数据['metadata'].items():
                    if value is not None:
                        meta_group.attrs[key] = str(value) if not isinstance(value, (int, float)) else value
                
                # 保存测量数据（应力-时间差）
                if 'measurements' in 实验数据 and 实验数据['measurements']:
                    measurements = 实验数据['measurements']
                    
                    # 提取应力值和时间差数组
                    应力数组 = [0.0] + [m['应力值'] for m in measurements]
                    时间差数组 = [0.0] + [m['时间差'] * 1e9 for m in measurements]  # 转换为ns
                    
                    # 创建数据集
                    data_group = f.create_group('stress_time_data')
                    data_group.create_dataset('stress_MPa', data=np.array(应力数组), compression='gzip')
                    data_group.create_dataset('time_shift_ns', data=np.array(时间差数组), compression='gzip')
                    data_group.attrs['num_points'] = len(应力数组)
                
                # 保存分析结果（拟合曲线）
                if 'analysis' in 实验数据 and 实验数据['analysis']:
                    分析 = 实验数据['analysis']
                    analysis_group = f.create_group('fitting_results')
                    
                    # 保存拟合参数
                    if '斜率' in 分析:
                        analysis_group.attrs['slope_ns_per_MPa'] = 分析['斜率'] * 1e9  # 转换为ns/MPa
                    if '截距' in 分析:
                        analysis_group.attrs['intercept_ns'] = 分析['截距'] * 1e9  # 转换为ns
                    if 'R方' in 分析:
                        analysis_group.attrs['r_squared'] = 分析['R方']
                    
                    # 保存拟合方程字符串
                    if '斜率' in 分析 and '截距' in 分析:
                        斜率_ns = 分析['斜率'] * 1e9
                        截距_ns = 分析['截距'] * 1e9
                        方程 = f"Δt = {斜率_ns:.3f}σ + {截距_ns:.3f}"
                        analysis_group.attrs['equation'] = 方程
            
            return {"success": True, "message": f"HDF5文件已保存: {文件路径}"}
        except Exception as e:
            return {"success": False, "message": f"保存HDF5失败: {str(e)}"}
    
    def 保存CSV格式(self, 文件路径, 实验数据):
        """保存应力-声时差数据到CSV格式"""
        try:
            import csv
            from datetime import datetime
            
            with open(文件路径, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入元数据
                if 'metadata' in 实验数据:
                    meta = 实验数据['metadata']
                    writer.writerow(['材料名称', meta.get('material', '')])
                    writer.writerow(['测试方向', meta.get('direction', '')])
                    
                # 使用当前时间作为导出时间
                导出时间 = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                writer.writerow(['导出时间', 导出时间])
                writer.writerow([])
                
                # 写入表头
                writer.writerow(['应力 (MPa)', '声时差 (ns)'])
                
                # 写入基准点
                writer.writerow([0.0, 0.0])
                
                # 写入测量数据
                if 'measurements' in 实验数据 and 实验数据['measurements']:
                    for measurement in 实验数据['measurements']:
                        应力 = measurement['应力值']
                        声时差 = measurement['时间差'] * 1e9  # 转换为ns
                        writer.writerow([应力, f'{声时差:.3f}'])
                
                # 写入空行
                writer.writerow([])
                
                # 写入分析结果
                if 'analysis' in 实验数据 and 实验数据['analysis']:
                    分析 = 实验数据['analysis']
                    writer.writerow(['拟合结果'])
                    if '斜率' in 分析:
                        斜率_ns = 分析['斜率'] * 1e9
                        writer.writerow(['斜率 (ns/MPa)', f'{斜率_ns:.3f}'])
                    if '截距' in 分析:
                        截距_ns = 分析['截距'] * 1e9
                        writer.writerow(['截距 (ns)', f'{截距_ns:.3f}'])
                    if 'R方' in 分析:
                        writer.writerow(['拟合优度 R²', f'{分析["R方"]:.4f}'])
            
            return {"success": True, "message": f"CSV文件已保存: {文件路径}"}
        except Exception as e:
            return {"success": False, "message": f"保存CSV失败: {str(e)}"}
    
    def 选择HDF5保存路径(self):
        """打开HDF5文件保存对话框"""
        try:
            import webview
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            default_name = f'stress_calibration_{timestamp}.h5'
            
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename=default_name,
                    file_types=('HDF5文件 (*.h5;*.hdf5)',)
                )
                
                if 文件路径:
                    if isinstance(文件路径, tuple):
                        文件路径 = 文件路径[0]
                    if not (文件路径.endswith('.h5') or 文件路径.endswith('.hdf5')):
                        文件路径 += '.h5'
                    
                    return {"success": True, "path": 文件路径}
                else:
                    return {"success": False, "message": "用户取消了保存"}
            else:
                return {"success": False, "message": "窗口未初始化"}
        except Exception as e:
            return {"success": False, "message": f"打开对话框失败: {str(e)}"}
    
    def 选择CSV保存路径(self):
        """打开CSV文件保存对话框"""
        try:
            import webview
            import os
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            default_name = f'stress_calibration_{timestamp}.csv'
            
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename=default_name,
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
            return {"success": False, "message": f"打开对话框失败: {str(e)}"}

    
    def _获取数据管理器(self):
        """获取数据管理器实例（延迟初始化）"""
        if self.data_manager is None:
            from .experiment_data_manager import ExperimentDataManager
            self.data_manager = ExperimentDataManager()
        return self.data_manager
    
    def 创建应力检测实验(self, 材料名称, 测试方向列表):
        """
        创建新的单轴应力检测实验
        
        参数:
            材料名称: 材料名称
            测试方向列表: [{"方向名称": str, "应力范围起始": float, ...}, ...]
        
        返回:
            {"success": bool, "data": {"实验ID": int}}
        """
        try:
            dm = self._获取数据管理器()
            
            # 创建实验
            实验ID = dm.创建实验(材料名称)
            
            # 添加所有测试方向
            for 方向信息 in 测试方向列表:
                dm.添加测试方向(
                    实验ID,
                    方向信息['方向名称'],
                    方向信息.get('应力范围起始', 0),
                    方向信息.get('应力范围结束', 100),
                    方向信息.get('应力步长', 10)
                )
            
            return {"success": True, "data": {"实验ID": 实验ID}}
        except Exception as e:
            return {"success": False, "message": f"创建实验失败: {str(e)}"}
    
    def 保存基准波形数据(self, 实验ID, 方向名称, 电压数据, 时间数据, 示波器采样率=None):
        """
        保存基准波形数据（含带通滤波和降噪处理）
        
        处理流程（与应力波形一致）：
        1. 带通滤波（如果启用）
        2. 小波降噪（如果启用）
        
        参数:
            实验ID: 实验ID
            方向名称: 测试方向名称
            电压数据: 电压数组
            时间数据: 时间数组
            示波器采样率: 示波器返回的采样率 (Hz)，可选
        
        注意：降噪和带通滤波配置从 self.denoise_config 和 self.bandpass_config 读取
        
        返回:
            {"success": bool, "文件路径": str}
        """
        try:
            from ..core import signal_processing
            
            dm = self._获取数据管理器()
            
            处理后波形 = np.array(电压数据)
            
            # 🔧 双重验证采样率（在函数开始时验证一次，整个函数使用同一个值）
            时间数组 = np.array(时间数据)
            采样率_计算 = None
            if len(时间数组) > 1:
                采样间隔 = 时间数组[1] - 时间数组[0]
                采样率_计算 = 1.0 / 采样间隔 if 采样间隔 > 0 else 1e9
            else:
                采样率_计算 = 1e9
            
            # 验证两种采样率是否一致
            if 示波器采样率 and 采样率_计算:
                误差 = abs(示波器采样率 - 采样率_计算) / 采样率_计算
                if 误差 > 0.01:  # 误差>1%
                    print(f"⚠️ [标定模块-基准] 采样率不一致！示波器: {示波器采样率/1e9:.3f} GSa/s, 计算: {采样率_计算/1e9:.3f} GSa/s, 误差: {误差*100:.2f}%")
            
            # 优先使用示波器返回的采样率，否则使用计算值（整个函数使用此值）
            采样率 = 示波器采样率 if 示波器采样率 else 采样率_计算
            
            # 1. 带通滤波（如果启用）- 使用 core 模块的统一函数
            if self.bandpass_config.get('enabled', False):
                lowcut = self.bandpass_config.get('lowcut', 1.5) * 1e6  # MHz转Hz
                highcut = self.bandpass_config.get('highcut', 3.5) * 1e6
                order = self.bandpass_config.get('order', 6)
                
                滤波结果 = signal_processing.apply_bandpass_filter(
                    处理后波形, 采样率, lowcut, highcut, order
                )
                
                if 滤波结果['success']:
                    处理后波形 = np.array(滤波结果['filtered'])
            
            # 2. 小波降噪（如果启用）- 从 self.denoise_config 读取
            if self.denoise_config.get('enabled', True):
                wavelet = self.denoise_config.get('wavelet', 'sym6')
                level = self.denoise_config.get('level', 5)
                threshold_mode = self.denoise_config.get('threshold_mode', 'soft')
                
                降噪结果 = signal_processing.apply_wavelet_denoising(
                    处理后波形, wavelet, level, threshold_mode, 'heursure'
                )
                
                if 降噪结果['success']:
                    处理后波形 = 降噪结果['denoised']
            
            # 3. 保存到HDF5（包含配置信息）
            保存结果 = dm.保存基准波形(
                实验ID,
                方向名称,
                处理后波形,
                时间数据,
                self.denoise_config,
                self.bandpass_config
            )
            
            return 保存结果
        except Exception as e:
            return {"success": False, "message": f"保存基准波形失败: {str(e)}"}
    
    def 保存并分析应力波形数据(self, 实验ID, 方向名称, 应力值, 电压数据, 时间数据, 示波器采样率=None):
        """
        保存并分析应力波形数据（含降噪、互相关计算）
        
        参数:
            实验ID: 实验ID
            方向名称: 测试方向名称
            应力值: 应力值 (MPa)
            电压数据: 电压数组
            时间数据: 时间数组
            示波器采样率: 示波器返回的采样率 (Hz)，可选
        
        注意：降噪和带通滤波配置从 self.denoise_config 和 self.bandpass_config 读取
        
        返回:
            {"success": bool, "data": {"时间差": float, "文件路径": str}}
        """
        try:
            from ..core import signal_processing
            
            dm = self._获取数据管理器()
            
            处理后波形 = np.array(电压数据)
            
            # 🔧 双重验证采样率（在函数开始时验证一次，整个函数使用同一个值）
            时间数组 = np.array(时间数据)
            采样率_计算 = None
            if len(时间数组) > 1:
                采样间隔 = 时间数组[1] - 时间数组[0]
                采样率_计算 = 1.0 / 采样间隔 if 采样间隔 > 0 else 1e9
            else:
                采样率_计算 = 1e9
            
            # 验证两种采样率是否一致
            if 示波器采样率 and 采样率_计算:
                误差 = abs(示波器采样率 - 采样率_计算) / 采样率_计算
                if 误差 > 0.01:  # 误差>1%
                    print(f"⚠️ [标定模块-应力] 采样率不一致！示波器: {示波器采样率/1e9:.3f} GSa/s, 计算: {采样率_计算/1e9:.3f} GSa/s, 误差: {误差*100:.2f}%")
            
            # 优先使用示波器返回的采样率，否则使用计算值（整个函数使用此值）
            采样率 = 示波器采样率 if 示波器采样率 else 采样率_计算
            
            # 1. 带通滤波（如果启用）- 使用 core 模块的统一函数
            if self.bandpass_config.get('enabled', False):
                lowcut = self.bandpass_config.get('lowcut', 1.5) * 1e6  # MHz转Hz
                highcut = self.bandpass_config.get('highcut', 3.5) * 1e6
                order = self.bandpass_config.get('order', 6)
                
                滤波结果 = signal_processing.apply_bandpass_filter(
                    处理后波形, 采样率, lowcut, highcut, order
                )
                
                if 滤波结果['success']:
                    处理后波形 = np.array(滤波结果['filtered'])
            
            # 2. 小波降噪（如果启用）- 从 self.denoise_config 读取
            if self.denoise_config.get('enabled', True):
                method = self.denoise_config.get('method', 'wavelet')
                
                if method == 'wavelet':
                    wavelet = self.denoise_config.get('wavelet', 'sym6')
                    level = self.denoise_config.get('level', 5)
                    threshold_mode = self.denoise_config.get('threshold_mode', 'soft')
                    
                    降噪结果 = signal_processing.apply_wavelet_denoising(
                        处理后波形, wavelet, level, threshold_mode, 'heursure'
                    )
                    
                    if 降噪结果['success']:
                        处理后波形 = 降噪结果['denoised']
            
            # 3. 保存应力波形（包含配置信息）
            保存结果 = dm.保存应力波形(
                实验ID,
                方向名称,
                应力值,
                处理后波形,
                时间数据,
                self.denoise_config,
                self.bandpass_config
            )
            
            if not 保存结果['success']:
                return 保存结果
            
            # 4. 加载基准波形
            基准路径 = dm.获取基准波形路径(实验ID, 方向名称)
            if not 基准路径:
                return {"success": False, "message": "基准波形不存在"}
            
            基准波形 = dm.加载波形文件(基准路径)
            if not 基准波形:
                return {"success": False, "message": "加载基准波形失败"}
            
            # 5. 互相关计算时间差（使用已验证的采样率）
            互相关结果 = self.计算互相关声时差(
                基准波形['data'],
                处理后波形,
                采样率,  # 使用函数开始时验证的采样率
                基准时间=基准波形.get('time'),
                测量时间=时间数据
            )
            
            if not 互相关结果['success']:
                return 互相关结果
            
            时间差 = 互相关结果['time_shift_ns'] * 1e-9  # 转换为秒
            
            # 6. 更新数据库
            dm.更新应力数据时间差(实验ID, 方向名称, 应力值, 时间差)
            
            return {
                "success": True,
                "data": {
                    "时间差": 时间差,
                    "文件路径": 保存结果['文件路径']
                }
            }
        except Exception as e:
            return {"success": False, "message": f"分析失败: {str(e)}"}
    
    def 线性拟合应力时间差(self, 实验ID, 方向名称):
        """
        线性拟合应力-时间差数据
        
        参数:
            实验ID: 实验ID
            方向名称: 测试方向名称
        
        返回:
            {"success": bool, "data": {"斜率": float, "截距": float, "R方": float, "数据点": list}}
        """
        try:
            from scipy.stats import linregress
            
            dm = self._获取数据管理器()
            
            # 获取数据
            数据列表 = dm.获取应力数据列表(实验ID, 方向名称)
            
            if len(数据列表) < 2:
                return {"success": False, "message": "数据点不足，至少需要2个点"}
            
            # 提取数据
            应力值列表 = [0] + [d['应力值'] for d in 数据列表 if d['时间差'] is not None]
            时间差列表 = [0] + [d['时间差'] for d in 数据列表 if d['时间差'] is not None]
            
            if len(应力值列表) < 2:
                return {"success": False, "message": "有效数据点不足"}
            
            # 线性拟合
            result = linregress(应力值列表, 时间差列表)
            
            # 保存拟合结果
            dm.保存拟合结果(
                实验ID,
                方向名称,
                result.slope,
                result.intercept,
                result.rvalue ** 2
            )
            
            return {
                "success": True,
                "data": {
                    "斜率": result.slope,
                    "截距": result.intercept,
                    "R方": result.rvalue ** 2,
                    "数据点": list(zip(应力值列表, 时间差列表))
                }
            }
        except Exception as e:
            return {"success": False, "message": f"拟合失败: {str(e)}"}
    
    def 获取应力数据列表(self, 实验ID, 方向名称):
        """获取某个方向的所有应力数据"""
        try:
            dm = self._获取数据管理器()
            数据列表 = dm.获取应力数据列表(实验ID, 方向名称)
            return {"success": True, "data": 数据列表}
        except Exception as e:
            return {"success": False, "message": f"获取数据失败: {str(e)}"}
    
    def 删除应力数据点(self, 实验ID, 方向名称, 应力值):
        """删除某个应力数据点"""
        try:
            dm = self._获取数据管理器()
            return dm.删除应力数据点(实验ID, 方向名称, 应力值)
        except Exception as e:
            return {"success": False, "message": f"删除失败: {str(e)}"}
    
    def 加载实验配置(self, 实验ID, 方向名称):
        """
        从已有实验的HDF5文件加载信号处理配置并恢复到后端对象
        
        Args:
            实验ID: 实验ID
            方向名称: 方向名称
        
        Returns:
            dict: {"success": bool, "data": {"denoise_config": dict, "bandpass_config": dict}}
        """
        try:
            dm = self._获取数据管理器()
            
            # 获取基准波形路径
            基准路径 = dm.获取基准波形路径(实验ID, 方向名称)
            if not 基准路径:
                return {"success": False, "message": "基准波形不存在，无法加载配置"}
            
            # 从HDF5加载配置
            配置结果 = dm.加载信号处理配置(基准路径)
            
            if not 配置结果['success']:
                return 配置结果
            
            # 恢复配置到后端对象
            if 配置结果.get('denoise_config'):
                self.denoise_config.update(配置结果['denoise_config'])
            
            if 配置结果.get('bandpass_config'):
                self.bandpass_config.update(配置结果['bandpass_config'])
            
            return {
                "success": True,
                "data": {
                    "denoise_config": self.denoise_config,
                    "bandpass_config": self.bandpass_config
                }
            }
        except Exception as e:
            return {"success": False, "message": f"加载配置失败: {str(e)}"}
