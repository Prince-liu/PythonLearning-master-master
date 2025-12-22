"""
应力场测绘模块 - HDF5文件管理
负责应力场实验的HDF5文件创建、读写和管理
"""

import os
import h5py
import numpy as np
import json
from datetime import datetime
from typing import Optional, Dict, List, Any, Union


class FieldExperimentHDF5:
    """应力场实验HDF5文件管理类"""
    
    # HDF5文件存储根目录
    BASE_DIR = 'data/uniaxial_field'
    
    def __init__(self, exp_id: str):
        """
        初始化HDF5文件管理器
        
        Args:
            exp_id: 实验ID (如 FIELD001)
        """
        self.exp_id = exp_id
        self.file_path = os.path.join(self.BASE_DIR, f'{exp_id}.h5')
        
        # 确保目录存在
        os.makedirs(self.BASE_DIR, exist_ok=True)
    
    def create_file(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新的HDF5文件
        
        Args:
            metadata: 实验元数据字典，包含:
                - experiment_id: 实验ID
                - name: 实验名称
                - operator: 操作员 (可选)
                - temperature: 环境温度 (可选)
                - humidity: 环境湿度 (可选)
        
        Returns:
            dict: {"success": bool, "message": str, "file_path": str}
        """
        try:
            with h5py.File(self.file_path, 'w') as f:
                # 创建metadata组
                meta_grp = f.create_group('metadata')
                meta_grp.attrs['experiment_id'] = self.exp_id
                meta_grp.attrs['name'] = metadata.get('name', '')
                meta_grp.attrs['created_at'] = datetime.now().isoformat()
                meta_grp.attrs['operator'] = metadata.get('operator', '')
                meta_grp.attrs['temperature'] = metadata.get('temperature', 0.0)
                meta_grp.attrs['humidity'] = metadata.get('humidity', 0.0)
                
                # 创建config_snapshot组（空）
                f.create_group('config_snapshot')
                
                # 创建baseline组（空）
                f.create_group('baseline')
                
                # 创建points组（空）
                f.create_group('points')
                
                # 创建contour组（空）
                f.create_group('contour')
            
            return {
                "success": True,
                "message": "HDF5文件创建成功",
                "file_path": self.file_path
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"创建HDF5文件失败: {str(e)}",
                "file_path": None
            }
    
    def file_exists(self) -> bool:
        """检查HDF5文件是否存在"""
        return os.path.exists(self.file_path)
    
    def delete_file(self) -> Dict[str, Any]:
        """
        删除HDF5文件
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            if os.path.exists(self.file_path):
                os.remove(self.file_path)
            return {"success": True, "message": "HDF5文件已删除"}
        except Exception as e:
            return {"success": False, "message": f"删除HDF5文件失败: {str(e)}"}
    
    # ==================== 配置快照管理 ====================
    
    def save_config_snapshot(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        保存配置快照
        
        Args:
            config: 配置字典，包含:
                - calibration: 标定数据 {k, r_squared, slope, intercept, source, exp_id, direction}
                - shape: 形状配置 {type, width, height, ...}
                - layout: 布点配置 {type, rows, cols, margin, ...}
                - denoise: 降噪配置 {method, wavelet, level, ...}
                - scope: 示波器配置 (可选)
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            with h5py.File(self.file_path, 'a') as f:
                # 删除旧的config_snapshot组
                if 'config_snapshot' in f:
                    del f['config_snapshot']
                
                config_grp = f.create_group('config_snapshot')
                
                # 保存标定数据
                if 'calibration' in config:
                    calib = config['calibration']
                    calib_grp = config_grp.create_group('calibration')
                    calib_grp.attrs['k'] = calib.get('k', 0.0)
                    calib_grp.attrs['r_squared'] = calib.get('r_squared', 0.0)
                    calib_grp.attrs['slope'] = calib.get('slope', 0.0)
                    calib_grp.attrs['intercept'] = calib.get('intercept', 0.0)
                    calib_grp.attrs['source'] = calib.get('source', '')
                    calib_grp.attrs['exp_id'] = str(calib.get('exp_id', ''))
                    calib_grp.attrs['direction'] = calib.get('direction', '')
                
                # 保存形状配置
                if 'shape' in config:
                    shape_grp = config_grp.create_group('shape')
                    # 将形状配置序列化为JSON字符串存储
                    shape_grp.attrs['config_json'] = json.dumps(config['shape'], ensure_ascii=False)
                
                # 保存布点配置
                if 'layout' in config:
                    layout_grp = config_grp.create_group('layout')
                    layout_grp.attrs['config_json'] = json.dumps(config['layout'], ensure_ascii=False)
                
                # 保存降噪配置
                if 'denoise' in config:
                    denoise = config['denoise']
                    denoise_grp = config_grp.create_group('denoise')
                    denoise_grp.attrs['method'] = denoise.get('method', 'wavelet')
                    denoise_grp.attrs['wavelet'] = denoise.get('wavelet', 'sym6')
                    denoise_grp.attrs['level'] = denoise.get('level', 5)
                    denoise_grp.attrs['threshold_mode'] = denoise.get('threshold_mode', 'soft')
                    denoise_grp.attrs['threshold_rule'] = denoise.get('threshold_rule', 'heursure')
                
                # 保存示波器配置
                if 'scope' in config:
                    scope_grp = config_grp.create_group('scope')
                    scope_grp.attrs['config_json'] = json.dumps(config['scope'], ensure_ascii=False)
            
            return {"success": True, "message": "配置快照已保存"}
        except Exception as e:
            return {"success": False, "message": f"保存配置快照失败: {str(e)}"}
    
    def load_config_snapshot(self) -> Dict[str, Any]:
        """
        加载配置快照
        
        Returns:
            dict: {"success": bool, "data": {...}, "message": str}
        """
        try:
            if not self.file_exists():
                return {"success": False, "message": "HDF5文件不存在", "data": None}
            
            config = {}
            
            with h5py.File(self.file_path, 'r') as f:
                if 'config_snapshot' not in f:
                    return {"success": True, "data": {}, "message": "配置快照为空"}
                
                config_grp = f['config_snapshot']
                
                # 加载标定数据
                if 'calibration' in config_grp:
                    calib_grp = config_grp['calibration']
                    config['calibration'] = {
                        'k': float(calib_grp.attrs.get('k', 0)),
                        'r_squared': float(calib_grp.attrs.get('r_squared', 0)),
                        'slope': float(calib_grp.attrs.get('slope', 0)),
                        'intercept': float(calib_grp.attrs.get('intercept', 0)),
                        'source': str(calib_grp.attrs.get('source', '')),
                        'exp_id': str(calib_grp.attrs.get('exp_id', '')),
                        'direction': str(calib_grp.attrs.get('direction', ''))
                    }
                
                # 加载形状配置
                if 'shape' in config_grp:
                    shape_json = config_grp['shape'].attrs.get('config_json', '{}')
                    config['shape'] = json.loads(shape_json)
                
                # 加载布点配置
                if 'layout' in config_grp:
                    layout_json = config_grp['layout'].attrs.get('config_json', '{}')
                    config['layout'] = json.loads(layout_json)
                
                # 加载降噪配置
                if 'denoise' in config_grp:
                    denoise_grp = config_grp['denoise']
                    config['denoise'] = {
                        'method': str(denoise_grp.attrs.get('method', 'wavelet')),
                        'wavelet': str(denoise_grp.attrs.get('wavelet', 'sym6')),
                        'level': int(denoise_grp.attrs.get('level', 5)),
                        'threshold_mode': str(denoise_grp.attrs.get('threshold_mode', 'soft')),
                        'threshold_rule': str(denoise_grp.attrs.get('threshold_rule', 'heursure'))
                    }
                
                # 加载示波器配置
                if 'scope' in config_grp:
                    scope_json = config_grp['scope'].attrs.get('config_json', '{}')
                    config['scope'] = json.loads(scope_json)
            
            return {"success": True, "data": config, "message": "配置快照加载成功"}
        except Exception as e:
            return {"success": False, "message": f"加载配置快照失败: {str(e)}", "data": None}
    
    # ==================== 基准波形管理 ====================
    
    def save_baseline(self, point_id: int, waveform: Dict[str, Any]) -> Dict[str, Any]:
        """
        保存基准波形
        
        Args:
            point_id: 基准测点ID
            waveform: 波形数据 {time: [], voltage: [], sample_rate: float}
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            with h5py.File(self.file_path, 'a') as f:
                # 删除旧的baseline数据
                if 'baseline' in f:
                    del f['baseline']
                
                baseline_grp = f.create_group('baseline')
                baseline_grp.attrs['point_id'] = point_id
                baseline_grp.attrs['captured_at'] = datetime.now().isoformat()
                
                # 创建waveform子组
                wf_grp = baseline_grp.create_group('waveform')
                
                # 保存波形数据（使用压缩）
                time_data = np.array(waveform.get('time', []), dtype=np.float64)
                voltage_data = np.array(waveform.get('voltage', []), dtype=np.float64)
                
                wf_grp.create_dataset('time', data=time_data, compression='gzip', compression_opts=6)
                wf_grp.create_dataset('voltage', data=voltage_data, compression='gzip', compression_opts=6)
                wf_grp.attrs['sample_rate'] = waveform.get('sample_rate', 1e9)
            
            return {"success": True, "message": "基准波形已保存"}
        except Exception as e:
            return {"success": False, "message": f"保存基准波形失败: {str(e)}"}
    
    def load_baseline(self) -> Dict[str, Any]:
        """
        加载基准波形
        
        Returns:
            dict: {"success": bool, "data": {...}, "message": str}
        """
        try:
            if not self.file_exists():
                return {"success": False, "message": "HDF5文件不存在", "data": None}
            
            with h5py.File(self.file_path, 'r') as f:
                if 'baseline' not in f or 'waveform' not in f['baseline']:
                    return {"success": False, "message": "基准波形不存在", "data": None}
                
                baseline_grp = f['baseline']
                wf_grp = baseline_grp['waveform']
                
                data = {
                    'point_id': int(baseline_grp.attrs.get('point_id', 0)),
                    'captured_at': str(baseline_grp.attrs.get('captured_at', '')),
                    'waveform': {
                        'time': wf_grp['time'][:].tolist(),
                        'voltage': wf_grp['voltage'][:].tolist(),
                        'sample_rate': float(wf_grp.attrs.get('sample_rate', 1e9))
                    }
                }
            
            return {"success": True, "data": data, "message": "基准波形加载成功"}
        except Exception as e:
            return {"success": False, "message": f"加载基准波形失败: {str(e)}", "data": None}
    
    # ==================== 测点波形管理 ====================
    
    def save_point_waveform(self, point_id: int, waveform: Dict[str, Any], 
                           analysis: Dict[str, Any], metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        保存测点波形数据
        
        Args:
            point_id: 测点ID
            waveform: 波形数据 {time: [], voltage: [], sample_rate: float}
            analysis: 分析结果 {time_diff: float, stress: float, snr: float, quality_score: float}
            metadata: 元数据 {x_coord, y_coord, measured_at, ...} (可选)
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            point_key = f'point_{point_id:03d}'
            
            # 验证波形数据
            if not waveform or not waveform.get('voltage') or not waveform.get('time'):
                return {"success": False, "message": f"测点 {point_id} 波形数据无效"}
            
            voltage_data = waveform.get('voltage', [])
            time_data = waveform.get('time', [])
            
            if len(voltage_data) == 0 or len(time_data) == 0:
                return {"success": False, "message": f"测点 {point_id} 波形数据为空"}
            
            with h5py.File(self.file_path, 'a') as f:
                # 确保 points 组存在
                if 'points' not in f:
                    f.create_group('points')
                
                points_grp = f['points']
                
                # 删除旧的测点数据
                if point_key in points_grp:
                    del points_grp[point_key]
                
                point_grp = points_grp.create_group(point_key)
                
                # 保存元数据
                meta_grp = point_grp.create_group('metadata')
                meta_grp.attrs['point_id'] = point_id
                meta_grp.attrs['measured_at'] = datetime.now().isoformat()
                
                if metadata:
                    meta_grp.attrs['x_coord'] = metadata.get('x_coord', 0.0)
                    meta_grp.attrs['y_coord'] = metadata.get('y_coord', 0.0)
                    if 'r_coord' in metadata and metadata['r_coord'] is not None:
                        meta_grp.attrs['r_coord'] = metadata['r_coord']
                    if 'theta_coord' in metadata and metadata['theta_coord'] is not None:
                        meta_grp.attrs['theta_coord'] = metadata['theta_coord']
                
                # 保存波形数据
                wf_grp = point_grp.create_group('waveform')
                time_arr = np.array(time_data, dtype=np.float64)
                voltage_arr = np.array(voltage_data, dtype=np.float64)
                
                wf_grp.create_dataset('time', data=time_arr, compression='gzip', compression_opts=6)
                wf_grp.create_dataset('voltage', data=voltage_arr, compression='gzip', compression_opts=6)
                wf_grp.attrs['sample_rate'] = waveform.get('sample_rate', 1e9)
                
                # 保存分析结果
                analysis_grp = point_grp.create_group('analysis')
                analysis_grp.attrs['time_diff'] = analysis.get('time_diff', 0.0)
                analysis_grp.attrs['stress'] = analysis.get('stress', 0.0)
                analysis_grp.attrs['snr'] = analysis.get('snr', 0.0)
                analysis_grp.attrs['quality_score'] = analysis.get('quality_score', 0.0)
            
            return {"success": True, "message": f"测点 {point_id} 波形已保存"}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"保存测点波形失败: {str(e)}"}
    
    def load_point_waveform(self, point_id: int) -> Dict[str, Any]:
        """
        加载测点波形数据
        
        Args:
            point_id: 测点ID
        
        Returns:
            dict: {"success": bool, "data": {...}, "message": str}
        """
        try:
            if not self.file_exists():
                return {"success": False, "message": "HDF5文件不存在", "data": None}
            
            point_key = f'point_{point_id:03d}'
            
            with h5py.File(self.file_path, 'r') as f:
                if 'points' not in f or point_key not in f['points']:
                    return {"success": False, "message": f"测点 {point_id} 不存在", "data": None}
                
                point_grp = f['points'][point_key]
                
                # 检查波形数据是否存在
                if 'waveform' not in point_grp:
                    return {"success": False, "message": f"测点 {point_id} 的波形数据不存在（数据结构不完整）", "data": None}
                
                # 加载元数据
                metadata = {'point_id': point_id, 'x_coord': 0, 'y_coord': 0, 'measured_at': ''}
                if 'metadata' in point_grp:
                    meta_grp = point_grp['metadata']
                    metadata = {
                        'point_id': int(meta_grp.attrs.get('point_id', point_id)),
                        'x_coord': float(meta_grp.attrs.get('x_coord', 0)),
                        'y_coord': float(meta_grp.attrs.get('y_coord', 0)),
                        'measured_at': str(meta_grp.attrs.get('measured_at', ''))
                    }
                    if 'r_coord' in meta_grp.attrs:
                        metadata['r_coord'] = float(meta_grp.attrs['r_coord'])
                    if 'theta_coord' in meta_grp.attrs:
                        metadata['theta_coord'] = float(meta_grp.attrs['theta_coord'])
                
                # 加载波形数据
                wf_grp = point_grp['waveform']
                
                # 检查必要的数据集是否存在
                if 'time' not in wf_grp or 'voltage' not in wf_grp:
                    return {"success": False, "message": f"测点 {point_id} 的波形数据不完整", "data": None}
                
                waveform = {
                    'time': wf_grp['time'][:].tolist(),
                    'voltage': wf_grp['voltage'][:].tolist(),
                    'sample_rate': float(wf_grp.attrs.get('sample_rate', 1e9))
                }
                
                # 加载分析结果
                analysis = {'time_diff': 0, 'stress': 0, 'snr': 0, 'quality_score': 0}
                if 'analysis' in point_grp:
                    analysis_grp = point_grp['analysis']
                    analysis = {
                        'time_diff': float(analysis_grp.attrs.get('time_diff', 0)),
                        'stress': float(analysis_grp.attrs.get('stress', 0)),
                        'snr': float(analysis_grp.attrs.get('snr', 0)),
                        'quality_score': float(analysis_grp.attrs.get('quality_score', 0))
                    }
                
                data = {
                    'metadata': metadata,
                    'waveform': waveform,
                    'analysis': analysis
                }
            
            return {"success": True, "data": data, "message": "测点波形加载成功"}
        except Exception as e:
            return {"success": False, "message": f"加载测点波形失败: {str(e)}", "data": None}
    
    def get_all_point_ids(self) -> List[int]:
        """获取所有已保存的测点ID列表"""
        try:
            if not self.file_exists():
                return []
            
            point_ids = []
            with h5py.File(self.file_path, 'r') as f:
                if 'points' in f:
                    for key in f['points'].keys():
                        if key.startswith('point_'):
                            point_id = int(key.replace('point_', ''))
                            point_ids.append(point_id)
            
            return sorted(point_ids)
        except Exception:
            return []
    
    # ==================== 云图数据管理 ====================
    
    def save_contour_data(self, grid_data: Dict[str, Any], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        保存云图数据
        
        Args:
            grid_data: 网格数据 {xi: 2D array, yi: 2D array, zi: 2D array}
            metadata: 元数据 {interpolation_method, resolution, n_points, ...}
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            with h5py.File(self.file_path, 'a') as f:
                # 删除旧的contour数据
                if 'contour' in f:
                    del f['contour']
                
                contour_grp = f.create_group('contour')
                
                # 保存网格数据
                grid_grp = contour_grp.create_group('grid')
                
                xi = np.array(grid_data.get('xi', []), dtype=np.float64)
                yi = np.array(grid_data.get('yi', []), dtype=np.float64)
                zi = np.array(grid_data.get('zi', []), dtype=np.float64)
                
                grid_grp.create_dataset('xi', data=xi, compression='gzip', compression_opts=6)
                grid_grp.create_dataset('yi', data=yi, compression='gzip', compression_opts=6)
                grid_grp.create_dataset('zi', data=zi, compression='gzip', compression_opts=6)
                
                # 保存元数据
                meta_grp = contour_grp.create_group('metadata')
                meta_grp.attrs['interpolation_method'] = metadata.get('interpolation_method', 'cubic')
                meta_grp.attrs['resolution'] = metadata.get('resolution', 200)
                meta_grp.attrs['n_points'] = metadata.get('n_points', 0)
                meta_grp.attrs['generated_at'] = datetime.now().isoformat()
                meta_grp.attrs['vmin'] = metadata.get('vmin', 0.0)
                meta_grp.attrs['vmax'] = metadata.get('vmax', 0.0)
            
            return {"success": True, "message": "云图数据已保存"}
        except Exception as e:
            return {"success": False, "message": f"保存云图数据失败: {str(e)}"}
    
    def load_contour_data(self) -> Dict[str, Any]:
        """
        加载云图数据
        
        Returns:
            dict: {"success": bool, "data": {...}, "message": str}
        """
        try:
            if not self.file_exists():
                return {"success": False, "message": "HDF5文件不存在", "data": None}
            
            with h5py.File(self.file_path, 'r') as f:
                if 'contour' not in f or 'grid' not in f['contour']:
                    return {"success": False, "message": "云图数据不存在", "data": None}
                
                contour_grp = f['contour']
                grid_grp = contour_grp['grid']
                meta_grp = contour_grp['metadata']
                
                data = {
                    'grid': {
                        'xi': grid_grp['xi'][:].tolist(),
                        'yi': grid_grp['yi'][:].tolist(),
                        'zi': grid_grp['zi'][:].tolist()
                    },
                    'metadata': {
                        'interpolation_method': str(meta_grp.attrs.get('interpolation_method', 'cubic')),
                        'resolution': int(meta_grp.attrs.get('resolution', 200)),
                        'n_points': int(meta_grp.attrs.get('n_points', 0)),
                        'generated_at': str(meta_grp.attrs.get('generated_at', '')),
                        'vmin': float(meta_grp.attrs.get('vmin', 0)),
                        'vmax': float(meta_grp.attrs.get('vmax', 0))
                    }
                }
            
            return {"success": True, "data": data, "message": "云图数据加载成功"}
        except Exception as e:
            return {"success": False, "message": f"加载云图数据失败: {str(e)}", "data": None}
    
    # ==================== 实用方法 ====================
    
    def get_file_info(self) -> Dict[str, Any]:
        """
        获取HDF5文件信息
        
        Returns:
            dict: 文件信息
        """
        try:
            if not self.file_exists():
                return {"exists": False, "file_path": self.file_path}
            
            info = {
                "exists": True,
                "file_path": self.file_path,
                "file_size": os.path.getsize(self.file_path),
                "point_count": len(self.get_all_point_ids()),
                "has_baseline": False,
                "has_contour": False
            }
            
            with h5py.File(self.file_path, 'r') as f:
                if 'baseline' in f and 'waveform' in f['baseline']:
                    info['has_baseline'] = True
                if 'contour' in f and 'grid' in f['contour']:
                    info['has_contour'] = True
            
            return info
        except Exception as e:
            return {"exists": False, "error": str(e)}
    
    def clear_waveforms(self) -> Dict[str, Any]:
        """
        清空所有波形数据（基准波形和测点波形），用于实验重置
        
        Returns:
            dict: {"success": bool, "message": str}
        """
        try:
            if not self.file_exists():
                return {"success": True, "message": "HDF5文件不存在，无需清空"}
            
            with h5py.File(self.file_path, 'a') as f:
                # 清空基准波形
                if 'baseline' in f:
                    del f['baseline']
                    f.create_group('baseline')
                
                # 清空所有测点波形
                if 'points' in f:
                    del f['points']
                    f.create_group('points')
                
                # 清空云图数据
                if 'contour' in f:
                    del f['contour']
                    f.create_group('contour')
            
            return {"success": True, "message": "波形数据已清空"}
        except Exception as e:
            return {"success": False, "message": f"清空波形数据失败: {str(e)}"}
