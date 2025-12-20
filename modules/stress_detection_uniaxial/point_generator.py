"""
应力场测绘模块 - 测点生成器
负责网格布点、极坐标布点、变间距布点、自定义布点、顺序优化
"""

import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import csv
import os

from .shape_utils import ShapeUtils


class PointGenerator:
    """测点生成器类"""
    
    @staticmethod
    def generate_grid_points(shape_config: Dict[str, Any], 
                            params: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成网格布点
        
        Args:
            shape_config: 形状配置
            params: 布点参数
                - rows: 行数
                - cols: 列数
                - row_spacing: 行间距 (可选，与rows二选一)
                - col_spacing: 列间距 (可选，与cols二选一)
                - margin_left: 左边距 (默认0)
                - margin_right: 右边距 (默认0)
                - margin_top: 上边距 (默认0)
                - margin_bottom: 下边距 (默认0)
                - variable_row_spacing: 变间距行数组 (可选)
                - variable_col_spacing: 变间距列数组 (可选)
        
        Returns:
            dict: {"success": bool, "points": list, "total_count": int, "valid_count": int}
        """
        try:
            # 获取边界框
            min_x, min_y, max_x, max_y = ShapeUtils.get_bounding_box(shape_config)
            
            # 应用边距
            margin_left = params.get('margin_left', params.get('margin', 0))
            margin_right = params.get('margin_right', params.get('margin', 0))
            margin_top = params.get('margin_top', params.get('margin', 0))
            margin_bottom = params.get('margin_bottom', params.get('margin', 0))
            
            x_start = min_x + margin_left
            x_end = max_x - margin_right
            y_start = min_y + margin_bottom
            y_end = max_y - margin_top
            
            # 检查有效区域
            if x_end <= x_start or y_end <= y_start:
                return {
                    "success": False,
                    "error": "边距过大，没有有效的布点区域",
                    "points": [],
                    "total_count": 0,
                    "valid_count": 0
                }
            
            # 生成坐标
            variable_row_spacing = params.get('variable_row_spacing')
            variable_col_spacing = params.get('variable_col_spacing')
            
            if variable_row_spacing:
                # 变间距模式 - Y坐标
                y_coords = [y_start]
                current_y = y_start
                for spacing in variable_row_spacing:
                    current_y += spacing
                    if current_y <= y_end:
                        y_coords.append(current_y)
            else:
                # 均匀间距模式
                rows = params.get('rows', 5)
                if rows < 1:
                    rows = 1
                y_coords = np.linspace(y_start, y_end, rows).tolist()
            
            if variable_col_spacing:
                # 变间距模式 - X坐标
                x_coords = [x_start]
                current_x = x_start
                for spacing in variable_col_spacing:
                    current_x += spacing
                    if current_x <= x_end:
                        x_coords.append(current_x)
            else:
                # 均匀间距模式
                cols = params.get('cols', 5)
                if cols < 1:
                    cols = 1
                x_coords = np.linspace(x_start, x_end, cols).tolist()
            
            # 生成所有点
            all_points = []
            for y in y_coords:
                for x in x_coords:
                    all_points.append({'x': x, 'y': y})
            
            # 过滤形状外的点
            valid_points = []
            for point in all_points:
                if ShapeUtils.is_point_inside(point['x'], point['y'], shape_config):
                    valid_points.append(point)
            
            return {
                "success": True,
                "points": valid_points,
                "total_count": len(all_points),
                "valid_count": len(valid_points)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"生成网格布点失败: {str(e)}",
                "points": [],
                "total_count": 0,
                "valid_count": 0
            }
    
    @staticmethod
    def generate_polar_points(shape_config: Dict[str, Any], 
                             params: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成极坐标布点
        
        Args:
            shape_config: 形状配置
            params: 布点参数
                - center_x: 极坐标中心X (默认形状中心)
                - center_y: 极坐标中心Y (默认形状中心)
                - r_start: 起始半径
                - r_end: 结束半径
                - r_count: 径向层数
                - angle_start: 起始角度 (度)
                - angle_end: 结束角度 (度)
                - angle_mode: 'fixed_step' | 'fixed_count' | 'variable'
                - angle_step: 角度步长 (fixed_step模式)
                - angle_count: 每层点数 (fixed_count模式)
                - points_per_ring: 每层点数数组 (variable模式)
                - include_center: 是否包含中心点
        
        Returns:
            dict: {"success": bool, "points": list, "total_count": int, "valid_count": int}
        """
        try:
            # 获取中心点
            default_cx, default_cy = ShapeUtils.get_shape_center(shape_config)
            center_x = params.get('center_x', default_cx)
            center_y = params.get('center_y', default_cy)
            
            # 径向参数
            r_start = params.get('r_start', params.get('r_min', 0))
            r_end = params.get('r_end', params.get('r_max', 50))
            r_count = params.get('r_count', 5)
            
            # 角度参数
            angle_start = params.get('angle_start', 0)
            angle_end = params.get('angle_end', 360)
            angle_mode = params.get('angle_mode', 'fixed_count')
            
            all_points = []
            
            # 检查圆心是否可以设点（在形状内且不在孔洞内）
            include_center = params.get('include_center', True)
            center_is_valid = ShapeUtils.is_point_inside(center_x, center_y, shape_config, check_modifiers=True)
            
            # 如果圆心可设点，添加圆心点
            if include_center and center_is_valid:
                all_points.append({
                    'x': center_x,
                    'y': center_y,
                    'r': 0,
                    'theta': 0
                })
            
            # 生成径向层的半径值
            r_values = np.linspace(r_start, r_end, r_count)
            
            # 生成每层的点
            points_per_ring = params.get('points_per_ring', [])
            
            for ring_idx, r in enumerate(r_values):
                if r == 0:
                    continue
                
                # 确定该层的角度分布
                if angle_mode == 'fixed_step':
                    angle_step = params.get('angle_step', 30)
                    angles = np.arange(angle_start, angle_end, angle_step)
                elif angle_mode == 'variable' and ring_idx < len(points_per_ring):
                    n_points = points_per_ring[ring_idx]
                    angles = np.linspace(angle_start, angle_end, n_points, endpoint=False)
                else:  # fixed_count
                    n_points = params.get('angle_count', 8)
                    angles = np.linspace(angle_start, angle_end, n_points, endpoint=False)
                
                for theta in angles:
                    # 转换为笛卡尔坐标
                    theta_rad = np.radians(theta)
                    x = center_x + r * np.cos(theta_rad)
                    y = center_y + r * np.sin(theta_rad)
                    
                    all_points.append({
                        'x': x,
                        'y': y,
                        'r': r,
                        'theta': theta
                    })
            
            # 过滤形状外的点
            valid_points = []
            for point in all_points:
                if ShapeUtils.is_point_inside(point['x'], point['y'], shape_config):
                    valid_points.append(point)
            
            return {
                "success": True,
                "points": valid_points,
                "total_count": len(all_points),
                "valid_count": len(valid_points),
                "polar_center": {'x': center_x, 'y': center_y}
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"生成极坐标布点失败: {str(e)}",
                "points": [],
                "total_count": 0,
                "valid_count": 0
            }
    
    @staticmethod
    def generate_adaptive_points(shape_config: Dict[str, Any], 
                                params: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成自适应布点（密集区域和稀疏区域）
        
        Args:
            shape_config: 形状配置
            params: 布点参数
                - base_spacing: 基础间距
                - dense_regions: 密集区域列表 [{x, y, radius, density_factor}, ...]
                - min_spacing: 最小间距
        
        Returns:
            dict: {"success": bool, "points": list, "total_count": int, "valid_count": int}
        """
        try:
            base_spacing = params.get('base_spacing', 10)
            dense_regions = params.get('dense_regions', [])
            min_spacing = params.get('min_spacing', 2)
            
            # 获取边界框
            min_x, min_y, max_x, max_y = ShapeUtils.get_bounding_box(shape_config)
            
            # 首先生成基础网格
            margin = params.get('margin', 5)
            x_coords = np.arange(min_x + margin, max_x - margin, base_spacing)
            y_coords = np.arange(min_y + margin, max_y - margin, base_spacing)
            
            all_points = []
            
            # 生成基础点
            for y in y_coords:
                for x in x_coords:
                    if ShapeUtils.is_point_inside(x, y, shape_config):
                        all_points.append({'x': x, 'y': y, 'is_dense': False})
            
            # 在密集区域添加额外的点
            for region in dense_regions:
                rx, ry = region.get('x', 0), region.get('y', 0)
                radius = region.get('radius', 20)
                density_factor = region.get('density_factor', 2)
                
                dense_spacing = max(base_spacing / density_factor, min_spacing)
                
                # 在密集区域内生成更密的点
                for dx in np.arange(-radius, radius, dense_spacing):
                    for dy in np.arange(-radius, radius, dense_spacing):
                        x, y = rx + dx, ry + dy
                        
                        # 检查是否在密集区域圆内
                        if np.sqrt(dx**2 + dy**2) > radius:
                            continue
                        
                        # 检查是否在形状内
                        if not ShapeUtils.is_point_inside(x, y, shape_config):
                            continue
                        
                        # 检查是否与现有点太近
                        too_close = False
                        for p in all_points:
                            dist = np.sqrt((p['x'] - x)**2 + (p['y'] - y)**2)
                            if dist < min_spacing:
                                too_close = True
                                break
                        
                        if not too_close:
                            all_points.append({'x': x, 'y': y, 'is_dense': True})
            
            return {
                "success": True,
                "points": all_points,
                "total_count": len(all_points),
                "valid_count": len(all_points)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"生成自适应布点失败: {str(e)}",
                "points": [],
                "total_count": 0,
                "valid_count": 0
            }
    
    @staticmethod
    def load_custom_points(file_path: str, shape_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        从CSV文件加载自定义测点
        
        Args:
            file_path: CSV文件路径
            shape_config: 形状配置 (可选，用于过滤形状外的点)
        
        Returns:
            dict: {"success": bool, "points": list, "total_count": int, "valid_count": int}
        """
        try:
            if not os.path.exists(file_path):
                return {
                    "success": False,
                    "error": f"文件不存在: {file_path}",
                    "points": [],
                    "total_count": 0,
                    "valid_count": 0
                }
            
            all_points = []
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    try:
                        point = {
                            'x': float(row.get('x', row.get('X', 0))),
                            'y': float(row.get('y', row.get('Y', 0)))
                        }
                        
                        # 可选的极坐标
                        if 'r' in row or 'R' in row:
                            point['r'] = float(row.get('r', row.get('R', 0)))
                        if 'theta' in row or 'Theta' in row or 'θ' in row:
                            point['theta'] = float(row.get('theta', row.get('Theta', row.get('θ', 0))))
                        
                        all_points.append(point)
                    except (ValueError, KeyError):
                        continue
            
            # 过滤形状外的点
            if shape_config:
                valid_points = [p for p in all_points 
                              if ShapeUtils.is_point_inside(p['x'], p['y'], shape_config)]
            else:
                valid_points = all_points
            
            return {
                "success": True,
                "points": valid_points,
                "total_count": len(all_points),
                "valid_count": len(valid_points)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"加载自定义测点失败: {str(e)}",
                "points": [],
                "total_count": 0,
                "valid_count": 0
            }
    
    @staticmethod
    def optimize_point_order(points: List[Dict[str, Any]], 
                            strategy: str = 'zigzag') -> Dict[str, Any]:
        """
        优化测点顺序以最小化探头移动距离
        
        Args:
            points: 测点列表
            strategy: 优化策略
                - 'zigzag': 之字形扫描（适合网格）
                - 'nearest': 最近邻算法
                - 'spiral': 螺旋扫描（适合极坐标）
        
        Returns:
            dict: {"success": bool, "points": list, "total_distance": float, "original_distance": float}
        """
        try:
            if len(points) < 2:
                return {
                    "success": True,
                    "points": points,
                    "total_distance": 0,
                    "original_distance": 0
                }
            
            # 计算原始顺序的总距离
            original_distance = PointGenerator._calculate_total_distance(points)
            
            # 根据策略优化
            if strategy == 'zigzag':
                optimized = PointGenerator._optimize_zigzag(points)
            elif strategy == 'nearest':
                optimized = PointGenerator._optimize_nearest_neighbor(points)
            elif strategy == 'spiral':
                optimized = PointGenerator._optimize_spiral(points)
            else:
                optimized = points
            
            # 计算优化后的总距离
            optimized_distance = PointGenerator._calculate_total_distance(optimized)
            
            return {
                "success": True,
                "points": optimized,
                "total_distance": optimized_distance,
                "original_distance": original_distance,
                "improvement": (original_distance - optimized_distance) / original_distance * 100 if original_distance > 0 else 0
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"优化测点顺序失败: {str(e)}",
                "points": points,
                "total_distance": 0,
                "original_distance": 0
            }
    
    @staticmethod
    def _calculate_total_distance(points: List[Dict[str, Any]]) -> float:
        """计算点序列的总移动距离"""
        if len(points) < 2:
            return 0
        
        total = 0
        for i in range(len(points) - 1):
            dx = points[i+1]['x'] - points[i]['x']
            dy = points[i+1]['y'] - points[i]['y']
            total += np.sqrt(dx**2 + dy**2)
        
        return total
    
    @staticmethod
    def _optimize_zigzag(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """之字形扫描优化（按Y分组，交替方向）"""
        if not points:
            return points
        
        # 按Y坐标分组
        y_tolerance = 0.1  # Y坐标容差
        rows = {}
        
        for point in points:
            y = round(point['y'] / y_tolerance) * y_tolerance
            if y not in rows:
                rows[y] = []
            rows[y].append(point)
        
        # 对每行按X排序
        sorted_y = sorted(rows.keys())
        result = []
        reverse = False
        
        for y in sorted_y:
            row_points = sorted(rows[y], key=lambda p: p['x'], reverse=reverse)
            result.extend(row_points)
            reverse = not reverse  # 交替方向
        
        return result
    
    @staticmethod
    def _optimize_nearest_neighbor(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """最近邻算法优化"""
        if len(points) < 2:
            return points
        
        remaining = points.copy()
        result = [remaining.pop(0)]  # 从第一个点开始
        
        while remaining:
            current = result[-1]
            
            # 找最近的点
            min_dist = float('inf')
            nearest_idx = 0
            
            for i, point in enumerate(remaining):
                dist = np.sqrt((point['x'] - current['x'])**2 + (point['y'] - current['y'])**2)
                if dist < min_dist:
                    min_dist = dist
                    nearest_idx = i
            
            result.append(remaining.pop(nearest_idx))
        
        return result
    
    @staticmethod
    def _optimize_spiral(points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """螺旋扫描优化（适合极坐标布点）"""
        if not points:
            return points
        
        # 检查是否有极坐标信息
        has_polar = all('r' in p and 'theta' in p for p in points)
        
        if has_polar:
            # 按半径和角度排序（从内到外，逆时针）
            return sorted(points, key=lambda p: (p['r'], p['theta']))
        else:
            # 计算到中心的距离和角度
            xs = [p['x'] for p in points]
            ys = [p['y'] for p in points]
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            
            def polar_key(p):
                r = np.sqrt((p['x'] - cx)**2 + (p['y'] - cy)**2)
                theta = np.arctan2(p['y'] - cy, p['x'] - cx)
                return (r, theta)
            
            return sorted(points, key=polar_key)
    
    @staticmethod
    def filter_points_by_shape(points: List[Dict[str, Any]], 
                               shape_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        根据形状过滤测点
        
        Args:
            points: 测点列表
            shape_config: 形状配置
        
        Returns:
            list: 过滤后的测点列表
        """
        return [p for p in points if ShapeUtils.is_point_inside(p['x'], p['y'], shape_config)]
