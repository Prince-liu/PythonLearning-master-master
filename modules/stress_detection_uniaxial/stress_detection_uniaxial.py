"""
单轴应力检测模块
负责使用已标定的应力系数实时检测未知应力值
"""

import numpy as np
from datetime import datetime


class StressDetectionUniaxial:
    """单轴应力检测功能类"""
    
    def __init__(self, window=None):
        """
        初始化
        window: pywebview窗口实例（用于文件对话框）
        """
        self.window = window
    
    def 选择标定数据文件(self):
        """选择标定数据文件（HDF5格式）"""
        try:
            import tkinter as tk
            from tkinter import filedialog
            import h5py
            
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            
            文件路径 = filedialog.askopenfilename(
                title="选择标定数据文件",
                filetypes=[("HDF5文件", "*.h5 *.hdf5"), ("所有文件", "*.*")]
            )
            
            root.destroy()
            
            if not 文件路径:
                return {"success": False, "message": "用户取消"}
            
            # 读取标定数据
            with h5py.File(文件路径, 'r') as f:
                材料名称 = f['metadata'].attrs.get('material', '未知')
                测试方向 = f['metadata'].attrs.get('direction', '未知')
                
                if 'analysis' in f:
                    斜率 = f['analysis'].attrs.get('斜率', 0)
                    截距 = f['analysis'].attrs.get('截距', 0)
                    R方 = f['analysis'].attrs.get('R方', 0)
                else:
                    return {"success": False, "message": "文件中没有拟合结果"}
            
            return {
                "success": True,
                "data": {
                    "材料名称": 材料名称,
                    "测试方向": 测试方向,
                    "斜率": 斜率,
                    "截距": 截距,
                    "R方": R方
                }
            }
        except Exception as e:
            return {"success": False, "message": f"读取文件失败: {str(e)}"}
    
    def 计算互相关时间差(self, 基准电压, 基准时间, 当前电压, 当前时间):
        """
        计算两个波形之间的互相关时间差
        
        参数:
            基准电压: 基准波形的电压数据
            基准时间: 基准波形的时间数据
            当前电压: 当前波形的电压数据
            当前时间: 当前波形的时间数据
        
        返回:
            {"success": bool, "时间差": float (秒)}
        """
        try:
            from scipy.signal import correlate
            
            # 转换为numpy数组
            基准信号 = np.array(基准电压)
            当前信号 = np.array(当前电压)
            基准时间数组 = np.array(基准时间)
            
            # 计算采样率
            if len(基准时间数组) > 1:
                采样间隔 = 基准时间数组[1] - 基准时间数组[0]
                采样率 = 1.0 / 采样间隔 if 采样间隔 > 0 else 1e9
            else:
                采样率 = 1e9
            
            # 确保两个波形长度相同
            最小长度 = min(len(基准信号), len(当前信号))
            基准信号 = 基准信号[:最小长度]
            当前信号 = 当前信号[:最小长度]
            
            # 频域互相关（快速）
            相关 = correlate(当前信号, 基准信号, mode='same', method='fft')
            
            # 找到峰值位置
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
            中心索引 = len(基准信号) // 2
            声时差_秒 = (精确偏移 - 中心索引) / 采样率
            
            return {
                "success": True,
                "时间差": 声时差_秒,
                "相关峰值": float(相关[峰值索引])
            }
        except Exception as e:
            return {"success": False, "message": f"计算失败: {str(e)}"}
    
    def 导出应力检测记录(self, 文件路径, 导出数据):
        """
        导出单轴应力检测记录到CSV
        
        参数:
            文件路径: CSV文件保存路径
            导出数据: {
                "标定信息": {...},
                "记录数据": [...]
            }
        """
        try:
            import csv
            
            with open(文件路径, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                
                # 写入标定信息
                writer.writerow(['标定信息'])
                writer.writerow(['材料名称', 导出数据['标定信息']['材料名称']])
                writer.writerow(['测试方向', 导出数据['标定信息']['测试方向']])
                writer.writerow(['斜率 (ns/MPa)', 导出数据['标定信息']['斜率']])
                writer.writerow(['截距 (ns)', 导出数据['标定信息']['截距']])
                writer.writerow(['R²', 导出数据['标定信息']['R方']])
                writer.writerow([])
                
                # 写入检测记录
                writer.writerow(['检测记录'])
                writer.writerow(['时间', '声时差 (ns)', '应力值 (MPa)'])
                
                for 记录 in 导出数据['记录数据']:
                    # 处理时间格式
                    if isinstance(记录['时间'], str):
                        时间字符串 = 记录['时间']
                    elif hasattr(记录['时间'], 'strftime'):
                        时间字符串 = 记录['时间'].strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        时间字符串 = str(记录['时间'])
                    
                    writer.writerow([
                        时间字符串,
                        f"{记录['时间差']:.3f}",
                        f"{记录['应力值']:.2f}"
                    ])
            
            return {"success": True, "message": f"已导出 {len(导出数据['记录数据'])} 条记录"}
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}
    
    def 选择CSV保存路径(self):
        """打开CSV文件保存对话框"""
        try:
            import tkinter as tk
            from tkinter import filedialog
            
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            
            文件路径 = filedialog.asksaveasfilename(
                title="保存单轴应力检测记录",
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
            )
            
            root.destroy()
            
            if not 文件路径:
                return {"success": False, "message": "用户取消"}
            
            return {"success": True, "path": 文件路径}
        except Exception as e:
            return {"success": False, "message": f"选择路径失败: {str(e)}"}
