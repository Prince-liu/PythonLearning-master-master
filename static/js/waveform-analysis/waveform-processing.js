// ==================== 波形信号处理模块 ====================
// 负责小波降噪、Hilbert变换、时间差计算等信号处理功能

const WaveformProcessing = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let canvas;
    let 降噪后的波形 = null;
    let 包络数据 = null;
    let 选中的峰值 = [];
    let 等待点击 = false;
    
    // 配置参数
    let 降噪配置 = {
        wavelet: 'sym6',
        level: 5,
        threshold_method: 'soft',
        threshold_mode: 'heursure'
    };
    
    let Hilbert配置 = {
        color: '#ff6b6b',
        lineWidth: 1,
        showOriginal: true
    };
    
    // 回调函数
    let 重绘回调 = null;
    let 状态回调 = null;
    let 获取波形数据回调 = null;
    let 获取缩放范围回调 = null;
    let 显示状态栏信息回调 = null;
    
    // DOM 元素
    let elements = {};
    
    // ========== 初始化函数 ==========
    function 初始化(canvasElement, 配置) {
        canvas = canvasElement;
        重绘回调 = 配置.重绘回调;
        状态回调 = 配置.状态回调;
        获取波形数据回调 = 配置.获取波形数据回调;
        获取缩放范围回调 = 配置.获取缩放范围回调;
        显示状态栏信息回调 = 配置.显示状态栏信息回调;
        
        elements = {
            waveletSelect: document.getElementById('waveletType'),
            levelSlider: document.getElementById('decompLevel'),
            levelValue: document.getElementById('decompLevelValue'),
            thresholdMethod: document.getElementById('thresholdMethod'),
            thresholdMode: document.getElementById('thresholdMode'),
            applyDenoisingBtn: document.getElementById('applyDenoiseBtn'),
            toggleViewBtn: document.getElementById('toggleViewBtn'),
            denoisingResult: document.getElementById('denoiseResult'),
            showOriginalCheck: document.getElementById('showOriginal'),
            envelopeColor: document.getElementById('envelopeColor'),
            envelopeWidth: document.getElementById('envelopeWidth'),
            widthValue: document.getElementById('widthValue'),
            applyHilbertBtn: document.getElementById('applyHilbertBtn'),
            clearEnvelopeBtn: document.getElementById('clearHilbertBtn'),
            useZeroBtn: document.getElementById('useZeroBtn'),
            selectStartBtn: document.getElementById('selectStartBtn'),
            selectEndBtn: document.getElementById('selectEndBtn'),
            clearMarksBtn: document.getElementById('clearTimeDiffBtn'),
            startPointValue: document.getElementById('startPointValue'),
            timeDiffResult: document.getElementById('timeDiffResult')
        };
        
        // 绑定事件
        if (elements.levelSlider) {
            elements.levelSlider.addEventListener('input', (e) => {
                elements.levelValue.textContent = e.target.value;
            });
        }
        if (elements.applyDenoisingBtn) {
            elements.applyDenoisingBtn.addEventListener('click', 应用小波降噪);
        }
        if (elements.toggleViewBtn) {
            elements.toggleViewBtn.addEventListener('click', 切换降噪视图);
        }
        
        if (elements.envelopeWidth) {
            elements.envelopeWidth.addEventListener('input', (e) => {
                elements.widthValue.textContent = e.target.value;
            });
        }
        if (elements.applyHilbertBtn) {
            elements.applyHilbertBtn.addEventListener('click', 应用Hilbert变换);
        }
        if (elements.clearEnvelopeBtn) {
            elements.clearEnvelopeBtn.addEventListener('click', 清除包络);
        }
        
        if (elements.useZeroBtn) {
            elements.useZeroBtn.addEventListener('click', 使用零点作为起点);
        }
        if (elements.selectStartBtn) {
            elements.selectStartBtn.addEventListener('click', 选择起始峰位);
        }
        if (elements.selectEndBtn) {
            elements.selectEndBtn.addEventListener('click', 选择目标峰位);
        }
        if (elements.clearMarksBtn) {
            elements.clearMarksBtn.addEventListener('click', 清除标记);
        }
        
        // 绑定画布点击事件
        canvas.addEventListener('click', 处理画布点击);
        
        // 加载小波类型列表
        加载小波类型列表();
    }
    
    // ========== 加载小波类型列表 ==========
    async function 加载小波类型列表() {
        // 保持HTML中定义的默认选项（sym6, db4, db5, coif2）
        // 不从后端加载完整列表，避免选项过多
        // 如果需要更多小波类型，可以直接在HTML中添加
    }
    
    // ========== 小波降噪功能 ==========
    async function 应用小波降噪() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据 || !波形数据.voltage || 波形数据.voltage.length === 0) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法应用降噪', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        try {
            状态回调('正在应用小波降噪...');
            
            // 获取配置参数，确保有默认值
            const wavelet = elements.waveletSelect?.value || 'sym6';
            const level = parseInt(elements.levelSlider?.value || '5');
            const threshold_method = elements.thresholdMethod?.value || 'soft';
            const threshold_mode = elements.thresholdMode?.value || 'heursure';
            
            // 验证参数
            if (!wavelet || wavelet === '') {
                if (显示状态栏信息回调) {
                    显示状态栏信息回调('⚠️', '小波类型未选择', '使用默认值 sym6', 'warning', 3000);
                }
                降噪配置.wavelet = 'sym6';
            } else {
                降噪配置.wavelet = wavelet;
            }
            
            降噪配置.level = level;
            降噪配置.threshold_method = threshold_method;
            降噪配置.threshold_mode = threshold_mode;
            
            // 调用后端 API
            const result = await pywebview.api.小波降噪(
                波形数据.voltage,
                降噪配置.wavelet,
                降噪配置.level,
                降噪配置.threshold_method,
                降噪配置.threshold_mode
            );
            
            if (result.success) {
                降噪后的波形 = result.denoised;
                
                if (elements.denoisingResult) {
                    elements.denoisingResult.innerHTML = `
                        <div class="highlight">降噪完成</div>
                        <div>小波类型: ${降噪配置.wavelet}</div>
                        <div>分解层数: ${降噪配置.level}</div>
                        <div>阈值方法: ${降噪配置.threshold_method}</div>
                        <div>阈值模式: ${降噪配置.threshold_mode}</div>
                    `;
                    elements.denoisingResult.style.display = 'block';
                }
                
                if (elements.toggleViewBtn) {
                    elements.toggleViewBtn.disabled = false;
                    elements.toggleViewBtn.textContent = '查看降噪';
                }
                
                // 自动切换到降噪视图
                重绘回调({ 切换到降噪视图: true });
                状态回调('小波降噪完成');
                setTimeout(() => 状态回调(''), 2000);
            } else {
                状态回调('降噪失败: ' + result.message);
            }
        } catch (error) {
            状态回调('降噪失败');
        }
    }
    
    function 切换降噪视图() {
        if (!降噪后的波形) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法切换视图', '请先应用小波降噪', 'warning', 3000);
            }
            return;
        }
        
        // 通知主模块切换视图
        重绘回调({ 切换视图: true });
    }
    
    // ========== Hilbert 变换功能 ==========
    async function 应用Hilbert变换() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法应用Hilbert变换', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        try {
            状态回调('正在计算 Hilbert 包络...');
            
            Hilbert配置.color = elements.envelopeColor.value;
            Hilbert配置.lineWidth = parseInt(elements.envelopeWidth.value);
            Hilbert配置.showOriginal = elements.showOriginalCheck.checked;
            
            const result = await pywebview.api.Hilbert变换(波形数据.voltage);
            
            if (result.success) {
                包络数据 = result.envelope;
                
                重绘回调();
                状态回调('Hilbert 包络已显示');
                setTimeout(() => 状态回调(''), 2000);
            } else {
                状态回调('Hilbert 变换失败: ' + result.message);
            }
        } catch (error) {
            状态回调('Hilbert 变换失败');
        }
    }
    
    function 清除包络() {
        包络数据 = null;
        重绘回调();
    }
    
    // ========== 时间差计算功能 ==========
    let 选择模式 = 'end'; // 'start' 或 'end'
    
    function 使用零点作为起点() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法设置起点', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        // 找到最接近0微秒的时间点
        let 最接近零点的索引 = 0;
        let 最小差值 = Math.abs(波形数据.time[0]);
        
        for (let i = 1; i < 波形数据.time.length; i++) {
            const 差值 = Math.abs(波形数据.time[i]);
            if (差值 < 最小差值) {
                最小差值 = 差值;
                最接近零点的索引 = i;
            }
        }
        
        选中的峰值 = [{
            time: 波形数据.time[最接近零点的索引],
            voltage: 波形数据.voltage[最接近零点的索引],
            index: 最接近零点的索引
        }];
        
        if (elements.startPointValue) {
            elements.startPointValue.textContent = `${(波形数据.time[最接近零点的索引] * 1e6).toFixed(4)} μs`;
        }
        
        if (elements.useZeroBtn) {
            elements.useZeroBtn.classList.remove('btn-secondary');
            elements.useZeroBtn.classList.add('btn-primary');
        }
        if (elements.selectStartBtn) {
            elements.selectStartBtn.classList.remove('btn-primary');
            elements.selectStartBtn.classList.add('btn-secondary');
        }
        
        状态回调('起始点已设置为0点，请点击"选择波峰"按钮');
        setTimeout(() => 状态回调(''), 2000);
        重绘回调();
    }
    
    function 选择起始峰位() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法选择起始峰位', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        选择模式 = 'start';
        等待点击 = true;
        // 不清空选中的峰值，只是准备重新选择起点
        
        if (elements.selectStartBtn) {
            elements.selectStartBtn.classList.remove('btn-secondary');
            elements.selectStartBtn.classList.add('btn-primary');
        }
        if (elements.useZeroBtn) {
            elements.useZeroBtn.classList.remove('btn-primary');
            elements.useZeroBtn.classList.add('btn-secondary');
        }
        
        状态回调('请点击起始波峰位置');
        重绘回调();
    }
    
    function 选择目标峰位() {
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) {
            if (显示状态栏信息回调) {
                显示状态栏信息回调('⚠️', '无法选择目标峰位', '请先加载波形文件', 'warning', 3000);
            }
            return;
        }
        
        // 如果还没有起点，先设置为0点
        if (选中的峰值.length === 0) {
            使用零点作为起点();
        }
        
        选择模式 = 'end';
        等待点击 = true;
        
        状态回调('请点击目标波峰位置');
    }
    
    async function 处理画布点击(event) {
        if (!等待点击) return;
        
        const 波形数据 = 获取波形数据回调();
        if (!波形数据) return;
        
        try {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            
            const padding = { top: 30, right: 80, bottom: 60, left: 50 };
            const chartWidth = rect.width - padding.left - padding.right;
            
            let 时间最小, 时间最大;
            const 缩放范围 = 获取缩放范围回调();
            if (缩放范围) {
                时间最小 = 缩放范围.时间最小;
                时间最大 = 缩放范围.时间最大;
            } else {
                时间最小 = Math.min(...波形数据.time);
                时间最大 = Math.max(...波形数据.time);
            }
            
            const 相对X = x - padding.left;
            const 点击时间 = 时间最小 + (相对X / chartWidth) * (时间最大 - 时间最小);
            
            const result = await pywebview.api.查找时间附近峰值(
                波形数据.time,
                波形数据.voltage,
                点击时间
            );
            
            if (result.success) {
                // 选择起始点
                if (选择模式 === 'start') {
                    选中的峰值 = [result];
                    
                    if (elements.startPointValue) {
                        elements.startPointValue.textContent = `${(result.time * 1e6).toFixed(4)} μs`;
                    }
                    
                    等待点击 = false;
                    状态回调('起始点已设置，请点击"选择波峰"按钮');
                    setTimeout(() => 状态回调(''), 2000);
                    重绘回调();
                }
                // 选择目标点
                else if (选择模式 === 'end') {
                    if (选中的峰值.length === 0) {
                        // 如果没有起点，先设置为0点
                        使用零点作为起点();
                    }
                    
                    // 添加第二个峰值
                    if (选中的峰值.length === 1) {
                        选中的峰值.push(result);
                    } else {
                        选中的峰值[1] = result;
                    }
                    
                    const 时间差 = Math.abs(选中的峰值[1].time - 选中的峰值[0].time);
                    
                    等待点击 = false;
                    
                    if (elements.timeDiffResult) {
                        elements.timeDiffResult.innerHTML = `
                            <p>起始点: ${(选中的峰值[0].time * 1e6).toFixed(4)} μs</p>
                            <p>波峰位置: ${(选中的峰值[1].time * 1e6).toFixed(4)} μs</p>
                            <p class="highlight">Δt = ${(时间差 * 1e6).toFixed(4)} μs</p>
                        `;
                        elements.timeDiffResult.style.display = 'block';
                    }
                    
                    状态回调(`Δt = ${(时间差 * 1e6).toFixed(4)} μs`);
                    setTimeout(() => 状态回调(''), 3000);
                    
                    重绘回调();
                }
            } else {
                状态回调('未找到波峰，请重试');
            }
        } catch (error) {
            状态回调('处理点击失败');
        }
    }
    
    function 清除标记() {
        等待点击 = false;
        选中的峰值 = [];
        选择模式 = 'end';
        
        if (elements.timeDiffResult) {
            elements.timeDiffResult.innerHTML = '';
            elements.timeDiffResult.style.display = 'none';
        }
        if (elements.startPointValue) {
            elements.startPointValue.textContent = '0.0000 μs';
        }
        
        // 重置按钮状态
        if (elements.useZeroBtn) {
            elements.useZeroBtn.classList.remove('btn-secondary');
            elements.useZeroBtn.classList.add('btn-primary');
        }
        if (elements.selectStartBtn) {
            elements.selectStartBtn.classList.remove('btn-primary');
            elements.selectStartBtn.classList.add('btn-secondary');
        }
        
        重绘回调();
    }
    
    // ========== 清除所有处理状态 ==========
    function 清除处理状态() {
        降噪后的波形 = null;
        包络数据 = null;
        选中的峰值 = [];
        等待点击 = false;
        
        if (elements.toggleViewBtn) {
            elements.toggleViewBtn.disabled = true;
            elements.toggleViewBtn.textContent = '切换视图';
        }
        
        if (elements.denoisingResult) {
            elements.denoisingResult.innerHTML = '';
            elements.denoisingResult.style.display = 'none';
        }
        if (elements.timeDiffResult) {
            elements.timeDiffResult.innerHTML = '';
            elements.timeDiffResult.style.display = 'none';
        }
    }
    
    // ========== 获取当前状态 ==========
    function 获取降噪后的波形() {
        return 降噪后的波形;
    }
    
    function 获取包络数据() {
        return 包络数据;
    }
    
    function 获取选中的峰值() {
        return 选中的峰值;
    }
    
    function 获取Hilbert配置() {
        return Hilbert配置;
    }
    
    function 是否显示包络() {
        return 包络数据 !== null;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        清除处理状态,
        获取降噪后的波形,
        获取包络数据,
        获取选中的峰值,
        获取Hilbert配置,
        是否显示包络
    };
})();
