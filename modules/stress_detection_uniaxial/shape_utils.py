"""
应力场测绘模块 - 形状工具
负责形状验证、遮罩生成、点位判断、面积计算、布尔运算
"""

import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union

# 尝试导入shapely，如果不可用则使用简化实现
try:
    from shapely.geometry import Polygon, Point, MultiPolygon
    from shapely.ops import unary_union
    from shapely.validation import explain_validity
    SHAPELY_AVAILABLE = True
except ImportError:
    SHAPELY_AVAILABLE = False
    print("警告: shapely库未安装，将使用简化的几何计算")


class ShapeUtils:
    """形状工具类"""
    
    @staticmethod
    def validate_shape(shape_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证形状配置
        
        Args:
            shape_config: 形状配置字典，包含:
                - type: 'rectangle' | 'circle' | 'polygon'
                - 矩形: width, height
                - 圆形: centerX, centerY, outerRadius, innerRadius(可选), startAngle, endAngle
                - 多边形: vertices [[x,y], ...]
                - modifiers: 布尔运算修改器列表 (可选)
        
        Returns:
            dict: {
                "success": bool,
                "is_valid": bool,
                "area": float,
                "warnings": list,
                "error": str (如果有错误)
            }
        """
        try:
            shape_type = shape_config.get('type', 'rectangle')
            warnings = []
            
            # 根据类型验证参数
            if shape_type == 'rectangle':
                result = ShapeUtils._validate_rectangle(shape_config)
            elif shape_type == 'circle':
                result = ShapeUtils._validate_circle(shape_config)
            elif shape_type == 'polygon':
                result = ShapeUtils._validate_polygon(shape_config)
            else:
                return {
                    "success": False,
                    "is_valid": False,
                    "area": 0,
                    "warnings": [],
                    "error": f"不支持的形状类型: {shape_type}"
                }
            
            if not result['is_valid']:
                return result
            
            # 计算面积
            area = ShapeUtils.calculate_area(shape_config)
            
            # 应用布尔运算后重新计算面积
            modifiers = shape_config.get('modifiers', [])
            if modifiers:
                for modifier in modifiers:
                    hole_area = ShapeUtils._calculate_modifier_area(modifier)
                    if modifier.get('op') == 'subtract':
                        area -= hole_area
            
            # 面积检查
            if area < 100:
                warnings.append(f"形状面积过小 ({area:.1f} mm²)，建议 ≥ 100 mm²")
            
            if area <= 0:
                return {
                    "success": True,
                    "is_valid": False,
                    "area": area,
                    "warnings": warnings,
                    "error": "形状面积为零或负值"
                }
            
            return {
                "success": True,
                "is_valid": True,
                "area": area,
                "warnings": warnings + result.get('warnings', [])
            }
            
        except Exception as e:
            return {
                "success": False,
                "is_valid": False,
                "area": 0,
                "warnings": [],
                "error": f"验证形状时出错: {str(e)}"
            }
    
    @staticmethod
    def _validate_rectangle(config: Dict[str, Any]) -> Dict[str, Any]:
        """验证矩形参数"""
        width = config.get('width', 0)
        height = config.get('height', 0)
        warnings = []
        
        if width <= 0:
            return {"is_valid": False, "error": "矩形宽度必须大于0", "warnings": []}
        if height <= 0:
            return {"is_valid": False, "error": "矩形高度必须大于0", "warnings": []}
        
        # 长宽比检查
        ratio = max(width, height) / min(width, height)
        if ratio > 10:
            warnings.append(f"长宽比过大 ({ratio:.1f})，可能影响云图显示效果")
        
        return {"is_valid": True, "warnings": warnings}
    
    @staticmethod
    def _validate_circle(config: Dict[str, Any]) -> Dict[str, Any]:
        """验证圆形参数"""
        outer_radius = config.get('outerRadius', config.get('radius', 0))
        inner_radius = config.get('innerRadius', 0)
        start_angle = config.get('startAngle', 0)
        end_angle = config.get('endAngle', 360)
        warnings = []
        
        if outer_radius <= 0:
            return {"is_valid": False, "error": "圆形半径必须大于0", "warnings": []}
        
        if inner_radius < 0:
            return {"is_valid": False, "error": "内半径不能为负", "warnings": []}
        
        if inner_radius >= outer_radius:
            return {"is_valid": False, "error": "内半径必须小于外半径", "warnings": []}
        
        # 角度范围检查
        angle_range = abs(end_angle - start_angle)
        if angle_range < 30:
            warnings.append(f"角度范围过小 ({angle_range}°)，可能影响测量")
        
        return {"is_valid": True, "warnings": warnings}
    
    @staticmethod
    def _validate_polygon(config: Dict[str, Any]) -> Dict[str, Any]:
        """验证多边形参数"""
        vertices = config.get('vertices', [])
        warnings = []
        
        if len(vertices) < 3:
            return {"is_valid": False, "error": "多边形至少需要3个顶点", "warnings": []}
        
        # 检查自相交
        if SHAPELY_AVAILABLE:
            try:
                polygon = Polygon(vertices)
                if not polygon.is_valid:
                    reason = explain_validity(polygon)
                    return {"is_valid": False, "error": f"多边形无效: {reason}", "warnings": []}
                if not polygon.is_simple:
                    return {"is_valid": False, "error": "多边形存在自相交", "warnings": []}
            except Exception as e:
                return {"is_valid": False, "error": f"多边形验证失败: {str(e)}", "warnings": []}
        else:
            # 简化的自相交检测
            if ShapeUtils._check_self_intersection_simple(vertices):
                return {"is_valid": False, "error": "多边形存在自相交", "warnings": []}
        
        return {"is_valid": True, "warnings": warnings}
    
    @staticmethod
    def _check_self_intersection_simple(vertices: List[List[float]]) -> bool:
        """简化的自相交检测（不使用shapely）"""
        n = len(vertices)
        if n < 4:
            return False
        
        def ccw(A, B, C):
            return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
        
        def intersect(A, B, C, D):
            return ccw(A,C,D) != ccw(B,C,D) and ccw(A,B,C) != ccw(A,B,D)
        
        # 检查非相邻边是否相交
        for i in range(n):
            for j in range(i + 2, n):
                if i == 0 and j == n - 1:
                    continue  # 跳过首尾相连的边
                if intersect(vertices[i], vertices[(i+1)%n], 
                           vertices[j], vertices[(j+1)%n]):
                    return True
        return False
    
    @staticmethod
    def calculate_area(shape_config: Dict[str, Any]) -> float:
        """
        计算形状面积
        
        Args:
            shape_config: 形状配置
        
        Returns:
            float: 面积 (mm²)
        """
        shape_type = shape_config.get('type', 'rectangle')
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            return width * height
        
        elif shape_type == 'circle':
            outer_radius = shape_config.get('outerRadius', shape_config.get('radius', 0))
            inner_radius = shape_config.get('innerRadius', 0)
            start_angle = shape_config.get('startAngle', 0)
            end_angle = shape_config.get('endAngle', 360)
            
            angle_ratio = abs(end_angle - start_angle) / 360.0
            outer_area = np.pi * outer_radius ** 2 * angle_ratio
            inner_area = np.pi * inner_radius ** 2 * angle_ratio
            return outer_area - inner_area
        
        elif shape_type == 'polygon':
            vertices = shape_config.get('vertices', [])
            if len(vertices) < 3:
                return 0
            
            # 使用鞋带公式计算面积
            n = len(vertices)
            area = 0
            for i in range(n):
                j = (i + 1) % n
                area += vertices[i][0] * vertices[j][1]
                area -= vertices[j][0] * vertices[i][1]
            return abs(area) / 2
        
        return 0
    
    @staticmethod
    def _calculate_modifier_area(modifier: Dict[str, Any]) -> float:
        """计算修改器（孔洞）的面积"""
        shape_type = modifier.get('shape', 'circle')
        
        if shape_type == 'circle':
            radius = modifier.get('radius', 0)
            return np.pi * radius ** 2
        elif shape_type == 'rectangle':
            width = modifier.get('width', 0)
            height = modifier.get('height', 0)
            return width * height
        
        return 0
    
    @staticmethod
    def is_point_inside(x: float, y: float, shape_config: Dict[str, Any], 
                       check_modifiers: bool = True) -> bool:
        """
        判断点是否在形状内部
        
        Args:
            x, y: 点坐标
            shape_config: 形状配置
            check_modifiers: 是否检查布尔运算修改器（孔洞）
        
        Returns:
            bool: 点是否在形状内部
        """
        shape_type = shape_config.get('type', 'rectangle')
        
        # 首先检查是否在基本形状内
        inside_base = False
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            inside_base = 0 <= x <= width and 0 <= y <= height
        
        elif shape_type == 'circle':
            cx = shape_config.get('centerX', 0)
            cy = shape_config.get('centerY', 0)
            outer_r = shape_config.get('outerRadius', shape_config.get('radius', 0))
            inner_r = shape_config.get('innerRadius', 0)
            start_angle = shape_config.get('startAngle', 0)
            end_angle = shape_config.get('endAngle', 360)
            
            # 计算到圆心的距离
            dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            
            # 检查半径范围（加入小容差处理浮点数精度问题）
            tolerance = 1e-6
            if not (inner_r - tolerance <= dist <= outer_r + tolerance):
                inside_base = False
            else:
                # 检查角度范围
                # 如果是完整圆（360度），直接通过
                if abs(end_angle - start_angle) >= 360:
                    inside_base = True
                else:
                    angle = np.degrees(np.arctan2(y - cy, x - cx))
                    if angle < 0:
                        angle += 360
                    
                    # 规范化起始和结束角度到 [0, 360)
                    start_norm = start_angle % 360
                    end_norm = end_angle % 360
                    
                    if start_norm <= end_norm:
                        inside_base = start_norm <= angle <= end_norm
                    else:
                        # 跨越0度的情况
                        inside_base = angle >= start_norm or angle <= end_norm
        
        elif shape_type == 'polygon':
            vertices = shape_config.get('vertices', [])
            if SHAPELY_AVAILABLE:
                try:
                    polygon = Polygon(vertices)
                    point = Point(x, y)
                    inside_base = polygon.contains(point) or polygon.boundary.contains(point)
                except:
                    inside_base = ShapeUtils._point_in_polygon_simple(x, y, vertices)
            else:
                inside_base = ShapeUtils._point_in_polygon_simple(x, y, vertices)
        
        if not inside_base:
            return False
        
        # 检查是否在孔洞内
        if check_modifiers:
            modifiers = shape_config.get('modifiers', [])
            for modifier in modifiers:
                if modifier.get('op') == 'subtract':
                    if ShapeUtils._is_point_in_modifier(x, y, modifier):
                        return False
        
        return True
    
    @staticmethod
    def _point_in_polygon_simple(x: float, y: float, vertices: List[List[float]]) -> bool:
        """简化的点在多边形内判断（射线法）"""
        n = len(vertices)
        inside = False
        
        j = n - 1
        for i in range(n):
            xi, yi = vertices[i]
            xj, yj = vertices[j]
            
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        
        return inside
    
    @staticmethod
    def _is_point_in_modifier(x: float, y: float, modifier: Dict[str, Any]) -> bool:
        """判断点是否在修改器（孔洞）内"""
        shape_type = modifier.get('shape', 'circle')
        
        if shape_type == 'circle':
            cx = modifier.get('centerX', 0)
            cy = modifier.get('centerY', 0)
            radius = modifier.get('radius', 0)
            dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            return dist <= radius
        
        elif shape_type == 'rectangle':
            mx = modifier.get('x', modifier.get('centerX', 0))
            my = modifier.get('y', modifier.get('centerY', 0))
            width = modifier.get('width', 0)
            height = modifier.get('height', 0)
            # 假设x,y是左下角坐标
            return mx <= x <= mx + width and my <= y <= my + height
        
        return False
    
    @staticmethod
    def create_shape_mask(shape_config: Dict[str, Any], 
                         grid_x: np.ndarray, grid_y: np.ndarray,
                         margin: float = 0) -> np.ndarray:
        """
        创建形状遮罩
        
        Args:
            shape_config: 形状配置
            grid_x: X坐标网格 (2D array)
            grid_y: Y坐标网格 (2D array)
            margin: 边距 (mm)，正值表示向内收缩
        
        Returns:
            np.ndarray: 布尔遮罩数组，True表示在形状内
        """
        mask = np.zeros(grid_x.shape, dtype=bool)
        
        for i in range(grid_x.shape[0]):
            for j in range(grid_x.shape[1]):
                x, y = grid_x[i, j], grid_y[i, j]
                
                # 检查是否在形状内
                if ShapeUtils.is_point_inside(x, y, shape_config, check_modifiers=True):
                    # 如果有边距，检查到边界的距离
                    if margin > 0:
                        if ShapeUtils._distance_to_boundary(x, y, shape_config) >= margin:
                            mask[i, j] = True
                    else:
                        mask[i, j] = True
        
        return mask
    
    @staticmethod
    def _distance_to_boundary(x: float, y: float, shape_config: Dict[str, Any]) -> float:
        """计算点到形状边界的最小距离（简化实现）"""
        shape_type = shape_config.get('type', 'rectangle')
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            # 到四条边的距离
            distances = [x, width - x, y, height - y]
            return min(distances)
        
        elif shape_type == 'circle':
            cx = shape_config.get('centerX', 0)
            cy = shape_config.get('centerY', 0)
            outer_r = shape_config.get('outerRadius', shape_config.get('radius', 0))
            inner_r = shape_config.get('innerRadius', 0)
            
            dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            return min(outer_r - dist, dist - inner_r) if inner_r > 0 else outer_r - dist
        
        # 多边形的距离计算较复杂，这里返回一个估计值
        return 0
    
    @staticmethod
    def apply_boolean_operations(base_shape: Dict[str, Any], 
                                 modifiers: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        应用布尔运算
        
        Args:
            base_shape: 基础形状配置
            modifiers: 修改器列表，每个包含 {op: 'subtract', shape: 'circle', ...}
        
        Returns:
            dict: 包含修改器的完整形状配置
        """
        result = base_shape.copy()
        result['modifiers'] = modifiers
        
        # 验证每个修改器
        valid_modifiers = []
        for modifier in modifiers:
            if modifier.get('op') == 'subtract':
                # 验证孔洞是否在基础形状内
                shape_type = modifier.get('shape', 'circle')
                if shape_type == 'circle':
                    cx = modifier.get('centerX', 0)
                    cy = modifier.get('centerY', 0)
                    # 检查圆心是否在基础形状内
                    if ShapeUtils.is_point_inside(cx, cy, base_shape, check_modifiers=False):
                        valid_modifiers.append(modifier)
                else:
                    valid_modifiers.append(modifier)
        
        result['modifiers'] = valid_modifiers
        return result
    
    @staticmethod
    def get_bounding_box(shape_config: Dict[str, Any]) -> Tuple[float, float, float, float]:
        """
        获取形状的边界框
        
        Args:
            shape_config: 形状配置
        
        Returns:
            tuple: (min_x, min_y, max_x, max_y)
        """
        shape_type = shape_config.get('type', 'rectangle')
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            return (0, 0, width, height)
        
        elif shape_type == 'circle':
            cx = shape_config.get('centerX', 0)
            cy = shape_config.get('centerY', 0)
            r = shape_config.get('outerRadius', shape_config.get('radius', 0))
            return (cx - r, cy - r, cx + r, cy + r)
        
        elif shape_type == 'polygon':
            vertices = shape_config.get('vertices', [])
            if not vertices:
                return (0, 0, 0, 0)
            xs = [v[0] for v in vertices]
            ys = [v[1] for v in vertices]
            return (min(xs), min(ys), max(xs), max(ys))
        
        return (0, 0, 0, 0)
    
    @staticmethod
    def get_shape_center(shape_config: Dict[str, Any]) -> Tuple[float, float]:
        """
        获取形状的中心点
        
        Args:
            shape_config: 形状配置
        
        Returns:
            tuple: (center_x, center_y)
        """
        shape_type = shape_config.get('type', 'rectangle')
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            return (width / 2, height / 2)
        
        elif shape_type == 'circle':
            cx = shape_config.get('centerX', 0)
            cy = shape_config.get('centerY', 0)
            return (cx, cy)
        
        elif shape_type == 'polygon':
            vertices = shape_config.get('vertices', [])
            if not vertices:
                return (0, 0)
            xs = [v[0] for v in vertices]
            ys = [v[1] for v in vertices]
            return (sum(xs) / len(xs), sum(ys) / len(ys))
        
        return (0, 0)
