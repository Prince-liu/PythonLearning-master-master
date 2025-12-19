"""
实时采集模块
负责波形保存、文件对话框等功能
"""

import numpy as np
import os
from datetime import datetime


class RealtimeCapture:
    """实时采集功能类"""
    
    def __init__(self, oscilloscope, window=None):
        """
        初始化
        oscilloscope: OscilloscopeBase实例
        window: pywebview窗口实例（用于文件对话框）
        """
        self.osc = oscilloscope
        self.window = window
        self.当前波形 = None  # 存储最新波形数据
    
    def 选择保存路径(self, 格式='npy'):
        """打开文件保存对话框"""
        try:
            import webview
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            
            if 格式.lower() == 'csv':
                default_name = f'waveform_{timestamp}.csv'
                file_types = ('CSV文件 (*.csv)',)
                扩展名 = '.csv'
            else:
                default_name = f'waveform_{timestamp}.npy'
                file_types = ('NumPy波形文件 (*.npy)',)
                扩展名 = '.npy'
            
            结果 = self.获取保存目录()
            默认目录 = 结果['path'] if 结果['success'] else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename=default_name,
                    file_types=file_types
                )
                
                if 文件路径:
                    if isinstance(文件路径, tuple):
                        文件路径 = 文件路径[0]
                    if not 文件路径.endswith(扩展名):
                        文件路径 += 扩展名
                    
                    return {"success": True, "path": 文件路径, "format": 格式}
                else:
                    return {"success": False, "message": "用户取消了保存"}
            else:
                return {"success": False, "message": "窗口未初始化"}
        except Exception as e:
            return {"success": False, "message": f"打开对话框失败: {str(e)}"}
    
    def 保存波形到文件(self, 文件路径, 通道, 格式='npy'):
        """保存波形数据到文件（支持NPY和CSV格式）"""
        try:
            # 获取完整深度的波形数据
            结果 = self.osc.获取波形数据_RAW模式_屏幕范围(通道)
            
            if not 结果['success']:
                return 结果
            
            波形数据 = 结果['data']
            
            # 获取当前状态信息
            采样率 = float(self.osc.示波器.query(':ACQ:SRAT?').strip())
            存储深度 = self.osc.示波器.query(':ACQ:MEMD?').strip()
            
            if 格式.lower() == 'csv':
                # 保存为CSV格式（兼容示波器导出格式）
                时间数据 = 波形数据['time']
                电压数据 = 波形数据['voltage']
                
                # 计算时间参数
                t0 = 时间数据[0] if len(时间数据) > 0 else 0
                tInc = (时间数据[-1] - 时间数据[0]) / (len(时间数据) - 1) if len(时间数据) > 1 else 0
                
                with open(文件路径, 'w', newline='', encoding='utf-8') as f:
                    # 写入表头（兼容示波器格式）
                    f.write(f'Time(s),CH{通道}V,t0 ={t0:.6e}, tInc = {tInc:.6e},\n')
                    
                    # 写入数据
                    for t, v in zip(时间数据, 电压数据):
                        f.write(f'{t:.6e},{v:.6e},,\n')
                
                return {
                    "success": True,
                    "message": f"波形已保存到: {文件路径}\n采样点数: {波形数据['points']:,}\n格式: CSV"
                }
            else:
                # 保存为NPY格式（默认）
                保存数据 = {
                    'time': np.array(波形数据['time']),
                    'voltage': np.array(波形数据['voltage']),
                    'sample_rate': 采样率,
                    'timebase': 波形数据['hScale'],
                    'v_scale': 波形数据['vScale'],
                    'v_offset': 波形数据['vOffset'],
                    'memory_depth': 存储深度,
                    'channel': 通道,
                    'points': 波形数据['points'],
                    'timestamp': datetime.now().isoformat(),
                    'format_version': '1.0'
                }
                
                np.save(文件路径, 保存数据, allow_pickle=True)
                
                return {
                    "success": True,
                    "message": f"波形已保存到: {文件路径}\n采样点数: {波形数据['points']:,}\n格式: NPY"
                }
        except Exception as e:
            return {"success": False, "message": f"保存失败: {str(e)}"}
    
    def 获取保存目录(self):
        """获取默认保存目录"""
        try:
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            
            if not os.path.exists(波形目录):
                os.makedirs(波形目录)
            
            return {"success": True, "path": 波形目录}
        except Exception as e:
            return {"success": False, "message": f"获取目录失败: {str(e)}"}
    

