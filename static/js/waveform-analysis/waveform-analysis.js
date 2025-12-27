// ==================== 波形分析主模块（重构完成版）====================
// 负责文件加载、状态管理和协调各子模块

const WaveformAnalysis = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let analysisCanvas, analysisCtx;
    let 当前波形数据 = null;
    let 当前视图 = 'original'; // 'original' 或 'denoised'
    let 调整动画ID = null; // 用于取消动画
    
    // ========== DOM 元素 ==========
    let elements = {};
    
    // ========== 初始化函数 ==========
    function 初始化(canvasElement, ctxElement) {
        analysisCanvas = canvasElement;
        analysisCtx = ctxElement;
        
        // 初始化绘制模块
        WaveformDrawing.初始化(canvasElement, ctxElement);
        
        // 初始化缩放模块
        WaveformZoom.初始化(canvasElement, {
            重绘回调: (选项) => {
                // 如果传入了框选坐标，直接绘制
                if (选项 && (选项.框选起点 || 选项.框选终点)) {
                    绘制波形();
                } else {
                    绘制波形();
                }
            },
            状态回调: 显示状态,
            获取波形数据回调: () => 获取当前显示的波形数据(),
            显示状态栏信息回调: 显示状态栏信息,
            zoomInBtn: document.getElementById('analysisZoomInBtn'),
            panBtn: document.getElementById('analysisPanBtn')
        });
        
        // 初始化信号处理模块
        WaveformProcessing.初始化(canvasElement, {
            重绘回调: (选项) => {
                if (选项 && 选项.切换视图) {
                    切换降噪视图();
                } else if (选项 && 选项.切换滤波视图) {
                    切换滤波视图();
                } else if (选项 && 选项.切换到降噪视图) {
                    // 降噪完成后自动切换到降噪视图
                    当前视图 = 'denoised';
                    const toggleViewBtn = document.getElementById('toggleViewBtn');
                    if (toggleViewBtn) {
                        toggleViewBtn.textContent = '查看原始';
                    }
                    绘制波形();
                } else if (选项 && 选项.切换到滤波视图) {
                    // 滤波完成后自动切换到滤波视图
                    当前视图 = 'bandpass';
                    const toggleBandpassViewBtn = document.getElementById('toggleBandpassViewBtn');
                    if (toggleBandpassViewBtn) {
                        toggleBandpassViewBtn.textContent = '查看原始';
                    }
                    绘制波形();
                } else {
                    绘制波形();
                }
            },
            状态回调: 显示状态,
            获取波形数据回调: () => 获取当前显示的波形数据(),
            获取缩放范围回调: () => WaveformZoom.获取缩放范围(),
            显示状态栏信息回调: 显示状态栏信息
        });
        
        // 初始化互相关模块
        WaveformCrossCorr.初始化({
            重绘回调: (数据) => {
                if (数据.type === 'crosscorr') {
                    绘制互相关结果(数据.results);
                } else {
                    绘制波形();
                }
            },
            状态回调: 显示状态,
            显示状态栏信息回调: 显示状态栏信息
        });
        
        // 获取 DOM 元素
        elements = {
            selectFileBtn: document.getElementById('selectFileBtn'),
            selectedFileName: document.getElementById('selectedFileName'),
            statusMessage: document.getElementById('analysisStatusMessage'),
            legend: document.getElementById('analysisLegend'),
            screenshotBtn: document.getElementById('analysisScreenshotBtn'),
            fitBtn: document.getElementById('analysisFitBtn'),
            resetBtn: document.getElementById('analysisResetBtn'),
            bandpassBtn: document.getElementById('bandpassBtn'),
            denoisingBtn: document.getElementById('denoisingBtn'),
            hilbertBtn: document.getElementById('hilbertBtn'),
            timeDiffBtn: document.getElementById('timeDiffBtn'),
            sidebar: document.getElementById('analysisSidebar'),
            sidebarTitle: document.getElementById('sidebarTitle'),
            closeSidebarBtn: document.getElementById('closeSidebarBtn'),
            bandpassPanel: document.getElementById('bandpassPanel'),
            denoisingPanel: document.getElementById('denoisingPanel'),
            hilbertPanel: document.getElementById('hilbertPanel'),
            timeDiffPanel: document.getElementById('timeDiffPanel'),
            // 状态栏信息面板
            statusBarInfoPanel: document.getElementById('analysisStatusBarInfoPanel'),
            statusBarInfoIcon: document.getElementById('analysisStatusBarInfoIcon'),
            statusBarInfoText: document.getElementById('analysisStatusBarInfoText'),
            statusBarInfoDetail: document.getElementById('analysisStatusBarInfoDetail')
        };
        
        // 绑定事件
        elements.selectFileBtn.addEventListener('click', 选择文件);
        
        if (elements.screenshotBtn) {
            elements.screenshotBtn.addEventListener('click', 截图保存);
        }
        
        // 绑定缩放按钮事件
        const zoomInBtn = document.getElementById('analysisZoomInBtn');
        const panBtn = document.getElementById('analysisPanBtn');
        
        if (panBtn) {
            panBtn.addEventListener('click', () => WaveformZoom.启用拖动模式());
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => WaveformZoom.启用框选放大());
        }
        if (elements.fitBtn) {
            elements.fitBtn.addEventListener('click', 适应窗口);
        }
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', () => WaveformZoom.重置视图());
        }
        
        if (elements.bandpassBtn) {
            elements.bandpassBtn.addEventListener('click', () => 切换面板('bandpass'));
        }
        if (elements.denoisingBtn) {
            elements.denoisingBtn.addEventListener('click', () => 切换面板('denoising'));
        }
        if (elements.hilbertBtn) {
            elements.hilbertBtn.addEventListener('click', () => 切换面板('hilbert'));
        }
        if (elements.timeDiffBtn) {
            elements.timeDiffBtn.addEventListener('click', () => 切换面板('timeDiff'));
        }
        
        const crossCorrBtn = document.getElementById('crossCorrBtn');
        if (crossCorrBtn) {
            crossCorrBtn.addEventListener('click', () => 切换面板('crossCorr'));
        }
        
        if (elements.closeSidebarBtn) {
            elements.closeSidebarBtn.addEventListener('click', 关闭侧边栏);
        }
    }
    
    // ========== 文件选择 ==========
    async function 选择文件() {
        try {
            const result = await pywebview.api.选择打开文件();
            
            if (result.success) {
                const fileName = result.path.split(/[/\\]/).pop();
                await 加载并显示波形(result.path, fileName);
            }
        } catch (error) {
            显示状态('选择文件失败');
        }
    }
    
    async function 加载并显示波形(filePath, fileName) {
        try {
            显示状态('正在加载...');
            
            const result = await pywebview.api.加载波形文件(filePath);
            
            if (result.success) {
                // 保存波形数据
                当前波形数据 = result.data;
                当前视图 = 'original';
                
                // 智能选择时间单位：优先使用微秒
                // 计算时间范围（秒）
                const 时间范围 = Math.max(...当前波形数据.time) - Math.min(...当前波形数据.time);
                
                // 如果时间范围在 0.1 μs 到 10 ms 之间，强制使用微秒
                if (时间范围 >= 1e-7 && 时间范围 <= 1e-2) {
                    当前波形数据.强制时间单位 = 'μs';
                }
                
                // 清除所有模块的状态
                WaveformZoom.清除缩放状态();
                WaveformProcessing.清除处理状态();
                WaveformCrossCorr.清除状态();
                
                // 更新UI
                elements.selectedFileName.textContent = fileName;
                elements.statusMessage.style.display = 'none';
                if (elements.legend) {
                    elements.legend.style.display = 'block';
                }
                
                // 调整画布并绘制
                调整画布大小();
                
                setTimeout(() => {
                    绘制波形();
                    显示状态('');
                }, 100);
            } else {
                显示状态('加载失败: ' + result.message);
            }
        } catch (error) {
            显示状态('加载失败');
        }
    }
    
    // ========== 获取当前显示的波形数据 ==========
    function 获取当前显示的波形数据() {
        if (!当前波形数据) return null;
        
        const 滤波后的波形 = WaveformProcessing.获取滤波后的波形();
        const 降噪后的波形 = WaveformProcessing.获取降噪后的波形();
        
        let 电压 = 当前波形数据.voltage;
        if (当前视图 === 'bandpass' && 滤波后的波形) {
            电压 = 滤波后的波形;
        } else if (当前视图 === 'denoised' && 降噪后的波形) {
            电压 = 降噪后的波形;
        }
        
        return {
            time: 当前波形数据.time,
            voltage: 电压
        };
    }
    
    // ========== 波形绘制（协调各模块）==========
    function 绘制波形() {
        if (!当前波形数据 || !当前波形数据.time || !当前波形数据.voltage) {
            return;
        }
        
        // 获取当前显示的波形数据
        const 波形数据 = 获取当前显示的波形数据();
        
        // 获取框选坐标（如果正在框选）
        const 框选坐标 = WaveformZoom.是否正在框选() ? WaveformZoom.获取框选坐标() : { 框选起点: null, 框选终点: null };
        
        // 准备配置参数
        const 配置 = {
            缩放范围: WaveformZoom.获取缩放范围(),
            包络数据: WaveformProcessing.获取包络数据(),
            显示包络: WaveformProcessing.是否显示包络(),
            Hilbert配置: WaveformProcessing.获取Hilbert配置(),
            选中的峰值: WaveformProcessing.获取选中的峰值(),
            框选起点: 框选坐标.框选起点,
            框选终点: 框选坐标.框选终点,
            强制时间单位: 当前波形数据.强制时间单位  // 始终传递强制时间单位（如果有）
        };
        
        // 如果是多曲线模式（互相关），添加多曲线配置和自定义标签
        if (当前波形数据.多曲线模式 && 当前波形数据.曲线列表) {
            配置.多曲线模式 = true;
            配置.曲线列表 = 当前波形数据.曲线列表;
            配置.X轴标签 = 当前波形数据.X轴标签;
            配置.Y轴标签 = 当前波形数据.Y轴标签;
            配置.参考信号名称 = 当前波形数据.参考信号名称;
        }
        
        // 调用绘制模块
        WaveformDrawing.绘制波形(波形数据, 配置);
    }
    
    // ========== 切换降噪视图 ==========
    function 切换降噪视图() {
        const 降噪后的波形 = WaveformProcessing.获取降噪后的波形();
        if (!降噪后的波形) {
            显示状态栏信息('⚠️', '无法切换视图', '请先应用小波降噪', 'warning', 3000);
            return;
        }
        
        当前视图 = (当前视图 === 'original') ? 'denoised' : 'original';
        
        const toggleViewBtn = document.getElementById('toggleViewBtn');
        if (toggleViewBtn) {
            toggleViewBtn.textContent = (当前视图 === 'original') ? '查看降噪' : '查看原始';
        }
        
        绘制波形();
    }
    
    // ========== 切换滤波视图 ==========
    function 切换滤波视图() {
        const 滤波后的波形 = WaveformProcessing.获取滤波后的波形();
        if (!滤波后的波形) {
            显示状态栏信息('⚠️', '无法切换视图', '请先应用带通滤波', 'warning', 3000);
            return;
        }
        
        当前视图 = (当前视图 === 'original') ? 'bandpass' : 'original';
        
        const toggleBandpassViewBtn = document.getElementById('toggleBandpassViewBtn');
        if (toggleBandpassViewBtn) {
            toggleBandpassViewBtn.textContent = (当前视图 === 'original') ? '查看滤波' : '查看原始';
        }
        
        绘制波形();
    }
    
    // ========== 辅助函数 ==========
    function 显示状态(message) {
        if (message) {
            elements.statusMessage.textContent = message;
            elements.statusMessage.style.display = 'block';
        } else {
            elements.statusMessage.style.display = 'none';
        }
    }
    
    function 调整画布大小(使用动画 = false) {
        // 取消之前的动画
        if (调整动画ID) {
            cancelAnimationFrame(调整动画ID);
            调整动画ID = null;
        }
        
        WaveformDrawing.调整画布大小();
        
        // 重新获取context
        analysisCtx = WaveformDrawing.获取Context();
        
        // 重绘波形
        if (当前波形数据) {
            if (使用动画) {
                // 使用淡入动画
                let 透明度 = 0;
                const 动画步长 = 0.1;
                
                function 动画帧() {
                    透明度 += 动画步长;
                    if (透明度 >= 1) {
                        透明度 = 1;
                        绘制波形();
                        调整动画ID = null;
                    } else {
                        // 绘制半透明波形
                        analysisCtx.save();
                        analysisCtx.globalAlpha = 透明度;
                        绘制波形();
                        analysisCtx.restore();
                        调整动画ID = requestAnimationFrame(动画帧);
                    }
                }
                
                调整动画ID = requestAnimationFrame(动画帧);
            } else {
                绘制波形();
            }
        }
    }
    
    // ========== 截图功能 ==========
    function 截图保存() {
        if (!analysisCanvas || !当前波形数据) {
            显示状态栏信息('⚠️', '无法截图', '没有可截图的内容', 'warning', 3000);
            return;
        }
        
        try {
            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = elements.selectedFileName.textContent || '波形';
            link.download = `${fileName}_${timestamp}.png`;
            link.href = analysisCanvas.toDataURL('image/png');
            link.click();
            
            显示状态('截图已保存');
            setTimeout(() => 显示状态(''), 2000);
        } catch (error) {
            显示状态栏信息('❌', '截图失败', error.toString(), 'error', 4000);
        }
    }
    
    function 适应窗口() {
        if (!当前波形数据) {
            显示状态栏信息('⚠️', '无法适应窗口', '请先加载波形文件', 'warning', 3000);
            return;
        }
        
        调整画布大小();
        显示状态('已适应窗口');
        setTimeout(() => 显示状态(''), 2000);
    }
    
    // ========== 侧边栏管理 ==========
    function 显示侧边栏() {
        if (elements.sidebar) {
            elements.sidebar.style.display = 'block';
        }
        
        // 使用 requestAnimationFrame 确保 DOM 更新后再调整画布，并启用动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                调整画布大小(true);
            });
        });
    }
    
    function 关闭侧边栏() {
        if (elements.sidebar) {
            elements.sidebar.style.display = 'none';
        }
        
        [elements.denoisingBtn, elements.hilbertBtn, elements.timeDiffBtn].forEach(btn => {
            if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }
        });
        
        const bandpassBtn = document.getElementById('bandpassBtn');
        if (bandpassBtn) {
            bandpassBtn.classList.remove('btn-primary');
            bandpassBtn.classList.add('btn-secondary');
        }
        
        // 使用 requestAnimationFrame 确保 DOM 更新后再调整画布，并启用动画
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                调整画布大小(true);
            });
        });
    }
    
    // ========== 面板切换 ==========
    function 切换面板(panelName) {
        // 互相关不需要加载波形文件
        if (panelName !== 'crossCorr' && !当前波形数据) {
            显示状态栏信息('⚠️', '无法打开面板', '请先加载波形文件', 'warning', 3000);
            return;
        }
        
        显示侧边栏();
        
        const crossCorrPanel = document.getElementById('crossCorrPanel');
        const bandpassPanel = document.getElementById('bandpassPanel');
        const panels = [bandpassPanel, elements.denoisingPanel, elements.hilbertPanel, elements.timeDiffPanel, crossCorrPanel];
        panels.forEach(panel => {
            if (panel) panel.style.display = 'none';
        });
        
        const crossCorrBtn = document.getElementById('crossCorrBtn');
        const bandpassBtn = document.getElementById('bandpassBtn');
        [bandpassBtn, elements.denoisingBtn, elements.hilbertBtn, elements.timeDiffBtn, crossCorrBtn].forEach(btn => {
            if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
            }
        });
        
        const panelMap = {
            'bandpass': bandpassPanel,
            'denoising': elements.denoisingPanel,
            'hilbert': elements.hilbertPanel,
            'timeDiff': elements.timeDiffPanel,
            'crossCorr': crossCorrPanel
        };
        
        const buttonMap = {
            'bandpass': bandpassBtn,
            'denoising': elements.denoisingBtn,
            'hilbert': elements.hilbertBtn,
            'timeDiff': elements.timeDiffBtn,
            'crossCorr': crossCorrBtn
        };
        
        const titleMap = {
            'bandpass': '带通滤波配置',
            'denoising': '小波降噪配置',
            'hilbert': 'Hilbert变换配置',
            'timeDiff': '时间差计算',
            'crossCorr': '互相关分析'
        };
        
        if (panelMap[panelName]) {
            panelMap[panelName].style.display = 'block';
        }
        
        if (buttonMap[panelName]) {
            buttonMap[panelName].classList.remove('btn-secondary');
            buttonMap[panelName].classList.add('btn-primary');
        }
        
        if (elements.sidebarTitle && titleMap[panelName]) {
            elements.sidebarTitle.textContent = titleMap[panelName];
        }
    }
    
    // ========== 绘制互相关结果 ==========
    function 绘制互相关结果(结果列表) {
        if (!analysisCanvas || !analysisCtx) {
            return;
        }
        
        if (结果列表.length === 0) {
            return;
        }
        
        try {
            // 将互相关结果转换为标准波形格式
            // 注意：后端返回的time_lags_us是微秒单位，需要转换为秒供绘图使用
            const 第一个结果 = 结果列表[0];
            
            const 时间数据 = 第一个结果.time_lags_us.map(t => t * 1e-6);  // 微秒转秒
            
            // 创建多条曲线的数据结构
            const 波形数据列表 = 结果列表.map(结果 => ({
                name: 结果.compare_name,
                time: 结果.time_lags_us.map(t => t * 1e-6),  // 微秒转秒
                voltage: 结果.correlation,
                time_delay_us: 结果.time_delay_us,
                max_correlation: 结果.max_correlation
            }));
            
            // 清除其他模块的状态（避免与单文件分析混淆）
            WaveformZoom.清除缩放状态();
            WaveformProcessing.清除处理状态();
            
            // 隐藏HTML图例（互相关使用Canvas绘制的图例）
            if (elements.legend) {
                elements.legend.style.display = 'none';
            }
            
            // 更新当前波形数据，使其他功能（拖动、缩放等）能正常工作
            当前波形数据 = {
                time: 时间数据,
                voltage: 波形数据列表[0].voltage,
                多曲线模式: true,
                曲线列表: 波形数据列表,
                X轴标签: '时滞 (μs)',
                Y轴标签: '互相关系数',
                参考信号名称: 结果列表[0].reference_name,
                强制时间单位: 'μs'  // 保存强制时间单位配置
            };
            
            // 准备绘制配置
            const 配置 = {
                缩放范围: WaveformZoom.获取缩放范围(),
                多曲线模式: true,
                曲线列表: 波形数据列表,
                X轴标签: '时滞 (μs)',
                Y轴标签: '互相关系数',
                参考信号名称: 结果列表[0].reference_name,
                强制时间单位: 'μs'  // 强制使用微秒单位
            };
            
            // 使用WaveformDrawing绘制
            WaveformDrawing.绘制波形({ time: 时间数据, voltage: 波形数据列表[0].voltage }, 配置);
            
        } catch (error) {
            // 忽略绘制错误
        }
    }
    
    // ========== 状态栏信息显示 ==========
    function 显示状态栏信息(图标, 主文本, 详细文本 = '', 类型 = 'success', 持续时间 = 3000) {
        if (!elements.statusBarInfoPanel) return;
        
        // 设置图标和文本
        elements.statusBarInfoIcon.textContent = 图标;
        elements.statusBarInfoText.textContent = 主文本;
        
        // 设置详细信息（如果有）
        if (详细文本) {
            elements.statusBarInfoDetail.textContent = 详细文本;
            elements.statusBarInfoDetail.style.display = 'block';
        } else {
            elements.statusBarInfoDetail.style.display = 'none';
        }
        
        // 移除所有类型类
        elements.statusBarInfoPanel.classList.remove('success', 'info', 'warning', 'error');
        
        // 添加对应类型的类
        elements.statusBarInfoPanel.classList.add(类型);
        
        // 显示面板
        elements.statusBarInfoPanel.style.display = 'flex';
        
        // 指定时间后自动隐藏
        setTimeout(() => {
            elements.statusBarInfoPanel.style.display = 'none';
        }, 持续时间);
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        调整画布大小,
        获取已加载波形: () => 当前波形数据,
        显示状态栏信息
    };
})();
