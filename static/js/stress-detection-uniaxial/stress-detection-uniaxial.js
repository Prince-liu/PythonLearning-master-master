// ==================== 应力场测绘主模块 ====================
// 功能：协调各子模块、状态管理、标签页切换、初始化

const StressDetectionUniaxialModule = (function() {
    'use strict';
    
    // ========== 全局状态 ==========
    let 实验状态 = {
        当前实验: null,           // 当前加载的实验对象
        标定数据: null,           // 标定系数信息
        标定系数: 0,              // 应力系数 k (MPa/ns)
        形状配置: null,           // 形状定义
        测点列表: [],             // 生成的测点
        已测点列表: [],           // 已采集的测点索引
        已测点数据: [],           // 已采集的测点数据（含应力值）
        基准点ID: 1,              // 基准测点ID（默认为1）
        基准点已采集: false,      // 基准点是否已采集
        当前测点索引: 0,          // 当前采集的测点索引
        实时监控中: false,        // 监控状态
        云图数据: null,           // 云图插值数据
        自动保存状态: 'idle',     // 'idle' | 'saving' | 'saved' | 'error'
        应力计算模式: 'relative', // 'relative' | 'absolute'
        基准点应力值: 0,          // 绝对应力模式下的基准点应力值 (MPa)
        
        // 🆕 工作流程状态标志
        工作流程: {
            已加载实验: false,     // 步骤1：是否已新建或加载实验
            已加载标定: false,     // 步骤2：是否已加载标定数据
            已应用形状: false,     // 步骤3：是否已应用试件形状
            已生成测点: false      // 步骤4：是否已生成测点布局
        }
    };
    
    // DOM 元素缓存
    let elements = {};
    
    // 子模块引用
    let 子模块 = {
        实验管理: null,
        标定面板: null,
        形状面板: null,
        布点面板: null,
        基准管理: null,
        质量检查: null,
        采集面板: null,
        预览画布: null,
        云图显示: null
    };
    
    // 质量检查模式
    let 质量检查模式 = 'strict'; // 'strict' | 'fast'
    
    // ========== 初始化 ==========
    function 初始化() {
        // 缓存DOM元素
        缓存DOM元素();
        
        // 绑定事件
        绑定事件();
        
        // 初始化子模块（按依赖顺序）
        初始化子模块();
    }
    
    // ========== DOM元素缓存 ==========
    function 缓存DOM元素() {
        elements = {
            // 实验信息区
            experimentInfo: document.getElementById('field-experiment-info'),
            experimentName: document.getElementById('field-experiment-name'),
            experimentStatus: document.getElementById('field-experiment-status'),
            experimentProgress: document.getElementById('field-experiment-progress'),
            autoSaveStatus: document.getElementById('field-autosave-status'),
            
            // 控制按钮
            newExperimentBtn: document.getElementById('field-new-experiment-btn'),
            manageExperimentsBtn: document.getElementById('field-manage-experiments-btn'),
            resetExperimentBtn: document.getElementById('field-reset-experiment-btn'),
            
            // 折叠面板
            calibrationPanel: document.getElementById('field-calibration-panel'),
            shapePanel: document.getElementById('field-shape-panel'),
            layoutPanel: document.getElementById('field-layout-panel'),
            baselinePanel: document.getElementById('field-baseline-panel'),
            qualityPanel: document.getElementById('field-quality-panel'),
            capturePanel: document.getElementById('field-capture-panel'),
            
            // 画布区域
            previewCanvas: document.getElementById('field-preview-canvas'),
            contourCanvas: document.getElementById('field-contour-canvas'),
            waveformCanvas: document.getElementById('field-waveform-canvas'),
            
            // 数据表格
            dataTable: document.getElementById('field-data-table'),
            dataTableBody: document.getElementById('field-data-table-body'),
            
            // 状态栏
            statusBar: document.getElementById('field-status-bar'),
            statusIcon: document.getElementById('field-status-icon'),
            statusText: document.getElementById('field-status-text'),
            statusDetail: document.getElementById('field-status-detail')
        };
    }
    
    // ========== 事件绑定 ==========
    function 绑定事件() {
        // 新建实验按钮
        if (elements.newExperimentBtn) {
            elements.newExperimentBtn.addEventListener('click', () => {
                if (子模块.实验管理) {
                    子模块.实验管理.打开新建对话框();
                }
            });
        }
        
        // 管理实验按钮
        if (elements.manageExperimentsBtn) {
            elements.manageExperimentsBtn.addEventListener('click', () => {
                if (子模块.实验管理) {
                    子模块.实验管理.打开管理对话框();
                }
            });
        }
        
        // 重置实验按钮
        if (elements.resetExperimentBtn) {
            elements.resetExperimentBtn.addEventListener('click', 重置当前实验);
        }
        
        // 折叠面板切换
        document.querySelectorAll('.field-panel-header').forEach(header => {
            header.addEventListener('click', function() {
                const panel = this.closest('.field-panel');
                if (panel) {
                    panel.classList.toggle('collapsed');
                }
            });
        });
        
        // 数据导出面板事件
        绑定导出面板事件();
        
        // 基准波形管理面板事件
        绑定基准面板事件();
        
        // 质量检查模式面板事件
        绑定质量检查面板事件();
    }
    
    // ========== 基准波形管理面板事件绑定 ==========
    function 绑定基准面板事件() {
        // 基准点输入框
        const baselineInput = document.getElementById('field-baseline-point-input');
        const setBtn = document.getElementById('field-baseline-set-btn');
        const gotoBtn = document.getElementById('field-baseline-goto-btn');
        
        // 设置基准按钮
        if (setBtn) {
            setBtn.addEventListener('click', async () => {
                const pointNum = parseInt(baselineInput?.value) || 1;
                await 设置基准点(pointNum);
            });
        }
        
        // 采集基准按钮（跳转到基准点并采集）
        if (gotoBtn) {
            gotoBtn.addEventListener('click', async () => {
                const pointNum = parseInt(baselineInput?.value) || 1;
                await 跳转并采集基准点(pointNum);
            });
        }
        
        // 输入框回车事件
        if (baselineInput) {
            baselineInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const pointNum = parseInt(baselineInput.value) || 1;
                    await 设置基准点(pointNum);
                }
            });
            
            // 输入框值变化时更新最大值
            baselineInput.addEventListener('input', () => {
                const max = 实验状态.测点列表?.length || 1;
                if (baselineInput.value > max) {
                    baselineInput.value = max;
                }
                if (baselineInput.value < 1) {
                    baselineInput.value = 1;
                }
            });
        }
        
        // 应力计算模式切换
        const stressModeRadios = document.querySelectorAll('input[name="field-stress-mode"]');
        const absoluteStressInput = document.getElementById('field-absolute-stress-input');
        const baselineStressValue = document.getElementById('field-baseline-stress-value');
        
        stressModeRadios.forEach(radio => {
            radio.addEventListener('change', async (e) => {
                const mode = e.target.value;
                实验状态.应力计算模式 = mode;
                
                // 显示/隐藏绝对应力输入框
                if (absoluteStressInput) {
                    absoluteStressInput.style.display = mode === 'absolute' ? 'block' : 'none';
                }
                
                // 更新应力值显示
                if (mode === 'relative') {
                    实验状态.基准点应力值 = 0;
                    // 同步到后端
                    await pywebview.api.set_baseline_stress_value(0);
                    显示状态信息('✅', '已切换到相对应力模式', '基准点应力 = 0 MPa', 'success');
                } else {
                    const value = parseFloat(baselineStressValue?.value) || 0;
                    实验状态.基准点应力值 = value;
                    // 同步到后端
                    await pywebview.api.set_baseline_stress_value(value);
                    显示状态信息('✅', '已切换到绝对应力模式', `基准点应力 = ${value} MPa`, 'success');
                }
                
                // 重新计算所有测点的应力值
                重新计算应力值();
            });
        });
        
        // 基准点应力值输入
        if (baselineStressValue) {
            baselineStressValue.addEventListener('change', async (e) => {
                const value = parseFloat(e.target.value) || 0;
                实验状态.基准点应力值 = value;
                
                if (实验状态.应力计算模式 === 'absolute') {
                    // 同步到后端
                    await pywebview.api.set_baseline_stress_value(value);
                    显示状态信息('✅', '基准点应力值已更新', `${value} MPa`, 'success');
                    // 重新计算所有测点的应力值
                    重新计算应力值();
                }
            });
        }
    }
    
    // ========== 设置基准点 ==========
    async function 设置基准点(pointNum) {
        if (!实验状态.当前实验) {
            显示状态信息('⚠️', '请先加载实验', '', 'warning');
            return;
        }
        
        const totalPoints = 实验状态.测点列表?.length || 0;
        if (totalPoints === 0) {
            显示状态信息('⚠️', '请先生成测点', '', 'warning');
            return;
        }
        
        if (pointNum < 1 || pointNum > totalPoints) {
            显示状态信息('⚠️', `测点编号无效，范围: 1-${totalPoints}`, '', 'warning');
            return;
        }
        
        // 检查该测点是否已采集
        const point = 实验状态.测点列表.find(p => (p.point_index || p.id) === pointNum);
        const isCollected = point && point.status === 'measured';
        
        if (isCollected) {
            // 已采集，调用后端更换基准点
            const confirmed = await 显示确认对话框(
                '更换基准点',
                `确定要将测点 ${pointNum} 设为新的基准点吗？\n\n所有已测量的应力值将重新计算。`
            );
            
            if (!confirmed) return;
            
            try {
                const result = await pywebview.api.set_baseline_point(pointNum);
                
                if (result.success) {
                    实验状态.基准点ID = pointNum;
                    实验状态.基准点已采集 = true;
                    更新基准点UI(pointNum, true, result.quality);
                    
                    // 重新加载实验数据以更新应力值
                    const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
                    await 加载实验数据(expId);
                    
                    显示状态信息('✅', '基准点已更换', 
                        `测点 ${pointNum}，重新计算了 ${result.recalculated_points || 0} 个测点`, 'success');
                } else {
                    显示状态信息('❌', '更换基准点失败', result.message, 'error');
                }
            } catch (error) {
                console.error('[基准管理] 更换基准点失败:', error);
                显示状态信息('❌', '更换基准点失败', error.toString(), 'error');
            }
        } else {
            // 未采集，预设基准点（调用后端API保存到数据库）
            try {
                const result = await pywebview.api.designate_baseline_point(pointNum);
                
                if (result.success) {
                    实验状态.基准点ID = pointNum;
                    实验状态.基准点已采集 = false;
                    更新基准点UI(pointNum, false);
                    
                    显示状态信息('✅', '基准点已设置', 
                        `测点 ${pointNum}（待采集）\n采集该测点时将自动设为基准波形`, 'success');
                } else {
                    显示状态信息('❌', '设置基准点失败', result.message, 'error');
                }
            } catch (error) {
                console.error('[基准管理] 设置基准点失败:', error);
                显示状态信息('❌', '设置基准点失败', error.toString(), 'error');
            }
        }
    }
    
    // ========== 跳转并采集基准点 ==========
    async function 跳转并采集基准点(pointNum) {
        if (!实验状态.当前实验) {
            显示状态信息('⚠️', '请先加载实验', '', 'warning');
            return;
        }
        
        const totalPoints = 实验状态.测点列表?.length || 0;
        if (pointNum < 1 || pointNum > totalPoints) {
            显示状态信息('⚠️', `测点编号无效，范围: 1-${totalPoints}`, '', 'warning');
            return;
        }
        
        // 先设置基准点（调用后端API）
        try {
            const result = await pywebview.api.designate_baseline_point(pointNum);
            
            if (result.success) {
                实验状态.基准点ID = pointNum;
                实验状态.基准点已采集 = false;
                更新基准点UI(pointNum, false);
                
                // 跳转到该测点
                子模块.采集面板?.跳转到测点(pointNum - 1);  // 索引从0开始
                
                显示状态信息('ℹ️', '已跳转到基准点', `请采集测点 ${pointNum}`, 'info');
            } else {
                显示状态信息('❌', '设置基准点失败', result.message, 'error');
            }
        } catch (error) {
            console.error('[基准管理] 跳转基准点失败:', error);
            显示状态信息('❌', '操作失败', error.toString(), 'error');
        }
    }
    
    // ========== 更新基准点UI ==========
    function 更新基准点UI(pointNum, isCollected, quality = null) {
        const statusBadge = document.getElementById('field-baseline-status');
        const pointIdEl = document.getElementById('field-baseline-point-id');
        const captureStatusEl = document.getElementById('field-baseline-capture-status');
        const snrEl = document.getElementById('field-baseline-snr');
        const qualityEl = document.getElementById('field-baseline-quality');
        const setBtn = document.getElementById('field-baseline-set-btn');
        const inputEl = document.getElementById('field-baseline-point-input');
        
        // 更新输入框
        if (inputEl) {
            inputEl.value = pointNum;
        }
        
        // 更新按钮文字
        if (setBtn) {
            if (isCollected) {
                setBtn.textContent = '🔄 更换基准';
                setBtn.classList.add('is-set');
            } else {
                setBtn.textContent = '📌 设置基准';
                setBtn.classList.remove('is-set');
            }
        }
        
        // 更新状态徽章
        if (statusBadge) {
            if (isCollected) {
                statusBadge.textContent = '✅ 已采集';
                statusBadge.className = 'status-badge success';
            } else {
                statusBadge.textContent = '⏳ 待采集';
                statusBadge.className = 'status-badge warning';
            }
        }
        
        // 更新基准点信息
        if (pointIdEl) pointIdEl.textContent = `#${pointNum}`;
        
        if (captureStatusEl) {
            if (isCollected) {
                captureStatusEl.textContent = '✅ 已采集';
                captureStatusEl.className = 'value good';
            } else {
                captureStatusEl.textContent = '⚪ 未采集';
                captureStatusEl.className = 'value';
            }
        }
        
        // 更新质量信息
        if (quality) {
            if (snrEl) {
                const snr = quality.snr || 0;
                snrEl.textContent = `${snr.toFixed(1)} dB`;
                snrEl.className = snr >= 20 ? 'value good' : (snr >= 15 ? 'value warning' : 'value bad');
            }
            if (qualityEl) {
                const score = (quality.quality_score || quality.score || 0) * 100;
                qualityEl.textContent = `${score.toFixed(0)}%`;
                qualityEl.className = score >= 80 ? 'value good' : (score >= 60 ? 'value warning' : 'value bad');
            }
        } else if (!isCollected) {
            if (snrEl) { snrEl.textContent = '--'; snrEl.className = 'value'; }
            if (qualityEl) { qualityEl.textContent = '--'; qualityEl.className = 'value'; }
        }
    }
    
    // ========== 更新应力计算模式UI ==========
    function 更新应力计算模式UI() {
        const mode = 实验状态.应力计算模式;
        const stressValue = 实验状态.基准点应力值;
        
        // 更新单选按钮
        const relativeRadio = document.querySelector('input[name="field-stress-mode"][value="relative"]');
        const absoluteRadio = document.querySelector('input[name="field-stress-mode"][value="absolute"]');
        
        if (relativeRadio) relativeRadio.checked = (mode === 'relative');
        if (absoluteRadio) absoluteRadio.checked = (mode === 'absolute');
        
        // 更新绝对应力输入框的显示和值
        const absoluteStressInput = document.getElementById('field-absolute-stress-input');
        const baselineStressValue = document.getElementById('field-baseline-stress-value');
        
        if (absoluteStressInput) {
            absoluteStressInput.style.display = (mode === 'absolute') ? 'block' : 'none';
        }
        
        if (baselineStressValue) {
            baselineStressValue.value = stressValue || 0;
        }
    }
    
    // ========== 重新计算应力值 ==========
    function 重新计算应力值() {
        // 如果没有已测点，直接返回
        if (!实验状态.已测点数据 || 实验状态.已测点数据.length === 0) {
            return;
        }
        
        const k = 实验状态.标定系数;
        const baselineStress = 实验状态.基准点应力值 || 0;
        
        // 更新每个测点的应力值
        实验状态.已测点数据.forEach(point => {
            if (point.time_diff !== undefined && point.time_diff !== null) {
                // σ = σ_基准 + k × Δt
                point.stress_value = baselineStress + k * point.time_diff;
            }
        });
        
        // 更新表格显示
        if (typeof FieldCapturePanel !== 'undefined' && FieldCapturePanel.更新数据表格) {
            FieldCapturePanel.更新数据表格();
        }
        
        // 更新云图
        if (typeof FieldContour !== 'undefined' && FieldContour.更新云图) {
            FieldContour.更新云图();
        }
    }
    
    // ========== 质量检查模式面板事件绑定 ==========
    function 绑定质量检查面板事件() {
        const modeCards = document.querySelectorAll('.field-quality-mode-card');
        const modeDesc = document.getElementById('field-quality-mode-desc');
        const featuresStrict = document.getElementById('field-quality-features-strict');
        const featuresFast = document.getElementById('field-quality-features-fast');
        
        const modeDescriptions = {
            'strict': '适合正式实验和高精度测量',
            'fast': '适合快速预扫描和粗略测量'
        };
        
        modeCards.forEach(card => {
            card.addEventListener('click', () => {
                // 检查是否被禁用
                if (card.classList.contains('disabled')) {
                    显示状态信息('⚠️', '采集进行中无法切换模式', '', 'warning');
                    return;
                }
                
                // 移除所有选中状态
                modeCards.forEach(c => c.classList.remove('selected'));
                // 添加当前选中状态
                card.classList.add('selected');
                
                // 更新模式
                质量检查模式 = card.dataset.mode;
                
                // 更新描述
                if (modeDesc) {
                    modeDesc.textContent = modeDescriptions[质量检查模式] || '';
                }
                
                // 更新特性列表显示
                if (featuresStrict && featuresFast) {
                    if (质量检查模式 === 'strict') {
                        featuresStrict.style.display = 'block';
                        featuresFast.style.display = 'none';
                    } else {
                        featuresStrict.style.display = 'none';
                        featuresFast.style.display = 'block';
                    }
                }
                
                显示状态信息('✅', `已切换到${质量检查模式 === 'strict' ? '严格' : '快速'}模式`, '', 'success');
            });
        });
    }
    
    // ========== 质量检查模式禁用/启用 ==========
    function 禁用质量检查模式切换() {
        const modeCards = document.querySelectorAll('.field-quality-mode-card');
        modeCards.forEach(card => {
            card.classList.add('disabled');
        });
    }
    
    function 启用质量检查模式切换() {
        const modeCards = document.querySelectorAll('.field-quality-mode-card');
        modeCards.forEach(card => {
            card.classList.remove('disabled');
        });
    }
    
    // ========== 导出面板事件绑定 ==========
    function 绑定导出面板事件() {
        // 导出格式切换事件
        const formatSelect = document.getElementById('field-export-format');
        const excelOptions = document.getElementById('field-export-excel-options');
        const hdf5Options = document.getElementById('field-export-hdf5-options');
        
        if (formatSelect && excelOptions && hdf5Options) {
            // 格式切换事件处理
            const handleFormatChange = function() {
                const format = formatSelect.value;
                
                // 根据选择的格式显示对应的选项
                if (format === 'excel') {
                    excelOptions.style.display = 'block';
                    hdf5Options.style.display = 'none';
                } else if (format === 'hdf5') {
                    excelOptions.style.display = 'none';
                    hdf5Options.style.display = 'block';
                } else {
                    excelOptions.style.display = 'none';
                    hdf5Options.style.display = 'none';
                }
            };
            
            formatSelect.addEventListener('change', handleFormatChange);
            
            // 初始化时检查一次（如果默认选中Excel或HDF5，立即显示选项）
            handleFormatChange();
        }
        
        const exportBtn = document.getElementById('field-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                if (!实验状态.当前实验) {
                    显示状态信息('⚠️', '请先加载实验', '', 'warning');
                    return;
                }
                
                const format = document.getElementById('field-export-format')?.value || 'csv';
                const includeWaveforms = document.getElementById('field-export-include-waveforms')?.checked || false;
                const includeContour = document.getElementById('field-export-include-contour')?.checked || false;
                const includeStats = document.getElementById('field-export-include-stats')?.checked || false;
                
                // 获取Excel格式选项
                let singleSheet = false;
                if (format === 'excel') {
                    const excelFormat = document.querySelector('input[name="excel-format"]:checked')?.value || 'multi';
                    singleSheet = (excelFormat === 'single');
                }
                
                显示状态信息('⏳', '正在导出...', '', 'info', 0);
                
                try {
                    const result = await pywebview.api.export_field_data(
                        实验状态.当前实验.experiment_id, 
                        format, 
                        {
                            include_waveforms: includeWaveforms,
                            include_stats: includeStats,
                            single_sheet: singleSheet  // 传递Excel格式选项
                        }
                    );
                    
                    if (!result.success) {
                        显示状态信息('❌', '导出失败', result.message, 'error');
                        return;
                    }
                    
                    let message = `数据已导出`;
                    
                    // 导出云图
                    if (includeContour && 子模块.云图显示) {
                        子模块.云图显示.导出云图图片();
                    }
                    
                    显示状态信息('✅', '导出成功', message, 'success', 5000);
                    
                } catch (error) {
                    console.error('[应力场测绘] 导出失败:', error);
                    显示状态信息('❌', '导出失败', error.toString(), 'error');
                }
            });
        }
    }
    
    // ========== 子模块初始化 ==========
    function 初始化子模块() {
        // 实验管理模块
        if (typeof FieldExperimentManager !== 'undefined') {
            子模块.实验管理 = FieldExperimentManager;
            子模块.实验管理.初始化(实验状态, elements, {
                显示状态信息,
                更新实验信息显示,
                加载实验数据,
                清空实验数据
            });
        }
        
        // 标定面板模块
        if (typeof FieldCalibrationPanel !== 'undefined') {
            子模块.标定面板 = FieldCalibrationPanel;
            子模块.标定面板.初始化(实验状态, elements, {
                显示状态信息,
                更新标定数据
            });
        }
        
        // 形状面板模块
        if (typeof FieldShapePanel !== 'undefined') {
            子模块.形状面板 = FieldShapePanel;
            子模块.形状面板.初始化(实验状态, elements, {
                显示状态信息,
                更新形状配置,
                刷新预览画布: () => 子模块.预览画布?.重置视图()  // 形状改变时重置视图，自动适配
            });
        }
        
        // 布点面板模块
        if (typeof FieldLayoutPanel !== 'undefined') {
            子模块.布点面板 = FieldLayoutPanel;
            子模块.布点面板.初始化(实验状态, elements, {
                显示状态信息,
                更新测点列表,
                刷新预览画布: () => 子模块.预览画布?.刷新(),
                刷新数据表格
            });
        }
        
        // 采集面板模块
        if (typeof FieldCapturePanel !== 'undefined') {
            子模块.采集面板 = FieldCapturePanel;
            子模块.采集面板.初始化(实验状态, elements, {
                显示状态信息,
                更新测点状态,
                刷新预览画布: () => 子模块.预览画布?.刷新(),
                刷新云图: 刷新云图,  // 调用主模块的刷新云图函数，会从后端获取新数据
                刷新数据表格,
                加载实验数据  // 用于更换基准点后重新加载数据
            });
        }
        
        // 预览画布模块
        if (typeof FieldCanvas !== 'undefined') {
            子模块.预览画布 = FieldCanvas;
            子模块.预览画布.初始化(实验状态, elements.previewCanvas, {
                显示状态信息,
                选中测点: (pointId) => 子模块.采集面板?.跳转到测点(pointId)
            });
        }
        
        // 云图显示模块
        if (typeof FieldContour !== 'undefined') {
            子模块.云图显示 = FieldContour;
            子模块.云图显示.初始化(实验状态, elements.contourCanvas, {
                显示状态信息
            });
        }
        
        // 面板拖拽和折叠模块
        if (typeof FieldResizer !== 'undefined') {
            FieldResizer.初始化({
                刷新画布: () => {
                    子模块.预览画布?.调整尺寸?.();
                    子模块.云图显示?.调整尺寸?.();
                    子模块.采集面板?.调整波形画布?.();
                }
            });
        }
    }
    
    // ========== 状态信息显示 ==========
    function 显示状态信息(图标, 文本, 详情 = '', 类型 = 'info', 持续时间 = 3000) {
        if (!elements.statusBar) return;
        
        // 设置内容
        if (elements.statusIcon) elements.statusIcon.textContent = 图标;
        if (elements.statusText) elements.statusText.textContent = 文本;
        if (elements.statusDetail) {
            elements.statusDetail.textContent = 详情;
            elements.statusDetail.style.display = 详情 ? 'block' : 'none';
        }
        
        // 设置类型样式
        elements.statusBar.className = 'field-status-bar';
        elements.statusBar.classList.add(类型);
        elements.statusBar.style.display = 'flex';
        
        // 自动隐藏
        if (持续时间 > 0) {
            setTimeout(() => {
                elements.statusBar.style.display = 'none';
            }, 持续时间);
        }
    }
    
    // ========== 实验信息更新 ==========
    function 更新实验信息显示() {
        if (!实验状态.当前实验) {
            if (elements.experimentName) elements.experimentName.textContent = '未加载实验';
            if (elements.experimentStatus) elements.experimentStatus.textContent = '--';
            if (elements.experimentProgress) elements.experimentProgress.textContent = '0/0';
            const stressDirectionEl = document.getElementById('field-stress-direction');
            if (stressDirectionEl) stressDirectionEl.textContent = '--';
            return;
        }
        
        const exp = 实验状态.当前实验;
        if (elements.experimentName) elements.experimentName.textContent = exp.name || exp.experiment_id;
        if (elements.experimentStatus) {
            const statusMap = {
                'planning': '规划中',
                'collecting': '采集中',
                'completed': '已完成'
            };
            elements.experimentStatus.textContent = statusMap[exp.status] || exp.status;
            // 设置状态样式类
            elements.experimentStatus.className = 'field-status-badge';
            if (exp.status) {
                elements.experimentStatus.classList.add(`status-${exp.status}`);
            }
        }
        if (elements.experimentProgress) {
            const total = 实验状态.测点列表.length;
            const measured = 实验状态.已测点列表.length;
            elements.experimentProgress.textContent = `${measured}/${total}`;
        }
        
        // 显示应力方向
        const stressDirectionEl = document.getElementById('field-stress-direction');
        if (stressDirectionEl) {
            stressDirectionEl.textContent = exp.stress_direction || '--';
        }
    }
    
    // ========== 自动保存状态更新 ==========
    function 更新自动保存状态(状态) {
        实验状态.自动保存状态 = 状态;
        if (!elements.autoSaveStatus) return;
        
        const statusMap = {
            'idle': { text: '', icon: '' },
            'saving': { text: '保存中...', icon: '💾' },
            'saved': { text: '已保存', icon: '✅' },
            'error': { text: '保存失败', icon: '❌' }
        };
        
        const info = statusMap[状态] || statusMap['idle'];
        elements.autoSaveStatus.textContent = `${info.icon} ${info.text}`;
    }
    
    // ========== 基准信息更新 ==========
    function 更新基准信息显示(baselineData) {
        const pointIdEl = document.getElementById('field-baseline-point-id');
        const timeEl = document.getElementById('field-baseline-time');
        const snrEl = document.getElementById('field-baseline-snr');
        const qualityEl = document.getElementById('field-baseline-quality');
        const statusEl = document.getElementById('field-baseline-status');
        
        if (!baselineData) {
            if (pointIdEl) pointIdEl.textContent = '--';
            if (timeEl) timeEl.textContent = '--';
            if (snrEl) snrEl.textContent = '--';
            if (qualityEl) qualityEl.textContent = '--';
            if (statusEl) {
                statusEl.textContent = '⚪ 未设置';
                statusEl.className = 'status-badge';
            }
            return;
        }
        
        if (pointIdEl) pointIdEl.textContent = `#${baselineData.point_id || baselineData.point_index || 1}`;
        if (timeEl) timeEl.textContent = baselineData.capture_time || '--';
        if (snrEl) {
            const snr = baselineData.snr;
            snrEl.textContent = snr != null ? `${Number(snr).toFixed(1)} dB` : '--';
            snrEl.className = 'value ' + (snr >= 20 ? 'good' : snr >= 10 ? 'warning' : 'bad');
        }
        if (qualityEl) {
            const quality = baselineData.quality_score;
            if (quality != null) {
                const stars = quality >= 0.9 ? '★★★★★' : quality >= 0.7 ? '★★★★☆' : quality >= 0.5 ? '★★★☆☆' : '★★☆☆☆';
                qualityEl.textContent = `${(Number(quality) * 100).toFixed(0)}% ${stars}`;
                qualityEl.className = 'value ' + (quality >= 0.8 ? 'good' : quality >= 0.5 ? 'warning' : 'bad');
            } else {
                qualityEl.textContent = '--';
            }
        }
        if (statusEl) {
            statusEl.textContent = '✅ 已设置';
            statusEl.className = 'status-badge success';
        }
    }
    
    // ========== 获取质量检查模式 ==========
    function 获取质量检查模式() {
        return 质量检查模式;
    }
    
    // ========== 数据更新回调 ==========
    async function 更新标定数据(data) {
        实验状态.标定数据 = data;
        实验状态.标定系数 = data.k || 0;
        实验状态.工作流程.已加载标定 = true;  // 🆕 标记已完成
        
        // 🆕 保存标定数据到数据库
        if (实验状态.当前实验 && data.source === 'manual') {
            try {
                // 手动输入的标定数据需要保存到数据库
                const result = await pywebview.api.save_manual_calibration(data);
                if (result.success) {

                    显示状态信息('✅', '标定数据已加载并保存', `K = ${data.k} MPa/ns`, 'success');
                } else {
                    console.warn('[应力场] 保存标定数据失败:', result.message);
                    显示状态信息('⚠️', '标定数据已加载但保存失败', result.message, 'warning');
                }
            } catch (error) {
                console.error('[应力场] 保存标定数据异常:', error);
                显示状态信息('⚠️', '标定数据已加载但保存失败', error.toString(), 'warning');
            }
        } else {
            显示状态信息('✅', '标定数据已加载', `K = ${data.k} MPa/ns`, 'success');
        }
    }
    
    async function 更新形状配置(config) {
        实验状态.形状配置 = config;
        // 清空测点（形状变化后需要重新生成）
        实验状态.测点列表 = [];
        实验状态.已测点列表 = [];
        // 清空云图（测点清空后云图也应清空）
        实验状态.云图数据 = null;
        子模块.云图显示?.清空();
        刷新数据表格();
        
        // 保存形状配置到数据库
        if (实验状态.当前实验) {
            try {
                const result = await pywebview.api.save_shape_config(config);
                if (result.success) {

                } else {
                    console.warn('[应力场] 保存形状配置失败:', result.message);
                }
            } catch (error) {
                console.error('[应力场] 保存形状配置异常:', error);
            }
        }
    }
    
    function 更新测点列表(points) {
        实验状态.测点列表 = points;
        实验状态.当前测点索引 = 0;
        // 清空云图（测点重新生成后云图也应清空）
        实验状态.云图数据 = null;
        子模块.云图显示?.清空();
        刷新数据表格();
        更新实验信息显示();
    }
    
    function 更新测点状态(pointIndex, status, data) {
        // 更新测点状态（使用 point_index 查找）
        const point = 实验状态.测点列表.find(p => p.point_index === pointIndex);
        if (point) {
            point.status = status;
            if (data) {
                point.time_diff = data.time_diff;
                point.stress_value = data.stress;
                point.quality_score = data.quality_score;
                point.snr = data.snr;
            }
        }
        
        // 更新已测点列表
        if (status === 'measured' && !实验状态.已测点列表.includes(pointIndex)) {
            实验状态.已测点列表.push(pointIndex);
        }
        
        刷新数据表格();
        更新实验信息显示();
    }
    
    // ========== 数据表格刷新 ==========
    function 刷新数据表格() {
        if (!elements.dataTableBody) return;
        
        // 获取当前布点类型
        const 布点类型 = 子模块.布点面板?.获取当前布点类型?.() || 'grid';
        const 是极坐标 = 布点类型 === 'polar';
        
        // 更新表头
        const thead = elements.dataTable?.querySelector('thead tr');
        if (thead) {
            if (是极坐标) {
                thead.innerHTML = `
                    <th>编号</th>
                    <th>r(mm)</th>
                    <th>θ(°)</th>
                    <th>Δt(ns)</th>
                    <th>σ(MPa)</th>
                    <th>质量</th>
                    <th>操作</th>
                `;
            } else {
                thead.innerHTML = `
                    <th>编号</th>
                    <th>X(mm)</th>
                    <th>Y(mm)</th>
                    <th>Δt(ns)</th>
                    <th>σ(MPa)</th>
                    <th>质量</th>
                    <th>操作</th>
                `;
            }
        }
        
        elements.dataTableBody.innerHTML = '';
        
        if (实验状态.测点列表.length === 0) {
            elements.dataTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">暂无测点数据</td></tr>';
            return;
        }
        
        实验状态.测点列表.forEach((point, index) => {
            const row = document.createElement('tr');
            row.className = `point-row status-${point.status || 'pending'}`;
            if (index === 实验状态.当前测点索引) {
                row.classList.add('current');
            }
            
            // 状态图标
            const statusIcons = {
                'pending': '⚪',
                'measured': '🟢',
                'skipped': '🟠',
                'error': '🔴',
                'current': '🟡'
            };
            const statusIcon = index === 实验状态.当前测点索引 ? '🟡' : (statusIcons[point.status] || '⚪');
            
            // 根据布点类型显示不同的坐标列
            let coord1, coord2;
            if (是极坐标) {
                const r = point.r_coord ?? point.r;
                const theta = point.theta_coord ?? point.theta;
                coord1 = (r != null) ? Number(r).toFixed(1) : '--';
                coord2 = (theta != null) ? Number(theta).toFixed(1) : '--';
            } else {
                const x = point.x_coord ?? point.x;
                const y = point.y_coord ?? point.y;
                coord1 = (x != null) ? Number(x).toFixed(1) : '--';
                coord2 = (y != null) ? Number(y).toFixed(1) : '--';
            }
            
            row.innerHTML = `
                <td>${statusIcon} ${point.point_index ?? point.id ?? (index + 1)}</td>
                <td>${coord1}</td>
                <td>${coord2}</td>
                <td>${point.time_diff != null ? Number(point.time_diff).toFixed(2) : '--'}</td>
                <td>${point.stress_value != null ? Number(point.stress_value).toFixed(1) : '--'}</td>
                <td>${point.quality_score != null ? (Number(point.quality_score) * 100).toFixed(0) + '%' : '--'}</td>
                <td>
                    <button class="btn btn-sm" onclick="StressDetectionUniaxialModule.跳转到测点(${index})" title="跳转">📍</button>
                </td>
            `;
            
            // 点击行高亮测点
            row.addEventListener('click', () => {
                子模块.预览画布?.高亮测点(point.point_index ?? point.id);
                子模块.云图显示?.高亮测点(point.point_index ?? point.id);
            });
            
            elements.dataTableBody.appendChild(row);
        });
    }

    
    // ========== 实验数据加载 ==========
    async function 加载实验数据(expId) {
        try {
            显示状态信息('⏳', '正在加载实验...', '', 'info', 0);
            
            // 🆕 先清空所有面板（新建实验时数据为空，加载实验时会被覆盖）
            清空所有面板();
            
            const result = await pywebview.api.load_field_experiment(expId);
            
            if (!result.success) {
                显示状态信息('❌', '加载实验失败', result.message, 'error');
                return false;
            }
            
            const data = result.data;
            
            // 更新状态
            实验状态.当前实验 = data.experiment;
            
            // 🔧 修复问题1：优先从数据库获取标定系数，其次从config_snapshot
            const dbCalibrationK = data.experiment.calibration_k;
            const snapshotCalibration = data.experiment.config_snapshot?.calibration || null;
            
            if (dbCalibrationK && dbCalibrationK > 0) {
                // 数据库有标定系数（手动输入的情况）
                实验状态.标定数据 = snapshotCalibration || { k: dbCalibrationK, source: 'manual' };
                实验状态.标定数据.k = dbCalibrationK;  // 确保使用数据库的值
                实验状态.标定系数 = dbCalibrationK;
            } else if (snapshotCalibration && snapshotCalibration.k > 0) {
                // 从config_snapshot获取
                实验状态.标定数据 = snapshotCalibration;
                实验状态.标定系数 = snapshotCalibration.k;
            } else {
                实验状态.标定数据 = null;
                实验状态.标定系数 = 0;
            }
            
            实验状态.形状配置 = data.experiment.shape_config || null;
            // 使用 points 而不是 point_layout，因为 points 包含完整的测点信息（包括 point_index）
            实验状态.测点列表 = data.points || [];
            实验状态.已测点列表 = (data.points || [])
                .filter(p => p.status === 'measured')
                .map(p => p.point_index);
            
            // 🔧 修复问题3：正确计算当前测点索引（找到第一个未测量的测点）
            const firstPendingIndex = 实验状态.测点列表.findIndex(p => p.status !== 'measured');
            if (firstPendingIndex >= 0) {
                实验状态.当前测点索引 = firstPendingIndex;
            } else if (实验状态.测点列表.length > 0) {
                // 所有测点都已测量，指向最后一个测点
                实验状态.当前测点索引 = 实验状态.测点列表.length - 1;
            } else {
                实验状态.当前测点索引 = 0;
            }
            
            // 🆕 更新工作流程状态
            实验状态.工作流程.已加载实验 = true;
            实验状态.工作流程.已加载标定 = !!实验状态.标定数据;
            实验状态.工作流程.已应用形状 = !!实验状态.形状配置;
            实验状态.工作流程.已生成测点 = 实验状态.测点列表.length > 0;
            
            // 处理基准点
            const savedBaselineId = data.experiment.baseline_point_id;
            if (savedBaselineId) {
                实验状态.基准点ID = savedBaselineId;
                实验状态.基准点已采集 = 实验状态.已测点列表.includes(savedBaselineId);
            } else {
                // 没有保存的基准点，默认为1
                实验状态.基准点ID = 1;
                实验状态.基准点已采集 = 实验状态.已测点列表.includes(1);
            }
            
            // 恢复应力计算模式和基准点应力值
            const savedBaselineStress = data.experiment.baseline_stress;
            if (savedBaselineStress != null && savedBaselineStress !== 0) {
                // 绝对应力模式
                实验状态.应力计算模式 = 'absolute';
                实验状态.基准点应力值 = savedBaselineStress;
            } else {
                // 相对应力模式
                实验状态.应力计算模式 = 'relative';
                实验状态.基准点应力值 = 0;
            }
            // 更新应力计算模式UI
            更新应力计算模式UI();
            
            // 更新各面板显示
            更新实验信息显示();
            子模块.标定面板?.更新显示(实验状态.标定数据);
            子模块.形状面板?.更新显示(实验状态.形状配置);
            
            // 🔧 修复问题2：恢复布点参数
            const layoutConfig = data.experiment.config_snapshot?.layout || null;
            子模块.布点面板?.恢复布点参数(layoutConfig, 实验状态.测点列表);
            
            子模块.采集面板?.更新显示();
            子模块.预览画布?.刷新();
            刷新数据表格();
            
            // 根据实验状态更新按钮
            const expStatus = data.experiment.status;
            if (expStatus === 'completed') {
                // 已完成实验：启用重置按钮，禁用采集按钮
                if (elements.resetExperimentBtn) {
                    elements.resetExperimentBtn.disabled = false;
                }
                子模块.采集面板?.禁用采集();
            } else if (expStatus === 'collecting') {
                // 采集中实验：启用重置按钮
                if (elements.resetExperimentBtn) {
                    elements.resetExperimentBtn.disabled = false;
                }
            } else {
                // 规划中实验：禁用重置按钮
                if (elements.resetExperimentBtn) {
                    elements.resetExperimentBtn.disabled = true;
                }
            }
            
            // 更新基准点UI
            const baselineQuality = data.baseline_data?.quality || null;
            更新基准点UI(实验状态.基准点ID, 实验状态.基准点已采集, baselineQuality);
            
            // 处理云图：先清空，然后根据测点数量决定是否加载
            if (实验状态.已测点列表.length >= 3) {
                await 刷新云图();
            } else {
                // 测点数不足，清空云图
                实验状态.云图数据 = null;
                子模块.云图显示?.清空();
            }
            
            显示状态信息('✅', '实验加载成功', data.name, 'success');
            return true;
            
        } catch (error) {
            console.error('[应力场测绘] 加载实验失败:', error);
            显示状态信息('❌', '加载实验失败', error.toString(), 'error');
            return false;
        }
    }
    
    // ========== 清空所有面板（用于新建/加载实验时）==========
    function 清空所有面板() {
        // 清空工作流程状态
        实验状态.工作流程.已加载实验 = false;
        实验状态.工作流程.已加载标定 = false;
        实验状态.工作流程.已应用形状 = false;
        实验状态.工作流程.已生成测点 = false;
        
        // 清空各面板
        子模块.标定面板?.清空();
        子模块.形状面板?.清空();
        子模块.布点面板?.清空();
        子模块.采集面板?.清空();
        子模块.预览画布?.清空();
        子模块.云图显示?.清空();

    }
    
    // ========== 清空实验数据 ==========
    function 清空实验数据() {
        实验状态.当前实验 = null;
        实验状态.标定数据 = null;
        实验状态.标定系数 = 0;
        实验状态.形状配置 = null;
        实验状态.测点列表 = [];
        实验状态.已测点列表 = [];
        实验状态.已测点数据 = [];
        实验状态.基准点ID = 1;
        实验状态.基准点已采集 = false;
        实验状态.当前测点索引 = 0;
        实验状态.云图数据 = null;
        实验状态.应力计算模式 = 'relative';
        实验状态.基准点应力值 = 0;
        
        更新实验信息显示();
        更新基准点UI(1, false);
        更新应力计算模式UI();
        子模块.标定面板?.清空();
        子模块.形状面板?.清空();
        子模块.布点面板?.清空();
        子模块.采集面板?.清空();
        子模块.预览画布?.清空();
        子模块.云图显示?.清空();
        刷新数据表格();
    }
    
    // ========== 重置实验 ==========
    async function 重置当前实验() {
        if (!实验状态.当前实验) {
            显示状态信息('⚠️', '没有正在进行的实验', '', 'warning');
            return;
        }
        
        // 确认对话框
        const confirmed = await 显示确认对话框(
            '重置实验',
            `确定要重置实验"${实验状态.当前实验.name}"吗？\n\n这将清空所有已采集的数据，实验状态将恢复为"规划中"。`
        );
        
        if (!confirmed) return;
        
        try {
            const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
            const result = await pywebview.api.reset_field_experiment(expId);
            
            if (result.success) {
                // 重新加载实验数据
                await 加载实验数据(expId);
                
                // 重置采集面板状态（恢复开始采集按钮）
                子模块.采集面板?.重置采集流程();
                
                // 禁用重置按钮
                if (elements.resetExperimentBtn) {
                    elements.resetExperimentBtn.disabled = true;
                }
                
                显示状态信息('✅', '实验已重置', '可以重新开始采集', 'success');
            } else {
                显示状态信息('❌', '重置实验失败', result.message, 'error');
            }
        } catch (error) {
            显示状态信息('❌', '重置实验失败', error.toString(), 'error');
        }
    }
    
    // ========== 启用重置按钮 ==========
    function 启用重置按钮() {
        if (elements.resetExperimentBtn) {
            elements.resetExperimentBtn.disabled = false;
        }
    }
    
    // ========== 刷新云图 ==========
    async function 刷新云图() {

        if (!实验状态.当前实验) {

            return;
        }
        
        // 获取实验ID（兼容不同字段名）
        const expId = 实验状态.当前实验.id || 实验状态.当前实验.experiment_id;
        if (!expId) {
            console.error('[应力场测绘] 无法获取实验ID');
            return;
        }

        try {
            const result = await pywebview.api.update_field_contour(expId);

            if (result.success) {
                // update_field_contour 直接返回数据，不嵌套在 data 里
                实验状态.云图数据 = result;
                子模块.云图显示?.更新数据(result);
            } else {
                console.error('[应力场测绘] 刷新云图失败:', result.message);
            }
        } catch (error) {
            console.error('[应力场测绘] 刷新云图失败:', error);
        }
    }
    
    // ========== 跳转到测点 ==========
    function 跳转到测点(index) {
        if (index < 0 || index >= 实验状态.测点列表.length) return;
        
        实验状态.当前测点索引 = index;
        刷新数据表格();
        
        const point = 实验状态.测点列表[index];
        子模块.预览画布?.高亮测点(point.id);
        子模块.采集面板?.更新当前测点(index);
    }
    
    // ========== 确认对话框 ==========
    function 显示确认对话框(标题, 消息) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.style.display = 'flex';
            
            overlay.innerHTML = `
                <div class="modal-content field-modal modal-sm">
                    <div class="modal-header">
                        <h3>${标题}</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <p class="confirm-message">${消息}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">取消</button>
                        <button class="btn btn-primary confirm-btn">确定</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            const cleanup = () => document.body.removeChild(overlay);
            
            overlay.querySelector('.modal-close').onclick = () => { cleanup(); resolve(false); };
            overlay.querySelector('.cancel-btn').onclick = () => { cleanup(); resolve(false); };
            overlay.querySelector('.confirm-btn').onclick = () => { cleanup(); resolve(true); };
            
            // ESC键取消
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                    document.removeEventListener('keydown', handleKeydown);
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }
    
    // ========== 标签页监控 ==========
    function 启动标签页监控() {

        // 调整画布尺寸
        子模块.预览画布?.调整尺寸();
        子模块.云图显示?.调整尺寸();
        子模块.采集面板?.调整波形画布();
        
        // 如果有实验正在进行，恢复监控
        if (实验状态.当前实验 && 实验状态.当前实验.status === 'collecting') {
            子模块.采集面板?.恢复监控();
        }
    }
    
    function 停止标签页监控() {

        // 暂停实时监控
        子模块.采集面板?.暂停监控();
    }
    
    // ========== 获取状态 ==========
    function 获取实验状态() {
        return 实验状态;
    }
    
    function 获取当前实验() {
        return 实验状态.当前实验;
    }
    
    // ========== 公共接口 ==========
    return {
        初始化,
        启动标签页监控,
        停止标签页监控,
        获取实验状态,
        获取当前实验,
        获取质量检查模式,
        禁用质量检查模式切换,
        启用质量检查模式切换,
        跳转到测点,
        刷新云图,
        刷新数据表格,
        显示状态信息,
        显示确认对话框,
        加载实验数据,
        清空实验数据,
        更新基准点UI,
        更新实验信息显示,
        启用重置按钮
    };
})();
