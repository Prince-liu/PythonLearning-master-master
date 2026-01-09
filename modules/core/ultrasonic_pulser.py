"""
超声波脉冲发生接收器控制模块
支持通过DLL控制超声波脉冲发生接收器（如PR20）
"""

import ctypes
import os


class UltrasonicPulserController:
    """超声波脉冲发生接收器控制器
    
    功能：
    - 搜索和连接设备（串口）
    - 读取和设置发射参数（电压、脉冲宽度、重复频率、触发源）
    - 读取和设置接收参数（单/双晶、阻尼、增益）
    - 参数约束检查
    """
    
    def __init__(self, dll_path=None):
        """初始化控制器
        
        Args:
            dll_path: DLL文件路径（可选，默认使用项目根目录下的YSXF_Comport.dll）
        """
        self.dll = None
        self.current_port = None  # 当前连接的COM口
        self.dll_path = dll_path or os.path.join(os.path.dirname(__file__), '..', '..', 'YSXF_Comport.dll')
        
        # 参数映射表
        self.voltage_map = {
            1: 60, 2: 110, 3: 150, 4: 200,
            5: 250, 6: 300, 7: 350, 8: 400
        }
        self.damp_map = {0: "34Ω", 1: "50Ω", 2: "90Ω", 3: "510Ω"}
        self.crystal_map = {1: "单晶(1T/1R)", 2: "双晶(1T/2R)"}
        self.trigger_map = {0: "内部触发", 1: "外部触发"}
        
        # 加载DLL
        self._load_dll()
    
    def _load_dll(self):
        """加载DLL文件"""
        try:
            if not os.path.exists(self.dll_path):
                return {
                    "success": False,
                    "message": f"DLL文件不存在: {self.dll_path}"
                }
            
            self.dll = ctypes.CDLL(self.dll_path)
            
            # 设置函数返回类型
            self.dll.OpenPort.restype = ctypes.c_bool
            
            return {"success": True, "message": "DLL加载成功"}
        except Exception as e:
            return {
                "success": False,
                "message": f"DLL加载失败: {str(e)}"
            }
    
    def 搜索设备(self):
        """搜索可用的串口设备
        
        Returns:
            {"success": bool, "ports": [int], "message": str}
        """
        try:
            if not self.dll:
                return {"success": False, "message": "DLL未加载", "ports": []}
            
            # 创建数组存储串口号
            port_array = (ctypes.c_int * 20)()
            self.dll.GetSerialPortNum(port_array)
            
            # 提取有效串口号（非0的值）
            ports = [p for p in port_array if p > 0]
            
            if ports:
                return {
                    "success": True,
                    "ports": ports,
                    "message": f"检测到 {len(ports)} 个串口"
                }
            else:
                return {
                    "success": True,
                    "ports": [],
                    "message": "未检测到串口设备"
                }
        except Exception as e:
            return {
                "success": False,
                "ports": [],
                "message": f"搜索设备失败: {str(e)}"
            }
    
    def 连接设备(self, com_port):
        """连接指定COM口的设备
        
        Args:
            com_port: COM口号（整数，如7表示COM7）
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll:
                return {"success": False, "message": "DLL未加载"}
            
            # 如果已有连接，先断开
            if self.current_port is not None:
                self.dll.ClosePort()
            
            # 🔧 使用线程+超时机制打开连接
            import threading
            
            打开结果 = {"success": False, "result": None}
            
            def 打开端口():
                try:
                    打开结果["result"] = self.dll.OpenPort(com_port)
                    打开结果["success"] = True
                except:
                    打开结果["success"] = False
            
            # 启动打开线程，最多等待1秒
            打开线程 = threading.Thread(target=打开端口)
            打开线程.daemon = True
            打开线程.start()
            打开线程.join(timeout=1.0)  # 1秒超时
            
            if not 打开结果["success"] or 打开结果["result"] is None:
                # 超时或打开失败
                try:
                    self.dll.ClosePort()
                except:
                    pass
                return {
                    "success": False,
                    "message": f"连接 COM{com_port} 失败"
                }
            
            result = 打开结果["result"]
            
            if not result:
                return {
                    "success": False,
                    "message": f"连接 COM{com_port} 失败"
                }
            
            # 🔧 快速验证设备：使用线程+超时机制
            import threading
            
            验证结果 = {"success": False, "params": None}
            
            def 验证设备():
                try:
                    params = (ctypes.c_int * 13)()
                    self.dll.GetTheParameter(params)
                    验证结果["params"] = params
                    验证结果["success"] = True
                except:
                    验证结果["success"] = False
            
            # 启动验证线程，最多等待0.5秒
            验证线程 = threading.Thread(target=验证设备)
            验证线程.daemon = True
            验证线程.start()
            验证线程.join(timeout=0.5)  # 0.5秒超时
            
            if not 验证结果["success"] or 验证结果["params"] is None:
                # 超时或验证失败
                self.dll.ClosePort()
                return {
                    "success": False,
                    "message": f"COM{com_port} 未检测到脉冲发生器"
                }
            
            params = 验证结果["params"]
            
            if params[0] == -1:
                # 设备未响应或不是脉冲发生器
                self.dll.ClosePort()
                return {
                    "success": False,
                    "message": f"COM{com_port} 未检测到脉冲发生器"
                }
            elif params[0] != 1:
                # 未知设备类型
                self.dll.ClosePort()
                return {
                    "success": False,
                    "message": f"COM{com_port} 未检测到脉冲发生器"
                }
            
            # 验证成功，保存连接
            self.current_port = com_port
            return {
                "success": True,
                "message": f"成功连接 COM{com_port}"
            }
        except Exception as e:
            # 确保出错时关闭连接
            try:
                if self.dll:
                    self.dll.ClosePort()
            except:
                pass
            return {
                "success": False,
                "message": f"连接失败: {str(e)}"
            }
    
    def 断开设备(self):
        """断开当前连接的设备
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll:
                return {"success": False, "message": "DLL未加载"}
            
            if self.current_port is None:
                return {"success": True, "message": "没有已连接的设备"}
            
            self.dll.ClosePort()
            port = self.current_port
            self.current_port = None
            
            return {
                "success": True,
                "message": f"已断开 COM{port}"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"断开失败: {str(e)}"
            }
    
    def 获取参数(self):
        """获取当前设备参数
        
        Returns:
            {"success": bool, "data": {...}, "message": str}
        """
        try:
            if not self.dll:
                return {"success": False, "message": "DLL未加载"}
            
            if self.current_port is None:
                return {"success": False, "message": "没有已连接的设备"}
            
            # 创建参数数组
            params = (ctypes.c_int * 13)()
            self.dll.GetTheParameter(params)
            
            # 检查状态标志
            if params[0] == -1:
                return {
                    "success": False,
                    "message": "设备未连接或未获取到参数"
                }
            elif params[0] == 1:
                # 解析参数
                voltage_index = params[2]
                voltage_value = self.voltage_map.get(voltage_index, 0)
                
                # 🔧 修复：重复频率解析
                # 根据实际测试，params[4]可能有两种含义：
                # 1. 档位索引 (1-8)
                # 2. 频率值的百位/十位部分
                # 需要根据params[4]的值判断
                
                pulse_width = params[3]  # 脉冲宽度
                
                # 判断重复频率的解析方式
                if params[4] <= 8:
                    # 可能是档位索引或者是频率值
                    # 先尝试作为频率值计算
                    prf_value = params[4] * 100 + params[5]
                    
                    # 如果计算结果不在有效频率列表中，则作为档位索引
                    valid_freqs = [4, 8, 16, 20, 100, 500, 1000, 2000]
                    if prf_value not in valid_freqs:
                        # 作为档位索引
                        prf_map = {1: 4, 2: 8, 3: 16, 4: 20, 5: 100, 6: 500, 7: 1000, 8: 2000}
                        prf_value = prf_map.get(params[4], 20)
                else:
                    # params[4] > 8，肯定是频率值的一部分
                    prf_value = params[4] * 100 + params[5]
                
                data = {
                    "voltage_index": voltage_index,
                    "voltage_value": voltage_value,
                    "pulse_width": pulse_width,
                    "prf": prf_value,
                    "gain": params[6],
                    "damp_index": params[7],
                    "damp_value": self.damp_map.get(params[7], "未知"),
                    "crystal_mode": params[9],
                    "crystal_text": self.crystal_map.get(params[9], "未知"),
                    "trigger_source": params[10],
                    "trigger_text": self.trigger_map.get(params[10], "未知")
                }
                
                return {
                    "success": True,
                    "data": data,
                    "message": "参数读取成功"
                }
            else:
                return {
                    "success": False,
                    "message": f"未知状态标志: {params[0]}"
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"读取参数失败: {str(e)}"
            }
    
    def 设置发射电压(self, voltage_index):
        """设置发射电压
        
        Args:
            voltage_index: 电压档位索引 (1-8)
                1=60V, 2=110V, 3=150V, 4=200V,
                5=250V, 6=300V, 7=350V, 8=400V
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if voltage_index < 1 or voltage_index > 8:
                return {"success": False, "message": "电压档位超出范围(1-8)"}
            
            # 🔧 硬件保护：检查电压与阻尼的组合是否安全
            # 先获取当前阻尼值
            params_result = self.获取参数()
            if params_result['success']:
                damp_index = params_result['data']['damp_index']
                
                # 规则1: 阻尼=34Ω时，350V和400V不可选
                if damp_index == 0 and voltage_index in [7, 8]:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼34Ω时不可选择350V/400V"
                    }
                
                # 规则2: 阻尼=50Ω/90Ω时，400V不可选
                if damp_index in [1, 2] and voltage_index == 8:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼50Ω/90Ω时不可选择400V"
                    }
            
            self.dll.SetTransmitVoltage(voltage_index)
            voltage_value = self.voltage_map.get(voltage_index, 0)
            
            return {
                "success": True,
                "message": f"发射电压已设置为 {voltage_value}V"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置脉冲宽度(self, width_multiplier):
        """设置脉冲宽度
        
        Args:
            width_multiplier: 脉冲宽度倍数 (1-40)
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if width_multiplier < 1 or width_multiplier > 40:
                return {"success": False, "message": "脉冲宽度超出范围(1-40)"}
            
            # 🔧 硬件保护：检查脉冲宽度与阻尼、电压的组合是否安全
            # 先获取当前阻尼和电压
            params_result = self.获取参数()
            if params_result['success']:
                damp_index = params_result['data']['damp_index']
                voltage_index = params_result['data']['voltage_index']
                
                # 规则3: 阻尼=510Ω且电压=400V时，脉冲宽度限制为1-10倍
                if damp_index == 3 and voltage_index == 8 and width_multiplier > 10:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼510Ω + 400V时，脉冲宽度限制为1-10倍"
                    }
                
                # 规则4: 阻尼=50Ω/90Ω且电压=350V时，脉冲宽度限制为1-10倍
                if damp_index in [1, 2] and voltage_index == 7 and width_multiplier > 10:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼50Ω/90Ω + 350V时，脉冲宽度限制为1-10倍"
                    }
            
            self.dll.SetPulseWidth(width_multiplier)
            
            return {
                "success": True,
                "message": f"脉冲宽度已设置为 {width_multiplier} 倍"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置重复频率(self, prf_index):
        """设置重复频率
        
        Args:
            prf_index: 频率档位索引 (1-8)
                1=4Hz, 2=8Hz, 3=16Hz, 4=20Hz,
                5=100Hz, 6=500Hz, 7=1kHz, 8=2kHz
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if prf_index < 1 or prf_index > 8:
                return {"success": False, "message": "频率档位超出范围(1-8)"}
            
            # 🔧 修复：DLL的SetPRF期望实际频率值，不是档位索引
            prf_value_map = {
                1: 4, 2: 8, 3: 16, 4: 20,
                5: 100, 6: 500, 7: 1000, 8: 2000
            }
            prf_value = prf_value_map[prf_index]
            
            prf_text_map = {
                1: "4Hz", 2: "8Hz", 3: "16Hz", 4: "20Hz",
                5: "100Hz", 6: "500Hz", 7: "1kHz", 8: "2kHz"
            }
            
            # 传递实际频率值
            self.dll.SetPRF(prf_value)
            
            return {
                "success": True,
                "message": f"重复频率已设置为 {prf_text_map[prf_index]}"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置触发源(self, trigger_source):
        """设置触发源
        
        Args:
            trigger_source: 触发源 (0=内部触发, 1=外部触发)
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if trigger_source not in [0, 1]:
                return {"success": False, "message": "触发源参数错误(0或1)"}
            
            self.dll.SetTriggerSource(trigger_source)
            trigger_text = self.trigger_map[trigger_source]
            
            return {
                "success": True,
                "message": f"触发源已设置为 {trigger_text}"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置单双晶模式(self, crystal_mode):
        """设置单/双晶模式
        
        Args:
            crystal_mode: 晶体模式 (1=单晶, 2=双晶)
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if crystal_mode not in [1, 2]:
                return {"success": False, "message": "晶体模式参数错误(1或2)"}
            
            self.dll.SetCrystalNum(crystal_mode)
            crystal_text = self.crystal_map[crystal_mode]
            
            return {
                "success": True,
                "message": f"晶体模式已设置为 {crystal_text}"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置阻尼(self, damp_index):
        """设置阻尼
        
        Args:
            damp_index: 阻尼档位索引 (0-3)
                0=34Ω, 1=50Ω, 2=90Ω, 3=510Ω
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if damp_index < 0 or damp_index > 3:
                return {"success": False, "message": "阻尼档位超出范围(0-3)"}
            
            # 🔧 硬件保护：检查阻尼与电压、脉冲宽度的组合是否安全
            # 先获取当前电压和脉冲宽度
            params_result = self.获取参数()
            warnings = []
            
            if params_result['success']:
                voltage_index = params_result['data']['voltage_index']
                pulse_width = params_result['data']['pulse_width']
                
                # 规则1: 阻尼=34Ω时，350V和400V不可选
                if damp_index == 0 and voltage_index in [7, 8]:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼34Ω时不可与350V/400V组合，请先降低电压"
                    }
                
                # 规则2: 阻尼=50Ω/90Ω时，400V不可选
                if damp_index in [1, 2] and voltage_index == 8:
                    return {
                        "success": False,
                        "message": "硬件保护：阻尼50Ω/90Ω时不可与400V组合，请先降低电压"
                    }
                
                # 规则3: 阻尼=510Ω且电压=400V时，脉冲宽度限制为1-10倍
                if damp_index == 3 and voltage_index == 8 and pulse_width > 10:
                    warnings.append("当前脉冲宽度超出限制，建议调整为1-10倍")
                
                # 规则4: 阻尼=50Ω/90Ω且电压=350V时，脉冲宽度限制为1-10倍
                if damp_index in [1, 2] and voltage_index == 7 and pulse_width > 10:
                    warnings.append("当前脉冲宽度超出限制，建议调整为1-10倍")
            
            self.dll.SetDamp(damp_index)
            damp_text = self.damp_map[damp_index]
            
            result = {
                "success": True,
                "message": f"阻尼已设置为 {damp_text}"
            }
            
            if warnings:
                result["warnings"] = warnings
            
            return result
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 设置增益(self, gain_value):
        """设置增益
        
        Args:
            gain_value: 增益值 (0-60 dB)
        
        Returns:
            {"success": bool, "message": str}
        """
        try:
            if not self.dll or self.current_port is None:
                return {"success": False, "message": "设备未连接"}
            
            if gain_value < 0 or gain_value > 60:
                return {"success": False, "message": "增益超出范围(0-60 dB)"}
            
            self.dll.SetGain(gain_value)
            
            return {
                "success": True,
                "message": f"增益已设置为 {gain_value} dB"
            }
        except Exception as e:
            return {"success": False, "message": f"设置失败: {str(e)}"}
    
    def 获取当前连接状态(self):
        """获取当前连接状态
        
        Returns:
            {"connected": bool, "port": int or None}
        """
        return {
            "connected": self.current_port is not None,
            "port": self.current_port
        }
