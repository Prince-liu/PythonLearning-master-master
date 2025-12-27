"""
应力场测绘模块 - 错误码定义
定义统一的错误码和错误响应格式
"""

from enum import IntEnum
from typing import Dict, Any, Optional
import logging
from datetime import datetime


class ErrorCode(IntEnum):
    """错误码枚举"""
    
    # 成功
    SUCCESS = 0
    
    # 1xxx - 实验管理错误
    EXP_CREATE_FAILED = 1001
    EXP_NOT_FOUND = 1002
    EXP_LOAD_FAILED = 1003
    EXP_DELETE_FAILED = 1004
    EXP_ALREADY_COMPLETED = 1005
    EXP_COMPLETE_FAILED = 1006
    EXP_COMPLETED_READONLY = 1007
    EXP_UPDATE_NO_FIELDS = 1008
    EXP_UPDATE_FAILED = 1009
    EXP_POINT_SAVE_FAILED = 1010
    EXP_POINT_UPDATE_FAILED = 1011
    EXP_METADATA_SAVE_FAILED = 1012
    EXP_HDF5_CREATE_FAILED = 1020
    EXP_NO_CURRENT = 1021
    EXP_GENERAL_ERROR = 1099
    
    # 2xxx - 标定数据错误
    CALIB_DIRECTION_NOT_FOUND = 2001
    CALIB_NO_FIT_RESULT = 2002
    CALIB_SLOPE_ZERO = 2003
    CALIB_FILE_NOT_FOUND = 2010
    CALIB_FILE_EMPTY = 2011
    CALIB_FILE_FORMAT_UNSUPPORTED = 2012
    CALIB_NO_VALID_K = 2013
    CALIB_GENERAL_ERROR = 2099
    
    # 3xxx - 形状配置错误
    SHAPE_VALIDATION_FAILED = 3001
    SHAPE_TYPE_UNSUPPORTED = 3002
    SHAPE_AREA_INVALID = 3003
    SHAPE_SELF_INTERSECT = 3004
    SHAPE_GENERAL_ERROR = 3099
    
    # 4xxx - 数据采集错误
    CAPTURE_NO_EXPERIMENT = 4001
    CAPTURE_NO_CALIBRATION = 4002
    CAPTURE_POINT_NOT_FOUND = 4003
    CAPTURE_WAVEFORM_FAILED = 4004
    CAPTURE_BASELINE_LOAD_FAILED = 4010
    CAPTURE_BASELINE_QUALITY_POOR = 4011
    CAPTURE_HDF5_NOT_INITIALIZED = 4020
    CAPTURE_HDF5_NOT_FOUND = 4021
    CAPTURE_NO_BASELINE = 4022
    CAPTURE_GENERAL_ERROR = 4099
    
    # 5xxx - 数据导出错误
    EXPORT_CSV_FAILED = 5001
    EXPORT_EXCEL_NOT_INSTALLED = 5010
    EXPORT_EXCEL_FAILED = 5011
    EXPORT_HDF5_FAILED = 5021
    EXPORT_CONTOUR_FAILED = 5031
    EXPORT_GENERAL_ERROR = 5099
    
    # 6xxx - 插值和云图错误
    INTERP_NO_POINTS = 6001
    INTERP_FAILED = 6002
    CONTOUR_GENERATE_FAILED = 6010
    CONTOUR_EXPORT_FAILED = 6011
    CONTOUR_GENERAL_ERROR = 6099
    
    # 7xxx - 通信错误
    COMM_OSCILLOSCOPE_NOT_CONNECTED = 7001
    COMM_OSCILLOSCOPE_TIMEOUT = 7002
    COMM_OSCILLOSCOPE_ERROR = 7003
    COMM_RETRY_EXHAUSTED = 7004
    COMM_GENERAL_ERROR = 7099
    
    # 8xxx - 数据验证错误
    VALID_STRESS_OUT_OF_RANGE = 8001
    VALID_TIME_DIFF_OUT_OF_RANGE = 8002
    VALID_POINT_DISCONTINUITY = 8003
    VALID_CONFIG_INVALID = 8004
    VALID_GENERAL_ERROR = 8099
    
    # 9xxx - 系统错误
    SYS_FILE_NOT_FOUND = 9001
    SYS_PERMISSION_DENIED = 9002
    SYS_DATABASE_ERROR = 9003
    SYS_GENERAL_ERROR = 9099


# 错误消息映射
ERROR_MESSAGES = {
    ErrorCode.SUCCESS: "操作成功",
    
    # 实验管理
    ErrorCode.EXP_CREATE_FAILED: "创建实验失败",
    ErrorCode.EXP_NOT_FOUND: "实验不存在",
    ErrorCode.EXP_LOAD_FAILED: "加载实验失败",
    ErrorCode.EXP_DELETE_FAILED: "删除实验失败",
    ErrorCode.EXP_ALREADY_COMPLETED: "实验已完成，无法重复完成",
    ErrorCode.EXP_COMPLETE_FAILED: "完成实验失败",
    ErrorCode.EXP_COMPLETED_READONLY: "实验已完成，无法修改",
    ErrorCode.EXP_UPDATE_NO_FIELDS: "没有有效的更新字段",
    ErrorCode.EXP_UPDATE_FAILED: "更新实验失败",
    ErrorCode.EXP_POINT_SAVE_FAILED: "保存测点布局失败",
    ErrorCode.EXP_POINT_UPDATE_FAILED: "更新测点失败",
    ErrorCode.EXP_METADATA_SAVE_FAILED: "保存云图元数据失败",
    ErrorCode.EXP_HDF5_CREATE_FAILED: "创建HDF5文件失败",
    ErrorCode.EXP_NO_CURRENT: "没有当前实验",
    ErrorCode.EXP_GENERAL_ERROR: "实验管理错误",
    
    # 标定数据
    ErrorCode.CALIB_DIRECTION_NOT_FOUND: "未找到指定方向的标定数据",
    ErrorCode.CALIB_NO_FIT_RESULT: "该方向没有拟合结果",
    ErrorCode.CALIB_SLOPE_ZERO: "斜率为零，无法计算应力系数",
    ErrorCode.CALIB_FILE_NOT_FOUND: "标定文件不存在",
    ErrorCode.CALIB_FILE_EMPTY: "标定文件为空",
    ErrorCode.CALIB_FILE_FORMAT_UNSUPPORTED: "不支持的文件格式",
    ErrorCode.CALIB_NO_VALID_K: "文件中没有有效的应力系数",
    ErrorCode.CALIB_GENERAL_ERROR: "标定数据错误",
    
    # 形状配置
    ErrorCode.SHAPE_VALIDATION_FAILED: "形状验证失败",
    ErrorCode.SHAPE_TYPE_UNSUPPORTED: "不支持的形状类型",
    ErrorCode.SHAPE_AREA_INVALID: "形状面积无效",
    ErrorCode.SHAPE_SELF_INTERSECT: "多边形存在自相交",
    ErrorCode.SHAPE_GENERAL_ERROR: "形状配置错误",
    
    # 数据采集
    ErrorCode.CAPTURE_NO_EXPERIMENT: "没有设置当前实验",
    ErrorCode.CAPTURE_NO_CALIBRATION: "没有加载标定数据",
    ErrorCode.CAPTURE_POINT_NOT_FOUND: "测点不存在",
    ErrorCode.CAPTURE_WAVEFORM_FAILED: "波形采集失败",
    ErrorCode.CAPTURE_BASELINE_LOAD_FAILED: "无法加载基准波形",
    ErrorCode.CAPTURE_BASELINE_QUALITY_POOR: "基准波形质量较差",
    ErrorCode.CAPTURE_HDF5_NOT_INITIALIZED: "HDF5文件未初始化",
    ErrorCode.CAPTURE_HDF5_NOT_FOUND: "HDF5文件不存在",
    ErrorCode.CAPTURE_NO_BASELINE: "请先采集基准点",
    ErrorCode.CAPTURE_GENERAL_ERROR: "数据采集错误",
    
    # 数据导出
    ErrorCode.EXPORT_CSV_FAILED: "CSV导出失败",
    ErrorCode.EXPORT_EXCEL_NOT_INSTALLED: "openpyxl库未安装，无法导出Excel",
    ErrorCode.EXPORT_EXCEL_FAILED: "Excel导出失败",
    ErrorCode.EXPORT_HDF5_FAILED: "HDF5导出失败",
    ErrorCode.EXPORT_CONTOUR_FAILED: "云图导出失败",
    ErrorCode.EXPORT_GENERAL_ERROR: "数据导出错误",
    
    # 插值和云图
    ErrorCode.INTERP_NO_POINTS: "没有有效的测点数据",
    ErrorCode.INTERP_FAILED: "插值失败",
    ErrorCode.CONTOUR_GENERATE_FAILED: "云图生成失败",
    ErrorCode.CONTOUR_EXPORT_FAILED: "云图导出失败",
    ErrorCode.CONTOUR_GENERAL_ERROR: "云图错误",
    
    # 通信错误
    ErrorCode.COMM_OSCILLOSCOPE_NOT_CONNECTED: "示波器未连接",
    ErrorCode.COMM_OSCILLOSCOPE_TIMEOUT: "示波器通信超时",
    ErrorCode.COMM_OSCILLOSCOPE_ERROR: "示波器通信错误",
    ErrorCode.COMM_RETRY_EXHAUSTED: "重试次数已用尽",
    ErrorCode.COMM_GENERAL_ERROR: "通信错误",
    
    # 数据验证
    ErrorCode.VALID_STRESS_OUT_OF_RANGE: "应力值超出正常范围",
    ErrorCode.VALID_TIME_DIFF_OUT_OF_RANGE: "时间差超出正常范围",
    ErrorCode.VALID_POINT_DISCONTINUITY: "测点数据不连续",
    ErrorCode.VALID_CONFIG_INVALID: "配置无效",
    ErrorCode.VALID_GENERAL_ERROR: "数据验证错误",
    
    # 系统错误
    ErrorCode.SYS_FILE_NOT_FOUND: "文件不存在",
    ErrorCode.SYS_PERMISSION_DENIED: "权限不足",
    ErrorCode.SYS_DATABASE_ERROR: "数据库错误",
    ErrorCode.SYS_GENERAL_ERROR: "系统错误",
}


class APIResponse:
    """统一的API响应格式"""
    
    @staticmethod
    def success(data: Any = None, message: str = "操作成功") -> Dict[str, Any]:
        """成功响应
        
        Args:
            data: 返回数据
            message: 成功消息
        
        Returns:
            dict: {"success": True, "error_code": 0, "message": str, "data": any}
        """
        return {
            "success": True,
            "error_code": ErrorCode.SUCCESS,
            "message": message,
            "data": data
        }
    
    @staticmethod
    def error(error_code: ErrorCode, message: str = None, 
              details: str = None) -> Dict[str, Any]:
        """错误响应
        
        Args:
            error_code: 错误码
            message: 错误消息 (可选，默认使用预定义消息)
            details: 详细错误信息
        
        Returns:
            dict: {"success": False, "error_code": int, "message": str, "details": str}
        """
        if message is None:
            message = ERROR_MESSAGES.get(error_code, "未知错误")
        
        response = {
            "success": False,
            "error_code": int(error_code),
            "message": message
        }
        
        if details:
            response["details"] = details
        
        return response
    
    @staticmethod
    def from_exception(e: Exception, error_code: ErrorCode = None) -> Dict[str, Any]:
        """从异常创建错误响应
        
        Args:
            e: 异常对象
            error_code: 错误码 (可选)
        
        Returns:
            dict: 错误响应
        """
        if error_code is None:
            error_code = ErrorCode.SYS_GENERAL_ERROR
        
        return APIResponse.error(
            error_code,
            details=str(e)
        )


class FieldLogger:
    """应力场测绘模块日志记录器"""
    
    _instance = None
    _logger = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._setup_logger()
        return cls._instance
    
    @classmethod
    def _setup_logger(cls):
        """设置日志记录器"""
        cls._logger = logging.getLogger('stress_field_mapping')
        cls._logger.setLevel(logging.DEBUG)
        
        # 文件处理器
        import os
        log_dir = 'data/logs'
        os.makedirs(log_dir, exist_ok=True)
        
        log_file = os.path.join(log_dir, 'stress_field.log')
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        
        # 格式化器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        
        cls._logger.addHandler(file_handler)
    
    @classmethod
    def info(cls, message: str, **kwargs):
        """记录信息日志"""
        if cls._logger:
            cls._logger.info(message, **kwargs)
    
    @classmethod
    def warning(cls, message: str, **kwargs):
        """记录警告日志"""
        if cls._logger:
            cls._logger.warning(message, **kwargs)
    
    @classmethod
    def error(cls, message: str, error_code: ErrorCode = None, **kwargs):
        """记录错误日志"""
        if cls._logger:
            if error_code:
                message = f"[{error_code.name}] {message}"
            cls._logger.error(message, **kwargs)
    
    @classmethod
    def debug(cls, message: str, **kwargs):
        """记录调试日志"""
        if cls._logger:
            cls._logger.debug(message, **kwargs)
    
    @classmethod
    def log_api_call(cls, api_name: str, params: Dict = None, result: Dict = None):
        """记录API调用"""
        if cls._logger:
            timestamp = datetime.now().isoformat()
            log_entry = f"API: {api_name}"
            if params:
                log_entry += f" | Params: {params}"
            if result:
                success = result.get('success', False)
                error_code = result.get('error_code', 0)
                log_entry += f" | Success: {success}, Code: {error_code}"
            cls._logger.info(log_entry)
