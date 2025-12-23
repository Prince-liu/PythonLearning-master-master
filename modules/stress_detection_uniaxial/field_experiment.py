"""
应力场测绘模块 - 实验管理
负责实验CRUD操作、标定数据加载和验证、配置快照管理、实验统计
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional

from .field_database import FieldDatabaseManager
from .field_hdf5 import FieldExperimentHDF5
from .shape_utils import ShapeUtils
from .point_generator import PointGenerator


class FieldExperiment:
    """应力场实验管理类"""
    
    # 标定系数有效范围 (MPa/ns)
    K_MIN = 0.1
    K_MAX = 10.0
    
    # R²警告阈值
    R_SQUARED_WARNING = 0.95
    
    def __init__(self, db_path: str = 'data/experiments.db'):
        """
        初始化实验管理器
        
        Args:
            db_path: 数据库路径
        """
        self.db = FieldDatabaseManager(db_path)
        self.current_exp_id = None
        self.current_hdf5 = None
    
    # ==================== 实验CRUD ====================
    
    def create_experiment(self, experiment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新的应力场实验
        
        Args:
            experiment_data: 实验数据
                - name: 实验名称
                - test_purpose: 实验目的
                - sample_material: 试件材料
                - sample_thickness: 试件厚度
                - operator: 操作员
                - notes: 备注
        
        Returns:
            dict: {"success": bool, "error_code": int, "message": str, "data": {...}}
        """
        # 创建数据库记录
        result = self.db.create_experiment(experiment_data)
        
        if not result['success']:
            return result
        
        exp_id = result['data']['exp_id']
        
        # 创建HDF5文件
        hdf5 = FieldExperimentHDF5(exp_id)
        hdf5_result = hdf5.create_file({
            'experiment_id': exp_id,
            'name': experiment_data.get('name', ''),
            'operator': experiment_data.get('operator', ''),
            'temperature': experiment_data.get('temperature', 0),
            'humidity': experiment_data.get('humidity', 0)
        })
        
        if not hdf5_result['success']:
            # 回滚数据库
            self.db.delete_experiment(exp_id)
            return {
                "success": False,
                "error_code": 1020,
                "message": f"创建HDF5文件失败: {hdf5_result['message']}"
            }
        
        # 设置当前实验
        self.current_exp_id = exp_id
        self.current_hdf5 = hdf5
        
        return result
    
    def load_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        加载实验
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 实验完整数据
        """
        # 从数据库加载
        result = self.db.load_experiment(exp_id)
        
        if not result['success']:
            return result
        
        # 🔧 调试：打印形状配置
        exp_data = result['data']['experiment']
        print(f"\n[调试] 加载实验 {exp_id}")
        print(f"[调试] shape_config 类型: {type(exp_data.get('shape_config'))}")
        print(f"[调试] shape_config 值: {exp_data.get('shape_config')}")
        print(f"[调试] shape_config 是否为空: {not exp_data.get('shape_config')}")
        if isinstance(exp_data.get('shape_config'), dict):
            print(f"[调试] shape_config.type: {exp_data.get('shape_config').get('type')}")
        
        # 加载HDF5配置快照
        hdf5 = FieldExperimentHDF5(exp_id)
        if hdf5.file_exists():
            config_result = hdf5.load_config_snapshot()
            if config_result['success']:
                hdf5_config = config_result['data']
                # 🔧 修复：将HDF5配置合并到experiment对象的config_snapshot中
                # 数据库中的config_snapshot可能为空，HDF5中保存了完整的配置
                db_config = result['data']['experiment'].get('config_snapshot', {})
                # 合并配置：HDF5配置优先（因为它保存了布点参数等详细信息）
                merged_config = {**db_config, **hdf5_config}
                result['data']['experiment']['config_snapshot'] = merged_config
                # 同时在data层级也保存一份（兼容旧代码）
                result['data']['config_snapshot'] = merged_config
        
        # 设置当前实验
        self.current_exp_id = exp_id
        self.current_hdf5 = hdf5
        
        return result
    
    def delete_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        删除实验
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 操作结果
        """
        # 删除HDF5文件
        hdf5 = FieldExperimentHDF5(exp_id)
        hdf5.delete_file()
        
        # 删除数据库记录
        result = self.db.delete_experiment(exp_id)
        
        # 清除当前实验
        if self.current_exp_id == exp_id:
            self.current_exp_id = None
            self.current_hdf5 = None
        
        return result
    
    def complete_experiment(self, exp_id: str = None) -> Dict[str, Any]:
        """
        完成实验
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
        
        Returns:
            dict: 操作结果
        """
        exp_id = exp_id or self.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有指定实验"}
        
        return self.db.complete_experiment(exp_id)
    
    def reset_experiment(self, exp_id: str = None) -> Dict[str, Any]:
        """
        重置实验（清空所有测点数据，状态恢复为planning）
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
        
        Returns:
            dict: 操作结果
        """
        exp_id = exp_id or self.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有指定实验"}
        
        # 重置数据库记录
        result = self.db.reset_experiment(exp_id)
        
        if result['success'] and self.current_hdf5:
            # 清空HDF5中的波形数据
            self.current_hdf5.clear_waveforms()
        
        return result
    
    def get_experiment_list(self) -> Dict[str, Any]:
        """获取所有应力场实验列表"""
        try:
            experiments = self.db.get_experiment_list()
            return {"success": True, "data": experiments}
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    # ==================== 标定数据加载 ====================
    
    def load_calibration_from_experiment(self, calib_exp_id: int, direction: str) -> Dict[str, Any]:
        """
        从本地标定实验加载标定系数
        
        Args:
            calib_exp_id: 标定实验ID
            direction: 测试方向 (如 "0°")
        
        Returns:
            dict: {"success": bool, "data": {...}, "warnings": [...]}
        """
        try:
            # 查询标定实验的拟合结果
            cursor = self.db.conn.cursor()
            
            # 获取方向ID
            cursor.execute('''
                SELECT id FROM test_directions 
                WHERE 实验ID = ? AND 方向名称 = ?
            ''', (calib_exp_id, direction))
            
            result = cursor.fetchone()
            if not result:
                return {
                    "success": False,
                    "error_code": 2001,
                    "message": f"未找到标定实验 {calib_exp_id} 的方向 {direction}"
                }
            
            direction_id = result[0]
            
            # 获取最新的拟合结果
            cursor.execute('''
                SELECT 斜率, 截距, R方 FROM fitting_results
                WHERE 方向ID = ?
                ORDER BY 计算时间 DESC
                LIMIT 1
            ''', (direction_id,))
            
            fit_result = cursor.fetchone()
            if not fit_result:
                return {
                    "success": False,
                    "error_code": 2002,
                    "message": "该方向没有拟合结果"
                }
            
            slope, intercept, r_squared = fit_result
            
            # 计算应力系数 k = 1/slope (MPa/ns)
            # slope 的单位是 s/MPa，需要转换
            if slope and slope != 0:
                k = 1.0 / (slope * 1e9)  # 转换为 MPa/ns（保留正负号）
            else:
                return {
                    "success": False,
                    "error_code": 2003,
                    "message": "斜率为零，无法计算应力系数"
                }
            
            warnings = []
            
            # 验证k值范围
            if not (self.K_MIN <= k <= self.K_MAX):
                warnings.append(f"应力系数 k={k:.3f} MPa/ns 超出正常范围 [{self.K_MIN}, {self.K_MAX}]")
            
            # 验证R²
            if r_squared and r_squared < self.R_SQUARED_WARNING:
                warnings.append(f"拟合优度 R²={r_squared:.4f} 较低，建议 ≥ {self.R_SQUARED_WARNING}")
            
            calibration_data = {
                'k': k,
                'slope': slope,
                'intercept': intercept,
                'r_squared': r_squared,
                'source': 'local',
                'exp_id': calib_exp_id,
                'direction': direction
            }
            
            # 保存到当前实验的配置快照
            if self.current_exp_id and self.current_hdf5:
                self.current_hdf5.save_config_snapshot({'calibration': calibration_data})
                # 同时保存 k 到数据库，确保加载时能获取到
                self.db.update_experiment(self.current_exp_id, {
                    'calibration_exp_id': str(calib_exp_id),
                    'calibration_direction': direction,
                    'calibration_k': k
                })
            
            return {
                "success": True,
                "error_code": 0,
                "data": calibration_data,
                "warnings": warnings
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 2099,
                "message": f"加载标定数据失败: {str(e)}"
            }
    
    def load_calibration_from_file(self, file_path: str) -> Dict[str, Any]:
        """
        从文件导入标定数据
        
        Args:
            file_path: 文件路径 (支持JSON, CSV)
        
        Returns:
            dict: {"success": bool, "data": {...}, "warnings": [...]}
        """
        try:
            if not os.path.exists(file_path):
                return {
                    "success": False,
                    "error_code": 2010,
                    "message": f"文件不存在: {file_path}"
                }
            
            ext = os.path.splitext(file_path)[1].lower()
            
            if ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                k = data.get('k', data.get('stress_coefficient'))
                r_squared = data.get('r_squared', data.get('R2'))
            elif ext == '.csv':
                import csv
                with open(file_path, 'r', encoding='utf-8-sig') as f:
                    reader = csv.DictReader(f)
                    row = next(reader, None)
                    if row:
                        k = float(row.get('k', row.get('stress_coefficient', 0)))
                        r_squared = float(row.get('r_squared', row.get('R2', 0)))
                    else:
                        return {"success": False, "error_code": 2011, "message": "文件为空"}
            else:
                return {
                    "success": False,
                    "error_code": 2012,
                    "message": f"不支持的文件格式: {ext}"
                }
            
            if k is None or k == 0:
                return {
                    "success": False,
                    "error_code": 2013,
                    "message": "文件中没有有效的应力系数"
                }
            
            warnings = []
            
            # 验证k值范围
            if not (self.K_MIN <= k <= self.K_MAX):
                warnings.append(f"应力系数 k={k:.3f} MPa/ns 超出正常范围")
            
            # 验证R²
            if r_squared and r_squared < self.R_SQUARED_WARNING:
                warnings.append(f"拟合优度 R²={r_squared:.4f} 较低")
            
            calibration_data = {
                'k': k,
                'r_squared': r_squared,
                'source': 'file',
                'file_path': file_path
            }
            
            # 保存到当前实验
            if self.current_exp_id and self.current_hdf5:
                self.current_hdf5.save_config_snapshot({'calibration': calibration_data})
                # 同时保存 k 到数据库
                self.db.update_experiment(self.current_exp_id, {
                    'calibration_k': k
                })
            
            return {
                "success": True,
                "error_code": 0,
                "data": calibration_data,
                "warnings": warnings
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 2099,
                "message": f"从文件加载标定数据失败: {str(e)}"
            }
    
    def validate_calibration_data(self, calibration_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证标定数据有效性
        
        Args:
            calibration_data: 标定数据 {k, r_squared, ...}
        
        Returns:
            dict: {"success": bool, "is_valid": bool, "warnings": [...]}
        """
        warnings = []
        is_valid = True
        
        k = calibration_data.get('k')
        r_squared = calibration_data.get('r_squared')
        
        # 验证k值
        if k is None:
            is_valid = False
            warnings.append("缺少应力系数 k")
        elif not (self.K_MIN <= k <= self.K_MAX):
            warnings.append(f"应力系数 k={k:.3f} 超出正常范围 [{self.K_MIN}, {self.K_MAX}] MPa/ns")
        
        # 验证R²
        if r_squared is not None and r_squared < self.R_SQUARED_WARNING:
            warnings.append(f"拟合优度 R²={r_squared:.4f} 较低，建议 ≥ {self.R_SQUARED_WARNING}")
        
        return {
            "success": True,
            "is_valid": is_valid,
            "warnings": warnings
        }
    
    # ==================== 配置管理 ====================
    
    def save_shape_config(self, shape_config: Dict[str, Any]) -> Dict[str, Any]:
        """保存形状配置"""
        if not self.current_exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        # 验证形状
        validation = ShapeUtils.validate_shape(shape_config)
        if not validation['is_valid']:
            return {
                "success": False,
                "error_code": 3001,
                "message": validation.get('error', '形状验证失败'),
                "warnings": validation.get('warnings', [])
            }
        
        # 保存到数据库
        self.db.update_experiment(self.current_exp_id, {'shape_config': shape_config})
        
        # 保存到HDF5
        if self.current_hdf5:
            config = self.current_hdf5.load_config_snapshot().get('data', {})
            config['shape'] = shape_config
            self.current_hdf5.save_config_snapshot(config)
        
        return {
            "success": True,
            "error_code": 0,
            "message": "形状配置已保存",
            "area": validation['area'],
            "warnings": validation.get('warnings', [])
        }
    
    def save_layout_config(self, layout_type: str, params: Dict[str, Any], 
                          points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """保存布点配置和测点"""
        if not self.current_exp_id:
            return {"success": False, "error_code": 1021, "message": "没有当前实验"}
        
        # 保存测点到数据库
        result = self.db.save_point_layout(self.current_exp_id, points)
        
        if not result['success']:
            return result
        
        # 保存布点配置到HDF5
        if self.current_hdf5:
            config = self.current_hdf5.load_config_snapshot().get('data', {})
            config['layout'] = {
                'type': layout_type,
                'params': params
            }
            self.current_hdf5.save_config_snapshot(config)
        
        return result
    
    # ==================== 实验统计 ====================
    
    def get_experiment_statistics(self, exp_id: str = None) -> Dict[str, Any]:
        """
        获取实验统计信息
        
        Args:
            exp_id: 实验ID (可选，默认当前实验)
        
        Returns:
            dict: 统计信息
        """
        exp_id = exp_id or self.current_exp_id
        if not exp_id:
            return {"success": False, "error_code": 1021, "message": "没有指定实验"}
        
        try:
            # 获取测点数据
            measured_points = self.db.get_measured_points(exp_id)
            
            if not measured_points:
                return {
                    "success": True,
                    "data": {
                        "total_points": 0,
                        "measured_points": 0,
                        "pending_points": 0,
                        "skipped_points": 0,
                        "suspicious_points": 0,
                        "stress_stats": None
                    }
                }
            
            # 计算应力统计
            stress_values = [p['stress_value'] for p in measured_points if p.get('stress_value') is not None]
            
            stress_stats = None
            if stress_values:
                import numpy as np
                stress_stats = {
                    'min': float(np.min(stress_values)),
                    'max': float(np.max(stress_values)),
                    'mean': float(np.mean(stress_values)),
                    'std': float(np.std(stress_values)),
                    'range': float(np.max(stress_values) - np.min(stress_values))
                }
            
            # 统计各状态点数
            cursor = self.db.conn.cursor()
            cursor.execute('''
                SELECT status, COUNT(*) FROM field_points
                WHERE experiment_id = ?
                GROUP BY status
            ''', (exp_id,))
            
            status_counts = dict(cursor.fetchall())
            
            cursor.execute('''
                SELECT COUNT(*) FROM field_points
                WHERE experiment_id = ? AND is_suspicious = 1
            ''', (exp_id,))
            suspicious_count = cursor.fetchone()[0]
            
            return {
                "success": True,
                "data": {
                    "total_points": sum(status_counts.values()),
                    "measured_points": status_counts.get('measured', 0),
                    "pending_points": status_counts.get('pending', 0),
                    "skipped_points": status_counts.get('skipped', 0),
                    "suspicious_points": suspicious_count,
                    "stress_stats": stress_stats
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error_code": 1099,
                "message": f"获取统计信息失败: {str(e)}"
            }
    
    def close(self):
        """关闭资源"""
        if self.db:
            self.db.close()
