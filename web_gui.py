"""
================================================================================
                        Web GUI模块 - 基于pywebview的波形显示
================================================================================
⚠️  重要：本项目始终使用中文交流

功能：使用pywebview提供现代化Web界面显示示波器波形
架构：模块化设计，WebAPI作为路由层调用各功能模块
"""

import webview
import os
from modules import OscilloscopeBase, RealtimeCapture, WaveformAnalysis, StressCalibration, SignalProcessingWrapper
from modules.stress_detection_uniaxial import (
    FieldDatabaseManager, FieldExperimentHDF5, ShapeUtils, PointGenerator,
    StressFieldInterpolation, ContourGenerator,
    FieldExperiment, FieldCapture, DataValidator, DataExporter,
    ErrorCode, APIResponse, FieldLogger
)


class WebAPI:
    """Web界面API类，提供JavaScript调用的后端接口（路由层）"""

    def __init__(self):
        # 创建各功能模块实例
        self.osc = OscilloscopeBase()
        self.realtime = None  # 需要window实例，稍后初始化
        self.analysis = None  # 需要window实例，稍后初始化
        self.calibration = None  # 需要window实例，稍后初始化
        self.field_experiment = None  # 应力场实验管理器
        self.field_capture = None  # 应力场数据采集器
        self.contour_generator = None  # 云图生成器
        self.data_exporter = None  # 数据导出器
        self.signal_proc = SignalProcessingWrapper()  # 信号处理包装
        self.window = None
    
    def set_window(self, window):
        """设置窗口实例并初始化需要window的模块"""
        self.window = window
        self.realtime = RealtimeCapture(self.osc, window)
        self.analysis = WaveformAnalysis(window)
        self.calibration = StressCalibration(window)
        # 初始化应力场测绘模块
        self.field_experiment = FieldExperiment()
        db = self.field_experiment.db
        self.field_capture = FieldCapture(db, self.osc)
        self.data_exporter = DataExporter(db)
    
    # ==================== 私有辅助方法 ====================
    
    def _select_file(self, file_types, allow_multiple=False):
        """打开文件选择对话框（私有辅助方法）
        
        Args:
            file_types: 文件类型元组，如 ('CSV文件 (*.csv)', '所有文件 (*.*)')
            allow_multiple: 是否允许多选
        
        Returns:
            {"success": bool, "file_path": str} 或 {"success": bool, "file_paths": list}
        """
        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=file_types,
                allow_multiple=allow_multiple
            )
            if result and len(result) > 0:
                if allow_multiple:
                    return {"success": True, "file_paths": result}
                else:
                    return {"success": True, "file_path": result[0]}
            return {"success": False, "message": "未选择文件"}
        except Exception as e:
            return {"success": False, "message": f"选择文件失败: {str(e)}"}
    
    def _save_file(self, file_types, default_filename):
        """打开文件保存对话框（私有辅助方法）
        
        Args:
            file_types: 文件类型元组
            default_filename: 默认文件名
        
        Returns:
            {"success": bool, "file_path": str}
        """
        try:
            result = self.window.create_file_dialog(
                webview.SAVE_DIALOG,
                file_types=file_types,
                save_filename=default_filename
            )
            if result and len(result) > 0:
                return {"success": True, "file_path": result[0]}
            return {"success": False, "message": "未选择保存路径"}
        except Exception as e:
            return {"success": False, "message": f"选择路径失败: {str(e)}"}
    
    # ==================== 示波器基础功能 ====================
    
    def 搜索设备(self):
        """搜索可用设备"""
        return self.osc.搜索设备()
    
    def 连接示波器(self, 设备地址=None):
        """连接示波器"""
        return self.osc.连接示波器(设备地址)
    
    def 断开连接(self):
        """断开示波器连接"""
        return self.osc.断开连接()
    
    def 获取波形数据(self, 通道=1):
        """获取NORM模式波形数据（实时显示）"""
        return self.osc.获取波形数据_NORM模式(通道)
    
    def 设置存储深度(self, 深度):
        """设置存储深度"""
        return self.osc.设置存储深度(深度)
    
    def 设置时基(self, 时基值):
        """设置主时基档位"""
        return self.osc.设置时基(时基值)
    
    def 设置水平位置(self, 偏移量):
        """设置示波器的水平位置偏移"""
        return self.osc.设置水平位置(偏移量)
    
    def 获取水平位置(self):
        """查询当前的水平位置偏移"""
        return self.osc.获取水平位置()
    
    def 设置垂直位置(self, 通道, 偏移量):
        """设置指定通道的垂直位置偏移"""
        return self.osc.设置垂直位置(通道, 偏移量)
    
    def 获取完整状态(self):
        """获取示波器完整状态信息"""
        return self.osc.获取完整状态()
    
    def 获取通道状态(self):
        """获取所有通道的开启状态"""
        return self.osc.获取通道状态()
    
    def 自动设置(self):
        """执行自动设置"""
        return self.osc.自动设置()
    
    def 运行示波器(self):
        """启动示波器采集"""
        return self.osc.运行示波器()
    
    def 停止示波器(self):
        """停止示波器采集"""
        return self.osc.停止示波器()
    
    def 获取运行状态(self):
        """查询示波器运行状态"""
        return self.osc.获取运行状态()
    
    def 设置垂直灵敏度(self, 通道, 灵敏度):
        """设置指定通道的垂直灵敏度（V/div）"""
        return self.osc.设置垂直灵敏度(通道, 灵敏度)
    
    def 获取垂直灵敏度(self, 通道):
        """获取指定通道的垂直灵敏度（V/div）"""
        return self.osc.获取垂直灵敏度(通道)
    
    # ==================== 实时采集功能 ====================
    
    def 选择保存路径(self, 格式='npy'):
        """打开文件保存对话框"""
        return self.realtime.选择保存路径(格式)
    
    def 保存波形到文件(self, 文件路径, 通道, 格式='npy'):
        """保存波形数据到文件"""
        return self.realtime.保存波形到文件(文件路径, 通道, 格式)
    
    def 获取RAW波形数据(self, 通道=1):
        """🆕 获取RAW模式波形数据（12bit精度，完整存储深度）"""
        return self.osc.获取波形数据_RAW模式_屏幕范围(通道)
    
    # ==================== 波形分析功能 ====================
    
    def 选择打开文件(self):
        """打开文件选择对话框"""
        return self.analysis.选择打开文件()
    
    def 加载波形文件(self, 文件路径):
        """从NPY文件加载波形数据"""
        return self.analysis.加载波形文件(文件路径)
    
    # ==================== 应力系数标定功能 ====================
    
    def 计算互相关声时差(self, 基准波形, 测量波形, 采样率):
        """计算两个波形之间的声时差"""
        return self.calibration.计算互相关声时差(基准波形, 测量波形, 采样率)
    
    def 保存CSV格式(self, 文件路径, 实验数据):
        """保存应力-声时差数据到CSV格式"""
        return self.calibration.保存CSV格式(文件路径, 实验数据)
    
    def 选择CSV保存路径(self):
        """打开CSV文件保存对话框"""
        return self.calibration.选择CSV保存路径()
    
    # ==================== 单轴应力检测实验功能（新增）====================
    

    
    def 检查方向是否存在(self, 材料名称, 方向名称):
        """🆕 检查指定材料的指定方向是否已存在于数据库中（只检查有基准波形的完整数据）"""
        from modules.core.data_manager import ExperimentDataManager
        dm = ExperimentDataManager()
        result = dm.检查方向是否存在(材料名称, 方向名称)
        dm.关闭()
        return result
    
    def 创建应力检测实验(self, 材料名称, 测试方向列表):
        """🆕 创建新的单轴应力检测实验"""
        return self.calibration.创建应力检测实验(材料名称, 测试方向列表)
    
    def 保存基准波形数据(self, 实验ID, 方向名称, 电压数据, 时间数据, 降噪配置=None, 带通滤波配置=None, 示波器采样率=None):
        """🆕 保存基准波形数据（从订阅获取的波形，含带通滤波和降噪处理）"""
        return self.calibration.保存基准波形数据(实验ID, 方向名称, 电压数据, 时间数据, 降噪配置, 带通滤波配置, 示波器采样率)
    
    def 保存并分析应力波形数据(self, 实验ID, 方向名称, 应力值, 电压数据, 时间数据, 降噪配置=None, 带通滤波配置=None, 示波器采样率=None):
        """🆕 保存并分析应力波形数据（从订阅获取的波形）"""
        return self.calibration.保存并分析应力波形数据(实验ID, 方向名称, 应力值, 电压数据, 时间数据, 降噪配置, 带通滤波配置, 示波器采样率)
    
    def 线性拟合应力时间差(self, 实验ID, 方向名称):
        """🆕 线性拟合应力-时间差数据"""
        return self.calibration.线性拟合应力时间差(实验ID, 方向名称)
    
    def 获取应力数据列表(self, 实验ID, 方向名称):
        """🆕 获取某个方向的所有应力数据"""
        return self.calibration.获取应力数据列表(实验ID, 方向名称)
    
    def 删除应力数据点(self, 实验ID, 方向名称, 应力值):
        """🆕 删除某个应力数据点"""
        return self.calibration.删除应力数据点(实验ID, 方向名称, 应力值)
    
    # ==================== 实验数据管理 ====================
    
    def 加载实验完整数据(self, 实验ID):
        """🆕 加载指定实验的完整数据"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            实验数据 = dm.加载实验完整数据(实验ID)
            dm.关闭()
            return {"success": True, "data": 实验数据}
        except Exception as e:
            return {"success": False, "message": f"加载实验数据失败: {str(e)}"}
    
    def 获取所有实验列表(self):
        """🆕 获取所有实验列表（嵌套结构，用于应力场测绘模块）"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            实验列表 = dm.获取所有实验列表()
            dm.关闭()  # 确保关闭连接
            return {"success": True, "data": 实验列表}
        except Exception as e:
            return {"success": False, "message": f"获取实验列表失败: {str(e)}"}
    
    def 获取所有方向列表(self):
        """🆕 获取所有方向列表（扁平化结构，用于标定模块）"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            方向列表 = dm.获取所有方向列表()
            dm.关闭()
            return {"success": True, "data": 方向列表}
        except Exception as e:
            return {"success": False, "message": f"获取方向列表失败: {str(e)}"}
    
    def 删除方向数据(self, 实验ID, 方向ID):
        """🆕 删除指定方向的数据"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            result = dm.删除方向(实验ID, 方向ID)
            dm.关闭()  # 确保关闭连接，提交所有更改
            return result
        except Exception as e:
            return {"success": False, "message": f"删除方向失败: {str(e)}"}
    
    def 删除全部数据(self):
        """🆕 删除所有实验数据并重置ID计数器"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            result = dm.删除全部数据()
            dm.关闭()  # 确保关闭连接，提交所有更改
            return result
        except Exception as e:
            return {"success": False, "message": f"删除全部数据失败: {str(e)}"}
    
    def 导出方向CSV数据(self, 实验ID, 方向ID):
        """🆕 导出指定方向的数据为CSV"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            dm.window = self.window  # 传递window对象
            result = dm.导出方向CSV(实验ID, 方向ID)
            dm.关闭()
            return result
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}
    
    def 导出全部CSV数据(self):
        """🆕 导出所有实验数据为CSV"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            dm.window = self.window  # 传递window对象
            result = dm.导出全部CSV()
            dm.关闭()
            return result
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}
    
    def 重置方向数据(self, 实验ID, 方向名称):
        """🆕 重置指定方向的实验数据"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            result = dm.重置方向(实验ID, 方向名称)
            dm.关闭()
            return result
        except Exception as e:
            return {"success": False, "message": f"重置失败: {str(e)}"}
    
    # ==================== 信号处理功能 ====================
    
    def 小波降噪(self, 信号数据, 小波类型='sym6', 分解层数=5, 阈值方法='soft', 阈值模式='heursure'):
        """应用小波降噪"""
        return self.signal_proc.小波降噪(信号数据, 小波类型, 分解层数, 阈值方法, 阈值模式)
    
    def Hilbert变换(self, 信号数据):
        """计算Hilbert包络"""
        return self.signal_proc.Hilbert变换(信号数据)
    
    def 检测峰值(self, 信号数据, 时间数据=None, 最小距离=None, 突出度=None):
        """检测信号峰值"""
        return self.signal_proc.检测峰值(信号数据, 时间数据, 最小距离, 突出度)
    
    def 查找时间附近峰值(self, 时间数据, 信号数据, 目标时间, 窗口大小=200):
        """在指定时间附近查找峰值"""
        return self.signal_proc.查找时间附近峰值(时间数据, 信号数据, 目标时间, 窗口大小)
    
    def 计算时间差(self, 时间1, 时间2):
        """计算两个时间点的时间差"""
        return self.signal_proc.计算时间差(时间1, 时间2)
    
    def 获取可用小波类型(self):
        """获取可用的小波类型列表"""
        return self.signal_proc.获取可用小波类型()
    
    # ==================== 互相关分析功能 ====================
    
    def 选择多个CSV文件(self):
        """选择多个CSV文件用于互相关分析"""
        return self.analysis.选择多个CSV文件()
    
    def 加载多个CSV文件(self, 文件路径列表):
        """加载多个CSV文件"""
        return self.analysis.加载多个CSV文件(文件路径列表)
    
    def 计算互相关(self, 参考信号索引, truncate_start=5.0, truncate_end=None):
        """计算互相关"""
        return self.analysis.计算互相关(参考信号索引, truncate_start, truncate_end)
    
    def 导出互相关结果(self, 文件路径):
        """导出互相关结果"""
        return self.analysis.导出互相关结果(文件路径)
    
    def 选择互相关CSV保存路径(self):
        """选择互相关结果保存路径"""
        return self.analysis.选择CSV保存路径()
    
    # ==================== 应力场测绘功能（新版）====================
    
    # ---------- 实验管理 ----------
    
    def create_field_experiment(self, experiment_data):
        """创建应力场实验
        
        Args:
            experiment_data: {
                "name": str,
                "test_purpose": str,
                "sample_material": str,
                "sample_thickness": float,
                "operator": str,
                "notes": str
            }
        
        Returns:
            {"success": bool, "error_code": int, "message": str, "data": {...}}
        """
        return self.field_experiment.create_experiment(experiment_data)
    
    def load_field_experiment(self, exp_id):
        """加载应力场实验（路由层 - 简化版）
        
        Args:
            exp_id: 实验ID (如 "FIELD001")
        
        Returns:
            {"success": bool, "data": {...}}
        """
        # 调用模块层的业务逻辑方法
        result = self.field_experiment.load_and_sync_experiment(
            exp_id,
            field_capture=self.field_capture,
            contour_generator_class=ContourGenerator
        )
        
        # 保存云图生成器实例
        if result.get('success') and result.get('contour_generator'):
            self.contour_generator = result.pop('contour_generator')
        
        return result
    
    def delete_field_experiment(self, exp_id):
        """删除应力场实验
        
        Args:
            exp_id: 实验ID
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_experiment.delete_experiment(exp_id)
    
    def complete_field_experiment(self, exp_id=None):
        """完成应力场实验
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_experiment.complete_experiment(exp_id)
    
    def reset_field_experiment(self, exp_id=None):
        """重置应力场实验（清空所有测点数据，状态恢复为planning）
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
        
        Returns:
            {"success": bool, "message": str}
        """
        result = self.field_experiment.reset_experiment(exp_id)
        
        # 🔧 修复：清空field_capture中的基准波形缓存
        if result['success'] and self.field_capture:
            self.field_capture.baseline_waveform = None
        
        return result
    
    def get_field_experiment_list(self):
        """获取所有应力场实验列表
        
        Returns:
            list: 实验列表
        """
        return self.field_experiment.get_experiment_list()
    
    def get_field_experiment_statistics(self, exp_id=None):
        """获取实验统计信息
        
        Args:
            exp_id: 实验ID (可选)
        
        Returns:
            {"success": bool, "data": {...}}
        """
        return self.field_experiment.get_experiment_statistics(exp_id)
    
    # ---------- 标定数据 ----------
    
    def load_calibration_from_experiment(self, calib_exp_id, direction):
        """从本地标定实验加载标定系数（路由层 - 简化版）
        
        Args:
            calib_exp_id: 标定实验ID
            direction: 测试方向 (如 "0°")
        
        Returns:
            {"success": bool, "data": {...}, "warnings": [...]}
        """
        # 调用模块层方法，传入采集器用于同步
        return self.field_experiment.load_calibration_from_experiment(
            calib_exp_id, 
            direction,
            field_capture=self.field_capture
        )
    
    def load_calibration_from_file(self, file_path):
        """从文件导入标定数据（路由层 - 简化版）
        
        Args:
            file_path: 文件路径 (JSON或CSV)
        
        Returns:
            {"success": bool, "data": {...}, "warnings": [...]}
        """
        # 调用模块层方法，传入采集器用于同步
        return self.field_experiment.load_calibration_from_file(
            file_path,
            field_capture=self.field_capture
        )
    
    def save_manual_calibration(self, calibration_data):
        """保存手动输入的标定数据（路由层 - 简化版）
        
        Args:
            calibration_data: 标定数据 {k, source, ...}
        
        Returns:
            {"success": bool, "message": str}
        """
        # 调用模块层方法，传入采集器用于同步
        return self.field_experiment.save_manual_calibration(
            calibration_data,
            field_capture=self.field_capture
        )
    
    def validate_calibration_data(self, calibration_data):
        """验证标定数据有效性
        
        Args:
            calibration_data: 标定数据 {k, r_squared, ...}
        
        Returns:
            {"success": bool, "is_valid": bool, "warnings": [...]}
        """
        return self.field_experiment.validate_calibration_data(calibration_data)
    

    
    # ---------- 形状和布点 ----------
    
    def validate_shape(self, shape_config):
        """验证形状配置
        
        Args:
            shape_config: 形状配置字典
        
        Returns:
            {"success": bool, "is_valid": bool, "area": float, "warnings": [...]}
        """
        return ShapeUtils.validate_shape(shape_config)
    
    def get_effective_bounding_box(self, shape_config):
        """获取布尔运算后形状的有效边界框
        
        Args:
            shape_config: 形状配置字典（包含modifiers）
        
        Returns:
            {"success": bool, "bounds": {"minX", "minY", "maxX", "maxY"}, "has_modifiers": bool}
        """
        return ShapeUtils.get_effective_bounding_box(shape_config)
    
    def save_shape_config(self, shape_config):
        """保存形状配置到当前实验
        
        Args:
            shape_config: 形状配置
        
        Returns:
            {"success": bool, "message": str, "area": float}
        """
        return self.field_experiment.save_shape_config(shape_config)
    
    def generate_point_layout(self, shape_config, layout_type, params):
        """生成测点布局
        
        Args:
            shape_config: 形状配置
            layout_type: 布点类型 ('grid' | 'polar' | 'adaptive' | 'custom')
            params: 布点参数
        
        Returns:
            {"success": bool, "points": [...], "total_count": int, "valid_count": int}
        """
        if layout_type == 'grid':
            return PointGenerator.generate_grid_points(shape_config, params)
        elif layout_type == 'polar':
            return PointGenerator.generate_polar_points(shape_config, params)
        elif layout_type == 'adaptive':
            return PointGenerator.generate_adaptive_points(shape_config, params)
        elif layout_type == 'custom':
            file_path = params.get('file_path', '')
            return PointGenerator.load_custom_points(file_path, shape_config)
        else:
            return {"success": False, "error": f"不支持的布点类型: {layout_type}"}
    
    def optimize_point_order(self, points, strategy='zigzag'):
        """优化测点顺序
        
        Args:
            points: 测点列表
            strategy: 优化策略 ('zigzag' | 'nearest' | 'spiral')
        
        Returns:
            {"success": bool, "points": [...], "total_distance": float}
        """
        return PointGenerator.optimize_point_order(points, strategy)
    
    def save_point_layout(self, points, layout_type='grid', params=None):
        """保存测点布局到当前实验（同时保存布点配置）
        
        Args:
            points: 测点列表
            layout_type: 布点类型 (可选，默认'grid')
            params: 布点参数 (可选)
        
        Returns:
            {"success": bool, "message": str}
        """
        params = params or {}
        return self.field_experiment.save_layout_config(layout_type, params, points)
    
    def select_custom_points_file(self):
        """打开文件选择对话框选择自定义测点文件
        
        Returns:
            {"success": bool, "file_path": str}
        """
        return self._select_file(
            file_types=('CSV文件 (*.csv)', '所有文件 (*.*)'),
            allow_multiple=False
        )
    
    # ---------- 数据采集 ----------
    
    def capture_field_point_with_waveform(self, point_index, voltage_data, time_data, sample_rate, auto_denoise=True, bandpass_enabled=True):
        """采集单个测点（新接口，前端传入波形数据）
        
        Args:
            point_index: 测点索引
            voltage_data: 电压数据数组
            time_data: 时间数据数组
            sample_rate: 采样率
            auto_denoise: 是否自动降噪
            bandpass_enabled: 是否启用带通滤波
        
        Returns:
            {"success": bool, "data": {...}}
        """
        waveform = {
            'time': time_data,
            'voltage': voltage_data,
            'sample_rate': sample_rate
        }
        return self.field_capture.capture_point_with_waveform(point_index, waveform, auto_denoise, bandpass_enabled)
    
    def set_baseline_point(self, point_index):
        """设置基准测点（已采集的测点）
        
        Args:
            point_index: 测点索引
        
        Returns:
            {"success": bool, "message": str, "recalculated_points": int}
        """
        return self.field_capture.set_baseline_point(point_index)
    
    def set_baseline_stress_value(self, stress_value):
        """设置基准点应力值（用于绝对应力模式）
        
        Args:
            stress_value: 基准点应力值 (MPa)
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_capture.set_baseline_stress(stress_value)
    
    def designate_baseline_point(self, point_index):
        """预设基准点ID（在采集前指定）
        
        Args:
            point_index: 测点索引
        
        Returns:
            {"success": bool, "message": str}
        """
        if not self.field_experiment.current_exp_id:
            return {"success": False, "message": "没有当前实验"}
        
        # 更新数据库中的基准点ID
        result = self.field_experiment.db.update_experiment(
            self.field_experiment.current_exp_id,
            {'baseline_point_id': point_index}
        )
        
        if result['success']:
            return {"success": True, "message": f"基准点已设置为测点 {point_index}"}
        else:
            return {"success": False, "message": result.get('message', '设置失败')}
    
    def validate_baseline_quality(self):
        """验证当前基准波形的质量
        
        Returns:
            {"success": bool, "is_valid": bool, "quality": {...}}
        """
        return self.field_capture.validate_baseline_quality()
    
    def skip_field_point(self, point_index, reason=""):
        """跳过测点
        
        Args:
            point_index: 测点索引
            reason: 跳过原因
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_capture.skip_point(point_index, reason)
    
    def recapture_field_point(self, point_index, auto_denoise=True):
        """重新采集测点
        
        Args:
            point_index: 测点索引
            auto_denoise: 是否自动降噪
        
        Returns:
            {"success": bool, "data": {...}}
        """
        return self.field_capture.recapture_point(point_index, auto_denoise)
    
    def set_denoise_config(self, config):
        """设置降噪配置
        
        Args:
            config: 降噪配置 {enabled, method, wavelet, level, ...}
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_capture.set_denoise_config(config)
    
    def set_bandpass_config(self, config):
        """设置带通滤波配置
        
        Args:
            config: 带通滤波配置 {enabled, lowcut, highcut, order}
        
        Returns:
            {"success": bool, "message": str}
        """
        return self.field_capture.set_bandpass_config(config)
    
    def get_denoise_config(self):
        """获取降噪配置
        
        Returns:
            {"success": bool, "data": {...}}
        """
        if self.field_capture:
            return {"success": True, "data": self.field_capture.denoise_config}
        return {"success": False, "message": "未初始化"}
    
    def get_bandpass_config(self):
        """获取带通滤波配置
        
        Returns:
            {"success": bool, "data": {...}}
        """
        if self.field_capture:
            return {"success": True, "data": self.field_capture.bandpass_config}
        return {"success": False, "message": "未初始化"}
    
    def test_denoise_effect(self, waveform=None):
        """测试降噪效果
        
        Args:
            waveform: 波形数据 (可选)
        
        Returns:
            {"success": bool, "original_snr": float, "denoised_snr": float, ...}
        """
        return self.field_capture.test_denoise_effect(waveform)
    
    def evaluate_waveform_quality(self, waveform):
        """评估波形质量
        
        Args:
            waveform: 波形数据 {time, voltage, sample_rate}
        
        Returns:
            {"score": float, "snr": float, "is_good": bool, "issues": [...]}
        """
        return self.field_capture.evaluate_waveform_quality(waveform)
    
    # ---------- 云图生成 ----------
    
    def update_field_contour(self, exp_id=None, config=None):
        """更新云图
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
            config: 配置参数 (可选) {method, resolution, smoothing, vmin, vmax}
        
        Returns:
            {"success": bool, "mode": str, "grid": {...}, "method": str, "confidence": str}
        """
        exp_id = exp_id or self.field_experiment.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        # 解析配置参数
        config = config or {}
        method = config.get('method', 'auto')
        resolution = config.get('resolution', 100)  # 默认100，与前端下拉框一致
        smoothing = config.get('smoothing', True)  # 默认启用平滑
        
        # 获取已测量的测点
        measured_points = self.field_experiment.db.get_measured_points(exp_id)
        
        if not measured_points:
            return {
                "success": True,
                "mode": "points_only",
                "message": "没有已测量的测点"
            }
        
        # 加载实验数据获取形状配置
        exp_result = self.field_experiment.db.load_experiment(exp_id)
        if not exp_result['success']:
            return exp_result
        
        shape_config = exp_result['data']['experiment'].get('shape_config', {})
        
        # 转换测点格式
        points = [{
            'x': p['x_coord'],
            'y': p['y_coord'],
            'stress_value': p['stress_value']
        } for p in measured_points]
        
        # 执行插值
        interp_result = StressFieldInterpolation.interpolate_stress_field(
            points, shape_config, resolution=resolution, method=method, smoothing=smoothing
        )
        
        return interp_result
    
    def generate_contour_colors(self, grid_data, shape_config, colormap=None, vmin=None, vmax=None):
        """生成云图颜色数据
        
        Args:
            grid_data: 插值网格数据 {xi, yi, zi}
            shape_config: 形状配置
            colormap: 色标名称
            vmin, vmax: 色标范围
        
        Returns:
            {"success": bool, "colors": [...], "stats": {...}, "colorbar": {...}}
        """
        if not self.contour_generator:
            exp_id = self.field_experiment.current_exp_id or 'temp'
            self.contour_generator = ContourGenerator(exp_id)
        
        return self.contour_generator.generate_contour(
            grid_data, shape_config, 
            colormap=colormap, vmin=vmin, vmax=vmax
        )
    
    def get_colorbar_data(self, vmin, vmax, colormap=None):
        """获取色标数据
        
        Args:
            vmin, vmax: 值范围
            colormap: 色标名称
        
        Returns:
            {"success": bool, "colors": [...], "values": [...]}
        """
        if not self.contour_generator:
            exp_id = self.field_experiment.current_exp_id or 'temp'
            self.contour_generator = ContourGenerator(exp_id)
        
        return self.contour_generator.get_colorbar_data(vmin, vmax, colormap)
    
    def get_contour_lines(self, exp_id=None, levels=8):
        """获取等高线数据
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
            levels: 等高线数量（默认8条）
        
        Returns:
            {"success": bool, "contours": [...], "levels": [...]}
        """
        exp_id = exp_id or self.field_experiment.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        # 先获取云图数据
        contour_result = self.update_field_contour(exp_id)
        
        if not contour_result.get('success') or contour_result.get('mode') == 'points_only':
            return {"success": False, "message": "没有足够的数据生成等高线"}
        
        grid_data = contour_result.get('grid')
        if not grid_data:
            return {"success": False, "message": "云图数据不完整"}
        
        # 生成等高线
        if not self.contour_generator:
            self.contour_generator = ContourGenerator(exp_id)
        
        result = self.contour_generator.generate_contour_lines(grid_data, levels=levels)
        return result
    
    def export_contour_image(self, exp_id=None, format='png', dpi=300, options=None):
        """导出云图图片
        
        Args:
            exp_id: 实验ID
            format: 图片格式 ('png' | 'svg')
            dpi: 分辨率
            options: 导出选项 {show_points, show_colorbar, title, output_path, resolution}
        
        Returns:
            {"success": bool, "file_path": str}
        """
        exp_id = exp_id or self.field_experiment.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        options = options or {}
        
        # 🔧 导出时使用更高分辨率（默认500，比实时显示更清晰）
        export_resolution = options.get('resolution', 500)
        
        # 获取云图数据（使用高分辨率重新生成）
        contour_result = self.update_field_contour(exp_id, config={'resolution': export_resolution})
        if not contour_result['success'] or contour_result.get('mode') == 'points_only':
            return {"success": False, "message": "没有足够的数据生成云图"}
        
        # 获取实验数据
        exp_result = self.field_experiment.db.load_experiment(exp_id)
        if not exp_result['success']:
            return exp_result
        
        shape_config = exp_result['data']['experiment'].get('shape_config', {})
        points = exp_result['data']['points']
        
        # 初始化云图生成器
        if not self.contour_generator:
            self.contour_generator = ContourGenerator(exp_id)
        
        # 🆕 如果没有指定输出路径，打开文件保存对话框
        output_path = options.get('output_path')
        if not output_path:
            file_types = ('PNG图片 (*.png)', 'SVG矢量图 (*.svg)', '所有文件 (*.*)')
            if format == 'svg':
                file_types = ('SVG矢量图 (*.svg)', 'PNG图片 (*.png)', '所有文件 (*.*)')
            
            result = self._save_file(file_types, f'{exp_id}_contour.{format}')
            if not result['success']:
                return result
            output_path = result['file_path']
        
        return self.contour_generator.export_contour_image(
            contour_result['grid'],
            shape_config,
            points=points,
            output_path=output_path,
            format=format,
            dpi=dpi,
            show_points=options.get('show_points', True),
            show_colorbar=options.get('show_colorbar', True),
            show_contour_lines=options.get('show_contour_lines', True),
            contour_levels=options.get('contour_levels', 8),
            title=options.get('title')
        )
    

    
    # ---------- 数据验证和导出 ----------
    
    def export_field_data(self, exp_id, format, options=None):
        """导出实验数据
        
        Args:
            exp_id: 实验ID
            format: 导出格式 ('csv' | 'excel' | 'hdf5')
            options: 导出选项 {output_path, include_quality, include_waveforms}
        
        Returns:
            {"success": bool, "file_path": str}
        """
        exp_id = exp_id or self.field_experiment.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        options = options or {}
        
        # 🆕 如果没有指定输出路径，打开文件保存对话框
        output_path = options.get('output_path')
        if not output_path:
            if format == 'csv':
                file_types = ('CSV文件 (*.csv)', '所有文件 (*.*)')
                default_name = f'{exp_id}_data.csv'
            elif format == 'excel':
                file_types = ('Excel文件 (*.xlsx)', '所有文件 (*.*)')
                default_name = f'{exp_id}_data.xlsx'
            elif format == 'hdf5':
                file_types = ('HDF5文件 (*.h5)', '所有文件 (*.*)')
                default_name = f'{exp_id}_export.h5'
            else:
                return {"success": False, "message": f"不支持的导出格式: {format}"}
            
            result = self._save_file(file_types, default_name)
            if not result['success']:
                return result
            output_path = result['file_path']
        
        if format == 'csv':
            return self.data_exporter.export_to_csv(
                exp_id, 
                output_path,
                options.get('include_quality', True)
            )
        elif format == 'excel':
            return self.data_exporter.export_to_excel(
                exp_id,
                output_path,
                options.get('single_sheet', False)  # 支持单表/多表选项
            )
        elif format == 'hdf5':
            return self.data_exporter.export_to_hdf5(
                exp_id,
                output_path,
                options.get('include_waveforms', True)
            )
        else:
            return {"success": False, "message": f"不支持的导出格式: {format}"}
    

    

def 创建窗口():
    """创建单一窗口（直接加载主界面，开屏画面内嵌在主界面中）"""
    api = WebAPI()

    # 获取static目录的绝对路径
    当前目录 = os.path.dirname(os.path.abspath(__file__))
    static目录 = os.path.join(当前目录, "static")
    html文件 = os.path.join(static目录, "index.html")
    
    # 检查 HTML 文件是否存在
    if not os.path.exists(html文件):
        raise FileNotFoundError(f"找不到 HTML 文件: {html文件}")
    
    # 创建窗口，直接加载主界面（开屏画面内嵌在主界面中）
    窗口 = webview.create_window(
        "普源示波器实时波形显示系统",
        html文件,
        js_api=api,
        width=1400,
        height=800,
        resizable=True,
        fullscreen=False,
        min_size=(1024, 600),
        background_color='#1e3c72',  # 与开屏背景色一致
    )
    
    # 设置窗口引用到API对象
    api.set_window(窗口)

    return 窗口


def 主界面加载完成后(窗口):
    """主界面加载完成后，自动隐藏开屏画面"""
    import time
    import threading
    
    def 隐藏开屏画面():
        # 等待开屏动画展示一段时间
        time.sleep(2.0)
        
        # 触发开屏画面淡出
        try:
            窗口.evaluate_js('window.hideSplash && window.hideSplash()')
        except:
            pass
    
    # 在新线程中执行
    threading.Thread(target=隐藏开屏画面, daemon=True).start()


def 启动():
    """启动Web GUI（单窗口方案 - 开屏画面内嵌）"""
    # 禁用所有调试输出和警告
    import logging
    import warnings
    import sys
    
    logging.getLogger('pywebview').setLevel(logging.CRITICAL)
    warnings.filterwarnings('ignore')

    try:
        # 创建单一窗口（开屏画面内嵌在主界面中）
        窗口 = 创建窗口()
        
        # 设置主界面加载完成后的回调
        窗口.events.loaded += lambda: 主界面加载完成后(窗口)
        
        # Windows 平台优化配置
        if sys.platform == 'win32':
            # 设置 EdgeWebView2 用户数据目录（使用本地缓存，加快启动）
            当前目录 = os.path.dirname(os.path.abspath(__file__))
            缓存目录 = os.path.join(当前目录, '.webview_cache')
            
            # 确保缓存目录存在
            if not os.path.exists(缓存目录):
                os.makedirs(缓存目录)
            
            webview.start(
                gui='edgechromium',
                debug=False,
                http_server=True,  # 使用内置 HTTP 服务器
                storage_path=缓存目录  # 指定用户数据目录，减少初始化时间
            )
        else:
            webview.start()
            
    except Exception as e:
        sys.stderr.write(f"启动失败: {e}\n")
        input("按回车键退出...")
