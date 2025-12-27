// ==================== 应力系数标定 - 数据采集模块 ====================
// 功能：实时监控、基准波形采集、应力波形采集
// 依赖：主模块的状态和 DOM 元素

const StressCalibrationCapture = (function() {
    'use strict';
    
    // ========== 私有变量（从主模块传入）==========
    let 实验状态;
    let elements;
    let monitorCanvas, monitorCtx;
    let 显示状态栏信息;
    let 显示确认对话框;
    let 刷新数据表格;
    let 更新按钮状态;
    let 更新方向选择器;
    
    // ========== 初始化函数 ==========
    function 初始化(状态, DOM元素, Canvas对象, 工具函数) {
        实验状态 = 状态;
        elements = DOM元素;
        monitorCanvas = Canvas对象.monitorCanvas;
        monitorCtx = Canvas对象.monitorCtx;
        显示状态栏信息 = 工具函数.显示状态栏信息;
        显示确认对话框 = 工具函数.显示确认对话框;
        刷新数据表格 = 工具函数.刷新数据表格;
        更新按钮状态 = 工具函数.更新按钮状态;
        更新方向选择器 = 工具函数.更新方向选择器;
    }
    
    // ========== 实时监控（订阅模式）==========
    function 开始实时监控() {
        if (实验状态.实时监控中) return;
        
        实验状态.实时监控中 = true;
        elements.monitorStatus.textContent = '监控中';
        elements.monitorStatus.classList.add('active');
        elements.monitorMessage.style.display = 'none';
        
        // 更新按钮状态
        elements.startMonitorBtn.style.display = 'none';
        elements.stopMonitorBtn.style.display = 'block';
        
        // 订阅实时采集模块的波形更新
        RealtimeCapture.订阅波形更新(处理波形更新);
    }
    
    function 停止实时监控() {
        if (!实验状态.实时监控中) return;
        
        实验状态.实时监控中 = false;
        elements.monitorStatus.textContent = '未监控';
        elements.monitorStatus.classList.remove('active');
        
        // 更新按钮状态
        elements.startMonitorBtn.style.display = 'block';
        elements.stopMonitorBtn.style.display = 'none';
        
        // 取消订阅
        RealtimeCapture.取消订阅波形更新(处理波形更新);
    }
    
    function 手动开始监控() {
        // 检查示波器连接状态
        if (!RealtimeCapture.获取连接状态()) {
            显示状态栏信息('⚠️', '请先连接示波器', '', 'warning', 3000);
            return;
        }
        
        开始实时监控();
    }
    
    function 手动停止监控() {
        停止实时监控();
    }
    
    function 处理波形更新(数据) {
        if (!实验状态.实时监控中) return;
        
        try {
            // 解构接收波形数据和显示状态
            const { 波形数据, 显示状态 } = 数据;
            
            // 清空画布
            monitorCtx.save();
            monitorCtx.setTransform(1, 0, 0, 1, 0, 0);
            monitorCtx.clearRect(0, 0, monitorCanvas.width, monitorCanvas.height);
            monitorCtx.restore();
            
            // 使用正确的绘图函数参数
            CommonUtils.绘制波形到画布(
                monitorCanvas,
                monitorCtx,
                波形数据,
                显示状态
            );
        } catch (error) {
            // 静默处理错误
        }
    }
    
    // ========== 基准波形采集 ==========
    async function 采集基准波形() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 检查实时采集模块是否已连接
        if (!RealtimeCapture.获取连接状态()) {
            显示状态栏信息('⚠️', '请先连接示波器并开始实时采集', '', 'warning', 3000);
            return;
        }
        
        // 如果已有基准，提示确认
        if (当前方向.基准波形路径) {
            const 确认 = await 显示确认对话框(
                '⚠️ 覆盖基准波形',
                `当前方向"${当前方向.方向名称}"已存在基准波形，是否覆盖？\n\n覆盖后，之前采集的应力数据将失效。`
            );
            if (!确认) return;
            
            // 清空该方向的所有应力数据
            当前方向.应力数据 = [];
        }
        
        try {
            elements.monitorMessage.textContent = '正在获取高精度波形数据...';
            elements.monitorMessage.style.display = 'block';
            elements.captureBaselineBtn.disabled = true;
            
            // 从实时采集模块获取RAW模式数据（12bit精度，完整存储深度）
            const raw_result = await RealtimeCapture.获取当前RAW波形();
            
            if (!raw_result.success) {
                显示状态栏信息('❌', `获取波形失败：${raw_result.message}`, '', 'warning', 3000);
                elements.monitorMessage.style.display = 'none';
                return;
            }
            
            const 波形数据 = raw_result.data;
            
            elements.monitorMessage.textContent = '正在保存基准波形...';
            
            // 🔧 获取示波器采样率（用于双重验证）
            const 示波器采样率 = 波形数据.sample_rate || null;
            
            // 调用后端保存（配置从后端对象读取，不再传递）
            const result = await pywebview.api.保存基准波形数据(
                当前方向.实验ID,
                当前方向.方向名称,
                波形数据.voltage,
                波形数据.time,
                示波器采样率
            );
            
            if (result.success) {
                当前方向.基准波形路径 = result.文件路径;
                当前方向.应力数据 = [];
                
                // 初始化当前应力点为起始值
                elements.currentStress.value = 当前方向.应力范围[0];
                
                刷新数据表格();
                更新按钮状态();
                更新方向选择器();
                
                elements.monitorMessage.style.display = 'none';
                显示状态栏信息('✅', `基准波形已保存（${波形数据.points.toLocaleString()} 点，12bit）`, '', 'success', 3000);
            } else {
                elements.monitorMessage.style.display = 'none';
                显示状态栏信息('❌', `保存失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            elements.monitorMessage.style.display = 'none';
            显示状态栏信息('❌', `保存失败：${error}`, '', 'warning', 3000);
        } finally {
            elements.captureBaselineBtn.disabled = false;
        }
    }
    
    // ========== 应力波形采集 ==========
    async function 采集应力波形() {
        const 当前方向 = 实验状态.测试方向列表[实验状态.当前方向索引];
        
        // 检查实时采集模块是否已连接
        if (!RealtimeCapture.获取连接状态()) {
            显示状态栏信息('⚠️', '请先连接示波器并开始实时采集', '', 'warning', 3000);
            return;
        }
        
        const 应力值 = parseFloat(elements.currentStress.value);
        
        // 检查应力值是否有效
        if (isNaN(应力值) || 应力值 < 0) {
            显示状态栏信息('⚠️', '请输入有效的应力值', '', 'warning', 3000);
            elements.currentStress.focus();
            return;
        }
        
        // 检查是否重复
        const 已存在索引 = 当前方向.应力数据.findIndex(d => d.应力值 === 应力值);
        if (已存在索引 >= 0) {
            const 确认 = await 显示确认对话框(
                '⚠️ 覆盖数据',
                `应力值 ${应力值} MPa 已存在，是否覆盖？`
            );
            if (!确认) return;
        }
        
        try {
            elements.monitorMessage.textContent = `正在获取 ${应力值} MPa 高精度波形数据...`;
            elements.monitorMessage.style.display = 'block';
            elements.captureWaveformBtn.disabled = true;
            
            // 从实时采集模块获取RAW模式数据（12bit精度，完整存储深度）
            const raw_result = await RealtimeCapture.获取当前RAW波形();
            
            if (!raw_result.success) {
                显示状态栏信息('❌', `获取波形失败：${raw_result.message}`, '', 'warning', 3000);
                elements.monitorMessage.style.display = 'none';
                return;
            }
            
            const 波形数据 = raw_result.data;
            
            elements.monitorMessage.textContent = `正在分析 ${应力值} MPa 波形...`;
            
            // 🔧 获取示波器采样率（用于双重验证）
            const 示波器采样率 = 波形数据.sample_rate || null;
            
            // 调用后端保存并分析（配置从后端对象读取，不再传递）
            const result = await pywebview.api.保存并分析应力波形数据(
                当前方向.实验ID,
                当前方向.方向名称,
                应力值,
                波形数据.voltage,
                波形数据.time,
                示波器采样率
            );
            
            if (result.success) {
                const 新数据 = {
                    应力值: 应力值,
                    时间差: result.data.时间差,
                    波形路径: result.data.文件路径
                };
                
                if (已存在索引 >= 0) {
                    当前方向.应力数据[已存在索引] = 新数据;
                } else {
                    当前方向.应力数据.push(新数据);
                }
                
                // 排序
                当前方向.应力数据.sort((a, b) => a.应力值 - b.应力值);
                
                刷新数据表格();
                更新按钮状态();
                更新方向选择器();
                
                const 时间差ns = (result.data.时间差 * 1e9).toFixed(2);
                elements.monitorMessage.style.display = 'none';
                
                // 🆕 检查是否在重测模式
                if (当前方向.重测状态?.启用) {
                    // 检查采集的是否是重测的应力值
                    if (应力值 === 当前方向.重测状态.重测应力值) {
                        // 重测完成，恢复到返回应力值
                        const 返回值 = 当前方向.重测状态.返回应力值;
                        
                        // 清除重测状态
                        当前方向.重测状态 = {
                            启用: false,
                            重测应力值: null,
                            返回应力值: null
                        };
                        
                        // 隐藏重测标记
                        const recaptureTag = document.getElementById('sd-recaptureTag');
                        if (recaptureTag) {
                            recaptureTag.style.display = 'none';
                        }
                        
                        // 恢复应力框值
                        elements.currentStress.value = 返回值;
                        
                        显示状态栏信息('✅', `重测完成：${应力值} MPa → ${时间差ns} ns`, `已返回到 ${返回值} MPa`, 'success', 3000);
                    } else {
                        // 用户修改了应力值，采集的不是重测点，保持重测状态
                        显示状态栏信息('✅', `应力波形已记录：${应力值} MPa → ${时间差ns} ns`, `仍需重测 ${当前方向.重测状态.重测应力值} MPa`, 'info', 3000);
                    }
                } else {
                    // 正常模式，自动递增应力值
                    const 下一个应力值 = 应力值 + 当前方向.应力步长;
                    
                    if (下一个应力值 <= 当前方向.应力范围[1]) {
                        elements.currentStress.value = 下一个应力值;
                        显示状态栏信息('✅', `应力波形已记录：${应力值} MPa → ${时间差ns} ns`, '', 'success', 3000);
                    } else {
                        显示状态栏信息('✅', `应力波形已记录：${应力值} MPa → ${时间差ns} ns（已达上限）`, '', 'success', 3000);
                    }
                }
            } else {
                elements.monitorMessage.style.display = 'none';
                显示状态栏信息('❌', `分析失败：${result.message}`, '', 'warning', 3000);
            }
        } catch (error) {
            elements.monitorMessage.style.display = 'none';
            显示状态栏信息('❌', `分析失败：${error}`, '', 'warning', 3000);
        } finally {
            elements.captureWaveformBtn.disabled = false;
        }
    }
    
    // ========== Canvas 调整 ==========
    function 调整监控画布() {
        if (!monitorCanvas || !monitorCanvas.parentElement) return;
        
        const container = monitorCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        monitorCanvas.width = rect.width * window.devicePixelRatio;
        monitorCanvas.height = rect.height * window.devicePixelRatio;
        
        monitorCanvas.style.width = rect.width + 'px';
        monitorCanvas.style.height = rect.height + 'px';
        
        monitorCtx.setTransform(1, 0, 0, 1, 0, 0);
        monitorCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        开始实时监控,
        停止实时监控,
        手动开始监控,
        手动停止监控,
        采集基准波形,
        采集应力波形,
        调整监控画布
    };
})();
