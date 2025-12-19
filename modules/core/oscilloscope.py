"""
示波器通信基础类
负责设备连接、基础SCPI命令和波形数据获取
"""

import pyvisa
import numpy as np


class OscilloscopeBase:
    """示波器通信基础类"""
    
    def __init__(self):
        self.rm = None
        self.示波器 = None
        self.已连接 = False
    
    def 搜索设备(self):
        """搜索可用的VISA设备"""
        try:
            if self.rm is None:
                self.rm = pyvisa.ResourceManager()
            
            设备列表 = list(self.rm.list_resources())
            if 设备列表:
                return {"success": True, "devices": 设备列表}
            else:
                return {"success": False, "devices": [], "message": "未找到设备"}
        except Exception as e:
            return {"success": False, "devices": [], "message": f"搜索失败: {str(e)}"}
    
    def 连接示波器(self, 设备地址=None):
        """连接到指定的示波器"""
        try:
            if self.rm is None:
                self.rm = pyvisa.ResourceManager()
            
            if 设备地址 is None:
                设备列表 = list(self.rm.list_resources())
                if not 设备列表:
                    return {"success": False, "message": "未找到任何VISA设备"}
                设备地址 = 设备列表[0]
            
            self.示波器 = self.rm.open_resource(设备地址)
            self.示波器.timeout = 5000
            
            设备信息 = self.示波器.query('*IDN?')
            self.已连接 = True
            
            return {"success": True, "message": "示波器连接成功"}
        except Exception as e:
            self.已连接 = False
            return {"success": False, "message": f"连接失败: {str(e)}"}
    
    def 断开连接(self):
        """断开示波器连接"""
        try:
            if self.示波器:
                self.示波器.close()
                self.示波器 = None
            self.已连接 = False
            return {"success": True, "message": "已断开连接"}
        except Exception as e:
            return {"success": False, "message": f"断开失败: {str(e)}"}
    
    def 获取波形数据_NORM模式(self, 通道=1):
        """
        获取NORM模式波形数据（用于实时显示，1000点）
        """
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            # 获取通道档位和偏移
            垂直档位 = float(self.示波器.query(f':CHAN{通道}:SCAL?').strip())
            垂直偏移 = float(self.示波器.query(f':CHAN{通道}:OFFS?').strip())
            时基档位 = float(self.示波器.query(':TIM:MAIN:SCAL?').strip())
            
            # 设置波形源和模式
            self.示波器.write(f':WAV:SOUR CHAN{通道}')
            self.示波器.write(':WAV:MODE NORM')
            self.示波器.write(':WAV:FORM BYTE')
            
            # 获取波形前导信息
            前导信息 = self.示波器.query(':WAV:PRE?').split(',')
            
            点数 = int(前导信息[2])
            x增量 = float(前导信息[4])
            x起点 = float(前导信息[5])
            y增量 = float(前导信息[7])
            y起点 = float(前导信息[8])
            y参考 = float(前导信息[9])
            
            # 读取波形数据
            self.示波器.write(':WAV:DATA?')
            原始数据 = self.示波器.read_raw()
            
            # 解析数据
            头部长度 = 2 + int(chr(原始数据[1]))
            波形数据 = np.frombuffer(原始数据[头部长度:-1], dtype=np.uint8)
            
            # 转换为电压值
            电压 = (波形数据 - y起点 - y参考) * y增量
            时间 = np.arange(len(电压)) * x增量 + x起点
            
            # 获取存储深度
            存储深度 = self.示波器.query(':ACQ:MEMD?').strip()
            
            数据 = {
                "time": 时间.tolist(),
                "voltage": 电压.tolist(),
                "vScale": 垂直档位,
                "vOffset": 垂直偏移,
                "hScale": 时基档位,
                "points": len(电压),
                "memoryDepth": 存储深度
            }
            
            return {"success": True, "data": 数据}
        except Exception as e:
            return {"success": False, "message": f"获取数据失败: {str(e)}"}
    
    def 获取波形数据_RAW模式_屏幕范围(self, 通道=1):
        """
        使用RAW模式读取屏幕显示范围的高密度波形数据（12bit精度）
        只保存屏幕显示范围对应的采集存储器数据
        """
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            # RAW模式必须在STOP状态下读取
            self.示波器.write(':STOP')
            
            import time
            time.sleep(0.2)
            
            # 获取参数
            垂直档位 = float(self.示波器.query(f':CHAN{通道}:SCAL?').strip())
            垂直偏移 = float(self.示波器.query(f':CHAN{通道}:OFFS?').strip())
            时基档位 = float(self.示波器.query(':TIM:MAIN:SCAL?').strip())
            水平偏移 = float(self.示波器.query(':TIM:MAIN:OFFS?').strip())
            
            # 设置波形源和模式
            self.示波器.write(f':WAV:SOUR CHAN{通道}')
            self.示波器.write(':WAV:MODE RAW')
            self.示波器.write(':WAV:FORM WORD')  # 使用WORD格式获取12bit精度
            
            # 获取波形前导信息
            前导信息 = self.示波器.query(':WAV:PRE?').split(',')
            总点数 = int(前导信息[2])
            x增量 = float(前导信息[4])
            x起点 = float(前导信息[5])
            y增量 = float(前导信息[7])
            y起点 = float(前导信息[8])
            y参考 = float(前导信息[9])
            
            # 计算屏幕显示范围
            屏幕时间范围 = 10 * 时基档位
            屏幕起点时间 = 水平偏移 - 屏幕时间范围 / 2
            屏幕终点时间 = 水平偏移 + 屏幕时间范围 / 2
            
            # 计算采集存储器的时间范围
            采集起点时间 = x起点
            采集终点时间 = x起点 + (总点数 - 1) * x增量
            
            # 计算屏幕范围在采集存储器中的索引
            实际起点时间 = max(屏幕起点时间, 采集起点时间)
            实际终点时间 = min(屏幕终点时间, 采集终点时间)
            
            起始索引 = int((实际起点时间 - 采集起点时间) / x增量) + 1
            结束索引 = int((实际终点时间 - 采集起点时间) / x增量) + 1
            
            起始索引 = max(1, min(起始索引, 总点数))
            结束索引 = max(起始索引, min(结束索引, 总点数))
            
            读取点数 = 结束索引 - 起始索引 + 1
            
            # 分块读取屏幕范围的数据
            块大小 = 250000
            所有波形数据 = []
            
            当前起点 = 起始索引
            while 当前起点 <= 结束索引:
                当前终点 = min(当前起点 + 块大小 - 1, 结束索引)
                
                self.示波器.write(f':WAV:STAR {当前起点}')
                self.示波器.write(f':WAV:STOP {当前终点}')
                
                self.示波器.write(':WAV:DATA?')
                原始数据 = self.示波器.read_raw()
                
                # 解析WORD格式数据（16bit小端序）
                头部长度 = 2 + int(chr(原始数据[1]))
                块数据 = np.frombuffer(原始数据[头部长度:-1], dtype='<u2')
                所有波形数据.append(块数据)
                
                当前起点 = 当前终点 + 1
            
            # 合并所有数据
            波形数据 = np.concatenate(所有波形数据)
            
            # 转换为电压值
            电压 = (波形数据 - y起点 - y参考) * y增量
            
            # 计算对应的时间轴
            时间 = 采集起点时间 + (np.arange(起始索引 - 1, 起始索引 - 1 + len(电压))) * x增量
            
            数据 = {
                "time": 时间.tolist(),
                "voltage": 电压.tolist(),
                "vScale": 垂直档位,
                "vOffset": 垂直偏移,
                "hScale": 时基档位,
                "points": len(电压)
            }
            
            # 恢复示波器运行
            self.示波器.write(':RUN')
            
            return {"success": True, "data": 数据}
            
        except Exception as e:
            try:
                self.示波器.write(':RUN')
            except:
                pass
            
            return {"success": False, "message": f"RAW模式读取失败: {str(e)}"}
    
    def 设置存储深度(self, 深度):
        """设置存储深度"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(f':ACQ:MDEP {深度}')
            return {"success": True, "message": f"存储深度已设置为 {深度}"}
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置时基(self, 时基值):
        """设置主时基档位"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(f':TIM:MAIN:SCAL {时基值}')
            return {"success": True, "message": f"时基已设置"}
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置水平位置(self, 偏移量):
        """设置示波器的水平位置偏移"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(f':TIM:MAIN:OFFS {偏移量}')
            return {"success": True, "message": f"水平位置已设置"}
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 获取水平位置(self):
        """查询当前的水平位置偏移"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            偏移量 = float(self.示波器.query(':TIM:MAIN:OFFS?').strip())
            return {"success": True, "offset": 偏移量}
        except Exception as e:
            return {"success": False, "message": f"查询失败: {str(e)}"}
    
    def 设置垂直位置(self, 通道, 偏移量):
        """设置指定通道的垂直位置偏移"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(f':CHAN{通道}:OFFS {偏移量}')
            return {"success": True, "message": f"垂直位置已设置"}
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 获取完整状态(self):
        """获取示波器完整状态信息"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            采样率 = float(self.示波器.query(':ACQ:SRAT?').strip())
            时基 = float(self.示波器.query(':TIM:MAIN:SCAL?').strip())
            存储深度 = self.示波器.query(':ACQ:MEMD?').strip()
            
            # 检测活动通道（有信号的通道）
            活动通道 = self.检测活动通道()
            
            return {
                "success": True,
                "sampleRate": 采样率,
                "timebase": 时基,
                "memoryDepth": 存储深度,
                "activeChannel": 活动通道
            }
        except Exception as e:
            return {"success": False, "message": f"查询失败: {str(e)}"}
    
    def 检测活动通道(self):
        """检测哪个通道有信号（通道已打开）"""
        try:
            if not self.已连接 or self.示波器 is None:
                return 1
            
            # 检查通道1-4哪个是打开的
            for 通道 in range(1, 5):
                try:
                    显示状态 = self.示波器.query(f':CHAN{通道}:DISP?').strip()
                    if 显示状态 == '1' or 显示状态.upper() == 'ON':
                        return 通道
                except:
                    continue
            
            # 如果都没打开，默认返回通道1
            return 1
        except:
            return 1
    
    def 自动设置(self):
        """执行自动设置"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(':AUT')
            import time
            time.sleep(1.5)
            return {"success": True, "message": "自动设置完成"}
        except Exception as e:
            return {"success": False, "message": f"自动设置失败: {str(e)}"}
    
    def 运行示波器(self):
        """启动示波器采集"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(':RUN')
            return {"success": True, "message": "示波器已启动"}
        except Exception as e:
            return {"success": False, "message": f"启动失败: {str(e)}"}
    
    def 停止示波器(self):
        """停止示波器采集"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(':STOP')
            return {"success": True, "message": "示波器已停止"}
        except Exception as e:
            return {"success": False, "message": f"停止失败: {str(e)}"}
    
    def 设置垂直灵敏度(self, 通道, 灵敏度):
        """设置指定通道的垂直灵敏度（V/div）"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            self.示波器.write(f':CHAN{通道}:SCAL {灵敏度}')
            return {"success": True, "message": f"垂直灵敏度已设置为 {灵敏度} V/div"}
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 获取垂直灵敏度(self, 通道):
        """获取指定通道的垂直灵敏度（V/div）"""
        try:
            if not self.已连接 or self.示波器 is None:
                return {"success": False, "message": "示波器未连接"}
            
            灵敏度 = float(self.示波器.query(f':CHAN{通道}:SCAL?').strip())
            return {"success": True, "value": 灵敏度}
        except Exception as e:
            return {"success": False, "message": f"查询失败: {str(e)}"}
