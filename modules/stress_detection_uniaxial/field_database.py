"""
应力场测绘模块 - 数据库管理
负责field_experiments、field_points、field_metadata、schema_version表的创建和管理
"""

import sqlite3
import os
import json
from datetime import datetime
from typing import Optional, Dict, List, Any


class FieldDatabaseManager:
    """应力场实验数据库管理类"""
    
    # 当前数据库版本
    CURRENT_VERSION = 1
    
    def __init__(self, db_path: str = 'data/experiments.db'):
        """
        初始化数据库连接
        
        Args:
            db_path: 数据库文件路径
        """
        # 确保data目录存在
        os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else 'data', exist_ok=True)
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row  # 支持字典式访问
        
        # 初始化数据库表
        self._init_tables()
        
        # 检查并执行数据库迁移
        self._check_and_migrate()
    
    def _init_tables(self):
        """创建应力场测绘相关的数据库表"""
        cursor = self.conn.cursor()
        
        # 1. schema_version表 - 数据库版本控制
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL,
                description TEXT,
                migration_script TEXT
            )
        ''')
        
        # 2. field_experiments表 - 应力场实验元数据
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS field_experiments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                calibration_exp_id TEXT,
                calibration_direction TEXT,
                stress_direction TEXT,
                shape_config TEXT NOT NULL DEFAULT '{}',
                point_layout TEXT NOT NULL DEFAULT '[]',
                baseline_point_id INTEGER,
                baseline_stress REAL,
                status TEXT DEFAULT 'planning',
                created_at TEXT,
                completed_at TEXT,
                notes TEXT,
                config_snapshot TEXT,
                operator TEXT,
                temperature REAL,
                humidity REAL,
                scope_model TEXT,
                probe_model TEXT,
                sample_material TEXT,
                sample_thickness REAL,
                test_purpose TEXT
            )
        ''')
        
        # 3. field_points表 - 测点数据
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS field_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                experiment_id TEXT NOT NULL,
                point_index INTEGER NOT NULL,
                x_coord REAL NOT NULL,
                y_coord REAL NOT NULL,
                r_coord REAL,
                theta_coord REAL,
                time_diff REAL,
                stress_value REAL,
                status TEXT DEFAULT 'pending',
                measured_at TEXT,
                waveform_file TEXT,
                quality_score REAL,
                snr REAL,
                is_suspicious INTEGER DEFAULT 0,
                skip_reason TEXT,
                FOREIGN KEY (experiment_id) REFERENCES field_experiments(id) ON DELETE CASCADE
            )
        ''')
        
        # 为field_points创建索引
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_field_points_exp 
            ON field_points(experiment_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_field_points_status 
            ON field_points(experiment_id, status)
        ''')
        
        # 4. field_metadata表 - 云图元数据
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS field_metadata (
                experiment_id TEXT PRIMARY KEY,
                interpolation_method TEXT,
                grid_resolution INTEGER,
                colormap TEXT DEFAULT 'jet',
                vmin REAL,
                vmax REAL,
                contour_image_path TEXT,
                statistics TEXT,
                last_updated TEXT,
                FOREIGN KEY (experiment_id) REFERENCES field_experiments(id) ON DELETE CASCADE
            )
        ''')
        
        self.conn.commit()
    
    def _check_and_migrate(self):
        """检查数据库版本并执行必要的迁移"""
        cursor = self.conn.cursor()
        
        # 获取当前数据库版本
        cursor.execute('SELECT MAX(version) FROM schema_version')
        result = cursor.fetchone()
        current_db_version = result[0] if result[0] else 0
        
        # 如果是新数据库，插入初始版本记录
        if current_db_version == 0:
            cursor.execute('''
                INSERT INTO schema_version (version, applied_at, description)
                VALUES (?, ?, ?)
            ''', (1, datetime.now().isoformat(), '初始版本 - 创建应力场测绘表'))
            self.conn.commit()
            current_db_version = 1
        
        # 检查并修复缺失的列（兼容旧数据库）
        self._ensure_columns_exist()
        
        # 执行待处理的迁移
        if current_db_version < self.CURRENT_VERSION:
            self._run_migrations(current_db_version)
    
    def _ensure_columns_exist(self):
        """确保所有必需的列都存在（用于兼容旧数据库）"""
        cursor = self.conn.cursor()
        
        try:
            # 检查 field_experiments 表的列
            cursor.execute('PRAGMA table_info(field_experiments)')
            existing_columns = {row[1] for row in cursor.fetchall()}
            
            # 需要的列及其定义
            required_columns = {
                'stress_direction': 'TEXT',
                'calibration_exp_id': 'TEXT',
                'calibration_direction': 'TEXT',
                'calibration_k': 'REAL',  # 标定系数 (MPa/ns)
                'test_purpose': 'TEXT',
                'operator': 'TEXT',
                'temperature': 'REAL',
                'humidity': 'REAL',
                'scope_model': 'TEXT',
                'probe_model': 'TEXT',
                'sample_material': 'TEXT',
                'sample_thickness': 'REAL',
                'config_snapshot': 'TEXT'
            }
            
            # 添加缺失的列
            for col_name, col_type in required_columns.items():
                if col_name not in existing_columns:
                    cursor.execute(f'ALTER TABLE field_experiments ADD COLUMN {col_name} {col_type}')
            
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
    
    def _run_migrations(self, from_version: int):
        """
        执行数据库迁移
        
        Args:
            from_version: 当前数据库版本
        """
        migrations = {
            # 版本2的迁移脚本示例（未来使用）
            # 2: self._migrate_to_v2,
        }
        
        for version in range(from_version + 1, self.CURRENT_VERSION + 1):
            if version in migrations:
                try:
                    migrations[version]()
                    cursor = self.conn.cursor()
                    cursor.execute('''
                        INSERT INTO schema_version (version, applied_at, description)
                        VALUES (?, ?, ?)
                    ''', (version, datetime.now().isoformat(), f'迁移到版本 {version}'))
                    self.conn.commit()
                except Exception as e:
                    self.conn.rollback()
                    raise RuntimeError(f"数据库迁移到版本 {version} 失败: {str(e)}")
    
    def get_db_version(self) -> int:
        """获取当前数据库版本"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT MAX(version) FROM schema_version')
        result = cursor.fetchone()
        return result[0] if result[0] else 0
    
    # ==================== 实验管理 ====================
    
    def generate_experiment_id(self) -> str:
        """
        生成唯一的实验ID (FIELD001, FIELD002, ...)
        
        Returns:
            str: 新的实验ID
        """
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id FROM field_experiments 
            WHERE id LIKE 'FIELD%' 
            ORDER BY id DESC 
            LIMIT 1
        ''')
        result = cursor.fetchone()
        
        if result:
            # 提取数字部分并加1
            last_id = result[0]
            num = int(last_id.replace('FIELD', ''))
            new_num = num + 1
        else:
            new_num = 1
        
        return f'FIELD{new_num:03d}'
    
    def create_experiment(self, experiment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新的应力场实验
        
        Args:
            experiment_data: 实验数据字典，包含:
                - name: 实验名称
                - stress_direction: 应力方向 (必填)
                - test_purpose: 实验目的 (可选)
                - sample_material: 试件材料 (可选)
                - sample_thickness: 试件厚度 (可选)
                - operator: 操作员 (可选)
                - notes: 备注 (可选)
        
        Returns:
            dict: {"success": bool, "error_code": int, "message": str, "data": {...}}
        """
        try:
            exp_id = self.generate_experiment_id()
            created_at = datetime.now().isoformat()
            
            # 验证必填字段
            stress_direction = experiment_data.get('stress_direction', '').strip()
            if not stress_direction:
                return {
                    "success": False,
                    "error_code": 1014,
                    "message": "应力方向不能为空",
                    "data": None
                }
            
            cursor = self.conn.cursor()
            cursor.execute('''
                INSERT INTO field_experiments (
                    id, name, stress_direction, status, created_at, 
                    test_purpose, sample_material, sample_thickness, 
                    operator, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                exp_id,
                experiment_data.get('name', f'实验 {exp_id}'),
                stress_direction,
                'planning',
                created_at,
                experiment_data.get('test_purpose', ''),
                experiment_data.get('sample_material', ''),
                experiment_data.get('sample_thickness'),
                experiment_data.get('operator', ''),
                experiment_data.get('notes', '')
            ))
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": "实验创建成功",
                "data": {
                    "exp_id": exp_id,
                    "created_at": created_at
                }
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1001,
                "message": f"创建实验失败: {str(e)}",
                "data": None
            }
    
    def load_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        加载实验数据
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 实验完整数据
        """
        try:
            cursor = self.conn.cursor()
            
            # 获取实验基本信息
            cursor.execute('SELECT * FROM field_experiments WHERE id = ?', (exp_id,))
            exp_row = cursor.fetchone()
            
            if not exp_row:
                return {
                    "success": False,
                    "error_code": 1002,
                    "message": f"实验 {exp_id} 不存在",
                    "data": None
                }
            
            # 转换为字典
            exp_data = dict(exp_row)
            
            # 添加 experiment_id 字段（与 get_experiment_list 保持一致）
            exp_data['experiment_id'] = exp_data['id']
            
            # 解析JSON字段
            exp_data['shape_config'] = json.loads(exp_data['shape_config']) if exp_data['shape_config'] else {}
            exp_data['point_layout'] = json.loads(exp_data['point_layout']) if exp_data['point_layout'] else []
            exp_data['config_snapshot'] = json.loads(exp_data['config_snapshot']) if exp_data['config_snapshot'] else {}
            
            # 获取测点数据
            cursor.execute('''
                SELECT * FROM field_points 
                WHERE experiment_id = ? 
                ORDER BY point_index
            ''', (exp_id,))
            points = [dict(row) for row in cursor.fetchall()]
            
            # 获取云图元数据
            cursor.execute('SELECT * FROM field_metadata WHERE experiment_id = ?', (exp_id,))
            metadata_row = cursor.fetchone()
            metadata = dict(metadata_row) if metadata_row else None
            if metadata and metadata.get('statistics'):
                metadata['statistics'] = json.loads(metadata['statistics'])
            
            return {
                "success": True,
                "error_code": 0,
                "message": "加载成功",
                "data": {
                    "experiment": exp_data,
                    "points": points,
                    "metadata": metadata
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error_code": 1003,
                "message": f"加载实验失败: {str(e)}",
                "data": None
            }
    
    def delete_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        删除实验（SQLite记录，HDF5文件由调用者处理）
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验是否存在
            cursor.execute('SELECT id FROM field_experiments WHERE id = ?', (exp_id,))
            if not cursor.fetchone():
                return {
                    "success": False,
                    "error_code": 1002,
                    "message": f"实验 {exp_id} 不存在",
                    "data": None
                }
            
            # 删除相关数据（由于设置了ON DELETE CASCADE，会自动删除关联数据）
            cursor.execute('DELETE FROM field_metadata WHERE experiment_id = ?', (exp_id,))
            cursor.execute('DELETE FROM field_points WHERE experiment_id = ?', (exp_id,))
            cursor.execute('DELETE FROM field_experiments WHERE id = ?', (exp_id,))
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": f"实验 {exp_id} 已删除"
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1004,
                "message": f"删除实验失败: {str(e)}"
            }
    
    def complete_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        完成实验（标记为completed状态）
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验状态
            cursor.execute('SELECT status FROM field_experiments WHERE id = ?', (exp_id,))
            result = cursor.fetchone()
            
            if not result:
                return {
                    "success": False,
                    "error_code": 1002,
                    "message": f"实验 {exp_id} 不存在"
                }
            
            if result[0] == 'completed':
                return {
                    "success": False,
                    "error_code": 1005,
                    "message": "实验已经完成，无法重复完成"
                }
            
            # 更新状态
            completed_at = datetime.now().isoformat()
            cursor.execute('''
                UPDATE field_experiments 
                SET status = 'completed', completed_at = ?
                WHERE id = ?
            ''', (completed_at, exp_id))
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": "实验已完成"
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1006,
                "message": f"完成实验失败: {str(e)}"
            }
    
    def reset_experiment(self, exp_id: str) -> Dict[str, Any]:
        """
        重置实验（清空所有测点数据，状态恢复为planning）
        
        Args:
            exp_id: 实验ID
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验是否存在
            cursor.execute('SELECT id, status FROM field_experiments WHERE id = ?', (exp_id,))
            result = cursor.fetchone()
            
            if not result:
                return {
                    "success": False,
                    "error_code": 1002,
                    "message": f"实验 {exp_id} 不存在"
                }
            
            # 重置所有测点状态和数据
            cursor.execute('''
                UPDATE field_points 
                SET status = 'pending',
                    time_diff = NULL,
                    stress_value = NULL,
                    measured_at = NULL,
                    waveform_file = NULL,
                    quality_score = NULL,
                    snr = NULL,
                    is_suspicious = 0,
                    skip_reason = NULL
                WHERE experiment_id = ?
            ''', (exp_id,))
            
            # 重置实验状态
            cursor.execute('''
                UPDATE field_experiments 
                SET status = 'planning',
                    baseline_point_id = NULL,
                    baseline_stress = NULL,
                    completed_at = NULL
                WHERE id = ?
            ''', (exp_id,))
            
            # 清空云图元数据
            cursor.execute('''
                DELETE FROM field_metadata WHERE experiment_id = ?
            ''', (exp_id,))
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": "实验已重置"
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1013,
                "message": f"重置实验失败: {str(e)}"
            }
    
    def update_experiment(self, exp_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        更新实验数据
        
        Args:
            exp_id: 实验ID
            updates: 要更新的字段字典
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验状态
            cursor.execute('SELECT status FROM field_experiments WHERE id = ?', (exp_id,))
            result = cursor.fetchone()
            
            if not result:
                return {
                    "success": False,
                    "error_code": 1002,
                    "message": f"实验 {exp_id} 不存在"
                }
            
            # 完成的实验只允许更新基准点相关字段（用于重新分析）
            if result[0] == 'completed':
                allowed_for_completed = {'baseline_point_id', 'baseline_stress'}
                update_keys = set(updates.keys())
                if not update_keys.issubset(allowed_for_completed):
                    return {
                        "success": False,
                        "error_code": 1007,
                        "message": "实验已完成，只能修改基准点设置"
                    }
            
            # 构建更新语句
            allowed_fields = [
                'name', 'calibration_exp_id', 'calibration_direction', 'calibration_k',
                'stress_direction', 'shape_config', 'point_layout', 'baseline_point_id',
                'baseline_stress', 'status', 'notes', 'config_snapshot',
                'operator', 'temperature', 'humidity', 'scope_model',
                'probe_model', 'sample_material', 'sample_thickness', 'test_purpose'
            ]
            
            set_clauses = []
            values = []
            
            for field, value in updates.items():
                if field in allowed_fields:
                    # JSON字段需要序列化
                    if field in ['shape_config', 'point_layout', 'config_snapshot']:
                        value = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else value
                    set_clauses.append(f'{field} = ?')
                    values.append(value)
            
            if not set_clauses:
                return {
                    "success": False,
                    "error_code": 1008,
                    "message": "没有有效的更新字段"
                }
            
            values.append(exp_id)
            sql = f"UPDATE field_experiments SET {', '.join(set_clauses)} WHERE id = ?"
            cursor.execute(sql, values)
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": "更新成功"
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1009,
                "message": f"更新实验失败: {str(e)}"
            }
    
    def get_experiment_list(self) -> List[Dict[str, Any]]:
        """
        获取所有应力场实验列表
        
        Returns:
            list: 实验列表
        """
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT id, name, status, created_at, completed_at, 
                   sample_material, test_purpose
            FROM field_experiments
            ORDER BY created_at DESC
        ''')
        
        experiments = []
        for row in cursor.fetchall():
            exp = dict(row)
            
            # 添加 experiment_id 字段（前端使用）
            exp['experiment_id'] = exp['id']
            
            # 统计测点数
            cursor.execute('''
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN status = 'measured' THEN 1 ELSE 0 END) as measured
                FROM field_points
                WHERE experiment_id = ?
            ''', (exp['id'],))
            stats = cursor.fetchone()
            exp['total_points'] = stats['total'] or 0
            exp['measured_points'] = stats['measured'] or 0
            
            experiments.append(exp)
        
        return experiments
    
    # ==================== 测点管理 ====================
    
    def save_point_layout(self, exp_id: str, points: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        保存测点布局
        
        Args:
            exp_id: 实验ID
            points: 测点列表，每个测点包含 {x, y, r, theta} (r和theta可选)
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验状态
            cursor.execute('SELECT status FROM field_experiments WHERE id = ?', (exp_id,))
            result = cursor.fetchone()
            
            if not result:
                return {"success": False, "error_code": 1002, "message": f"实验 {exp_id} 不存在"}
            
            if result[0] == 'completed':
                return {"success": False, "error_code": 1007, "message": "实验已完成，无法修改"}
            
            # 删除旧的测点数据
            cursor.execute('DELETE FROM field_points WHERE experiment_id = ?', (exp_id,))
            
            # 插入新的测点
            for idx, point in enumerate(points):
                cursor.execute('''
                    INSERT INTO field_points (
                        experiment_id, point_index, x_coord, y_coord, 
                        r_coord, theta_coord, status
                    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
                ''', (
                    exp_id,
                    idx + 1,
                    point.get('x', 0),
                    point.get('y', 0),
                    point.get('r'),
                    point.get('theta')
                ))
            
            # 更新实验的point_layout字段
            cursor.execute('''
                UPDATE field_experiments 
                SET point_layout = ?
                WHERE id = ?
            ''', (json.dumps(points, ensure_ascii=False), exp_id))
            
            self.conn.commit()
            
            return {
                "success": True,
                "error_code": 0,
                "message": f"已保存 {len(points)} 个测点",
                "data": {"point_count": len(points)}
            }
        except Exception as e:
            self.conn.rollback()
            return {
                "success": False,
                "error_code": 1010,
                "message": f"保存测点布局失败: {str(e)}"
            }
    
    def update_point(self, exp_id: str, point_index: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        更新单个测点数据
        
        Args:
            exp_id: 实验ID
            point_index: 测点索引
            updates: 要更新的字段
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 检查实验状态
            cursor.execute('SELECT status FROM field_experiments WHERE id = ?', (exp_id,))
            result = cursor.fetchone()
            
            if not result:
                return {"success": False, "error_code": 1002, "message": f"实验 {exp_id} 不存在"}
            
            # 完成的实验只允许更新应力相关字段（用于重新计算）
            if result[0] == 'completed':
                allowed_for_completed = {'time_diff', 'stress_value'}
                update_keys = set(updates.keys())
                if not update_keys.issubset(allowed_for_completed):
                    return {"success": False, "error_code": 1007, "message": "实验已完成，只能更新应力值"}
            
            # 构建更新语句
            allowed_fields = [
                'time_diff', 'stress_value', 'status', 'measured_at',
                'waveform_file', 'quality_score', 'snr', 'is_suspicious', 'skip_reason'
            ]
            
            set_clauses = []
            values = []
            
            for field, value in updates.items():
                if field in allowed_fields:
                    set_clauses.append(f'{field} = ?')
                    values.append(value)
            
            if not set_clauses:
                return {"success": False, "error_code": 1008, "message": "没有有效的更新字段"}
            
            values.extend([exp_id, point_index])
            sql = f"UPDATE field_points SET {', '.join(set_clauses)} WHERE experiment_id = ? AND point_index = ?"
            cursor.execute(sql, values)
            
            self.conn.commit()
            
            return {"success": True, "error_code": 0, "message": "测点更新成功"}
        except Exception as e:
            self.conn.rollback()
            return {"success": False, "error_code": 1011, "message": f"更新测点失败: {str(e)}"}
    
    def get_point(self, exp_id: str, point_index: int) -> Optional[Dict[str, Any]]:
        """获取单个测点数据"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM field_points 
            WHERE experiment_id = ? AND point_index = ?
        ''', (exp_id, point_index))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_measured_points(self, exp_id: str) -> List[Dict[str, Any]]:
        """获取所有已测量的测点"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM field_points 
            WHERE experiment_id = ? AND status = 'measured'
            ORDER BY point_index
        ''', (exp_id,))
        return [dict(row) for row in cursor.fetchall()]
    
    # ==================== 云图元数据 ====================
    
    def save_contour_metadata(self, exp_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        保存云图元数据
        
        Args:
            exp_id: 实验ID
            metadata: 元数据字典
        
        Returns:
            dict: 操作结果
        """
        try:
            cursor = self.conn.cursor()
            
            # 序列化statistics字段
            statistics = metadata.get('statistics')
            if isinstance(statistics, dict):
                statistics = json.dumps(statistics, ensure_ascii=False)
            
            cursor.execute('''
                INSERT OR REPLACE INTO field_metadata (
                    experiment_id, interpolation_method, grid_resolution,
                    colormap, vmin, vmax, contour_image_path, statistics, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                exp_id,
                metadata.get('interpolation_method'),
                metadata.get('grid_resolution'),
                metadata.get('colormap', 'jet'),
                metadata.get('vmin'),
                metadata.get('vmax'),
                metadata.get('contour_image_path'),
                statistics,
                datetime.now().isoformat()
            ))
            
            self.conn.commit()
            
            return {"success": True, "error_code": 0, "message": "云图元数据已保存"}
        except Exception as e:
            self.conn.rollback()
            return {"success": False, "error_code": 1012, "message": f"保存云图元数据失败: {str(e)}"}
    
    def close(self):
        """关闭数据库连接"""
        if self.conn:
            self.conn.close()
