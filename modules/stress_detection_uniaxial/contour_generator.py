"""
应力场测绘模块 - 云图生成器
负责云图生成、色标映射、图像导出、实时更新
"""

import numpy as np
from typing import Dict, List, Any, Tuple, Optional
import os
from datetime import datetime

# 尝试导入matplotlib
try:
    import matplotlib
    matplotlib.use('Agg')  # 非交互式后端
    import matplotlib.pyplot as plt
    import matplotlib.colors as mcolors
    from matplotlib.patches import Polygon as MplPolygon, Circle, Rectangle
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("警告: matplotlib库未安装，云图导出功能将不可用")


class ContourGenerator:
    """云图生成器类"""
    
    # 预定义色标
    COLORMAPS = {
        'jet': 'jet',
        'rainbow': 'rainbow',
        'coolwarm': 'coolwarm',
        'RdYlBu': 'RdYlBu_r',
        'viridis': 'viridis',
        'plasma': 'plasma'
    }
    
    # 默认色标：红(拉应力) -> 绿(零) -> 蓝(压应力)
    DEFAULT_COLORMAP = 'RdYlBu'
    
    def __init__(self, exp_id: str):
        """
        初始化云图生成器
        
        Args:
            exp_id: 实验ID
        """
        self.exp_id = exp_id
        self.cache = None
        self.last_stats = None
    
    def generate_contour(self, grid_data: Dict[str, Any], 
                        shape_config: Dict[str, Any],
                        points: List[Dict[str, Any]] = None,
                        colormap: str = None,
                        vmin: float = None,
                        vmax: float = None) -> Dict[str, Any]:
        """
        生成云图数据
        
        Args:
            grid_data: 插值网格数据 {xi, yi, zi}
            shape_config: 形状配置
            points: 测点列表 (可选，用于叠加显示)
            colormap: 色标名称
            vmin, vmax: 色标范围 (可选，自动计算)
        
        Returns:
            dict: {
                "success": bool,
                "image_data": str (base64),
                "colorbar": {...},
                "stats": {...}
            }
        """
        try:
            xi = np.array(grid_data['xi'])
            yi = np.array(grid_data['yi'])
            zi = np.array(grid_data['zi'])
            
            # 计算统计信息
            valid_z = zi[~np.isnan(zi)]
            if len(valid_z) == 0:
                return {
                    "success": False,
                    "error": "没有有效的应力数据"
                }
            
            stats = {
                'vmin': float(np.min(valid_z)),
                'vmax': float(np.max(valid_z)),
                'mean': float(np.mean(valid_z)),
                'std': float(np.std(valid_z))
            }
            
            # 确定色标范围
            if vmin is None:
                vmin = stats['vmin']
            if vmax is None:
                vmax = stats['vmax']
            
            # 生成颜色映射数据（用于前端Canvas绘制）
            cmap_name = self.COLORMAPS.get(colormap, self.COLORMAPS[self.DEFAULT_COLORMAP])
            
            # 归一化应力值到0-1
            z_normalized = (zi - vmin) / (vmax - vmin + 1e-10)
            z_normalized = np.clip(z_normalized, 0, 1)
            
            # 生成RGBA颜色数据
            if MATPLOTLIB_AVAILABLE:
                cmap = plt.get_cmap(cmap_name)
                colors = cmap(z_normalized)
                # 将NaN区域设为透明
                colors[np.isnan(zi)] = [0, 0, 0, 0]
                
                # 转换为0-255的整数
                colors_uint8 = (colors * 255).astype(np.uint8)
            else:
                # 简化的颜色映射（红-绿-蓝）
                colors_uint8 = self._simple_colormap(z_normalized, zi)
            
            # 更新缓存
            self.cache = {
                'grid': grid_data,
                'colors': colors_uint8.tolist(),
                'stats': stats
            }
            self.last_stats = stats
            
            return {
                "success": True,
                "colors": colors_uint8.tolist(),
                "stats": stats,
                "colorbar": {
                    "vmin": vmin,
                    "vmax": vmax,
                    "colormap": colormap or self.DEFAULT_COLORMAP
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"生成云图失败: {str(e)}"
            }
    
    def _simple_colormap(self, z_normalized: np.ndarray, zi: np.ndarray) -> np.ndarray:
        """简化的颜色映射（不依赖matplotlib）"""
        colors = np.zeros((*z_normalized.shape, 4), dtype=np.uint8)
        
        for i in range(z_normalized.shape[0]):
            for j in range(z_normalized.shape[1]):
                if np.isnan(zi[i, j]):
                    colors[i, j] = [0, 0, 0, 0]  # 透明
                else:
                    v = z_normalized[i, j]
                    # 红(1) -> 绿(0.5) -> 蓝(0)
                    if v > 0.5:
                        r = int(255 * (v - 0.5) * 2)
                        g = int(255 * (1 - (v - 0.5) * 2))
                        b = 0
                    else:
                        r = 0
                        g = int(255 * v * 2)
                        b = int(255 * (1 - v * 2))
                    colors[i, j] = [r, g, b, 255]
        
        return colors
    
    def export_contour_image(self, grid_data: Dict[str, Any],
                            shape_config: Dict[str, Any],
                            points: List[Dict[str, Any]] = None,
                            output_path: str = None,
                            format: str = 'png',
                            dpi: int = 300,
                            colormap: str = None,
                            vmin: float = None,
                            vmax: float = None,
                            show_points: bool = True,
                            show_colorbar: bool = True,
                            title: str = None) -> Dict[str, Any]:
        """
        导出云图图片
        
        Args:
            grid_data: 插值网格数据
            shape_config: 形状配置
            points: 测点列表
            output_path: 输出路径 (可选，自动生成)
            format: 图片格式 'png' | 'svg' | 'pdf'
            dpi: 分辨率
            colormap: 色标名称
            vmin, vmax: 色标范围
            show_points: 是否显示测点
            show_colorbar: 是否显示色标
            title: 图片标题
        
        Returns:
            dict: {"success": bool, "file_path": str}
        """
        if not MATPLOTLIB_AVAILABLE:
            return {
                "success": False,
                "error": "matplotlib库未安装，无法导出图片"
            }
        
        try:
            xi = np.array(grid_data['xi'])
            yi = np.array(grid_data['yi'])
            zi = np.array(grid_data['zi'])
            
            # 计算色标范围
            valid_z = zi[~np.isnan(zi)]
            if vmin is None:
                vmin = np.min(valid_z) if len(valid_z) > 0 else 0
            if vmax is None:
                vmax = np.max(valid_z) if len(valid_z) > 0 else 1
            
            # 创建图形
            fig, ax = plt.subplots(figsize=(10, 8))
            
            # 绘制云图
            cmap_name = self.COLORMAPS.get(colormap, self.COLORMAPS[self.DEFAULT_COLORMAP])
            im = ax.pcolormesh(xi, yi, zi, cmap=cmap_name, vmin=vmin, vmax=vmax, shading='auto')
            
            # 绘制形状轮廓
            self._draw_shape_outline(ax, shape_config)
            
            # 绘制测点
            if show_points and points:
                for p in points:
                    if p.get('status') == 'measured':
                        ax.plot(p['x'], p['y'], 'ko', markersize=4)
                    elif p.get('status') == 'pending':
                        ax.plot(p['x'], p['y'], 'o', color='gray', markersize=3, alpha=0.5)
            
            # 添加色标
            if show_colorbar:
                cbar = plt.colorbar(im, ax=ax, label='应力 (MPa)')
            
            # 设置标题和标签
            if title:
                ax.set_title(title, fontsize=14)
            ax.set_xlabel('X (mm)')
            ax.set_ylabel('Y (mm)')
            ax.set_aspect('equal')
            
            # 生成输出路径
            if output_path is None:
                output_dir = f'data/uniaxial_field/exports'
                os.makedirs(output_dir, exist_ok=True)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                output_path = os.path.join(output_dir, f'{self.exp_id}_contour_{timestamp}.{format}')
            
            # 保存图片
            plt.savefig(output_path, format=format, dpi=dpi, bbox_inches='tight')
            plt.close(fig)
            
            return {
                "success": True,
                "file_path": output_path
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"导出云图图片失败: {str(e)}"
            }
    
    def _draw_shape_outline(self, ax, shape_config: Dict[str, Any]):
        """在图上绘制形状轮廓"""
        shape_type = shape_config.get('type', 'rectangle')
        
        if shape_type == 'rectangle':
            width = shape_config.get('width', 0)
            height = shape_config.get('height', 0)
            rect = Rectangle((0, 0), width, height, fill=False, edgecolor='black', linewidth=2)
            ax.add_patch(rect)
        
        elif shape_type == 'circle':
            cx = shape_config.get('centerX', 0)
            cy = shape_config.get('centerY', 0)
            r = shape_config.get('outerRadius', shape_config.get('radius', 0))
            circle = Circle((cx, cy), r, fill=False, edgecolor='black', linewidth=2)
            ax.add_patch(circle)
            
            # 内圆（如果有）
            inner_r = shape_config.get('innerRadius', 0)
            if inner_r > 0:
                inner_circle = Circle((cx, cy), inner_r, fill=False, edgecolor='black', linewidth=1, linestyle='--')
                ax.add_patch(inner_circle)
        
        elif shape_type == 'polygon':
            vertices = shape_config.get('vertices', [])
            if vertices:
                polygon = MplPolygon(vertices, fill=False, edgecolor='black', linewidth=2)
                ax.add_patch(polygon)
        
        # 绘制孔洞
        modifiers = shape_config.get('modifiers', [])
        for modifier in modifiers:
            if modifier.get('op') == 'subtract':
                mod_shape = modifier.get('shape', 'circle')
                if mod_shape == 'circle':
                    cx = modifier.get('centerX', 0)
                    cy = modifier.get('centerY', 0)
                    r = modifier.get('radius', 0)
                    hole = Circle((cx, cy), r, fill=True, facecolor='white', edgecolor='black', linewidth=1)
                    ax.add_patch(hole)
    
    def get_colorbar_data(self, vmin: float, vmax: float, 
                         colormap: str = None, n_steps: int = 256) -> Dict[str, Any]:
        """
        获取色标数据（用于前端绘制）
        
        Args:
            vmin, vmax: 值范围
            colormap: 色标名称
            n_steps: 色标步数
        
        Returns:
            dict: {"colors": [[r,g,b,a], ...], "values": [...]}
        """
        try:
            values = np.linspace(vmin, vmax, n_steps)
            normalized = np.linspace(0, 1, n_steps)
            
            if MATPLOTLIB_AVAILABLE:
                cmap_name = self.COLORMAPS.get(colormap, self.COLORMAPS[self.DEFAULT_COLORMAP])
                cmap = plt.get_cmap(cmap_name)
                colors = [list(cmap(v)) for v in normalized]
            else:
                # 简化色标
                colors = []
                for v in normalized:
                    if v > 0.5:
                        r = (v - 0.5) * 2
                        g = 1 - (v - 0.5) * 2
                        b = 0
                    else:
                        r = 0
                        g = v * 2
                        b = 1 - v * 2
                    colors.append([r, g, b, 1.0])
            
            return {
                "success": True,
                "colors": colors,
                "values": values.tolist()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": f"获取色标数据失败: {str(e)}"
            }
    
    def needs_full_regeneration(self, new_stats: Dict[str, float], 
                               threshold: float = 0.3) -> bool:
        """
        检查是否需要完全重新生成云图
        
        Args:
            new_stats: 新的统计信息
            threshold: 变化阈值
        
        Returns:
            bool: 是否需要完全重新生成
        """
        if self.last_stats is None:
            return True
        
        old_range = self.last_stats.get('vmax', 0) - self.last_stats.get('vmin', 0)
        new_range = new_stats.get('vmax', 0) - new_stats.get('vmin', 0)
        
        if old_range == 0:
            return True
        
        change_ratio = abs(new_range - old_range) / old_range
        return change_ratio > threshold
    
    def clear_cache(self):
        """清除缓存"""
        self.cache = None
        self.last_stats = None


class ContourCache:
    """云图缓存管理类"""
    
    def __init__(self, max_size: int = 10):
        """
        初始化缓存
        
        Args:
            max_size: 最大缓存数量
        """
        self.max_size = max_size
        self.cache = {}
        self.access_order = []
    
    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """获取缓存"""
        if key in self.cache:
            # 更新访问顺序
            self.access_order.remove(key)
            self.access_order.append(key)
            return self.cache[key]
        return None
    
    def set(self, key: str, value: Dict[str, Any]):
        """设置缓存"""
        if key in self.cache:
            self.access_order.remove(key)
        elif len(self.cache) >= self.max_size:
            # 移除最旧的缓存
            oldest = self.access_order.pop(0)
            del self.cache[oldest]
        
        self.cache[key] = value
        self.access_order.append(key)
    
    def invalidate(self, key: str = None):
        """
        使缓存失效
        
        Args:
            key: 指定key，如果为None则清除所有缓存
        """
        if key is None:
            self.cache.clear()
            self.access_order.clear()
        elif key in self.cache:
            del self.cache[key]
            self.access_order.remove(key)
    
    def generate_key(self, exp_id: str, n_points: int, method: str) -> str:
        """生成缓存key"""
        return f"{exp_id}_{n_points}_{method}"
