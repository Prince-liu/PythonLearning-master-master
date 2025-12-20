"""
应力场测绘模块 - 插值算法
负责应力场插值、置信度评估、等高线生成
"""

import numpy as np
from typing import Dict, List, Any, Tuple, Optional
from scipy import interpolate
from scipy.ndimage import gaussian_filter


class StressFieldInterpolation:
    """应力场插值类"""
    
    # 插值策略阈值
    MIN_POINTS_FOR_LINEAR = 3
    MIN_POINTS_FOR_CUBIC = 9
    
    @staticmethod
    def interpolate_stress_field(points: List[Dict[str, Any]], 
                                 shape_config: Dict[str, Any],
                                 resolution: int = 100,
                                 method: str = 'auto') -> Dict[str, Any]:
        """
        对应力场进行插值
        
        Args:
            points: 测点列表，每个点包含 {x, y, stress_value}
            shape_config: 形状配置
            resolution: 网格分辨率
            method: 插值方法 'auto' | 'linear' | 'cubic' | 'nearest'
        
        Returns:
            dict: {
                "success": bool,
                "mode": str,  # 'points_only' | 'linear' | 'cubic'
                "grid": {"xi": 2D, "yi": 2D, "zi": 2D},
                "method": str,
                "confidence": str,
                "message": str
            }
        """
        try:
            # 过滤有效测点（有应力值的点）
            valid_points = [p for p in points if p.get('stress_value') is not None]
            n_points = len(valid_points)
            
            if n_points == 0:
                return {
                    "success": False,
                    "mode": "points_only",
                    "error": "没有有效的测点数据",
                    "grid": None
                }
            
            # 提取坐标和应力值
            x = np.array([p['x'] for p in valid_points])
            y = np.array([p['y'] for p in valid_points])
            z = np.array([p['stress_value'] for p in valid_points])
            
            # 获取边界框
            from .shape_utils import ShapeUtils
            min_x, min_y, max_x, max_y = ShapeUtils.get_bounding_box(shape_config)
            
            # 创建网格
            xi = np.linspace(min_x, max_x, resolution)
            yi = np.linspace(min_y, max_y, resolution)
            xi_grid, yi_grid = np.meshgrid(xi, yi)
            
            # 根据点数选择插值方法
            if method == 'auto':
                if n_points < StressFieldInterpolation.MIN_POINTS_FOR_LINEAR:
                    actual_method = 'none'
                elif n_points < StressFieldInterpolation.MIN_POINTS_FOR_CUBIC:
                    actual_method = 'linear'
                else:
                    actual_method = 'cubic'
            else:
                actual_method = method
            
            # 执行插值
            if actual_method == 'none' or n_points < StressFieldInterpolation.MIN_POINTS_FOR_LINEAR:
                # 点数太少，不进行插值
                zi_grid = np.full(xi_grid.shape, np.nan)
                mode = 'points_only'
                confidence = 'none'
                message = f"测点数量不足 ({n_points} < {StressFieldInterpolation.MIN_POINTS_FOR_LINEAR})，仅显示离散点"
            else:
                try:
                    # 使用griddata进行插值
                    zi_grid = interpolate.griddata(
                        (x, y), z, (xi_grid, yi_grid),
                        method=actual_method,
                        fill_value=np.nan
                    )
                    
                    # 应用高斯平滑
                    zi_grid = StressFieldInterpolation._apply_smoothing(zi_grid)
                    
                    mode = 'contour'
                    confidence = StressFieldInterpolation.get_confidence_level(n_points)
                    message = f"使用 {actual_method} 插值，{n_points} 个测点"
                    
                except Exception as interp_error:
                    # 插值失败，尝试降级
                    if actual_method == 'cubic':
                        zi_grid = interpolate.griddata(
                            (x, y), z, (xi_grid, yi_grid),
                            method='linear',
                            fill_value=np.nan
                        )
                        actual_method = 'linear'
                        mode = 'contour'
                        confidence = 'low'
                        message = f"三次插值失败，降级为线性插值"
                    else:
                        raise interp_error
            
            # 应用形状遮罩
            mask = ShapeUtils.create_shape_mask(shape_config, xi_grid, yi_grid)
            zi_grid = np.where(mask, zi_grid, np.nan)
            
            return {
                "success": True,
                "mode": mode,
                "grid": {
                    "xi": xi_grid.tolist(),
                    "yi": yi_grid.tolist(),
                    "zi": zi_grid.tolist()
                },
                "method": actual_method,
                "confidence": confidence,
                "n_points": n_points,
                "message": message,
                "stats": {
                    "vmin": float(np.nanmin(zi_grid)) if not np.all(np.isnan(zi_grid)) else 0,
                    "vmax": float(np.nanmax(zi_grid)) if not np.all(np.isnan(zi_grid)) else 0,
                    "mean": float(np.nanmean(zi_grid)) if not np.all(np.isnan(zi_grid)) else 0
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "mode": "points_only",
                "error": f"插值失败: {str(e)}",
                "grid": None
            }
    
    @staticmethod
    def _apply_smoothing(zi: np.ndarray, sigma: float = 1.0) -> np.ndarray:
        """应用高斯平滑"""
        # 创建有效数据的掩码
        valid_mask = ~np.isnan(zi)
        
        if not np.any(valid_mask):
            return zi
        
        # 用均值填充NaN进行平滑
        zi_filled = zi.copy()
        zi_filled[~valid_mask] = np.nanmean(zi)
        
        # 应用高斯滤波
        zi_smooth = gaussian_filter(zi_filled, sigma=sigma)
        
        # 恢复NaN
        zi_smooth[~valid_mask] = np.nan
        
        return zi_smooth
    
    @staticmethod
    def get_confidence_level(n_points: int) -> str:
        """
        根据测点数量返回置信度等级
        
        Args:
            n_points: 测点数量
        
        Returns:
            str: 'none' | 'low' | 'medium' | 'high' | 'full'
        """
        if n_points < 3:
            return 'none'
        elif n_points < 9:
            return 'low'
        elif n_points < 16:
            return 'medium'
        elif n_points < 25:
            return 'high'
        else:
            return 'full'
    
    @staticmethod
    def get_interpolation_method(n_points: int) -> str:
        """
        根据测点数量返回推荐的插值方法
        
        Args:
            n_points: 测点数量
        
        Returns:
            str: 'none' | 'linear' | 'cubic'
        """
        if n_points < StressFieldInterpolation.MIN_POINTS_FOR_LINEAR:
            return 'none'
        elif n_points < StressFieldInterpolation.MIN_POINTS_FOR_CUBIC:
            return 'linear'
        else:
            return 'cubic'
    
    @staticmethod
    def generate_contour_lines(zi: np.ndarray, xi: np.ndarray, yi: np.ndarray,
                               levels: int = 10) -> Dict[str, Any]:
        """
        生成等高线数据
        
        Args:
            zi: 应力值网格
            xi: X坐标网格
            yi: Y坐标网格
            levels: 等高线数量
        
        Returns:
            dict: {"success": bool, "contours": list, "levels": list}
        """
        try:
            import matplotlib
            matplotlib.use('Agg')  # 非交互式后端
            import matplotlib.pyplot as plt
            
            # 计算等高线级别
            valid_z = zi[~np.isnan(zi)]
            if len(valid_z) == 0:
                return {"success": False, "error": "没有有效数据"}
            
            z_min, z_max = np.min(valid_z), np.max(valid_z)
            level_values = np.linspace(z_min, z_max, levels)
            
            # 生成等高线
            fig, ax = plt.subplots()
            cs = ax.contour(xi, yi, zi, levels=level_values)
            
            # 提取等高线数据
            contours = []
            for i, collection in enumerate(cs.collections):
                paths = collection.get_paths()
                level_contours = []
                for path in paths:
                    vertices = path.vertices.tolist()
                    level_contours.append(vertices)
                contours.append({
                    'level': float(level_values[i]),
                    'paths': level_contours
                })
            
            plt.close(fig)
            
            return {
                "success": True,
                "contours": contours,
                "levels": level_values.tolist()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"生成等高线失败: {str(e)}"
            }
    
    @staticmethod
    def check_stress_range_change(old_stats: Dict[str, float], 
                                  new_stats: Dict[str, float],
                                  threshold: float = 0.3) -> bool:
        """
        检查应力范围是否发生显著变化
        
        Args:
            old_stats: 旧的统计信息 {vmin, vmax}
            new_stats: 新的统计信息 {vmin, vmax}
            threshold: 变化阈值 (默认30%)
        
        Returns:
            bool: 是否需要完全重新生成云图
        """
        if not old_stats or not new_stats:
            return True
        
        old_range = old_stats.get('vmax', 0) - old_stats.get('vmin', 0)
        new_range = new_stats.get('vmax', 0) - new_stats.get('vmin', 0)
        
        if old_range == 0:
            return True
        
        change_ratio = abs(new_range - old_range) / old_range
        return change_ratio > threshold
    
    @staticmethod
    def interpolate_at_point(x: float, y: float, 
                            points: List[Dict[str, Any]],
                            method: str = 'idw') -> Optional[float]:
        """
        在指定位置插值应力值（用于鼠标悬停显示）
        
        Args:
            x, y: 查询位置
            points: 测点列表
            method: 插值方法 'idw' (反距离加权) | 'nearest'
        
        Returns:
            float: 插值的应力值，如果无法插值则返回None
        """
        valid_points = [p for p in points if p.get('stress_value') is not None]
        
        if not valid_points:
            return None
        
        if method == 'nearest':
            # 最近邻
            min_dist = float('inf')
            nearest_stress = None
            for p in valid_points:
                dist = np.sqrt((p['x'] - x)**2 + (p['y'] - y)**2)
                if dist < min_dist:
                    min_dist = dist
                    nearest_stress = p['stress_value']
            return nearest_stress
        
        else:  # IDW
            # 反距离加权插值
            weights = []
            values = []
            
            for p in valid_points:
                dist = np.sqrt((p['x'] - x)**2 + (p['y'] - y)**2)
                if dist < 0.001:  # 非常接近某个测点
                    return p['stress_value']
                weights.append(1.0 / dist**2)
                values.append(p['stress_value'])
            
            total_weight = sum(weights)
            if total_weight == 0:
                return None
            
            return sum(w * v for w, v in zip(weights, values)) / total_weight
