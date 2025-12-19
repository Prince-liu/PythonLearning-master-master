// ==================== 单轴应力检测模块 ====================
// 功能：使用已标定的应力系数，实时检测未知应力值

const StressDetectionUniaxialModule = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let canvas, ctx;
    
    // 标定数据
    let 标定数据 = {
        已加载: false,
        材料名称: "",
        测试方向: "",
        斜率: 0,      // ns/MPa
        截距: 0,      // ns
        R方: 0
    };
    
    // 基准波形数据
    let 基准波形 = {
        已采集: false,
        时间: [],
        电压: []
    };
    
    // 波形监控状态（独立于检测）
    let 监控状态 = {
        正在监控: false
    };
    
    // 检测状态
    let 检测状态 = {
        正在检测: false,
        最新应力值: null,
        最新时间差: null,
        更新时间: null
    };
    
    // 记录数据
    let 记录列表 = [];
    
    // DOM 元素
    let elements = {};
    
    // ========== 初始化函数 ==========
    function 初始化() {
        // 获取 Canvas
        canvas = document.getElementById('det-waveformCanvas');
        ctx = canvas.getContext('2d');
        
        // 获取所有 DOM 元素
        elements = {
            loadCalibrationBtn: document.getElementById('det-loadCalibrationBtn'),
            calibrationInfo: document.getElementById('det-calibrationInfo'),
            materialName: document.getElementById('det-materialName'),
            direction: document.getElementById('det-direction'),
            slope: document.getElementById('det-slope'),
            intercept: document.getElementById('det-intercept'),
            r2: document.getElementById('det-r2'),
            
            captureBaselineBtn: document.getElementById('det-captureBaselineBtn'),
            baselineInfo: document.getElementById('det-baselineInfo'),
            baselinePoints: document.getElementById('det-baselinePoints'),
            
            startMonitorBtn: document.getElementById('det-startMonitorBtn'),
            stopMonitorBtn: document.getElementById('det-stopMonitorBtn'),
            
            startDetectionBtn: document.getElementById('det-startDetectionBtn'),
            stopDetectionBtn: document.getElementById('det-stopDetectionBtn'),
            resultDisplay: document.getElementById('det-resultDisplay'),
            timeDiff: document.getElementById('det-timeDiff'),
            stressValue: document.getElementById('det-stressValue'),
            updateTime: document.getElementById('det-updateTime'),
            
            recordBtn: document.getElementById('det-recordBtn'),
            exportBtn: document.getElementById('det-exportBtn'),
            recordCount: document.getElementById('det-recordCount'),
            recordCountValue: document.getElementById('det-recordCountValue'),
            
            monitorStatus: document.getElementById('det-monitorStatus'),
            statusMessage: document.getElementById('det-statusMessage')
        };
        
        // 绑定事件
        绑定事件();
        
        // 初始化 Canvas 尺寸
        调整画布();
        
        // 监听窗口大小变化
        window.addEventListener('resize', 调整画布);
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        elements.loadCalibrationBtn.addEventListener('click', 加载标定数据);
        elements.captureBaselineBtn.addEventListener('click', 采集基准波形);
        
        // 波形监控（独立功能）
        elements.startMonitorBtn.addEventListener('click', 开始波形监控);
        elements.stopMonitorBtn.addEventListener('click', 停止波形监控);
        
        // 单轴应力检测
        elements.startDetectionBtn.addEventListener('click', 开始检测);
        elements.stopDetectionBtn.addEventListener('click', 停止检测);
        
        elements.recordBtn.addEventListener('click', 记录当前值);
        elements.exportBtn.addEventListener('click', 导出记录);
    }
    
    // ========== 加载标定数据 ==========
    async function 加载标定数据() {
        try {
            const result = await pywebview.api.选择标定数据文件();
            
            if (!result.success) {
                if (result.message !== '用户取消') {
                    alert('❌ ' + result.message);
                }
                return;
            }
            
            // 更新标定数据
            标定数据.已加载 = true;
            标定数据.材料名称 = result.data.材料名称;
            标定数据.测试方向 = result.data.测试方向;
            标定数据.斜率 = result.data.斜率 * 1e9;  // 转换为 ns/MPa
            标定数据.截距 = result.data.截距 * 1e9;  // 转换为 ns
            标定数据.R方 = result.data.R方;
            
            // 显示标定信息
            elements.materialName.textContent = 标定数据.材料名称;
            elements.direction.textContent = 标定数据.测试方向;
            elements.slope.textContent = 标定数据.斜率.toFixed(3);
            elements.intercept.textContent = 标定数据.截距.toFixed(3);
            elements.r2.textContent = 标定数据.R方.toFixed(4);
            elements.calibrationInfo.style.display = 'block';
            
            // 启用基准波形采集按钮
            elements.captureBaselineBtn.disabled = false;
            elements.statusMessage.textContent = '请采集基准波形';
            
            alert('✅ 标定数据加载成功');
        } catch (error) {
            alert('❌ 加载失败: ' + error);
        }
    }
    
    // ========== 采集基准波形 ==========
    async function 采集基准波形() {
        if (!标定数据.已加载) {
            alert('❌ 请先加载标定数据');
            return;
        }
        
        // 检查实时采集模块是否已连接
        if (!RealtimeCapture.获取连接状态()) {
            alert('❌ 请先连接示波器并开始实时采集');
            return;
        }
        
        try {
            elements.statusMessage.textContent = '正在获取基准波形...';
            elements.statusMessage.style.display = 'block';
            elements.captureBaselineBtn.disabled = true;
            
            // 从实时采集模块获取RAW模式数据
            const result = await RealtimeCapture.获取当前RAW波形();
            
            if (!result.success) {
                alert('❌ 获取波形失败: ' + result.message);
                elements.statusMessage.textContent = '获取失败';
                return;
            }
            
            // 保存基准波形
            基准波形.已采集 = true;
            基准波形.时间 = result.data.time;
            基准波形.电压 = result.data.voltage;
            
            // 显示基准信息
            elements.baselinePoints.textContent = result.data.points.toLocaleString();
            elements.baselineInfo.style.display = 'block';
            
            // 启用检测按钮
            elements.startDetectionBtn.disabled = false;
            elements.statusMessage.textContent = '基准波形已采集，可以开始检测';
            
            setTimeout(() => {
                elements.statusMessage.style.display = 'none';
            }, 2000);
            
        } catch (error) {
            alert('❌ 采集失败: ' + error);
            elements.statusMessage.textContent = '采集失败';
        } finally {
            elements.captureBaselineBtn.disabled = false;
        }
    }
    
    // ========== 波形监控（独立功能）==========
    function 开始波形监控() {
        // 检查实时采集模块是否已连接
        if (!RealtimeCapture.获取连接状态()) {
            alert('❌ 请先连接示波器并开始实时采集');
            return;
        }
        
        监控状态.正在监控 = true;
        
        // 更新按钮状态
        elements.startMonitorBtn.style.display = 'none';
        elements.stopMonitorBtn.style.display = 'inline-block';
        elements.monitorStatus.textContent = '监控中';
        elements.monitorStatus.classList.add('active');
        elements.statusMessage.style.display = 'none';
        
        // 订阅实时采集模块的波形更新
        RealtimeCapture.订阅波形更新(处理波形更新);
    }
    
    function 停止波形监控() {
        监控状态.正在监控 = false;
        
        // 更新按钮状态
        elements.startMonitorBtn.style.display = 'inline-block';
        elements.stopMonitorBtn.style.display = 'none';
        elements.monitorStatus.textContent = '未监控';
        elements.monitorStatus.classList.remove('active');
        
        // 如果也在检测，停止检测
        if (检测状态.正在检测) {
            停止检测();
        }
        
        // 取消订阅
        RealtimeCapture.取消订阅波形更新(处理波形更新);
    }
    
    // ========== 开始检测 ==========
    function 开始检测() {
        if (!标定数据.已加载 || !基准波形.已采集) {
            alert('❌ 请先加载标定数据并采集基准波形');
            return;
        }
        
        // 如果还没开始监控，先开始监控
        if (!监控状态.正在监控) {
            开始波形监控();
        }
        
        检测状态.正在检测 = true;
        
        // 更新按钮状态
        elements.startDetectionBtn.style.display = 'none';
        elements.stopDetectionBtn.style.display = 'inline-block';
        elements.stopDetectionBtn.disabled = false;
        elements.resultDisplay.style.display = 'block';
        elements.recordBtn.disabled = false;
    }
    
    // ========== 停止检测 ==========
    function 停止检测() {
        检测状态.正在检测 = false;
        
        // 更新按钮状态
        elements.startDetectionBtn.style.display = 'inline-block';
        elements.stopDetectionBtn.style.display = 'none';
        elements.recordBtn.disabled = true;
    }
    
    // ========== 处理波形更新（订阅回调）==========
    async function 处理波形更新(数据) {
        if (!监控状态.正在监控) return;
        
        try {
            // 🆕 解构接收波形数据和显示状态
            const { 波形数据, 显示状态 } = 数据;
            
            // 绘制波形到 Canvas（使用实时采集的显示状态）
            绘制波形(波形数据, 显示状态);
            
            // 如果正在检测且有标定数据和基准波形，计算应力值
            if (检测状态.正在检测 && 标定数据.已加载 && 基准波形.已采集) {
                // 计算声时差（使用互相关算法）
                const 时间差结果 = await 计算声时差(基准波形, 波形数据);
                
                if (时间差结果.success) {
                    const 时间差ns = 时间差结果.时间差 * 1e9;  // 转换为 ns
                    
                    // 使用标定系数计算应力值
                    // Δt = k·σ + b  =>  σ = (Δt - b) / k
                    const 应力值 = (时间差ns - 标定数据.截距) / 标定数据.斜率;
                    
                    // 更新检测状态
                    检测状态.最新时间差 = 时间差ns;
                    检测状态.最新应力值 = 应力值;
                    检测状态.更新时间 = new Date();
                    
                    // 更新显示
                    elements.timeDiff.textContent = 时间差ns.toFixed(3);
                    elements.stressValue.textContent = 应力值.toFixed(2);
                    elements.updateTime.textContent = 检测状态.更新时间.toLocaleTimeString();
                }
            }
        } catch (error) {
            // 静默处理错误
        }
    }
    
    // ========== 计算声时差 ==========
    async function 计算声时差(基准, 当前) {
        try {
            // 调用后端的互相关算法
            const result = await pywebview.api.计算互相关时间差(
                基准.电压,
                基准.时间,
                当前.电压,
                当前.时间
            );
            
            return result;
        } catch (error) {
            return {
                success: false,
                message: `计算失败: ${error}`
            };
        }
    }
    
    // ========== 绘制波形 ==========
    function 绘制波形(波形数据, 显示状态 = null) {
        // 清空画布
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // 获取显示尺寸
        const rect = canvas.parentElement.getBoundingClientRect();
        const width = rect.width;
        
        // 🆕 使用传入的显示状态，如果没有则使用默认值
        const 实际显示状态 = 显示状态 || { timeOffset: 0, voltageOffset: 0 };
        
        // 使用通用绘图函数
        CommonUtils.绘制波形到画布(
            canvas,
            ctx,
            波形数据,
            实际显示状态
        );
        
        // 在右上角显示当前应力值
        if (检测状态.最新应力值 !== null) {
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(width - 180, 10, 170, 60);
            
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 16px Consolas';
            ctx.textAlign = 'left';
            ctx.fillText('单轴应力检测:', width - 170, 30);
            
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 20px Consolas';
            ctx.fillText(`${检测状态.最新应力值.toFixed(2)} MPa`, width - 170, 55);
            ctx.restore();
        }
    }
    
    // ========== 记录当前值 ==========
    function 记录当前值() {
        if (检测状态.最新应力值 === null) {
            alert('❌ 暂无检测数据');
            return;
        }
        
        // 添加到记录列表
        记录列表.push({
            时间: 检测状态.更新时间,
            时间差: 检测状态.最新时间差,
            应力值: 检测状态.最新应力值
        });
        
        // 更新记录计数
        elements.recordCountValue.textContent = 记录列表.length;
        elements.recordCount.style.display = 'block';
        elements.exportBtn.disabled = false;
        
        // 提示
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = `✅ 已记录: ${检测状态.最新应力值.toFixed(2)} MPa`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        }, 2000);
    }
    
    // ========== 导出记录 ==========
    async function 导出记录() {
        if (记录列表.length === 0) {
            alert('❌ 暂无记录数据');
            return;
        }
        
        try {
            const pathResult = await pywebview.api.选择应力检测CSV保存路径();
            if (!pathResult.success) return;
            
            // 准备导出数据
            const 导出数据 = {
                标定信息: {
                    材料名称: 标定数据.材料名称,
                    测试方向: 标定数据.测试方向,
                    斜率: 标定数据.斜率,
                    截距: 标定数据.截距,
                    R方: 标定数据.R方
                },
                记录数据: 记录列表
            };
            
            const result = await pywebview.api.导出应力检测记录(pathResult.path, 导出数据);
            
            if (result.success) {
                alert('✅ ' + result.message);
            } else {
                alert('❌ ' + result.message);
            }
        } catch (error) {
            alert('❌ 导出失败: ' + error);
        }
    }
    
    // ========== Canvas 调整 ==========
    function 调整画布() {
        if (!canvas || !canvas.parentElement) return;
        
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // ========== 标签页监控 ==========
    function 启动标签页监控() {
        调整画布();
    }
    
    function 停止标签页监控() {
        // 离开标签页时，停止监控和检测
        if (监控状态.正在监控) {
            停止波形监控();
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        启动标签页监控,
        停止标签页监控
    };
})();
