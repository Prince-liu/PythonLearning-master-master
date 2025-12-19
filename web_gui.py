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
from modules import OscilloscopeBase, RealtimeCapture, WaveformAnalysis, StressCalibration, StressDetectionUniaxial, SignalProcessingWrapper


class WebAPI:
    """Web界面API类，提供JavaScript调用的后端接口（路由层）"""

    def __init__(self):
        # 创建各功能模块实例
        self.osc = OscilloscopeBase()
        self.realtime = None  # 需要window实例，稍后初始化
        self.analysis = None  # 需要window实例，稍后初始化
        self.calibration = None  # 需要window实例，稍后初始化
        self.detection_uniaxial = None  # 需要window实例，稍后初始化
        self.signal_proc = SignalProcessingWrapper()  # 信号处理包装
        self.window = None
    
    def set_window(self, window):
        """设置窗口实例并初始化需要window的模块"""
        self.window = window
        self.realtime = RealtimeCapture(self.osc, window)
        self.analysis = WaveformAnalysis(window)
        self.calibration = StressCalibration(window)
        self.detection_uniaxial = StressDetectionUniaxial(window)
    
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
    
    def 自动设置(self):
        """执行自动设置"""
        return self.osc.自动设置()
    
    def 运行示波器(self):
        """启动示波器采集"""
        return self.osc.运行示波器()
    
    def 停止示波器(self):
        """停止示波器采集"""
        return self.osc.停止示波器()
    
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
    
    def 获取波形文件列表(self, 目录路径=None):
        """获取指定目录下的所有波形文件"""
        return self.analysis.获取波形文件列表(目录路径)
    
    def 加载波形文件(self, 文件路径):
        """从NPY文件加载波形数据"""
        return self.analysis.加载波形文件(文件路径)
    
    # ==================== 应力系数标定功能 ====================
    
    def 计算互相关声时差(self, 基准波形, 测量波形, 采样率):
        """计算两个波形之间的声时差"""
        return self.calibration.计算互相关声时差(基准波形, 测量波形, 采样率)
    
    def 保存HDF5格式(self, 文件路径, 实验数据):
        """保存实验数据到HDF5格式"""
        return self.calibration.保存HDF5格式(文件路径, 实验数据)
    
    def 保存CSV格式(self, 文件路径, 实验数据):
        """保存应力-声时差数据到CSV格式"""
        return self.calibration.保存CSV格式(文件路径, 实验数据)
    
    def 选择HDF5保存路径(self):
        """打开HDF5文件保存对话框"""
        return self.calibration.选择HDF5保存路径()
    
    def 选择CSV保存路径(self):
        """打开CSV文件保存对话框"""
        return self.calibration.选择CSV保存路径()
    
    # ==================== 单轴应力检测实验功能（新增）====================
    

    
    def 检查方向是否存在(self, 材料名称, 方向名称):
        """🆕 检查指定材料的指定方向是否已存在于数据库中（只检查有基准波形的完整数据）"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            cursor = dm.conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) FROM test_directions td
                JOIN experiments e ON td.实验ID = e.id
                WHERE e.材料名称 = ? AND td.方向名称 = ? AND td.基准波形路径 IS NOT NULL
            ''', (材料名称, 方向名称))
            count = cursor.fetchone()[0]
            dm.关闭()
            return {"success": True, "exists": count > 0}
        except Exception as e:
            return {"success": False, "message": f"检查失败: {str(e)}"}
    
    def 创建应力检测实验(self, 材料名称, 测试方向列表):
        """🆕 创建新的单轴应力检测实验"""
        return self.calibration.创建应力检测实验(材料名称, 测试方向列表)
    
    def 保存基准波形数据(self, 实验ID, 方向名称, 电压数据, 时间数据):
        """🆕 保存基准波形数据（从订阅获取的波形）"""
        return self.calibration.保存基准波形数据(实验ID, 方向名称, 电压数据, 时间数据)
    
    def 保存并分析应力波形数据(self, 实验ID, 方向名称, 应力值, 电压数据, 时间数据):
        """🆕 保存并分析应力波形数据（从订阅获取的波形）"""
        return self.calibration.保存并分析应力波形数据(实验ID, 方向名称, 应力值, 电压数据, 时间数据)
    
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
        """🆕 获取所有实验列表"""
        try:
            from modules.core.data_manager import ExperimentDataManager
            dm = ExperimentDataManager()
            实验列表 = dm.获取所有实验列表()
            dm.关闭()  # 确保关闭连接
            return {"success": True, "data": 实验列表}
        except Exception as e:
            return {"success": False, "message": f"获取实验列表失败: {str(e)}"}
    
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
    
    # ==================== 单轴应力检测功能（新增）====================
    
    def 选择标定数据文件(self):
        """🆕 选择标定数据文件（HDF5格式）"""
        return self.detection_uniaxial.选择标定数据文件()
    
    def 计算互相关时间差(self, 基准电压, 基准时间, 当前电压, 当前时间):
        """🆕 计算两个波形之间的互相关时间差"""
        return self.detection_uniaxial.计算互相关时间差(基准电压, 基准时间, 当前电压, 当前时间)
    
    def 导出应力检测记录(self, 文件路径, 导出数据):
        """🆕 导出单轴应力检测记录到CSV"""
        return self.detection_uniaxial.导出应力检测记录(文件路径, 导出数据)
    
    def 选择应力检测CSV保存路径(self):
        """🆕 选择单轴应力检测CSV保存路径"""
        return self.detection_uniaxial.选择CSV保存路径()
    

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
