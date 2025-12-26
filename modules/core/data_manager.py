"""
数据管理模块
负责实验数据的存储和管理（SQLite + HDF5）
"""

import sqlite3
import os
import numpy as np
import h5py
from datetime import datetime


class ExperimentDataManager:
    """实验数据管理类"""
    
    def __init__(self, db_path='data/experiments.db'):
        """初始化数据库连接"""
        # 确保data目录存在
        os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else 'data', exist_ok=True)
        
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._初始化数据库()
        self._清理不完整数据()
    
    def _初始化数据库(self):
        """创建数据库表结构"""
        cursor = self.conn.cursor()
        
        # 实验表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                材料名称 TEXT NOT NULL,
                创建时间 DATETIME DEFAULT CURRENT_TIMESTAMP,
                状态 TEXT DEFAULT 'running'
            )
        ''')
        
        # 测试方向表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_directions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                实验ID INTEGER NOT NULL,
                方向名称 TEXT NOT NULL,
                应力范围起始 REAL DEFAULT 0,
                应力范围结束 REAL DEFAULT 100,
                应力步长 REAL DEFAULT 10,
                基准波形路径 TEXT,
                FOREIGN KEY (实验ID) REFERENCES experiments(id),
                UNIQUE(实验ID, 方向名称)
            )
        ''')
        
        # 应力数据表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stress_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                方向ID INTEGER NOT NULL,
                应力值 REAL NOT NULL,
                时间差 REAL,
                波形路径 TEXT,
                采集时间 DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (方向ID) REFERENCES test_directions(id),
                UNIQUE(方向ID, 应力值)
            )
        ''')
        
        # 拟合结果表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS fitting_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                方向ID INTEGER NOT NULL,
                斜率 REAL,
                截距 REAL,
                R方 REAL,
                计算时间 DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (方向ID) REFERENCES test_directions(id)
            )
        ''')
        
        self.conn.commit()
    
    def _清理不完整数据(self):
        """清理不完整的实验数据（没有基准波形 且 没有应力数据的方向）
        
        修改说明：
        - 旧逻辑：清理"没有基准波形 或 没有应力数据"的方向
        - 新逻辑：只清理"没有基准波形 且 没有应力数据"的方向
        
        这样可以保留：
        - 只有基准波形但还没采集应力数据的方向（用户可能暂停了实验）
        - 有应力数据但基准波形路径丢失的方向（异常情况，保留数据）
        """
        cursor = self.conn.cursor()
        
        # 查找不完整的方向：没有基准波形 且 没有应力数据
        # 只有两者都没有时才清理（说明是空的方向记录）
        cursor.execute('''
            SELECT td.id, td.实验ID 
            FROM test_directions td
            LEFT JOIN stress_data sd ON td.id = sd.方向ID
            WHERE td.基准波形路径 IS NULL 
               AND sd.id IS NULL
            GROUP BY td.id
        ''')
        不完整方向列表 = cursor.fetchall()
        
        for 方向ID, 实验ID in 不完整方向列表:
            # 删除该方向的所有应力数据
            cursor.execute('DELETE FROM stress_data WHERE 方向ID = ?', (方向ID,))
            
            # 删除该方向的拟合结果
            cursor.execute('DELETE FROM fitting_results WHERE 方向ID = ?', (方向ID,))
            
            # 删除该方向
            cursor.execute('DELETE FROM test_directions WHERE id = ?', (方向ID,))
            
            # 检查该实验是否还有其他方向
            cursor.execute('SELECT COUNT(*) FROM test_directions WHERE 实验ID = ?', (实验ID,))
            剩余方向数 = cursor.fetchone()[0]
            
            # 如果没有方向了，删除整个实验
            if 剩余方向数 == 0:
                cursor.execute('DELETE FROM experiments WHERE id = ?', (实验ID,))
        
        self.conn.commit()
        
        if 不完整方向列表:
            print(f"✓ 已清理 {len(不完整方向列表)} 条不完整的实验数据")
    
    def 创建实验(self, 材料名称):
        """创建新实验，返回实验ID"""
        cursor = self.conn.cursor()
        cursor.execute(
            'INSERT INTO experiments (材料名称) VALUES (?)',
            (材料名称,)
        )
        self.conn.commit()
        return cursor.lastrowid
    
    def 添加测试方向(self, 实验ID, 方向名称, 应力范围起始=0, 应力范围结束=100, 应力步长=10):
        """添加测试方向"""
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO test_directions 
                (实验ID, 方向名称, 应力范围起始, 应力范围结束, 应力步长)
                VALUES (?, ?, ?, ?, ?)
            ''', (实验ID, 方向名称, 应力范围起始, 应力范围结束, 应力步长))
            self.conn.commit()
            return {"success": True, "方向ID": cursor.lastrowid}
        except sqlite3.IntegrityError:
            return {"success": False, "message": f"方向'{方向名称}'已存在"}
    
    def 获取方向ID(self, 实验ID, 方向名称):
        """获取方向ID"""
        cursor = self.conn.cursor()
        cursor.execute(
            'SELECT id FROM test_directions WHERE 实验ID=? AND 方向名称=?',
            (实验ID, 方向名称)
        )
        result = cursor.fetchone()
        return result[0] if result else None
    
    def 检查方向是否存在(self, 材料名称, 方向名称):
        """检查指定材料的指定方向是否已存在于数据库中（只检查有基准波形的完整数据）
        
        Args:
            材料名称: 材料名称
            方向名称: 方向名称
        
        Returns:
            {"success": bool, "exists": bool, "message": str}
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) FROM test_directions td
                JOIN experiments e ON td.实验ID = e.id
                WHERE e.材料名称 = ? AND td.方向名称 = ? AND td.基准波形路径 IS NOT NULL
            ''', (材料名称, 方向名称))
            count = cursor.fetchone()[0]
            return {"success": True, "exists": count > 0}
        except Exception as e:
            return {"success": False, "exists": False, "message": f"检查失败: {str(e)}"}
    
    def 保存基准波形(self, 实验ID, 方向名称, 波形数据, 时间轴):
        """保存基准波形到HDF5"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return {"success": False, "message": "方向不存在"}
        
        # 创建文件路径
        文件路径 = f'data/waveforms/EXP{实验ID:03d}/{方向名称}/baseline.h5'
        os.makedirs(os.path.dirname(文件路径), exist_ok=True)
        
        # 保存到HDF5
        with h5py.File(文件路径, 'w') as f:
            f.create_dataset('waveform', data=np.array(波形数据), compression='gzip')
            f.create_dataset('time', data=np.array(时间轴), compression='gzip')
            f.attrs['采集时间'] = datetime.now().isoformat()
        
        # 更新数据库
        cursor = self.conn.cursor()
        cursor.execute(
            'UPDATE test_directions SET 基准波形路径=? WHERE id=?',
            (文件路径, 方向ID)
        )
        self.conn.commit()
        
        return {"success": True, "文件路径": 文件路径}
    
    def 保存应力波形(self, 实验ID, 方向名称, 应力值, 波形数据, 时间轴):
        """保存应力波形到HDF5"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return {"success": False, "message": "方向不存在"}
        
        # 创建文件路径
        文件路径 = f'data/waveforms/EXP{实验ID:03d}/{方向名称}/stress_{应力值:.1f}MPa.h5'
        os.makedirs(os.path.dirname(文件路径), exist_ok=True)
        
        # 保存到HDF5
        with h5py.File(文件路径, 'w') as f:
            f.create_dataset('waveform', data=np.array(波形数据), compression='gzip')
            f.create_dataset('time', data=np.array(时间轴), compression='gzip')
            f.attrs['应力值'] = 应力值
            f.attrs['采集时间'] = datetime.now().isoformat()
        
        # 保存到数据库
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO stress_data (方向ID, 应力值, 波形路径)
            VALUES (?, ?, ?)
        ''', (方向ID, 应力值, 文件路径))
        self.conn.commit()
        
        return {"success": True, "文件路径": 文件路径}
    
    def 更新应力数据时间差(self, 实验ID, 方向名称, 应力值, 时间差):
        """更新应力数据的时间差"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return {"success": False, "message": "方向不存在"}
        
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE stress_data SET 时间差=? 
            WHERE 方向ID=? AND 应力值=?
        ''', (时间差, 方向ID, 应力值))
        self.conn.commit()
        
        return {"success": True}
    
    def 获取基准波形路径(self, 实验ID, 方向名称):
        """获取基准波形路径"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 基准波形路径 FROM test_directions 
            WHERE 实验ID=? AND 方向名称=?
        ''', (实验ID, 方向名称))
        result = cursor.fetchone()
        return result[0] if result and result[0] else None
    
    def 加载波形文件(self, 文件路径):
        """从HDF5加载波形数据"""
        if not os.path.exists(文件路径):
            return None
        
        with h5py.File(文件路径, 'r') as f:
            return {
                'data': f['waveform'][:].tolist(),
                'time': f['time'][:].tolist()
            }
    
    def 获取应力数据列表(self, 实验ID, 方向名称):
        """获取某个方向的所有应力数据"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return []
        
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT 应力值, 时间差, 波形路径, 采集时间
            FROM stress_data
            WHERE 方向ID=?
            ORDER BY 应力值
        ''', (方向ID,))
        
        结果 = []
        for row in cursor.fetchall():
            结果.append({
                '应力值': row[0],
                '时间差': row[1],
                '波形路径': row[2],
                '采集时间': row[3]
            })
        return 结果
    
    def 保存拟合结果(self, 实验ID, 方向名称, 斜率, 截距, R方):
        """保存拟合结果"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return {"success": False, "message": "方向不存在"}
        
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO fitting_results (方向ID, 斜率, 截距, R方)
            VALUES (?, ?, ?, ?)
        ''', (方向ID, 斜率, 截距, R方))
        self.conn.commit()
        
        return {"success": True}
    
    def 删除应力数据点(self, 实验ID, 方向名称, 应力值):
        """删除某个应力数据点"""
        方向ID = self.获取方向ID(实验ID, 方向名称)
        if not 方向ID:
            return {"success": False, "message": "方向不存在"}
        
        cursor = self.conn.cursor()
        cursor.execute('''
            DELETE FROM stress_data 
            WHERE 方向ID=? AND 应力值=?
        ''', (方向ID, 应力值))
        self.conn.commit()
        
        return {"success": True, "message": "数据点已删除"}
    
    def 删除方向(self, 实验ID, 方向ID):
        """
        删除指定方向的数据（包括波形文件）
        如果删除后该实验没有其他方向，自动删除整个实验
        如果数据库完全清空，自动重置ID计数器
        
        参数:
            实验ID: 实验ID
            方向ID: 方向ID
        
        返回:
            dict: {"success": bool, "message": str}
        """
        import shutil
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 获取方向名称（用于删除文件）
            cursor.execute('SELECT 方向名称 FROM test_directions WHERE id = ?', (方向ID,))
            result = cursor.fetchone()
            if not result:
                return {"success": False, "message": "方向不存在"}
            
            方向名称 = result[0]
            
            # 2. 删除波形文件目录
            波形目录 = f'data/waveforms/EXP{实验ID:03d}/{方向名称}'
            if os.path.exists(波形目录):
                shutil.rmtree(波形目录)
            
            # 3. 删除数据库记录（级联删除）
            cursor.execute('DELETE FROM fitting_results WHERE 方向ID = ?', (方向ID,))
            cursor.execute('DELETE FROM stress_data WHERE 方向ID = ?', (方向ID,))
            cursor.execute('DELETE FROM test_directions WHERE id = ?', (方向ID,))
            
            # 4. 检查该实验是否还有其他方向
            cursor.execute('SELECT COUNT(*) FROM test_directions WHERE 实验ID = ?', (实验ID,))
            剩余方向数 = cursor.fetchone()[0]
            
            # 如果没有其他方向了，删除实验记录
            if 剩余方向数 == 0:
                cursor.execute('DELETE FROM experiments WHERE id = ?', (实验ID,))
                
                # 删除实验目录
                实验目录 = f'data/waveforms/EXP{实验ID:03d}'
                if os.path.exists(实验目录):
                    shutil.rmtree(实验目录)
            
            # 5. 检查是否所有实验都被删除了
            cursor.execute('SELECT COUNT(*) FROM experiments')
            剩余实验数 = cursor.fetchone()[0]
            
            消息 = f"方向 {方向名称} 已删除"
            
            # 如果数据库完全清空，重置所有表的AUTOINCREMENT计数器
            if 剩余实验数 == 0:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='experiments'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='test_directions'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='stress_data'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='fitting_results'")
                消息 += "（已重置ID计数器，下次将从EXP001开始）"
            
            # 一次性提交所有更改
            self.conn.commit()
            
            return {"success": True, "message": 消息}
        except Exception as e:
            self.conn.rollback()
            return {"success": False, "message": f"删除失败: {str(e)}"}
    
    def 删除全部数据(self):
        """
        删除所有实验数据（包括所有波形文件）并重置ID计数器
        
        返回:
            dict: {"success": bool, "message": str}
        """
        import shutil
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 删除所有波形文件目录
            波形根目录 = 'data/waveforms'
            if os.path.exists(波形根目录):
                shutil.rmtree(波形根目录)
                os.makedirs(波形根目录, exist_ok=True)
            
            # 2. 删除所有数据库记录
            cursor.execute('DELETE FROM fitting_results')
            cursor.execute('DELETE FROM stress_data')
            cursor.execute('DELETE FROM test_directions')
            cursor.execute('DELETE FROM experiments')
            
            # 3. 重置所有表的AUTOINCREMENT计数器
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='experiments'")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='test_directions'")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='stress_data'")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='fitting_results'")
            
            # 4. 提交所有更改
            self.conn.commit()
            
            return {"success": True, "message": "✅ 所有数据已清空，ID计数器已重置"}
        except Exception as e:
            self.conn.rollback()
            return {"success": False, "message": f"删除失败: {str(e)}"}
    
    def 关闭(self):
        """关闭数据库连接"""
        if self.conn:
            self.conn.close()
    
    def 重置方向(self, 实验ID, 方向名称):
        """
        重置指定方向的实验数据
        
        参数:
            实验ID: 实验ID
            方向名称: 方向名称
            
        返回:
            dict: {"success": bool, "message": str}
        """
        import shutil
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 获取方向ID
            cursor.execute('''
                SELECT id FROM test_directions
                WHERE 实验ID = ? AND 方向名称 = ?
            ''', (实验ID, 方向名称))
            
            result = cursor.fetchone()
            if not result:
                return {"success": False, "message": "未找到该方向"}
            
            方向ID = result[0]
            
            # 2. 删除拟合结果
            cursor.execute('DELETE FROM fitting_results WHERE 方向ID = ?', (方向ID,))
            
            # 3. 删除应力数据
            cursor.execute('DELETE FROM stress_data WHERE 方向ID = ?', (方向ID,))
            
            # 4. 清除基准波形路径
            cursor.execute('''
                UPDATE test_directions
                SET 基准波形路径 = NULL
                WHERE id = ?
            ''', (方向ID,))
            
            # 5. 删除波形文件
            波形目录 = f'data/waveforms/EXP{实验ID:03d}/{方向名称}'
            if os.path.exists(波形目录):
                shutil.rmtree(波形目录)
            
            # 6. 提交更改
            self.conn.commit()
            
            return {"success": True, "message": f"方向 {方向名称} 已重置"}
        except Exception as e:
            self.conn.rollback()
            return {"success": False, "message": f"重置失败: {str(e)}"}
    
    def 导出方向CSV(self, 实验ID, 方向ID):
        """
        导出指定方向的数据为CSV文件
        
        参数:
            实验ID: 实验ID
            方向ID: 方向ID
            
        返回:
            dict: {"success": bool, "message": str, "文件路径": str}
        """
        import csv
        from datetime import datetime
        import webview
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 获取方向信息
            cursor.execute('''
                SELECT e.材料名称, td.方向名称
                FROM test_directions td
                JOIN experiments e ON td.实验ID = e.id
                WHERE e.id = ? AND td.id = ?
            ''', (实验ID, 方向ID))
            
            方向信息 = cursor.fetchone()
            if not 方向信息:
                return {"success": False, "message": "未找到该方向数据"}
            
            材料名称, 方向名称 = 方向信息
            
            # 2. 获取应力数据
            cursor.execute('''
                SELECT 应力值, 时间差
                FROM stress_data
                WHERE 方向ID = ?
                ORDER BY 应力值
            ''', (方向ID,))
            
            应力数据列表 = cursor.fetchall()
            
            # 3. 获取拟合结果
            cursor.execute('''
                SELECT 斜率, 截距, R方
                FROM fitting_results
                WHERE 方向ID = ?
                ORDER BY id DESC
                LIMIT 1
            ''', (方向ID,))
            
            拟合结果 = cursor.fetchone()
            
            # 4. 打开文件保存对话框
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            default_name = f'stress_data_EXP{实验ID:03d}_{方向名称}_{timestamp}.csv'
            
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename=default_name,
                    file_types=('CSV文件 (*.csv)',)
                )
                
                if not 文件路径:
                    return {"success": False, "message": "用户取消"}
                
                if isinstance(文件路径, tuple):
                    文件路径 = 文件路径[0]
            else:
                return {"success": False, "message": "无法打开文件对话框"}
            
            # 5. 写入CSV文件
            with open(文件路径, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入元数据
                writer.writerow(['材料名称', 材料名称])
                writer.writerow(['测试方向', 方向名称])
                导出时间 = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                writer.writerow(['导出时间', 导出时间])
                writer.writerow([])
                
                # 写入表头
                writer.writerow(['应力 (MPa)', '声时差 (ns)'])
                
                # 写入基准点
                writer.writerow([0.0, 0.0])
                
                # 写入应力数据
                for 应力值, 时间差 in 应力数据列表:
                    声时差_ns = 时间差 * 1e9 if 时间差 else 0
                    writer.writerow([应力值, f'{声时差_ns:.3f}'])
                
                # 写入空行
                writer.writerow([])
                
                # 写入拟合结果
                if 拟合结果:
                    斜率, 截距, R方 = 拟合结果
                    writer.writerow(['拟合结果'])
                    if 斜率 is not None:
                        斜率_ns = 斜率 * 1e9
                        writer.writerow(['斜率 (ns/MPa)', f'{斜率_ns:.3f}'])
                    if 截距 is not None:
                        截距_ns = 截距 * 1e9
                        writer.writerow(['截距 (ns)', f'{截距_ns:.3f}'])
                    if R方 is not None:
                        writer.writerow(['拟合优度 R²', f'{R方:.4f}'])
            
            return {"success": True, "message": f"CSV文件已保存", "文件路径": 文件路径}
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}
    
    def 导出全部CSV(self):
        """
        导出所有实验数据为一个CSV文件
        
        返回:
            dict: {"success": bool, "message": str, "文件路径": str}
        """
        import csv
        from datetime import datetime
        import webview
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 获取所有实验和方向
            cursor.execute('''
                SELECT e.id, e.材料名称, td.id, td.方向名称
                FROM experiments e
                JOIN test_directions td ON e.id = td.实验ID
                ORDER BY e.id, td.id
            ''')
            
            所有方向 = cursor.fetchall()
            
            if not 所有方向:
                return {"success": False, "message": "没有可导出的数据"}
            
            # 2. 打开文件保存对话框
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            default_name = f'all_stress_data_{timestamp}.csv'
            
            文档目录 = os.path.expanduser('~/Documents')
            波形目录 = os.path.join(文档目录, 'OscilloscopeWaveforms')
            默认目录 = 波形目录 if os.path.exists(波形目录) else None
            
            if self.window:
                文件路径 = self.window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=默认目录,
                    save_filename=default_name,
                    file_types=('CSV文件 (*.csv)',)
                )
                
                if not 文件路径:
                    return {"success": False, "message": "用户取消"}
                
                if isinstance(文件路径, tuple):
                    文件路径 = 文件路径[0]
            else:
                return {"success": False, "message": "无法打开文件对话框"}
            
            # 3. 写入CSV文件
            with open(文件路径, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                
                # 写入总标题
                导出时间 = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                writer.writerow(['全部实验数据导出'])
                writer.writerow(['导出时间', 导出时间])
                writer.writerow([])
                
                # 遍历每个方向
                for 实验ID, 材料名称, 方向ID, 方向名称 in 所有方向:
                    # 写入方向标题
                    writer.writerow([f'=== EXP{实验ID:03d} - {材料名称} - {方向名称} ==='])
                    writer.writerow([])
                    
                    # 获取应力数据
                    cursor.execute('''
                        SELECT 应力值, 时间差
                        FROM stress_data
                        WHERE 方向ID = ?
                        ORDER BY 应力值
                    ''', (方向ID,))
                    
                    应力数据列表 = cursor.fetchall()
                    
                    # 写入表头
                    writer.writerow(['应力 (MPa)', '声时差 (ns)'])
                    writer.writerow([0.0, 0.0])
                    
                    # 写入数据
                    for 应力值, 时间差 in 应力数据列表:
                        声时差_ns = 时间差 * 1e9 if 时间差 else 0
                        writer.writerow([应力值, f'{声时差_ns:.3f}'])
                    
                    # 获取拟合结果
                    cursor.execute('''
                        SELECT 斜率, 截距, R方
                        FROM fitting_results
                        WHERE 方向ID = ?
                        ORDER BY id DESC
                        LIMIT 1
                    ''', (方向ID,))
                    
                    拟合结果 = cursor.fetchone()
                    
                    # 写入拟合结果
                    writer.writerow([])
                    if 拟合结果:
                        斜率, 截距, R方 = 拟合结果
                        writer.writerow(['拟合结果'])
                        if 斜率 is not None:
                            斜率_ns = 斜率 * 1e9
                            writer.writerow(['斜率 (ns/MPa)', f'{斜率_ns:.3f}'])
                        if 截距 is not None:
                            截距_ns = 截距 * 1e9
                            writer.writerow(['截距 (ns)', f'{截距_ns:.3f}'])
                        if R方 is not None:
                            writer.writerow(['拟合优度 R²', f'{R方:.4f}'])
                    
                    # 方向之间空两行
                    writer.writerow([])
                    writer.writerow([])
            
            return {"success": True, "message": f"CSV文件已保存", "文件路径": 文件路径}
        except Exception as e:
            return {"success": False, "message": f"导出失败: {str(e)}"}

    def 加载实验完整数据(self, 实验ID):
        """
        加载指定实验的完整数据（用于恢复实验状态）
        
        参数:
            实验ID: 要加载的实验ID
        
        返回:
            dict: {
                "实验ID": int,
                "材料名称": str,
                "测试方向列表": [
                    {
                        "方向ID": int,
                        "方向名称": str,
                        "应力范围": [起始, 结束],
                        "应力步长": float,
                        "基准波形路径": str,
                        "应力数据": [{应力值, 时间差, 波形路径}, ...],
                        "拟合结果": {斜率, 截距, R方} or None
                    },
                    ...
                ]
            }
        """
        cursor = self.conn.cursor()
        
        # 获取实验基本信息
        cursor.execute('SELECT 材料名称 FROM experiments WHERE id = ?', (实验ID,))
        row = cursor.fetchone()
        if not row:
            raise ValueError(f"实验ID {实验ID} 不存在")
        
        材料名称 = row[0]
        
        # 获取所有测试方向
        cursor.execute('''
            SELECT id, 方向名称, 应力范围起始, 应力范围结束, 应力步长, 基准波形路径
            FROM test_directions
            WHERE 实验ID = ?
            ORDER BY id
        ''', (实验ID,))
        
        测试方向列表 = []
        for row in cursor.fetchall():
            方向ID, 方向名称, 应力范围起始, 应力范围结束, 应力步长, 基准波形路径 = row
            
            # 获取该方向的所有应力数据
            cursor.execute('''
                SELECT 应力值, 时间差, 波形路径
                FROM stress_data
                WHERE 方向ID = ?
                ORDER BY 应力值
            ''', (方向ID,))
            
            应力数据 = []
            for data_row in cursor.fetchall():
                应力值, 时间差, 波形路径 = data_row
                应力数据.append({
                    '应力值': 应力值,
                    '时间差': 时间差,
                    '波形路径': 波形路径
                })
            
            # 获取拟合结果
            cursor.execute('''
                SELECT 斜率, 截距, R方
                FROM fitting_results
                WHERE 方向ID = ?
                ORDER BY 计算时间 DESC
                LIMIT 1
            ''', (方向ID,))
            
            拟合结果 = None
            fit_row = cursor.fetchone()
            if fit_row:
                拟合结果 = {
                    '斜率': fit_row[0],
                    '截距': fit_row[1],
                    'R方': fit_row[2]
                }
            
            测试方向列表.append({
                '方向ID': 方向ID,
                '方向名称': 方向名称,
                '应力范围': [应力范围起始, 应力范围结束],
                '应力步长': 应力步长,
                '基准波形路径': 基准波形路径,
                '应力数据': 应力数据,
                '拟合结果': 拟合结果
            })
        
        return {
            '实验ID': 实验ID,
            '材料名称': 材料名称,
            '测试方向列表': 测试方向列表
        }
    
    def 获取所有实验列表(self):
        """
        获取所有实验列表（嵌套结构，包含方向和拟合结果）
        
        返回:
            list: 实验列表 [{实验ID, 材料名称, 创建时间, directions: [{方向名称, 拟合结果}]}]
        """
        cursor = self.conn.cursor()
        
        # 获取所有实验
        cursor.execute('''
            SELECT id, 材料名称, 创建时间
            FROM experiments
            ORDER BY 创建时间 DESC
        ''')
        
        实验列表 = []
        for exp_row in cursor.fetchall():
            实验ID, 材料名称, 创建时间 = exp_row
            
            # 获取该实验的所有方向
            cursor.execute('''
                SELECT id, 方向名称, 基准波形路径
                FROM test_directions
                WHERE 实验ID = ?
                ORDER BY id
            ''', (实验ID,))
            
            directions = []
            for dir_row in cursor.fetchall():
                方向ID, 方向名称, 基准波形路径 = dir_row
                
                # 只包含有基准波形的方向
                if not 基准波形路径:
                    continue
                
                # 获取拟合结果
                cursor.execute('''
                    SELECT 斜率, 截距, R方
                    FROM fitting_results
                    WHERE 方向ID = ?
                    ORDER BY 计算时间 DESC
                    LIMIT 1
                ''', (方向ID,))
                
                拟合结果 = None
                fit_row = cursor.fetchone()
                if fit_row:
                    斜率, 截距, R方 = fit_row
                    # 计算应力系数 K (MPa/ns)
                    # 斜率单位是 s/MPa，需要转换为 ns/MPa，然后取倒数得到 MPa/ns
                    k = 1.0 / (斜率 * 1e9) if 斜率 != 0 else 0
                    
                    拟合结果 = {
                        'k': k,  # 应力系数（保留正负号，复合材料可能为负）
                        'slope': 斜率,
                        'intercept': 截距,
                        'r_squared': R方
                    }
                
                directions.append({
                    '方向ID': 方向ID,
                    '方向名称': 方向名称,
                    '拟合结果': 拟合结果
                })
            
            # 只添加有方向数据的实验
            if directions:
                实验列表.append({
                    '实验ID': 实验ID,
                    '材料名称': 材料名称,
                    '创建时间': 创建时间,
                    'directions': directions
                })
        
        return 实验列表
    
    def 获取所有方向列表(self):
        """
        获取所有方向列表（扁平化结构，用于标定模块）
        
        返回:
            list: 方向列表 [{实验ID, 材料名称, 创建时间, 方向ID, 方向名称, 数据点数}]
        """
        cursor = self.conn.cursor()
        
        # 获取所有方向及其实验信息
        cursor.execute('''
            SELECT 
                e.id AS 实验ID,
                e.材料名称,
                e.创建时间,
                d.id AS 方向ID,
                d.方向名称,
                d.基准波形路径
            FROM experiments e
            JOIN test_directions d ON e.id = d.实验ID
            WHERE d.基准波形路径 IS NOT NULL
            ORDER BY e.创建时间 DESC, d.id
        ''')
        
        方向列表 = []
        for row in cursor.fetchall():
            实验ID, 材料名称, 创建时间, 方向ID, 方向名称, 基准波形路径 = row
            
            # 获取该方向的数据点数
            cursor.execute('''
                SELECT COUNT(*) FROM stress_data WHERE 方向ID = ?
            ''', (方向ID,))
            数据点数 = cursor.fetchone()[0]
            
            方向列表.append({
                '实验ID': 实验ID,
                '材料名称': 材料名称,
                '创建时间': 创建时间,
                '方向ID': 方向ID,
                '方向名称': 方向名称,
                '数据点数': 数据点数
            })
        
        return 方向列表
    
    def 删除实验(self, 实验ID):
        """
        删除实验及其所有相关数据（包括波形文件）
        
        参数:
            实验ID: 要删除的实验ID
        
        返回:
            bool: 是否成功删除
        """
        import shutil
        
        cursor = self.conn.cursor()
        
        try:
            # 1. 删除波形文件目录
            波形目录 = f'data/waveforms/EXP{实验ID:03d}'
            if os.path.exists(波形目录):
                shutil.rmtree(波形目录)
            
            # 2. 删除数据库记录（级联删除）
            # 先删除拟合结果
            cursor.execute('''
                DELETE FROM fitting_results 
                WHERE 方向ID IN (
                    SELECT id FROM test_directions WHERE 实验ID = ?
                )
            ''', (实验ID,))
            
            # 删除应力数据
            cursor.execute('''
                DELETE FROM stress_data 
                WHERE 方向ID IN (
                    SELECT id FROM test_directions WHERE 实验ID = ?
                )
            ''', (实验ID,))
            
            # 删除测试方向
            cursor.execute('DELETE FROM test_directions WHERE 实验ID = ?', (实验ID,))
            
            # 删除实验记录
            cursor.execute('DELETE FROM experiments WHERE id = ?', (实验ID,))
            
            # 🆕 检查是否还有其他实验
            cursor.execute('SELECT COUNT(*) FROM experiments')
            剩余实验数 = cursor.fetchone()[0]
            
            # 🆕 如果没有实验了，重置ID序列
            if 剩余实验数 == 0:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='experiments'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='test_directions'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='stress_data'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='fitting_results'")
                print("✅ 已重置ID序列（所有实验已删除）")
            
            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            print(f"删除实验失败: {str(e)}")
            return False
