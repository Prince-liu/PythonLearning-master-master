// ==================== 采集控制面板模块 ====================
// 功能：实时监控、测点采集、降噪设置、进度管理

const FieldCapturePanel = (function() {
    'use strict';
    
    // ========== 私有变量 ==========
    let 实验状态 = null;
    let elements = null;
    let callbacks = null;
    
    // 监控状态（不再使用定时器，改为订阅模式）
    let 监控中 = false;
    
    // 采集流程状态：'idle' | 'capturing' | 'paused' | 'finished'
    let 采集流程状态 = 'idle';
    
    // 波形画布
    let waveformCanvas = null;
    let waveformCtx = null;
    
    // ========== 初始化 ==========
    function 初始化(state, els, cbs) {
        实验状态 = state;
        elements = els;
        callbacks = cbs;
        
        // 获取波形画布
        waveformCanvas = document.getElementById('field-waveform-canvas');
        if (waveformCanvas) {
            waveformCtx = waveformCanvas.getContext('2d');
            // 初始化时调整画布尺寸
            调整波形画布();
        }
        
        // 监听窗口resize事件
        window.addEventListener('resize', 调整波形画布);
        
        绑定事件();
        
        // 初始化全局控制按钮状态
        更新全局控制按钮();

    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 开始监控按钮（波形区域的按钮）
        const startBtn = document.getElementById('field-waveform-start');
        if (startBtn) {
            startBtn.addEventListener('click', 开始监控);
        }
        
        // 停止监控按钮（波形区域的按钮）
        const stopBtn = document.getElementById('field-waveform-stop');
        if (stopBtn) {
            stopBtn.addEventListener('click', 停止监控);
        }
        
        // 兼容旧的按钮ID
        const startBtn2 = document.getElementById('field-capture-start-monitor');
        if (startBtn2) {
            startBtn2.addEventListener('click', 开始监控);
        }
        const stopBtn2 = document.getElementById('field-capture-stop-monitor');
        if (stopBtn2) {
            stopBtn2.addEventListener('click', 停止监控);
        }
        
        // 采集当前测点按钮
        const captureBtn = document.getElementById('field-capture-current');
        if (captureBtn) {
            captureBtn.addEventListener('click', 采集当前测点);
        }
        
        // 跳过测点按钮
        const skipBtn = document.getElementById('field-capture-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', 跳过当前测点);
        }
        
        // 重测按钮
        const recaptureBtn = document.getElementById('field-capture-recapture');
        if (recaptureBtn) {
            recaptureBtn.addEventListener('click', 重测当前测点);
        }
        
        // 上一个/下一个测点
        const prevBtn = document.getElementById('field-capture-prev');
        const nextBtn = document.getElementById('field-capture-next');
        if (prevBtn) prevBtn.addEventListener('click', 上一个测点);
        if (nextBtn) nextBtn.addEventListener('click', 下一个测点);
        
        // 跳转按钮和输入框
        const jumpBtn = document.getElementById('field-capture-jump-btn');
        const jumpInput = document.getElementById('field-capture-jump-input');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', 跳转到指定测点);
        }
        if (jumpInput) {
            // 输入验证
            jumpInput.addEventListener('input', 验证跳转输入);
            // 按Enter也可以跳转
            jumpInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    跳转到指定测点();
                }
            });
        }
        
        // 降噪设置按钮
        const denoiseBtn = document.getElementById('field-capture-denoise-settings');
        if (denoiseBtn) {
            denoiseBtn.addEventListener('click', 打开降噪设置);
        }
        
        // 全局控制按钮
        const startPauseBtn = document.getElementById('field-capture-start-pause');
        if (startPauseBtn) {
            startPauseBtn.addEventListener('click', 切换采集状态);
        }
        
        const finishBtn = document.getElementById('field-capture-finish');
        if (finishBtn) {
            finishBtn.addEventListener('click', 完成采集);
        }
    }
    
    // ========== 监控控制（订阅模式，与应力系数标定模块一致）==========
    function 开始监控() {
        if (监控中) return;
        
        // 检查示波器连接状态
        if (typeof RealtimeCapture !== 'undefined' && !RealtimeCapture.获取连接状态()) {
            callbacks?.显示状态信息('⚠️', '请先连接示波器', '', 'warning');
            return;
        }
        
        监控中 = true;
        实验状态.实时监控中 = true;
        
        // 更新按钮状态
        更新监控按钮状态();
        
        // 订阅实时采集模块的波形更新
        RealtimeCapture.订阅波形更新(处理波形更新);
        
        callbacks?.显示状态信息('✅', '实时监控已启动', '', 'success');
    }
    
    function 停止监控() {
        if (!监控中) return;
        
        监控中 = false;
        实验状态.实时监控中 = false;
        
        // 取消订阅
        RealtimeCapture.取消订阅波形更新(处理波形更新);
        
        更新监控按钮状态();
        callbacks?.显示状态信息('ℹ️', '实时监控已停止', '', 'info');
    }
    
    function 暂停监控() {
        停止监控();
    }
    
    function 恢复监控() {
        开始监控();
    }
    
    // ========== 波形更新回调（订阅模式）==========
    function 处理波形更新(数据) {
        if (!监控中) return;
        
        try {
            // 解构接收波形数据和显示状态
            const { 波形数据, 显示状态 } = 数据;
            
            // 清空画布
            waveformCtx.save();
            waveformCtx.setTransform(1, 0, 0, 1, 0, 0);
            waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            waveformCtx.restore();
            
            // 使用通用绘图函数（与应力系数标定模块一致）
            CommonUtils.绘制波形到画布(
                waveformCanvas,
                waveformCtx,
                波形数据,
                显示状态
            );
        } catch (error) {
            // 静默处理错误
        }
    }
    
    function 更新监控按钮状态() {
        // 波形区域的按钮（新的）
        const waveformStartBtn = document.getElementById('field-waveform-start');
        const waveformStopBtn = document.getElementById('field-waveform-stop');
        const waveformStatus = document.getElementById('field-waveform-status');
        
        if (waveformStartBtn) waveformStartBtn.style.display = 监控中 ? 'none' : 'flex';
        if (waveformStopBtn) waveformStopBtn.style.display = 监控中 ? 'flex' : 'none';
        if (waveformStatus) {
            waveformStatus.textContent = 监控中 ? '监控中' : '未监控';
            waveformStatus.className = 监控中 ? 'monitor-status active' : 'monitor-status';
        }
        
        // 兼容旧的按钮
        const startBtn = document.getElementById('field-capture-start-monitor');
        const stopBtn = document.getElementById('field-capture-stop-monitor');
        const statusIndicator = document.getElementById('field-capture-monitor-status');
        
        if (startBtn) startBtn.disabled = 监控中;
        if (stopBtn) stopBtn.disabled = !监控中;
        
        if (statusIndicator) {
            statusIndicator.textContent = 监控中 ? '🟢 监控中' : '⚪ 已停止';
            statusIndicator.className = 监控中 ? 'status-indicator active' : 'status-indicator';
        }
    }
    
    // ========== 画布调整（与应力系数标定模块一致）==========
    function 调整波形画布() {
        if (!waveformCanvas || !waveformCanvas.parentElement) return;
        
        const container = waveformCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        waveformCanvas.width = rect.width * window.devicePixelRatio;
        waveformCanvas.height = rect.height * window.devicePixelRatio;
        
        waveformCanvas.style.width = rect.width + 'px';
        waveformCanvas.style.height = rect.height + 'px';
        
        waveformCtx.setTransform(1, 0, 0, 1, 0, 0);
        waveformCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    // 采集状态标志（防止重复点击）
    let 正在采集 = false;
    
    // ========== 测点采集 ==========
    async function 采集当前测点(isRecapture = false) {
        // 防抖：如果正在采集，忽略新的点击
        if (正在采集) {
            callbacks?.显示状态信息('⚠️', '正在采集中，请稍候...', '', 'warning');
            return;
        }
        
        if (!实验状态.当前实验) {
            callbacks?.显示状态信息('⚠️', '请先创建或加载实验', '', 'warning');
            return;
        }
        
        // ========== 🆕 前置条件检查（开始采集实验前）==========
        
        // 1. 检查是否已加载实验
        if (!实验状态.工作流程.已加载实验) {
            callbacks?.显示状态信息('⚠️', '请先新建或加载实验', '', 'warning');
            return;
        }
        
        // 2. 检查是否已加载标定数据
        if (!实验状态.工作流程.已加载标定) {
            callbacks?.显示状态信息('⚠️', '请先加载标定数据', '需要标定系数才能计算应力值', 'warning');
            return;
        }
        
        // 3. 检查是否已应用形状
        if (!实验状态.工作流程.已应用形状) {
            callbacks?.显示状态信息('⚠️', '请先应用试件形状', '必须完成形状设置并点击"应用"', 'warning');
            return;
        }
        
        // 4. 检查是否已生成测点
        if (!实验状态.工作流程.已生成测点) {
            callbacks?.显示状态信息('⚠️', '请先生成测点布局', '需要测点才能开始采集', 'warning');
            return;
        }
        
        // 检查标定数据是否已加载（兼容旧逻辑）
        if (!实验状态.标定数据 || !实验状态.标定系数) {
            callbacks?.显示状态信息('⚠️', '请先加载标定数据', '需要标定系数才能计算应力值', 'warning');
            return;
        }
        
        if (!实验状态.测点列表 || 实验状态.测点列表.length === 0) {
            callbacks?.显示状态信息('⚠️', '请先生成测点', '', 'warning');
            return;
        }
        
        // 检查是否所有测点都已采集完成（重测时跳过此检查）
        if (!isRecapture) {
            const totalPoints = 实验状态.测点列表.length;
            const measuredCount = 实验状态.已测点列表?.length || 0;
            if (measuredCount >= totalPoints) {
                callbacks?.显示状态信息('🎉', '所有测点已采集完成', 
                    `共 ${totalPoints} 个测点，如需重新采集请点击"重测"`, 'success', 5000);
                return;
            }
        }
        
        const pointIndex = 实验状态.当前测点索引;
        const point = 实验状态.测点列表[pointIndex];
        
        if (!point) {
            callbacks?.显示状态信息('⚠️', '无效的测点索引', '', 'warning');
            return;
        }
        
        // 检查示波器连接状态
        if (typeof RealtimeCapture !== 'undefined' && !RealtimeCapture.获取连接状态()) {
            callbacks?.显示状态信息('⚠️', '请先连接示波器', '', 'warning');
            return;
        }
        
        // 检查是否是用户指定的基准点
        const isDesignatedBaseline = (pointIndex + 1) === 实验状态.基准点ID;
        if (isDesignatedBaseline && !实验状态.基准点已采集) {
            callbacks?.显示状态信息('ℹ️', `测点 ${pointIndex + 1} 是基准点，将设为基准波形`, '', 'info');
        }
        
        callbacks?.显示状态信息('⏳', `正在采集测点 ${pointIndex + 1}...`, '', 'info', 0);
        
        // 设置采集标志，禁用按钮
        正在采集 = true;
        const captureBtn = document.getElementById('field-capture-current');
        if (captureBtn) captureBtn.disabled = true;
        
        try {
            // 从实时采集模块获取RAW模式数据（12bit精度）
            const raw_result = await RealtimeCapture.获取当前RAW波形();
            
            if (!raw_result.success) {
                callbacks?.显示状态信息('❌', '波形采集失败', raw_result.message || '', 'error');
                return;
            }
            
            const 波形数据 = raw_result.data;
            const autoDenoise = document.getElementById('field-capture-auto-denoise')?.checked ?? true;
            const bandpassEnabled = document.getElementById('field-capture-bandpass-filter')?.checked ?? true;
            
            // 使用 pointIndex + 1 作为 point_index（从1开始）
            // 传递波形数据给后端处理
            const result = await pywebview.api.capture_field_point_with_waveform(
                pointIndex + 1,
                波形数据.voltage,
                波形数据.time,
                波形数据.sample_rate || 1e9,
                autoDenoise,
                bandpassEnabled
            );
            
            if (result.success) {
                const data = result.data;
                
                // 更新测点状态（使用 pointIndex + 1）
                callbacks?.更新测点状态(pointIndex + 1, 'measured', data);
                
                // 检查是否是用户指定的基准点
                const isDesignatedBaseline = (pointIndex + 1) === 实验状态.基准点ID;
                
                // 如果是基准点，更新基准状态
                if (data.is_baseline || isDesignatedBaseline) {
                    实验状态.基准点已采集 = true;
                    
                    // 后端已将状态更新为 collecting，前端同步更新
                    if (实验状态.当前实验) {
                        实验状态.当前实验.status = 'collecting';
                    }
                    
                    // 更新基准点UI
                    if (typeof StressDetectionUniaxialModule !== 'undefined') {
                        StressDetectionUniaxialModule.更新基准点UI(pointIndex + 1, true, {
                            snr: data.snr,
                            quality_score: data.quality_score
                        });
                    }
                }
                
                // 显示结果
                更新采集结果显示(data);
                
                // 获取质量检查模式
                const qualityMode = typeof StressDetectionUniaxialModule !== 'undefined' 
                    ? StressDetectionUniaxialModule.获取质量检查模式() 
                    : 'strict';
                
                // 根据模式决定反馈方式
                const qualityPercent = data.quality_score != null ? (Number(data.quality_score) * 100).toFixed(0) : '0';
                const qualityStars = data.quality_score >= 0.9 ? '★★★★★' 
                    : data.quality_score >= 0.7 ? '★★★★☆' 
                    : data.quality_score >= 0.5 ? '★★★☆☆' 
                    : '★★☆☆☆';
                
                // 检查数据异常（优先级高于质量警告）
                const hasDataAnomaly = data.validation_warnings && data.validation_warnings.length > 0;
                const hasQualityIssue = data.quality_score < 0.6;
                
                if (qualityMode === 'strict') {
                    // 严格模式：数据异常或质量不合格时弹出警告对话框
                    if (hasDataAnomaly) {
                        显示数据异常警告(data, pointIndex + 1);
                    } else if (hasQualityIssue) {
                        显示质量警告(data);
                    } else {
                        callbacks?.显示状态信息('✅', '采集成功', 
                            `应力: ${data.stress != null ? Number(data.stress).toFixed(1) : '--'} MPa, 质量: ${qualityPercent}%`, 'success');
                        
                        // 自动跳转到下一个测点
                        自动跳转下一测点();
                    }
                } else {
                    // 快速模式：只显示状态栏警告，自动继续
                    if (hasDataAnomaly) {
                        // 数据异常：红色/黄色警告，显示3秒
                        const hasSevereError = data.validation_warnings.some(w => w.severity === 'error');
                        const warningMsg = 生成快速模式警告信息(data.validation_warnings);
                        if (hasSevereError) {
                            callbacks?.显示状态信息('❌', `#${pointIndex + 1} 数据异常`, warningMsg, 'error', 3000);
                        } else {
                            callbacks?.显示状态信息('⚠️', `#${pointIndex + 1} 数据异常`, warningMsg, 'warning', 3000);
                        }
                    } else if (hasQualityIssue) {
                        callbacks?.显示状态信息('⚠️', `#${pointIndex + 1} ${qualityStars}`, '质量较差', 'warning', 3000);
                    } else {
                        callbacks?.显示状态信息('✅', `#${pointIndex + 1} ${qualityStars}`, '', 'success');
                    }
                    
                    // 无论质量如何都自动跳转
                    自动跳转下一测点();
                }
                
                // 刷新云图

                if (实验状态.已测点列表.length >= 3) {

                    callbacks?.刷新云图?.();
                }
                
            } else {
                callbacks?.显示状态信息('❌', '采集失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[采集面板] 采集测点失败:', error);
            callbacks?.显示状态信息('❌', '采集失败', error.toString(), 'error');
        } finally {
            // 恢复采集标志，启用按钮
            正在采集 = false;
            const captureBtn = document.getElementById('field-capture-current');
            if (captureBtn && 采集流程状态 === 'capturing') {
                captureBtn.disabled = false;
            }
        }
    }
    
    // ========== 自动跳转下一测点 ==========
    function 自动跳转下一测点() {
        // 查找第一个未测的点
        let nextIndex = -1;
        for (let i = 0; i < 实验状态.测点列表.length; i++) {
            const point = 实验状态.测点列表[i];
            if (point.status === 'pending') {
                nextIndex = i;
                break;
            }
        }
        
        if (nextIndex !== -1) {
            // 找到未测的点，跳转过去
            实验状态.当前测点索引 = nextIndex;
            更新当前测点显示();
        } else {
            // 所有测点已采集完成，提示用户可以点击"完成采集"
            callbacks?.显示状态信息('🎉', '所有测点采集完成！', 
                `共 ${实验状态.测点列表.length} 个测点，点击"完成采集"保存实验`, 'success', 5000);
            
            // 更新UI显示（不自动设置为completed，需要用户手动点击"完成采集"）
            更新当前测点显示();
        }
    }
    
    // ========== 跳过测点 ==========
    async function 跳过当前测点() {
        if (!实验状态.当前实验) return;
        
        const pointIndex = 实验状态.当前测点索引;
        const point = 实验状态.测点列表[pointIndex];
        
        if (!point) return;
        
        const reason = await 输入跳过原因();
        if (reason === null) return;  // 用户取消
        
        try {
            const result = await pywebview.api.skip_field_point(
                pointIndex + 1,
                reason
            );
            
            if (result.success) {
                callbacks?.更新测点状态(pointIndex + 1, 'skipped', null);
                
                // 跳转到下一个测点
                if (实验状态.当前测点索引 < 实验状态.测点列表.length - 1) {
                    实验状态.当前测点索引++;
                    更新当前测点显示();
                }
                
                callbacks?.显示状态信息('ℹ️', '测点已跳过', '', 'info');
            }
        } catch (error) {
            console.error('[采集面板] 跳过测点失败:', error);
        }
    }
    
    async function 输入跳过原因() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.style.display = 'flex';
            
            overlay.innerHTML = `
                <div class="modal-content field-modal modal-sm">
                    <div class="modal-header">
                        <h3>⏭️ 跳过测点</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>跳过原因（可选）</label>
                            <input type="text" id="skip-reason-input" class="form-input" placeholder="例如：探头无法到达">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">取消</button>
                        <button class="btn btn-primary confirm-btn">确定跳过</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            const cleanup = () => document.body.removeChild(overlay);
            
            overlay.querySelector('.modal-close').onclick = () => { cleanup(); resolve(null); };
            overlay.querySelector('.cancel-btn').onclick = () => { cleanup(); resolve(null); };
            overlay.querySelector('.confirm-btn').onclick = () => {
                const reason = document.getElementById('skip-reason-input')?.value || '';
                cleanup();
                resolve(reason);
            };
        });
    }

    
    // ========== 重测测点 ==========
    async function 重测当前测点() {
        // 直接重新采集当前测点（传入 isRecapture=true 跳过完成检查）
        await 采集当前测点(true);
    }
    
    // ========== 测点导航 ==========
    function 上一个测点() {
        if (实验状态.当前测点索引 > 0) {
            实验状态.当前测点索引--;
            更新当前测点显示();
            callbacks?.刷新预览画布?.();
        }
    }
    
    function 下一个测点() {
        if (实验状态.当前测点索引 < 实验状态.测点列表.length - 1) {
            实验状态.当前测点索引++;
            更新当前测点显示();
            callbacks?.刷新预览画布?.();
        }
    }
    
    function 跳转到测点(index) {
        if (index >= 0 && index < 实验状态.测点列表.length) {
            实验状态.当前测点索引 = index;
            更新当前测点显示();
            callbacks?.刷新预览画布?.();
        }
    }
    
    // ========== 跳转输入验证 ==========
    function 验证跳转输入() {
        const input = document.getElementById('field-capture-jump-input');
        if (!input) return;
        
        const value = parseInt(input.value);
        const total = 实验状态?.测点列表?.length || 0;
        
        if (isNaN(value) || value < 1 || value > total) {
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
        }
    }
    
    // ========== 跳转到指定测点 ==========
    function 跳转到指定测点() {
        const input = document.getElementById('field-capture-jump-input');
        if (!input) return;
        
        const value = parseInt(input.value);
        const total = 实验状态?.测点列表?.length || 0;
        
        if (isNaN(value) || value < 1 || value > total) {
            callbacks?.显示状态信息?.('⚠️', '跳转失败', `请输入1-${total}之间的数字`, 'warning');
            input.classList.add('invalid');
            return;
        }
        
        // 跳转到指定测点 (索引 = value - 1)
        实验状态.当前测点索引 = value - 1;
        更新当前测点显示();
        callbacks?.刷新预览画布?.();

    }
    
    // ========== 更新当前测点显示 ==========
    function 更新当前测点显示() {
        const index = 实验状态.当前测点索引;
        const point = 实验状态.测点列表[index];
        const total = 实验状态.测点列表.length;
        
        // 更新测点信息
        const pointIdEl = document.getElementById('field-capture-point-id');
        const pointXEl = document.getElementById('field-capture-point-x');
        const pointYEl = document.getElementById('field-capture-point-y');
        const pointStatusEl = document.getElementById('field-capture-point-status');
        
        if (pointIdEl) pointIdEl.textContent = point?.point_index || index + 1;
        if (pointXEl) pointXEl.textContent = point?.x_coord != null ? Number(point.x_coord).toFixed(1) : '--';
        if (pointYEl) pointYEl.textContent = point?.y_coord != null ? Number(point.y_coord).toFixed(1) : '--';
        if (pointStatusEl) {
            const statusMap = {
                'pending': '待测',
                'measured': '已测',
                'skipped': '已跳过',
                'error': '错误'
            };
            pointStatusEl.textContent = statusMap[point?.status] || '待测';
        }
        
        // 更新测量结果（时间差、应力、质量、SNR）
        const timeDiffEl = document.getElementById('field-capture-result-timediff');
        const stressEl = document.getElementById('field-capture-result-stress');
        const qualityEl = document.getElementById('field-capture-result-quality');
        const snrEl = document.getElementById('field-capture-result-snr');
        
        if (point && point.status === 'measured') {
            if (timeDiffEl) timeDiffEl.textContent = point.time_diff != null ? Number(point.time_diff).toFixed(2) : '--';
            if (stressEl) stressEl.textContent = point.stress_value != null ? Number(point.stress_value).toFixed(1) : '--';
            if (qualityEl) qualityEl.textContent = point.quality_score != null ? (Number(point.quality_score) * 100).toFixed(0) + '%' : '--';
            if (snrEl) snrEl.textContent = point.snr != null ? Number(point.snr).toFixed(1) : '--';
        } else {
            // 未测量的点显示 --
            if (timeDiffEl) timeDiffEl.textContent = '--';
            if (stressEl) stressEl.textContent = '--';
            if (qualityEl) qualityEl.textContent = '--';
            if (snrEl) snrEl.textContent = '--';
        }
        
        // 更新跳转输入框的值
        const jumpInput = document.getElementById('field-capture-jump-input');
        if (jumpInput) {
            jumpInput.value = index + 1;
            jumpInput.classList.remove('invalid');
        }
        
        // 更新总数显示
        const totalEl = document.getElementById('field-capture-total');
        if (totalEl) {
            totalEl.textContent = total;
        }
        
        // 更新测点类型标识
        const typeSpan = document.getElementById('field-capture-point-type');
        if (typeSpan) {
            // 判断是否为基准点：point_index 匹配基准点ID
            const isBaseline = 实验状态.基准点ID && (index + 1) === 实验状态.基准点ID;
            
            if (isBaseline) {
                typeSpan.textContent = '🔵 基准点';
                typeSpan.className = 'baseline';
            } else {
                typeSpan.textContent = '⚪ 普通测点';
                typeSpan.className = 'normal';
            }
        }
        
        // 更新进度条
        const progressBar = document.getElementById('field-capture-progress-bar');
        if (progressBar) {
            const percent = total > 0 
                ? (实验状态.已测点列表.length / total) * 100 
                : 0;
            progressBar.style.width = `${percent}%`;
        }
        
        // 高亮预览画布中的测点
        callbacks?.刷新预览画布?.();
        
        // 刷新数据表格（采集时自动滚动到当前测点）
        callbacks?.刷新数据表格?.(true);
    }
    
    function 更新当前测点(index) {
        跳转到测点(index);
    }
    
    // ========== 更新采集结果显示 ==========
    function 更新采集结果显示(data) {
        const timeDiffEl = document.getElementById('field-capture-result-timediff');
        const stressEl = document.getElementById('field-capture-result-stress');
        const qualityEl = document.getElementById('field-capture-result-quality');
        const snrEl = document.getElementById('field-capture-result-snr');
        
        if (timeDiffEl) timeDiffEl.textContent = data.time_diff != null ? Number(data.time_diff).toFixed(2) : '--';
        if (stressEl) stressEl.textContent = data.stress != null ? Number(data.stress).toFixed(1) : '--';
        if (qualityEl) qualityEl.textContent = data.quality_score != null ? `${(Number(data.quality_score) * 100).toFixed(0)}%` : '--';
        if (snrEl) snrEl.textContent = data.snr != null ? Number(data.snr).toFixed(1) : '--';
    }
    
    // ========== 质量警告 ==========
    function 显示质量警告(data) {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-quality-warning-modal';
        overlay.style.display = 'flex';
        
        const qualityPercent = data.quality_score != null ? (Number(data.quality_score) * 100).toFixed(0) : '0';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header warning">
                    <h3>⚠️ 波形质量警告</h3>
                    <button class="modal-close" onclick="document.getElementById('field-quality-warning-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section" style="margin-bottom: 0;">
                        <div class="form-section-title">
                            <span class="section-icon">📊</span>
                            <span>质量评估</span>
                        </div>
                        <div class="form-section-content">
                            <div class="quality-warning-info" style="background: transparent; padding: 0;">
                                <div class="quality-item">
                                    <span class="label">质量评分:</span>
                                    <span class="value ${qualityPercent < 60 ? 'bad' : 'warning'}">${qualityPercent}%</span>
                                </div>
                                <div class="quality-item">
                                    <span class="label">信噪比:</span>
                                    <span class="value">${data.snr != null ? Number(data.snr).toFixed(1) : '--'} dB</span>
                                </div>
                                <div class="quality-item">
                                    <span class="label">时间差:</span>
                                    <span class="value">${data.time_diff != null ? Number(data.time_diff).toFixed(2) : '--'} ns</span>
                                </div>
                                <div class="quality-item">
                                    <span class="label">应力值:</span>
                                    <span class="value">${data.stress != null ? Number(data.stress).toFixed(1) : '--'} MPa</span>
                                </div>
                            </div>
                            <div class="quality-warning-message" style="margin-top: 12px; padding: 10px; background: #fff8e1; border-radius: 6px; border-left: 3px solid #ff9800;">
                                <p style="margin: 0 0 4px 0;">波形质量较低，可能影响测量精度。</p>
                                <p style="margin: 0; font-size: 12px; color: #666;">建议：检查探头耦合、调整示波器设置或重新采集。</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="FieldCapturePanel.接受低质量数据()">接受数据</button>
                    <button class="btn btn-warning" onclick="FieldCapturePanel.重测并关闭警告()">重新采集</button>
                    <button class="btn btn-danger" onclick="FieldCapturePanel.跳过并关闭警告()">跳过测点</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    function 接受低质量数据() {
        document.getElementById('field-quality-warning-modal')?.remove();
        
        // 自动跳转到下一个测点
        if (实验状态.当前测点索引 < 实验状态.测点列表.length - 1) {
            实验状态.当前测点索引++;
            更新当前测点显示();
        }
    }
    
    async function 重测并关闭警告() {
        document.getElementById('field-quality-warning-modal')?.remove();
        await 重测当前测点();
    }
    
    async function 跳过并关闭警告() {
        document.getElementById('field-quality-warning-modal')?.remove();
        await 跳过当前测点();
    }
    
    // ========== 数据异常警告 ==========
    function 显示数据异常警告(data, pointId) {
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-data-anomaly-modal';
        overlay.style.display = 'flex';
        
        // 生成异常原因列表
        const warnings = data.validation_warnings || [];
        let warningsHtml = '';
        
        warnings.forEach(w => {
            const icon = w.severity === 'error' ? '🔴' : '🟡';
            const colorClass = w.severity === 'error' ? 'error' : 'warning';
            warningsHtml += `
                <div class="anomaly-item ${colorClass}">
                    <span class="icon">${icon}</span>
                    <span class="message">${w.message}</span>
                </div>
            `;
        });
        
        // 判断是否有严重错误
        const hasSevereError = warnings.some(w => w.severity === 'error');
        const headerClass = hasSevereError ? 'error' : 'warning';
        const headerIcon = hasSevereError ? '❌' : '⚠️';
        const headerTitle = hasSevereError ? '数据严重异常' : '数据异常警告';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header ${headerClass}">
                    <h3>${headerIcon} ${headerTitle}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-section" style="margin-bottom: 12px;">
                        <div class="form-section-title">
                            <span class="section-icon">📊</span>
                            <span>测量结果 (测点 #${pointId})</span>
                        </div>
                        <div class="form-section-content">
                            <div class="quality-warning-info" style="background: transparent; padding: 0;">
                                <div class="quality-item">
                                    <span class="label">时间差:</span>
                                    <span class="value ${Math.abs(data.time_diff) > 1000 ? 'bad' : ''}">${data.time_diff != null ? Number(data.time_diff).toFixed(2) : '--'} ns</span>
                                </div>
                                <div class="quality-item">
                                    <span class="label">应力值:</span>
                                    <span class="value ${Math.abs(data.stress) > 500 ? 'bad' : ''}">${data.stress != null ? Number(data.stress).toFixed(1) : '--'} MPa</span>
                                </div>
                                <div class="quality-item">
                                    <span class="label">质量评分:</span>
                                    <span class="value">${data.quality_score != null ? (Number(data.quality_score) * 100).toFixed(0) : '--'}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-bottom: 12px;">
                        <div class="form-section-title">
                            <span class="section-icon">❗</span>
                            <span>异常原因</span>
                        </div>
                        <div class="form-section-content">
                            <div class="anomaly-list">
                                ${warningsHtml}
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-bottom: 0;">
                        <div class="form-section-title">
                            <span class="section-icon">💡</span>
                            <span>可能原因</span>
                        </div>
                        <div class="form-section-content">
                            <div class="quality-warning-message" style="padding: 10px; background: #f5f5f5; border-radius: 6px; border-left: 3px solid #9e9e9e;">
                                <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #666;">
                                    <li>探头耦合不良或有气泡</li>
                                    <li>探头位置偏移或未放稳</li>
                                    <li>信号干扰或噪声过大</li>
                                    <li>带通滤波参数不匹配</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer anomaly-footer">
                    <button class="btn btn-secondary" onclick="FieldCapturePanel.接受异常数据()">接受数据</button>
                    <button class="btn btn-warning" onclick="FieldCapturePanel.重测并关闭异常警告()">重新采集</button>
                    <button class="btn btn-danger" onclick="FieldCapturePanel.跳过并关闭异常警告()">跳过测点</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    function 生成快速模式警告信息(warnings) {
        if (!warnings || warnings.length === 0) return '';
        
        // 优先显示严重错误
        const severeWarning = warnings.find(w => w.severity === 'error');
        if (severeWarning) {
            if (severeWarning.type === 'time_diff_out_of_range') {
                return `时间差超范围 (${Number(severeWarning.value).toFixed(0)} ns)`;
            } else if (severeWarning.type === 'stress_out_of_range') {
                return `应力超范围 (${Number(severeWarning.value).toFixed(0)} MPa)`;
            }
        }
        
        // 显示警告
        const warning = warnings[0];
        if (warning.type === 'neighbor_diff_too_large') {
            return `与前点差异过大 (Δσ=${Number(warning.value).toFixed(0)} MPa)`;
        }
        
        return '数据异常';
    }
    
    function 接受异常数据() {
        document.getElementById('field-data-anomaly-modal')?.remove();
        
        // 自动跳转到下一个测点
        自动跳转下一测点();
    }
    
    async function 重测并关闭异常警告() {
        document.getElementById('field-data-anomaly-modal')?.remove();
        await 重测当前测点();
    }
    
    async function 跳过并关闭异常警告() {
        document.getElementById('field-data-anomaly-modal')?.remove();
        await 跳过当前测点();
    }
    
    // ========== 设为基准点 ==========
    async function 设为基准点() {
        if (!实验状态.当前实验) return;
        
        // 🆕 验证：必须先应用形状
        if (!实验状态.工作流程.已应用形状) {
            callbacks?.显示状态信息('⚠️', '请先应用试件形状', '必须先完成形状设置并点击"应用"', 'warning');
            return;
        }
        
        const pointIndex = 实验状态.当前测点索引;
        const point = 实验状态.测点列表[pointIndex];
        
        if (!point || point.status !== 'measured') {
            callbacks?.显示状态信息('⚠️', '只能将已测量的测点设为基准', '', 'warning');
            return;
        }
        
        const confirmed = await StressDetectionUniaxialModule.显示确认对话框(
            '更换基准点',
            `确定要将测点 ${point.id || pointIndex + 1} 设为新的基准点吗？\n\n所有已测量的应力值将重新计算。`
        );
        
        if (!confirmed) return;
        
        try {
            const result = await pywebview.api.set_baseline_point(
                pointIndex + 1
            );
            
            if (result.success) {
                实验状态.基准点ID = pointIndex + 1;
                实验状态.基准点已采集 = true;
                
                // 重新加载实验数据以获取更新后的应力值
                const expId = 实验状态.当前实验?.id || 实验状态.当前实验?.experiment_id;

                if (expId && callbacks?.加载实验数据) {

                    await callbacks.加载实验数据(expId);

                } else {

                    // 如果没有加载实验数据的回调，至少刷新表格和云图
                    callbacks?.刷新数据表格?.();
                    callbacks?.刷新云图?.();
                }
                
                callbacks?.显示状态信息('✅', '基准点已更换', 
                    `测点 ${pointIndex + 1}，重新计算了 ${result.recalculated_points || 0} 个测点`, 'success');
            } else {
                callbacks?.显示状态信息('❌', '更换基准点失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[采集面板] 更换基准点失败:', error);
            callbacks?.显示状态信息('❌', '更换基准点失败', error.toString(), 'error');
        }
    }
    
    // ========== 降噪设置 ==========
    async function 打开降噪设置() {
        // 先从后端获取当前配置
        let currentConfig = {
            denoise: {
                method: 'wavelet',
                wavelet: 'sym6',
                level: 5,
                threshold_mode: 'soft'
            },
            bandpass: {
                lowcut: 1.5,
                highcut: 3.5,
                order: 6
            }
        };
        
        try {
            const denoiseResult = await pywebview.api.get_denoise_config();
            if (denoiseResult.success && denoiseResult.data) {
                currentConfig.denoise = denoiseResult.data;
            }
            
            const bandpassResult = await pywebview.api.get_bandpass_config();
            if (bandpassResult.success && bandpassResult.data) {
                currentConfig.bandpass = bandpassResult.data;
            }
        } catch (error) {
            console.log('获取配置失败，使用默认值');
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'modal';
        overlay.id = 'field-denoise-modal';
        overlay.style.display = 'flex';
        
        overlay.innerHTML = `
            <div class="modal-content field-modal modal-sm">
                <div class="modal-header">
                    <h3>🔧 信号处理设置</h3>
                    <button class="modal-close" onclick="document.getElementById('field-denoise-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-section">
                        <div class="form-section-title">
                            <span class="section-icon">📉</span>
                            <span>降噪参数</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>降噪方法</label>
                                <select id="field-denoise-method" class="form-input">
                                    <option value="wavelet" ${currentConfig.denoise.method === 'wavelet' ? 'selected' : ''}>小波降噪</option>
                                    <option value="savgol" ${currentConfig.denoise.method === 'savgol' ? 'selected' : ''}>Savitzky-Golay滤波</option>
                                    <option value="none" ${currentConfig.denoise.method === 'none' ? 'selected' : ''}>不降噪</option>
                                </select>
                            </div>
                            <div id="field-denoise-wavelet-params">
                                <div class="form-group">
                                    <label>小波基</label>
                                    <select id="field-denoise-wavelet" class="form-input">
                                        <option value="sym6" ${currentConfig.denoise.wavelet === 'sym6' ? 'selected' : ''}>sym6</option>
                                        <option value="db4" ${currentConfig.denoise.wavelet === 'db4' ? 'selected' : ''}>db4</option>
                                        <option value="coif3" ${currentConfig.denoise.wavelet === 'coif3' ? 'selected' : ''}>coif3</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>分解层数</label>
                                    <input type="number" id="field-denoise-level" class="form-input" value="${currentConfig.denoise.level}" min="1" max="10">
                                </div>
                                <div class="form-group">
                                    <label>阈值模式</label>
                                    <select id="field-denoise-threshold-mode" class="form-input">
                                        <option value="soft" ${currentConfig.denoise.threshold_mode === 'soft' ? 'selected' : ''}>软阈值</option>
                                        <option value="hard" ${currentConfig.denoise.threshold_mode === 'hard' ? 'selected' : ''}>硬阈值</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-top: 15px;">
                        <div class="form-section-title">
                            <span class="section-icon">🎛️</span>
                            <span>带通滤波参数</span>
                        </div>
                        <div class="form-section-content">
                            <div class="form-group">
                                <label>低频截止 (MHz)</label>
                                <input type="number" id="field-bandpass-lowcut" class="form-input" value="${currentConfig.bandpass.lowcut}" min="1" max="6" step="0.1">
                                <small style="color: #666; font-size: 11px;">范围: 1-6 MHz</small>
                            </div>
                            <div class="form-group">
                                <label>高频截止 (MHz)</label>
                                <input type="number" id="field-bandpass-highcut" class="form-input" value="${currentConfig.bandpass.highcut}" min="1" max="6" step="0.1">
                                <small style="color: #666; font-size: 11px;">范围: 1-6 MHz</small>
                            </div>
                            <div class="form-group">
                                <label>滤波器阶数</label>
                                <select id="field-bandpass-order" class="form-input">
                                    <option value="2" ${currentConfig.bandpass.order === 2 ? 'selected' : ''}>2阶</option>
                                    <option value="4" ${currentConfig.bandpass.order === 4 ? 'selected' : ''}>4阶</option>
                                    <option value="6" ${currentConfig.bandpass.order === 6 ? 'selected' : ''}>6阶（推荐）</option>
                                    <option value="8" ${currentConfig.bandpass.order === 8 ? 'selected' : ''}>8阶</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('field-denoise-modal').remove()">取消</button>
                    <button class="btn btn-primary" onclick="FieldCapturePanel.保存降噪设置()">保存</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    function 保存降噪设置() {
        // 保存降噪设置
        const method = document.getElementById('field-denoise-method')?.value || 'wavelet';
        const wavelet = document.getElementById('field-denoise-wavelet')?.value || 'sym6';
        const level = parseInt(document.getElementById('field-denoise-level')?.value) || 5;
        const thresholdMode = document.getElementById('field-denoise-threshold-mode')?.value || 'soft';
        
        // 保存带通滤波设置
        const lowcut = parseFloat(document.getElementById('field-bandpass-lowcut')?.value) || 1.5;
        const highcut = parseFloat(document.getElementById('field-bandpass-highcut')?.value) || 3.5;
        const order = parseInt(document.getElementById('field-bandpass-order')?.value) || 4;
        
        // 验证参数
        if (lowcut >= highcut) {
            callbacks?.显示状态信息('⚠️', '参数错误', '低频截止必须小于高频截止', 'warning');
            return;
        }
        
        if (lowcut < 1 || lowcut > 6 || highcut < 1 || highcut > 6) {
            callbacks?.显示状态信息('⚠️', '参数错误', '频率范围必须在 1-6 MHz 之间', 'warning');
            return;
        }
        
        // 保存到实验状态（临时存储）
        if (!实验状态.信号处理配置) {
            实验状态.信号处理配置 = {};
        }
        
        实验状态.信号处理配置.降噪 = {
            method: method,
            wavelet: wavelet,
            level: level,
            thresholdMode: thresholdMode
        };
        
        实验状态.信号处理配置.带通滤波 = {
            lowcut: lowcut,
            highcut: highcut,
            order: order
        };
        
        // 调用后端API保存配置
        (async () => {
            try {
                // 保存降噪配置
                const denoiseEnabled = document.getElementById('field-capture-auto-denoise')?.checked ?? true;
                await pywebview.api.set_denoise_config({
                    enabled: denoiseEnabled,
                    method: method,
                    wavelet: wavelet,
                    level: level,
                    threshold_mode: thresholdMode
                });
                
                // 保存带通滤波配置
                const bandpassEnabled = document.getElementById('field-capture-bandpass-filter')?.checked ?? true;
                await pywebview.api.set_bandpass_config({
                    enabled: bandpassEnabled,
                    lowcut: lowcut,
                    highcut: highcut,
                    order: order
                });
                
                document.getElementById('field-denoise-modal')?.remove();
                callbacks?.显示状态信息('✅', '信号处理设置已保存', 
                    `带通滤波: ${lowcut}-${highcut} MHz`, 'success');
            } catch (error) {
                callbacks?.显示状态信息('❌', '保存失败', error.toString(), 'error');
            }
        })();
    }
    
    // ========== 禁用采集 ==========
    function 禁用采集() {
        停止监控();
        
        // 设置采集流程状态为已完成
        采集流程状态 = 'finished';
        
        // 更新全局控制按钮（开始采集/暂停按钮）
        更新全局控制按钮();
        
        // 禁用采集相关按钮
        const captureBtn = document.getElementById('field-capture-current');
        const skipBtn = document.getElementById('field-capture-skip');
        const recaptureBtn = document.getElementById('field-capture-recapture');
        const baselineBtn = document.getElementById('field-capture-set-baseline');
        
        if (captureBtn) captureBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
        if (recaptureBtn) recaptureBtn.disabled = true;
        if (baselineBtn) baselineBtn.disabled = true;
    }
    
    // ========== 全局采集控制 ==========
    async function 切换采集状态() {
        if (!实验状态.当前实验) {
            callbacks?.显示状态信息('⚠️', '请先创建或加载实验', '', 'warning');
            return;
        }
        
        if (!实验状态.测点列表 || 实验状态.测点列表.length === 0) {
            callbacks?.显示状态信息('⚠️', '请先生成测点', '', 'warning');
            return;
        }
        
        switch (采集流程状态) {
            case 'idle':
                await 开始采集流程();
                break;
            case 'capturing':
                暂停采集流程();
                break;
            case 'paused':
                继续采集流程();
                break;
            case 'finished':
                // 已完成状态不响应
                break;
        }
    }
    
    async function 开始采集流程() {
        // 🆕 验证：必须先加载标定数据
        if (!实验状态.工作流程.已加载标定 || !实验状态.标定数据 || !实验状态.标定系数) {
            callbacks?.显示状态信息('⚠️', '请先加载标定数据', '必须先完成标定数据加载才能开始采集', 'warning');
            return;
        }
        
        // 🆕 验证：必须先应用形状
        if (!实验状态.工作流程.已应用形状) {
            callbacks?.显示状态信息('⚠️', '请先应用试件形状', '必须先完成形状设置并点击"应用"才能开始采集', 'warning');
            return;
        }
        
        // 🆕 验证：必须先生成测点
        if (!实验状态.工作流程.已生成测点 || !实验状态.测点列表 || 实验状态.测点列表.length === 0) {
            callbacks?.显示状态信息('⚠️', '请先生成测点布局', '必须先完成测点生成才能开始采集', 'warning');
            return;
        }
        
        // 检查示波器连接状态
        if (typeof RealtimeCapture !== 'undefined' && !RealtimeCapture.获取连接状态()) {
            callbacks?.显示状态信息('⚠️', '请先连接示波器', '无法开始采集', 'warning');
            return;
        }
        
        // 🆕 自动采集基准点（如果未采集）
        const baselinePointId = 实验状态.当前实验?.baseline_point_id;
        if (baselinePointId !== null && baselinePointId !== undefined) {
            // 检查基准点是否已采集
            const baselinePoint = 实验状态.测点列表.find(p => p.point_index === baselinePointId);
            if (baselinePoint && baselinePoint.status !== 'measured') {
                callbacks?.显示状态信息('🎯', '正在自动采集基准点...', `基准点 ${baselinePointId} 未采集，自动跳转`, 'info');
                
                // 保存当前测点索引
                const originalIndex = 当前测点索引;
                
                // 跳转到基准点并采集
                const success = await 自动采集基准点(baselinePointId);
                
                if (!success) {
                    callbacks?.显示状态信息('❌', '基准点采集失败', '请手动采集基准点后再开始', 'error');
                    return;
                }
                
                // 采集成功后，跳回初始点（点0）
                if (originalIndex !== baselinePointId) {
                    更新当前测点(0);  // 跳回初始点
                    callbacks?.显示状态信息('✅', '基准点采集完成', `已跳回初始点 0`, 'success');
                }
            }
        }
        
        采集流程状态 = 'capturing';
        开始监控();
        更新全局控制按钮();
        启用采集按钮();
        
        // 🆕 锁定配置模块（标定、形状、布点、质量检查模式）
        const 实验流程状态 = callbacks?.获取实验流程状态?.();
        if (实验流程状态 === 'configuring') {
            callbacks?.切换到采集阶段?.();
        }
        
        callbacks?.显示状态信息('✅', '采集已开始', '可以开始采集测点', 'success');

    }
    
    function 暂停采集流程() {
        采集流程状态 = 'paused';
        停止监控();
        更新全局控制按钮();
        禁用采集按钮();
        callbacks?.显示状态信息('ℹ️', '采集已暂停', '点击继续恢复采集', 'info');

    }
    
    function 继续采集流程() {
        采集流程状态 = 'capturing';
        开始监控();
        更新全局控制按钮();
        启用采集按钮();
        callbacks?.显示状态信息('✅', '采集已恢复', '', 'success');

    }
    
    // ========== 自动采集基准点 ==========
    async function 自动采集基准点(baselinePointId) {
        try {
            // 跳转到基准点
            更新当前测点(baselinePointId);
            
            // 等待界面更新
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 采集基准点
            const result = await 采集当前测点();
            
            if (!result || !result.success) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('自动采集基准点失败:', error);
            return false;
        }
    }
    
    async function 完成采集() {
        if (!实验状态.当前实验) {
            callbacks?.显示状态信息('⚠️', '没有进行中的实验', '', 'warning');
            return;
        }
        
        const 已测数量 = 实验状态.已测点列表?.length || 0;
        const 总数量 = 实验状态.测点列表?.length || 0;
        
        if (已测数量 < 3) {
            callbacks?.显示状态信息('⚠️', '至少需要3个测点', '才能生成云图', 'warning');
            return;
        }
        
        // 确认对话框
        const confirmed = await StressDetectionUniaxialModule.显示确认对话框(
            '完成采集',
            `确定完成采集吗？\n\n已采集 ${已测数量}/${总数量} 个测点 (${Math.round(已测数量/总数量*100)}%)\n剩余 ${总数量 - 已测数量} 个测点将标记为未测`
        );
        
        if (!confirmed) return;
        
        // 调用后端API保存完成状态到数据库
        try {
            const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
            const result = await pywebview.api.complete_field_experiment(expId);
            
            if (!result.success) {
                callbacks?.显示状态信息('❌', '保存状态失败', result.message, 'error');
                return;
            }
        } catch (error) {
            console.error('[采集面板] 保存完成状态失败:', error);
            callbacks?.显示状态信息('❌', '保存状态失败', error.toString(), 'error');
            return;
        }
        
        采集流程状态 = 'finished';
        停止监控();
        更新全局控制按钮();
        禁用采集按钮();
        
        // 启用重置按钮（质量检查模式保持禁用，只有重置实验才能重新选择）
        if (typeof StressDetectionUniaxialModule !== 'undefined') {
            StressDetectionUniaxialModule.启用重置按钮();
        }
        
        // 更新实验状态为已完成，并刷新左上角状态显示
        if (实验状态.当前实验) {
            实验状态.当前实验.status = 'completed';
            // 调用主模块更新实验信息显示
            if (typeof StressDetectionUniaxialModule !== 'undefined') {
                StressDetectionUniaxialModule.更新实验信息显示?.();
            }
        }
        
        // 刷新云图
        callbacks?.刷新云图?.();
        
        callbacks?.显示状态信息('✅', '采集完成', `共 ${已测数量} 个有效测点`, 'success');

    }
    
    function 更新全局控制按钮() {
        const btn = document.getElementById('field-capture-start-pause');
        const finishBtn = document.getElementById('field-capture-finish');
        
        if (!btn) return;
        
        // 移除所有状态类
        btn.classList.remove('btn-primary', 'btn-warning', 'btn-success', 'btn-secondary', 'btn-start', 'btn-pause', 'btn-resume');
        
        switch (采集流程状态) {
            case 'idle':
                btn.textContent = '▶️ 开始采集';
                btn.classList.add('btn-primary', 'btn-start');
                btn.disabled = false;
                if (finishBtn) finishBtn.disabled = true;
                break;
            case 'capturing':
                btn.textContent = '⏸️ 暂停';
                btn.classList.add('btn-warning', 'btn-pause');
                btn.disabled = false;
                if (finishBtn) finishBtn.disabled = false;
                break;
            case 'paused':
                btn.textContent = '▶️ 继续';
                btn.classList.add('btn-success', 'btn-resume');
                btn.disabled = false;
                if (finishBtn) finishBtn.disabled = false;
                break;
            case 'finished':
                btn.textContent = '已完成';
                btn.classList.add('btn-secondary');
                btn.disabled = true;
                if (finishBtn) finishBtn.disabled = true;
                break;
        }
    }
    
    function 启用采集按钮() {
        const captureBtn = document.getElementById('field-capture-current');
        const skipBtn = document.getElementById('field-capture-skip');
        const recaptureBtn = document.getElementById('field-capture-recapture');
        const baselineBtn = document.getElementById('field-capture-set-baseline');
        
        if (captureBtn) captureBtn.disabled = false;
        if (skipBtn) skipBtn.disabled = false;
        if (recaptureBtn) recaptureBtn.disabled = false;
        if (baselineBtn) baselineBtn.disabled = false;
    }
    
    function 禁用采集按钮() {
        const captureBtn = document.getElementById('field-capture-current');
        const skipBtn = document.getElementById('field-capture-skip');
        const recaptureBtn = document.getElementById('field-capture-recapture');
        const baselineBtn = document.getElementById('field-capture-set-baseline');
        
        if (captureBtn) captureBtn.disabled = true;
        if (skipBtn) skipBtn.disabled = true;
        if (recaptureBtn) recaptureBtn.disabled = true;
        if (baselineBtn) baselineBtn.disabled = true;
    }
    
    function 重置采集流程() {
        采集流程状态 = 'idle';
        停止监控();
        更新全局控制按钮();
        禁用采集按钮();
        
        // 启用质量检查模式切换
        if (typeof StressDetectionUniaxialModule !== 'undefined') {
            StressDetectionUniaxialModule.启用质量检查模式切换();
        }
    }
    
    // ========== 更新显示 ==========
    function 更新显示() {
        // 根据实验状态同步采集流程状态
        同步采集流程状态();
        
        更新当前测点显示();
        更新监控按钮状态();
        更新全局控制按钮();
    }
    
    // ========== 同步采集流程状态 ==========
    function 同步采集流程状态() {
        if (!实验状态?.当前实验) {
            采集流程状态 = 'idle';
            return;
        }
        
        const expStatus = 实验状态.当前实验.status;
        
        switch (expStatus) {
            case 'completed':
                采集流程状态 = 'finished';
                break;
            case 'collecting':
                // 如果实验状态是采集中，但监控未启动，则设为暂停状态
                采集流程状态 = 监控中 ? 'capturing' : 'paused';
                break;
            case 'planning':
            default:
                采集流程状态 = 'idle';
                break;
        }
    }
    
    function 清空() {
        停止监控();
        重置采集流程();
        
        // 清空显示
        const elements = ['field-capture-point-id', 'field-capture-point-x', 'field-capture-point-y', 
                         'field-capture-result-timediff', 'field-capture-result-stress', 
                         'field-capture-result-quality', 'field-capture-result-snr',
                         'field-capture-total'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
        
        // 重置进度条
        const progressBar = document.getElementById('field-capture-progress-bar');
        if (progressBar) progressBar.style.width = '0%';
        
        // 重置测点状态显示
        const pointStatusEl = document.getElementById('field-capture-point-status');
        if (pointStatusEl) pointStatusEl.textContent = '待测';
        
        // 重置测点类型标识
        const typeSpan = document.getElementById('field-capture-point-type');
        if (typeSpan) {
            typeSpan.textContent = '⚪ 普通测点';
            typeSpan.className = 'normal';
        }
        
        // 重置跳转输入框
        const jumpInput = document.getElementById('field-capture-jump-input');
        if (jumpInput) {
            jumpInput.value = '';
            jumpInput.classList.remove('invalid');
        }
        
        // 清空波形画布
        if (waveformCanvas && waveformCtx) {
            waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        }
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        开始监控,
        停止监控,
        暂停监控,
        恢复监控,
        采集当前测点,
        跳过当前测点,
        重测当前测点,
        上一个测点,
        下一个测点,
        跳转到测点,
        更新当前测点,
        更新当前测点显示,  // 🆕 导出此函数，用于基准点设置后刷新显示
        // 设为基准点功能已移除，请使用左侧"基准波形管理"面板
        打开降噪设置,
        保存降噪设置,
        接受低质量数据,
        重测并关闭警告,
        跳过并关闭警告,
        // 数据异常警告相关
        接受异常数据,
        重测并关闭异常警告,
        跳过并关闭异常警告,
        禁用采集,
        更新显示,
        清空,
        调整波形画布,
        // 全局控制
        切换采集状态,
        完成采集,
        重置采集流程,
        更新全局控制按钮
    };
})();
