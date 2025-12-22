# 普源示波器实时波形显示系统

基于 pywebview 的桌面应用，用于实时显示和分析普源（RIGOL）示波器波形数据。

## 核心功能

### 1. 实时采集
- 通过 VISA 协议连接示波器
- 实时显示波形数据（黑色背景，示波器风格）
- 支持远程控制（运行/停止、自动设置）
- 多格式保存（NPY、CSV、HDF5）
- 可调节存储深度、时基、水平/垂直位置、垂直灵敏度

### 2. 波形分析
- 加载已保存的波形文件（NPY、CSV、HDF5）
- 专业白色背景显示
- 交互式工具栏（截图、拖动、框选放大、缩小、适应窗口、重置视图）
- 信号处理功能：
  - **小波降噪**：可配置小波类型、分解层数、阈值方法
  - **Hilbert变换**：显示信号包络线
  - **时间差计算**：支持0点起始和自定义起点，自动检测波峰
  - **互相关分析**：多文件对比，FFT加速计算，智能单位显示（ns/μs/ms）

### 3. 应力系数标定
- 基于互相关算法计算声时差
- 应力-声时差曲线拟合
- 数据导出（HDF5、CSV）
- 支持手动采集和自动实验模式
- 多方向测试支持（可为同一材料添加多个测试方向）
- 实验数据管理（查看和删除历史实验数据，智能ID重置）

### 4. 单轴应力检测
- 加载已标定的应力系数
- 实时监控波形并计算应力值
- 基于互相关算法的声时差计算
- 自动应用标定系数计算应力
- 记录和导出检测数据（CSV格式）

### 5. 应力场测绘 ⭐
完整的二维应力分布测量解决方案：

- **试件形状定义**：支持矩形、圆形、多边形，支持布尔运算（挖孔）
- **智能测点布局**：
  - 网格布点（均匀/变间距，可设置边距）
  - 极坐标布点（圆心自动判断，支持多层多点）
  - 自定义布点（CSV导入）
  - 路径优化（之字形/最近邻/螺旋）
- **自动数据采集**：多点顺序采集，实时进度显示，质量检查
- **空间插值**：IDW、Kriging、RBF 三种插值算法
- **应力云图**：彩色等高线可视化，可调色阶，支持导出图片
- **实验管理**：创建、加载、删除、导出实验数据

## 技术栈

### 后端
- **Python 3.x** - 主要编程语言
- **pywebview** - 桌面应用框架
- **pyvisa** - VISA 通信协议
- **numpy** - 数值计算
- **scipy** - 科学计算（小波降噪、Hilbert变换、互相关、RBF插值）
- **h5py** - HDF5 格式支持
- **pywavelets** - 小波变换库
- **shapely** - 几何运算（应力场测绘）
- **scikit-learn** - Kriging 插值（应力场测绘）

### 前端
- **纯原生 HTML/CSS/JavaScript** - 无框架依赖
- **Canvas API** - 波形绘制
- **IIFE 模块化** - 立即执行函数封装

### 架构模式
- **前后端分离** - pywebview 提供桥接层
- **模块化设计** - 后端功能独立模块，前端 IIFE 封装
- **路由层** - `WebAPI` 类统一管理所有后端接口
- **双层存储** - SQLite 用于元数据，HDF5 用于波形数据

## 快速开始

### 1. 环境要求
- **Python 3.x**
- **Windows 系统**需要 Edge WebView2 Runtime
- **VISA 驱动**（NI-VISA 或 Keysight IO Libraries）

### 2. 安装依赖

```bash
# Windows - 激活虚拟环境（如果使用）
.venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 运行程序

```bash
python main.py
```

### 4. 程序启动说明
**启动流程**（单窗口方案）：
1. 显示开屏画面（同一窗口）
2. EdgeWebView2 Runtime 初始化（约2秒）
3. 开屏画面淡出（0.8秒）
4. 切换到主界面

**优化亮点**：
- ✅ 单一窗口设计，就像原生 APP
- ✅ 平滑淡入淡出动画
- ✅ 本地缓存目录（`.webview_cache/`），后续启动更快
- 💡 首次启动约 3 秒，后续启动约 2 秒

## 项目结构

```
PythonLearning/
├── main.py                      # 程序入口
├── web_gui.py                   # 后端 API 路由层
├── requirements.txt             # Python 依赖
├── 项目文档.md                  # 完整项目文档
│
├── modules/                     # 后端功能模块
│   ├── core/                    # 核心基础设施
│   ├── realtime_capture/        # 实时采集
│   ├── waveform_analysis/       # 波形分析
│   ├── stress_calibration/      # 应力标定
│   └── stress_detection_uniaxial/  # 单轴应力检测 + 应力场测绘
│       ├── field_experiment.py   # 实验管理
│       ├── field_database.py     # 数据库操作
│       ├── field_hdf5.py         # HDF5存储
│       ├── field_capture.py      # 数据采集
│       ├── point_generator.py    # 测点生成
│       ├── shape_utils.py        # 形状工具
│       ├── interpolation.py      # 插值算法
│       ├── contour_generator.py  # 云图生成
│       ├── data_export.py        # 数据导出
│       └── error_codes.py        # 错误码
│
├── static/                      # 前端资源
│   ├── index.html               # 主界面
│   ├── css/                     # 样式模块
│   │   └── stress-detection-uniaxial/  # 应力场测绘样式
│   └── js/                      # 前端模块
│       └── stress-detection-uniaxial/  # 应力场测绘模块
│           ├── field-experiment-manager.js
│           ├── field-shape-panel.js
│           ├── field-layout-panel.js
│           ├── field-calibration-panel.js
│           ├── field-capture-panel.js
│           ├── field-canvas.js
│           ├── field-contour.js
│           └── field-resizer.js
│
└── data/                        # 数据目录
    ├── experiments.db           # SQLite 数据库
    ├── waveforms/               # 标定实验波形
    └── uniaxial_field/          # 应力场测绘数据
```

## 数据格式

- **NPY 格式**：高精度，保留12bit原始数据，包含元数据
- **CSV 格式**：通用性好，可用 Excel、MATLAB 等打开
- **HDF5 格式**：适合大数据集，层次结构，压缩存储
- **Excel 格式**：应力场测绘报告导出（含统计信息）

## 数据存储

```
data/
├── experiments.db              # SQLite 数据库（元数据）
├── waveforms/                  # 标定实验波形数据
│   └── EXP001/
│       └── 0°/
│           ├── baseline.h5
│           └── stress_*.h5
└── uniaxial_field/             # 应力场测绘数据
    └── FLDXXX/
        ├── shape.json          # 形状配置
        ├── points.json         # 测点布局
        ├── baseline.h5         # 基准波形
        └── point_*.h5          # 各测点波形
```

## 常见问题

### 1. 找不到示波器
- 检查 USB 连接和 VISA 驱动
- 确认示波器已开机
- 尝试重新搜索设备

### 2. 波形显示异常
- 检查文件格式是否正确
- 点击"重置视图"恢复默认显示

### 3. 互相关计算失败
- 确保所有文件的采样率一致
- 确保至少有2个有效文件

### 4. 程序启动失败
- 检查是否安装了所有依赖
- Windows 系统确认已安装 Edge WebView2 Runtime

### 5. 应力场测绘问题
- **测点生成失败**：检查形状是否有效（面积>0，无自相交）
- **插值结果异常**：确保有足够的有效测点数据
- **云图不显示**：检查是否已完成数据采集

## 完整文档

详细的项目文档、代码规范、数据管理、UI设计模式等内容，请查看：
- **[项目文档.md](项目文档.md)** - 完整项目文档
- **[.kiro/steering/](.kiro/steering/)** - 项目规范文档

## 特性亮点

- ✅ **无框架依赖**：纯原生技术栈，轻量高效
- ✅ **模块化设计**：前后端分离，职责清晰
- ✅ **中文友好**：全中文命名和注释
- ✅ **专业显示**：实时采集黑色背景，分析白色背景
- ✅ **多格式支持**：NPY、CSV、HDF5、Excel 多种格式
- ✅ **智能单位**：时间延迟自动选择 ns/μs/ms 显示
- ✅ **高性能**：FFT 加速互相关计算
- ⭐ **应力场测绘**：完整的二维应力分布测量解决方案

## 许可证

本项目仅供学习和研究使用。
