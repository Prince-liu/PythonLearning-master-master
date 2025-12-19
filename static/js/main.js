// ==================== 主入口模块 ====================
// 负责初始化各模块、标签页切换、全局事件监听

(function() {
    'use strict';
    
    // ========== Canvas 元素 ==========
    const canvas = document.getElementById('waveformCanvas');
    const ctx = canvas.getContext('2d');
    
    const analysisCanvas = document.getElementById('analysisCanvas');
    const analysisCtx = analysisCanvas.getContext('2d');
    
    // 🆕 单轴应力检测模块的 Canvas（新版）
    const sdMonitorCanvas = document.getElementById('sd-monitorCanvas');
    const sdFitCanvas = document.getElementById('sd-fitCanvas');
    
    // ========== Canvas 初始化 ==========
    function resizeCanvas() {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        // 重置变换矩阵，避免重复scale累积
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // 重绘波形
        if (RealtimeCapture.获取波形数据().时间.length > 0) {
            RealtimeCapture.重绘波形();
        }
    }
    
    // ========== 标签页切换 ==========
    function 初始化标签页() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                
                // 更新按钮状态
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 更新内容显示
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabName + 'Tab').classList.add('active');
                
                // 根据标签页执行相应操作
                if (tabName === 'capture') {
                    // 切换到实时采集页面时，重新调整Canvas尺寸
                    setTimeout(() => {
                        resizeCanvas();
                    }, 100);
                } else if (tabName === 'analysis') {
                    WaveformAnalysis.加载文件列表();
                    setTimeout(() => {
                        WaveformAnalysis.调整画布大小();
                    }, 100);
                } else if (tabName === 'calibration') {
                    // 应力系数标定模块
                    setTimeout(() => {
                        if (typeof StressCalibrationModule !== 'undefined') {
                            StressCalibrationModule.启动标签页监控();
                        }
                    }, 100);
                } else if (tabName === 'detection') {
                    // 单轴应力检测模块
                    setTimeout(() => {
                        if (typeof StressDetectionUniaxialModule !== 'undefined') {
                            StressDetectionUniaxialModule.启动标签页监控();
                        }
                    }, 100);
                }
            });
        });
    }
    
    // ========== 窗口大小调整 ==========
    function 初始化窗口事件() {
        window.addEventListener('resize', () => {
            // 实时采集页面
            if (document.getElementById('captureTab').classList.contains('active')) {
                resizeCanvas();
            }
            
            // 波形分析页面
            if (document.getElementById('analysisTab').classList.contains('active')) {
                WaveformAnalysis.调整画布大小();
            }
            
            // 应力系数标定页面
            if (document.getElementById('calibrationTab').classList.contains('active')) {
                if (typeof StressCalibrationModule !== 'undefined') {
                    // 新模块会自动处理
                }
            }
            
            // 单轴应力检测页面
            if (document.getElementById('detectionTab').classList.contains('active')) {
                if (typeof StressDetectionUniaxialModule !== 'undefined') {
                    StressDetectionUniaxialModule.启动标签页监控();
                }
            }
        });
    }
    
    // ========== 应用初始化 ==========
    function 初始化应用() {
        // 初始化各模块
        RealtimeCapture.初始化(canvas, ctx);
        WaveformAnalysis.初始化(analysisCanvas, analysisCtx);
        
        // 初始化应力系数标定模块
        if (typeof StressCalibrationModule !== 'undefined') {
            StressCalibrationModule.初始化();
        }
        
        // 初始化单轴应力检测模块
        if (typeof StressDetectionUniaxialModule !== 'undefined') {
            StressDetectionUniaxialModule.初始化();
        }
        
        // 初始化标签页
        初始化标签页();
        
        // 初始化窗口事件
        初始化窗口事件();
        
        // 延迟初始化Canvas，确保DOM完全加载
        setTimeout(resizeCanvas, 100);
    }
    
    // ========== 启动应用 ==========
    // 等待 pywebview API 就绪
    window.addEventListener('pywebviewready', function() {
        初始化应用();
    });
    
    // 兼容：如果 pywebview 已经就绪（某些情况下事件可能已触发）
    if (window.pywebview && window.pywebview.api) {
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', 初始化应用);
        } else {
            初始化应用();
        }
    }
})();
